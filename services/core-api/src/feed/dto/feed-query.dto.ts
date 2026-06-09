import { IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Feed tab types - determines which content category to display
 */
export enum FeedTab {
    EPISODES = 'episodes',
    BOOKS = 'books',
    PODCASTERS = 'podcasters',
}

/**
 * Section identifiers for pagination
 */
export enum EpisodeSectionId {
    CONTINUE_LISTENING = 'continue_listening',
    POPULAR = 'popular',
    LATEST = 'latest',
    // Distinct string values so getSectionData() routes these to the episode handler
    // and not the podcaster TOP_RATED = 'top_rated'.
    TOP_RATED_EPISODES = 'top_rated_episodes',
    QUICK_LISTENS = 'quick_listens',
    DISCUSSIONS = 'discussions',
}

export enum BookSectionId {
    POPULAR_INSPIRATIONS = 'popular_inspirations',
    POPULAR_BOOKS = 'popular_books',
    LATEST_BOOKS = 'latest_books',
}

export enum PodcasterSectionId {
    TRENDING = 'trending',
    TOP_RATED = 'top_rated',
    NEW_VOICES = 'new_voices',
}

/**
 * Query parameters for the main feed endpoint
 * GET /feed?tab=episodes
 */
export class FeedQueryDto {
    @IsEnum(FeedTab)
    tab: FeedTab;
}

/**
 * Query parameters for section pagination
 * GET /feed/section/:sectionId?page=1&limit=20
 */
export class FeedSectionQueryDto {
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
    limit?: number = 20;
}
