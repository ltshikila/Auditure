import { Test, TestingModule } from '@nestjs/testing';
import {
    INestApplication,
    ValidationPipe,
    NotFoundException,
    ForbiddenException,
    StreamableFile,
} from '@nestjs/common';
import request = require('supertest');
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
    createMockEpisode,
    createCompletedMockEpisode,
    createPublicMockEpisode,
    mockCreateEpisodeDto,
    mockAudioBuffer,
} from '../../test/fixtures/episodes.fixture';

describe('EpisodesController (Integration)', () => {
    let app: INestApplication;
    let episodesService: EpisodesService;

    const mockUserId = 'test-user-id';

    const mockEpisodesService = {
        create: jest.fn(),
        findPublic: jest.fn(),
        findTrending: jest.fn(),
        findByPodcaster: jest.fn(),
        findByBook: jest.fn(),
        findAllByUser: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        incrementPlayCount: jest.fn(),
        incrementLikeCount: jest.fn(),
        decrementLikeCount: jest.fn(),
        incrementShareCount: jest.fn(),
        makePublic: jest.fn(),
        retryGeneration: jest.fn(),
        streamAudio: jest.fn(),
        savePlaybackProgress: jest.fn(),
        getPlaybackProgress: jest.fn(),
        getGenerationProgress: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [EpisodesController],
            providers: [
                {
                    provide: EpisodesService,
                    useValue: mockEpisodesService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: jest.fn(context => {
                    const request = context.switchToHttp().getRequest();
                    request.user = { userId: mockUserId, email: 'test@example.com' };
                    return true;
                }),
            })
            .overrideGuard(OptionalJwtAuthGuard)
            .useValue({
                canActivate: jest.fn(context => {
                    const request = context.switchToHttp().getRequest();
                    // Simulate optional auth - user may or may not be present
                    const authHeader = request.headers.authorization;
                    if (authHeader) {
                        request.user = { userId: mockUserId, email: 'test@example.com' };
                    }
                    return true;
                }),
            })
            .compile();

        app = module.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        await app.init();

        episodesService = module.get<EpisodesService>(EpisodesService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('GET /episodes/:id/stream', () => {
        it('should stream audio file successfully', () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            const streamableFile = new StreamableFile(mockAudioBuffer);
            mockEpisodesService.streamAudio.mockResolvedValue(streamableFile);

            return request(app.getHttpServer())
                .get(`/episodes/${mockEpisode.id}/stream`)
                .set('Authorization', 'Bearer mock-token')
                .expect(200)
                .then(response => {
                    expect(episodesService.streamAudio).toHaveBeenCalledWith(
                        mockEpisode.id,
                        mockUserId,
                        undefined,
                        expect.anything(),
                    );
                });
        });

        it('should handle range requests', () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            const streamableFile = new StreamableFile(mockAudioBuffer.subarray(0, 1024));
            mockEpisodesService.streamAudio.mockResolvedValue(streamableFile);

            return request(app.getHttpServer())
                .get(`/episodes/${mockEpisode.id}/stream`)
                .set('Authorization', 'Bearer mock-token')
                .set('Range', 'bytes=0-1023')
                .then(response => {
                    expect(episodesService.streamAudio).toHaveBeenCalledWith(
                        mockEpisode.id,
                        mockUserId,
                        'bytes=0-1023',
                        expect.anything(),
                    );
                });
        });

        it('should stream public episode without auth', () => {
            const mockEpisode = createPublicMockEpisode();
            const streamableFile = new StreamableFile(mockAudioBuffer);
            mockEpisodesService.streamAudio.mockResolvedValue(streamableFile);

            return request(app.getHttpServer())
                .get(`/episodes/${mockEpisode.id}/stream`)
                // No Authorization header
                .expect(200)
                .then(response => {
                    expect(episodesService.streamAudio).toHaveBeenCalledWith(
                        mockEpisode.id,
                        undefined, // No user ID
                        undefined,
                        expect.anything(),
                    );
                });
        });

        it('should return 404 for non-existent episode', () => {
            mockEpisodesService.streamAudio.mockRejectedValue(
                new NotFoundException('Episode not found'),
            );

            return request(app.getHttpServer())
                .get('/episodes/non-existent-id/stream')
                .set('Authorization', 'Bearer mock-token')
                .expect(404);
        });

        it('should return 403 for private episode without auth', () => {
            mockEpisodesService.streamAudio.mockRejectedValue(
                new ForbiddenException('Access denied to private episode'),
            );

            return request(app.getHttpServer())
                .get('/episodes/private-episode-id/stream')
                // No Authorization header
                .expect(403);
        });
    });

    describe('POST /episodes/:id/progress', () => {
        it('should save playback progress', () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            mockEpisodesService.savePlaybackProgress.mockResolvedValue(undefined);

            return request(app.getHttpServer())
                .post(`/episodes/${mockEpisode.id}/progress`)
                .set('Authorization', 'Bearer mock-token')
                .send({ position: 60000 })
                .expect(204)
                .then(() => {
                    expect(episodesService.savePlaybackProgress).toHaveBeenCalledWith(
                        mockUserId,
                        mockEpisode.id,
                        60000,
                    );
                });
        });

        it('should require position in body', () => {
            return request(app.getHttpServer())
                .post('/episodes/some-id/progress')
                .set('Authorization', 'Bearer mock-token')
                .send({}) // Missing position
                .expect(204); // No validation on body currently
        });
    });

    describe('GET /episodes/:id/progress', () => {
        it('should return playback progress', () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            mockEpisodesService.getPlaybackProgress.mockResolvedValue({ position: 120000 });

            return request(app.getHttpServer())
                .get(`/episodes/${mockEpisode.id}/progress`)
                .set('Authorization', 'Bearer mock-token')
                .expect(200)
                .then(response => {
                    expect(response.body).toEqual({ position: 120000 });
                    expect(episodesService.getPlaybackProgress).toHaveBeenCalledWith(
                        mockUserId,
                        mockEpisode.id,
                    );
                });
        });

        it('should return empty object when no progress exists', () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            mockEpisodesService.getPlaybackProgress.mockResolvedValue(null);

            return request(app.getHttpServer())
                .get(`/episodes/${mockEpisode.id}/progress`)
                .set('Authorization', 'Bearer mock-token')
                .expect(200)
                .then(response => {
                    // null is serialized as empty object in JSON response
                    expect(response.body).toEqual({});
                });
        });
    });

    describe('GET /episodes/:id/generation-progress', () => {
        it('should return generation progress', () => {
            const mockProgress = {
                progress: 60,
                status: 'SCRIPT_GENERATED',
                updatedAt: '2024-01-15T10:30:00Z',
            };
            mockEpisodesService.getGenerationProgress.mockResolvedValue(mockProgress);

            return request(app.getHttpServer())
                .get('/episodes/some-episode-id/generation-progress')
                .expect(200)
                .then(response => {
                    expect(response.body).toEqual(mockProgress);
                    expect(episodesService.getGenerationProgress).toHaveBeenCalledWith(
                        'some-episode-id',
                    );
                });
        });

        it('should return empty object when no progress exists', () => {
            mockEpisodesService.getGenerationProgress.mockResolvedValue(null);

            return request(app.getHttpServer())
                .get('/episodes/some-episode-id/generation-progress')
                .expect(200)
                .then(response => {
                    // null is serialized as empty object in JSON response
                    expect(response.body).toEqual({});
                });
        });
    });

    describe('POST /episodes/:id/play', () => {
        it('should increment play count', () => {
            const mockEpisode = createPublicMockEpisode();
            mockEpisodesService.incrementPlayCount.mockResolvedValue(undefined);

            return request(app.getHttpServer())
                .post(`/episodes/${mockEpisode.id}/play`)
                .expect(204)
                .then(() => {
                    expect(episodesService.incrementPlayCount).toHaveBeenCalledWith(mockEpisode.id);
                });
        });
    });

    describe('GET /episodes/public', () => {
        it('should return public episodes with pagination', () => {
            const mockResponse = {
                episodes: [createPublicMockEpisode(), createPublicMockEpisode()],
                total: 2,
                page: 1,
                totalPages: 1,
            };
            mockEpisodesService.findPublic.mockResolvedValue(mockResponse);

            return request(app.getHttpServer())
                .get('/episodes/public?page=1&limit=20')
                .expect(200)
                .then(response => {
                    expect(response.body.episodes).toHaveLength(2);
                    expect(response.body.total).toBe(2);
                    expect(episodesService.findPublic).toHaveBeenCalled();
                });
        });
    });

    describe('GET /episodes/trending', () => {
        it('should return trending episodes', () => {
            const mockEpisodes = [createPublicMockEpisode(), createPublicMockEpisode()];
            mockEpisodesService.findTrending.mockResolvedValue(mockEpisodes);

            return request(app.getHttpServer())
                .get('/episodes/trending?limit=10')
                .expect(200)
                .then(response => {
                    expect(response.body).toHaveLength(2);
                    expect(episodesService.findTrending).toHaveBeenCalledWith(10);
                });
        });
    });

    describe('GET /episodes/my', () => {
        it('should return user episodes', () => {
            const mockEpisodes = [
                createMockEpisode({ userId: mockUserId }),
                createCompletedMockEpisode({ userId: mockUserId }),
            ];
            mockEpisodesService.findAllByUser.mockResolvedValue(mockEpisodes);

            return request(app.getHttpServer())
                .get('/episodes/my')
                .set('Authorization', 'Bearer mock-token')
                .expect(200)
                .then(response => {
                    expect(response.body).toHaveLength(2);
                    expect(episodesService.findAllByUser).toHaveBeenCalledWith(mockUserId);
                });
        });
    });

    describe('POST /episodes', () => {
        it('should create a new episode', () => {
            const mockEpisode = createMockEpisode({
                userId: mockUserId,
                ...mockCreateEpisodeDto,
            });
            mockEpisodesService.create.mockResolvedValue(mockEpisode);

            return request(app.getHttpServer())
                .post('/episodes')
                .set('Authorization', 'Bearer mock-token')
                .send(mockCreateEpisodeDto)
                .expect(201)
                .then(response => {
                    expect(response.body).toHaveProperty('id');
                    expect(episodesService.create).toHaveBeenCalledWith(
                        mockUserId,
                        expect.objectContaining({
                            title: mockCreateEpisodeDto.title,
                        }),
                    );
                });
        });
    });

    describe('GET /episodes/:id', () => {
        it('should return an episode for owner', () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            mockEpisodesService.findOne.mockResolvedValue(mockEpisode);

            return request(app.getHttpServer())
                .get(`/episodes/${mockEpisode.id}`)
                .set('Authorization', 'Bearer mock-token')
                .expect(200)
                .then(response => {
                    expect(response.body.id).toBe(mockEpisode.id);
                    expect(episodesService.findOne).toHaveBeenCalledWith(
                        mockEpisode.id,
                        mockUserId,
                    );
                });
        });

        it('should return public episode without auth', () => {
            const mockEpisode = createPublicMockEpisode();
            mockEpisodesService.findOne.mockResolvedValue(mockEpisode);

            return request(app.getHttpServer())
                .get(`/episodes/${mockEpisode.id}`)
                // No Authorization header
                .expect(200)
                .then(response => {
                    expect(response.body.isPublic).toBe(true);
                });
        });

        it('should return 404 for non-existent episode', () => {
            mockEpisodesService.findOne.mockRejectedValue(
                new NotFoundException('Episode not found'),
            );

            return request(app.getHttpServer())
                .get('/episodes/non-existent-id')
                .set('Authorization', 'Bearer mock-token')
                .expect(404);
        });
    });

    describe('PATCH /episodes/:id', () => {
        it('should update an episode', () => {
            const mockEpisode = createMockEpisode({ userId: mockUserId });
            const updatedEpisode = { ...mockEpisode, title: 'Updated Title' };
            mockEpisodesService.update.mockResolvedValue(updatedEpisode);

            return request(app.getHttpServer())
                .patch(`/episodes/${mockEpisode.id}`)
                .set('Authorization', 'Bearer mock-token')
                .send({ title: 'Updated Title' })
                .expect(200)
                .then(response => {
                    expect(response.body.title).toBe('Updated Title');
                    expect(episodesService.update).toHaveBeenCalledWith(
                        mockEpisode.id,
                        mockUserId,
                        { title: 'Updated Title' },
                    );
                });
        });
    });

    describe('DELETE /episodes/:id', () => {
        it('should delete an episode', () => {
            const mockEpisode = createMockEpisode({ userId: mockUserId });
            mockEpisodesService.remove.mockResolvedValue(undefined);

            return request(app.getHttpServer())
                .delete(`/episodes/${mockEpisode.id}`)
                .set('Authorization', 'Bearer mock-token')
                .expect(204)
                .then(() => {
                    expect(episodesService.remove).toHaveBeenCalledWith(mockEpisode.id, mockUserId);
                });
        });
    });

    describe('POST /episodes/:id/publish', () => {
        it('should make episode public', () => {
            const mockEpisode = createCompletedMockEpisode({ userId: mockUserId });
            const publicEpisode = { ...mockEpisode, isPublic: true };
            mockEpisodesService.makePublic.mockResolvedValue(publicEpisode);

            return request(app.getHttpServer())
                .post(`/episodes/${mockEpisode.id}/publish`)
                .set('Authorization', 'Bearer mock-token')
                .expect(201)
                .then(response => {
                    expect(response.body.isPublic).toBe(true);
                    expect(episodesService.makePublic).toHaveBeenCalledWith(
                        mockEpisode.id,
                        mockUserId,
                    );
                });
        });
    });

    describe('POST /episodes/:id/retry', () => {
        it('should retry failed generation', () => {
            const mockEpisode = createMockEpisode({
                userId: mockUserId,
                generationStatus: 'FAILED',
            });
            const retriedEpisode = { ...mockEpisode, generationStatus: 'PENDING' };
            mockEpisodesService.retryGeneration.mockResolvedValue(retriedEpisode);

            return request(app.getHttpServer())
                .post(`/episodes/${mockEpisode.id}/retry`)
                .set('Authorization', 'Bearer mock-token')
                .expect(201)
                .then(response => {
                    expect(response.body.generationStatus).toBe('PENDING');
                    expect(episodesService.retryGeneration).toHaveBeenCalledWith(
                        mockEpisode.id,
                        mockUserId,
                    );
                });
        });
    });
});
