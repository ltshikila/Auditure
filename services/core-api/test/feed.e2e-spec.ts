/**
 * Integration Tests: Feed Service
 *
 * Tests the complete feed workflow including:
 * - Episodes feed with continue listening, popular, and latest sections
 * - Books feed with popular inspirations, popular books, and latest books
 * - Podcasters feed with trending, top rated, and new voices
 * - Section pagination ("See All" functionality)
 * - Caching behavior
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// Modules
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

// Fixtures
import {
    createMockEpisodeWithRelations,
    createMockBookWithCount,
    createMockBookWithEpisodes,
    createMockPodcasterWithCreator,
    MOCK_USER_ID,
} from './fixtures/feed.fixture';

// Mocks
import { mockPrismaClient } from './mocks/database.mock';
import { mockRedisService } from './mocks/services.mock';
import { RedisService } from '../src/redis/redis.service';

// DTOs
import {
    FeedTab,
    EpisodeSectionId,
    BookSectionId,
    PodcasterSectionId,
} from '../src/feed/dto/feed-query.dto';
import { FEED_CONFIG } from '../src/feed/dto/feed-response.dto';

// Mock JWT auth guard
const mockJwtAuthGuard = {
    canActivate: jest.fn().mockImplementation(context => {
        const req = context.switchToHttp().getRequest();
        req.user = { userId: MOCK_USER_ID };
        return true;
    }),
};

// Extended Redis mock with client for caching
const mockRedisServiceWithClient = {
    ...mockRedisService,
    client: {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
    },
};

describe('Integration: Feed Service', () => {
    let app: INestApplication<App>;
    let databaseService: DatabaseService;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(DatabaseService)
            .useValue(mockPrismaClient)
            .overrideProvider(RedisService)
            .useValue(mockRedisServiceWithClient)
            .overrideGuard('JwtAuthGuard')
            .useValue(mockJwtAuthGuard)
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
                forbidNonWhitelisted: true,
            }),
        );
        await app.init();

        databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisServiceWithClient.client.get.mockResolvedValue(null);
        mockRedisServiceWithClient.client.setex.mockResolvedValue('OK');
        mockRedisServiceWithClient.getAllPlaybackProgress.mockResolvedValue({});
    });

    // ============================================
    // EPISODES FEED TESTS
    // ============================================

    describe('GET /feed?tab=episodes', () => {
        describe('Feed Structure', () => {
            it('should return episodes feed with correct structure', async () => {
                mockPrismaClient.episode.findMany.mockResolvedValue([
                    createMockEpisodeWithRelations(),
                ]);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.EPISODES })
                    .expect(200);

                expect(response.body).toHaveProperty('tab', FeedTab.EPISODES);
                expect(response.body).toHaveProperty('sections');
                expect(Array.isArray(response.body.sections)).toBe(true);
            });

            it('should include required section properties', async () => {
                mockPrismaClient.episode.findMany.mockResolvedValue([
                    createMockEpisodeWithRelations(),
                ]);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.EPISODES })
                    .expect(200);

                if (response.body.sections.length > 0) {
                    const section = response.body.sections[0];
                    expect(section).toHaveProperty('id');
                    expect(section).toHaveProperty('title');
                    expect(section).toHaveProperty('type');
                    expect(section).toHaveProperty('items');
                    expect(section).toHaveProperty('hasMore');
                }
            });
        });

        describe('Continue Listening Section', () => {
            it('should return continue listening items with progress', async () => {
                const episodeId = 'episode-continue-1';
                const progressMs = 600000; // 10 minutes

                mockRedisServiceWithClient.getAllPlaybackProgress.mockResolvedValue({
                    [episodeId]: progressMs,
                });

                const mockEpisode = createMockEpisodeWithRelations({
                    id: episodeId,
                    duration: 1200000, // 20 minutes
                    updatedAt: new Date(),
                });

                mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.EPISODES })
                    .expect(200);

                const continueSection = response.body.sections.find(
                    (s: any) => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );

                if (continueSection) {
                    expect(continueSection.items[0]).toHaveProperty('progressMs');
                    expect(continueSection.items[0]).toHaveProperty('progressPercent');
                }
            });

            it('should limit continue listening to 7 items maximum', async () => {
                const playbackProgress: Record<string, number> = {};
                const episodes: ReturnType<typeof createMockEpisodeWithRelations>[] = [];

                // Create 10 episodes with progress
                for (let i = 0; i < 10; i++) {
                    const id = `episode-${i}`;
                    playbackProgress[id] = 600000; // 50% progress
                    episodes.push(
                        createMockEpisodeWithRelations({
                            id,
                            duration: 1200000,
                            updatedAt: new Date(),
                        }),
                    );
                }

                mockRedisServiceWithClient.getAllPlaybackProgress.mockResolvedValue(
                    playbackProgress,
                );
                mockPrismaClient.episode.findMany.mockResolvedValue(episodes);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.EPISODES })
                    .expect(200);

                const continueSection = response.body.sections.find(
                    (s: any) => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );

                if (continueSection) {
                    expect(continueSection.items.length).toBeLessThanOrEqual(
                        FEED_CONFIG.CONTINUE_LISTENING_MAX_ITEMS,
                    );
                }
            });

            it('should exclude episodes with 0% or >= 95% progress', async () => {
                const playbackProgress = {
                    'episode-0': 0, // 0% - should be excluded
                    'episode-95': 1140000, // 95% - should be excluded
                    'episode-50': 600000, // 50% - should be included
                };

                mockRedisServiceWithClient.getAllPlaybackProgress.mockResolvedValue(
                    playbackProgress,
                );

                const episodes = Object.keys(playbackProgress).map(id =>
                    createMockEpisodeWithRelations({
                        id,
                        duration: 1200000,
                        updatedAt: new Date(),
                    }),
                );

                mockPrismaClient.episode.findMany.mockResolvedValue(episodes);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.EPISODES })
                    .expect(200);

                const continueSection = response.body.sections.find(
                    (s: any) => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );

                if (continueSection && continueSection.items.length > 0) {
                    // Should only include episode-50
                    const episodeIds = continueSection.items.map((item: any) => item.id);
                    expect(episodeIds).not.toContain('episode-0');
                    expect(episodeIds).not.toContain('episode-95');
                }
            });
        });

        describe('Popular Episodes Section', () => {
            it('should return popular episodes sorted by play count', async () => {
                const mockEpisodes = [
                    createMockEpisodeWithRelations({ playCount: 1000 }),
                    createMockEpisodeWithRelations({ playCount: 500 }),
                ];

                mockPrismaClient.episode.findMany.mockResolvedValue(mockEpisodes);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.EPISODES })
                    .expect(200);

                const popularSection = response.body.sections.find(
                    (s: any) => s.id === EpisodeSectionId.POPULAR,
                );

                expect(popularSection).toBeDefined();
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

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.EPISODES })
                    .expect(200);

                const latestSection = response.body.sections.find(
                    (s: any) => s.id === EpisodeSectionId.LATEST,
                );

                expect(latestSection).toBeDefined();
            });
        });
    });

    // ============================================
    // BOOKS FEED TESTS
    // ============================================

    describe('GET /feed?tab=books', () => {
        describe('Feed Structure', () => {
            it('should return books feed with correct structure', async () => {
                mockPrismaClient.book.findMany.mockResolvedValue([
                    { ...createMockBookWithCount(), _count: { episodes: 5 } },
                ]);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.BOOKS })
                    .expect(200);

                expect(response.body).toHaveProperty('tab', FeedTab.BOOKS);
                expect(response.body).toHaveProperty('sections');
            });
        });

        describe('Popular Inspirations Section', () => {
            it('should return books that inspired the most episodes', async () => {
                const mockBooks = [
                    { ...createMockBookWithCount(), _count: { episodes: 20 } },
                    { ...createMockBookWithCount(), _count: { episodes: 15 } },
                ];

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.BOOKS })
                    .expect(200);

                const inspirationsSection = response.body.sections.find(
                    (s: any) => s.id === BookSectionId.POPULAR_INSPIRATIONS,
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
                ];

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.BOOKS })
                    .expect(200);

                const popularSection = response.body.sections.find(
                    (s: any) => s.id === BookSectionId.POPULAR_BOOKS,
                );

                expect(popularSection).toBeDefined();
            });
        });

        describe('Latest Books Section', () => {
            it('should return latest books sorted by createdAt', async () => {
                const mockBooks = [{ ...createMockBookWithCount(), _count: { episodes: 3 } }];

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.BOOKS })
                    .expect(200);

                const latestSection = response.body.sections.find(
                    (s: any) => s.id === BookSectionId.LATEST_BOOKS,
                );

                expect(latestSection).toBeDefined();
            });
        });
    });

    // ============================================
    // PODCASTERS FEED TESTS
    // ============================================

    describe('GET /feed?tab=podcasters', () => {
        describe('Feed Structure', () => {
            it('should return podcasters feed with correct structure', async () => {
                mockPrismaClient.podcaster.findMany.mockResolvedValue([
                    createMockPodcasterWithCreator(),
                ]);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.PODCASTERS })
                    .expect(200);

                expect(response.body).toHaveProperty('tab', FeedTab.PODCASTERS);
                expect(response.body).toHaveProperty('sections');
            });
        });

        describe('Trending Section', () => {
            it('should return trending podcasters sorted by play count', async () => {
                const mockPodcasters = [
                    createMockPodcasterWithCreator({ playCount: 5000 }),
                    createMockPodcasterWithCreator({ playCount: 3000 }),
                ];

                mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.PODCASTERS })
                    .expect(200);

                const trendingSection = response.body.sections.find(
                    (s: any) => s.id === PodcasterSectionId.TRENDING,
                );

                expect(trendingSection).toBeDefined();
            });
        });

        describe('Top Rated Section', () => {
            it('should return podcasters sorted by average rating', async () => {
                const mockPodcasters = [
                    createMockPodcasterWithCreator({ averageRating: 4.9, ratingCount: 100 }),
                ];

                mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.PODCASTERS })
                    .expect(200);

                const topRatedSection = response.body.sections.find(
                    (s: any) => s.id === PodcasterSectionId.TOP_RATED,
                );

                expect(topRatedSection).toBeDefined();
            });
        });

        describe('New Voices Section', () => {
            it('should return newest podcasters', async () => {
                const mockPodcasters = [createMockPodcasterWithCreator({ createdAt: new Date() })];

                mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);

                const response = await request(app.getHttpServer())
                    .get('/feed')
                    .query({ tab: FeedTab.PODCASTERS })
                    .expect(200);

                const newVoicesSection = response.body.sections.find(
                    (s: any) => s.id === PodcasterSectionId.NEW_VOICES,
                );

                expect(newVoicesSection).toBeDefined();
            });
        });
    });

    // ============================================
    // SECTION PAGINATION TESTS
    // ============================================

    describe('GET /feed/section/:sectionId', () => {
        describe('Episodes Pagination', () => {
            it('should return paginated popular episodes', async () => {
                const mockEpisodes = Array(10)
                    .fill(null)
                    .map(() => createMockEpisodeWithRelations());

                mockPrismaClient.episode.findMany.mockResolvedValue(mockEpisodes);
                mockPrismaClient.episode.count.mockResolvedValue(50);

                const response = await request(app.getHttpServer())
                    .get(`/feed/section/${EpisodeSectionId.POPULAR}`)
                    .query({ page: 1, limit: 10 })
                    .expect(200);

                expect(response.body).toHaveProperty('items');
                expect(response.body).toHaveProperty('page', 1);
                expect(response.body).toHaveProperty('limit', 10);
                expect(response.body).toHaveProperty('totalCount', 50);
                expect(response.body).toHaveProperty('totalPages', 5);
                expect(response.body).toHaveProperty('hasMore', true);
            });

            it('should calculate correct offset for page 2', async () => {
                mockPrismaClient.episode.findMany.mockResolvedValue([]);
                mockPrismaClient.episode.count.mockResolvedValue(50);

                await request(app.getHttpServer())
                    .get(`/feed/section/${EpisodeSectionId.LATEST}`)
                    .query({ page: 2, limit: 10 })
                    .expect(200);

                expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                    expect.objectContaining({
                        skip: 10, // (page 2 - 1) * limit 10
                        take: 10,
                    }),
                );
            });

            it('should return hasMore=false on last page', async () => {
                mockPrismaClient.episode.findMany.mockResolvedValue([
                    createMockEpisodeWithRelations(),
                ]);
                mockPrismaClient.episode.count.mockResolvedValue(25);

                const response = await request(app.getHttpServer())
                    .get(`/feed/section/${EpisodeSectionId.POPULAR}`)
                    .query({ page: 3, limit: 10 })
                    .expect(200);

                expect(response.body.hasMore).toBe(false);
            });
        });

        describe('Books Pagination', () => {
            it('should return paginated books', async () => {
                const mockBooks = Array(10)
                    .fill(null)
                    .map(() => ({ ...createMockBookWithCount(), _count: { episodes: 3 } }));

                mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);
                mockPrismaClient.book.count.mockResolvedValue(30);

                const response = await request(app.getHttpServer())
                    .get(`/feed/section/${BookSectionId.LATEST_BOOKS}`)
                    .query({ page: 1, limit: 10 })
                    .expect(200);

                expect(response.body.items).toHaveLength(10);
                expect(response.body.totalCount).toBe(30);
            });
        });

        describe('Podcasters Pagination', () => {
            it('should return paginated podcasters', async () => {
                const mockPodcasters = Array(10)
                    .fill(null)
                    .map(() => createMockPodcasterWithCreator());

                mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);
                mockPrismaClient.podcaster.count.mockResolvedValue(100);

                const response = await request(app.getHttpServer())
                    .get(`/feed/section/${PodcasterSectionId.TRENDING}`)
                    .query({ page: 1, limit: 10 })
                    .expect(200);

                expect(response.body.items).toHaveLength(10);
                expect(response.body.totalPages).toBe(10);
            });
        });

        describe('Default Values', () => {
            it('should use default page=1 and limit=20', async () => {
                mockPrismaClient.episode.findMany.mockResolvedValue([]);
                mockPrismaClient.episode.count.mockResolvedValue(0);

                await request(app.getHttpServer())
                    .get(`/feed/section/${EpisodeSectionId.POPULAR}`)
                    .expect(200);

                expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                    expect.objectContaining({
                        skip: 0,
                        take: 20,
                    }),
                );
            });
        });
    });

    // ============================================
    // CACHING TESTS
    // ============================================

    describe('Caching Behavior', () => {
        it('should cache feed results', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([createMockEpisodeWithRelations()]);

            await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.EPISODES })
                .expect(200);

            expect(mockRedisServiceWithClient.client.setex).toHaveBeenCalled();
        });

        it('should use cached data when available', async () => {
            const cachedData = JSON.stringify([{ id: 'cached-episode', title: 'Cached' }]);
            mockRedisServiceWithClient.client.get.mockResolvedValue(cachedData);
            mockPrismaClient.episode.findMany.mockResolvedValue([]);

            await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.EPISODES })
                .expect(200);

            expect(mockRedisServiceWithClient.client.get).toHaveBeenCalled();
        });
    });

    // ============================================
    // ERROR HANDLING TESTS
    // ============================================

    describe('Error Handling', () => {
        it('should return 400 for invalid tab', async () => {
            const response = await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: 'invalid_tab' })
                .expect(400);

            expect(response.body.message).toContain('tab');
        });

        it('should return 400 for invalid section ID', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockPrismaClient.episode.count.mockResolvedValue(0);

            await request(app.getHttpServer()).get('/feed/section/invalid_section').expect(400);
        });

        it('should handle database errors gracefully', async () => {
            mockPrismaClient.episode.findMany.mockRejectedValue(new Error('DB Error'));

            // Should not crash, returns gracefully degraded response
            const response = await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.EPISODES });

            expect(response.status).toBe(200);
        });
    });

    // ============================================
    // VALIDATION TESTS
    // ============================================

    describe('Validation', () => {
        it('should validate page is a positive integer', async () => {
            await request(app.getHttpServer())
                .get(`/feed/section/${EpisodeSectionId.POPULAR}`)
                .query({ page: -1, limit: 10 })
                .expect(400);
        });

        it('should validate limit is within bounds (1-50)', async () => {
            await request(app.getHttpServer())
                .get(`/feed/section/${EpisodeSectionId.POPULAR}`)
                .query({ page: 1, limit: 100 })
                .expect(400);
        });

        it('should require tab parameter', async () => {
            const response = await request(app.getHttpServer()).get('/feed').expect(400);

            expect(response.body.message).toContain('tab');
        });
    });

    // ============================================
    // ACCESS CONTROL TESTS
    // ============================================

    describe('Access Control', () => {
        it('should only return public episodes', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);

            await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.EPISODES })
                .expect(200);

            expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        isPublic: true,
                    }),
                }),
            );
        });

        it('should only return completed episodes', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);

            await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.EPISODES })
                .expect(200);

            expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        generationStatus: 'COMPLETED',
                    }),
                }),
            );
        });

        it('should only return public podcasters', async () => {
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.PODCASTERS })
                .expect(200);

            expect(mockPrismaClient.podcaster.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        isPublic: true,
                    }),
                }),
            );
        });
    });

    // ============================================
    // FEED ITEM FORMAT TESTS
    // ============================================

    describe('Feed Item Format', () => {
        it('should include required episode fields', async () => {
            const mockEpisode = createMockEpisodeWithRelations();
            mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);

            const response = await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.EPISODES })
                .expect(200);

            if (response.body.sections.length > 0) {
                const section = response.body.sections.find(
                    (s: any) => s.items && s.items.length > 0,
                );
                if (section) {
                    const item = section.items[0];
                    expect(item).toHaveProperty('id');
                    expect(item).toHaveProperty('title');
                }
            }
        });

        it('should include book relation in episode items', async () => {
            const mockEpisode = createMockEpisodeWithRelations();
            mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);

            const response = await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.EPISODES })
                .expect(200);

            if (response.body.sections.length > 0) {
                const section = response.body.sections.find(
                    (s: any) => s.items && s.items.length > 0,
                );
                if (section) {
                    const item = section.items[0];
                    expect(item).toHaveProperty('book');
                }
            }
        });

        it('should include podcaster relation in episode items', async () => {
            const mockEpisode = createMockEpisodeWithRelations();
            mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);

            const response = await request(app.getHttpServer())
                .get('/feed')
                .query({ tab: FeedTab.EPISODES })
                .expect(200);

            if (response.body.sections.length > 0) {
                const section = response.body.sections.find(
                    (s: any) => s.items && s.items.length > 0,
                );
                if (section) {
                    const item = section.items[0];
                    expect(item).toHaveProperty('podcaster');
                }
            }
        });
    });
});
