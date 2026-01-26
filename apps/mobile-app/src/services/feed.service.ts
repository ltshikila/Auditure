import { apiClient } from './api';

// ============================================
// Feed Types
// ============================================

export type FeedTab = 'episodes' | 'books' | 'podcasters';

export type EpisodeSectionId = 'continue_listening' | 'popular' | 'latest' | 'recommended';
export type BookSectionId = 'popular_inspirations' | 'popular_books' | 'latest_books' | 'bestsellers';
export type PodcasterSectionId = 'trending' | 'top_rated' | 'new_voices';
export type SectionId = EpisodeSectionId | BookSectionId | PodcasterSectionId;

export interface EpisodeFeedItem {
    id: string;
    title: string;
    description?: string;
    coverImageUrl?: string;
    duration?: number;
    playCount: number;
    likeCount: number;
    createdAt: string;

    // For continue listening section
    progressMs?: number;
    progressPercent?: number;
    lastPlayedAt?: string;

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

export interface BookFeedItem {
    id: string;
    title: string;
    author?: string;
    coverImageUrl?: string;
    language?: string;
    pageCount?: number;
    createdAt: string;
    episodeCount?: number;
    totalPlayCount?: number;
}

export interface PodcasterFeedItem {
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
    createdAt: string;

    creator?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

export type FeedItem = EpisodeFeedItem | BookFeedItem | PodcasterFeedItem;

export interface FeedSection<T = FeedItem> {
    id: string;
    title: string;
    type: string;
    items: T[];
    hasMore: boolean;
    totalCount?: number;
}

export interface EpisodesFeedResponse {
    tab: 'episodes';
    sections: FeedSection<EpisodeFeedItem>[];
}

export interface BooksFeedResponse {
    tab: 'books';
    sections: FeedSection<BookFeedItem>[];
}

export interface PodcastersFeedResponse {
    tab: 'podcasters';
    sections: FeedSection<PodcasterFeedItem>[];
}

export type FeedResponse = EpisodesFeedResponse | BooksFeedResponse | PodcastersFeedResponse;

export interface SectionPaginationResponse<T> {
    items: T[];
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
}

// ============================================
// Feed Service
// ============================================

class FeedService {
    /**
     * Get feed for a specific tab
     */
    async getFeed(tab: FeedTab, token: string): Promise<FeedResponse> {
        return apiClient.get<FeedResponse>(`/feed?tab=${tab}`, token);
    }

    /**
     * Get episodes feed
     */
    async getEpisodesFeed(token: string): Promise<EpisodesFeedResponse> {
        return apiClient.get<EpisodesFeedResponse>('/feed?tab=episodes', token);
    }

    /**
     * Get books feed
     */
    async getBooksFeed(token: string): Promise<BooksFeedResponse> {
        return apiClient.get<BooksFeedResponse>('/feed?tab=books', token);
    }

    /**
     * Get podcasters feed
     */
    async getPodcastersFeed(token: string): Promise<PodcastersFeedResponse> {
        return apiClient.get<PodcastersFeedResponse>('/feed?tab=podcasters', token);
    }

    /**
     * Get paginated section data for "See All" functionality
     */
    async getSectionData<T = FeedItem>(
        sectionId: SectionId,
        token: string,
        page: number = 1,
        limit: number = 20
    ): Promise<SectionPaginationResponse<T>> {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        return apiClient.get<SectionPaginationResponse<T>>(
            `/feed/section/${sectionId}?${params.toString()}`,
            token
        );
    }

    /**
     * Get continue listening episodes
     */
    async getContinueListening(token: string, page: number = 1, limit: number = 20): Promise<SectionPaginationResponse<EpisodeFeedItem>> {
        return this.getSectionData<EpisodeFeedItem>('continue_listening', token, page, limit);
    }

    /**
     * Get popular episodes
     */
    async getPopularEpisodes(token: string, page: number = 1, limit: number = 20): Promise<SectionPaginationResponse<EpisodeFeedItem>> {
        return this.getSectionData<EpisodeFeedItem>('popular', token, page, limit);
    }

    /**
     * Get latest episodes
     */
    async getLatestEpisodes(token: string, page: number = 1, limit: number = 20): Promise<SectionPaginationResponse<EpisodeFeedItem>> {
        return this.getSectionData<EpisodeFeedItem>('latest', token, page, limit);
    }

    /**
     * Get trending podcasters
     */
    async getTrendingPodcasters(token: string, page: number = 1, limit: number = 20): Promise<SectionPaginationResponse<PodcasterFeedItem>> {
        return this.getSectionData<PodcasterFeedItem>('trending', token, page, limit);
    }

    /**
     * Get popular books
     */
    async getPopularBooks(token: string, page: number = 1, limit: number = 20): Promise<SectionPaginationResponse<BookFeedItem>> {
        return this.getSectionData<BookFeedItem>('popular_books', token, page, limit);
    }
}

export const feedService = new FeedService();
