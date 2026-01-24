import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Query,
    Body,
    Request,
    UseGuards,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import {
    NotificationQueryDto,
    RegisterPushTokenDto,
    MarkNotificationsReadDto,
} from './dto/notification-query.dto';
import {
    NotificationResponseDto,
    NotificationsListResponseDto,
    UnreadCountResponseDto,
    MarkReadResponseDto,
    DeleteNotificationResponseDto,
} from './dto/notification-response.dto';

/**
 * Controller for managing user notifications.
 * All endpoints require JWT authentication.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    private readonly logger = new Logger(NotificationsController.name);

    constructor(private readonly notificationsService: NotificationsService) {}

    /**
     * Get paginated list of notifications for the authenticated user.
     * Supports filtering by read status and notification type.
     *
     * @route GET /notifications
     * @query page - Page number (default: 1)
     * @query limit - Items per page (default: 20, max: 100)
     * @query unreadOnly - Only return unread notifications (default: false)
     * @query type - Filter by notification type
     */
    @Get()
    async findAll(
        @Request() req,
        @Query() query: NotificationQueryDto,
    ): Promise<NotificationsListResponseDto> {
        this.logger.log(`GET /notifications - user ${req.user.userId}`);
        return this.notificationsService.findAll(req.user.userId, query);
    }

    /**
     * Get unread notification count for the authenticated user.
     * Useful for displaying badge counts in the app.
     *
     * @route GET /notifications/unread-count
     */
    @Get('unread-count')
    async getUnreadCount(@Request() req): Promise<UnreadCountResponseDto> {
        this.logger.log(`GET /notifications/unread-count - user ${req.user.userId}`);
        return this.notificationsService.getUnreadCount(req.user.userId);
    }

    /**
     * Mark all unread notifications as read.
     * Optionally specify notification IDs to mark specific ones.
     *
     * @route PATCH /notifications/read-all
     * @body notificationIds - Optional array of notification IDs to mark as read
     */
    @Patch('read-all')
    async markAllAsRead(
        @Request() req,
        @Body() body: MarkNotificationsReadDto,
    ): Promise<MarkReadResponseDto> {
        this.logger.log(
            `PATCH /notifications/read-all - user ${req.user.userId}, ids=${body.notificationIds?.length || 'all'}`,
        );
        return this.notificationsService.markMultipleAsRead(
            req.user.userId,
            body.notificationIds,
        );
    }

    /**
     * Delete all notifications for the authenticated user.
     *
     * @route DELETE /notifications/all
     */
    @Delete('all')
    @HttpCode(HttpStatus.OK)
    async deleteAll(@Request() req): Promise<DeleteNotificationResponseDto> {
        this.logger.log(`DELETE /notifications/all - user ${req.user.userId}`);
        return this.notificationsService.deleteAll(req.user.userId);
    }

    /**
     * Register or update Expo push token for the authenticated user.
     * Required to receive push notifications on mobile devices.
     *
     * @route POST /notifications/push-token
     * @body pushToken - The Expo push token from the device
     */
    @Post('push-token')
    @HttpCode(HttpStatus.OK)
    async registerPushToken(
        @Request() req,
        @Body() body: RegisterPushTokenDto,
    ): Promise<{ success: boolean; message: string }> {
        this.logger.log(`POST /notifications/push-token - user ${req.user.userId}`);
        await this.notificationsService.registerPushToken(
            req.user.userId,
            body.pushToken,
        );
        return {
            success: true,
            message: 'Push token registered successfully',
        };
    }

    /**
     * Remove push token for the authenticated user.
     * Call this when logging out or disabling notifications.
     *
     * @route DELETE /notifications/push-token
     */
    @Delete('push-token')
    @HttpCode(HttpStatus.OK)
    async clearPushToken(
        @Request() req,
    ): Promise<{ success: boolean; message: string }> {
        this.logger.log(`DELETE /notifications/push-token - user ${req.user.userId}`);
        await this.notificationsService.clearPushToken(req.user.userId);
        return {
            success: true,
            message: 'Push token cleared successfully',
        };
    }

    /**
     * Get a single notification by ID.
     *
     * @route GET /notifications/:id
     * @param id - The notification ID
     */
    @Get(':id')
    async findOne(
        @Request() req,
        @Param('id') id: string,
    ): Promise<NotificationResponseDto> {
        this.logger.log(`GET /notifications/${id} - user ${req.user.userId}`);
        return this.notificationsService.findOne(id, req.user.userId);
    }

    /**
     * Mark a single notification as read.
     *
     * @route PATCH /notifications/:id/read
     * @param id - The notification ID
     */
    @Patch(':id/read')
    async markAsRead(
        @Request() req,
        @Param('id') id: string,
    ): Promise<MarkReadResponseDto> {
        this.logger.log(`PATCH /notifications/${id}/read - user ${req.user.userId}`);
        return this.notificationsService.markAsRead(id, req.user.userId);
    }

    /**
     * Delete a single notification.
     *
     * @route DELETE /notifications/:id
     * @param id - The notification ID
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Request() req,
        @Param('id') id: string,
    ): Promise<DeleteNotificationResponseDto> {
        this.logger.log(`DELETE /notifications/${id} - user ${req.user.userId}`);
        return this.notificationsService.delete(id, req.user.userId);
    }
}
