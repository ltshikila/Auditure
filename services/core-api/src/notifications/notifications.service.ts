import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    OnModuleInit,
    OnModuleDestroy,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { ExpoPushService } from './expo-push.service';
import {
    NotificationType,
    NotificationPayload,
    CreateNotificationPayload,
} from './interfaces/notification-payload.interface';
import {
    NotificationResponseDto,
    NotificationsListResponseDto,
    UnreadCountResponseDto,
    MarkReadResponseDto,
    DeleteNotificationResponseDto,
} from './dto/notification-response.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

/**
 * Service for managing notifications.
 * Handles CRUD operations, push notification delivery via Redis Streams,
 * and coordinates with Expo Push API for mobile delivery.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(NotificationsService.name);
    private readonly CONSUMER_NAME = `notifications-consumer-${process.pid}`;
    private isConsumerRunning = false;
    private consumerIntervalId: NodeJS.Timeout | null = null;

    constructor(
        private databaseService: DatabaseService,
        private redisService: RedisService,
        private expoPushService: ExpoPushService,
    ) {}

    async onModuleInit() {
        this.logger.log('Initializing NotificationsService...');

        // Initialize the notification stream
        await this.redisService.initNotificationStream();

        // Start the background consumer
        this.startConsumer();

        this.logger.log('NotificationsService initialized');
    }

    onModuleDestroy() {
        this.logger.log('Shutting down NotificationsService...');
        this.stopConsumer();
        this.logger.log('NotificationsService shut down');
    }

    // ============================================
    // Consumer Management
    // ============================================

    /**
     * Start the background consumer that processes notifications from Redis Stream.
     */
    private startConsumer(): void {
        if (this.isConsumerRunning) {
            this.logger.warn('Consumer is already running');
            return;
        }

        this.isConsumerRunning = true;
        this.logger.log(`Starting notification consumer: ${this.CONSUMER_NAME}`);

        // Run consumer loop
        this.runConsumerLoop();
    }

    /**
     * Stop the background consumer.
     */
    private stopConsumer(): void {
        this.isConsumerRunning = false;
        if (this.consumerIntervalId) {
            clearTimeout(this.consumerIntervalId);
            this.consumerIntervalId = null;
        }
        this.logger.log('Notification consumer stopped');
    }

    /**
     * Main consumer loop that processes notifications from the stream.
     */
    private async runConsumerLoop(): Promise<void> {
        while (this.isConsumerRunning) {
            try {
                // Read notifications from stream (blocks for up to 5 seconds)
                const messages = await this.redisService.readNotificationsFromStream(
                    this.CONSUMER_NAME,
                    10, // Process 10 at a time
                    5000, // Block for 5 seconds
                );

                if (messages.length > 0) {
                    this.logger.log(`Processing ${messages.length} notifications from stream`);

                    for (const message of messages) {
                        await this.processNotificationMessage(message);
                    }
                }

                // Also check for and reclaim stale pending messages
                await this.reclaimStaleMessages();

                // Periodically trim the stream
                if (Math.random() < 0.01) {
                    // ~1% chance each iteration
                    await this.redisService.trimNotificationStream(10000);
                }
            } catch (error) {
                this.logger.error(`Error in consumer loop: ${error.message}`);
                // Wait before retrying to avoid tight loop on errors
                await this.delay(1000);
            }
        }
    }

    /**
     * Process a single notification message from the stream.
     */
    private async processNotificationMessage(message: {
        id: string;
        notificationId: string;
        userId: string;
        type: string;
        title: string;
        body: string;
        data?: string;
        createdAt: string;
    }): Promise<void> {
        this.logger.log(
            `Processing notification ${message.notificationId} for user ${message.userId}`,
        );

        try {
            // Get user's push token
            const settings = await this.databaseService.userSettings.findUnique({
                where: { userId: message.userId },
                select: {
                    pushNotificationsEnabled: true,
                    expoPushToken: true,
                },
            });

            // Send push notification if enabled and token exists
            if (settings?.pushNotificationsEnabled && settings?.expoPushToken) {
                const data = message.data ? JSON.parse(message.data) : undefined;

                const ticket = await this.expoPushService.sendPushNotification(
                    settings.expoPushToken,
                    message.title,
                    message.body,
                    data,
                );

                if (ticket) {
                    // Check if token is invalid and should be removed
                    const invalidToken = this.expoPushService.getInvalidTokenFromTicket(
                        ticket,
                        settings.expoPushToken,
                    );

                    if (invalidToken) {
                        await this.clearPushToken(message.userId);
                    }

                    if (ticket.status === 'ok') {
                        this.logger.log(
                            `Push notification sent for ${message.notificationId}: ticket ${ticket.id}`,
                        );
                    }
                }
            } else {
                this.logger.log(
                    `Skipping push for ${message.notificationId}: ` +
                        `enabled=${settings?.pushNotificationsEnabled}, hasToken=${!!settings?.expoPushToken}`,
                );
            }

            // Acknowledge the message
            await this.redisService.ackNotification(message.id);
            this.logger.log(`Acknowledged notification ${message.notificationId}`);
        } catch (error) {
            this.logger.error(
                `Failed to process notification ${message.notificationId}: ${error.message}`,
            );
            // Don't ack - message will be retried or reclaimed
        }
    }

    /**
     * Reclaim messages that have been pending too long (stuck consumers).
     */
    private async reclaimStaleMessages(): Promise<void> {
        const STALE_THRESHOLD_MS = 60000; // 1 minute

        try {
            const pending = await this.redisService.getPendingNotifications(50);
            const staleIds = pending
                .filter(p => p.idleTime > STALE_THRESHOLD_MS && p.deliveryCount < 5)
                .map(p => p.id);

            if (staleIds.length > 0) {
                this.logger.warn(`Reclaiming ${staleIds.length} stale notifications`);
                await this.redisService.claimNotifications(
                    this.CONSUMER_NAME,
                    STALE_THRESHOLD_MS,
                    staleIds,
                );
            }
        } catch (error) {
            this.logger.error(`Error reclaiming stale messages: ${error.message}`);
        }
    }

    // ============================================
    // Notification Creation
    // ============================================

    /**
     * Create a notification and queue it for push delivery.
     * @param payload - The notification data
     * @returns The created notification
     */
    async create(payload: CreateNotificationPayload): Promise<NotificationResponseDto> {
        this.logger.log(`create() called: type=${payload.type}, userId=${payload.userId}`);

        // Validate user exists
        const user = await this.databaseService.user.findUnique({
            where: { id: payload.userId },
            select: { id: true },
        });

        if (!user) {
            this.logger.error(`User ${payload.userId} not found`);
            throw new NotFoundException('User not found');
        }

        // Create the notification in database
        const notification = await this.databaseService.notification.create({
            data: {
                userId: payload.userId,
                type: payload.type,
                title: payload.title,
                body: payload.body,
                ...(payload.data && { data: payload.data }),
            },
        });

        this.logger.log(`Created notification ${notification.id} for user ${payload.userId}`);

        // Queue for push delivery via Redis Stream
        await this.redisService.addNotificationToStream({
            notificationId: notification.id,
            userId: payload.userId,
            type: payload.type,
            title: payload.title,
            body: payload.body,
            data: payload.data ? JSON.stringify(payload.data) : undefined,
        });

        return notification as NotificationResponseDto;
    }

    /**
     * Create multiple notifications (batch).
     * Useful for sending the same notification to multiple users.
     */
    async createBatch(payloads: CreateNotificationPayload[]): Promise<NotificationResponseDto[]> {
        this.logger.log(`createBatch() called with ${payloads.length} notifications`);

        if (payloads.length === 0) {
            return [];
        }

        const notifications: NotificationResponseDto[] = [];

        for (const payload of payloads) {
            try {
                const notification = await this.create(payload);
                notifications.push(notification);
            } catch (error) {
                this.logger.error(
                    `Failed to create notification for user ${payload.userId}: ${error.message}`,
                );
                // Continue with other notifications
            }
        }

        return notifications;
    }

    // ============================================
    // Notification Retrieval
    // ============================================

    /**
     * Get notifications for a user with pagination and filtering.
     */
    async findAll(
        userId: string,
        query: NotificationQueryDto,
    ): Promise<NotificationsListResponseDto> {
        this.logger.log(`findAll() called for user ${userId}`);

        const { page = 1, limit = 20, unreadOnly = false, type } = query;

        // Build where clause
        const where: any = { userId };

        if (unreadOnly) {
            where.read = false;
        }

        if (type) {
            where.type = type;
        }

        // Get total count and unread count in parallel
        const [total, unreadCount, notifications] = await Promise.all([
            this.databaseService.notification.count({ where }),
            this.databaseService.notification.count({
                where: { userId, read: false },
            }),
            this.databaseService.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        const totalPages = Math.ceil(total / limit);

        this.logger.log(
            `Found ${notifications.length} notifications for user ${userId} (page ${page}/${totalPages})`,
        );

        return {
            notifications: notifications as NotificationResponseDto[],
            total,
            page,
            totalPages,
            unreadCount,
        };
    }

    /**
     * Get a single notification by ID.
     */
    async findOne(id: string, userId: string): Promise<NotificationResponseDto> {
        this.logger.log(`findOne() called for notification ${id}, user ${userId}`);

        const notification = await this.databaseService.notification.findUnique({
            where: { id },
        });

        if (!notification) {
            this.logger.error(`Notification ${id} not found`);
            throw new NotFoundException('Notification not found');
        }

        if (notification.userId !== userId) {
            this.logger.error(
                `User ${userId} attempted to access notification ${id} belonging to ${notification.userId}`,
            );
            throw new ForbiddenException('Access denied to this notification');
        }

        return notification as NotificationResponseDto;
    }

    /**
     * Get unread notification count for a user.
     */
    async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
        this.logger.log(`getUnreadCount() called for user ${userId}`);

        const unreadCount = await this.databaseService.notification.count({
            where: { userId, read: false },
        });

        return { unreadCount };
    }

    // ============================================
    // Notification Updates
    // ============================================

    /**
     * Mark a single notification as read.
     */
    async markAsRead(id: string, userId: string): Promise<MarkReadResponseDto> {
        this.logger.log(`markAsRead() called for notification ${id}, user ${userId}`);

        // Verify ownership
        await this.findOne(id, userId);

        await this.databaseService.notification.update({
            where: { id },
            data: { read: true },
        });

        this.logger.log(`Marked notification ${id} as read`);

        return {
            success: true,
            message: 'Notification marked as read',
            updatedCount: 1,
        };
    }

    /**
     * Mark multiple notifications as read.
     * If no IDs provided, marks all unread notifications as read.
     */
    async markMultipleAsRead(
        userId: string,
        notificationIds?: string[],
    ): Promise<MarkReadResponseDto> {
        this.logger.log(
            `markMultipleAsRead() called for user ${userId}, ids=${notificationIds?.length || 'all'}`,
        );

        let where: any = { userId, read: false };

        if (notificationIds && notificationIds.length > 0) {
            // Verify all notifications belong to user
            const notifications = await this.databaseService.notification.findMany({
                where: { id: { in: notificationIds } },
                select: { id: true, userId: true },
            });

            const unauthorized = notifications.filter(n => n.userId !== userId);
            if (unauthorized.length > 0) {
                this.logger.error(
                    `User ${userId} attempted to mark notifications belonging to other users`,
                );
                throw new ForbiddenException('Access denied to some notifications');
            }

            where = { id: { in: notificationIds }, userId };
        }

        const result = await this.databaseService.notification.updateMany({
            where,
            data: { read: true },
        });

        this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);

        return {
            success: true,
            message: `${result.count} notification(s) marked as read`,
            updatedCount: result.count,
        };
    }

    // ============================================
    // Notification Deletion
    // ============================================

    /**
     * Delete a single notification.
     */
    async delete(id: string, userId: string): Promise<DeleteNotificationResponseDto> {
        this.logger.log(`delete() called for notification ${id}, user ${userId}`);

        // Verify ownership
        await this.findOne(id, userId);

        await this.databaseService.notification.delete({
            where: { id },
        });

        this.logger.log(`Deleted notification ${id}`);

        return {
            success: true,
            message: 'Notification deleted',
        };
    }

    /**
     * Delete all notifications for a user.
     */
    async deleteAll(userId: string): Promise<DeleteNotificationResponseDto> {
        this.logger.log(`deleteAll() called for user ${userId}`);

        const result = await this.databaseService.notification.deleteMany({
            where: { userId },
        });

        this.logger.log(`Deleted ${result.count} notifications for user ${userId}`);

        return {
            success: true,
            message: `${result.count} notification(s) deleted`,
        };
    }

    // ============================================
    // Push Token Management
    // ============================================

    /**
     * Register or update a user's Expo push token.
     */
    async registerPushToken(userId: string, pushToken: string): Promise<void> {
        this.logger.log(`registerPushToken() called for user ${userId}`);

        if (!this.expoPushService.isValidExpoPushToken(pushToken)) {
            this.logger.error(`Invalid push token format for user ${userId}`);
            throw new BadRequestException('Invalid Expo push token format');
        }

        await this.databaseService.userSettings.upsert({
            where: { userId },
            create: {
                userId,
                expoPushToken: pushToken,
            },
            update: {
                expoPushToken: pushToken,
            },
        });

        this.logger.log(`Push token registered for user ${userId}`);
    }

    /**
     * Clear a user's push token.
     */
    async clearPushToken(userId: string): Promise<void> {
        this.logger.log(`clearPushToken() called for user ${userId}`);

        await this.databaseService.userSettings.update({
            where: { userId },
            data: { expoPushToken: null },
        });

        this.logger.log(`Push token cleared for user ${userId}`);
    }

    // ============================================
    // Convenience Methods for Common Notification Types
    // ============================================

    /**
     * Send an "episode ready" notification.
     */
    async notifyEpisodeReady(
        userId: string,
        episodeId: string,
        episodeTitle: string,
    ): Promise<NotificationResponseDto> {
        return this.create({
            userId,
            type: NotificationType.EPISODE_READY,
            title: 'Episode Ready! 🎧',
            body: `Your episode "${episodeTitle}" is ready to listen.`,
            data: {
                episodeId,
                route: `/episodes/${episodeId}`,
            },
        });
    }

    /**
     * Send an "episode failed" notification.
     */
    async notifyEpisodeFailed(
        userId: string,
        episodeId: string,
        episodeTitle: string,
        errorMessage?: string,
    ): Promise<NotificationResponseDto> {
        return this.create({
            userId,
            type: NotificationType.EPISODE_FAILED,
            title: 'Episode Generation Failed',
            body: `We couldn't generate "${episodeTitle}". ${errorMessage || 'Please try again.'}`,
            data: {
                episodeId,
                route: `/episodes/${episodeId}`,
            },
        });
    }

    /**
     * Send a "new comment" notification.
     */
    async notifyNewComment(
        userId: string,
        episodeId: string,
        episodeTitle: string,
        commenterName: string,
    ): Promise<NotificationResponseDto> {
        return this.create({
            userId,
            type: NotificationType.NEW_COMMENT,
            title: 'New Comment',
            body: `${commenterName} commented on "${episodeTitle}"`,
            data: {
                episodeId,
                route: `/episodes/${episodeId}/comments`,
            },
        });
    }

    /**
     * Send a "new rating" notification.
     */
    async notifyNewRating(
        userId: string,
        podcasterId: string,
        podcasterName: string,
        rating: number,
    ): Promise<NotificationResponseDto> {
        return this.create({
            userId,
            type: NotificationType.NEW_RATING,
            title: 'New Rating',
            body: `Someone rated your podcaster "${podcasterName}" ${rating} stars!`,
            data: {
                podcasterId,
                route: `/podcasters/${podcasterId}`,
            },
        });
    }

    /**
     * Send a "subscription warning" notification.
     */
    async notifySubscriptionWarning(
        userId: string,
        usagePercent: number,
    ): Promise<NotificationResponseDto> {
        return this.create({
            userId,
            type: NotificationType.SUBSCRIPTION_WARNING,
            title: 'Usage Limit Warning',
            body: `You've used ${usagePercent}% of your monthly episode quota.`,
            data: {
                route: '/settings/subscription',
            },
        });
    }

    /**
     * Send a system notification.
     */
    async notifySystem(
        userId: string,
        title: string,
        body: string,
        data?: NotificationPayload,
    ): Promise<NotificationResponseDto> {
        return this.create({
            userId,
            type: NotificationType.SYSTEM,
            title,
            body,
            data,
        });
    }

    // ============================================
    // Helpers
    // ============================================

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
