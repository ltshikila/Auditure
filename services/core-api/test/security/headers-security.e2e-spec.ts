/**
 * Security Tests: HTTP Headers & CORS
 *
 * Tests that the application properly:
 * - Removes the X-Powered-By header via helmet
 * - Rejects requests from arbitrary / disallowed origins
 * - Handles CORS preflight (OPTIONS) requests correctly
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import helmet from 'helmet';

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

/**
 * The allowed origins must match what main.ts configures.
 * When CORS_ORIGINS env is not set the defaults are:
 *   ['http://localhost:8081', 'exp://192.168.1.*', 'http://localhost:19006']
 */
const ALLOWED_ORIGIN = 'http://localhost:8081';
const DISALLOWED_ORIGIN = 'https://evil-site.example.com';

describe('Security: HTTP Headers & CORS (e2e)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
        // Ensure env is set for test
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
        process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key';

        // Clear CORS_ORIGINS so the app falls back to its default origins list
        delete process.env.CORS_ORIGINS;

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

        // Replicate main.ts middleware stack
        app.use(helmet());

        const defaultOrigins = [
            'http://localhost:8081',
            'exp://192.168.1.*',
            'http://localhost:19006',
        ];
        app.enableCors({
            origin: defaultOrigins,
            credentials: true,
        });

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
    });

    // ============================================
    // 1. HELMET SECURITY HEADERS
    // ============================================

    describe('Helmet Security Headers', () => {
        describe('X-Powered-By header removal', () => {
            it('should NOT expose X-Powered-By header on any response', async () => {
                const response = await request(app.getHttpServer())
                    .get('/')
                    .expect((res) => {
                        // helmet removes X-Powered-By: Express
                        expect(res.headers['x-powered-by']).toBeUndefined();
                    });
            });

            it('should NOT expose X-Powered-By on a 404 route', async () => {
                const response = await request(app.getHttpServer())
                    .get('/nonexistent-route-12345');

                expect(response.headers['x-powered-by']).toBeUndefined();
            });

            it('should NOT expose X-Powered-By on POST routes', async () => {
                const response = await request(app.getHttpServer())
                    .post('/auth/register')
                    .send({});

                expect(response.headers['x-powered-by']).toBeUndefined();
            });
        });
    });

    // ============================================
    // 2. CORS ENFORCEMENT
    // ============================================

    describe('CORS Enforcement', () => {
        describe('Arbitrary origins are rejected', () => {
            it('should NOT include Access-Control-Allow-Origin for a disallowed origin', async () => {
                const response = await request(app.getHttpServer())
                    .get('/')
                    .set('Origin', DISALLOWED_ORIGIN);

                // When the origin is not allowed, NestJS/Express CORS middleware
                // simply omits the Access-Control-Allow-Origin header.
                expect(response.headers['access-control-allow-origin']).toBeUndefined();
            });

            it('should NOT include Access-Control-Allow-Origin for an attacker origin', async () => {
                const response = await request(app.getHttpServer())
                    .get('/')
                    .set('Origin', 'https://attacker.com');

                expect(response.headers['access-control-allow-origin']).toBeUndefined();
            });

            it('should NOT include Access-Control-Allow-Origin for null origin', async () => {
                const response = await request(app.getHttpServer())
                    .get('/')
                    .set('Origin', 'null');

                expect(response.headers['access-control-allow-origin']).toBeUndefined();
            });
        });

        describe('Allowed origins are accepted', () => {
            it('should include Access-Control-Allow-Origin for an allowed origin', async () => {
                const response = await request(app.getHttpServer())
                    .get('/')
                    .set('Origin', ALLOWED_ORIGIN);

                expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
            });
        });

        describe('CORS preflight (OPTIONS) handling', () => {
            it('should respond to OPTIONS preflight from allowed origin with correct headers', async () => {
                const response = await request(app.getHttpServer())
                    .options('/auth/register')
                    .set('Origin', ALLOWED_ORIGIN)
                    .set('Access-Control-Request-Method', 'POST')
                    .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

                // Preflight should return 204 No Content
                expect(response.status).toBe(204);

                // Should echo back the allowed origin
                expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);

                // Should allow the requested method
                expect(response.headers['access-control-allow-methods']).toBeDefined();

                // Should support credentials
                expect(response.headers['access-control-allow-credentials']).toBe('true');
            });

            it('should NOT include allow-origin for preflight from disallowed origin', async () => {
                const response = await request(app.getHttpServer())
                    .options('/auth/register')
                    .set('Origin', DISALLOWED_ORIGIN)
                    .set('Access-Control-Request-Method', 'POST')
                    .set('Access-Control-Request-Headers', 'Content-Type');

                // The CORS middleware should not set the allow-origin header
                expect(response.headers['access-control-allow-origin']).toBeUndefined();
            });

            it('should handle preflight for protected routes correctly', async () => {
                const response = await request(app.getHttpServer())
                    .options('/auth/me')
                    .set('Origin', ALLOWED_ORIGIN)
                    .set('Access-Control-Request-Method', 'GET')
                    .set('Access-Control-Request-Headers', 'Authorization');

                expect(response.status).toBe(204);
                expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
            });
        });
    });

    // ============================================
    // 3. RESPONSE DOES NOT LEAK SERVER INFO
    // ============================================

    describe('Server Information Leakage Prevention', () => {
        it('should not reveal framework details in error responses', async () => {
            const response = await request(app.getHttpServer())
                .get('/nonexistent-route-xyz');

            const body = JSON.stringify(response.body);

            // Should not contain NestJS/Express specific internal error info
            expect(body).not.toContain('NestFactory');
            expect(body).not.toContain('node_modules');
            expect(body).not.toContain('ExceptionFilter');
        });

        it('should not expose stack traces in error responses', async () => {
            // Trigger a validation error
            const response = await request(app.getHttpServer())
                .post('/auth/register')
                .send({});

            const body = JSON.stringify(response.body);

            // Stack traces should never appear in API responses
            expect(body).not.toContain('at Object.');
            expect(body).not.toContain('at Module.');
            expect(body).not.toContain('.ts:');
            expect(body).not.toContain('.js:');
        });
    });
});
