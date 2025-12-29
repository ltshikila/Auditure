import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../common/email.service';
import {
    createMockUser,
    createVerifiedMockUser,
    mockRegisterDto,
    mockLoginDto,
    mockVerifyDto,
} from '../../test/fixtures/users.fixture';
import { mockPrismaClient } from '../../test/mocks/database.mock';
import { mockEmailService } from '../../test/mocks/services.mock';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
    genSalt: jest.fn().mockResolvedValue('mock-salt'),
    hash: jest.fn().mockResolvedValue('hashed-password'),
    compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
    let service: AuthService;
    let databaseService: DatabaseService;
    let jwtService: JwtService;
    let emailService: EmailService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: DatabaseService,
                    useValue: mockPrismaClient,
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn().mockReturnValue('mock-jwt-token'),
                        verify: jest
                            .fn()
                            .mockReturnValue({ sub: 'user-id', email: 'test@example.com' }),
                    },
                },
                {
                    provide: EmailService,
                    useValue: mockEmailService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        databaseService = module.get<DatabaseService>(DatabaseService);
        jwtService = module.get<JwtService>(JwtService);
        emailService = module.get<EmailService>(EmailService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const mockUser = createMockUser();
            mockPrismaClient.user.findUnique.mockResolvedValue(null);
            mockPrismaClient.user.create.mockResolvedValue(mockUser);

            const result = await service.register(mockRegisterDto);

            expect(result).toEqual({
                message:
                    'Registration successful. Please check your email for the verification code.',
                email: mockUser.email,
            });
            expect(databaseService.user.findUnique).toHaveBeenCalledWith({
                where: { email: mockRegisterDto.email },
            });
            expect(databaseService.user.create).toHaveBeenCalled();
            expect(emailService.sendOTP).toHaveBeenCalledWith(mockUser.email, expect.any(String));
        });

        it('should throw ConflictException if email already exists', async () => {
            const existingUser = createMockUser();
            mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);

            await expect(service.register(mockRegisterDto)).rejects.toThrow(ConflictException);
            expect(databaseService.user.create).not.toHaveBeenCalled();
        });

        it('should hash password before storing', async () => {
            const mockUser = createMockUser();
            const bcrypt = require('bcrypt');

            mockPrismaClient.user.findUnique.mockResolvedValue(null);
            mockPrismaClient.user.create.mockResolvedValue(mockUser);

            await service.register(mockRegisterDto);

            expect(bcrypt.hash).toHaveBeenCalledWith(mockRegisterDto.password, 'mock-salt');
            expect(databaseService.user.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        password: 'hashed-password',
                    }),
                }),
            );
        });
    });

    describe('login', () => {
        it('should login a verified user successfully', async () => {
            const mockUser = createVerifiedMockUser();
            const bcrypt = require('bcrypt');

            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);

            const result = await service.login(mockLoginDto);

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result).toHaveProperty('user');
            expect(result.user).toBeDefined();
            expect(result.user?.email).toBe(mockUser.email);
        });

        it('should throw UnauthorizedException for invalid credentials', async () => {
            mockPrismaClient.user.findUnique.mockResolvedValue(null);

            await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for wrong password', async () => {
            const mockUser = createVerifiedMockUser();
            const bcrypt = require('bcrypt');

            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(false);

            await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should require verification for unverified users', async () => {
            const mockUser = createMockUser({ isEmailVerified: false });
            const bcrypt = require('bcrypt');

            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
            mockPrismaClient.user.update.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);

            const result = await service.login(mockLoginDto);

            expect(result).toHaveProperty('requiresVerification', true);
            expect(result).toHaveProperty('message');
            expect(emailService.sendOTP).toHaveBeenCalled();
        });
    });

    describe('verify', () => {
        it('should verify user with valid OTP', async () => {
            const mockUser = createMockUser();
            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
            mockPrismaClient.user.update.mockResolvedValue({
                ...mockUser,
                isEmailVerified: true,
            });

            const result = await service.verify(mockVerifyDto);

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result.message).toBe('Email verified successfully');
            expect(databaseService.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        isEmailVerified: true,
                        otpCode: null,
                        otpExpiry: null,
                    }),
                }),
            );
        });

        it('should throw UnauthorizedException for invalid OTP', async () => {
            const mockUser = createMockUser({ otpCode: 'different-code' });
            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.verify(mockVerifyDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw BadRequestException for expired OTP', async () => {
            const mockUser = createMockUser({
                otpExpiry: new Date(Date.now() - 1000), // Expired
            });
            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.verify(mockVerifyDto)).rejects.toThrow(BadRequestException);
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockPrismaClient.user.findUnique.mockResolvedValue(null);

            await expect(service.verify(mockVerifyDto)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            const mockUser = createVerifiedMockUser({ refreshToken: 'valid-refresh-token' });
            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
            mockPrismaClient.user.update.mockResolvedValue(mockUser);

            const result = await service.refreshToken('valid-refresh-token');

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(jwtService.verify).toHaveBeenCalled();
        });

        it('should throw UnauthorizedException for invalid token', async () => {
            jest.spyOn(jwtService, 'verify').mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await expect(service.refreshToken('invalid-token')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException if refresh token does not match', async () => {
            const mockUser = createVerifiedMockUser({ refreshToken: 'different-token' });
            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });

    describe('resendOTP', () => {
        it('should resend OTP successfully', async () => {
            const mockUser = createMockUser({ isEmailVerified: false });
            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
            mockPrismaClient.user.update.mockResolvedValue(mockUser);

            const result = await service.resendOTP(mockUser.email);

            expect(result.message).toBe('Verification code sent successfully');
            expect(emailService.sendOTP).toHaveBeenCalled();
            expect(databaseService.user.update).toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockPrismaClient.user.findUnique.mockResolvedValue(null);

            await expect(service.resendOTP('nonexistent@example.com')).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw BadRequestException if email already verified', async () => {
            const mockUser = createVerifiedMockUser();
            mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.resendOTP(mockUser.email)).rejects.toThrow(BadRequestException);
        });
    });
});
