/**
 * Notification payload interface for deep linking and additional data
 */
export interface NotificationPayload {
    /** Episode ID for episode-related notifications */
    episodeId?: string;
    /** Book ID for book-related notifications */
    bookId?: string;
    /** Podcaster ID for podcaster-related notifications */
    podcasterId?: string;
    /** Comment ID for comment-related notifications */
    commentId?: string;
    /** Deep link route for navigation */
    route?: string;
    /** Additional metadata */
    [key: string]: string | number | boolean | undefined;
}

/**
 * Expo Push ticket response
 */
export interface ExpoPushTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: {
        error?:
            | 'DeviceNotRegistered'
            | 'InvalidCredentials'
            | 'MessageTooBig'
            | 'MessageRateExceeded';
    };
}

/**
 * Expo Push receipt response
 */
export interface ExpoPushReceipt {
    status: 'ok' | 'error';
    message?: string;
    details?: {
        error?: string;
    };
}

/**
 * Internal notification creation payload
 */
export interface CreateNotificationPayload {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: NotificationPayload;
}

/**
 * Redis Stream notification message
 */
export interface NotificationStreamMessage {
    notificationId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: string; // JSON stringified NotificationPayload
    createdAt: string;
}

export enum NotificationType {
    EPISODE_READY = 'EPISODE_READY',
    EPISODE_FAILED = 'EPISODE_FAILED',
    NEW_COMMENT = 'NEW_COMMENT',
    NEW_REPLY = 'NEW_REPLY',
    NEW_RATING = 'NEW_RATING',
    NEW_LIKE = 'NEW_LIKE',
    BOOK_READY = 'BOOK_READY',
    BOOK_FAILED = 'BOOK_FAILED',
    SUBSCRIPTION_WARNING = 'SUBSCRIPTION_WARNING',
    WELCOME = 'WELCOME',
    MILESTONE = 'MILESTONE',
    SYSTEM = 'SYSTEM',
}
