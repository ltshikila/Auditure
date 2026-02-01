import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './interfaces/notification-payload.interface';
import {
    createMockNotification,
    createMockNotificationList,
    VALID_EXPO_PUSH_TOKEN,
} from '../../test/fixtures/notifications.fixture';
import { mockNotificationsService } from '../../test/mocks/services.mock';

describe('NotificationsController', () => {
    let controller: NotificationsController;
    let notificationsService: NotificationsService;

    const mockUserId = 'user-123';
    const mockRequest = { user: { userId: mockUserId } };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                {
                    provide: NotificationsService,
                    useValue: mockNotificationsService,
                },
            ],
        }).compile();

        controller = module.get<NotificationsController>(NotificationsController);
        notificationsService = module.get<NotificationsService>(NotificationsService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ============================================
    // GET /notifications
    // ============================================

    describe('findAll', () => {
        it('should return paginated notifications', async () => {
            const mockResponse = {
                notifications: createMockNotificationList(5, mockUserId),
                total: 5,
                page: 1,
                totalPages: 1,
                unreadCount: 3,
            };
            mockNotificationsService.findAll.mockResolvedValue(mockResponse);

            const result = await controller.findAll(mockRequest, { page: 1, limit: 20 });

            expect(result).toEqual(mockResponse);
            expect(notificationsService.findAll).toHaveBeenCalledWith(mockUserId, {
                page: 1,
                limit: 20,
            });
        });

        it('should pass query parameters correctly', async () => {
            mockNotificationsService.findAll.mockResolvedValue({
                notifications: [],
                total: 0,
                page: 2,
                totalPages: 0,
                unreadCount: 0,
            });

            await controller.findAll(mockRequest, {
                page: 2,
                limit: 50,
                unreadOnly: true,
                type: NotificationType.EPISODE_READY,
            });

            expect(notificationsService.findAll).toHaveBeenCalledWith(mockUserId, {
                page: 2,
                limit: 50,
                unreadOnly: true,
                type: NotificationType.EPISODE_READY,
            });
        });
    });

    // ============================================
    // GET /notifications/unread-count
    // ============================================

    describe('getUnreadCount', () => {
        it('should return unread count', async () => {
            mockNotificationsService.getUnreadCount.mockResolvedValue({ unreadCount: 10 });

            const result = await controller.getUnreadCount(mockRequest);

            expect(result).toEqual({ unreadCount: 10 });
            expect(notificationsService.getUnreadCount).toHaveBeenCalledWith(mockUserId);
        });
    });

    // ============================================
    // GET /notifications/:id
    // ============================================

    describe('findOne', () => {
        it('should return single notification', async () => {
            const mockNotification = createMockNotification({ userId: mockUserId });
            mockNotificationsService.findOne.mockResolvedValue(mockNotification);

            const result = await controller.findOne(mockRequest, mockNotification.id);

            expect(result).toEqual(mockNotification);
            expect(notificationsService.findOne).toHaveBeenCalledWith(
                mockNotification.id,
                mockUserId,
            );
        });
    });

    // ============================================
    // PATCH /notifications/:id/read
    // ============================================

    describe('markAsRead', () => {
        it('should mark notification as read', async () => {
            const notificationId = 'notification-123';
            const mockResponse = {
                success: true,
                message: 'Notification marked as read',
                updatedCount: 1,
            };
            mockNotificationsService.markAsRead.mockResolvedValue(mockResponse);

            const result = await controller.markAsRead(mockRequest, notificationId);

            expect(result).toEqual(mockResponse);
            expect(notificationsService.markAsRead).toHaveBeenCalledWith(
                notificationId,
                mockUserId,
            );
        });
    });

    // ============================================
    // PATCH /notifications/read-all
    // ============================================

    describe('markAllAsRead', () => {
        it('should mark all notifications as read when no IDs provided', async () => {
            const mockResponse = {
                success: true,
                message: '5 notification(s) marked as read',
                updatedCount: 5,
            };
            mockNotificationsService.markMultipleAsRead.mockResolvedValue(mockResponse);

            const result = await controller.markAllAsRead(mockRequest, {});

            expect(result).toEqual(mockResponse);
            expect(notificationsService.markMultipleAsRead).toHaveBeenCalledWith(
                mockUserId,
                undefined,
            );
        });

        it('should mark specific notifications as read when IDs provided', async () => {
            const notificationIds = ['id-1', 'id-2', 'id-3'];
            const mockResponse = {
                success: true,
                message: '3 notification(s) marked as read',
                updatedCount: 3,
            };
            mockNotificationsService.markMultipleAsRead.mockResolvedValue(mockResponse);

            const result = await controller.markAllAsRead(mockRequest, { notificationIds });

            expect(result).toEqual(mockResponse);
            expect(notificationsService.markMultipleAsRead).toHaveBeenCalledWith(
                mockUserId,
                notificationIds,
            );
        });
    });

    // ============================================
    // DELETE /notifications/:id
    // ============================================

    describe('delete', () => {
        it('should delete notification', async () => {
            const notificationId = 'notification-123';
            const mockResponse = {
                success: true,
                message: 'Notification deleted',
            };
            mockNotificationsService.delete.mockResolvedValue(mockResponse);

            const result = await controller.delete(mockRequest, notificationId);

            expect(result).toEqual(mockResponse);
            expect(notificationsService.delete).toHaveBeenCalledWith(notificationId, mockUserId);
        });
    });

    // ============================================
    // DELETE /notifications/all
    // ============================================

    describe('deleteAll', () => {
        it('should delete all notifications', async () => {
            const mockResponse = {
                success: true,
                message: '10 notification(s) deleted',
            };
            mockNotificationsService.deleteAll.mockResolvedValue(mockResponse);

            const result = await controller.deleteAll(mockRequest);

            expect(result).toEqual(mockResponse);
            expect(notificationsService.deleteAll).toHaveBeenCalledWith(mockUserId);
        });
    });

    // ============================================
    // POST /notifications/push-token
    // ============================================

    describe('registerPushToken', () => {
        it('should register push token successfully', async () => {
            mockNotificationsService.registerPushToken.mockResolvedValue(undefined);

            const result = await controller.registerPushToken(mockRequest, {
                pushToken: VALID_EXPO_PUSH_TOKEN,
            });

            expect(result).toEqual({
                success: true,
                message: 'Push token registered successfully',
            });
            expect(notificationsService.registerPushToken).toHaveBeenCalledWith(
                mockUserId,
                VALID_EXPO_PUSH_TOKEN,
            );
        });
    });

    // ============================================
    // DELETE /notifications/push-token
    // ============================================

    describe('clearPushToken', () => {
        it('should clear push token successfully', async () => {
            mockNotificationsService.clearPushToken.mockResolvedValue(undefined);

            const result = await controller.clearPushToken(mockRequest);

            expect(result).toEqual({
                success: true,
                message: 'Push token cleared successfully',
            });
            expect(notificationsService.clearPushToken).toHaveBeenCalledWith(mockUserId);
        });
    });
});
