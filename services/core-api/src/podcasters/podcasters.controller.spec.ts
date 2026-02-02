import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request = require('supertest');
import { PodcastersController } from './podcasters.controller';
import { PodcastersService } from './podcasters.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
    createMockPodcaster,
    createPublicMockPodcaster,
    createTrendingMockPodcaster,
    mockCreatePodcasterDto,
    mockUpdatePodcasterDto,
} from '../../test/fixtures/podcasters.fixture';

describe('PodcastersController (Integration)', () => {
    let app: INestApplication;
    let podcastersService: PodcastersService;

    const mockPodcastersService = {
        create: jest.fn(),
        findAllByUser: jest.fn(),
        findPublic: jest.fn(),
        findTrending: jest.fn(),
        findByExpertise: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        incrementPlayCount: jest.fn(),
        incrementLikeCount: jest.fn(),
        decrementLikeCount: jest.fn(),
        incrementShareCount: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PodcastersController],
            providers: [
                {
                    provide: PodcastersService,
                    useValue: mockPodcastersService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: jest.fn(context => {
                    const request = context.switchToHttp().getRequest();
                    request.user = { userId: 'test-user-id', email: 'test@example.com' };
                    return true;
                }),
            })
            .overrideGuard(OptionalJwtAuthGuard)
            .useValue({
                canActivate: jest.fn(context => {
                    const request = context.switchToHttp().getRequest();
                    request.user = { userId: 'test-user-id', email: 'test@example.com' };
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

        podcastersService = module.get<PodcastersService>(PodcastersService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('POST /podcasters', () => {
        it('should create a new podcaster successfully', () => {
            const mockPodcaster = createMockPodcaster();
            mockPodcastersService.create.mockResolvedValue(mockPodcaster);

            return request(app.getHttpServer())
                .post('/podcasters')
                .send(mockCreatePodcasterDto)
                .expect(201)
                .then(response => {
                    expect(response.body).toMatchObject({
                        name: mockPodcaster.name,
                        voiceModel: mockPodcaster.voiceModel,
                        gender: mockPodcaster.gender,
                    });
                });
        });

        it('should return 400 for missing required fields', () => {
            return request(app.getHttpServer())
                .post('/podcasters')
                .send({ name: 'Test Podcaster' })
                .expect(400);
        });

        it('should return 400 for invalid voiceModel', () => {
            return request(app.getHttpServer())
                .post('/podcasters')
                .send({ ...mockCreatePodcasterDto, voiceModel: 'INVALID' })
                .expect(400);
        });

        it('should return 400 for invalid gender', () => {
            return request(app.getHttpServer())
                .post('/podcasters')
                .send({ ...mockCreatePodcasterDto, gender: 'INVALID' })
                .expect(400);
        });

        it('should return 400 for speakingSpeed out of range', () => {
            return request(app.getHttpServer())
                .post('/podcasters')
                .send({ ...mockCreatePodcasterDto, speakingSpeed: 11 })
                .expect(400);
        });

        it('should return 400 for expertiseTags with more than 3 tags', () => {
            return request(app.getHttpServer())
                .post('/podcasters')
                .send({
                    ...mockCreatePodcasterDto,
                    expertiseTags: ['Philosophy', 'Psychology', 'Finance', 'History'],
                })
                .expect(400);
        });

        it('should return 400 for expertiseTags with less than 1 tag', () => {
            return request(app.getHttpServer())
                .post('/podcasters')
                .send({ ...mockCreatePodcasterDto, expertiseTags: [] })
                .expect(400);
        });
    });

    describe('GET /podcasters/public', () => {
        it('should return paginated public podcasters', () => {
            const response = {
                podcasters: [createPublicMockPodcaster()],
                total: 50,
                page: 1,
                totalPages: 3,
            };
            mockPodcastersService.findPublic.mockResolvedValue(response);

            return request(app.getHttpServer())
                .get('/podcasters/public')
                .expect(200)
                .then(res => {
                    expect(res.body.total).toBe(50);
                    expect(res.body.page).toBe(1);
                    expect(res.body.totalPages).toBe(3);
                    expect(res.body.podcasters).toHaveLength(1);
                });
        });

        it('should accept query parameters for filtering', () => {
            const response = { podcasters: [], total: 0, page: 1, totalPages: 0 };
            mockPodcastersService.findPublic.mockResolvedValue(response);

            return request(app.getHttpServer())
                .get('/podcasters/public')
                .query({
                    sortBy: 'POPULAR',
                    page: 2,
                    limit: 10,
                    search: 'philosophy',
                })
                .expect(200)
                .then(() => {
                    expect(mockPodcastersService.findPublic).toHaveBeenCalledWith(
                        expect.objectContaining({
                            sortBy: 'POPULAR',
                            page: 2,
                            limit: 10,
                            search: 'philosophy',
                        }),
                    );
                });
        });
    });

    describe('GET /podcasters/trending', () => {
        it('should return trending podcasters', () => {
            const response = [createTrendingMockPodcaster()];
            mockPodcastersService.findTrending.mockResolvedValue(response);

            return request(app.getHttpServer())
                .get('/podcasters/trending')
                .expect(200)
                .then(res => {
                    expect(res.body).toHaveLength(1);
                    expect(res.body[0]).toHaveProperty('name');
                    expect(res.body[0]).toHaveProperty('playCount');
                });
        });

        it('should accept limit parameter', () => {
            mockPodcastersService.findTrending.mockResolvedValue([]);

            return request(app.getHttpServer())
                .get('/podcasters/trending')
                .query({ limit: 5 })
                .expect(200)
                .then(() => {
                    expect(mockPodcastersService.findTrending).toHaveBeenCalledWith(5);
                });
        });
    });

    describe('GET /podcasters/expertise/:tag', () => {
        it('should return podcasters by expertise tag', () => {
            const response = [createPublicMockPodcaster()];
            mockPodcastersService.findByExpertise.mockResolvedValue(response);

            return request(app.getHttpServer())
                .get('/podcasters/expertise/Philosophy')
                .expect(200)
                .then(res => {
                    expect(res.body).toHaveLength(1);
                    expect(res.body[0].expertiseTags).toContain('Philosophy');
                });
        });

        it('should accept limit parameter', () => {
            mockPodcastersService.findByExpertise.mockResolvedValue([]);

            return request(app.getHttpServer())
                .get('/podcasters/expertise/Psychology')
                .query({ limit: 15 })
                .expect(200)
                .then(() => {
                    expect(mockPodcastersService.findByExpertise).toHaveBeenCalledWith(
                        'Psychology',
                        15,
                    );
                });
        });
    });

    describe('GET /podcasters/my', () => {
        it("should return current user's podcasters", () => {
            const response = [createMockPodcaster()];
            mockPodcastersService.findAllByUser.mockResolvedValue(response);

            return request(app.getHttpServer())
                .get('/podcasters/my')
                .expect(200)
                .then(res => {
                    expect(res.body).toHaveLength(1);
                    expect(res.body[0]).toHaveProperty('name');
                });
        });
    });

    describe('GET /podcasters/:id', () => {
        it('should return a specific podcaster', () => {
            const mockPodcaster = createPublicMockPodcaster();
            mockPodcastersService.findOne.mockResolvedValue(mockPodcaster);

            return request(app.getHttpServer())
                .get('/podcasters/test-id')
                .expect(200)
                .then(res => {
                    expect(res.body).toHaveProperty('id');
                    expect(res.body).toHaveProperty('name');
                    expect(res.body.isPublic).toBe(true);
                });
        });
    });

    describe('PATCH /podcasters/:id', () => {
        it('should update a podcaster successfully', () => {
            const updatedPodcaster = createMockPodcaster();
            mockPodcastersService.update.mockResolvedValue(updatedPodcaster);

            return request(app.getHttpServer())
                .patch('/podcasters/test-id')
                .send(mockUpdatePodcasterDto)
                .expect(200)
                .then(res => {
                    expect(res.body).toHaveProperty('id');
                    expect(res.body).toHaveProperty('name');
                });
        });

        it('should accept partial updates', () => {
            const updatedPodcaster = createMockPodcaster();
            mockPodcastersService.update.mockResolvedValue(updatedPodcaster);

            return request(app.getHttpServer())
                .patch('/podcasters/test-id')
                .send({ name: 'Updated Name' })
                .expect(200);
        });
    });

    describe('DELETE /podcasters/:id', () => {
        it('should delete a podcaster successfully', () => {
            mockPodcastersService.remove.mockResolvedValue(undefined);

            return request(app.getHttpServer()).delete('/podcasters/test-id').expect(204);
        });
    });

    describe('POST /podcasters/:id/play', () => {
        it('should increment play count', () => {
            mockPodcastersService.incrementPlayCount.mockResolvedValue(undefined);

            return request(app.getHttpServer()).post('/podcasters/test-id/play').expect(204);
        });
    });

    describe('POST /podcasters/:id/like', () => {
        it('should increment like count', () => {
            mockPodcastersService.incrementLikeCount.mockResolvedValue(undefined);

            return request(app.getHttpServer()).post('/podcasters/test-id/like').expect(204);
        });
    });

    describe('DELETE /podcasters/:id/like', () => {
        it('should decrement like count', () => {
            mockPodcastersService.decrementLikeCount.mockResolvedValue(undefined);

            return request(app.getHttpServer()).delete('/podcasters/test-id/like').expect(204);
        });
    });

    describe('POST /podcasters/:id/share', () => {
        it('should increment share count', () => {
            mockPodcastersService.incrementShareCount.mockResolvedValue(undefined);

            return request(app.getHttpServer()).post('/podcasters/test-id/share').expect(204);
        });
    });

    describe('Validation Edge Cases', () => {
        it('should validate all slider values are within 1-10 range', async () => {
            const invalidSliderValues = {
                ...mockCreatePodcasterDto,
                tone: 0,
            };

            await request(app.getHttpServer())
                .post('/podcasters')
                .send(invalidSliderValues)
                .expect(400);

            invalidSliderValues.tone = 11;
            await request(app.getHttpServer())
                .post('/podcasters')
                .send(invalidSliderValues)
                .expect(400);
        });

        it('should accept all valid slider values at boundaries', () => {
            const validBoundaryValues = {
                ...mockCreatePodcasterDto,
                speakingSpeed: 1,
                vocalPitch: 10,
                sentenceStructure: 1,
                emotionalExpression: 10,
                ageTone: 10,
                tone: 1,
                communicationStyle: 10,
                humorLevel: 5,
                conversationalDepth: 5,
                chaosFactor: 1,
                viewpointBehavior: 10,
            };

            mockPodcastersService.create.mockResolvedValue(createMockPodcaster());

            return request(app.getHttpServer())
                .post('/podcasters')
                .send(validBoundaryValues)
                .expect(201);
        });
    });
});
