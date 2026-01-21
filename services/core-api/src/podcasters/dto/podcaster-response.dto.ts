import { VoiceModel, Gender } from './create-podcaster.dto';

export class PodcasterResponseDto {
    id: string;
    userId: string;

    // Core Identity
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
    createdAt: Date;
    updatedAt: Date;

    // Optional user info (for public podcasters)
    creator?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}
