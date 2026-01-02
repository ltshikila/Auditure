import { IsOptional, IsInt, IsEnum, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EpisodeType, EpisodeTheme } from './create-episode.dto';
import { EpisodeStatus } from './episode-response.dto';

export enum EpisodeSortBy {
    NEWEST = 'newest',
    POPULAR = 'popular',
    MOST_LIKED = 'most_liked',
}

export class QueryEpisodesDto {
    @IsOptional()
    @IsEnum(EpisodeSortBy)
    sortBy?: EpisodeSortBy;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(EpisodeType)
    episodeType?: EpisodeType;

    @IsOptional()
    @IsEnum(EpisodeTheme)
    episodeTheme?: EpisodeTheme;

    @IsOptional()
    @IsEnum(EpisodeStatus)
    status?: EpisodeStatus;

    @IsOptional()
    @IsString()
    podcasterId?: string;

    @IsOptional()
    @IsString()
    bookId?: string;
}
