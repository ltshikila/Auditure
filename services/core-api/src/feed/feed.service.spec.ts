import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FeedService } from './feed.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { FeedTab, EpisodeSectionId, BookSectionId, PodcasterSectionId } from './dto/feed-query.dto';
import { FEED_CONFIG, EpisodeFeedItem } from './dto/feed-response.dto';
import { mockPrismaClient } from '../../test/mocks/database.mock';
import {
    createMockEpisodeWithRelations,
    createMockBookWithCount,
    createMockBookWithEpisodes,
    createMockPodcasterWithCreator,
    MOCK_USER_ID,
} from '../../test/fixtures/feed.fixture';

// Mock Redis client
const mockRedisClient = {
    get: jest.fn(),
    setex: jest.fn(),
};

const mockRedisService = {
    getAllPlaybackProgress: jest.fn().mockResolvedValue({}),
    client: mockRedisClient,
};

describe('FeedService', () => {
    let service: FeedService;
    let databaseService: DatabaseService;
    let redisService: RedisService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FeedService,
                {
                    provide: DatabaseService,
                    useValue: mockPrismaClient,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
            ],
        }).compile();

        service = module.get<FeedService>(FeedService);
        databaseService = module.get<DatabaseService>(DatabaseService);
        redisService = module.get<RedisService>(RedisService);

        // Clear all mocks before each test
        jest.clearAllMocks();
        mockRedisClient.get.mockResolvedValue(null);
        mockRedisClient.setex.mockResolvedValue('OK');
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ============================================
    // getFeed Tests
    // ============================================

    describe('getFeed', () => {
        it('should return episodes feed for EPISODES tab', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

            const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

            expect(result.tab).toBe(FeedTab.EPISODES);
            expect(result.sections).toBeDefined();
        });

        it('should return books feed for BOOKS tab', async () => {
            mockPrismaClient.book.findMany.mockResolvedValue([]);

            const result = await service.getFeed(FeedTab.BOOKS, MOCK_USER_ID);

            expect(result.tab).toBe(FeedTab.BOOKS);
            expect(result.sections).toBeDefined();
        });

        it('should return podcasters feed for PODCASTERS tab', async () => {
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            const result = await service.getFeed(FeedTab.PODCASTERS, MOCK_USER_ID);

            expect(result.tab).toBe(FeedTab.PODCASTERS);
            expect(result.sections).toBeDefined();
        });

        it('should throw BadRequestException for invalid tab', async () => {
            await expect(service.getFeed('invalid' as FeedTab, MOCK_USER_ID)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    // ============================================
    // Episodes Feed Tests
    // ============================================

    describe('Episodes Feed', () => {
        describe('Continue Listening Section', () => {
            it('should return empty section when user has no playback progress', async () => {
                mockRedisService.getAllPlaybackProgress.mockResolvedValue({});
                mockPrismaClient.episode.findMany.mockResolvedValue([]);

                const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                // Continue listening section should be filtered out if empty
                const continueSection = result.sections.find(
                    s => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );
                expect(continueSection).toBeUndefined();
            });

            it('should return continue listening items with correct progress', async () => {
                const episodeId = 'episode-123';
                const duration = 1200; // 20 minutes in seconds (matches schema)
                const progressMs = 600000; // 10 minutes in ms = 50% of 1200s

                mockRedisService.getAllPlaybackProgress.mockResolvedValue({
                    [episodeId]: progressMs,
                });

                const mockEpisode = createMockEpisodeWithRelations({
                    id: episodeId,
                    duration,
                    updatedAt: new Date(), // Recent
                });

                mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);

                const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                const continueSection = result.sections.find(
                    s => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );
                expect(continueSection).toBeDefined();
                expect(continueSection!.items).toHaveLength(1);
                const episodeItem = continueSection!.items[0] as EpisodeFeedItem;
                expect(episodeItem.progressMs).toBe(progressMs);
                expect(episodeItem.progressPercent).toBe(50);
            });

            it('should limit continue listening to max 7 items', async () => {
                const playbackProgress: Record<string, number> = {};
                const episodes: ReturnType<typeof createMockEpisodeWithRelations>[] = [];

                // Create 10 episodes with progress
                // Duration: 1200 seconds, Progress: 600000ms = 50%
                for (let i = 0; i < 10; i++) {
                    const id = `episode-${i}`;
                    playbackProgress[id] = 600000; // 50% progress (10 min of 20 min episode)
                    episodes.push(
                        createMockEpisodeWithRelations({
                            id,
                            duration: 1200, // 20 minutes in seconds
                            updatedAt: new Date(),
                        }),
                    );
                }

                mockRedisService.getAllPlaybackProgress.mockResolvedValue(playbackProgress);
                mockPrismaClient.episode.findMany.mockResolvedValue(episodes);

                const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                const continueSection = result.sections.find(
                    s => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );
                expect(continueSection!.items.length).toBeLessThanOrEqual(
                    FEED_CONFIG.CONTINUE_LISTENING_MAX_ITEMS,
                );
            });

            it('should exclude episodes with 0% progress', async () => {
                const episodeId = 'episode-123';
                mockRedisService.getAllPlaybackProgress.mockResolvedValue({
                    [episodeId]: 0, // 0% progress
                });

                const mockEpisode = createMockEpisodeWithRelations({
                    id: episodeId,
                    duration: 1200, // 20 minutes in seconds
                    updatedAt: new Date(),
                });

                mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);

                const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                const continueSection = result.sections.find(
                    s => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );
                expect(continueSection).toBeUndefined();
            });

            it('should exclude episodes with >= 95% progress', async () => {
                const episodeId = 'episode-123';
                const duration = 1200; // 20 minutes in seconds
                const durationMs = duration * 1000;
                const progressMs = durationMs * 0.96; // 96% progress

                mockRedisService.getAllPlaybackProgress.mockResolvedValue({
                    [episodeId]: progressMs,
                });

                const mockEpisode = createMockEpisodeWithRelations({
                    id: episodeId,
                    duration,
                    updatedAt: new Date(),
                });

                mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);

                const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                const continueSection = result.sections.find(
                    s => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );
                expect(continueSection).toBeUndefined();
            });

            it('should use cached data when available', async () => {
                const cachedItems = [{ id: 'cached-episode', title: 'Cached Episode' }];
                mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedItems));

                mockPrismaClient.episode.findMany.mockResolvedValue([]);

                const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                // Even with cached continue listening, we need to check DB isn't called for that section
                // but will be called for other sections
                expect(mockRedisClient.get).toHaveBeenCalled();
            });
        });

        describe('Popular Episodes Section', () => {
            it('should return popular episodes sorted by play count', async () => {
                const mockEpisodes = [
                    createMockEpisodeWithRelations({ playCount: 1000, likeCount: 100 }),
                    createMockEpisodeWithRelations({ playCount: 500, likeCount: 50 }),
                ];

                mockPrismaClient.episode.findMany.mockResolvedValue(mockEpisodes);
                mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

                const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                const popularSection = result.sections.find(s => s.id === EpisodeSectionId.POPULAR);
                expect(popularSection).toBeDefined();
                expect(popularSection!.items.length).toBeGreaterThan(0);
            });

            it('should only return public and completed episodes', async () => {
                mockPrismaClient.episode.findMany.mockResolvedValue([]);
                mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

                await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                    expect.objectContaining({
                        where: expect.objectContaining({
                            generationStatus: 'COMPLETED',
                            OR: [
                                { isPublic: true },
                                { podcaster: { isPublic: true } },
                            ],
                        }),
                    }),
                );
            });

            it('should cache popular episodes', async () => {
                mockPrismaClient.episode.findMany.mockResolvedValue([
                    createMockEpisodeWithRelations(),
                ]);
                mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

                await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                expect(mockRedisClient.setex).toHaveBeenCalledWith(
                    FEED_CONFIG.CACHE_KEYS.EPISODES_POPULAR,
                    FEED_CONFIG.CACHE_TTL.EPISODES_POPULAR,
                    expect.any(String),
                );
            });
        });

        describe('Latest Episodes Section', () => {
            it('should return latest episodes sorted by createdAt', async () => {
                const now = new Date();
                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

                const mockEpisodes = [
                    createMockEpisodeWithRelations({ createdAt: now }),
                    createMockEpisodeWithRelations({ createdAt: yesterday }),
                ];

                mockPrismaClient.episode.findMany.mockResolvedValue(mockEpisodes);
                mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

                const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

                const latestSection = result.sections.find(s => s.id === EpisodeSectionId.LATEST);
                expect(latestSection).toBeDefined();
            });
        });
    });

    // ============================================
    // Books Feed Tests
    // ============================================

    describe('Books Feed', () => {
        describe('Popular Inspirations Section', () => {
            it('should return books sorted by episode count', async () => {
                const mockBooks = [
                    { ...createMockBookWithCount(), _count: { episodes: 10 } },
                    { ...createMockBookWithCount(), _count: { episodes: 5 } },
                ];

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

                const result = await service.getFeed(FeedTab.BOOKS, MOCK_USER_ID);

                const inspirationsSection = result.sections.find(
                    s => s.id === BookSectionId.POPULAR_INSPIRATIONS,
                );
                expect(inspirationsSection).toBeDefined();
            });
        });

        describe('Popular Books Section', () => {
            it('should return books sorted by total play count', async () => {
                const mockBooks = [
                    createMockBookWithEpisodes({
                        episodes: [{ playCount: 500 }, { playCount: 300 }],
                    }),
                    createMockBookWithEpisodes({
                        episodes: [{ playCount: 100 }],
                    }),
                ];

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

                const result = await service.getFeed(FeedTab.BOOKS, MOCK_USER_ID);

                const popularSection = result.sections.find(
                    s => s.id === BookSectionId.POPULAR_BOOKS,
                );
                expect(popularSection).toBeDefined();
            });
        });

        describe('Latest Books Section', () => {
            it('should return books sorted by createdAt', async () => {
                const mockBooks = [{ ...createMockBookWithCount(), _count: { episodes: 2 } }];

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

                const result = await service.getFeed(FeedTab.BOOKS, MOCK_USER_ID);

                const latestSection = result.sections.find(
                    s => s.id === BookSectionId.LATEST_BOOKS,
                );
                expect(latestSection).toBeDefined();
            });

            it('should only return books with COMPLETED extraction status', async () => {
                mockPrismaClient.book.findMany.mockResolvedValue([]);

                await service.getFeed(FeedTab.BOOKS, MOCK_USER_ID);

                // Check that at least one call includes extractionStatus filter
                const calls = mockPrismaClient.book.findMany.mock.calls;
                const hasExtractionStatusFilter = calls.some(
                    call => call[0]?.where?.extractionStatus === 'COMPLETED',
                );
                expect(hasExtractionStatusFilter).toBe(true);
            });
        });

        describe('Bestsellers Section', () => {
            it('should return bestsellers (MVP: static list)', async () => {
                const mockBooks = [{ ...createMockBookWithCount(), _count: { episodes: 3 } }];

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

                const result = await service.getFeed(FeedTab.BOOKS, MOCK_USER_ID);

                const bestsellersSection = result.sections.find(
                    s => s.id === BookSectionId.BESTSELLERS,
                );
                expect(bestsellersSection).toBeDefined();
            });
        });
    });

    // ============================================
    // Podcasters Feed Tests
    // ============================================

    describe('Podcasters Feed', () => {
        describe('Trending Section', () => {
            it('should return trending podcasters sorted by play count', async () => {
                const mockPodcasters = [
                    createMockPodcasterWithCreator({ playCount: 5000 }),
                    createMockPodcasterWithCreator({ playCount: 2000 }),
                ];

                mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);

                const result = await service.getFeed(FeedTab.PODCASTERS, MOCK_USER_ID);

                const trendingSection = result.sections.find(
                    s => s.id === PodcasterSectionId.TRENDING,
                );
                expect(trendingSection).toBeDefined();
            });

            it('should only return public podcasters', async () => {
                mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

                await service.getFeed(FeedTab.PODCASTERS, MOCK_USER_ID);

                expect(mockPrismaClient.podcaster.findMany).toHaveBeenCalledWith(
                    expect.objectContaining({
                        where: expect.objectContaining({
                            isPublic: true,
                        }),
                    }),
                );
            });
        });

        describe('Top Rated Section', () => {
            it('should return top rated podcasters sorted by average rating', async () => {
                const mockPodcasters = [
                    createMockPodcasterWithCreator({ averageRating: 4.9, ratingCount: 100 }),
                    createMockPodcasterWithCreator({ averageRating: 4.5, ratingCount: 50 }),
                ];

                mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);

                const result = await service.getFeed(FeedTab.PODCASTERS, MOCK_USER_ID);

                const topRatedSection = result.sections.find(
                    s => s.id === PodcasterSectionId.TOP_RATED,
                );
                expect(topRatedSection).toBeDefined();
            });

            it('should only return podcasters with at least one rating', async () => {
                mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

                await service.getFeed(FeedTab.PODCASTERS, MOCK_USER_ID);

                // Check that the top rated query has ratingCount > 0 filter
                const calls = mockPrismaClient.podcaster.findMany.mock.calls;
                const hasRatingFilter = calls.some(call => call[0]?.where?.ratingCount?.gt === 0);
                expect(hasRatingFilter).toBe(true);
            });
        });

        describe('New Voices Section', () => {
            it('should return new podcasters sorted by createdAt', async () => {
                const mockPodcasters = [createMockPodcasterWithCreator({ createdAt: new Date() })];

                mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);

                const result = await service.getFeed(FeedTab.PODCASTERS, MOCK_USER_ID);

                const newVoicesSection = result.sections.find(
                    s => s.id === PodcasterSectionId.NEW_VOICES,
                );
                expect(newVoicesSection).toBeDefined();
            });
        });
    });

    // ============================================
    // getSectionData Tests (Pagination)
    // ============================================

    describe('getSectionData', () => {
        describe('Episode Sections', () => {
            it('should return paginated popular episodes', async () => {
                const mockEpisodes = Array(20)
                    .fill(null)
                    .map(() => createMockEpisodeWithRelations());

                mockPrismaClient.episode.findMany.mockResolvedValue(mockEpisodes.slice(0, 10));
                mockPrismaClient.episode.count.mockResolvedValue(50);

                const result = await service.getSectionData(
                    EpisodeSectionId.POPULAR,
                    MOCK_USER_ID,
                    1,
                    10,
                );

                expect(result.items).toHaveLength(10);
                expect(result.totalCount).toBe(50);
                expect(result.totalPages).toBe(5);
                expect(result.hasMore).toBe(true);
            });

            it('should return empty result for continue listening pagination', async () => {
                const result = await service.getSectionData(
                    EpisodeSectionId.CONTINUE_LISTENING,
                    MOCK_USER_ID,
                    1,
                    10,
                );

                expect(result.items).toHaveLength(0);
                expect(result.hasMore).toBe(false);
            });

            it('should calculate correct offset for page 2', async () => {
                mockPrismaClient.episode.findMany.mockResolvedValue([]);
                mockPrismaClient.episode.count.mockResolvedValue(50);

                await service.getSectionData(EpisodeSectionId.LATEST, MOCK_USER_ID, 2, 10);

                expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                    expect.objectContaining({
                        skip: 10, // (page 2 - 1) * limit 10
                        take: 10,
                    }),
                );
            });
        });

        describe('Book Sections', () => {
            it('should return paginated books', async () => {
                const mockBooks = Array(10)
                    .fill(null)
                    .map((_, i) => ({
                        ...createMockBookWithCount(),
                        title: `Unique Book ${i}`,
                        author: `Author ${i}`,
                        _count: { episodes: 2 },
                    }));

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

                const result = await service.getSectionData(
                    BookSectionId.LATEST_BOOKS,
                    MOCK_USER_ID,
                    1,
                    10,
                );

                expect(result.items).toHaveLength(10);
                expect(result.totalCount).toBe(10);
                expect(result.hasMore).toBe(false);
            });
        });

        describe('Podcaster Sections', () => {
            it('should return paginated podcasters', async () => {
                const mockPodcasters = Array(10)
                    .fill(null)
                    .map(() => createMockPodcasterWithCreator());

                mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);
                mockPrismaClient.podcaster.count.mockResolvedValue(25);

                const result = await service.getSectionData(
                    PodcasterSectionId.TRENDING,
                    MOCK_USER_ID,
                    1,
                    10,
                );

                expect(result.items).toHaveLength(10);
                expect(result.totalCount).toBe(25);
                expect(result.totalPages).toBe(3);
            });

            it('should apply top rated filter for TOP_RATED section', async () => {
                mockPrismaClient.podcaster.findMany.mockResolvedValue([]);
                mockPrismaClient.podcaster.count.mockResolvedValue(0);

                await service.getSectionData(PodcasterSectionId.TOP_RATED, MOCK_USER_ID, 1, 10);

                expect(mockPrismaClient.podcaster.findMany).toHaveBeenCalledWith(
                    expect.objectContaining({
                        where: expect.objectContaining({
                            ratingCount: { gt: 0 },
                        }),
                    }),
                );
            });
        });

        it('should throw BadRequestException for invalid section ID', async () => {
            await expect(
                service.getSectionData('invalid_section', MOCK_USER_ID, 1, 10),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ============================================
    // Caching Tests
    // ============================================

    describe('Caching', () => {
        it('should use cached data when available', async () => {
            const cachedEpisodes = [{ id: 'cached-1', title: 'Cached Episode' }];
            mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedEpisodes));

            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

            await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

            // Should check cache
            expect(mockRedisClient.get).toHaveBeenCalled();
        });

        it('should set cache after fetching from database', async () => {
            mockRedisClient.get.mockResolvedValue(null);
            mockPrismaClient.episode.findMany.mockResolvedValue([createMockEpisodeWithRelations()]);
            mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

            await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

            // Should set cache
            expect(mockRedisClient.setex).toHaveBeenCalled();
        });

        it('should handle cache read errors gracefully', async () => {
            mockRedisClient.get.mockRejectedValue(new Error('Redis connection error'));
            mockPrismaClient.episode.findMany.mockResolvedValue([createMockEpisodeWithRelations()]);
            mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

            // Should not throw, should fallback to DB
            const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);
            expect(result).toBeDefined();
        });

        it('should handle cache write errors gracefully', async () => {
            mockRedisClient.get.mockResolvedValue(null);
            mockRedisClient.setex.mockRejectedValue(new Error('Redis write error'));
            mockPrismaClient.episode.findMany.mockResolvedValue([createMockEpisodeWithRelations()]);
            mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

            // Should not throw
            const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);
            expect(result).toBeDefined();
        });
    });

    // ============================================
    // Error Handling Tests
    // ============================================

    describe('Error Handling', () => {
        it('should handle database errors in episodes feed gracefully', async () => {
            mockPrismaClient.episode.findMany.mockRejectedValue(new Error('DB error'));
            mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

            const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

            // Should return feed with empty sections (graceful degradation)
            expect(result.tab).toBe(FeedTab.EPISODES);
        });

        it('should handle Redis playback progress errors gracefully', async () => {
            mockRedisService.getAllPlaybackProgress.mockRejectedValue(new Error('Redis error'));
            mockPrismaClient.episode.findMany.mockResolvedValue([createMockEpisodeWithRelations()]);

            const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

            // Should still return other sections
            expect(result.tab).toBe(FeedTab.EPISODES);
        });
    });

    // ============================================
    // Section Title Tests
    // ============================================

    describe('Section Titles', () => {
        it('should use correct title for continue listening section', async () => {
            const episodeId = 'episode-123';
            mockRedisService.getAllPlaybackProgress.mockResolvedValue({
                [episodeId]: 600000,
            });

            const mockEpisode = createMockEpisodeWithRelations({
                id: episodeId,
                duration: 1200000,
                updatedAt: new Date(),
            });

            mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);

            const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

            const continueSection = result.sections.find(
                s => s.id === EpisodeSectionId.CONTINUE_LISTENING,
            );
            expect(continueSection?.title).toBe('Pick up where you left off');
        });

        it('should use correct title for popular episodes section', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([createMockEpisodeWithRelations()]);
            mockRedisService.getAllPlaybackProgress.mockResolvedValue({});

            const result = await service.getFeed(FeedTab.EPISODES, MOCK_USER_ID);

            const popularSection = result.sections.find(s => s.id === EpisodeSectionId.POPULAR);
            expect(popularSection?.title).toBe('Popular Episodes');
        });
    });
});
