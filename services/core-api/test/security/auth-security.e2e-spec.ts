/**
 * Security Tests: Authentication & JWT Token Attacks
 *
 * Tests that the auth layer properly rejects:
 * - Expired, malformed, and wrongly-signed JWTs
 * - Missing or malformed Authorization headers
 * - SQL injection in email fields
 * - Extra/unknown fields (forbidNonWhitelisted)
 * - Missing required fields on registration
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';

// Modules
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';
import { RedisService } from '../../src/redis/redis.service';
import { StorageService } from '../../src/common/storage.service';
import { RabbitMQService } from '../../src/rabbitmq/rabbitmq.service';
import { GlobalExceptionFilter } from '../../src/common/filters/http-exception.filter';

// Mocks
import { mockPrismaClient } from '../mocks/database.mock';
import {
    mockRedisService,
    mockStorageService,
    mockRabbitMQServiceWithEpisodes,
} from '../mocks/services.mock';

// Use a known secret for generating test tokens
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const WRONG_JWT_SECRET = 'completely-wrong-secret-that-should-never-match';

describe('Security: Authentication & JWT Token Attacks (e2e)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
        // Ensure the JWT_SECRET env var is set for the test
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(DatabaseService)
            .useValue(mockPrismaClient)
            .overrideProvider(RedisService)
            .useValue(mockRedisService)
            .overrideProvider(StorageService)
            .useValue(mockStorageService)
            .overrideProvider(RabbitMQService)
            .useValue(mockRabbitMQServiceWithEpisodes)
            .compile();

        app = moduleFixture.createNestApplication();

        // Replicate the same global pipes and filters used in main.ts
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        app.useGlobalFilters(new GlobalExceptionFilter());

        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Default: rate limiter always allows
        mockRedisService.checkRateLimit.mockResolvedValue(true);
    });

    // ============================================
    // Helper: create a valid-looking JWT with custom options
    // ============================================

    function signToken(
        payload: Record<string, unknown>,
        secret: string,
        options?: jwt.SignOptions,
    ): string {
        return jwt.sign(payload, secret, options);
    }

    // ============================================
    // 1. JWT TOKEN ATTACKS
    // ============================================

    describe('JWT Token Attacks on GET /auth/me', () => {
        describe('Reject expired JWT', () => {
            it('should return 401 when JWT is expired', async () => {
                // Create a token that expired 1 hour ago
                const expiredToken = signToken(
                    { sub: 'user-123', email: 'test@example.com' },
                    TEST_JWT_SECRET,
                    { expiresIn: '-1h' },
                );

                const response = await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', `Bearer ${expiredToken}`)
                    .expect(401);

                expect(response.body.statusCode).toBe(401);
            });
        });

        describe('Reject malformed JWT', () => {
            it('should return 401 for a completely invalid token string', async () => {
                await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', 'Bearer not-a-valid-jwt-at-all')
                    .expect(401);
            });

            it('should return 401 for a token with invalid base64 segments', async () => {
                await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', 'Bearer aaa.bbb.ccc')
                    .expect(401);
            });

            it('should return 401 for an empty Bearer token', async () => {
                await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', 'Bearer ')
                    .expect(401);
            });
        });

        describe('Reject missing Bearer prefix', () => {
            it('should return 401 when Authorization header has no Bearer prefix', async () => {
                const validToken = signToken(
                    { sub: 'user-123', email: 'test@example.com' },
                    TEST_JWT_SECRET,
                    { expiresIn: '1h' },
                );

                await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', validToken)
                    .expect(401);
            });

            it('should return 401 when using Basic auth scheme instead of Bearer', async () => {
                await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', 'Basic dXNlcjpwYXNz')
                    .expect(401);
            });
        });

        describe('Reject JWT signed with wrong secret', () => {
            it('should return 401 when JWT is signed with a different secret', async () => {
                const wrongSecretToken = signToken(
                    { sub: 'user-123', email: 'test@example.com' },
                    WRONG_JWT_SECRET,
                    { expiresIn: '1h' },
                );

                await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', `Bearer ${wrongSecretToken}`)
                    .expect(401);
            });
        });

        describe('Reject no Authorization header', () => {
            it('should return 401 when no Authorization header is provided on GET /auth/me', async () => {
                await request(app.getHttpServer()).get('/auth/me').expect(401);
            });
        });

        describe('Reject token with valid signature but non-existent user', () => {
            it('should return 401 when the user in the JWT does not exist in DB', async () => {
                // The JwtStrategy.validate() looks up the user and throws UnauthorizedException
                // if not found. Mock the DB to return null.
                mockPrismaClient.user.findUnique.mockResolvedValue(null);

                const tokenForGhostUser = signToken(
                    { sub: 'non-existent-user-id', email: 'ghost@example.com' },
                    TEST_JWT_SECRET,
                    { expiresIn: '1h' },
                );

                await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', `Bearer ${tokenForGhostUser}`)
                    .expect(401);
            });
        });

        describe('Reject token for unverified user', () => {
            it('should return 401 when JWT belongs to an unverified user', async () => {
                // The JwtStrategy.validate() checks isEmailVerified and throws
                // UnauthorizedException if false.
                mockPrismaClient.user.findUnique.mockResolvedValue({
                    id: 'unverified-user-123',
                    email: 'unverified@example.com',
                    isEmailVerified: false,
                });

                const unverifiedToken = signToken(
                    { sub: 'unverified-user-123', email: 'unverified@example.com' },
                    TEST_JWT_SECRET,
                    { expiresIn: '1h' },
                );

                await request(app.getHttpServer())
                    .get('/auth/me')
                    .set('Authorization', `Bearer ${unverifiedToken}`)
                    .expect(401);
            });
        });
    });

    // ============================================
    // 2. INPUT VALIDATION
    // ============================================

    describe('Input Validation on POST /auth/register', () => {
        describe('Reject SQL injection in email field', () => {
            it('should reject SQL injection payload in email', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: "admin'--",
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                    })
                    .expect(400);

                // The @IsEmail() validator rejects this as an invalid email
                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('email')]),
                );
            });

            it('should reject UNION SELECT injection in email', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: "' UNION SELECT * FROM users--",
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
            });

            it('should reject OR 1=1 injection in email', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: "test@test.com' OR '1'='1",
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
            });
        });

        describe('Reject extra unknown fields (forbidNonWhitelisted)', () => {
            it('should reject request with unknown fields', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: 'valid@example.com',
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                        isAdmin: true, // Unknown field
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('isAdmin')]),
                );
            });

            it('should reject request with role field injection', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: 'valid@example.com',
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                        role: 'ADMIN', // Privilege escalation attempt
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('role')]),
                );
            });

            it('should reject request with subscriptionTier injection', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: 'valid@example.com',
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                        subscriptionTier: 'PRO', // Subscription tier injection
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('subscriptionTier')]),
                );
            });
        });

        describe('Reject missing required fields', () => {
            it('should reject request with missing email', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('email')]),
                );
            });

            it('should reject request with missing password', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: 'valid@example.com',
                        dateOfBirth: '1990-01-01',
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('password')]),
                );
            });

            it('should reject request with missing firstName', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        lastName: 'User',
                        email: 'valid@example.com',
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('firstName')]),
                );
            });

            it('should reject request with missing lastName', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        email: 'valid@example.com',
                        dateOfBirth: '1990-01-01',
                        password: 'securePassword123',
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('lastName')]),
                );
            });

            it('should accept request with missing dateOfBirth (optional field)', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: 'optional-dob@example.com',
                        password: 'securePassword123',
                    });

                // Should not reject for missing dateOfBirth — it's optional
                expect(response.status).not.toBe(400);
            });

            it('should reject completely empty body', async () => {
                await request(app.getHttpServer()).post('/auth/register').send({}).expect(400);
            });

            it('should reject password shorter than 6 characters', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: 'valid@example.com',
                        dateOfBirth: '1990-01-01',
                        password: 'short',
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('password')]),
                );
            });

            it('should reject invalid dateOfBirth format', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({
                        firstName: 'Test',
                        lastName: 'User',
                        email: 'valid@example.com',
                        dateOfBirth: 'not-a-date',
                        password: 'securePassword123',
                    })
                    .expect(400);

                expect(response.body.statusCode).toBe(400);
                expect(response.body.message).toEqual(
                    expect.arrayContaining([expect.stringContaining('dateOfBirth')]),
                );
            });
        });
    });
});
