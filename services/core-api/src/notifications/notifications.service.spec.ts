import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ExpoPushService } from './expo-push.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { NotificationType } from './interfaces/notification-payload.interface';
import {
    createMockNotification,
    createUnreadMockNotification,
    createReadMockNotification,
    createMockNotificationList,
    createMockUserSettingsWithPushToken,
    createMockUserSettingsWithoutPushToken,
    createMockUserSettingsWithPushDisabled,
    VALID_EXPO_PUSH_TOKEN,
    mockExpoPushSuccessTicket,
    mockExpoPushDeviceNotRegisteredTicket,
} from '../../test/fixtures/notifications.fixture';
import { mockPrismaClient } from '../../test/mocks/database.mock';
import { mockExpoPushService, mockRedisServiceWithStreams } from '../../test/mocks/services.mock';

describe('NotificationsService', () => {
    let service: NotificationsService;
    let databaseService: DatabaseService;
    let redisService: RedisService;
    let expoPushService: ExpoPushService;

    const mockUserId = 'user-123';
    const mockNotificationId = 'notification-123';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationsService,
                {
                    provide: DatabaseService,
                    useValue: mockPrismaClient,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisServiceWithStreams,
                },
                {
                    provide: ExpoPushService,
                    useValue: mockExpoPushService,
                },
            ],
        }).compile();

        service = module.get<NotificationsService>(NotificationsService);
        databaseService = module.get<DatabaseService>(DatabaseService);
        redisService = module.get<RedisService>(RedisService);
        expoPushService = module.get<ExpoPushService>(ExpoPushService);

        // Clear all mocks before each test
        jest.clearAllMocks();

        // Skip the consumer loop in tests
        (service as any).isConsumerRunning = false;
    });

    afterEach(() => {
        // Ensure consumer is stopped
        (service as any).isConsumerRunning = false;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ============================================
    // CREATE TESTS
    // ============================================

    describe('create', () => {
        it('should create a notification successfully', async () => {
            const mockNotification = createMockNotification({ userId: mockUserId });
            mockPrismaClient.user.findUnique.mockResolvedValue({ id: mockUserId });
            mockPrismaClient.notification.create.mockResolvedValue(mockNotification);

            const result = await service.create({
                userId: mockUserId,
                type: NotificationType.EPISODE_READY,
                title: 'Test',
                body: 'Test body',
            });

            expect(result).toBeDefined();
            expect(result.userId).toBe(mockUserId);
            expect(mockPrismaClient.notification.create).toHaveBeenCalled();
            expect(mockRedisServiceWithStreams.addNotificationToStream).toHaveBeenCalled();
        });

        it('should throw NotFoundException when user does not exist', async () => {
            mockPrismaClient.user.findUnique.mockResolvedValue(null);

            await expect(
                service.create({
                    userId: 'non-existent-user',
                    type: NotificationType.SYSTEM,
                    title: 'Test',
                    body: 'Test body',
                }),
            ).rejects.toThrow(NotFoundException);

            expect(mockPrismaClient.notification.create).not.toHaveBeenCalled();
        });

        it('should include data payload when provided', async () => {
            const mockNotification = createMockNotification({
                userId: mockUserId,
                data: { episodeId: 'episode-123' },
            });
            mockPrismaClient.user.findUnique.mockResolvedValue({ id: mockUserId });
            mockPrismaClient.notification.create.mockResolvedValue(mockNotification);

            const result = await service.create({
                userId: mockUserId,
                type: NotificationType.EPISODE_READY,
                title: 'Test',
                body: 'Test body',
                data: { episodeId: 'episode-123' },
            });

            expect(result.data).toEqual({ episodeId: 'episode-123' });
        });
    });

    describe('createBatch', () => {
        it('should create multiple notifications', async () => {
            const mockNotification1 = createMockNotification({ userId: 'user-1' });
            const mockNotification2 = createMockNotification({ userId: 'user-2' });

            mockPrismaClient.user.findUnique
                .mockResolvedValueOnce({ id: 'user-1' })
                .mockResolvedValueOnce({ id: 'user-2' });
            mockPrismaClient.notification.create
                .mockResolvedValueOnce(mockNotification1)
                .mockResolvedValueOnce(mockNotification2);

            const result = await service.createBatch([
                {
                    userId: 'user-1',
                    type: NotificationType.SYSTEM,
                    title: 'Test 1',
                    body: 'Body 1',
                },
                {
                    userId: 'user-2',
                    type: NotificationType.SYSTEM,
                    title: 'Test 2',
                    body: 'Body 2',
                },
            ]);

            expect(result).toHaveLength(2);
            expect(mockPrismaClient.notification.create).toHaveBeenCalledTimes(2);
        });

        it('should return empty array for empty input', async () => {
            const result = await service.createBatch([]);
            expect(result).toHaveLength(0);
        });

        it('should continue creating notifications even if one fails', async () => {
            const mockNotification = createMockNotification({ userId: 'user-2' });

            mockPrismaClient.user.findUnique
                .mockResolvedValueOnce(null) // First user doesn't exist
                .mockResolvedValueOnce({ id: 'user-2' }); // Second user exists
            mockPrismaClient.notification.create.mockResolvedValue(mockNotification);

            const result = await service.createBatch([
                {
                    userId: 'user-1',
                    type: NotificationType.SYSTEM,
                    title: 'Test 1',
                    body: 'Body 1',
                },
                {
                    userId: 'user-2',
                    type: NotificationType.SYSTEM,
                    title: 'Test 2',
                    body: 'Body 2',
                },
            ]);

            expect(result).toHaveLength(1);
            expect(result[0].userId).toBe('user-2');
        });
    });

    // ============================================
    // FIND TESTS
    // ============================================

    describe('findAll', () => {
        it('should return paginated notifications', async () => {
            const notifications = createMockNotificationList(5, mockUserId);

            mockPrismaClient.notification.count
                .mockResolvedValueOnce(5) // total
                .mockResolvedValueOnce(2); // unread
            mockPrismaClient.notification.findMany.mockResolvedValue(notifications);

            const result = await service.findAll(mockUserId, { page: 1, limit: 10 });

            expect(result.notifications).toHaveLength(5);
            expect(result.total).toBe(5);
            expect(result.unreadCount).toBe(2);
            expect(result.page).toBe(1);
        });

        it('should filter by unread only', async () => {
            const unreadNotifications = [createUnreadMockNotification({ userId: mockUserId })];

            mockPrismaClient.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
            mockPrismaClient.notification.findMany.mockResolvedValue(unreadNotifications);

            const result = await service.findAll(mockUserId, { unreadOnly: true });

            expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ read: false }),
                }),
            );
        });

        it('should filter by notification type', async () => {
            mockPrismaClient.notification.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
            mockPrismaClient.notification.findMany.mockResolvedValue([]);

            await service.findAll(mockUserId, { type: NotificationType.EPISODE_READY });

            expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ type: NotificationType.EPISODE_READY }),
                }),
            );
        });

        it('should use default pagination values', async () => {
            mockPrismaClient.notification.count.mockResolvedValue(0);
            mockPrismaClient.notification.findMany.mockResolvedValue([]);

            await service.findAll(mockUserId, {});

            expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0,
                    take: 20,
                }),
            );
        });
    });

    describe('findOne', () => {
        it('should return notification for owner', async () => {
            const mockNotification = createMockNotification({ userId: mockUserId });
            mockPrismaClient.notification.findUnique.mockResolvedValue(mockNotification);

            const result = await service.findOne(mockNotification.id, mockUserId);

            expect(result).toBeDefined();
            expect(result.id).toBe(mockNotification.id);
        });

        it('should throw NotFoundException if notification does not exist', async () => {
            mockPrismaClient.notification.findUnique.mockResolvedValue(null);

            await expect(service.findOne('non-existent-id', mockUserId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ForbiddenException if user is not the owner', async () => {
            const mockNotification = createMockNotification({ userId: 'other-user' });
            mockPrismaClient.notification.findUnique.mockResolvedValue(mockNotification);

            await expect(service.findOne(mockNotification.id, mockUserId)).rejects.toThrow(
                ForbiddenException,
            );
        });
    });

    describe('getUnreadCount', () => {
        it('should return correct unread count', async () => {
            mockPrismaClient.notification.count.mockResolvedValue(5);

            const result = await service.getUnreadCount(mockUserId);

            expect(result.unreadCount).toBe(5);
            expect(mockPrismaClient.notification.count).toHaveBeenCalledWith({
                where: { userId: mockUserId, read: false },
            });
        });

        it('should return zero when no unread notifications', async () => {
            mockPrismaClient.notification.count.mockResolvedValue(0);

            const result = await service.getUnreadCount(mockUserId);

            expect(result.unreadCount).toBe(0);
        });
    });

    // ============================================
    // UPDATE TESTS
    // ============================================

    describe('markAsRead', () => {
        it('should mark notification as read', async () => {
            const mockNotification = createUnreadMockNotification({ userId: mockUserId });
            mockPrismaClient.notification.findUnique.mockResolvedValue(mockNotification);
            mockPrismaClient.notification.update.mockResolvedValue({
                ...mockNotification,
                read: true,
            });

            const result = await service.markAsRead(mockNotification.id, mockUserId);

            expect(result.success).toBe(true);
            expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
                where: { id: mockNotification.id },
                data: { read: true },
            });
        });

        it('should throw NotFoundException if notification does not exist', async () => {
            mockPrismaClient.notification.findUnique.mockResolvedValue(null);

            await expect(service.markAsRead('non-existent-id', mockUserId)).rejects.toThrow(
                NotFoundException,
            );

            expect(mockPrismaClient.notification.update).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException if user is not the owner', async () => {
            const mockNotification = createMockNotification({ userId: 'other-user' });
            mockPrismaClient.notification.findUnique.mockResolvedValue(mockNotification);

            await expect(service.markAsRead(mockNotification.id, mockUserId)).rejects.toThrow(
                ForbiddenException,
            );

            expect(mockPrismaClient.notification.update).not.toHaveBeenCalled();
        });
    });

    describe('markMultipleAsRead', () => {
        it('should mark all unread notifications as read when no IDs provided', async () => {
            mockPrismaClient.notification.updateMany.mockResolvedValue({ count: 5 });

            const result = await service.markMultipleAsRead(mockUserId);

            expect(result.success).toBe(true);
            expect(result.updatedCount).toBe(5);
            expect(mockPrismaClient.notification.updateMany).toHaveBeenCalledWith({
                where: { userId: mockUserId, read: false },
                data: { read: true },
            });
        });

        it('should mark specific notifications as read when IDs provided', async () => {
            const notificationIds = ['id-1', 'id-2'];
            mockPrismaClient.notification.findMany.mockResolvedValue([
                { id: 'id-1', userId: mockUserId },
                { id: 'id-2', userId: mockUserId },
            ]);
            mockPrismaClient.notification.updateMany.mockResolvedValue({ count: 2 });

            const result = await service.markMultipleAsRead(mockUserId, notificationIds);

            expect(result.updatedCount).toBe(2);
        });

        it('should throw ForbiddenException if any notification belongs to another user', async () => {
            const notificationIds = ['id-1', 'id-2'];
            mockPrismaClient.notification.findMany.mockResolvedValue([
                { id: 'id-1', userId: mockUserId },
                { id: 'id-2', userId: 'other-user' }, // Belongs to another user
            ]);

            await expect(service.markMultipleAsRead(mockUserId, notificationIds)).rejects.toThrow(
                ForbiddenException,
            );

            expect(mockPrismaClient.notification.updateMany).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // DELETE TESTS
    // ============================================

    describe('delete', () => {
        it('should delete notification successfully', async () => {
            const mockNotification = createMockNotification({ userId: mockUserId });
            mockPrismaClient.notification.findUnique.mockResolvedValue(mockNotification);
            mockPrismaClient.notification.delete.mockResolvedValue(mockNotification);

            const result = await service.delete(mockNotification.id, mockUserId);

            expect(result.success).toBe(true);
            expect(mockPrismaClient.notification.delete).toHaveBeenCalledWith({
                where: { id: mockNotification.id },
            });
        });

        it('should throw NotFoundException if notification does not exist', async () => {
            mockPrismaClient.notification.findUnique.mockResolvedValue(null);

            await expect(service.delete('non-existent-id', mockUserId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ForbiddenException if user is not the owner', async () => {
            const mockNotification = createMockNotification({ userId: 'other-user' });
            mockPrismaClient.notification.findUnique.mockResolvedValue(mockNotification);

            await expect(service.delete(mockNotification.id, mockUserId)).rejects.toThrow(
                ForbiddenException,
            );

            expect(mockPrismaClient.notification.delete).not.toHaveBeenCalled();
        });
    });

    describe('deleteAll', () => {
        it('should delete all notifications for user', async () => {
            mockPrismaClient.notification.deleteMany.mockResolvedValue({ count: 10 });

            const result = await service.deleteAll(mockUserId);

            expect(result.success).toBe(true);
            expect(result.message).toContain('10');
            expect(mockPrismaClient.notification.deleteMany).toHaveBeenCalledWith({
                where: { userId: mockUserId },
            });
        });
    });

    // ============================================
    // PUSH TOKEN TESTS
    // ============================================

    describe('registerPushToken', () => {
        it('should register valid push token', async () => {
            mockExpoPushService.isValidExpoPushToken.mockReturnValue(true);
            mockPrismaClient.userSettings.upsert.mockResolvedValue({});

            await service.registerPushToken(mockUserId, VALID_EXPO_PUSH_TOKEN);

            expect(mockPrismaClient.userSettings.upsert).toHaveBeenCalledWith({
                where: { userId: mockUserId },
                create: expect.objectContaining({ expoPushToken: VALID_EXPO_PUSH_TOKEN }),
                update: expect.objectContaining({ expoPushToken: VALID_EXPO_PUSH_TOKEN }),
            });
        });

        it('should throw BadRequestException for invalid push token', async () => {
            mockExpoPushService.isValidExpoPushToken.mockReturnValue(false);

            await expect(service.registerPushToken(mockUserId, 'invalid-token')).rejects.toThrow(
                BadRequestException,
            );

            expect(mockPrismaClient.userSettings.upsert).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException for empty push token', async () => {
            mockExpoPushService.isValidExpoPushToken.mockReturnValue(false);

            await expect(service.registerPushToken(mockUserId, '')).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('clearPushToken', () => {
        it('should clear push token', async () => {
            mockPrismaClient.userSettings.update.mockResolvedValue({});

            await service.clearPushToken(mockUserId);

            expect(mockPrismaClient.userSettings.update).toHaveBeenCalledWith({
                where: { userId: mockUserId },
                data: { expoPushToken: null },
            });
        });
    });

    // ============================================
    // CONVENIENCE METHOD TESTS
    // ============================================

    describe('notifyEpisodeReady', () => {
        it('should create episode ready notification', async () => {
            mockPrismaClient.user.findUnique.mockResolvedValue({ id: mockUserId });
            mockPrismaClient.notification.create.mockResolvedValue(
                createMockNotification({
                    userId: mockUserId,
                    type: NotificationType.EPISODE_READY,
                }),
            );

            const result = await service.notifyEpisodeReady(
                mockUserId,
                'episode-123',
                'My Episode',
            );

            expect(result.type).toBe(NotificationType.EPISODE_READY);
            expect(mockPrismaClient.notification.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: NotificationType.EPISODE_READY,
                        data: expect.objectContaining({ episodeId: 'episode-123' }),
                    }),
                }),
            );
        });
    });

    describe('notifyEpisodeFailed', () => {
        it('should create episode failed notification', async () => {
            mockPrismaClient.user.findUnique.mockResolvedValue({ id: mockUserId });
            mockPrismaClient.notification.create.mockResolvedValue(
                createMockNotification({
                    userId: mockUserId,
                    type: NotificationType.EPISODE_FAILED,
                }),
            );

            const result = await service.notifyEpisodeFailed(
                mockUserId,
                'episode-123',
                'My Episode',
                'Rate limit exceeded',
            );

            expect(result.type).toBe(NotificationType.EPISODE_FAILED);
        });
    });

    describe('notifyNewComment', () => {
        it('should create new comment notification', async () => {
            mockPrismaClient.user.findUnique.mockResolvedValue({ id: mockUserId });
            mockPrismaClient.notification.create.mockResolvedValue(
                createMockNotification({
                    userId: mockUserId,
                    type: NotificationType.NEW_COMMENT,
                }),
            );

            const result = await service.notifyNewComment(
                mockUserId,
                'episode-123',
                'My Episode',
                'John Doe',
            );

            expect(result.type).toBe(NotificationType.NEW_COMMENT);
        });
    });

    describe('notifySubscriptionWarning', () => {
        it('should create subscription warning notification', async () => {
            mockPrismaClient.user.findUnique.mockResolvedValue({ id: mockUserId });
            mockPrismaClient.notification.create.mockResolvedValue(
                createMockNotification({
                    userId: mockUserId,
                    type: NotificationType.SUBSCRIPTION_WARNING,
                }),
            );

            const result = await service.notifySubscriptionWarning(mockUserId, 80);

            expect(result.type).toBe(NotificationType.SUBSCRIPTION_WARNING);
        });
    });

    // ============================================
    // CONSUMER/STREAM PROCESSING TESTS
    // ============================================

    describe('processNotificationMessage (internal)', () => {
        it('should send push notification when user has token and push enabled', async () => {
            const mockSettings = createMockUserSettingsWithPushToken({ userId: mockUserId });
            mockPrismaClient.userSettings.findUnique.mockResolvedValue(mockSettings);
            mockExpoPushService.sendPushNotification.mockResolvedValue(mockExpoPushSuccessTicket);
            mockExpoPushService.getInvalidTokenFromTicket.mockReturnValue(null);

            await (service as any).processNotificationMessage({
                id: '1234567890-0',
                notificationId: 'notification-123',
                userId: mockUserId,
                type: NotificationType.EPISODE_READY,
                title: 'Test',
                body: 'Test body',
                data: JSON.stringify({ episodeId: 'episode-123' }),
                createdAt: new Date().toISOString(),
            });

            expect(mockExpoPushService.sendPushNotification).toHaveBeenCalled();
            expect(mockRedisServiceWithStreams.ackNotification).toHaveBeenCalledWith(
                '1234567890-0',
            );
        });

        it('should skip push when user has push disabled', async () => {
            const mockSettings = createMockUserSettingsWithPushDisabled({ userId: mockUserId });
            mockPrismaClient.userSettings.findUnique.mockResolvedValue(mockSettings);

            await (service as any).processNotificationMessage({
                id: '1234567890-0',
                notificationId: 'notification-123',
                userId: mockUserId,
                type: NotificationType.EPISODE_READY,
                title: 'Test',
                body: 'Test body',
                createdAt: new Date().toISOString(),
            });

            expect(mockExpoPushService.sendPushNotification).not.toHaveBeenCalled();
            expect(mockRedisServiceWithStreams.ackNotification).toHaveBeenCalled();
        });

        it('should skip push when user has no token', async () => {
            const mockSettings = createMockUserSettingsWithoutPushToken({ userId: mockUserId });
            mockPrismaClient.userSettings.findUnique.mockResolvedValue(mockSettings);

            await (service as any).processNotificationMessage({
                id: '1234567890-0',
                notificationId: 'notification-123',
                userId: mockUserId,
                type: NotificationType.EPISODE_READY,
                title: 'Test',
                body: 'Test body',
                createdAt: new Date().toISOString(),
            });

            expect(mockExpoPushService.sendPushNotification).not.toHaveBeenCalled();
            expect(mockRedisServiceWithStreams.ackNotification).toHaveBeenCalled();
        });

        it('should clear token when device is not registered', async () => {
            const mockSettings = createMockUserSettingsWithPushToken({ userId: mockUserId });
            mockPrismaClient.userSettings.findUnique.mockResolvedValue(mockSettings);
            mockExpoPushService.sendPushNotification.mockResolvedValue(
                mockExpoPushDeviceNotRegisteredTicket,
            );
            mockExpoPushService.getInvalidTokenFromTicket.mockReturnValue(
                mockSettings.expoPushToken,
            );
            mockPrismaClient.userSettings.update.mockResolvedValue({});

            await (service as any).processNotificationMessage({
                id: '1234567890-0',
                notificationId: 'notification-123',
                userId: mockUserId,
                type: NotificationType.EPISODE_READY,
                title: 'Test',
                body: 'Test body',
                createdAt: new Date().toISOString(),
            });

            expect(mockPrismaClient.userSettings.update).toHaveBeenCalledWith({
                where: { userId: mockUserId },
                data: { expoPushToken: null },
            });
        });
    });
});
