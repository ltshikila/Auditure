import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { FeedTab, EpisodeSectionId, BookSectionId, PodcasterSectionId } from './dto/feed-query.dto';
import {
    EpisodeFeedItem,
    BookFeedItem,
    PodcasterFeedItem,
    FeedSection,
    EpisodesFeedResponse,
    BooksFeedResponse,
    PodcastersFeedResponse,
    FeedResponse,
    SectionPaginationResponse,
    SECTION_TITLES,
    FEED_CONFIG,
} from './dto/feed-response.dto';

@Injectable()
export class FeedService {
    private readonly logger = new Logger(FeedService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly redisService: RedisService,
    ) {}

    // ============================================
    // Main Feed Methods
    // ============================================

    /**
     * Get feed for a specific tab
     */
    async getFeed(tab: FeedTab, userId: string): Promise<FeedResponse> {
        this.logger.log(`getFeed() called for tab: ${tab}, userId: ${userId}`);

        try {
            switch (tab) {
                case FeedTab.EPISODES:
                    return this.getEpisodesFeed(userId);
                case FeedTab.BOOKS:
                    return this.getBooksFeed(userId);
                case FeedTab.PODCASTERS:
                    return this.getPodcastersFeed(userId);
                default:
                    this.logger.error(`Invalid tab: ${String(tab)}`);
                    throw new BadRequestException(`Invalid tab: ${String(tab)}`);
            }
        } catch (error) {
            this.logger.error(`Error in getFeed(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Get paginated section data for "See All" functionality
     */
    async getSectionData(
        sectionId: string,
        userId: string,
        page: number,
        limit: number,
    ): Promise<SectionPaginationResponse<EpisodeFeedItem | BookFeedItem | PodcasterFeedItem>> {
        this.logger.log(
            `getSectionData() called for section: ${sectionId}, page: ${page}, limit: ${limit}`,
        );

        try {
            const offset = (page - 1) * limit;

            // Episode sections
            if (Object.values(EpisodeSectionId).includes(sectionId as EpisodeSectionId)) {
                return this.getEpisodeSectionPaginated(
                    sectionId as EpisodeSectionId,
                    userId,
                    offset,
                    limit,
                    page,
                );
            }

            // Book sections
            if (Object.values(BookSectionId).includes(sectionId as BookSectionId)) {
                return this.getBookSectionPaginated(
                    sectionId as BookSectionId,
                    offset,
                    limit,
                    page,
                );
            }

            // Podcaster sections
            if (Object.values(PodcasterSectionId).includes(sectionId as PodcasterSectionId)) {
                return this.getPodcasterSectionPaginated(
                    sectionId as PodcasterSectionId,
                    offset,
                    limit,
                    page,
                );
            }

            throw new BadRequestException(`Invalid section ID: ${sectionId}`);
        } catch (error) {
            this.logger.error(`Error in getSectionData(): ${error.message}`);
            throw error;
        }
    }

    // ============================================
    // Episodes Feed
    // ============================================

    private async getEpisodesFeed(userId: string): Promise<EpisodesFeedResponse> {
        this.logger.log(`getEpisodesFeed() called for userId: ${userId}`);

        const [continueListening, popular, latest] = await Promise.all([
            this.getContinueListeningSection(userId),
            this.getPopularEpisodesSection(),
            this.getLatestEpisodesSection(),
        ]);

        // For MVP, recommended is same as popular (different instances)
        const recommended = await this.getRecommendedEpisodesSection();

        return {
            tab: FeedTab.EPISODES,
            sections: [continueListening, popular, latest, recommended].filter(
                section => section.items.length > 0,
            ),
        };
    }

    /**
     * Get "Continue Listening" section
     * Business rules:
     * - Max 7 episodes
     * - Started within last 30 days
     * - Progress > 0% and < 95%
     */
    private async getContinueListeningSection(
        userId: string,
    ): Promise<FeedSection<EpisodeFeedItem>> {
        this.logger.log(`getContinueListeningSection() called for userId: ${userId}`);

        try {
            // Check cache first
            const cacheKey = FEED_CONFIG.CACHE_KEYS.userContinue(userId);
            const cached = await this.getCachedData<EpisodeFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log(`Cache hit for continue listening: ${userId}`);
                return this.buildSection(
                    EpisodeSectionId.CONTINUE_LISTENING,
                    cached,
                    cached.length >= FEED_CONFIG.CONTINUE_LISTENING_MAX_ITEMS,
                );
            }

            // Get all playback progress for user from Redis
            const playbackProgress = await this.redisService.getAllPlaybackProgress(userId);
            const episodeIds = Object.keys(playbackProgress);

            if (episodeIds.length === 0) {
                this.logger.log(`No playback progress found for userId: ${userId}`);
                return this.buildSection(EpisodeSectionId.CONTINUE_LISTENING, [], false);
            }

            // Calculate date threshold (30 days ago)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(
                thirtyDaysAgo.getDate() - FEED_CONFIG.CONTINUE_LISTENING_MAX_DAYS,
            );

            // Fetch episodes with their metadata
            const episodes = await this.databaseService.episode.findMany({
                where: {
                    id: { in: episodeIds },
                    generationStatus: 'COMPLETED',
                    updatedAt: { gte: thirtyDaysAgo },
                },
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true,
                            coverImageUrl: true,
                        },
                    },
                    podcaster: {
                        select: {
                            id: true,
                            name: true,
                            profilePictureUrl: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            // Filter by progress percentage and map to feed items
            const items: EpisodeFeedItem[] = episodes
                .map(episode => {
                    const progressMs = playbackProgress[episode.id] || 0;
                    // Duration is stored in seconds, convert to milliseconds for comparison
                    const durationMs = (episode.duration || 1) * 1000;
                    const progressPercent = (progressMs / durationMs) * 100;

                    // Skip if progress is outside valid range
                    if (
                        progressPercent <= FEED_CONFIG.CONTINUE_LISTENING_MIN_PROGRESS_PERCENT ||
                        progressPercent >= FEED_CONFIG.CONTINUE_LISTENING_MAX_PROGRESS_PERCENT
                    ) {
                        return null;
                    }

                    return {
                        id: episode.id,
                        title: episode.title,
                        description: episode.description,
                        coverImageUrl: episode.book?.coverImageUrl,
                        duration: episode.duration,
                        playCount: episode.playCount,
                        likeCount: episode.likeCount,
                        createdAt: episode.createdAt,
                        progressMs,
                        progressPercent: Math.round(progressPercent),
                        book: episode.book,
                        podcaster: episode.podcaster,
                        creator: episode.user,
                    } as EpisodeFeedItem;
                })
                .filter((item): item is EpisodeFeedItem => item !== null)
                .sort((a, b) => (b.progressMs || 0) - (a.progressMs || 0)) // Sort by most recently played (highest progress first as proxy)
                .slice(0, FEED_CONFIG.CONTINUE_LISTENING_MAX_ITEMS);

            // Cache the result
            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.USER_CONTINUE);

            this.logger.log(`Found ${items.length} continue listening items for userId: ${userId}`);
            return this.buildSection(
                EpisodeSectionId.CONTINUE_LISTENING,
                items,
                items.length >= FEED_CONFIG.CONTINUE_LISTENING_MAX_ITEMS,
            );
        } catch (error) {
            this.logger.error(`Error in getContinueListeningSection(): ${error.message}`);
            return this.buildSection(EpisodeSectionId.CONTINUE_LISTENING, [], false);
        }
    }

    /**
     * Get "Popular Episodes" section
     */
    private async getPopularEpisodesSection(): Promise<FeedSection<EpisodeFeedItem>> {
        this.logger.log('getPopularEpisodesSection() called');

        try {
            const cacheKey = FEED_CONFIG.CACHE_KEYS.EPISODES_POPULAR;
            const cached = await this.getCachedData<EpisodeFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log('Cache hit for popular episodes');
                return this.buildSection(EpisodeSectionId.POPULAR, cached, true);
            }

            const episodes = await this.databaseService.episode.findMany({
                where: {
                    isPublic: true,
                    generationStatus: 'COMPLETED',
                },
                orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }],
                take: FEED_CONFIG.DEFAULT_SECTION_LIMIT,
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true,
                            coverImageUrl: true,
                        },
                    },
                    podcaster: {
                        select: {
                            id: true,
                            name: true,
                            profilePictureUrl: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            const items = this.mapEpisodesToFeedItems(episodes);
            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.EPISODES_POPULAR);

            this.logger.log(`Found ${items.length} popular episodes`);
            return this.buildSection(EpisodeSectionId.POPULAR, items, true);
        } catch (error) {
            this.logger.error(`Error in getPopularEpisodesSection(): ${error.message}`);
            return this.buildSection(EpisodeSectionId.POPULAR, [], false);
        }
    }

    /**
     * Get "Latest Releases" section
     */
    private async getLatestEpisodesSection(): Promise<FeedSection<EpisodeFeedItem>> {
        this.logger.log('getLatestEpisodesSection() called');

        try {
            const cacheKey = FEED_CONFIG.CACHE_KEYS.EPISODES_LATEST;
            const cached = await this.getCachedData<EpisodeFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log('Cache hit for latest episodes');
                return this.buildSection(EpisodeSectionId.LATEST, cached, true);
            }

            const episodes = await this.databaseService.episode.findMany({
                where: {
                    isPublic: true,
                    generationStatus: 'COMPLETED',
                },
                orderBy: { createdAt: 'desc' },
                take: FEED_CONFIG.DEFAULT_SECTION_LIMIT,
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true,
                            coverImageUrl: true,
                        },
                    },
                    podcaster: {
                        select: {
                            id: true,
                            name: true,
                            profilePictureUrl: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            const items = this.mapEpisodesToFeedItems(episodes);
            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.EPISODES_LATEST);

            this.logger.log(`Found ${items.length} latest episodes`);
            return this.buildSection(EpisodeSectionId.LATEST, items, true);
        } catch (error) {
            this.logger.error(`Error in getLatestEpisodesSection(): ${error.message}`);
            return this.buildSection(EpisodeSectionId.LATEST, [], false);
        }
    }

    /**
     * Get "Recommended Episodes" section
     * MVP: Returns popular episodes (same logic as popular)
     */
    private async getRecommendedEpisodesSection(): Promise<FeedSection<EpisodeFeedItem>> {
        this.logger.log('getRecommendedEpisodesSection() called (MVP: using popular)');

        try {
            // For MVP, recommended is the same as popular
            const cacheKey = FEED_CONFIG.CACHE_KEYS.EPISODES_POPULAR;
            const cached = await this.getCachedData<EpisodeFeedItem[]>(cacheKey);
            if (cached) {
                return this.buildSection(EpisodeSectionId.RECOMMENDED, cached, true);
            }

            const episodes = await this.databaseService.episode.findMany({
                where: {
                    isPublic: true,
                    generationStatus: 'COMPLETED',
                },
                orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }],
                take: FEED_CONFIG.DEFAULT_SECTION_LIMIT,
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true,
                            coverImageUrl: true,
                        },
                    },
                    podcaster: {
                        select: {
                            id: true,
                            name: true,
                            profilePictureUrl: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            const items = this.mapEpisodesToFeedItems(episodes);
            return this.buildSection(EpisodeSectionId.RECOMMENDED, items, true);
        } catch (error) {
            this.logger.error(`Error in getRecommendedEpisodesSection(): ${error.message}`);
            return this.buildSection(EpisodeSectionId.RECOMMENDED, [], false);
        }
    }

    // ============================================
    // Books Feed
    // ============================================

    private async getBooksFeed(userId: string): Promise<BooksFeedResponse> {
        this.logger.log(`getBooksFeed() called for userId: ${userId}`);

        const [popularInspirations, popularBooks, latestBooks, bestsellers] = await Promise.all([
            this.getPopularInspirationsSection(),
            this.getPopularBooksSection(),
            this.getLatestBooksSection(),
            this.getBestsellersSection(),
        ]);

        return {
            tab: FeedTab.BOOKS,
            sections: [popularInspirations, popularBooks, latestBooks, bestsellers].filter(
                section => section.items.length > 0,
            ),
        };
    }

    /**
     * Get "Popular podcast inspirations" section
     * Books that have inspired the most episodes
     */
    private async getPopularInspirationsSection(): Promise<FeedSection<BookFeedItem>> {
        this.logger.log('getPopularInspirationsSection() called');

        try {
            const cacheKey = FEED_CONFIG.CACHE_KEYS.BOOKS_INSPIRATIONS;
            const cached = await this.getCachedData<BookFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log('Cache hit for popular inspirations');
                return this.buildSection(BookSectionId.POPULAR_INSPIRATIONS, cached, true);
            }

            // Find books with the most public completed episodes
            const books = await this.databaseService.book.findMany({
                where: {
                    episodes: {
                        some: {
                            isPublic: true,
                            generationStatus: 'COMPLETED',
                        },
                    },
                },
                include: {
                    _count: {
                        select: {
                            episodes: {
                                where: {
                                    isPublic: true,
                                    generationStatus: 'COMPLETED',
                                },
                            },
                        },
                    },
                },
                take: 50, // Get more to sort by episode count
            });

            // Sort by episode count and take top 10
            const sortedBooks = books
                .sort((a, b) => b._count.episodes - a._count.episodes)
                .slice(0, FEED_CONFIG.DEFAULT_SECTION_LIMIT);

            const items: BookFeedItem[] = sortedBooks.map(book => ({
                id: book.id,
                title: book.title,
                author: book.author ?? undefined,
                coverImageUrl: book.coverImageUrl ?? undefined,
                language: book.language,
                pageCount: book.pageCount ?? undefined,
                createdAt: book.createdAt,
                episodeCount: book._count.episodes,
            }));

            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.BOOKS_POPULAR);

            this.logger.log(`Found ${items.length} popular inspirations`);
            return this.buildSection(BookSectionId.POPULAR_INSPIRATIONS, items, true);
        } catch (error) {
            this.logger.error(`Error in getPopularInspirationsSection(): ${error.message}`);
            return this.buildSection(BookSectionId.POPULAR_INSPIRATIONS, [], false);
        }
    }

    /**
     * Get "Popular Books" section
     * Books sorted by total play count of their episodes
     */
    private async getPopularBooksSection(): Promise<FeedSection<BookFeedItem>> {
        this.logger.log('getPopularBooksSection() called');

        try {
            const cacheKey = FEED_CONFIG.CACHE_KEYS.BOOKS_POPULAR;
            const cached = await this.getCachedData<BookFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log('Cache hit for popular books');
                return this.buildSection(BookSectionId.POPULAR_BOOKS, cached, true);
            }

            // Get books with their episodes' play counts
            const books = await this.databaseService.book.findMany({
                where: {
                    episodes: {
                        some: {
                            isPublic: true,
                            generationStatus: 'COMPLETED',
                        },
                    },
                },
                include: {
                    episodes: {
                        where: {
                            isPublic: true,
                            generationStatus: 'COMPLETED',
                        },
                        select: {
                            playCount: true,
                        },
                    },
                },
                take: 50,
            });

            // Calculate total play count and sort
            const booksWithPlayCount = books.map(book => ({
                ...book,
                totalPlayCount: book.episodes.reduce((sum, ep) => sum + ep.playCount, 0),
            }));

            const sortedBooks = booksWithPlayCount
                .sort((a, b) => b.totalPlayCount - a.totalPlayCount)
                .slice(0, FEED_CONFIG.DEFAULT_SECTION_LIMIT);

            const items: BookFeedItem[] = sortedBooks.map(book => ({
                id: book.id,
                title: book.title,
                author: book.author ?? undefined,
                coverImageUrl: book.coverImageUrl ?? undefined,
                language: book.language,
                pageCount: book.pageCount ?? undefined,
                createdAt: book.createdAt,
                episodeCount: book.episodes.length,
                totalPlayCount: book.totalPlayCount,
            }));

            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.BOOKS_POPULAR);

            this.logger.log(`Found ${items.length} popular books`);
            return this.buildSection(BookSectionId.POPULAR_BOOKS, items, true);
        } catch (error) {
            this.logger.error(`Error in getPopularBooksSection(): ${error.message}`);
            return this.buildSection(BookSectionId.POPULAR_BOOKS, [], false);
        }
    }

    /**
     * Get "Latest Books" section
     */
    private async getLatestBooksSection(): Promise<FeedSection<BookFeedItem>> {
        this.logger.log('getLatestBooksSection() called');

        try {
            const cacheKey = FEED_CONFIG.CACHE_KEYS.BOOKS_LATEST;
            const cached = await this.getCachedData<BookFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log('Cache hit for latest books');
                return this.buildSection(BookSectionId.LATEST_BOOKS, cached, true);
            }

            const books = await this.databaseService.book.findMany({
                where: {
                    extractionStatus: 'COMPLETED',
                },
                orderBy: { createdAt: 'desc' },
                take: FEED_CONFIG.DEFAULT_SECTION_LIMIT,
                include: {
                    _count: {
                        select: {
                            episodes: {
                                where: {
                                    isPublic: true,
                                    generationStatus: 'COMPLETED',
                                },
                            },
                        },
                    },
                },
            });

            const items: BookFeedItem[] = books.map(book => ({
                id: book.id,
                title: book.title,
                author: book.author ?? undefined,
                coverImageUrl: book.coverImageUrl ?? undefined,
                language: book.language,
                pageCount: book.pageCount ?? undefined,
                createdAt: book.createdAt,
                episodeCount: book._count.episodes,
            }));

            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.BOOKS_LATEST);

            this.logger.log(`Found ${items.length} latest books`);
            return this.buildSection(BookSectionId.LATEST_BOOKS, items, true);
        } catch (error) {
            this.logger.error(`Error in getLatestBooksSection(): ${error.message}`);
            return this.buildSection(BookSectionId.LATEST_BOOKS, [], false);
        }
    }

    /**
     * Get "NY Best Sellers" section
     * MVP: Returns a curated static list
     */
    private async getBestsellersSection(): Promise<FeedSection<BookFeedItem>> {
        this.logger.log('getBestsellersSection() called (MVP: static list)');

        try {
            // MVP: Return books that exist in our system, sorted by popularity
            // In the future, this would integrate with NY Times API
            const books = await this.databaseService.book.findMany({
                where: {
                    extractionStatus: 'COMPLETED',
                    episodes: {
                        some: {
                            isPublic: true,
                            generationStatus: 'COMPLETED',
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: FEED_CONFIG.DEFAULT_SECTION_LIMIT,
                include: {
                    _count: {
                        select: {
                            episodes: true,
                        },
                    },
                },
            });

            const items: BookFeedItem[] = books.map(book => ({
                id: book.id,
                title: book.title,
                author: book.author ?? undefined,
                coverImageUrl: book.coverImageUrl ?? undefined,
                language: book.language,
                pageCount: book.pageCount ?? undefined,
                createdAt: book.createdAt,
                episodeCount: book._count.episodes,
            }));

            this.logger.log(`Found ${items.length} bestsellers (MVP static)`);
            return this.buildSection(BookSectionId.BESTSELLERS, items, false);
        } catch (error) {
            this.logger.error(`Error in getBestsellersSection(): ${error.message}`);
            return this.buildSection(BookSectionId.BESTSELLERS, [], false);
        }
    }

    // ============================================
    // Podcasters Feed
    // ============================================

    private async getPodcastersFeed(userId: string): Promise<PodcastersFeedResponse> {
        this.logger.log(`getPodcastersFeed() called for userId: ${userId}`);

        const [trending, topRated, newVoices] = await Promise.all([
            this.getTrendingPodcastersSection(),
            this.getTopRatedPodcastersSection(),
            this.getNewVoicesSection(),
        ]);

        return {
            tab: FeedTab.PODCASTERS,
            sections: [trending, topRated, newVoices].filter(section => section.items.length > 0),
        };
    }

    /**
     * Get "Trending" podcasters section
     */
    private async getTrendingPodcastersSection(): Promise<FeedSection<PodcasterFeedItem>> {
        this.logger.log('getTrendingPodcastersSection() called');

        try {
            const cacheKey = FEED_CONFIG.CACHE_KEYS.PODCASTERS_TRENDING;
            const cached = await this.getCachedData<PodcasterFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log('Cache hit for trending podcasters');
                return this.buildSection(PodcasterSectionId.TRENDING, cached, true);
            }

            const podcasters = await this.databaseService.podcaster.findMany({
                where: { isPublic: true },
                orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }],
                take: FEED_CONFIG.DEFAULT_SECTION_LIMIT,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            const items = this.mapPodcastersToFeedItems(podcasters);
            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.PODCASTERS_TRENDING);

            this.logger.log(`Found ${items.length} trending podcasters`);
            return this.buildSection(PodcasterSectionId.TRENDING, items, true);
        } catch (error) {
            this.logger.error(`Error in getTrendingPodcastersSection(): ${error.message}`);
            return this.buildSection(PodcasterSectionId.TRENDING, [], false);
        }
    }

    /**
     * Get "Top Rated" podcasters section
     */
    private async getTopRatedPodcastersSection(): Promise<FeedSection<PodcasterFeedItem>> {
        this.logger.log('getTopRatedPodcastersSection() called');

        try {
            const cacheKey = FEED_CONFIG.CACHE_KEYS.PODCASTERS_TOP_RATED;
            const cached = await this.getCachedData<PodcasterFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log('Cache hit for top rated podcasters');
                return this.buildSection(PodcasterSectionId.TOP_RATED, cached, true);
            }

            const podcasters = await this.databaseService.podcaster.findMany({
                where: {
                    isPublic: true,
                    ratingCount: { gt: 0 }, // Only podcasters with ratings
                },
                orderBy: [{ averageRating: 'desc' }, { ratingCount: 'desc' }],
                take: FEED_CONFIG.DEFAULT_SECTION_LIMIT,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            const items = this.mapPodcastersToFeedItems(podcasters);
            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.PODCASTERS_TOP_RATED);

            this.logger.log(`Found ${items.length} top rated podcasters`);
            return this.buildSection(PodcasterSectionId.TOP_RATED, items, true);
        } catch (error) {
            this.logger.error(`Error in getTopRatedPodcastersSection(): ${error.message}`);
            return this.buildSection(PodcasterSectionId.TOP_RATED, [], false);
        }
    }

    /**
     * Get "New Voices" podcasters section
     */
    private async getNewVoicesSection(): Promise<FeedSection<PodcasterFeedItem>> {
        this.logger.log('getNewVoicesSection() called');

        try {
            const cacheKey = FEED_CONFIG.CACHE_KEYS.PODCASTERS_NEW_VOICES;
            const cached = await this.getCachedData<PodcasterFeedItem[]>(cacheKey);
            if (cached) {
                this.logger.log('Cache hit for new voices');
                return this.buildSection(PodcasterSectionId.NEW_VOICES, cached, true);
            }

            const podcasters = await this.databaseService.podcaster.findMany({
                where: { isPublic: true },
                orderBy: { createdAt: 'desc' },
                take: FEED_CONFIG.DEFAULT_SECTION_LIMIT,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            const items = this.mapPodcastersToFeedItems(podcasters);
            await this.setCachedData(cacheKey, items, FEED_CONFIG.CACHE_TTL.PODCASTERS_NEW_VOICES);

            this.logger.log(`Found ${items.length} new voices`);
            return this.buildSection(PodcasterSectionId.NEW_VOICES, items, true);
        } catch (error) {
            this.logger.error(`Error in getNewVoicesSection(): ${error.message}`);
            return this.buildSection(PodcasterSectionId.NEW_VOICES, [], false);
        }
    }

    // ============================================
    // Pagination Methods
    // ============================================

    private async getEpisodeSectionPaginated(
        sectionId: EpisodeSectionId,
        userId: string,
        offset: number,
        limit: number,
        page: number,
    ): Promise<SectionPaginationResponse<EpisodeFeedItem>> {
        this.logger.log(`getEpisodeSectionPaginated() called for section: ${sectionId}`);

        const where: any = {
            isPublic: true,
            generationStatus: 'COMPLETED',
        };
        let orderBy: any = { createdAt: 'desc' };

        switch (sectionId) {
            case EpisodeSectionId.POPULAR:
            case EpisodeSectionId.RECOMMENDED:
                orderBy = [{ playCount: 'desc' }, { likeCount: 'desc' }];
                break;
            case EpisodeSectionId.LATEST:
                orderBy = { createdAt: 'desc' };
                break;
            case EpisodeSectionId.CONTINUE_LISTENING:
                // Continue listening doesn't support pagination in the same way
                return {
                    items: [],
                    page,
                    limit,
                    totalCount: 0,
                    totalPages: 0,
                    hasMore: false,
                };
        }

        const [episodes, totalCount] = await Promise.all([
            this.databaseService.episode.findMany({
                where,
                orderBy,
                skip: offset,
                take: limit,
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true,
                            coverImageUrl: true,
                        },
                    },
                    podcaster: {
                        select: {
                            id: true,
                            name: true,
                            profilePictureUrl: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            }),
            this.databaseService.episode.count({ where }),
        ]);

        const items = this.mapEpisodesToFeedItems(episodes);
        const totalPages = Math.ceil(totalCount / limit);

        return {
            items,
            page,
            limit,
            totalCount,
            totalPages,
            hasMore: page < totalPages,
        };
    }

    private async getBookSectionPaginated(
        sectionId: BookSectionId,
        offset: number,
        limit: number,
        page: number,
    ): Promise<SectionPaginationResponse<BookFeedItem>> {
        this.logger.log(`getBookSectionPaginated() called for section: ${sectionId}`);

        const where: any = { extractionStatus: 'COMPLETED' };
        let orderBy: any = { createdAt: 'desc' };

        switch (sectionId) {
            case BookSectionId.LATEST_BOOKS:
                orderBy = { createdAt: 'desc' };
                break;
            case BookSectionId.POPULAR_BOOKS:
            case BookSectionId.POPULAR_INSPIRATIONS:
            case BookSectionId.BESTSELLERS:
                // For popularity, we need special handling
                orderBy = { createdAt: 'desc' };
                break;
        }

        const [books, totalCount] = await Promise.all([
            this.databaseService.book.findMany({
                where,
                orderBy,
                skip: offset,
                take: limit,
                include: {
                    _count: {
                        select: { episodes: true },
                    },
                },
            }),
            this.databaseService.book.count({ where }),
        ]);

        const items: BookFeedItem[] = books.map(book => ({
            id: book.id,
            title: book.title,
            author: book.author ?? undefined,
            coverImageUrl: book.coverImageUrl ?? undefined,
            language: book.language,
            pageCount: book.pageCount ?? undefined,
            createdAt: book.createdAt,
            episodeCount: book._count.episodes,
        }));

        const totalPages = Math.ceil(totalCount / limit);

        return {
            items,
            page,
            limit,
            totalCount,
            totalPages,
            hasMore: page < totalPages,
        };
    }

    private async getPodcasterSectionPaginated(
        sectionId: PodcasterSectionId,
        offset: number,
        limit: number,
        page: number,
    ): Promise<SectionPaginationResponse<PodcasterFeedItem>> {
        this.logger.log(`getPodcasterSectionPaginated() called for section: ${sectionId}`);

        const where: any = { isPublic: true };
        let orderBy: any = { createdAt: 'desc' };

        switch (sectionId) {
            case PodcasterSectionId.TRENDING:
                orderBy = [{ playCount: 'desc' }, { likeCount: 'desc' }];
                break;
            case PodcasterSectionId.TOP_RATED:
                where.ratingCount = { gt: 0 };
                orderBy = [{ averageRating: 'desc' }, { ratingCount: 'desc' }];
                break;
            case PodcasterSectionId.NEW_VOICES:
                orderBy = { createdAt: 'desc' };
                break;
        }

        const [podcasters, totalCount] = await Promise.all([
            this.databaseService.podcaster.findMany({
                where,
                orderBy,
                skip: offset,
                take: limit,
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

        const items = this.mapPodcastersToFeedItems(podcasters);
        const totalPages = Math.ceil(totalCount / limit);

        return {
            items,
            page,
            limit,
            totalCount,
            totalPages,
            hasMore: page < totalPages,
        };
    }

    // ============================================
    // Helper Methods
    // ============================================

    private buildSection<T>(
        id: string,
        items: T[],
        hasMore: boolean,
        totalCount?: number,
    ): FeedSection<T> {
        return {
            id,
            title: SECTION_TITLES[id] || id,
            type: id,
            items,
            hasMore,
            totalCount,
        };
    }

    private mapEpisodesToFeedItems(episodes: any[]): EpisodeFeedItem[] {
        return episodes.map(episode => ({
            id: episode.id,
            title: episode.title,
            description: episode.description,
            coverImageUrl: episode.book?.coverImageUrl,
            duration: episode.duration,
            playCount: episode.playCount,
            likeCount: episode.likeCount,
            createdAt: episode.createdAt,
            book: episode.book,
            podcaster: episode.podcaster,
            creator: episode.user,
        }));
    }

    private mapPodcastersToFeedItems(podcasters: any[]): PodcasterFeedItem[] {
        return podcasters.map(podcaster => ({
            id: podcaster.id,
            name: podcaster.name,
            bio: podcaster.bio,
            profilePictureUrl: podcaster.profilePictureUrl,
            voiceModel: podcaster.voiceModel,
            expertiseTags: podcaster.expertiseTags || [],
            playCount: podcaster.playCount,
            likeCount: podcaster.likeCount,
            averageRating: podcaster.averageRating,
            ratingCount: podcaster.ratingCount,
            createdAt: podcaster.createdAt,
            creator: podcaster.user,
        }));
    }

    // ============================================
    // Cache Helper Methods
    // ============================================

    private async getCachedData<T>(key: string): Promise<T | null> {
        try {
            const data = await this.redisService['client']?.get(key);
            if (data) {
                return JSON.parse(data) as T;
            }
            return null;
        } catch (error) {
            this.logger.warn(`Cache read error for key ${key}: ${error.message}`);
            return null;
        }
    }

    private async setCachedData<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
        try {
            await this.redisService['client']?.setex(key, ttlSeconds, JSON.stringify(data));
            this.logger.log(`Cached data for key ${key} with TTL ${ttlSeconds}s`);
        } catch (error) {
            this.logger.warn(`Cache write error for key ${key}: ${error.message}`);
        }
    }
}
