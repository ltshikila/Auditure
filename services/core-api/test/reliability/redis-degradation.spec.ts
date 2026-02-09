/**
 * Redis Degradation Tests
 *
 * Verifies that RedisService gracefully degrades when Redis is disconnected.
 * All methods should return safe defaults (null, empty objects, void) instead of throwing.
 *
 * We instantiate the service directly WITHOUT calling onModuleInit(), so the
 * internal `client` remains undefined and `isConnected()` returns false.
 */
import { RedisService } from '../../src/redis/redis.service';

describe('RedisService - Degraded Mode (Redis Disconnected)', () => {
    let service: RedisService;

    beforeEach(() => {
        // Create instance without calling onModuleInit() so client is undefined.
        // isConnected() checks `this.client?.status === 'ready'` which will be false.
        service = new RedisService();
    });

    // ============================================
    // Job Progress Tracking
    // ============================================

    describe('Job Progress', () => {
        it('setJobProgress should not throw when Redis is disconnected', async () => {
            await expect(
                service.setJobProgress('job-123', 50, 'processing'),
            ).resolves.toBeUndefined();
        });

        it('getJobProgress should return null when Redis is disconnected', async () => {
            const result = await service.getJobProgress('job-123');
            expect(result).toBeNull();
        });

        it('deleteJobProgress should not throw when Redis is disconnected', async () => {
            await expect(
                service.deleteJobProgress('job-123'),
            ).resolves.toBeUndefined();
        });
    });

    // ============================================
    // Playback Progress
    // ============================================

    describe('Playback Progress', () => {
        it('setPlaybackProgress should not throw when Redis is disconnected', async () => {
            await expect(
                service.setPlaybackProgress('user-1', 'episode-1', 12345),
            ).resolves.toBeUndefined();
        });

        it('getPlaybackProgress should return null when Redis is disconnected', async () => {
            const result = await service.getPlaybackProgress('user-1', 'episode-1');
            expect(result).toBeNull();
        });

        it('getAllPlaybackProgress should return empty object when Redis is disconnected', async () => {
            const result = await service.getAllPlaybackProgress('user-1');
            expect(result).toEqual({});
        });

        it('deletePlaybackProgress should not throw when Redis is disconnected', async () => {
            await expect(
                service.deletePlaybackProgress('user-1', 'episode-1'),
            ).resolves.toBeUndefined();
        });
    });

    // ============================================
    // Rate Limiting
    // ============================================

    describe('Rate Limiting', () => {
        it('checkRateLimit should return true (allow) when Redis is disconnected', async () => {
            const result = await service.checkRateLimit('upload:user-1', 10, 3600);
            expect(result).toBe(true);
        });

        it('getRateLimitRemaining should return full remaining and resetIn 0 when Redis is disconnected', async () => {
            const limit = 10;
            const result = await service.getRateLimitRemaining('upload:user-1', limit);
            expect(result).toEqual({ remaining: limit, resetIn: 0 });
        });

        it('getRateLimitRemaining should reflect the limit parameter', async () => {
            const result25 = await service.getRateLimitRemaining('key', 25);
            expect(result25).toEqual({ remaining: 25, resetIn: 0 });

            const result100 = await service.getRateLimitRemaining('key', 100);
            expect(result100).toEqual({ remaining: 100, resetIn: 0 });
        });
    });

    // ============================================
    // Redis Streams (Notification Queue)
    // ============================================

    describe('Notification Stream', () => {
        it('addNotificationToStream should return null when Redis is disconnected', async () => {
            const result = await service.addNotificationToStream({
                notificationId: 'notif-1',
                userId: 'user-1',
                type: 'SYSTEM',
                title: 'Test',
                body: 'Test body',
            });
            expect(result).toBeNull();
        });

        it('readNotificationsFromStream should return empty array when Redis is disconnected', async () => {
            const result = await service.readNotificationsFromStream('consumer-1', 10, 5000);
            expect(result).toEqual([]);
        });

        it('readNotificationsFromStream should return empty array with default parameters', async () => {
            const result = await service.readNotificationsFromStream('consumer-1');
            expect(result).toEqual([]);
        });
    });

    // ============================================
    // Additional stream methods
    // ============================================

    describe('Additional Stream Operations', () => {
        it('initNotificationStream should not throw when Redis is disconnected', async () => {
            await expect(service.initNotificationStream()).resolves.toBeUndefined();
        });

        it('ackNotification should return false when Redis is disconnected', async () => {
            const result = await service.ackNotification('msg-123');
            expect(result).toBe(false);
        });

        it('getPendingNotifications should return empty array when Redis is disconnected', async () => {
            const result = await service.getPendingNotifications();
            expect(result).toEqual([]);
        });

        it('claimNotifications should return 0 when Redis is disconnected', async () => {
            const result = await service.claimNotifications('consumer-1', 60000, ['msg-1', 'msg-2']);
            expect(result).toBe(0);
        });

        it('trimNotificationStream should return 0 when Redis is disconnected', async () => {
            const result = await service.trimNotificationStream();
            expect(result).toBe(0);
        });
    });

    // ============================================
    // Verify the service itself is defined
    // ============================================

    it('should be instantiated without errors', () => {
        expect(service).toBeDefined();
    });
});
