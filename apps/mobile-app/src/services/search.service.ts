import { apiClient } from './api';

export type SearchScope = 'all' | 'episodes' | 'books' | 'podcasters';

export interface EpisodeSearchResult {
    id: string;
    title: string;
    description: string | null;
    duration: number | null;
    isPublic: boolean;
    playCount: number;
    createdAt: string;
    podcaster: {
        id: string;
        name: string;
        profilePictureUrl: string | null;
    };
    book: {
        id: string;
        title: string;
        author: string | null;
        coverImageUrl: string | null;
    };
}

export interface BookSearchResult {
    id: string;
    title: string;
    author: string | null;
    coverImageUrl: string | null;
    language: string;
    pageCount: number | null;
    createdAt: string;
}

export interface PodcasterSearchResult {
    id: string;
    name: string;
    description: string | null;
    profilePictureUrl: string | null;
    isPublic: boolean;
    playCount: number;
    averageRating: number;
    ratingCount: number;
    expertiseTags: string[];
    creator?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

export interface SearchAllResponse {
    query: string;
    episodes: {
        results: EpisodeSearchResult[];
        total: number;
        hasMore: boolean;
    };
    books: {
        results: BookSearchResult[];
        total: number;
        hasMore: boolean;
    };
    podcasters: {
        results: PodcasterSearchResult[];
        total: number;
        hasMore: boolean;
    };
}

export interface SearchScopedResponse {
    query: string;
    scope: string;
    results: EpisodeSearchResult[] | BookSearchResult[] | PodcasterSearchResult[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
}

export interface SearchSuggestionsResponse {
    episodes: { id: string; title: string }[];
    books: { id: string; title: string }[];
    podcasters: { id: string; name: string }[];
}

export interface SearchQueryParams {
    q: string;
    scope?: SearchScope;
    page?: number;
    limit?: number;
}

class SearchService {
    /**
     * Search across all categories (episodes, books, podcasters)
     * Returns grouped results
     */
    async searchAll(
        query: string,
        token?: string,
        limit: number = 10
    ): Promise<SearchAllResponse> {
        const queryParams = new URLSearchParams({
            q: query,
            scope: 'all',
            limit: limit.toString(),
        });

        return apiClient.get<SearchAllResponse>(
            `/search?${queryParams.toString()}`,
            token
        );
    }

    /**
     * Search within a specific category with pagination
     */
    async searchScoped(
        query: string,
        scope: SearchScope,
        page: number = 1,
        limit: number = 20,
        token?: string
    ): Promise<SearchScopedResponse> {
        const queryParams = new URLSearchParams({
            q: query,
            scope,
            page: page.toString(),
            limit: limit.toString(),
        });

        return apiClient.get<SearchScopedResponse>(
            `/search?${queryParams.toString()}`,
            token
        );
    }

    /**
     * Search episodes only
     */
    async searchEpisodes(
        query: string,
        page: number = 1,
        limit: number = 20,
        token?: string
    ): Promise<SearchScopedResponse> {
        return this.searchScoped(query, 'episodes', page, limit, token);
    }

    /**
     * Search books only (requires authentication)
     */
    async searchBooks(
        query: string,
        page: number = 1,
        limit: number = 20,
        token: string
    ): Promise<SearchScopedResponse> {
        return this.searchScoped(query, 'books', page, limit, token);
    }

    /**
     * Search podcasters only
     */
    async searchPodcasters(
        query: string,
        page: number = 1,
        limit: number = 20,
        token?: string
    ): Promise<SearchScopedResponse> {
        return this.searchScoped(query, 'podcasters', page, limit, token);
    }

    /**
     * Get search suggestions for autocomplete
     * Returns quick suggestions from all categories
     */
    async getSuggestions(
        query: string,
        limit: number = 5,
        token?: string
    ): Promise<SearchSuggestionsResponse> {
        const queryParams = new URLSearchParams({
            q: query,
            limit: limit.toString(),
        });

        return apiClient.get<SearchSuggestionsResponse>(
            `/search/suggestions?${queryParams.toString()}`,
            token
        );
    }
}

export const searchService = new SearchService();
