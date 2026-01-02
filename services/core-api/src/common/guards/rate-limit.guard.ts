import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Rate limiting guard for upload endpoints
 * Limits users to 10 uploads per hour
 */
@Injectable()
export class UploadRateLimitGuard implements CanActivate {
    private readonly UPLOAD_LIMIT = 10;
    private readonly WINDOW_SECONDS = 3600; // 1 hour

    constructor(private redisService: RedisService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;

        // Allow if no user (unauthenticated requests are handled by auth guards)
        if (!userId) {
            return true;
        }

        const key = `upload:${userId}`;
        const allowed = await this.redisService.checkRateLimit(
            key,
            this.UPLOAD_LIMIT,
            this.WINDOW_SECONDS,
        );

        if (!allowed) {
            const { remaining, resetIn } = await this.redisService.getRateLimitRemaining(
                key,
                this.UPLOAD_LIMIT,
            );

            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Upload rate limit exceeded. Please try again later.',
                    remaining,
                    resetIn,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        return true;
    }
}
