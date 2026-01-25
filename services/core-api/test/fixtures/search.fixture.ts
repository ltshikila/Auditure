// Test fixtures for search module
import { EpisodeSearchResult, BookSearchResult, PodcasterSearchResult } from '../../src/search/dto';

export const mockUserId = 'user-123';
export const mockOtherUserId = 'user-456';

export function createMockEpisodeSearchResult(
    overrides: Partial<EpisodeSearchResult> = {},
): EpisodeSearchResult {
    return {
        id: overrides.id || `episode-${Date.now()}`,
        title: overrides.title || 'Test Episode',
        description: overrides.description || 'A test episode description',
        duration: overrides.duration || 1800,
        isPublic: overrides.isPublic ?? true,
        playCount: overrides.playCount || 100,
        createdAt: overrides.createdAt || new Date(),
        podcaster: overrides.podcaster || {
            id: 'podcaster-123',
            name: 'Test Podcaster',
            profilePictureUrl: 'https://example.com/profile.jpg',
        },
        book: overrides.book || {
            id: 'book-123',
            title: 'Test Book',
            author: 'Test Author',
            coverImageUrl: 'https://example.com/cover.jpg',
        },
    };
}

export function createMockBookSearchResult(
    overrides: Partial<BookSearchResult> = {},
): BookSearchResult {
    return {
        id: overrides.id || `book-${Date.now()}`,
        title: overrides.title || 'Test Book',
        author: overrides.author || 'Test Author',
        coverImageUrl: overrides.coverImageUrl || 'https://example.com/cover.jpg',
        language: overrides.language || 'en',
        pageCount: overrides.pageCount || 250,
        createdAt: overrides.createdAt || new Date(),
    };
}

export function createMockPodcasterSearchResult(
    overrides: Partial<PodcasterSearchResult> = {},
): PodcasterSearchResult {
    return {
        id: overrides.id || `podcaster-${Date.now()}`,
        name: overrides.name || 'Test Podcaster',
        description: overrides.description || 'A test podcaster description',
        profilePictureUrl: overrides.profilePictureUrl || 'https://example.com/profile.jpg',
        isPublic: overrides.isPublic ?? true,
        playCount: overrides.playCount || 500,
        averageRating: overrides.averageRating || 4.5,
        ratingCount: overrides.ratingCount || 25,
        expertiseTags: overrides.expertiseTags || ['Philosophy', 'Science'],
        creator: overrides.creator || {
            id: 'user-123',
            firstName: 'John',
            lastName: 'Doe',
        },
    };
}

export function createMockEpisodeList(count: number): EpisodeSearchResult[] {
    return Array.from({ length: count }, (_, i) =>
        createMockEpisodeSearchResult({
            id: `episode-${i + 1}`,
            title: `Episode ${i + 1}`,
            playCount: 100 - i * 10,
        }),
    );
}

export function createMockBookList(count: number): BookSearchResult[] {
    return Array.from({ length: count }, (_, i) =>
        createMockBookSearchResult({
            id: `book-${i + 1}`,
            title: `Book ${i + 1}`,
        }),
    );
}

export function createMockPodcasterList(count: number): PodcasterSearchResult[] {
    return Array.from({ length: count }, (_, i) =>
        createMockPodcasterSearchResult({
            id: `podcaster-${i + 1}`,
            name: `Podcaster ${i + 1}`,
            playCount: 500 - i * 50,
        }),
    );
}

// Mock Prisma results (raw database format)
export function createMockPrismaEpisode(overrides: Partial<any> = {}) {
    return {
        id: overrides.id || 'episode-123',
        userId: overrides.userId || mockUserId,
        title: overrides.title || 'Test Episode',
        description: overrides.description || 'Test description',
        duration: overrides.duration || 1800,
        isPublic: overrides.isPublic ?? true,
        playCount: overrides.playCount || 100,
        generationStatus: overrides.generationStatus || 'COMPLETED',
        createdAt: overrides.createdAt || new Date(),
        podcaster: overrides.podcaster || {
            id: 'podcaster-123',
            name: 'Test Podcaster',
            profilePictureUrl: 'https://example.com/profile.jpg',
        },
        book: overrides.book || {
            id: 'book-123',
            title: 'Test Book',
            author: 'Test Author',
            coverImageUrl: 'https://example.com/cover.jpg',
        },
    };
}

export function createMockPrismaBook(overrides: Partial<any> = {}) {
    return {
        id: overrides.id || 'book-123',
        userId: overrides.userId || mockUserId,
        title: overrides.title || 'Test Book',
        author: overrides.author || 'Test Author',
        coverImageUrl: overrides.coverImageUrl || 'https://example.com/cover.jpg',
        language: overrides.language || 'en',
        pageCount: overrides.pageCount || 250,
        extractionStatus: overrides.extractionStatus || 'COMPLETED',
        createdAt: overrides.createdAt || new Date(),
    };
}

export function createMockPrismaPodcaster(overrides: Partial<any> = {}) {
    return {
        id: overrides.id || 'podcaster-123',
        userId: overrides.userId || mockUserId,
        name: overrides.name || 'Test Podcaster',
        description: overrides.description || 'Test description',
        profilePictureUrl: overrides.profilePictureUrl || 'https://example.com/profile.jpg',
        isPublic: overrides.isPublic ?? true,
        playCount: overrides.playCount || 500,
        averageRating: overrides.averageRating || 4.5,
        ratingCount: overrides.ratingCount || 25,
        expertiseTags: overrides.expertiseTags || ['Philosophy', 'Science'],
        createdAt: overrides.createdAt || new Date(),
        user: overrides.user || {
            id: 'user-123',
            firstName: 'John',
            lastName: 'Doe',
        },
    };
}
