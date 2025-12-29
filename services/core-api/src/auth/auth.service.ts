import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
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
        const existingUser = await this.databaseService.user.findUnique({
            where: { email: registerDto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        const hashedPassword = await this.hashPassword(registerDto.password);

        const otp = this.generateOTP();
        const otpExpiry = new Date();
        otpExpiry.setMinutes(
            otpExpiry.getMinutes() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
        );

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

        await this.emailService.sendOTP(user.email, otp);

        return {
            message: 'Registration successful. Please check your email for the verification code.',
            email: user.email,
        };
    }

    async login(loginDto: LoginDto) {
        const user = await this.databaseService.user.findUnique({
            where: { email: loginDto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await this.comparePasswords(loginDto.password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isEmailVerified) {
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
    }

    async verify(verifyDto: VerifyDto) {
        const user = await this.databaseService.user.findUnique({
            where: { email: verifyDto.email },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (!user.otpCode || !user.otpExpiry) {
            throw new BadRequestException('No verification code found. Please request a new one.');
        }

        if (new Date() > user.otpExpiry) {
            throw new BadRequestException(
                'Verification code has expired. Please request a new one.',
            );
        }

        if (user.otpCode !== verifyDto.code) {
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
    }

    async refreshToken(refreshToken: string) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
            });

            const user = await this.databaseService.user.findUnique({
                where: { id: payload.sub },
            });

            if (!user || user.refreshToken !== refreshToken) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            const tokens = this.generateTokens(user.id, user.email);

            await this.databaseService.user.update({
                where: { id: user.id },
                data: { refreshToken: tokens.refreshToken },
            });

            return tokens;
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async resendOTP(email: string) {
        const user = await this.databaseService.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.isEmailVerified) {
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

        return {
            message: 'Verification code sent successfully',
        };
    }
}
