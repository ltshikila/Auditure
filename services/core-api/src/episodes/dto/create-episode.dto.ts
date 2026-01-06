import {
    IsString,
    IsEnum,
    IsInt,
    IsArray,
    IsOptional,
    Min,
    Max,
    ArrayMinSize,
    IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum EpisodeType {
    MONOLOGUE = 'MONOLOGUE',
    DUO = 'DUO',
    GROUP = 'GROUP',
}

export enum EpisodeTheme {
    LECTURE = 'LECTURE',
    DISCUSSION = 'DISCUSSION',
    DEBATE = 'DEBATE',
}

export enum ContentCoverage {
    ENTIRE_BOOK = 'ENTIRE_BOOK',
    MULTIPLE_CHAPTERS = 'MULTIPLE_CHAPTERS',
    SINGLE_CHAPTER = 'SINGLE_CHAPTER',
}

export enum VoiceTier {
    STANDARD = 'STANDARD',  // Google Cloud Standard voices - $4/1M chars
    NEURAL = 'NEURAL',      // Google Cloud Neural2 voices - $16/1M chars
}

export class CreateEpisodeDto {
    @IsUUID()
    bookId: string;

    @IsUUID()
    podcasterId: string;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(ContentCoverage)
    contentCoverage: ContentCoverage;

    @IsArray()
    @IsInt({ each: true })
    @ArrayMinSize(0)
    chapters: number[];

    @IsEnum(EpisodeType)
    episodeType: EpisodeType;

    @IsEnum(EpisodeTheme)
    episodeTheme: EpisodeTheme;

    @IsInt()
    @Min(5)
    @Max(30)
    targetLengthMin: number;

    @IsInt()
    @Min(5)
    @Max(30)
    targetLengthMax: number;

    @IsOptional()
    @IsEnum(VoiceTier)
    voiceTier?: VoiceTier;
}

/**
 * DTO for creating an episode with a file upload.
 * The file will be processed to create a book, then the episode will be generated.
 */
export class CreateEpisodeWithFileDto {
    @IsUUID()
    podcasterId: string;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(ContentCoverage)
    contentCoverage: ContentCoverage;

    @IsOptional()
    @IsArray()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return value.split(',').map((v) => parseInt(v.trim(), 10));
            }
        }
        return value;
    })
    @IsInt({ each: true })
    chapters?: number[];

    @IsEnum(EpisodeType)
    episodeType: EpisodeType;

    @IsEnum(EpisodeTheme)
    episodeTheme: EpisodeTheme;

    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(5)
    @Max(30)
    targetLengthMin: number;

    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(5)
    @Max(30)
    targetLengthMax: number;

    @IsOptional()
    @IsEnum(VoiceTier)
    voiceTier?: VoiceTier;
}
