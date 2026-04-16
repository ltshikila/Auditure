import { Test, TestingModule } from '@nestjs/testing';
import { EpisodesService } from './episodes.service';
import { DatabaseService } from '../database/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../common/storage.service';
import { BooksService } from '../books/books.service';
import { BookExtractionDispatcher } from '../books/services/book-extraction-dispatcher.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PodcastersService } from '../podcasters/podcasters.service';
import { NotFoundException, ForbiddenException, StreamableFile } from '@nestjs/common';
import {
    createMockEpisode,
    createCompletedMockEpisode,
    createPublicMockEpisode,
    createMockPodcaster,
    mockAudioBuffer,
} from '../../test/fixtures/episodes.fixture';
import { createCompletedMockBook } from '../../test/fixtures/books.fixture';
import { mockPrismaClient } from '../../test/mocks/database.mock';
import {
    mockStorageService,
    mockRedisService,
    mockRabbitMQServiceWithEpisodes,
    mockBookExtractionDispatcher,
} from '../../test/mocks/services.mock';

describe('EpisodesService', () => {
    let service: EpisodesService;
    let databaseService: DatabaseService;
    let storageService: StorageService;
    let redisService: RedisService;

    const mockUserId = 'user-123';

    // Mock Response object for streaming tests
    const createMockResponse = () => ({
        status: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
    });

    const mockBooksService = {
        uploadBook: jest.fn().mockResolvedValue({
            id: 'mock-book-id',
            title: 'Test Book',
            author: 'Test Author',
        }),
    };

    const mockUsersService = {
        checkQuota: jest.fn().mockResolvedValue(true),
        getSubscription: jest.fn().mockResolvedValue({
            tier: 'FREE',
            isPaid: false,
            usage: {
                geminiEpisodes: { used: 0, limit: 1, remaining: 1 },
                standardEpisodes: { used: 0, limit: 2, remaining: 2 },
            },
        }),
    };

    const mockNotificationsService = {
        notifyNewComment: jest.fn().mockResolvedValue({}),
        notifySubscriptionWarning: jest.fn().mockResolvedValue({}),
        notifyNewLike: jest.fn().mockResolvedValue({}),
    };

    const mockPodcastersService = {
        findOne: jest.fn().mockResolvedValue({}),
        incrementPlayCount: jest.fn().mockResolvedValue({}),
        incrementShareCount: jest.fn().mockResolvedValue({}),
        incrementLikeCount: jest.fn().mockResolvedValue({}),
        decrementLikeCount: jest.fn().mockResolvedValue({}),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EpisodesService,
                {
                    provide: DatabaseService,
                    useValue: mockPrismaClient,
                },
                {
                    provide: RabbitMQService,
                    useValue: mockRabbitMQServiceWithEpisodes,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
                {
                    provide: StorageService,
                    useValue: mockStorageService,
                },
                {
                    provide: BooksService,
                    useValue: mockBooksService,
                },
                {
                    provide: BookExtractionDispatcher,
                    useValue: mockBookExtractionDispatcher,
                },
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
                {
                    provide: NotificationsService,
                    useValue: mockNotificationsService,
                },
                {
                    provide: PodcastersService,
                    useValue: mockPodcastersService,
                },
            ],
        }).compile();

        service = module.get<EpisodesService>(EpisodesService);
        databaseService = module.get<DatabaseService>(DatabaseService);
        storageService = module.get<StorageService>(StorageService);
        redisService = module.get<RedisService>(RedisService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('streamAudio', () => {
        const mockStream = { pipe: jest.fn(), on: jest.fn() };

        it('should stream full audio file successfully', async () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            const mockRes = createMockResponse();

            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);
            mockStorageService.fileExists.mockResolvedValue(true);
            mockStorageService.getFileSize.mockResolvedValue(mockAudioBuffer.length);
            mockStorageService.createReadStream.mockReturnValue(mockStream);

            const result = await service.streamAudio(
                mockEpisode.id,
                mockUserId,
                undefined,
                mockRes as any,
            );

            expect(result).toBeInstanceOf(StreamableFile);
            expect(mockRes.set).toHaveBeenCalledWith({
                'Accept-Ranges': 'bytes',
                'Content-Length': mockAudioBuffer.length,
                'Content-Type': 'audio/mpeg',
            });
            expect(mockStorageService.createReadStream).toHaveBeenCalledWith(
                mockEpisode.audioFileKey,
            );
        });

        it('should handle range requests for seeking', async () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            const mockRes = createMockResponse();
            const range = 'bytes=0-1023';

            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);
            mockStorageService.fileExists.mockResolvedValue(true);
            mockStorageService.getFileSize.mockResolvedValue(mockAudioBuffer.length);
            mockStorageService.createReadStream.mockReturnValue(mockStream);

            const result = await service.streamAudio(
                mockEpisode.id,
                mockUserId,
                range,
                mockRes as any,
            );

            expect(result).toBeInstanceOf(StreamableFile);
            expect(mockRes.status).toHaveBeenCalledWith(206);
            expect(mockRes.set).toHaveBeenCalledWith({
                'Content-Range': `bytes 0-1023/${mockAudioBuffer.length}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': 1024,
                'Content-Type': 'audio/mpeg',
            });
            expect(mockStorageService.createReadStream).toHaveBeenCalledWith(
                mockEpisode.audioFileKey,
                { start: 0, end: 1023 },
            );
        });

        it('should handle range request without end byte', async () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            const mockRes = createMockResponse();
            const range = 'bytes=1000-';

            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);
            mockStorageService.fileExists.mockResolvedValue(true);
            mockStorageService.getFileSize.mockResolvedValue(mockAudioBuffer.length);
            mockStorageService.createReadStream.mockReturnValue(mockStream);

            const result = await service.streamAudio(
                mockEpisode.id,
                mockUserId,
                range,
                mockRes as any,
            );

            expect(result).toBeInstanceOf(StreamableFile);
            expect(mockRes.status).toHaveBeenCalledWith(206);
            const expectedEnd = mockAudioBuffer.length - 1;
            const expectedChunkSize = expectedEnd - 1000 + 1;
            expect(mockRes.set).toHaveBeenCalledWith({
                'Content-Range': `bytes 1000-${expectedEnd}/${mockAudioBuffer.length}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': expectedChunkSize,
                'Content-Type': 'audio/mpeg',
            });
        });

        it('should return audio/wav content type for wav format', async () => {
            const mockEpisode = createCompletedMockEpisode({
                userId: mockUserId,
                audioFormat: 'wav',
            });
            const mockRes = createMockResponse();

            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);
            mockStorageService.fileExists.mockResolvedValue(true);
            mockStorageService.getFileSize.mockResolvedValue(mockAudioBuffer.length);
            mockStorageService.createReadStream.mockReturnValue(mockStream);

            await service.streamAudio(mockEpisode.id, mockUserId, undefined, mockRes as any);

            expect(mockRes.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    'Content-Type': 'audio/wav',
                }),
            );
        });

        it('should throw NotFoundException if audio file key is missing', async () => {
            const mockEpisode = createMockEpisode({ userId: mockUserId, audioFileKey: null });
            const mockRes = createMockResponse();

            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);

            await expect(
                service.streamAudio(mockEpisode.id, mockUserId, undefined, mockRes as any),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException if audio file not in storage', async () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            const mockRes = createMockResponse();

            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);
            mockStorageService.fileExists.mockResolvedValue(false);

            await expect(
                service.streamAudio(mockEpisode.id, mockUserId, undefined, mockRes as any),
            ).rejects.toThrow(NotFoundException);
        });

        it('should allow public episode streaming without authentication', async () => {
            const mockEpisode = createPublicMockEpisode();
            const mockRes = createMockResponse();

            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);
            mockStorageService.fileExists.mockResolvedValue(true);
            mockStorageService.getFileSize.mockResolvedValue(mockAudioBuffer.length);
            mockStorageService.createReadStream.mockReturnValue(mockStream);

            const result = await service.streamAudio(
                mockEpisode.id,
                undefined, // No user ID (unauthenticated)
                undefined,
                mockRes as any,
            );

            expect(result).toBeInstanceOf(StreamableFile);
        });

        it('should throw ForbiddenException for private episode without auth', async () => {
            const mockEpisode = createCompletedMockEpisode({ isPublic: false });
            const mockRes = createMockResponse();

            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);

            await expect(
                service.streamAudio(mockEpisode.id, undefined, undefined, mockRes as any),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('savePlaybackProgress', () => {
        it('should save playback progress to Redis', async () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);

            await service.savePlaybackProgress(mockUserId, mockEpisode.id, 60000);

            expect(redisService.setPlaybackProgress).toHaveBeenCalledWith(
                mockUserId,
                mockEpisode.id,
                60000,
            );
        });

        it('should verify episode exists before saving progress', async () => {
            mockPrismaClient.episode.findUnique.mockResolvedValue(null);

            await expect(
                service.savePlaybackProgress(mockUserId, 'non-existent-id', 60000),
            ).rejects.toThrow(NotFoundException);

            expect(redisService.setPlaybackProgress).not.toHaveBeenCalled();
        });

        it('should verify user has access before saving progress', async () => {
            const mockEpisode = createCompletedMockEpisode({ isPublic: false });
            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);

            await expect(
                service.savePlaybackProgress(mockUserId, mockEpisode.id, 60000),
            ).rejects.toThrow(ForbiddenException);

            expect(redisService.setPlaybackProgress).not.toHaveBeenCalled();
        });
    });

    describe('getPlaybackProgress', () => {
        it('should return playback progress from Redis', async () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);
            mockRedisService.getPlaybackProgress.mockResolvedValue(120000);

            const result = await service.getPlaybackProgress(mockUserId, mockEpisode.id);

            expect(result).toEqual({ position: 120000 });
            expect(redisService.getPlaybackProgress).toHaveBeenCalledWith(
                mockUserId,
                mockEpisode.id,
            );
        });

        it('should return zero position if no progress saved', async () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);
            mockRedisService.getPlaybackProgress.mockResolvedValue(null);

            const result = await service.getPlaybackProgress(mockUserId, mockEpisode.id);

            expect(result).toEqual({ position: 0 });
        });
    });

    describe('getGenerationProgress', () => {
        it('should return generation progress from Redis', async () => {
            const mockProgress = {
                progress: 60,
                status: 'SCRIPT_GENERATED',
                updatedAt: '2024-01-15T10:30:00Z',
            };
            mockRedisService.getJobProgress.mockResolvedValue(mockProgress);

            const result = await service.getGenerationProgress('episode-id');

            expect(result).toEqual(mockProgress);
            expect(redisService.getJobProgress).toHaveBeenCalledWith('episode-id');
        });

        it('should return default progress if no progress found in Redis', async () => {
            mockRedisService.getJobProgress.mockResolvedValue(null);

            const result = await service.getGenerationProgress('episode-id');

            expect(result).toBeDefined();
            expect(result.progress).toBe(0);
            expect(result.status).toBe('pending');
            expect(result.updatedAt).toBeDefined();
        });
    });

    describe('findOne', () => {
        it('should return episode for owner', async () => {
            const mockEpisode = createCompletedMockEpisode({
                userId: mockUserId,
                user: { id: mockUserId, firstName: 'John', lastName: 'Doe' },
                podcaster: { id: 'pod-1', name: 'Test Podcaster', profilePictureUrl: null },
                book: { id: 'book-1', title: 'Test Book', author: 'Author' },
            });
            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);

            const result = await service.findOne(mockEpisode.id, mockUserId);

            expect(result).toBeDefined();
            expect(result.id).toBe(mockEpisode.id);
        });

        it('should return public episode for any user', async () => {
            const mockEpisode = createPublicMockEpisode({
                user: { id: 'other-user', firstName: 'Jane', lastName: 'Doe' },
                podcaster: { id: 'pod-1', name: 'Test Podcaster', profilePictureUrl: null },
                book: { id: 'book-1', title: 'Test Book', author: 'Author' },
            });
            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);

            const result = await service.findOne(mockEpisode.id, mockUserId);

            expect(result).toBeDefined();
        });

        it('should throw ForbiddenException for private episode accessed by non-owner', async () => {
            const mockEpisode = createCompletedMockEpisode({
                userId: 'different-user',
                isPublic: false,
            });
            mockPrismaClient.episode.findUnique.mockResolvedValue(mockEpisode);

            await expect(service.findOne(mockEpisode.id, mockUserId)).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('should throw NotFoundException if episode not found', async () => {
            mockPrismaClient.episode.findUnique.mockResolvedValue(null);

            await expect(service.findOne('non-existent-id', mockUserId)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('incrementPlayCount', () => {
        it('should increment play count and podcaster play count', async () => {
            const mockEpisode = createPublicMockEpisode();
            mockPrismaClient.episode.findUnique.mockResolvedValue({
                id: mockEpisode.id,
                podcasterId: mockEpisode.podcasterId,
            });
            mockPrismaClient.episode.update.mockResolvedValue({});

            await service.incrementPlayCount(mockEpisode.id);

            expect(databaseService.episode.findUnique).toHaveBeenCalledWith({
                where: { id: mockEpisode.id },
                select: { id: true, podcasterId: true },
            });
            expect(databaseService.episode.update).toHaveBeenCalledWith({
                where: { id: mockEpisode.id },
                data: {
                    playCount: {
                        increment: 1,
                    },
                },
            });
            expect(mockPodcastersService.incrementPlayCount).toHaveBeenCalledWith(
                mockEpisode.podcasterId,
            );
        });

        it('should skip if episode not found', async () => {
            mockPrismaClient.episode.findUnique.mockResolvedValue(null);

            await service.incrementPlayCount('non-existent-id');

            expect(databaseService.episode.update).not.toHaveBeenCalled();
            expect(mockPodcastersService.incrementPlayCount).not.toHaveBeenCalled();
        });
    });

    describe('updateGenerationStatus', () => {
        it('should update status to SCRIPT_GENERATED with script content', async () => {
            const mockEpisode = createMockEpisode();
            mockPrismaClient.episode.update.mockResolvedValue(mockEpisode);

            await service.updateGenerationStatus(mockEpisode.id, 'SCRIPT_GENERATED' as any, {
                scriptContent: 'Generated script content',
            });

            expect(databaseService.episode.update).toHaveBeenCalledWith({
                where: { id: mockEpisode.id },
                data: expect.objectContaining({
                    generationStatus: 'SCRIPT_GENERATED',
                    scriptContent: 'Generated script content',
                    scriptGeneratedAt: expect.any(Date),
                }),
            });
        });

        it('should update status to COMPLETED with audio details', async () => {
            const mockEpisode = createMockEpisode();
            mockPrismaClient.episode.update.mockResolvedValue(mockEpisode);

            await service.updateGenerationStatus(mockEpisode.id, 'COMPLETED' as any, {
                audioFileKey: 'user/episode/audio.mp3',
                duration: 1200,
                audioFormat: 'mp3',
            });

            expect(databaseService.episode.update).toHaveBeenCalledWith({
                where: { id: mockEpisode.id },
                data: expect.objectContaining({
                    generationStatus: 'COMPLETED',
                    audioFileKey: 'user/episode/audio.mp3',
                    audioGeneratedAt: expect.any(Date),
                    duration: 1200,
                    audioFormat: 'mp3',
                }),
            });
        });

        it('should update status to FAILED with error message', async () => {
            const mockEpisode = createMockEpisode();
            mockPrismaClient.episode.update.mockResolvedValue(mockEpisode);

            await service.updateGenerationStatus(mockEpisode.id, 'FAILED' as any, {
                generationError: 'Script generation failed',
            });

            expect(databaseService.episode.update).toHaveBeenCalledWith({
                where: { id: mockEpisode.id },
                data: expect.objectContaining({
                    generationStatus: 'FAILED',
                    generationError: 'Script generation failed',
                }),
            });
        });
    });
});
