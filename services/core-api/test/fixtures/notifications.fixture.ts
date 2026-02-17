// Test fixtures for notification data
import { randomUUID } from 'crypto';
import { NotificationType } from '../../src/notifications/interfaces/notification-payload.interface';

/**
 * Create a mock notification with customizable fields.
 */
export const createMockNotification = (overrides = {}) => ({
    id: randomUUID(),
    userId: randomUUID(),
    type: NotificationType.EPISODE_READY,
    title: 'Test Notification',
    body: 'This is a test notification body.',
    data: null,
    read: false,
    createdAt: new Date(),
    ...overrides,
});

/**
 * Create a mock unread notification.
 */
export const createUnreadMockNotification = (overrides = {}) =>
    createMockNotification({
        read: false,
        ...overrides,
    });

/**
 * Create a mock read notification.
 */
export const createReadMockNotification = (overrides = {}) =>
    createMockNotification({
        read: true,
        ...overrides,
    });

/**
 * Create a mock episode ready notification.
 */
export const createEpisodeReadyNotification = (overrides = {}) =>
    createMockNotification({
        type: NotificationType.EPISODE_READY,
        title: 'Episode Ready',
        body: 'Your episode "Test Episode" is ready to listen.',
        data: {
            episodeId: randomUUID(),
            route: '/episodes/test-episode-id',
        },
        ...overrides,
    });

/**
 * Create a mock episode failed notification.
 */
export const createEpisodeFailedNotification = (overrides = {}) =>
    createMockNotification({
        type: NotificationType.EPISODE_FAILED,
        title: 'Episode Generation Failed',
        body: 'We couldn\'t generate "Test Episode". Please try again.',
        data: {
            episodeId: randomUUID(),
            route: '/episodes/test-episode-id',
        },
        ...overrides,
    });

/**
 * Create a mock new comment notification.
 */
export const createNewCommentNotification = (overrides = {}) =>
    createMockNotification({
        type: NotificationType.NEW_COMMENT,
        title: 'New Comment',
        body: 'John Doe commented on "Test Episode"',
        data: {
            episodeId: randomUUID(),
            commentId: randomUUID(),
            route: '/episodes/test-episode-id/comments',
        },
        ...overrides,
    });

/**
 * Create a mock new rating notification.
 */
export const createNewRatingNotification = (overrides = {}) =>
    createMockNotification({
        type: NotificationType.NEW_RATING,
        title: 'New Rating',
        body: 'Someone rated your podcaster "Test Podcaster" 5 stars!',
        data: {
            podcasterId: randomUUID(),
            route: '/podcasters/test-podcaster-id',
        },
        ...overrides,
    });

/**
 * Create a mock subscription warning notification.
 */
export const createSubscriptionWarningNotification = (overrides = {}) =>
    createMockNotification({
        type: NotificationType.SUBSCRIPTION_WARNING,
        title: 'Usage Limit Warning',
        body: "You've used 80% of your monthly episode quota.",
        data: {
            route: '/settings/subscription',
        },
        ...overrides,
    });

/**
 * Create a mock system notification.
 */
export const createSystemNotification = (overrides = {}) =>
    createMockNotification({
        type: NotificationType.SYSTEM,
        title: 'System Update',
        body: 'We have made some improvements to the app!',
        data: null,
        ...overrides,
    });

/**
 * Create an array of mock notifications for pagination testing.
 */
export const createMockNotificationList = (count: number, userId: string, overrides = {}) => {
    return Array.from({ length: count }, (_, index) =>
        createMockNotification({
            userId,
            title: `Test Notification ${index + 1}`,
            body: `This is test notification number ${index + 1}`,
            read: index % 3 === 0, // Every 3rd notification is read
            createdAt: new Date(Date.now() - index * 60000), // 1 minute apart
            ...overrides,
        }),
    );
};

/**
 * Mock user settings with push token.
 */
export const createMockUserSettingsWithPushToken = (overrides = {}) => ({
    id: randomUUID(),
    userId: randomUUID(),
    theme: 'SYSTEM',
    pushNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    marketingEmailsEnabled: false,
    expoPushToken: 'ExponentPushToken[mock-token-12345]',
    profilePublic: false,
    showListeningActivity: true,
    autoPlayEnabled: true,
    playbackSpeed: 1.0,
    downloadOverWifiOnly: true,
    termsAcceptedAt: null,
    termsVersion: null,
    privacyPolicyAcceptedAt: null,
    privacyPolicyVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

/**
 * Mock user settings without push token.
 */
export const createMockUserSettingsWithoutPushToken = (overrides = {}) =>
    createMockUserSettingsWithPushToken({
        expoPushToken: null,
        ...overrides,
    });

/**
 * Mock user settings with push disabled.
 */
export const createMockUserSettingsWithPushDisabled = (overrides = {}) =>
    createMockUserSettingsWithPushToken({
        pushNotificationsEnabled: false,
        ...overrides,
    });

/**
 * Valid Expo push token for testing.
 */
export const VALID_EXPO_PUSH_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

/**
 * Invalid push token formats for testing.
 */
export const INVALID_PUSH_TOKENS = [
    '',
    'invalid-token',
    'APNs-token-here',
    'fcm-token-here',
    'ExponentPushToken', // Missing brackets
    'ExponentPushToken[]', // Empty brackets
    null,
    undefined,
];

/**
 * Mock Expo Push API successful response.
 */
export const mockExpoPushSuccessTicket = {
    status: 'ok' as const,
    id: 'mock-ticket-id-12345',
};

/**
 * Mock Expo Push API error response - device not registered.
 */
export const mockExpoPushDeviceNotRegisteredTicket = {
    status: 'error' as const,
    message: 'The device cannot receive push notifications anymore.',
    details: {
        error: 'DeviceNotRegistered' as const,
    },
};

/**
 * Mock Expo Push API error response - invalid credentials.
 */
export const mockExpoPushInvalidCredentialsTicket = {
    status: 'error' as const,
    message: 'Invalid push credentials.',
    details: {
        error: 'InvalidCredentials' as const,
    },
};

/**
 * Mock Redis stream message.
 */
export const createMockStreamMessage = (overrides = {}) => ({
    id: '1234567890-0',
    notificationId: randomUUID(),
    userId: randomUUID(),
    type: NotificationType.EPISODE_READY,
    title: 'Test Notification',
    body: 'This is a test notification.',
    data: JSON.stringify({ episodeId: randomUUID() }),
    createdAt: new Date().toISOString(),
    ...overrides,
});
