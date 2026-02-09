import { apiClient } from './api';

// Types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  profilePictureUrl: string | null;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface UserSettings {
  theme: ThemePreference;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  profilePublic: boolean;
  showListeningActivity: boolean;
  autoPlayEnabled: boolean;
  playbackSpeed: number;
  downloadOverWifiOnly: boolean;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  privacyPolicyAcceptedAt: string | null;
  privacyPolicyVersion: string | null;
}

export interface UpdateSettingsData {
  theme?: ThemePreference;
  pushNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  marketingEmailsEnabled?: boolean;
  profilePublic?: boolean;
  showListeningActivity?: boolean;
  autoPlayEnabled?: boolean;
  playbackSpeed?: number;
  downloadOverWifiOnly?: boolean;
}

export type SubscriptionTier = 'FREE' | 'STARTER' | 'PRO';

export interface EpisodeUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface Subscription {
  tier: SubscriptionTier;
  isPaid: boolean;
  usage: {
    geminiEpisodes: EpisodeUsage;
    standardEpisodes: EpisodeUsage;
  };
  periodStart: string;
  premiumExpiresAt: string | null;
}

export interface DeleteAccountData {
  password: string;
}

class UserService {
  // Profile endpoints
  async getProfile(token: string): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/users/me', token);
  }

  async updateProfile(token: string, data: UpdateProfileData): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('/users/me', data, token);
  }

  async uploadProfilePicture(token: string, imageUri: string): Promise<UserProfile> {
    const formData = new FormData();
    const ext = imageUri.split('.').pop() || 'jpg';
    formData.append('file', {
      uri: imageUri,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      name: `profile-picture.${ext}`,
    } as any);
    return apiClient.uploadFormData<UserProfile>('/users/me/profile-picture', formData, token);
  }

  async removeProfilePicture(token: string): Promise<UserProfile> {
    return apiClient.delete<UserProfile>('/users/me/profile-picture', token);
  }

  async deleteAccount(token: string, data: DeleteAccountData): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>('/users/me', token, data);
  }

  // Settings endpoints
  async getSettings(token: string): Promise<UserSettings> {
    return apiClient.get<UserSettings>('/users/settings', token);
  }

  async updateSettings(token: string, data: UpdateSettingsData): Promise<UserSettings> {
    return apiClient.patch<UserSettings>('/users/settings', data, token);
  }

  // Subscription endpoints
  async getSubscription(token: string): Promise<Subscription> {
    return apiClient.get<Subscription>('/users/subscription', token);
  }

  // Logout endpoint
  async logout(token: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/users/logout', undefined, token);
  }
}

export const userService = new UserService();
