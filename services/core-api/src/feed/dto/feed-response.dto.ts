import { EpisodeSectionId, BookSectionId, PodcasterSectionId, FeedTab } from './feed-query.dto';

/**
 * Episode item for feed display
 * Simplified version of EpisodeResponseDto for feed cards
 */
export class EpisodeFeedItem {
    id: string;
    title: string;
    description?: string;
    coverImageUrl?: string;
    duration?: number;
    playCount: number;
    likeCount: number;
    averageRating: number;
    ratingCount: number;
    createdAt: Date;

    // For continue listening section
    progressMs?: number;
    progressPercent?: number;
    lastPlayedAt?: Date;

    // Relations
    book?: {
        id: string;
        title: string;
        author?: string;
        coverImageUrl?: string;
    };

    podcaster?: {
        id: string;
        name: string;
        profilePictureUrl?: string;
    };

    creator?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

/**
 * Book item for feed display
 */
export class BookFeedItem {
    id: string;
    title: string;
    author?: string;
    coverImageUrl?: string;
    language?: string;
    pageCount?: number;
    createdAt: Date;

    // Computed for feed
    episodeCount?: number;
    totalPlayCount?: number;
}

/**
 * Podcaster item for feed display
 */
export class PodcasterFeedItem {
    id: string;
    name: string;
    bio?: string;
    profilePictureUrl?: string;
    voiceModel: string;
    expertiseTags: string[];
    playCount: number;
    likeCount: number;
    averageRating: number;
    ratingCount: number;
    createdAt: Date;

    creator?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

/**
 * Generic feed section structure
 */
export class FeedSection<T> {
    id: string;
    title: string;
    type: string;
    items: T[];
    hasMore: boolean;
    totalCount?: number;
}

/**
 * Episodes feed response
 */
export class EpisodesFeedResponse {
    tab: FeedTab.EPISODES;
    sections: FeedSection<EpisodeFeedItem>[];
}

/**
 * Books feed response
 */
export class BooksFeedResponse {
    tab: FeedTab.BOOKS;
    sections: FeedSection<BookFeedItem>[];
}

/**
 * Podcasters feed response
 */
export class PodcastersFeedResponse {
    tab: FeedTab.PODCASTERS;
    sections: FeedSection<PodcasterFeedItem>[];
}

/**
 * Union type for all feed responses
 */
export type FeedResponse = EpisodesFeedResponse | BooksFeedResponse | PodcastersFeedResponse;

/**
 * Section pagination response
 */
export class SectionPaginationResponse<T> {
    items: T[];
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
}

/**
 * Section titles mapping
 */
export const SECTION_TITLES = {
    // Episodes
    [EpisodeSectionId.CONTINUE_LISTENING]: 'Pick up where you left off',
    [EpisodeSectionId.POPULAR]: 'Popular Episodes',
    [EpisodeSectionId.LATEST]: 'Latest Releases',
    [EpisodeSectionId.TOP_RATED_EPISODES]: 'Top Rated',
    [EpisodeSectionId.QUICK_LISTENS]: 'Quick Listens',
    [EpisodeSectionId.DISCUSSIONS]: 'Debates & Discussions',

    // Books
    [BookSectionId.POPULAR_INSPIRATIONS]: 'Popular podcast inspirations',
    [BookSectionId.POPULAR_BOOKS]: 'Popular Books',
    [BookSectionId.LATEST_BOOKS]: 'Latest Books',

    // Podcasters
    [PodcasterSectionId.TRENDING]: 'Trending',
    [PodcasterSectionId.TOP_RATED]: 'Top Rated',
    [PodcasterSectionId.NEW_VOICES]: 'New Voices',
} as const;

/**
 * Feed configuration constants
 */
export const FEED_CONFIG = {
    // Continue listening constraints
    CONTINUE_LISTENING_MAX_ITEMS: 7,
    CONTINUE_LISTENING_MAX_DAYS: 30,
    CONTINUE_LISTENING_MIN_PROGRESS_PERCENT: 0,
    CONTINUE_LISTENING_MAX_PROGRESS_PERCENT: 95,

    // Default section item counts
    DEFAULT_SECTION_LIMIT: 10,

    // Episodes at or under this duration (seconds) qualify as "Quick Listens" (15 min)
    QUICK_LISTEN_MAX_SECONDS: 900,

    // Cache TTLs (in seconds)
    CACHE_TTL: {
        EPISODES_POPULAR: 300, // 5 minutes
        EPISODES_TOP_RATED: 600, // 10 minutes
        EPISODES_QUICK_LISTENS: 300, // 5 minutes
        EPISODES_DISCUSSIONS: 300, // 5 minutes
        EPISODES_LATEST: 120, // 2 minutes
        BOOKS_POPULAR: 600, // 10 minutes
        BOOKS_LATEST: 300, // 5 minutes
        PODCASTERS_TRENDING: 300, // 5 minutes
        PODCASTERS_TOP_RATED: 600, // 10 minutes
        PODCASTERS_NEW_VOICES: 300, // 5 minutes
        USER_CONTINUE: 60, // 1 minute
    },

    // Cache keys
    CACHE_KEYS: {
        EPISODES_POPULAR: 'feed:episodes:popular',
        EPISODES_TOP_RATED: 'feed:episodes:top_rated',
        EPISODES_QUICK_LISTENS: 'feed:episodes:quick_listens',
        EPISODES_DISCUSSIONS: 'feed:episodes:discussions',
        EPISODES_LATEST: 'feed:episodes:latest',
        BOOKS_POPULAR: 'feed:books:popular',
        BOOKS_INSPIRATIONS: 'feed:books:inspirations',
        BOOKS_LATEST: 'feed:books:latest',
        PODCASTERS_TRENDING: 'feed:podcasters:trending',
        PODCASTERS_TOP_RATED: 'feed:podcasters:top_rated',
        PODCASTERS_NEW_VOICES: 'feed:podcasters:new_voices',
        userContinue: (userId: string) => `feed:user:${userId}:continue`,
    },
} as const;
