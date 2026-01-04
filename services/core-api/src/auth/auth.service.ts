import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../common/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private databaseService: DatabaseService,
        private jwtService: JwtService,
        private emailService: EmailService,
    ) {}

    private generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    private async hashPassword(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    }

    private async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }

    private generateTokens(userId: string, email: string) {
        const payload = { sub: userId, email };

        const accessToken = this.jwtService.sign(payload);

        const refreshToken = this.jwtService.sign(payload, {
            secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
            expiresIn: '7d',
        });

        return { accessToken, refreshToken };
    }

    async register(registerDto: RegisterDto) {
        this.logger.log(`register() called for email: ${registerDto.email}`);

        try {
            const existingUser = await this.databaseService.user.findUnique({
                where: { email: registerDto.email },
            });

            if (existingUser) {
                this.logger.warn(`Registration failed: Email already registered - ${registerDto.email}`);
                throw new ConflictException('Email already registered');
            }

            const hashedPassword = await this.hashPassword(registerDto.password);

            const otp = this.generateOTP();
            const otpExpiry = new Date();
            otpExpiry.setMinutes(
                otpExpiry.getMinutes() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
            );

            this.logger.log(`Creating user record for: ${registerDto.email}`);
            const user = await this.databaseService.user.create({
                data: {
                    email: registerDto.email,
                    password: hashedPassword,
                    firstName: registerDto.firstName,
                    lastName: registerDto.lastName,
                    dateOfBirth: registerDto.dateOfBirth ? new Date(registerDto.dateOfBirth) : null,
                    otpCode: otp,
                    otpExpiry,
                    isEmailVerified: false,
                },
            });

            this.logger.log(`User created with ID: ${user.id}`);

            try {
                await this.emailService.sendOTP(user.email, otp);
                this.logger.log(`OTP sent successfully to: ${user.email}`);
            } catch (emailError) {
                // User is created but email failed - that's okay in development
                // The OTP is stored in the database and will be logged in development mode
                this.logger.error(`Failed to send OTP email: ${emailError.message}`);
                this.logger.error(`Stack: ${emailError.stack}`);
                throw new BadRequestException(
                    'Account created successfully, but we encountered an issue sending the verification email. ' +
                        'Please contact support or check your server logs for the verification code.',
                );
            }

            this.logger.log(`Registration completed successfully for: ${user.email}`);
            return {
                message: 'Registration successful. Please check your email for the verification code.',
                email: user.email,
            };
        } catch (error) {
            if (error instanceof ConflictException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error in register(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    async login(loginDto: LoginDto) {
        this.logger.log(`login() called for email: ${loginDto.email}`);

        try {
            const user = await this.databaseService.user.findUnique({
                where: { email: loginDto.email },
            });

            if (!user) {
                this.logger.warn(`Login failed: User not found - ${loginDto.email}`);
                throw new UnauthorizedException('Invalid credentials');
            }

            const isPasswordValid = await this.comparePasswords(loginDto.password, user.password);

            if (!isPasswordValid) {
                this.logger.warn(`Login failed: Invalid password for - ${loginDto.email}`);
                throw new UnauthorizedException('Invalid credentials');
            }

            if (!user.isEmailVerified) {
                this.logger.log(`User ${loginDto.email} not verified, sending OTP`);
                const otp = this.generateOTP();
                const otpExpiry = new Date();
                otpExpiry.setMinutes(
                    otpExpiry.getMinutes() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
                );

                await this.databaseService.user.update({
                    where: { id: user.id },
                    data: {
                        otpCode: otp,
                        otpExpiry,
                    },
                });

                await this.emailService.sendOTP(user.email, otp);

                return {
                    requiresVerification: true,
                    message: 'Please verify your email. A new verification code has been sent.',
                    email: user.email,
                };
            }

            const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);

            await this.databaseService.user.update({
                where: { id: user.id },
                data: { refreshToken },
            });

            this.logger.log(`Login successful for user: ${user.id}`);

            return {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                },
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            this.logger.error(`Error in login(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    async verify(verifyDto: VerifyDto) {
        this.logger.log(`verify() called for email: ${verifyDto.email}`);

        try {
            const user = await this.databaseService.user.findUnique({
                where: { email: verifyDto.email },
            });

            if (!user) {
                this.logger.warn(`Verification failed: User not found - ${verifyDto.email}`);
                throw new UnauthorizedException('User not found');
            }

            if (!user.otpCode || !user.otpExpiry) {
                this.logger.warn(`Verification failed: No OTP found for - ${verifyDto.email}`);
                throw new BadRequestException('No verification code found. Please request a new one.');
            }

            if (new Date() > user.otpExpiry) {
                this.logger.warn(`Verification failed: OTP expired for - ${verifyDto.email}`);
                throw new BadRequestException(
                    'Verification code has expired. Please request a new one.',
                );
            }

            if (user.otpCode !== verifyDto.code) {
                this.logger.warn(`Verification failed: Invalid OTP for - ${verifyDto.email}`);
                throw new UnauthorizedException('Invalid verification code');
            }

            const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);

            await this.databaseService.user.update({
                where: { id: user.id },
                data: {
                    isEmailVerified: true,
                    otpCode: null,
                    otpExpiry: null,
                    refreshToken,
                },
            });

            this.logger.log(`Email verified successfully for user: ${user.id}`);

            return {
                message: 'Email verified successfully',
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                },
            };
        } catch (error) {
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error in verify(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    async refreshToken(refreshToken: string) {
        this.logger.log(`refreshToken() called`);

        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
            });

            const user = await this.databaseService.user.findUnique({
                where: { id: payload.sub },
            });

            if (!user || user.refreshToken !== refreshToken) {
                this.logger.warn(`Refresh token invalid for user: ${payload.sub}`);
                throw new UnauthorizedException('Invalid refresh token');
            }

            const tokens = this.generateTokens(user.id, user.email);

            await this.databaseService.user.update({
                where: { id: user.id },
                data: { refreshToken: tokens.refreshToken },
            });

            this.logger.log(`Token refreshed successfully for user: ${user.id}`);
            return tokens;
        } catch (error) {
            this.logger.error(`Error in refreshToken(): ${error.message}`);
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async resendOTP(email: string) {
        this.logger.log(`resendOTP() called for email: ${email}`);

        try {
            const user = await this.databaseService.user.findUnique({
                where: { email },
            });

            if (!user) {
                this.logger.warn(`Resend OTP failed: User not found - ${email}`);
                throw new UnauthorizedException('User not found');
            }

            if (user.isEmailVerified) {
                this.logger.warn(`Resend OTP failed: Email already verified - ${email}`);
                throw new BadRequestException('Email already verified');
            }

            const otp = this.generateOTP();
            const otpExpiry = new Date();
            otpExpiry.setMinutes(
                otpExpiry.getMinutes() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
            );

            await this.databaseService.user.update({
                where: { id: user.id },
                data: {
                    otpCode: otp,
                    otpExpiry,
                },
            });

            await this.emailService.sendOTP(user.email, otp);

            this.logger.log(`OTP resent successfully to: ${email}`);
            return {
                message: 'Verification code sent successfully',
            };
        } catch (error) {
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error in resendOTP(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }
}
