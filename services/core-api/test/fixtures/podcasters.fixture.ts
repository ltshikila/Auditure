// Test fixtures for podcaster data
import { randomUUID } from 'crypto';
import { VoiceModel, Gender } from '../../src/podcasters/dto/create-podcaster.dto';

export const createMockPodcaster = (overrides = {}) => ({
    id: randomUUID(),
    userId: 'test-user-id',
    name: 'Philosophy Enthusiast',
    description: 'A thoughtful podcaster exploring deep philosophical questions',
    voiceModel: VoiceModel.CALM,
    gender: Gender.MALE,
    accent: 'United States',
    speakingSpeed: 5,
    vocalPitch: 5,
    vocabularyComplexity: 7,
    ageTone: 6,
    tone: 4,
    communicationStyle: 6,
    humorLevel: 3,
    conversationalDepth: 8,
    expertiseTags: ['Philosophy', 'History'],
    intellectualAngle: 'Skeptical',
    viewpointBehavior: 7,
    isPublic: false,
    playCount: 0,
    likeCount: 0,
    shareCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

export const createPublicMockPodcaster = (overrides = {}) =>
    createMockPodcaster({
        isPublic: true,
        playCount: 100,
        likeCount: 50,
        shareCount: 25,
        ...overrides,
    });

export const createTrendingMockPodcaster = (overrides = {}) =>
    createMockPodcaster({
        isPublic: true,
        playCount: 1000,
        likeCount: 500,
        shareCount: 200,
        updatedAt: new Date(), // Recent update
        ...overrides,
    });

export const mockCreatePodcasterDto = {
    name: 'Philosophy Enthusiast',
    description: 'A thoughtful podcaster exploring deep philosophical questions',
    voiceModel: VoiceModel.CALM,
    gender: Gender.MALE,
    accent: 'United States',
    speakingSpeed: 5,
    vocalPitch: 5,
    vocabularyComplexity: 7,
    ageTone: 6,
    tone: 4,
    communicationStyle: 6,
    humorLevel: 3,
    conversationalDepth: 8,
    expertiseTags: ['Philosophy', 'History'],
    intellectualAngle: 'Skeptical',
    viewpointBehavior: 7,
    isPublic: false,
};

export const mockUpdatePodcasterDto = {
    name: 'Updated Philosophy Enthusiast',
    description: 'Updated description',
    isPublic: true,
};

export const mockInvalidExpertiseTagsDto = {
    ...mockCreatePodcasterDto,
    expertiseTags: ['InvalidTag1', 'InvalidTag2'],
};

export const mockInvalidIntellectualAngleDto = {
    ...mockCreatePodcasterDto,
    intellectualAngle: 'InvalidAngle',
};

export const mockQueryPodcastersDto = {
    sortBy: 'RECENT',
    page: 1,
    limit: 20,
};
