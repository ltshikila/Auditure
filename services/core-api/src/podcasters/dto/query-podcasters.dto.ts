import { IsOptional, IsEnum, IsString, IsInt, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum PodcasterSortBy {
    RECENT = 'RECENT',
    POPULAR = 'POPULAR',
    MOST_LIKED = 'MOST_LIKED',
}

export class QueryPodcastersDto {
    @IsOptional()
    @IsEnum(PodcasterSortBy)
    sortBy?: PodcasterSortBy = PodcasterSortBy.RECENT;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    expertiseTags?: string[];

    @IsOptional()
    @IsString()
    gender?: string;

    @IsOptional()
    @IsString()
    voiceModel?: string;
}
