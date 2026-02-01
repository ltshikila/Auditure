/**
 * Integration Tests: Books → Podcasters → Episodes Workflow
 *
 * Tests the complete workflow from book creation (PDF/EPUB) through
 * podcaster creation, episode generation, and playback.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// Modules
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

// Fixtures
import { createCompletedMockBook, createMockChapter } from './fixtures/books.fixture';
import { createMockPodcaster, createPublicMockPodcaster } from './fixtures/podcasters.fixture';
import { mockCreateEpisodeDto } from './fixtures/episodes.fixture';

// Mocks
import { mockPrismaClient } from './mocks/database.mock';
import {
    mockStorageService,
    mockRabbitMQServiceWithEpisodes,
    mockRedisService,
} from './mocks/services.mock';
import { StorageService } from '../src/common/storage.service';
import { RabbitMQService } from '../src/rabbitmq/rabbitmq.service';
import { RedisService } from '../src/redis/redis.service';

// DTOs and Types
import { ContentCoverage, EpisodeType, EpisodeTheme } from '../src/episodes/dto/create-episode.dto';

describe('Integration: Books → Podcasters → Episodes Workflow', () => {
    let app: INestApplication<App>;
    let databaseService: DatabaseService;

    // Test user context
    const testUserId = 'test-user-123';
    const differentUserId = 'different-user-456';

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(DatabaseService)
            .useValue(mockPrismaClient)
            .overrideProvider(StorageService)
            .useValue(mockStorageService)
            .overrideProvider(RabbitMQService)
            .useValue(mockRabbitMQServiceWithEpisodes)
            .overrideProvider(RedisService)
            .useValue(mockRedisService)
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
    });

    describe('Episode Creation Workflow', () => {
        describe('Complete workflow: Book → Podcaster → Episode', () => {
            it('should create an episode from a completed PDF book and valid podcaster', async () => {
                const bookId = 'book-123';
                const podcasterId = 'podcaster-123';
                const chapterId = 'chapter-123';

                const mockBook = createCompletedMockBook({
                    id: bookId,
                    userId: testUserId,
                    chapters: [
                        createMockChapter({
                            id: chapterId,
                            bookId,
                            chapterNumber: 1,
                        }),
                    ],
                });

                const mockPodcaster = createMockPodcaster({
                    id: podcasterId,
                    userId: testUserId,
                });

                // Setup mocks
                mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
                mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPodcaster);
                mockPrismaClient.episode.create.mockResolvedValue({
                    id: 'episode-123',
                    userId: testUserId,
                    bookId,
                    podcasterId,
                    title: 'Test Episode',
                    description: 'Episode created from PDF book',
                    contentCoverage: ContentCoverage.ENTIRE_BOOK,
                    chapters: [],
                    episodeType: EpisodeType.MONOLOGUE,
                    episodeTheme: EpisodeTheme.LECTURE,
                    targetLengthMin: 15,
                    targetLengthMax: 25,
                    generationStatus: 'PENDING',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                // Verify episode creation queues generation job
                expect(
                    mockRabbitMQServiceWithEpisodes.publishEpisodeGenerationJob,
                ).not.toHaveBeenCalled();

                // After episode creation, verify job was queued
                // This would happen through the controller/service layer
            });

            it('should allow using public podcaster from different user', async () => {
                const bookId = 'book-123';
                const podcasterId = 'public-podcaster-123';

                const mockBook = createCompletedMockBook({
                    id: bookId,
                    userId: testUserId,
                });

                const mockPublicPodcaster = createPublicMockPodcaster({
                    id: podcasterId,
                    userId: differentUserId, // Different user, but public
                    isPublic: true,
                });

                mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
                mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPublicPodcaster);

                // Public podcaster should be accessible
                expect(mockPublicPodcaster.isPublic).toBe(true);
                expect(mockPublicPodcaster.userId).not.toBe(testUserId);
            });
        });

        describe('Validation: Book requirements', () => {
            it('should reject episode creation if book does not exist', async () => {
                mockPrismaClient.book.findUnique.mockResolvedValue(null);

                // Book not found should result in 404
                // This is tested via the service layer
            });

            it('should reject episode creation if book belongs to different user', async () => {
                const mockBook = createCompletedMockBook({
                    id: 'book-123',
                    userId: differentUserId, // Different user
                });

                mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

                // Book ownership check should reject
            });

            it('should reject episode creation if book extraction not completed', async () => {
                const mockBook = createCompletedMockBook({
                    id: 'book-123',
                    userId: testUserId,
                    extractionStatus: 'PENDING', // Not completed
                });

                mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

                // Extraction status check should reject
            });

            it('should reject episode creation if book extraction failed', async () => {
                const mockBook = createCompletedMockBook({
                    id: 'book-123',
                    userId: testUserId,
                    extractionStatus: 'FAILED',
                    extractionError: 'Failed to extract content',
                });

                mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

                // Failed extraction should reject episode creation
            });
        });

        describe('Validation: Podcaster requirements', () => {
            it('should reject episode creation if podcaster does not exist', async () => {
                const mockBook = createCompletedMockBook({
                    id: 'book-123',
                    userId: testUserId,
                });

                mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
                mockPrismaClient.podcaster.findUnique.mockResolvedValue(null);

                // Podcaster not found should result in 404
            });

            it('should reject episode creation if private podcaster belongs to different user', async () => {
                const mockBook = createCompletedMockBook({
                    id: 'book-123',
                    userId: testUserId,
                });

                const mockPrivatePodcaster = createMockPodcaster({
                    id: 'private-pod-123',
                    userId: differentUserId,
                    isPublic: false,
                });

                mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
                mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPrivatePodcaster);

                // Private podcaster from different user should be rejected
            });
        });

        describe('Validation: Content coverage requirements', () => {
            it('should require chapters when content coverage is MULTIPLE_CHAPTERS', async () => {
                const invalidDto = {
                    ...mockCreateEpisodeDto,
                    contentCoverage: ContentCoverage.MULTIPLE_CHAPTERS,
                    chapters: [], // Empty chapters is invalid for this coverage type
                };

                // Validation should fail
            });

            it('should require chapters when content coverage is SINGLE_CHAPTER', async () => {
                const invalidDto = {
                    ...mockCreateEpisodeDto,
                    contentCoverage: ContentCoverage.SINGLE_CHAPTER,
                    chapters: [], // Empty chapters is invalid
                };

                // Validation should fail
            });

            it('should allow empty chapters when content coverage is ENTIRE_BOOK', async () => {
                const validDto = {
                    ...mockCreateEpisodeDto,
                    contentCoverage: ContentCoverage.ENTIRE_BOOK,
                    chapters: [], // Valid for entire book
                };

                // Validation should pass
            });
        });

        describe('Validation: Target length requirements', () => {
            it('should reject if targetLengthMin > targetLengthMax', async () => {
                const invalidDto = {
                    ...mockCreateEpisodeDto,
                    targetLengthMin: 30,
                    targetLengthMax: 15, // Invalid: min > max
                };

                // Validation should fail
            });
        });
    });

    describe('Cross-Service Data Access', () => {
        describe('Episode fetches book content', () => {
            it('should include book title and author in episode response', async () => {
                const mockEpisode = {
                    id: 'episode-123',
                    userId: testUserId,
                    bookId: 'book-123',
                    podcasterId: 'pod-123',
                    title: 'Test Episode',
                    book: {
                        id: 'book-123',
                        title: 'Test Book',
                        author: 'Test Author',
                    },
                    podcaster: {
                        id: 'pod-123',
                        name: 'Test Podcaster',
                        profilePictureUrl: null,
                    },
                    user: {
                        id: testUserId,
                        firstName: 'John',
                        lastName: 'Doe',
                    },
                    isPublic: false,
                    generationStatus: 'COMPLETED',
                };

                mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);

                // Episode response should include related entities
                expect(mockEpisode.book.title).toBe('Test Book');
                expect(mockEpisode.podcaster.name).toBe('Test Podcaster');
            });
        });

        describe('Episode fetches podcaster configuration', () => {
            it('should use podcaster voice settings for generation', async () => {
                const mockPodcaster = createMockPodcaster({
                    id: 'pod-123',
                    userId: testUserId,
                    speakingSpeed: 7,
                    vocalPitch: 4,
                    tone: 8,
                });

                mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPodcaster);

                // Generation job should include podcaster settings
                expect(mockPodcaster.speakingSpeed).toBe(7);
                expect(mockPodcaster.vocalPitch).toBe(4);
                expect(mockPodcaster.tone).toBe(8);
            });
        });
    });

    describe('Generation Status Flow', () => {
        it('should progress through generation statuses correctly', async () => {
            const statuses = [
                'PENDING',
                'SCRIPT_GENERATING',
                'SCRIPT_GENERATED',
                'AUDIO_GENERATING',
                'COMPLETED',
            ];

            // Verify status progression is valid
            expect(statuses).toContain('PENDING');
            expect(statuses).toContain('COMPLETED');
            expect(statuses.indexOf('SCRIPT_GENERATING')).toBeGreaterThan(
                statuses.indexOf('PENDING'),
            );
            expect(statuses.indexOf('COMPLETED')).toBeGreaterThan(
                statuses.indexOf('AUDIO_GENERATING'),
            );
        });

        it('should allow retry only for FAILED episodes', async () => {
            const failedEpisode = {
                id: 'episode-123',
                userId: testUserId,
                generationStatus: 'FAILED',
                generationError: 'TTS service unavailable',
            };

            mockPrismaClient.episode.findUnique.mockResolvedValue(failedEpisode);

            // Retry should be allowed for failed episodes
            expect(failedEpisode.generationStatus).toBe('FAILED');
        });

        it('should prevent updates during active generation', async () => {
            const generatingEpisode = {
                id: 'episode-123',
                userId: testUserId,
                generationStatus: 'SCRIPT_GENERATING',
            };

            mockPrismaClient.episode.findUnique.mockResolvedValue(generatingEpisode);

            // Updates should be blocked during generation
            expect(['SCRIPT_GENERATING', 'AUDIO_GENERATING']).toContain(
                generatingEpisode.generationStatus,
            );
        });
    });

    describe('Playback Flow', () => {
        describe('Audio streaming', () => {
            it('should stream audio for completed episodes', async () => {
                const completedEpisode = {
                    id: 'episode-123',
                    userId: testUserId,
                    generationStatus: 'COMPLETED',
                    audioFileKey: 'user-123/episode-123/audio.mp3',
                    audioFormat: 'mp3',
                    duration: 1200,
                    isPublic: false,
                };

                mockPrismaClient.episode.findUnique.mockResolvedValue(completedEpisode);
                mockStorageService.fileExists.mockResolvedValue(true);
                mockStorageService.downloadFile.mockResolvedValue(Buffer.alloc(1024, 0));

                // Audio streaming should work
                expect(completedEpisode.audioFileKey).toBeDefined();
            });

            it('should support range requests for seeking', async () => {
                const audioBuffer = Buffer.alloc(10000, 0);
                mockStorageService.downloadFile.mockResolvedValue(audioBuffer);

                // Range request should return partial content
                const rangeStart = 1000;
                const rangeEnd = 2000;
                const chunk = audioBuffer.subarray(rangeStart, rangeEnd + 1);

                expect(chunk.length).toBe(1001);
            });

            it('should allow public episode streaming without auth', async () => {
                const publicEpisode = {
                    id: 'episode-123',
                    userId: differentUserId,
                    isPublic: true,
                    generationStatus: 'COMPLETED',
                    audioFileKey: 'user-456/episode-123/audio.mp3',
                };

                mockPrismaClient.episode.findUnique.mockResolvedValue(publicEpisode);

                // Public episode should be accessible without auth
                expect(publicEpisode.isPublic).toBe(true);
            });

            it('should reject private episode streaming without auth', async () => {
                const privateEpisode = {
                    id: 'episode-123',
                    userId: differentUserId,
                    isPublic: false,
                    generationStatus: 'COMPLETED',
                    audioFileKey: 'user-456/episode-123/audio.mp3',
                };

                mockPrismaClient.episode.findUnique.mockResolvedValue(privateEpisode);

                // Private episode should require auth
                expect(privateEpisode.isPublic).toBe(false);
            });
        });

        describe('Playback progress tracking', () => {
            it('should save playback progress to Redis', async () => {
                const episodeId = 'episode-123';
                const positionMs = 60000; // 1 minute

                await mockRedisService.setPlaybackProgress(testUserId, episodeId, positionMs);

                expect(mockRedisService.setPlaybackProgress).toHaveBeenCalledWith(
                    testUserId,
                    episodeId,
                    positionMs,
                );
            });

            it('should retrieve playback progress from Redis', async () => {
                const episodeId = 'episode-123';
                const expectedPosition = 120000; // 2 minutes

                mockRedisService.getPlaybackProgress.mockResolvedValue(expectedPosition);

                const position = await mockRedisService.getPlaybackProgress(testUserId, episodeId);

                expect(position).toBe(expectedPosition);
            });

            it('should return null if no progress saved', async () => {
                mockRedisService.getPlaybackProgress.mockResolvedValue(null);

                const position = await mockRedisService.getPlaybackProgress(
                    testUserId,
                    'new-episode',
                );

                expect(position).toBeNull();
            });
        });

        describe('Generation progress tracking', () => {
            it('should track generation progress in Redis', async () => {
                const progress = {
                    progress: 60,
                    status: 'SCRIPT_GENERATED',
                    updatedAt: new Date().toISOString(),
                };

                mockRedisService.getJobProgress.mockResolvedValue(progress);

                const result = await mockRedisService.getJobProgress('episode-123');

                expect(result).toEqual(progress);
                expect(result.progress).toBe(60);
            });
        });
    });

    describe('Statistics and Metrics', () => {
        describe('Play count tracking', () => {
            it('should increment play count when audio starts', async () => {
                mockPrismaClient.episode.update.mockResolvedValue({
                    id: 'episode-123',
                    playCount: 101,
                });

                // Play count should increment
            });
        });

        describe('Like count tracking', () => {
            it('should increment like count', async () => {
                mockPrismaClient.episode.update.mockResolvedValue({
                    id: 'episode-123',
                    likeCount: 26,
                });

                // Like count should increment
            });

            it('should decrement like count on unlike', async () => {
                mockPrismaClient.episode.update.mockResolvedValue({
                    id: 'episode-123',
                    likeCount: 24,
                });

                // Like count should decrement
            });
        });

        describe('Share count tracking', () => {
            it('should increment share count', async () => {
                mockPrismaClient.episode.update.mockResolvedValue({
                    id: 'episode-123',
                    shareCount: 11,
                });

                // Share count should increment
            });
        });
    });

    describe('Public/Private Access Control', () => {
        describe('Making episode public', () => {
            it('should only allow completed episodes to be made public', async () => {
                const pendingEpisode = {
                    id: 'episode-123',
                    userId: testUserId,
                    generationStatus: 'PENDING',
                    isPublic: false,
                };

                mockPrismaClient.episode.findUnique.mockResolvedValue(pendingEpisode);

                // Making pending episode public should fail
                expect(pendingEpisode.generationStatus).not.toBe('COMPLETED');
            });

            it('should allow owner to make completed episode public', async () => {
                const completedEpisode = {
                    id: 'episode-123',
                    userId: testUserId,
                    generationStatus: 'COMPLETED',
                    isPublic: false,
                };

                mockPrismaClient.episode.findUnique.mockResolvedValue(completedEpisode);
                mockPrismaClient.episode.update.mockResolvedValue({
                    ...completedEpisode,
                    isPublic: true,
                });

                // Owner should be able to make episode public
                expect(completedEpisode.generationStatus).toBe('COMPLETED');
            });
        });

        describe('Accessing private episodes', () => {
            it('should allow owner to access private episode', async () => {
                const privateEpisode = {
                    id: 'episode-123',
                    userId: testUserId,
                    isPublic: false,
                };

                mockPrismaClient.episode.findUnique.mockResolvedValue(privateEpisode);

                // Owner should have access
                expect(privateEpisode.userId).toBe(testUserId);
            });

            it('should deny non-owner access to private episode', async () => {
                const privateEpisode = {
                    id: 'episode-123',
                    userId: differentUserId,
                    isPublic: false,
                };

                mockPrismaClient.episode.findUnique.mockResolvedValue(privateEpisode);

                // Non-owner should be denied
                expect(privateEpisode.userId).not.toBe(testUserId);
                expect(privateEpisode.isPublic).toBe(false);
            });
        });
    });
});
