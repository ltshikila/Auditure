// Mock services for testing

export const mockEmailService = {
    sendOTP: jest.fn().mockResolvedValue(undefined),
};

export const mockStorageService = {
    uploadFile: jest.fn().mockResolvedValue('mock-storage-key'),
    downloadFile: jest.fn().mockResolvedValue(Buffer.from('mock file content')),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    fileExists: jest.fn().mockResolvedValue(true),
    getFileSize: jest.fn().mockResolvedValue(1024),
    createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn(), on: jest.fn() }),
};

export const mockRabbitMQService = {
    publishBookExtractionJob: jest.fn().mockResolvedValue(undefined),
    consumeBookExtractionQueue: jest.fn().mockResolvedValue(undefined),
};

export const mockTextExtractionService = {
    extractFromPdf: jest.fn().mockResolvedValue({
        fullText: 'Mock extracted PDF text',
        chapters: [{ chapterNumber: 1, title: 'Chapter 1', text: 'Chapter 1 content' }],
        metadata: { title: 'Test Book', author: 'Test Author', pageCount: 100 },
    }),
    extractFromEpub: jest.fn().mockResolvedValue({
        fullText: 'Mock extracted EPUB text',
        chapters: [{ chapterNumber: 1, title: 'Chapter 1', text: 'Chapter 1 content' }],
        metadata: { title: 'Test Book', author: 'Test Author' },
    }),
};

export const mockRedisService = {
    setJobProgress: jest.fn().mockResolvedValue(undefined),
    getJobProgress: jest.fn().mockResolvedValue(null),
    deleteJobProgress: jest.fn().mockResolvedValue(undefined),
    setPlaybackProgress: jest.fn().mockResolvedValue(undefined),
    getPlaybackProgress: jest.fn().mockResolvedValue(null),
    getAllPlaybackProgress: jest.fn().mockResolvedValue({}),
    getAllPlaybackTimestamps: jest.fn().mockResolvedValue({}),
    deletePlaybackProgress: jest.fn().mockResolvedValue(undefined),
    checkRateLimit: jest.fn().mockResolvedValue(true),
    getRateLimitRemaining: jest.fn().mockResolvedValue({ remaining: 10, resetIn: 3600 }),
};

export const mockRabbitMQServiceWithEpisodes = {
    ...mockRabbitMQService,
    publishEpisodeGenerationJob: jest.fn().mockResolvedValue(undefined),
};

// ============================================
// Notification Service Mocks
// ============================================

export const mockExpoPushService = {
    isValidExpoPushToken: jest.fn().mockImplementation((token: string) => {
        return token?.startsWith('ExponentPushToken[') || token?.startsWith('ExpoPushToken[');
    }),
    sendPushNotification: jest.fn().mockResolvedValue({
        status: 'ok',
        id: 'mock-ticket-id',
    }),
    sendPushNotificationsBatch: jest.fn().mockResolvedValue([
        { status: 'ok', id: 'mock-ticket-id-1' },
        { status: 'ok', id: 'mock-ticket-id-2' },
    ]),
    getPushReceipts: jest.fn().mockResolvedValue(new Map()),
    getInvalidTokenFromTicket: jest.fn().mockReturnValue(null),
};

export const mockRedisServiceWithStreams = {
    ...mockRedisService,
    initNotificationStream: jest.fn().mockResolvedValue(undefined),
    addNotificationToStream: jest.fn().mockResolvedValue('1234567890-0'),
    readNotificationsFromStream: jest.fn().mockResolvedValue([]),
    ackNotification: jest.fn().mockResolvedValue(true),
    getPendingNotifications: jest.fn().mockResolvedValue([]),
    claimNotifications: jest.fn().mockResolvedValue(0),
    trimNotificationStream: jest.fn().mockResolvedValue(0),
};

export const mockNotificationsService = {
    create: jest.fn().mockImplementation(payload => ({
        id: 'mock-notification-id',
        ...payload,
        read: false,
        createdAt: new Date(),
    })),
    createBatch: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue({
        notifications: [],
        total: 0,
        page: 1,
        totalPages: 0,
        unreadCount: 0,
    }),
    findOne: jest.fn().mockResolvedValue(null),
    getUnreadCount: jest.fn().mockResolvedValue({ unreadCount: 0 }),
    markAsRead: jest.fn().mockResolvedValue({
        success: true,
        message: 'Notification marked as read',
        updatedCount: 1,
    }),
    markMultipleAsRead: jest.fn().mockResolvedValue({
        success: true,
        message: '0 notification(s) marked as read',
        updatedCount: 0,
    }),
    delete: jest.fn().mockResolvedValue({
        success: true,
        message: 'Notification deleted',
    }),
    deleteAll: jest.fn().mockResolvedValue({
        success: true,
        message: '0 notification(s) deleted',
    }),
    registerPushToken: jest.fn().mockResolvedValue(undefined),
    clearPushToken: jest.fn().mockResolvedValue(undefined),
    notifyEpisodeReady: jest.fn().mockResolvedValue(null),
    notifyEpisodeFailed: jest.fn().mockResolvedValue(null),
    notifyNewComment: jest.fn().mockResolvedValue(null),
    notifyNewRating: jest.fn().mockResolvedValue(null),
    notifySubscriptionWarning: jest.fn().mockResolvedValue(null),
    notifySystem: jest.fn().mockResolvedValue(null),
    notifyNewLike: jest.fn().mockResolvedValue(null),
    notifyBookReady: jest.fn().mockResolvedValue(null),
    notifyBookFailed: jest.fn().mockResolvedValue(null),
    notifyWelcome: jest.fn().mockResolvedValue(null),
    notifyMilestone: jest.fn().mockResolvedValue(null),
};

// ============================================
// Search Service Mocks
// ============================================

export const mockSearchService = {
    search: jest.fn().mockResolvedValue({
        query: 'test',
        episodes: { results: [], total: 0, hasMore: false },
        books: { results: [], total: 0, hasMore: false },
        podcasters: { results: [], total: 0, hasMore: false },
    }),
    getSuggestions: jest.fn().mockResolvedValue({
        episodes: [],
        books: [],
        podcasters: [],
    }),
};
