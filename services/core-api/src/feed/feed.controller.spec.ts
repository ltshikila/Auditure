import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedTab, EpisodeSectionId, BookSectionId, PodcasterSectionId } from './dto/feed-query.dto';
import {
    createMockEpisodesFeedResponse,
    createMockBooksFeedResponse,
    createMockPodcastersFeedResponse,
    createMockEpisodeFeedItem,
    createMockBookFeedItem,
    createMockPodcasterFeedItem,
    MOCK_USER_ID,
} from '../../test/fixtures/feed.fixture';

const mockFeedService = {
    getFeed: jest.fn(),
    getSectionData: jest.fn(),
};

describe('FeedController', () => {
    let controller: FeedController;
    let feedService: FeedService;

    const mockRequest = {
        user: { userId: MOCK_USER_ID },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [FeedController],
            providers: [
                {
                    provide: FeedService,
                    useValue: mockFeedService,
                },
            ],
        }).compile();

        controller = module.get<FeedController>(FeedController);
        feedService = module.get<FeedService>(FeedService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ============================================
    // GET /feed TESTS
    // ============================================

    describe('GET /feed', () => {
        describe('Episodes Tab', () => {
            it('should call feed service with correct parameters', async () => {
                const mockResponse = createMockEpisodesFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                await controller.getFeed(mockRequest, { tab: FeedTab.EPISODES });

                expect(feedService.getFeed).toHaveBeenCalledWith(FeedTab.EPISODES, MOCK_USER_ID);
            });

            it('should return episodes feed response', async () => {
                const mockResponse = createMockEpisodesFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.EPISODES });

                expect(result).toEqual(mockResponse);
                expect(result.tab).toBe(FeedTab.EPISODES);
                expect(result.sections).toBeDefined();
                expect(result.sections.length).toBeGreaterThan(0);
            });

            it('should include continue listening section', async () => {
                const mockResponse = createMockEpisodesFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.EPISODES });

                const continueSection = result.sections.find(
                    (s) => s.id === EpisodeSectionId.CONTINUE_LISTENING,
                );
                expect(continueSection).toBeDefined();
            });

            it('should include popular episodes section', async () => {
                const mockResponse = createMockEpisodesFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.EPISODES });

                const popularSection = result.sections.find(
                    (s) => s.id === EpisodeSectionId.POPULAR,
                );
                expect(popularSection).toBeDefined();
            });

            it('should include latest episodes section', async () => {
                const mockResponse = createMockEpisodesFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.EPISODES });

                const latestSection = result.sections.find(
                    (s) => s.id === EpisodeSectionId.LATEST,
                );
                expect(latestSection).toBeDefined();
            });
        });

        describe('Books Tab', () => {
            it('should call feed service with correct parameters', async () => {
                const mockResponse = createMockBooksFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                await controller.getFeed(mockRequest, { tab: FeedTab.BOOKS });

                expect(feedService.getFeed).toHaveBeenCalledWith(FeedTab.BOOKS, MOCK_USER_ID);
            });

            it('should return books feed response', async () => {
                const mockResponse = createMockBooksFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.BOOKS });

                expect(result).toEqual(mockResponse);
                expect(result.tab).toBe(FeedTab.BOOKS);
                expect(result.sections).toBeDefined();
            });

            it('should include popular inspirations section', async () => {
                const mockResponse = createMockBooksFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.BOOKS });

                const inspirationsSection = result.sections.find(
                    (s) => s.id === BookSectionId.POPULAR_INSPIRATIONS,
                );
                expect(inspirationsSection).toBeDefined();
            });

            it('should include popular books section', async () => {
                const mockResponse = createMockBooksFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.BOOKS });

                const popularSection = result.sections.find(
                    (s) => s.id === BookSectionId.POPULAR_BOOKS,
                );
                expect(popularSection).toBeDefined();
            });
        });

        describe('Podcasters Tab', () => {
            it('should call feed service with correct parameters', async () => {
                const mockResponse = createMockPodcastersFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                await controller.getFeed(mockRequest, { tab: FeedTab.PODCASTERS });

                expect(feedService.getFeed).toHaveBeenCalledWith(FeedTab.PODCASTERS, MOCK_USER_ID);
            });

            it('should return podcasters feed response', async () => {
                const mockResponse = createMockPodcastersFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.PODCASTERS });

                expect(result).toEqual(mockResponse);
                expect(result.tab).toBe(FeedTab.PODCASTERS);
                expect(result.sections).toBeDefined();
            });

            it('should include trending section', async () => {
                const mockResponse = createMockPodcastersFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.PODCASTERS });

                const trendingSection = result.sections.find(
                    (s) => s.id === PodcasterSectionId.TRENDING,
                );
                expect(trendingSection).toBeDefined();
            });

            it('should include top rated section', async () => {
                const mockResponse = createMockPodcastersFeedResponse();
                mockFeedService.getFeed.mockResolvedValue(mockResponse);

                const result = await controller.getFeed(mockRequest, { tab: FeedTab.PODCASTERS });

                const topRatedSection = result.sections.find(
                    (s) => s.id === PodcasterSectionId.TOP_RATED,
                );
                expect(topRatedSection).toBeDefined();
            });
        });

        describe('Error Handling', () => {
            it('should propagate errors from feed service', async () => {
                mockFeedService.getFeed.mockRejectedValue(new Error('Service error'));

                await expect(
                    controller.getFeed(mockRequest, { tab: FeedTab.EPISODES }),
                ).rejects.toThrow('Service error');
            });

            it('should propagate BadRequestException for invalid tab', async () => {
                mockFeedService.getFeed.mockRejectedValue(
                    new BadRequestException('Invalid tab'),
                );

                await expect(
                    controller.getFeed(mockRequest, { tab: 'invalid' as FeedTab }),
                ).rejects.toThrow(BadRequestException);
            });
        });
    });

    // ============================================
    // GET /feed/section/:sectionId TESTS
    // ============================================

    describe('GET /feed/section/:sectionId', () => {
        describe('Episode Sections', () => {
            it('should call feed service with correct parameters', async () => {
                const mockResponse = {
                    items: [createMockEpisodeFeedItem()],
                    page: 1,
                    limit: 20,
                    totalCount: 50,
                    totalPages: 3,
                    hasMore: true,
                };
                mockFeedService.getSectionData.mockResolvedValue(mockResponse);

                await controller.getSectionData(
                    mockRequest,
                    EpisodeSectionId.POPULAR,
                    { page: 1, limit: 20 },
                );

                expect(feedService.getSectionData).toHaveBeenCalledWith(
                    EpisodeSectionId.POPULAR,
                    MOCK_USER_ID,
                    1,
                    20,
                );
            });

            it('should return paginated popular episodes', async () => {
                const mockResponse = {
                    items: Array(10)
                        .fill(null)
                        .map(() => createMockEpisodeFeedItem()),
                    page: 1,
                    limit: 20,
                    totalCount: 50,
                    totalPages: 3,
                    hasMore: true,
                };
                mockFeedService.getSectionData.mockResolvedValue(mockResponse);

                const result = await controller.getSectionData(
                    mockRequest,
                    EpisodeSectionId.POPULAR,
                    { page: 1, limit: 20 },
                );

                expect(result.items).toHaveLength(10);
                expect(result.totalCount).toBe(50);
                expect(result.hasMore).toBe(true);
            });

            it('should return paginated latest episodes', async () => {
                const mockResponse = {
                    items: [createMockEpisodeFeedItem()],
                    page: 1,
                    limit: 20,
                    totalCount: 10,
                    totalPages: 1,
                    hasMore: false,
                };
                mockFeedService.getSectionData.mockResolvedValue(mockResponse);

                const result = await controller.getSectionData(
                    mockRequest,
                    EpisodeSectionId.LATEST,
                    { page: 1, limit: 20 },
                );

                expect(result).toEqual(mockResponse);
            });
        });

        describe('Book Sections', () => {
            it('should return paginated books', async () => {
                const mockResponse = {
                    items: Array(5)
                        .fill(null)
                        .map(() => createMockBookFeedItem()),
                    page: 2,
                    limit: 10,
                    totalCount: 25,
                    totalPages: 3,
                    hasMore: true,
                };
                mockFeedService.getSectionData.mockResolvedValue(mockResponse);

                const result = await controller.getSectionData(
                    mockRequest,
                    BookSectionId.POPULAR_BOOKS,
                    { page: 2, limit: 10 },
                );

                expect(result.items).toHaveLength(5);
                expect(result.page).toBe(2);
                expect(result.totalPages).toBe(3);
            });
        });

        describe('Podcaster Sections', () => {
            it('should return paginated podcasters', async () => {
                const mockResponse = {
                    items: Array(10)
                        .fill(null)
                        .map(() => createMockPodcasterFeedItem()),
                    page: 1,
                    limit: 10,
                    totalCount: 100,
                    totalPages: 10,
                    hasMore: true,
                };
                mockFeedService.getSectionData.mockResolvedValue(mockResponse);

                const result = await controller.getSectionData(
                    mockRequest,
                    PodcasterSectionId.TRENDING,
                    { page: 1, limit: 10 },
                );

                expect(result.items).toHaveLength(10);
                expect(result.totalCount).toBe(100);
            });

            it('should return top rated podcasters', async () => {
                const mockResponse = {
                    items: [createMockPodcasterFeedItem()],
                    page: 1,
                    limit: 20,
                    totalCount: 1,
                    totalPages: 1,
                    hasMore: false,
                };
                mockFeedService.getSectionData.mockResolvedValue(mockResponse);

                const result = await controller.getSectionData(
                    mockRequest,
                    PodcasterSectionId.TOP_RATED,
                    { page: 1, limit: 20 },
                );

                expect(result).toEqual(mockResponse);
            });
        });

        describe('Default Values', () => {
            it('should use default page of 1 when not provided', async () => {
                const mockResponse = {
                    items: [],
                    page: 1,
                    limit: 20,
                    totalCount: 0,
                    totalPages: 0,
                    hasMore: false,
                };
                mockFeedService.getSectionData.mockResolvedValue(mockResponse);

                await controller.getSectionData(
                    mockRequest,
                    EpisodeSectionId.POPULAR,
                    { page: undefined, limit: 20 },
                );

                expect(feedService.getSectionData).toHaveBeenCalledWith(
                    EpisodeSectionId.POPULAR,
                    MOCK_USER_ID,
                    1, // Default page
                    20,
                );
            });

            it('should use default limit of 20 when not provided', async () => {
                const mockResponse = {
                    items: [],
                    page: 1,
                    limit: 20,
                    totalCount: 0,
                    totalPages: 0,
                    hasMore: false,
                };
                mockFeedService.getSectionData.mockResolvedValue(mockResponse);

                await controller.getSectionData(
                    mockRequest,
                    EpisodeSectionId.POPULAR,
                    { page: 1, limit: undefined },
                );

                expect(feedService.getSectionData).toHaveBeenCalledWith(
                    EpisodeSectionId.POPULAR,
                    MOCK_USER_ID,
                    1,
                    20, // Default limit
                );
            });
        });

        describe('Error Handling', () => {
            it('should propagate errors from feed service', async () => {
                mockFeedService.getSectionData.mockRejectedValue(
                    new Error('Section data error'),
                );

                await expect(
                    controller.getSectionData(
                        mockRequest,
                        EpisodeSectionId.POPULAR,
                        { page: 1, limit: 20 },
                    ),
                ).rejects.toThrow('Section data error');
            });

            it('should propagate BadRequestException for invalid section ID', async () => {
                mockFeedService.getSectionData.mockRejectedValue(
                    new BadRequestException('Invalid section ID'),
                );

                await expect(
                    controller.getSectionData(
                        mockRequest,
                        'invalid_section',
                        { page: 1, limit: 20 },
                    ),
                ).rejects.toThrow(BadRequestException);
            });
        });
    });

    // ============================================
    // USER CONTEXT TESTS
    // ============================================

    describe('User Context', () => {
        it('should extract userId from request', async () => {
            const mockResponse = createMockEpisodesFeedResponse();
            mockFeedService.getFeed.mockResolvedValue(mockResponse);

            await controller.getFeed(
                { user: { userId: 'custom-user-id' } },
                { tab: FeedTab.EPISODES },
            );

            expect(feedService.getFeed).toHaveBeenCalledWith(
                FeedTab.EPISODES,
                'custom-user-id',
            );
        });

        it('should pass userId to getSectionData', async () => {
            const mockResponse = {
                items: [],
                page: 1,
                limit: 20,
                totalCount: 0,
                totalPages: 0,
                hasMore: false,
            };
            mockFeedService.getSectionData.mockResolvedValue(mockResponse);

            await controller.getSectionData(
                { user: { userId: 'another-user-id' } },
                EpisodeSectionId.POPULAR,
                { page: 1, limit: 20 },
            );

            expect(feedService.getSectionData).toHaveBeenCalledWith(
                EpisodeSectionId.POPULAR,
                'another-user-id',
                1,
                20,
            );
        });
    });
});
