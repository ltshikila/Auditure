import { apiClient } from './api';

export type VoiceModel = 'CUSTOM' | 'CONVERSATIONAL' | 'ENERGETIC' | 'CALM' | 'SARCASTIC' | 'ACADEMIC';
export type Gender = 'MALE' | 'FEMALE';

export interface Podcaster {
  id: string;
  userId: string;
  name: string;
  description?: string;
  profilePictureUrl?: string;

  // Voice Configuration
  voiceModel: VoiceModel;
  gender: Gender;
  accent: string;
  speakingSpeed: number;
  vocalPitch: number;
  ageTone: number;
  sentenceStructure: number;
  emotionalExpression: number;

  // Core Personality Model
  tone: number;
  communicationStyle: number;
  humorLevel: number;
  conversationalDepth: number;
  chaosFactor: number;

  // Knowledge & Worldview
  expertiseTags: string[];
  intellectualAngle: string;
  viewpointBehavior: number;

  // Metadata
  isPublic: boolean;
  playCount: number;
  likeCount: number;
  shareCount: number;

  // Rating
  averageRating: number;
  ratingCount: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Optional creator info
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreatePodcasterDto {
  name: string;
  description?: string;
  profilePictureUrl?: string;
  voiceModel: VoiceModel;
  gender: Gender;
  accent: string;
  speakingSpeed: number;
  vocalPitch: number;
  ageTone: number;
  sentenceStructure: number;
  emotionalExpression: number;
  tone: number;
  communicationStyle: number;
  humorLevel: number;
  conversationalDepth: number;
  chaosFactor: number;
  expertiseTags: string[];
  intellectualAngle: string;
  viewpointBehavior: number;
  isPublic?: boolean;
}

export interface UpdatePodcasterDto extends Partial<CreatePodcasterDto> {}

export interface QueryPodcastersDto {
  sortBy?: 'POPULAR' | 'RECENT' | 'LIKED';
  page?: number;
  limit?: number;
  search?: string;
}

class PodcasterService {
  /**
   * Create a new podcaster
   */
  async create(podcasterData: CreatePodcasterDto, token: string): Promise<Podcaster> {
    return apiClient.post<Podcaster>('/podcasters', podcasterData, token);
  }

  /**
   * Get current user's podcasters
   */
  async getMyPodcasters(token: string): Promise<Podcaster[]> {
    return apiClient.get<Podcaster[]>('/podcasters/my', token);
  }

  /**
   * Get a specific podcaster by ID
   */
  async getPodcaster(id: string, token?: string): Promise<Podcaster> {
    return apiClient.get<Podcaster>(`/podcasters/${id}`, token);
  }

  /**
   * Get public podcasters with filtering
   */
  async getPublicPodcasters(query: QueryPodcastersDto = {}): Promise<Podcaster[]> {
    const params = new URLSearchParams();
    if (query.sortBy) params.append('sortBy', query.sortBy);
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.search) params.append('search', query.search);

    const endpoint = `/podcasters/public${params.toString() ? `?${params.toString()}` : ''}`;
    return apiClient.get<Podcaster[]>(endpoint);
  }

  /**
   * Get trending podcasters
   */
  async getTrending(limit: number = 10): Promise<Podcaster[]> {
    return apiClient.get<Podcaster[]>(`/podcasters/trending?limit=${limit}`);
  }

  /**
   * Get podcasters by expertise tag
   */
  async getByExpertise(tag: string, limit: number = 20): Promise<Podcaster[]> {
    return apiClient.get<Podcaster[]>(`/podcasters/expertise/${tag}?limit=${limit}`);
  }

  /**
   * Update a podcaster
   */
  async update(id: string, updateData: UpdatePodcasterDto, token: string): Promise<Podcaster> {
    return apiClient.patch<Podcaster>(`/podcasters/${id}`, updateData, token);
  }

  /**
   * Upload podcaster profile picture
   */
  async uploadProfilePicture(id: string, imageUri: string, token: string): Promise<Podcaster> {
    const formData = new FormData();
    const ext = imageUri.split('.').pop() || 'jpg';
    formData.append('file', {
      uri: imageUri,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      name: `profile-picture.${ext}`,
    } as any);
    return apiClient.uploadFormData<Podcaster>(`/podcasters/${id}/profile-picture`, formData, token);
  }

  /**
   * Remove podcaster profile picture
   */
  async removeProfilePicture(id: string, token: string): Promise<Podcaster> {
    return apiClient.delete<Podcaster>(`/podcasters/${id}/profile-picture`, token);
  }

  /**
   * Delete a podcaster
   */
  async delete(id: string, token: string): Promise<void> {
    return apiClient.delete<void>(`/podcasters/${id}`, token);
  }

  /**
   * Increment play count
   */
  async incrementPlayCount(id: string): Promise<void> {
    return apiClient.post<void>(`/podcasters/${id}/play`, {});
  }

  /**
   * Like a podcaster
   */
  async like(id: string, token: string): Promise<void> {
    return apiClient.post<void>(`/podcasters/${id}/like`, {}, token);
  }

  /**
   * Unlike a podcaster
   */
  async unlike(id: string, token: string): Promise<void> {
    return apiClient.delete<void>(`/podcasters/${id}/like`, token);
  }

  /**
   * Increment share count
   */
  async share(id: string): Promise<void> {
    return apiClient.post<void>(`/podcasters/${id}/share`, {});
  }

  /**
   * Rate a podcaster (1-5 stars)
   */
  async rate(id: string, rating: number, token: string): Promise<{ averageRating: number; ratingCount: number }> {
    return apiClient.post<{ averageRating: number; ratingCount: number }>(
      `/podcasters/${id}/rate`,
      { rating },
      token
    );
  }

  /**
   * Get user's rating for a podcaster
   */
  async getUserRating(id: string, token: string): Promise<number | null> {
    const result = await apiClient.get<{ rating: number | null }>(`/podcasters/${id}/rating`, token);
    return result.rating;
  }
}

export const podcasterService = new PodcasterService();
