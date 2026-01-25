import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchScope } from './dto';
import { mockSearchService } from '../../../test/mocks/services.mock';
import {
    createMockEpisodeSearchResult,
    createMockBookSearchResult,
    createMockPodcasterSearchResult,
    mockUserId,
} from '../../../test/fixtures/search.fixture';

describe('SearchController', () => {
    let controller: SearchController;
    let searchService: SearchService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SearchController],
            providers: [
                {
                    provide: SearchService,
                    useValue: mockSearchService,
                },
            ],
        }).compile();

        controller = module.get<SearchController>(SearchController);
        searchService = module.get<SearchService>(SearchService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ============================================
    // SEARCH ENDPOINT TESTS
    // ============================================

    describe('GET /search', () => {
        it('should call search service with correct parameters', async () => {
            const query = { q: 'test', scope: SearchScope.ALL, page: 1, limit: 10 };
            const req = { user: { userId: mockUserId } };

            await controller.search(query, req);

            expect(searchService.search).toHaveBeenCalledWith(query, mockUserId);
        });

        it('should work for unauthenticated users', async () => {
            const query = { q: 'test', scope: SearchScope.ALL, page: 1, limit: 10 };
            const req = { user: undefined };

            await controller.search(query, req);

            expect(searchService.search).toHaveBeenCalledWith(query, undefined);
        });

        it('should return grouped results for ALL scope', async () => {
            const mockResponse = {
                query: 'test',
                episodes: {
                    results: [createMockEpisodeSearchResult()],
                    total: 1,
                    hasMore: false,
                },
                books: {
                    results: [createMockBookSearchResult()],
                    total: 1,
                    hasMore: false,
                },
                podcasters: {
                    results: [createMockPodcasterSearchResult()],
                    total: 1,
                    hasMore: false,
                },
            };

            mockSearchService.search.mockResolvedValueOnce(mockResponse);

            const result = await controller.search(
                { q: 'test', scope: SearchScope.ALL, page: 1, limit: 10 },
                { user: { userId: mockUserId } },
            );

            expect(result).toEqual(mockResponse);
        });

        it('should return scoped results for EPISODES scope', async () => {
            const mockResponse = {
                query: 'test',
                scope: SearchScope.EPISODES,
                results: [createMockEpisodeSearchResult()],
                total: 1,
                page: 1,
                totalPages: 1,
                hasMore: false,
            };

            mockSearchService.search.mockResolvedValueOnce(mockResponse);

            const result = await controller.search(
                { q: 'test', scope: SearchScope.EPISODES, page: 1, limit: 10 },
                { user: { userId: mockUserId } },
            );

            expect(result).toEqual(mockResponse);
        });

        it('should return scoped results for BOOKS scope', async () => {
            const mockResponse = {
                query: 'test',
                scope: SearchScope.BOOKS,
                results: [createMockBookSearchResult()],
                total: 1,
                page: 1,
                totalPages: 1,
                hasMore: false,
            };

            mockSearchService.search.mockResolvedValueOnce(mockResponse);

            const result = await controller.search(
                { q: 'test', scope: SearchScope.BOOKS, page: 1, limit: 10 },
                { user: { userId: mockUserId } },
            );

            expect(result).toEqual(mockResponse);
        });

        it('should return scoped results for PODCASTERS scope', async () => {
            const mockResponse = {
                query: 'test',
                scope: SearchScope.PODCASTERS,
                results: [createMockPodcasterSearchResult()],
                total: 1,
                page: 1,
                totalPages: 1,
                hasMore: false,
            };

            mockSearchService.search.mockResolvedValueOnce(mockResponse);

            const result = await controller.search(
                { q: 'test', scope: SearchScope.PODCASTERS, page: 1, limit: 10 },
                { user: { userId: mockUserId } },
            );

            expect(result).toEqual(mockResponse);
        });

        it('should use default pagination values', async () => {
            await controller.search(
                { q: 'test' } as any,
                { user: { userId: mockUserId } },
            );

            expect(searchService.search).toHaveBeenCalledWith(
                expect.objectContaining({ q: 'test' }),
                mockUserId,
            );
        });
    });

    // ============================================
    // SUGGESTIONS ENDPOINT TESTS
    // ============================================

    describe('GET /search/suggestions', () => {
        it('should call getSuggestions with correct parameters', async () => {
            const req = { user: { userId: mockUserId } };

            await controller.getSuggestions('test', '5', req);

            expect(searchService.getSuggestions).toHaveBeenCalledWith('test', mockUserId, 5);
        });

        it('should use default limit when not provided', async () => {
            const req = { user: { userId: mockUserId } };

            await controller.getSuggestions('test', undefined, req);

            expect(searchService.getSuggestions).toHaveBeenCalledWith('test', mockUserId, 5);
        });

        it('should cap limit at 10', async () => {
            const req = { user: { userId: mockUserId } };

            await controller.getSuggestions('test', '50', req);

            expect(searchService.getSuggestions).toHaveBeenCalledWith('test', mockUserId, 10);
        });

        it('should work for unauthenticated users', async () => {
            const req = undefined;

            await controller.getSuggestions('test', '5', req);

            expect(searchService.getSuggestions).toHaveBeenCalledWith('test', undefined, 5);
        });

        it('should return suggestions from all categories', async () => {
            const mockSuggestions = {
                episodes: [{ id: 'ep-1', title: 'Test Episode' }],
                books: [{ id: 'book-1', title: 'Test Book' }],
                podcasters: [{ id: 'pod-1', name: 'Test Podcaster' }],
            };

            mockSearchService.getSuggestions.mockResolvedValueOnce(mockSuggestions);

            const result = await controller.getSuggestions(
                'test',
                '5',
                { user: { userId: mockUserId } },
            );

            expect(result).toEqual(mockSuggestions);
        });
    });

    // ============================================
    // ERROR HANDLING TESTS
    // ============================================

    describe('error handling', () => {
        it('should propagate errors from search service', async () => {
            mockSearchService.search.mockRejectedValueOnce(new Error('Service error'));

            await expect(
                controller.search(
                    { q: 'test', scope: SearchScope.ALL, page: 1, limit: 10 },
                    { user: { userId: mockUserId } },
                ),
            ).rejects.toThrow('Service error');
        });

        it('should propagate errors from getSuggestions', async () => {
            mockSearchService.getSuggestions.mockRejectedValueOnce(
                new Error('Suggestions error'),
            );

            await expect(
                controller.getSuggestions('test', '5', { user: { userId: mockUserId } }),
            ).rejects.toThrow('Suggestions error');
        });
    });
});
