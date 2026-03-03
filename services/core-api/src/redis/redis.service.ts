import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
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
            connectTimeout: 10_000, // 10s connection timeout
            lazyConnect: true,
            retryStrategy: times => {
                if (times > 3) {
                    this.logger.warn('Redis max connection retries reached, giving up');
                    return null; // Stop retrying
                }
                return Math.min(times * 200, 2000);
            },
        });

        this.client.on('error', err => {
            this.logger.error('Redis connection error:', err.message);
        });

        this.client.on('connect', () => {
            this.logger.log('Redis connected');
        });

        try {
            await this.client.connect();
        } catch (error) {
            this.logger.warn('Redis connection failed, caching will be disabled:', error.message);
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
        }
    }

    isConnected(): boolean {
        return this.client?.status === 'ready';
    }

    async ping(): Promise<boolean> {
        if (!this.isConnected()) return false;
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        } catch {
            return false;
        }
    }

    // ============================================
    // Job Progress Tracking (Episode Generation)
    // ============================================

    async setJobProgress(jobId: string, progress: number, status: string): Promise<void> {
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
            const tsKey = `playback_ts:${userId}`;
            const ttl = 30 * 24 * 60 * 60; // 30 days

            await Promise.all([
                this.client.hset(key, episodeId, positionMs.toString()),
                this.client.hset(tsKey, episodeId, Date.now().toString()),
                this.client.expire(key, ttl),
                this.client.expire(tsKey, ttl),
            ]);
        } catch (error) {
            this.logger.error(`Error setting playback progress: ${error.message}`);
        }
    }

    async getPlaybackProgress(userId: string, episodeId: string): Promise<number | null> {
        if (!this.isConnected()) return null;

        try {
            const position = await this.client.hget(`playback:${userId}`, episodeId);
            return position ? parseInt(position) : null;
        } catch (error) {
            this.logger.error(`Error getting playback progress: ${error.message}`);
            return null;
        }
    }

    async getAllPlaybackProgress(userId: string): Promise<Record<string, number>> {
        if (!this.isConnected()) return {};

        try {
            const data = await this.client.hgetall(`playback:${userId}`);
            const result: Record<string, number> = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = parseInt(value);
            }
            return result;
        } catch (error) {
            this.logger.error(`Error getting all playback progress: ${error.message}`);
            return {};
        }
    }

    async getAllPlaybackTimestamps(userId: string): Promise<Record<string, number>> {
        if (!this.isConnected()) return {};

        try {
            const data = await this.client.hgetall(`playback_ts:${userId}`);
            const result: Record<string, number> = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = parseInt(value);
            }
            return result;
        } catch (error) {
            this.logger.error(`Error getting playback timestamps: ${error.message}`);
            return {};
        }
    }

    async deletePlaybackProgress(userId: string, episodeId: string): Promise<void> {
        if (!this.isConnected()) return;

        try {
            await Promise.all([
                this.client.hdel(`playback:${userId}`, episodeId),
                this.client.hdel(`playback_ts:${userId}`, episodeId),
            ]);
        } catch (error) {
            this.logger.error(`Error deleting playback progress: ${error.message}`);
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
    async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
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
            this.logger.error(`Error getting rate limit remaining: ${error.message}`);
            return { remaining: limit, resetIn: 0 };
        }
    }

    // ============================================
    // Redis Streams (Notification Queue)
    // ============================================

    private readonly NOTIFICATION_STREAM = 'notifications:stream';
    private readonly NOTIFICATION_CONSUMER_GROUP = 'notifications:consumers';

    /**
     * Initialize the notification stream consumer group.
     * Should be called on application startup.
     */
    async initNotificationStream(): Promise<void> {
        if (!this.isConnected()) {
            this.logger.warn('Redis not connected, skipping stream initialization');
            return;
        }

        try {
            // Create consumer group if it doesn't exist
            // MKSTREAM creates the stream if it doesn't exist
            await this.client.xgroup(
                'CREATE',
                this.NOTIFICATION_STREAM,
                this.NOTIFICATION_CONSUMER_GROUP,
                '0',
                'MKSTREAM',
            );
            this.logger.log(
                `Created notification stream consumer group: ${this.NOTIFICATION_CONSUMER_GROUP}`,
            );
        } catch (error) {
            // BUSYGROUP error means the group already exists, which is fine
            if (error.message?.includes('BUSYGROUP')) {
                this.logger.log(
                    `Notification stream consumer group already exists: ${this.NOTIFICATION_CONSUMER_GROUP}`,
                );
            } else {
                this.logger.error(
                    `Error creating notification stream consumer group: ${error.message}`,
                );
                throw error;
            }
        }
    }

    /**
     * Add a notification to the stream for async processing.
     * @param notification - The notification data to add
     * @returns The stream message ID
     */
    async addNotificationToStream(notification: {
        notificationId: string;
        userId: string;
        type: string;
        title: string;
        body: string;
        data?: string;
    }): Promise<string | null> {
        if (!this.isConnected()) {
            this.logger.warn('Redis not connected, cannot add notification to stream');
            return null;
        }

        try {
            const messageId = await this.client.xadd(
                this.NOTIFICATION_STREAM,
                '*', // Auto-generate message ID
                'notificationId',
                notification.notificationId,
                'userId',
                notification.userId,
                'type',
                notification.type,
                'title',
                notification.title,
                'body',
                notification.body,
                'data',
                notification.data || '',
                'createdAt',
                new Date().toISOString(),
            );
            this.logger.log(
                `Added notification ${notification.notificationId} to stream with ID: ${messageId}`,
            );
            return messageId;
        } catch (error) {
            this.logger.error(`Error adding notification to stream: ${error.message}`);
            return null;
        }
    }

    /**
     * Read pending notifications from the stream.
     * Uses consumer groups for reliable processing.
     * @param consumerName - Unique name for this consumer instance
     * @param count - Maximum number of messages to read
     * @param blockMs - How long to block waiting for messages (0 = no blocking)
     * @returns Array of notification messages
     */
    async readNotificationsFromStream(
        consumerName: string,
        count: number = 10,
        blockMs: number = 5000,
    ): Promise<
        Array<{
            id: string;
            notificationId: string;
            userId: string;
            type: string;
            title: string;
            body: string;
            data?: string;
            createdAt: string;
        }>
    > {
        if (!this.isConnected()) return [];

        try {
            const results = await this.client.xreadgroup(
                'GROUP',
                this.NOTIFICATION_CONSUMER_GROUP,
                consumerName,
                'COUNT',
                count,
                'BLOCK',
                blockMs,
                'STREAMS',
                this.NOTIFICATION_STREAM,
                '>', // Read only new messages
            );

            if (!results || results.length === 0) {
                return [];
            }

            const messages: Array<{
                id: string;
                notificationId: string;
                userId: string;
                type: string;
                title: string;
                body: string;
                data?: string;
                createdAt: string;
            }> = [];

            // Parse the stream results
            // Format: [[streamName, [[messageId, [field, value, field, value, ...]], ...]]]
            const streamResults = results as Array<[string, Array<[string, string[]]>]>;
            for (const [, streamMessages] of streamResults) {
                for (const [messageId, fields] of streamMessages) {
                    const message: any = { id: messageId };
                    for (let i = 0; i < fields.length; i += 2) {
                        message[fields[i]] = fields[i + 1];
                    }
                    messages.push(message);
                }
            }

            return messages;
        } catch (error) {
            this.logger.error(`Error reading from notification stream: ${error.message}`);
            return [];
        }
    }

    /**
     * Acknowledge that a notification has been processed.
     * @param messageId - The stream message ID to acknowledge
     */
    async ackNotification(messageId: string): Promise<boolean> {
        if (!this.isConnected()) return false;

        try {
            const result = await this.client.xack(
                this.NOTIFICATION_STREAM,
                this.NOTIFICATION_CONSUMER_GROUP,
                messageId,
            );
            return result === 1;
        } catch (error) {
            this.logger.error(`Error acknowledging notification ${messageId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get pending notifications that haven't been acknowledged.
     * Useful for handling failed/stuck notifications.
     * @param count - Maximum number of pending messages to return
     */
    async getPendingNotifications(count: number = 100): Promise<
        Array<{
            id: string;
            consumer: string;
            idleTime: number;
            deliveryCount: number;
        }>
    > {
        if (!this.isConnected()) return [];

        try {
            const pending = await this.client.xpending(
                this.NOTIFICATION_STREAM,
                this.NOTIFICATION_CONSUMER_GROUP,
                '-',
                '+',
                count,
            );

            if (!pending || pending.length === 0) {
                return [];
            }

            return pending.map((item: any) => ({
                id: item[0],
                consumer: item[1],
                idleTime: item[2],
                deliveryCount: item[3],
            }));
        } catch (error) {
            this.logger.error(`Error getting pending notifications: ${error.message}`);
            return [];
        }
    }

    /**
     * Claim stale pending notifications for reprocessing.
     * @param consumerName - The consumer claiming the messages
     * @param minIdleTimeMs - Minimum idle time before a message can be claimed
     * @param messageIds - Message IDs to claim
     */
    async claimNotifications(
        consumerName: string,
        minIdleTimeMs: number,
        messageIds: string[],
    ): Promise<number> {
        if (!this.isConnected() || messageIds.length === 0) return 0;

        try {
            const result = await this.client.xclaim(
                this.NOTIFICATION_STREAM,
                this.NOTIFICATION_CONSUMER_GROUP,
                consumerName,
                minIdleTimeMs,
                ...messageIds,
            );
            return result?.length || 0;
        } catch (error) {
            this.logger.error(`Error claiming notifications: ${error.message}`);
            return 0;
        }
    }

    /**
     * Trim old messages from the stream to prevent unbounded growth.
     * @param maxLength - Maximum number of messages to keep
     */
    async trimNotificationStream(maxLength: number = 10000): Promise<number> {
        if (!this.isConnected()) return 0;

        try {
            const trimmed = await this.client.xtrim(
                this.NOTIFICATION_STREAM,
                'MAXLEN',
                '~', // Approximate trimming for better performance
                maxLength,
            );
            if (trimmed > 0) {
                this.logger.log(`Trimmed ${trimmed} old notifications from stream`);
            }
            return trimmed;
        } catch (error) {
            this.logger.error(`Error trimming notification stream: ${error.message}`);
            return 0;
        }
    }
}
