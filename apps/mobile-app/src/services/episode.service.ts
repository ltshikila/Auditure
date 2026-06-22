import { apiClient } from './api';

export type EpisodeType = 'MONOLOGUE' | 'DUO';
export type EpisodeTheme = 'LECTURE' | 'DISCUSSION' | 'DEBATE';
export type ContentCoverage = 'ENTIRE_BOOK' | 'MULTIPLE_CHAPTERS' | 'SINGLE_CHAPTER';
export type EpisodeStatus = 'PENDING' | 'SCRIPT_GENERATING' | 'SCRIPT_GENERATED' | 'AUDIO_GENERATING' | 'COMPLETED' | 'FAILED';
export type VoiceTier = 'STANDARD' | 'GEMINI';

/** One spoken line with its start/end time in the audio (seconds). */
export interface TranscriptSegment {
    text: string;
    start: number;
    end: number;
}

export interface Episode {
    id: string;
    userId: string;
    podcasterId: string;
    bookId: string;
    title: string;
    description?: string;
    summary?: string;
    contentCoverage: ContentCoverage;
    chapters: number[];
    episodeType: EpisodeType;
    episodeTheme: EpisodeTheme;
    targetLengthMin: number;
    targetLengthMax: number;
    voiceTier: VoiceTier;
    scriptContent?: string;
    audioFileKey?: string;
    transcriptSegments?: TranscriptSegment[];
    generationStatus: EpisodeStatus;
    scriptGeneratedAt?: string;
    audioGeneratedAt?: string;
    generationError?: string;
    duration?: number;
    audioFormat?: string;
    isPublic: boolean;
    playCount: number;
    likeCount: number;
    shareCount: number;
    averageRating: number;
    ratingCount: number;
    createdAt: string;
    updatedAt: string;

    // Relations (when populated)
    podcaster?: {
        id: string;
        name: string;
        profilePictureUrl?: string;
    };
    book?: {
        id: string;
        title: string;
        author?: string;
        coverImageUrl?: string;
        language?: string;
    };
}

export interface EpisodeComment {
    id: string;
    episodeId: string;
    userId: string;
    content: string;
    parentCommentId: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        profilePictureUrl: string | null;
    };
}

export interface AuthorInfo {
    name: string;
    bio?: string;
    birthDate?: string;
    deathDate?: string;
    photoUrl?: string;
    wikipedia?: string;
    works?: number;
}

export interface CreateEpisodeDto {
    bookId: string;
    podcasterId: string;
    title: string;
    description?: string;
    editorNotes?: string;
    contentCoverage: ContentCoverage;
    chapters: number[];
    episodeType: EpisodeType;
    episodeTheme: EpisodeTheme;
    targetLengthMin: number;
    targetLengthMax: number;
    voiceTier?: VoiceTier;
}

export interface CreateEpisodeWithFileDto {
    podcasterId: string;
    title: string;
    description?: string;
    editorNotes?: string;
    contentCoverage: ContentCoverage;
    chapters?: number[];
    episodeType: EpisodeType;
    episodeTheme: EpisodeTheme;
    targetLengthMin: number;
    targetLengthMax: number;
    voiceTier?: VoiceTier;
}

export interface FileUpload {
    uri: string;
    name: string;
    type: string;
}

export interface QueryEpisodesDto {
    sortBy?: 'POPULAR' | 'RECENT' | 'TRENDING';
    episodeType?: EpisodeType;
    episodeTheme?: EpisodeTheme;
    status?: EpisodeStatus;
    page?: number;
    limit?: number;
}

class EpisodeService {
    /**
     * Create a new episode (triggers generation pipeline)
     */
    async create(episodeData: CreateEpisodeDto, token: string): Promise<Episode> {
        return apiClient.post<Episode>('/episodes', episodeData, token);
    }

    /**
     * Update an episode (title, description, etc.)
     */
    async update(id: string, data: { title?: string; description?: string }, token: string): Promise<Episode> {
        return apiClient.patch<Episode>(`/episodes/${id}`, data, token);
    }

    /**
     * Create a new episode with file upload
     * Uploads a book file (PDF/EPUB), extracts text, and creates an episode
     */
    async createWithFile(
        file: FileUpload,
        episodeData: CreateEpisodeWithFileDto,
        token: string,
        onProgress?: (progress: number) => void
    ): Promise<Episode> {
        console.log('[EpisodeService] createWithFile called');
        console.log('[EpisodeService] File URI:', file.uri);
        console.log('[EpisodeService] File name:', file.name);
        console.log('[EpisodeService] File type:', file.type);

        const formData = new FormData();

        // React Native FormData requires this specific format for file uploads
        // The uri must be a valid file:// or content:// URI
        formData.append('file', {
            uri: file.uri,
            name: file.name,
            type: file.type,
        } as any);

        console.log('[EpisodeService] File appended to FormData');

        formData.append('podcasterId', episodeData.podcasterId);
        formData.append('title', episodeData.title);
        formData.append('contentCoverage', episodeData.contentCoverage);
        formData.append('episodeType', episodeData.episodeType);
        formData.append('episodeTheme', episodeData.episodeTheme);
        formData.append('targetLengthMin', episodeData.targetLengthMin.toString());
        formData.append('targetLengthMax', episodeData.targetLengthMax.toString());

        if (episodeData.description) {
            formData.append('description', episodeData.description);
        }

        if (episodeData.editorNotes) {
            formData.append('editorNotes', episodeData.editorNotes);
        }

        if (episodeData.chapters && episodeData.chapters.length > 0) {
            formData.append('chapters', JSON.stringify(episodeData.chapters));
        }

        if (episodeData.voiceTier) {
            formData.append('voiceTier', episodeData.voiceTier);
        }

        console.log('[EpisodeService] All fields appended, calling API...');

        return apiClient.uploadFormData<Episode>('/episodes/with-file', formData, token, onProgress);
    }

    /**
     * Get current user's episodes
     */
    async getMyEpisodes(token: string): Promise<Episode[]> {
        return apiClient.get<Episode[]>('/episodes/my', token);
    }

    /**
     * Get a specific episode by ID
     */
    async getEpisode(id: string, token?: string): Promise<Episode> {
        return apiClient.get<Episode>(`/episodes/${id}`, token);
    }

    /**
     * Get public episodes with filtering
     */
    async getPublicEpisodes(query: QueryEpisodesDto = {}): Promise<Episode[]> {
        const params = new URLSearchParams();
        if (query.sortBy) params.append('sortBy', query.sortBy);
        if (query.episodeType) params.append('episodeType', query.episodeType);
        if (query.episodeTheme) params.append('episodeTheme', query.episodeTheme);
        if (query.page) params.append('page', query.page.toString());
        if (query.limit) params.append('limit', query.limit.toString());

        const endpoint = `/episodes/public${params.toString() ? `?${params.toString()}` : ''}`;
        return apiClient.get<Episode[]>(endpoint);
    }

    /**
     * Get trending episodes
     */
    async getTrending(limit: number = 10): Promise<Episode[]> {
        return apiClient.get<Episode[]>(`/episodes/trending?limit=${limit}`);
    }

    /**
     * Get episodes by podcaster
     */
    async getByPodcaster(podcasterId: string, limit: number = 20): Promise<Episode[]> {
        return apiClient.get<Episode[]>(`/episodes/podcaster/${podcasterId}?limit=${limit}`);
    }

    /**
     * Get episodes by book
     */
    async getByBook(bookId: string, limit: number = 20): Promise<Episode[]> {
        return apiClient.get<Episode[]>(`/episodes/book/${bookId}?limit=${limit}`);
    }

    /**
     * Delete an episode
     */
    async delete(id: string, token: string): Promise<void> {
        return apiClient.delete<void>(`/episodes/${id}`, token);
    }

    /**
     * Retry failed episode generation
     */
    async retry(id: string, token: string): Promise<Episode> {
        return apiClient.post<Episode>(`/episodes/${id}/retry`, {}, token);
    }

    /**
     * Publish episode (make public)
     */
    async publish(id: string, token: string): Promise<Episode> {
        return apiClient.post<Episode>(`/episodes/${id}/publish`, {}, token);
    }

    /**
     * Increment play count
     */
    async incrementPlayCount(id: string): Promise<void> {
        return apiClient.post<void>(`/episodes/${id}/play`, {});
    }

    /**
     * Like an episode
     */
    async like(id: string, token: string): Promise<void> {
        return apiClient.post<void>(`/episodes/${id}/like`, {}, token);
    }

    /**
     * Unlike an episode
     */
    async unlike(id: string, token: string): Promise<void> {
        return apiClient.delete<void>(`/episodes/${id}/like`, token);
    }

    /**
     * Get episodes liked by the current user
     */
    async getLikedEpisodes(token: string): Promise<Episode[]> {
        return apiClient.get<Episode[]>('/episodes/liked', token);
    }

    /**
     * Check if current user has liked an episode
     */
    async getLikeStatus(id: string, token: string): Promise<{ isLiked: boolean }> {
        return apiClient.get<{ isLiked: boolean }>(`/episodes/${id}/like-status`, token);
    }

    /**
     * Increment share count
     */
    async share(id: string): Promise<void> {
        return apiClient.post<void>(`/episodes/${id}/share`, {});
    }

    /**
     * Rate an episode (1-5 stars)
     */
    async rateEpisode(id: string, rating: number, token: string): Promise<{ averageRating: number; ratingCount: number; userRating: number }> {
        return apiClient.post(`/episodes/${id}/rate`, { rating }, token);
    }

    /**
     * Get user's rating for an episode
     */
    async getEpisodeRating(id: string, token: string): Promise<{ averageRating: number; ratingCount: number; userRating: number | null }> {
        return apiClient.get(`/episodes/${id}/rating`, token);
    }

    /**
     * Get comments for an episode
     */
    async getComments(id: string): Promise<EpisodeComment[]> {
        return apiClient.get<EpisodeComment[]>(`/episodes/${id}/comments`);
    }

    /**
     * Add a comment (or reply) to an episode. Pass parentCommentId to make it a reply.
     */
    async addComment(
        id: string,
        content: string,
        token: string,
        parentCommentId?: string,
    ): Promise<EpisodeComment> {
        return apiClient.post<EpisodeComment>(
            `/episodes/${id}/comments`,
            parentCommentId ? { content, parentCommentId } : { content },
            token,
        );
    }

    /**
     * Delete a comment
     */
    async deleteComment(commentId: string, token: string): Promise<void> {
        return apiClient.delete<void>(`/episodes/comments/${commentId}`, token);
    }

    /**
     * Get author info for an episode's book
     */
    async getAuthorInfo(id: string, token?: string): Promise<AuthorInfo | null> {
        return apiClient.get<AuthorInfo | null>(`/episodes/${id}/author-info`, token);
    }

    /**
     * Get a download URL for an episode (requires paid subscription)
     */
    async getDownloadUrl(id: string, token: string): Promise<{ downloadUrl?: string; format: string }> {
        return apiClient.get<{ downloadUrl?: string; format: string }>(`/episodes/${id}/download`, token);
    }
}

export const episodeService = new EpisodeService();
