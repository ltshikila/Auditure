import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
import { DatabaseService } from '../database/database.service';
import { SearchScope, SearchResponseDto, ScopedSearchResponseDto } from './dto';
import { mockPrismaClient } from '../../test/mocks/database.mock';
import {
    createMockPrismaEpisode,
    createMockPrismaBook,
    createMockPrismaPodcaster,
    mockUserId,
} from '../../test/fixtures/search.fixture';

describe('SearchService', () => {
    let service: SearchService;
    let databaseService: DatabaseService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SearchService,
                {
                    provide: DatabaseService,
                    useValue: mockPrismaClient,
                },
            ],
        }).compile();

        service = module.get<SearchService>(SearchService);
        databaseService = module.get<DatabaseService>(DatabaseService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ============================================
    // SEARCH VALIDATION TESTS
    // ============================================

    describe('search validation', () => {
        it('should throw BadRequestException for empty query', async () => {
            await expect(
                service.search({ q: '', scope: SearchScope.ALL, page: 1, limit: 10 }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for whitespace-only query', async () => {
            await expect(
                service.search({ q: '   ', scope: SearchScope.ALL, page: 1, limit: 10 }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should sanitize special characters from query', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockPrismaClient.episode.count.mockResolvedValue(0);
            mockPrismaClient.book.findMany.mockResolvedValue([]);
            mockPrismaClient.book.count.mockResolvedValue(0);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);
            mockPrismaClient.podcaster.count.mockResolvedValue(0);

            const result = await service.search({
                q: '<script>alert("test")</script>',
                scope: SearchScope.ALL,
                page: 1,
                limit: 10,
            });

            // Should complete without error (sanitized query)
            expect(result).toBeDefined();
        });

        it('should truncate query to 100 characters', async () => {
            const longQuery = 'a'.repeat(150);
            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockPrismaClient.episode.count.mockResolvedValue(0);
            mockPrismaClient.book.findMany.mockResolvedValue([]);
            mockPrismaClient.book.count.mockResolvedValue(0);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);
            mockPrismaClient.podcaster.count.mockResolvedValue(0);

            const result = await service.search({
                q: longQuery,
                scope: SearchScope.ALL,
                page: 1,
                limit: 10,
            });

            expect(result).toBeDefined();
        });
    });

    // ============================================
    // SEARCH ALL TESTS
    // ============================================

    describe('search all', () => {
        it('should return grouped results for all categories', async () => {
            const mockEpisode = createMockPrismaEpisode();
            const mockBook = createMockPrismaBook();
            const mockPodcaster = createMockPrismaPodcaster();

            mockPrismaClient.episode.findMany.mockResolvedValue([mockEpisode]);
            mockPrismaClient.episode.count.mockResolvedValue(1);
            mockPrismaClient.book.findMany.mockResolvedValue([mockBook]);
            mockPrismaClient.book.count.mockResolvedValue(1);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([mockPodcaster]);
            mockPrismaClient.podcaster.count.mockResolvedValue(1);

            const result = (await service.search(
                { q: 'test', scope: SearchScope.ALL, page: 1, limit: 10 },
                mockUserId,
            )) as SearchResponseDto;

            expect(result.query).toBe('test');
            expect(result.episodes.results).toHaveLength(1);
            expect(result.books.results).toHaveLength(1);
            expect(result.podcasters.results).toHaveLength(1);
        });

        it('should set hasMore flag when more results exist', async () => {
            const episodes = Array.from({ length: 5 }, (_, i) =>
                createMockPrismaEpisode({ id: `ep-${i}` }),
            );

            mockPrismaClient.episode.findMany.mockResolvedValue(episodes);
            mockPrismaClient.episode.count.mockResolvedValue(15); // More than limit
            mockPrismaClient.book.findMany.mockResolvedValue([]);
            mockPrismaClient.book.count.mockResolvedValue(0);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);
            mockPrismaClient.podcaster.count.mockResolvedValue(0);

            const result = (await service.search(
                { q: 'test', scope: SearchScope.ALL, page: 1, limit: 5 },
                mockUserId,
            )) as SearchResponseDto;

            expect(result.episodes.hasMore).toBe(true);
            expect(result.episodes.total).toBe(15);
        });

        it('should search in parallel for performance', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockPrismaClient.episode.count.mockResolvedValue(0);
            mockPrismaClient.book.findMany.mockResolvedValue([]);
            mockPrismaClient.book.count.mockResolvedValue(0);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);
            mockPrismaClient.podcaster.count.mockResolvedValue(0);

            await service.search(
                { q: 'test', scope: SearchScope.ALL, page: 1, limit: 10 },
                mockUserId,
            );

            // All three searches should have been called
            expect(mockPrismaClient.episode.findMany).toHaveBeenCalled();
            expect(mockPrismaClient.book.findMany).toHaveBeenCalled();
            expect(mockPrismaClient.podcaster.findMany).toHaveBeenCalled();
        });
    });

    // ============================================
    // SCOPED SEARCH TESTS
    // ============================================

    describe('search episodes', () => {
        it('should return paginated episode results', async () => {
            const episodes = Array.from({ length: 5 }, (_, i) =>
                createMockPrismaEpisode({ id: `ep-${i}` }),
            );

            mockPrismaClient.episode.findMany.mockResolvedValue(episodes);
            mockPrismaClient.episode.count.mockResolvedValue(25);

            const result = (await service.search(
                { q: 'test', scope: SearchScope.EPISODES, page: 2, limit: 5 },
                mockUserId,
            )) as ScopedSearchResponseDto;

            expect(result.scope).toBe(SearchScope.EPISODES);
            expect(result.results).toHaveLength(5);
            expect(result.total).toBe(25);
            expect(result.page).toBe(2);
            expect(result.totalPages).toBe(5);
            expect(result.hasMore).toBe(true);
        });

        it('should only return completed episodes', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockPrismaClient.episode.count.mockResolvedValue(0);

            await service.search(
                { q: 'test', scope: SearchScope.EPISODES, page: 1, limit: 10 },
                mockUserId,
            );

            expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        generationStatus: 'COMPLETED',
                    }),
                }),
            );
        });

        it("should include public episodes and user's own episodes", async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockPrismaClient.episode.count.mockResolvedValue(0);

            await service.search(
                { q: 'test', scope: SearchScope.EPISODES, page: 1, limit: 10 },
                mockUserId,
            );

            expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        AND: expect.arrayContaining([
                            expect.objectContaining({
                                OR: expect.arrayContaining([
                                    { isPublic: true },
                                    { userId: mockUserId },
                                ]),
                            }),
                        ]),
                    }),
                }),
            );
        });
    });

    describe('search books', () => {
        it('should return empty results for unauthenticated users', async () => {
            const result = (await service.search(
                { q: 'test', scope: SearchScope.BOOKS, page: 1, limit: 10 },
                undefined, // No userId
            )) as ScopedSearchResponseDto;

            expect(result.results).toHaveLength(0);
            expect(result.total).toBe(0);
            expect(mockPrismaClient.book.findMany).not.toHaveBeenCalled();
        });

        it("should only search user's own books", async () => {
            mockPrismaClient.book.findMany.mockResolvedValue([]);
            mockPrismaClient.book.count.mockResolvedValue(0);

            await service.search(
                { q: 'test', scope: SearchScope.BOOKS, page: 1, limit: 10 },
                mockUserId,
            );

            expect(mockPrismaClient.book.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: mockUserId,
                        extractionStatus: 'COMPLETED',
                    }),
                }),
            );
        });

        it('should search by title and author', async () => {
            mockPrismaClient.book.findMany.mockResolvedValue([]);
            mockPrismaClient.book.count.mockResolvedValue(0);

            await service.search(
                { q: 'philosophy', scope: SearchScope.BOOKS, page: 1, limit: 10 },
                mockUserId,
            );

            expect(mockPrismaClient.book.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            expect.objectContaining({
                                title: { contains: 'philosophy', mode: 'insensitive' },
                            }),
                            expect.objectContaining({
                                author: { contains: 'philosophy', mode: 'insensitive' },
                            }),
                        ]),
                    }),
                }),
            );
        });
    });

    describe('search podcasters', () => {
        it('should return paginated podcaster results', async () => {
            const podcasters = Array.from({ length: 3 }, (_, i) =>
                createMockPrismaPodcaster({ id: `pod-${i}` }),
            );

            mockPrismaClient.podcaster.findMany.mockResolvedValue(podcasters);
            mockPrismaClient.podcaster.count.mockResolvedValue(3);

            const result = (await service.search(
                { q: 'philosophy', scope: SearchScope.PODCASTERS, page: 1, limit: 10 },
                mockUserId,
            )) as ScopedSearchResponseDto;

            expect(result.scope).toBe(SearchScope.PODCASTERS);
            expect(result.results).toHaveLength(3);
        });

        it('should search by name, description, and expertise tags', async () => {
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);
            mockPrismaClient.podcaster.count.mockResolvedValue(0);

            await service.search(
                { q: 'philosophy', scope: SearchScope.PODCASTERS, page: 1, limit: 10 },
                mockUserId,
            );

            expect(mockPrismaClient.podcaster.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            expect.objectContaining({
                                name: { contains: 'philosophy', mode: 'insensitive' },
                            }),
                            expect.objectContaining({
                                description: { contains: 'philosophy', mode: 'insensitive' },
                            }),
                            expect.objectContaining({ expertiseTags: { hasSome: ['philosophy'] } }),
                        ]),
                    }),
                }),
            );
        });

        it('should include creator information', async () => {
            const podcaster = createMockPrismaPodcaster();
            mockPrismaClient.podcaster.findMany.mockResolvedValue([podcaster]);
            mockPrismaClient.podcaster.count.mockResolvedValue(1);

            const result = (await service.search(
                { q: 'test', scope: SearchScope.PODCASTERS, page: 1, limit: 10 },
                mockUserId,
            )) as ScopedSearchResponseDto;

            expect((result.results[0] as any).creator).toBeDefined();
            expect((result.results[0] as any).creator.firstName).toBe('John');
        });
    });

    // ============================================
    // SUGGESTIONS TESTS
    // ============================================

    describe('getSuggestions', () => {
        it('should return empty results for query less than 2 characters', async () => {
            const result = await service.getSuggestions('a', mockUserId);

            expect(result.episodes).toHaveLength(0);
            expect(result.books).toHaveLength(0);
            expect(result.podcasters).toHaveLength(0);
        });

        it('should return suggestions from all categories', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([
                { id: 'ep-1', title: 'Test Episode' },
            ]);
            mockPrismaClient.book.findMany.mockResolvedValue([
                { id: 'book-1', title: 'Test Book' },
            ]);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([
                { id: 'pod-1', name: 'Test Podcaster' },
            ]);

            const result = await service.getSuggestions('test', mockUserId, 5);

            expect(result.episodes).toHaveLength(1);
            expect(result.books).toHaveLength(1);
            expect(result.podcasters).toHaveLength(1);
        });

        it('should not return book suggestions for unauthenticated users', async () => {
            mockPrismaClient.episode.findMany.mockResolvedValue([]);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            const result = await service.getSuggestions('test', undefined, 5);

            expect(result.books).toHaveLength(0);
            expect(mockPrismaClient.book.findMany).not.toHaveBeenCalled();
        });

        it('should limit suggestions per category', async () => {
            const episodes = Array.from({ length: 10 }, (_, i) => ({
                id: `ep-${i}`,
                title: `Episode ${i}`,
            }));

            mockPrismaClient.episode.findMany.mockResolvedValue(episodes.slice(0, 3));
            mockPrismaClient.book.findMany.mockResolvedValue([]);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            const result = await service.getSuggestions('test', mockUserId, 3);

            expect(mockPrismaClient.episode.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 3,
                }),
            );
        });
    });

    // ============================================
    // ERROR HANDLING TESTS
    // ============================================

    describe('error handling', () => {
        it('should handle database errors gracefully', async () => {
            mockPrismaClient.episode.findMany.mockRejectedValue(
                new Error('Database connection failed'),
            );

            await expect(
                service.search(
                    { q: 'test', scope: SearchScope.EPISODES, page: 1, limit: 10 },
                    mockUserId,
                ),
            ).rejects.toThrow('Database connection failed');
        });

        it('should log errors when they occur', async () => {
            const loggerSpy = jest.spyOn((service as any).logger, 'error');
            mockPrismaClient.episode.findMany.mockRejectedValue(new Error('Test error'));

            await expect(
                service.search(
                    { q: 'test', scope: SearchScope.EPISODES, page: 1, limit: 10 },
                    mockUserId,
                ),
            ).rejects.toThrow();

            expect(loggerSpy).toHaveBeenCalled();
        });
    });
});
