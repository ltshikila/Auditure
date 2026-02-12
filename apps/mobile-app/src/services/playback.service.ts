import { apiClient } from './api';
import { episodeService } from './episode.service';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface PlaybackProgress {
    position: number;
}

export interface GenerationProgress {
    progress: number;
    status: string;
    updatedAt: string;
}

class PlaybackService {
    /**
     * Get a signed streaming URL for an episode from the API.
     * Returns a GCS signed URL that the player can fetch directly.
     */
    async getStreamUrl(episodeId: string, token?: string): Promise<string> {
        try {
            const result = await apiClient.get<{ url: string }>(`/episodes/${episodeId}/stream-url`, token);
            return result.url;
        } catch {
            // Fallback to legacy proxy stream
            return `${API_BASE_URL}/episodes/${episodeId}/stream`;
        }
    }

    /**
     * Get the legacy proxy streaming URL (fallback)
     */
    getLegacyStreamUrl(episodeId: string): string {
        return `${API_BASE_URL}/episodes/${episodeId}/stream`;
    }

    /**
     * Save playback progress to the server
     */
    async saveProgress(episodeId: string, positionMs: number, token: string): Promise<void> {
        return apiClient.post<void>(`/episodes/${episodeId}/progress`, { position: positionMs }, token);
    }

    /**
     * Get playback progress from the server
     */
    async getProgress(episodeId: string, token: string): Promise<PlaybackProgress | null> {
        try {
            return await apiClient.get<PlaybackProgress>(`/episodes/${episodeId}/progress`, token);
        } catch {
            return null;
        }
    }

    /**
     * Get episode generation progress (for in-progress episodes)
     */
    async getGenerationProgress(episodeId: string, token?: string): Promise<GenerationProgress | null> {
        try {
            return await apiClient.get<GenerationProgress>(`/episodes/${episodeId}/generation-progress`, token);
        } catch {
            return null;
        }
    }

    /**
     * Increment play count when playback starts
     */
    async incrementPlayCount(episodeId: string): Promise<void> {
        return episodeService.incrementPlayCount(episodeId);
    }
}

export const playbackService = new PlaybackService();
