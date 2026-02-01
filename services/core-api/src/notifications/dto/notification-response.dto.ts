import {
    NotificationType,
    NotificationPayload,
} from '../interfaces/notification-payload.interface';

/**
 * Response DTO for a single notification
 */
export class NotificationResponseDto {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data: NotificationPayload | null;
    read: boolean;
    createdAt: Date;
}

/**
 * Response DTO for paginated notifications list
 */
export class NotificationsListResponseDto {
    notifications: NotificationResponseDto[];
    total: number;
    page: number;
    totalPages: number;
    unreadCount: number;
}

/**
 * Response DTO for unread count
 */
export class UnreadCountResponseDto {
    unreadCount: number;
}

/**
 * Response DTO for mark as read operations
 */
export class MarkReadResponseDto {
    success: boolean;
    message: string;
    updatedCount?: number;
}

/**
 * Response DTO for delete operations
 */
export class DeleteNotificationResponseDto {
    success: boolean;
    message: string;
}

// Re-export NotificationType for convenience
export { NotificationType };
