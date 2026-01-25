export interface EpisodeSearchResult {
    id: string;
    title: string;
    description: string | null;
    duration: number | null;
    isPublic: boolean;
    playCount: number;
    createdAt: Date;
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
    createdAt: Date;
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

export interface SearchResponseDto {
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

export interface ScopedSearchResponseDto {
    query: string;
    scope: string;
    results: EpisodeSearchResult[] | BookSearchResult[] | PodcasterSearchResult[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
}
