import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Rate limiting guard for authentication endpoints.
 * Limits login/verify/resend-otp by email to prevent brute force attacks.
 * - Login: 5 attempts per 15 minutes per email
 * - OTP verify: 5 attempts per 10 minutes per email
 * - Resend OTP: 3 attempts per 15 minutes per email
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
    private readonly logger = new Logger(AuthRateLimitGuard.name);

    private readonly LIMITS: Record<string, { max: number; windowSeconds: number }> = {
        login: { max: 5, windowSeconds: 900 },       // 5 per 15 min
        verify: { max: 5, windowSeconds: 600 },       // 5 per 10 min
        'resend-otp': { max: 3, windowSeconds: 900 }, // 3 per 15 min
        register: { max: 3, windowSeconds: 900 },     // 3 per 15 min
    };

    constructor(private redisService: RedisService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const email = request.body?.email;
        const path = request.route?.path || request.url;

        // Extract the auth action from the path
        const action = this.extractAction(path);
        const config = this.LIMITS[action];

        if (!config || !email) {
            return true; // No rate limiting for unknown actions or missing email
        }

        const key = `auth:${action}:${email.toLowerCase()}`;
        const allowed = await this.redisService.checkRateLimit(
            key,
            config.max,
            config.windowSeconds,
        );

        if (!allowed) {
            this.logger.warn(`Auth rate limit exceeded for ${action}: ${email}`);

            const { remaining, resetIn } = await this.redisService.getRateLimitRemaining(
                key,
                config.max,
            );

            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Too many attempts. Please try again later.',
                    remaining,
                    resetIn,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        return true;
    }

    private extractAction(path: string): string {
        if (path.includes('login')) return 'login';
        if (path.includes('verify')) return 'verify';
        if (path.includes('resend-otp')) return 'resend-otp';
        if (path.includes('register')) return 'register';
        return '';
    }
}
