// Test fixtures for feed data
import { randomUUID } from 'crypto';
import { EpisodeFeedItem, BookFeedItem, PodcasterFeedItem } from '../../src/feed/dto/feed-response.dto';
import { FeedTab, EpisodeSectionId, BookSectionId, PodcasterSectionId } from '../../src/feed/dto/feed-query.dto';

// ============================================
// Episode Feed Items
// ============================================

export const createMockEpisodeFeedItem = (overrides: Partial<EpisodeFeedItem> = {}): EpisodeFeedItem => ({
    id: randomUUID(),
    title: 'Test Episode',
    description: 'Test episode description',
    coverImageUrl: 'https://example.com/cover.jpg',
    duration: 1200000, // 20 minutes in ms
    playCount: 100,
    likeCount: 25,
    createdAt: new Date(),
    book: {
        id: randomUUID(),
        title: 'Test Book',
        author: 'Test Author',
        coverImageUrl: 'https://example.com/book-cover.jpg',
    },
    podcaster: {
        id: randomUUID(),
        name: 'Test Podcaster',
        profilePictureUrl: 'https://example.com/avatar.jpg',
    },
    creator: {
        id: randomUUID(),
        firstName: 'John',
        lastName: 'Doe',
    },
    ...overrides,
});

export const createMockContinueListeningItem = (overrides: Partial<EpisodeFeedItem> = {}): EpisodeFeedItem => ({
    ...createMockEpisodeFeedItem(),
    progressMs: 600000, // 10 minutes
    progressPercent: 50,
    lastPlayedAt: new Date(),
    ...overrides,
});

// ============================================
// Book Feed Items
// ============================================

export const createMockBookFeedItem = (overrides: Partial<BookFeedItem> = {}): BookFeedItem => ({
    id: randomUUID(),
    title: 'Test Book',
    author: 'Test Author',
    coverImageUrl: 'https://example.com/cover.jpg',
    language: 'English',
    pageCount: 300,
    createdAt: new Date(),
    episodeCount: 5,
    totalPlayCount: 500,
    ...overrides,
});

// ============================================
// Podcaster Feed Items
// ============================================

export const createMockPodcasterFeedItem = (overrides: Partial<PodcasterFeedItem> = {}): PodcasterFeedItem => ({
    id: randomUUID(),
    name: 'Test Podcaster',
    bio: 'A test podcaster bio',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    voiceModel: 'CONVERSATIONAL',
    expertiseTags: ['philosophy', 'science'],
    playCount: 1000,
    likeCount: 250,
    averageRating: 4.5,
    ratingCount: 50,
    createdAt: new Date(),
    creator: {
        id: randomUUID(),
        firstName: 'Jane',
        lastName: 'Smith',
    },
    ...overrides,
});

// ============================================
// Database Mock Data (for Prisma queries)
// ============================================

export const createMockEpisodeWithRelations = (overrides = {}) => ({
    id: randomUUID(),
    userId: randomUUID(),
    title: 'Test Episode',
    description: 'Test description',
    generationStatus: 'COMPLETED',
    isPublic: true,
    duration: 1200000,
    playCount: 100,
    likeCount: 25,
    shareCount: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    book: {
        id: randomUUID(),
        title: 'Test Book',
        author: 'Test Author',
        coverImageUrl: 'https://example.com/cover.jpg',
    },
    podcaster: {
        id: randomUUID(),
        name: 'Test Podcaster',
        profilePictureUrl: 'https://example.com/avatar.jpg',
    },
    user: {
        id: randomUUID(),
        firstName: 'John',
        lastName: 'Doe',
    },
    ...overrides,
});

export const createMockBookWithCount = (overrides = {}) => ({
    id: randomUUID(),
    userId: randomUUID(),
    title: 'Test Book',
    author: 'Test Author',
    coverImageUrl: 'https://example.com/cover.jpg',
    language: 'English',
    pageCount: 300,
    extractionStatus: 'COMPLETED',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
        episodes: 5,
    },
    ...overrides,
});

export const createMockBookWithEpisodes = (overrides = {}) => ({
    ...createMockBookWithCount(),
    episodes: [
        { playCount: 100 },
        { playCount: 200 },
        { playCount: 150 },
    ],
    ...overrides,
});

export const createMockPodcasterWithCreator = (overrides = {}) => ({
    id: randomUUID(),
    userId: randomUUID(),
    name: 'Test Podcaster',
    bio: 'Test bio',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    voiceModel: 'CONVERSATIONAL',
    expertiseTags: ['philosophy', 'science'],
    isPublic: true,
    playCount: 1000,
    likeCount: 250,
    averageRating: 4.5,
    ratingCount: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
        id: randomUUID(),
        firstName: 'Jane',
        lastName: 'Smith',
    },
    ...overrides,
});

// ============================================
// Feed Response Fixtures
// ============================================

export const createMockEpisodesFeedResponse = () => ({
    tab: FeedTab.EPISODES,
    sections: [
        {
            id: EpisodeSectionId.CONTINUE_LISTENING,
            title: 'Pick up where you left off',
            type: EpisodeSectionId.CONTINUE_LISTENING,
            items: [createMockContinueListeningItem(), createMockContinueListeningItem()],
            hasMore: false,
        },
        {
            id: EpisodeSectionId.POPULAR,
            title: 'Popular Episodes',
            type: EpisodeSectionId.POPULAR,
            items: Array(10).fill(null).map(() => createMockEpisodeFeedItem()),
            hasMore: true,
        },
        {
            id: EpisodeSectionId.LATEST,
            title: 'Latest Releases',
            type: EpisodeSectionId.LATEST,
            items: Array(10).fill(null).map(() => createMockEpisodeFeedItem()),
            hasMore: true,
        },
    ],
});

export const createMockBooksFeedResponse = () => ({
    tab: FeedTab.BOOKS,
    sections: [
        {
            id: BookSectionId.POPULAR_INSPIRATIONS,
            title: 'Popular podcast inspirations',
            type: BookSectionId.POPULAR_INSPIRATIONS,
            items: Array(10).fill(null).map(() => createMockBookFeedItem()),
            hasMore: true,
        },
        {
            id: BookSectionId.POPULAR_BOOKS,
            title: 'Popular Books',
            type: BookSectionId.POPULAR_BOOKS,
            items: Array(10).fill(null).map(() => createMockBookFeedItem()),
            hasMore: true,
        },
    ],
});

export const createMockPodcastersFeedResponse = () => ({
    tab: FeedTab.PODCASTERS,
    sections: [
        {
            id: PodcasterSectionId.TRENDING,
            title: 'Trending',
            type: PodcasterSectionId.TRENDING,
            items: Array(10).fill(null).map(() => createMockPodcasterFeedItem()),
            hasMore: true,
        },
        {
            id: PodcasterSectionId.TOP_RATED,
            title: 'Top Rated',
            type: PodcasterSectionId.TOP_RATED,
            items: Array(10).fill(null).map(() => createMockPodcasterFeedItem()),
            hasMore: true,
        },
    ],
});

// ============================================
// Playback Progress Mock Data
// ============================================

export const createMockPlaybackProgress = (episodeIds: string[]): Record<string, number> => {
    const progress: Record<string, number> = {};
    episodeIds.forEach((id, index) => {
        // Create varying progress percentages (in milliseconds)
        // For a 20 min (1200000ms) episode:
        // - 50% = 600000ms
        // - 30% = 360000ms
        // - 70% = 840000ms
        const percentages = [50, 30, 70, 20, 80, 40, 60];
        const percent = percentages[index % percentages.length];
        progress[id] = Math.round(1200000 * (percent / 100));
    });
    return progress;
};

// Mock user ID for testing
export const MOCK_USER_ID = 'test-user-123';
