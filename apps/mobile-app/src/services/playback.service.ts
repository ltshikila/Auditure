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
     * Get the streaming URL for an episode
     */
    getStreamUrl(episodeId: string): string {
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
