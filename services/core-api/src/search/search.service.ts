import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
    SearchQueryDto,
    SearchScope,
    SearchResponseDto,
    ScopedSearchResponseDto,
    EpisodeSearchResult,
    BookSearchResult,
    PodcasterSearchResult,
} from './dto';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(private databaseService: DatabaseService) {}

    /**
     * Unified search across episodes, books, and podcasters
     * Returns grouped results for the "all" search scope
     */
    async search(
        query: SearchQueryDto,
        userId?: string,
    ): Promise<SearchResponseDto | ScopedSearchResponseDto> {
        const { q, scope, page, limit } = query;

        this.logger.log(
            `search() called: q="${q}", scope=${scope}, page=${page}, limit=${limit}, userId=${userId || 'anonymous'}`,
        );

        // Validate query
        const sanitizedQuery = this.sanitizeQuery(q);
        if (!sanitizedQuery) {
            this.logger.warn('Empty search query after sanitization');
            throw new BadRequestException('Search query cannot be empty');
        }

        try {
            if (scope === SearchScope.ALL) {
                return await this.searchAll(sanitizedQuery, userId, limit!);
            } else {
                return await this.searchScoped(sanitizedQuery, scope!, userId, page!, limit!);
            }
        } catch (error) {
            this.logger.error(`Error in search(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Search all categories and return grouped results
     */
    private async searchAll(
        query: string,
        userId: string | undefined,
        limit: number,
    ): Promise<SearchResponseDto> {
        this.logger.log(`searchAll() called: query="${query}", limit=${limit}`);

        // Run searches in parallel for performance
        const [episodes, books, podcasters] = await Promise.all([
            this.searchEpisodes(query, userId, 1, limit),
            this.searchBooks(query, userId, 1, limit),
            this.searchPodcasters(query, userId, 1, limit),
        ]);

        this.logger.log(
            `searchAll() results: episodes=${episodes.total}, books=${books.total}, podcasters=${podcasters.total}`,
        );

        return {
            query,
            episodes: {
                results: episodes.results,
                total: episodes.total,
                hasMore: episodes.total > limit,
            },
            books: {
                results: books.results,
                total: books.total,
                hasMore: books.total > limit,
            },
            podcasters: {
                results: podcasters.results,
                total: podcasters.total,
                hasMore: podcasters.total > limit,
            },
        };
    }

    /**
     * Search a specific category with pagination
     */
    private async searchScoped(
        query: string,
        scope: SearchScope,
        userId: string | undefined,
        page: number,
        limit: number,
    ): Promise<ScopedSearchResponseDto> {
        this.logger.log(
            `searchScoped() called: query="${query}", scope=${scope}, page=${page}, limit=${limit}`,
        );

        let searchResult: { results: any[]; total: number };

        switch (scope) {
            case SearchScope.EPISODES:
                searchResult = await this.searchEpisodes(query, userId, page, limit);
                break;
            case SearchScope.BOOKS:
                searchResult = await this.searchBooks(query, userId, page, limit);
                break;
            case SearchScope.PODCASTERS:
                searchResult = await this.searchPodcasters(query, userId, page, limit);
                break;
            default:
                throw new BadRequestException(`Invalid search scope: ${scope}`);
        }

        const totalPages = Math.ceil(searchResult.total / limit);

        this.logger.log(
            `searchScoped() results: total=${searchResult.total}, page=${page}/${totalPages}`,
        );

        return {
            query,
            scope,
            results: searchResult.results,
            total: searchResult.total,
            page,
            totalPages,
            hasMore: page < totalPages,
        };
    }

    /**
     * Search episodes by title, description, or podcaster name
     */
    private async searchEpisodes(
        query: string,
        userId: string | undefined,
        page: number,
        limit: number,
    ): Promise<{ results: EpisodeSearchResult[]; total: number }> {
        this.logger.log(`searchEpisodes() called: query="${query}", page=${page}, limit=${limit}`);

        const skip = (page - 1) * limit;

        // Build where clause - include public episodes and user's own episodes
        const where: any = {
            generationStatus: 'COMPLETED', // Only show completed episodes
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { podcaster: { name: { contains: query, mode: 'insensitive' } } },
                { book: { title: { contains: query, mode: 'insensitive' } } },
            ],
            AND: [
                {
                    OR: [
                        { isPublic: true },
                        ...(userId ? [{ userId }] : []),
                    ],
                },
            ],
        };

        const [episodes, total] = await Promise.all([
            this.databaseService.episode.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ playCount: 'desc' }, { createdAt: 'desc' }],
                include: {
                    podcaster: {
                        select: {
                            id: true,
                            name: true,
                            profilePictureUrl: true,
                        },
                    },
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true,
                            coverImageUrl: true,
                        },
                    },
                },
            }),
            this.databaseService.episode.count({ where }),
        ]);

        this.logger.log(`searchEpisodes() found ${total} episodes`);

        return {
            results: episodes.map((ep) => ({
                id: ep.id,
                title: ep.title,
                description: ep.description,
                duration: ep.duration,
                isPublic: ep.isPublic,
                playCount: ep.playCount,
                createdAt: ep.createdAt,
                podcaster: ep.podcaster,
                book: ep.book,
            })),
            total,
        };
    }

    /**
     * Search books by title or author
     */
    private async searchBooks(
        query: string,
        userId: string | undefined,
        page: number,
        limit: number,
    ): Promise<{ results: BookSearchResult[]; total: number }> {
        this.logger.log(`searchBooks() called: query="${query}", page=${page}, limit=${limit}`);

        const skip = (page - 1) * limit;

        // Books are private to users - only search user's own books if authenticated
        // If not authenticated, return empty results
        if (!userId) {
            this.logger.log('searchBooks() - no userId, returning empty results');
            return { results: [], total: 0 };
        }

        const where: any = {
            userId,
            extractionStatus: 'COMPLETED', // Only show successfully extracted books
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { author: { contains: query, mode: 'insensitive' } },
            ],
        };

        const [books, total] = await Promise.all([
            this.databaseService.book.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    author: true,
                    coverImageUrl: true,
                    language: true,
                    pageCount: true,
                    createdAt: true,
                },
            }),
            this.databaseService.book.count({ where }),
        ]);

        this.logger.log(`searchBooks() found ${total} books`);

        return { results: books, total };
    }

    /**
     * Search podcasters by name, description, or expertise tags
     */
    private async searchPodcasters(
        query: string,
        userId: string | undefined,
        page: number,
        limit: number,
    ): Promise<{ results: PodcasterSearchResult[]; total: number }> {
        this.logger.log(`searchPodcasters() called: query="${query}", page=${page}, limit=${limit}`);

        const skip = (page - 1) * limit;

        // Include public podcasters and user's own podcasters
        const where: any = {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { expertiseTags: { hasSome: [query] } },
            ],
            AND: [
                {
                    OR: [
                        { isPublic: true },
                        ...(userId ? [{ userId }] : []),
                    ],
                },
            ],
        };

        const [podcasters, total] = await Promise.all([
            this.databaseService.podcaster.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ playCount: 'desc' }, { averageRating: 'desc' }],
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            }),
            this.databaseService.podcaster.count({ where }),
        ]);

        this.logger.log(`searchPodcasters() found ${total} podcasters`);

        return {
            results: podcasters.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                profilePictureUrl: p.profilePictureUrl,
                isPublic: p.isPublic,
                playCount: p.playCount,
                averageRating: p.averageRating,
                ratingCount: p.ratingCount,
                expertiseTags: p.expertiseTags,
                creator: p.user,
            })),
            total,
        };
    }

    /**
     * Sanitize and validate search query
     */
    private sanitizeQuery(query: string): string {
        if (!query) return '';

        // Trim whitespace and limit length
        let sanitized = query.trim().slice(0, 100);

        // Remove special characters that could cause issues
        sanitized = sanitized.replace(/[<>{}[\]\\]/g, '');

        return sanitized;
    }

    /**
     * Get search suggestions based on partial query
     * Returns top matches from each category
     */
    async getSuggestions(
        partialQuery: string,
        userId?: string,
        limit: number = 5,
    ): Promise<{
        episodes: { id: string; title: string }[];
        books: { id: string; title: string }[];
        podcasters: { id: string; name: string }[];
    }> {
        this.logger.log(
            `getSuggestions() called: query="${partialQuery}", limit=${limit}`,
        );

        const sanitizedQuery = this.sanitizeQuery(partialQuery);
        if (!sanitizedQuery || sanitizedQuery.length < 2) {
            return { episodes: [], books: [], podcasters: [] };
        }

        try {
            const [episodes, books, podcasters] = await Promise.all([
                // Episode suggestions
                this.databaseService.episode.findMany({
                    where: {
                        generationStatus: 'COMPLETED',
                        title: { contains: sanitizedQuery, mode: 'insensitive' },
                        OR: [{ isPublic: true }, ...(userId ? [{ userId }] : [])],
                    },
                    take: limit,
                    select: { id: true, title: true },
                    orderBy: { playCount: 'desc' },
                }),
                // Book suggestions (only for authenticated users)
                userId
                    ? this.databaseService.book.findMany({
                          where: {
                              userId,
                              extractionStatus: 'COMPLETED',
                              title: { contains: sanitizedQuery, mode: 'insensitive' },
                          },
                          take: limit,
                          select: { id: true, title: true },
                          orderBy: { createdAt: 'desc' },
                      })
                    : [],
                // Podcaster suggestions
                this.databaseService.podcaster.findMany({
                    where: {
                        name: { contains: sanitizedQuery, mode: 'insensitive' },
                        OR: [{ isPublic: true }, ...(userId ? [{ userId }] : [])],
                    },
                    take: limit,
                    select: { id: true, name: true },
                    orderBy: { playCount: 'desc' },
                }),
            ]);

            this.logger.log(
                `getSuggestions() results: episodes=${episodes.length}, books=${books.length}, podcasters=${podcasters.length}`,
            );

            return { episodes, books, podcasters };
        } catch (error) {
            this.logger.error(`Error in getSuggestions(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }
}
