// Test fixtures for episode data
import { randomUUID } from 'crypto';
import {
    ContentCoverage,
    EpisodeType,
    EpisodeTheme,
} from '../../src/episodes/dto/create-episode.dto';
import { EpisodeStatus } from '../../src/episodes/dto/episode-response.dto';

export const createMockEpisode = (overrides = {}) => ({
    id: randomUUID(),
    userId: randomUUID(),
    podcasterId: randomUUID(),
    bookId: randomUUID(),
    title: 'Test Episode',
    description: 'Test episode description',
    contentCoverage: ContentCoverage.ENTIRE_BOOK,
    chapters: [],
    episodeType: EpisodeType.MONOLOGUE,
    episodeTheme: EpisodeTheme.LECTURE,
    targetLengthMin: 15,
    targetLengthMax: 25,
    scriptContent: null,
    audioFileKey: null,
    generationStatus: EpisodeStatus.PENDING,
    scriptGeneratedAt: null,
    audioGeneratedAt: null,
    generationError: null,
    duration: null,
    audioFormat: null,
    isPublic: false,
    playCount: 0,
    likeCount: 0,
    shareCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

export const createCompletedMockEpisode = (overrides = {}) =>
    createMockEpisode({
        generationStatus: EpisodeStatus.COMPLETED,
        scriptContent: 'This is the generated script content.',
        audioFileKey: 'user-id/episode-id/audio.mp3',
        scriptGeneratedAt: new Date(),
        audioGeneratedAt: new Date(),
        duration: 1200,
        audioFormat: 'mp3',
        ...overrides,
    });

export const createPublicMockEpisode = (overrides = {}) =>
    createCompletedMockEpisode({
        isPublic: true,
        playCount: 100,
        likeCount: 25,
        shareCount: 10,
        ...overrides,
    });

export const createMockPodcaster = (overrides = {}) => ({
    id: randomUUID(),
    userId: randomUUID(),
    name: 'Test Podcaster',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    bio: 'Test podcaster bio',
    gender: 'MALE',
    accent: 'United States',
    speakingSpeed: 5,
    vocalPitch: 5,
    tone: 5,
    communicationStyle: 'storytelling',
    humorLevel: 5,
    conversationalDepth: 5,
    chaosFactor: 3,
    intellectualAngle: 5,
    expertiseTags: ['philosophy', 'science'],
    isPublic: false,
    followerCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

export const mockCreateEpisodeDto = {
    bookId: randomUUID(),
    podcasterId: randomUUID(),
    title: 'Test Episode',
    description: 'Test episode description',
    contentCoverage: ContentCoverage.ENTIRE_BOOK,
    chapters: [],
    episodeType: EpisodeType.MONOLOGUE,
    episodeTheme: EpisodeTheme.LECTURE,
    targetLengthMin: 15,
    targetLengthMax: 25,
};

export const mockAudioBuffer = Buffer.alloc(1024 * 100, 0); // 100KB mock audio file
