import { apiClient } from './api';

export type NotificationType =
    | 'EPISODE_READY'
    | 'EPISODE_FAILED'
    | 'NEW_COMMENT'
    | 'NEW_REPLY'
    | 'NEW_RATING'
    | 'SUBSCRIPTION_WARNING'
    | 'SYSTEM';

export interface NotificationPayload {
    episodeId?: string;
    bookId?: string;
    podcasterId?: string;
    commentId?: string;
    route?: string;
    [key: string]: any;
}

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data: NotificationPayload | null;
    read: boolean;
    createdAt: string;
}

export interface NotificationsListResponse {
    notifications: Notification[];
    total: number;
    page: number;
    totalPages: number;
    unreadCount: number;
}

export interface UnreadCountResponse {
    unreadCount: number;
}

export interface NotificationQueryParams {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: NotificationType;
}

class NotificationService {
    /**
     * Get paginated list of notifications
     */
    async getNotifications(
        token: string,
        params?: NotificationQueryParams
    ): Promise<NotificationsListResponse> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.unreadOnly) queryParams.append('unreadOnly', 'true');
        if (params?.type) queryParams.append('type', params.type);

        const queryString = queryParams.toString();
        const endpoint = `/notifications${queryString ? `?${queryString}` : ''}`;

        return apiClient.get<NotificationsListResponse>(endpoint, token);
    }

    /**
     * Get single notification by ID
     */
    async getNotification(id: string, token: string): Promise<Notification> {
        return apiClient.get<Notification>(`/notifications/${id}`, token);
    }

    /**
     * Get unread notification count
     */
    async getUnreadCount(token: string): Promise<UnreadCountResponse> {
        return apiClient.get<UnreadCountResponse>('/notifications/unread-count', token);
    }

    /**
     * Mark a single notification as read
     */
    async markAsRead(
        id: string,
        token: string
    ): Promise<{ success: boolean; message: string }> {
        return apiClient.patch<{ success: boolean; message: string }>(
            `/notifications/${id}/read`,
            {},
            token
        );
    }

    /**
     * Mark multiple or all notifications as read
     */
    async markAllAsRead(
        token: string,
        notificationIds?: string[]
    ): Promise<{ success: boolean; message: string; updatedCount?: number }> {
        return apiClient.patch<{ success: boolean; message: string; updatedCount?: number }>(
            '/notifications/read-all',
            { notificationIds },
            token
        );
    }

    /**
     * Delete a single notification
     */
    async deleteNotification(
        id: string,
        token: string
    ): Promise<{ success: boolean; message: string }> {
        return apiClient.delete<{ success: boolean; message: string }>(
            `/notifications/${id}`,
            token
        );
    }

    /**
     * Delete all notifications
     */
    async deleteAllNotifications(
        token: string
    ): Promise<{ success: boolean; message: string }> {
        return apiClient.delete<{ success: boolean; message: string }>(
            '/notifications/all',
            token
        );
    }

    /**
     * Register Expo push token for push notifications
     */
    async registerPushToken(
        pushToken: string,
        token: string
    ): Promise<{ success: boolean; message: string }> {
        return apiClient.post<{ success: boolean; message: string }>(
            '/notifications/push-token',
            { pushToken },
            token
        );
    }

    /**
     * Clear push token (call on logout)
     */
    async clearPushToken(
        token: string
    ): Promise<{ success: boolean; message: string }> {
        return apiClient.delete<{ success: boolean; message: string }>(
            '/notifications/push-token',
            token
        );
    }
}

export const notificationService = new NotificationService();
