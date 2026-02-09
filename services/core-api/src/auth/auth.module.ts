import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard';

@Module({
    imports: [
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: {
                expiresIn: (process.env.JWT_EXPIRES_IN || '30m') as any,
            },
        }),
        NotificationsModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, AuthRateLimitGuard],
    exports: [AuthService],
})
export class AuthModule {}
