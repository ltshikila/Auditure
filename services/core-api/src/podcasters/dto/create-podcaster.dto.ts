import {
    IsString,
    IsEnum,
    IsInt,
    IsArray,
    IsOptional,
    Min,
    Max,
    ArrayMinSize,
    ArrayMaxSize,
    IsBoolean,
} from 'class-validator';

export enum VoiceModel {
    CUSTOM = 'CUSTOM',
    CONVERSATIONAL = 'CONVERSATIONAL',
    ENERGETIC = 'ENERGETIC',
    CALM = 'CALM',
    SARCASTIC = 'SARCASTIC',
    ACADEMIC = 'ACADEMIC',
}

export enum Gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
}

export class CreatePodcasterDto {
    // Core Identity
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    profilePictureUrl?: string;

    // Voice Configuration
    @IsEnum(VoiceModel)
    voiceModel: VoiceModel;

    @IsEnum(Gender)
    gender: Gender;

    @IsString()
    accent: string;

    @IsInt()
    @Min(1)
    @Max(10)
    speakingSpeed: number;

    @IsInt()
    @Min(1)
    @Max(10)
    vocalPitch: number;

    @IsInt()
    @Min(1)
    @Max(10)
    ageTone: number;

    @IsInt()
    @Min(1)
    @Max(10)
    sentenceStructure: number;

    @IsInt()
    @Min(1)
    @Max(10)
    emotionalExpression: number;

    // Core Personality Model
    @IsInt()
    @Min(1)
    @Max(10)
    tone: number;

    @IsInt()
    @Min(1)
    @Max(10)
    communicationStyle: number;

    @IsInt()
    @Min(1)
    @Max(10)
    humorLevel: number;

    @IsInt()
    @Min(1)
    @Max(10)
    conversationalDepth: number;

    @IsInt()
    @Min(1)
    @Max(10)
    chaosFactor: number;

    // Knowledge & Worldview
    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(1)
    @ArrayMaxSize(3)
    expertiseTags: string[];

    @IsString()
    intellectualAngle: string;

    @IsInt()
    @Min(1)
    @Max(10)
    viewpointBehavior: number;

    // Metadata
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;
}
