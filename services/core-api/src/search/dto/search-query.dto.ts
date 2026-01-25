import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchScope {
    ALL = 'all',
    EPISODES = 'episodes',
    BOOKS = 'books',
    PODCASTERS = 'podcasters',
}

export class SearchQueryDto {
    @IsString()
    q: string; // The search query

    @IsOptional()
    @IsEnum(SearchScope)
    scope?: SearchScope = SearchScope.ALL;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number = 10;
}
