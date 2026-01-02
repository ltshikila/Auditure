import { EpisodeType, EpisodeTheme, ContentCoverage } from './create-episode.dto';

export enum EpisodeStatus {
    PENDING = 'PENDING',
    SCRIPT_GENERATING = 'SCRIPT_GENERATING',
    SCRIPT_GENERATED = 'SCRIPT_GENERATED',
    AUDIO_GENERATING = 'AUDIO_GENERATING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export class EpisodeResponseDto {
    id: string;
    userId: string;
    podcasterId: string;
    bookId: string;

    // Core Content
    title: string;
    description?: string;

    // Content Configuration
    contentCoverage: ContentCoverage;
    chapters: number[];
    episodeType: EpisodeType;
    episodeTheme: EpisodeTheme;
    targetLengthMin: number;
    targetLengthMax: number;

    // Generated Content
    scriptContent?: string;
    audioFileKey?: string;

    // Generation Status
    generationStatus: EpisodeStatus;
    scriptGeneratedAt?: Date;
    audioGeneratedAt?: Date;
    generationError?: string;

    // Audio Properties
    duration?: number;
    audioFormat?: string;

    // Metadata
    isPublic: boolean;
    playCount: number;
    likeCount: number;
    shareCount: number;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;

    // Optional relations
    creator?: {
        id: string;
        firstName: string;
        lastName: string;
    };

    podcaster?: {
        id: string;
        name: string;
        profilePictureUrl?: string;
    };

    book?: {
        id: string;
        title: string;
        author?: string;
    };
}
