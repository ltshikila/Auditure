import {
    Injectable,
    OnModuleInit,
    OnModuleDestroy,
    Logger,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;
    private readonly logger = new Logger(RedisService.name);

    async onModuleInit() {
        this.client = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        });

        this.client.on('error', (err) => {
            this.logger.error('Redis connection error:', err.message);
        });

        this.client.on('connect', () => {
            this.logger.log('Redis connected');
        });

        try {
            await this.client.connect();
        } catch (error) {
            this.logger.warn(
                'Redis connection failed, caching will be disabled:',
                error.message,
            );
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
        }
    }

    private isConnected(): boolean {
        return this.client?.status === 'ready';
    }

    // ============================================
    // Job Progress Tracking (Episode Generation)
    // ============================================

    async setJobProgress(
        jobId: string,
        progress: number,
        status: string,
    ): Promise<void> {
        if (!this.isConnected()) return;

        try {
            await this.client.hset(`job:${jobId}`, {
                progress: progress.toString(),
                status,
                updatedAt: new Date().toISOString(),
            });
            await this.client.expire(`job:${jobId}`, 86400); // 24 hours TTL
        } catch (error) {
            this.logger.error(`Error setting job progress: ${error.message}`);
        }
    }

    async getJobProgress(
        jobId: string,
    ): Promise<{ progress: number; status: string; updatedAt: string } | null> {
        if (!this.isConnected()) return null;

        try {
            const data = await this.client.hgetall(`job:${jobId}`);
            if (!data || !data.progress) return null;

            return {
                progress: parseInt(data.progress),
                status: data.status,
                updatedAt: data.updatedAt,
            };
        } catch (error) {
            this.logger.error(`Error getting job progress: ${error.message}`);
            return null;
        }
    }

    async deleteJobProgress(jobId: string): Promise<void> {
        if (!this.isConnected()) return;

        try {
            await this.client.del(`job:${jobId}`);
        } catch (error) {
            this.logger.error(`Error deleting job progress: ${error.message}`);
        }
    }

    // ============================================
    // Playback Progress (Resume Position)
    // ============================================

    async setPlaybackProgress(
        userId: string,
        episodeId: string,
        positionMs: number,
    ): Promise<void> {
        if (!this.isConnected()) return;

        try {
            const key = `playback:${userId}`;
            await this.client.hset(key, episodeId, positionMs.toString());
            // Keep playback progress for 30 days
            await this.client.expire(key, 30 * 24 * 60 * 60);
        } catch (error) {
            this.logger.error(
                `Error setting playback progress: ${error.message}`,
            );
        }
    }

    async getPlaybackProgress(
        userId: string,
        episodeId: string,
    ): Promise<number | null> {
        if (!this.isConnected()) return null;

        try {
            const position = await this.client.hget(
                `playback:${userId}`,
                episodeId,
            );
            return position ? parseInt(position) : null;
        } catch (error) {
            this.logger.error(
                `Error getting playback progress: ${error.message}`,
            );
            return null;
        }
    }

    async getAllPlaybackProgress(
        userId: string,
    ): Promise<Record<string, number>> {
        if (!this.isConnected()) return {};

        try {
            const data = await this.client.hgetall(`playback:${userId}`);
            const result: Record<string, number> = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = parseInt(value);
            }
            return result;
        } catch (error) {
            this.logger.error(
                `Error getting all playback progress: ${error.message}`,
            );
            return {};
        }
    }

    async deletePlaybackProgress(
        userId: string,
        episodeId: string,
    ): Promise<void> {
        if (!this.isConnected()) return;

        try {
            await this.client.hdel(`playback:${userId}`, episodeId);
        } catch (error) {
            this.logger.error(
                `Error deleting playback progress: ${error.message}`,
            );
        }
    }

    // ============================================
    // Rate Limiting
    // ============================================

    /**
     * Check and increment rate limit counter
     * @param key - Unique key for rate limiting (e.g., "upload:userId")
     * @param limit - Maximum allowed requests
     * @param windowSeconds - Time window in seconds
     * @returns true if within limit, false if exceeded
     */
    async checkRateLimit(
        key: string,
        limit: number,
        windowSeconds: number,
    ): Promise<boolean> {
        if (!this.isConnected()) return true; // Allow if Redis is down

        try {
            const rateLimitKey = `ratelimit:${key}`;
            const current = await this.client.incr(rateLimitKey);

            if (current === 1) {
                await this.client.expire(rateLimitKey, windowSeconds);
            }

            return current <= limit;
        } catch (error) {
            this.logger.error(`Error checking rate limit: ${error.message}`);
            return true; // Allow on error
        }
    }

    async getRateLimitRemaining(
        key: string,
        limit: number,
    ): Promise<{ remaining: number; resetIn: number }> {
        if (!this.isConnected()) return { remaining: limit, resetIn: 0 };

        try {
            const rateLimitKey = `ratelimit:${key}`;
            const [current, ttl] = await Promise.all([
                this.client.get(rateLimitKey),
                this.client.ttl(rateLimitKey),
            ]);

            const used = current ? parseInt(current) : 0;
            return {
                remaining: Math.max(0, limit - used),
                resetIn: Math.max(0, ttl),
            };
        } catch (error) {
            this.logger.error(
                `Error getting rate limit remaining: ${error.message}`,
            );
            return { remaining: limit, resetIn: 0 };
        }
    }
}
