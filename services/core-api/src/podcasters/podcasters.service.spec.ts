import { Test, TestingModule } from '@nestjs/testing';
import { PodcastersService } from './podcasters.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
    createMockPodcaster,
    createPublicMockPodcaster,
    createTrendingMockPodcaster,
    mockCreatePodcasterDto,
    mockUpdatePodcasterDto,
    mockInvalidExpertiseTagsDto,
    mockInvalidIntellectualAngleDto,
    mockQueryPodcastersDto,
} from '../../test/fixtures/podcasters.fixture';
import { mockPrismaClient } from '../../test/mocks/database.mock';
import { PodcasterSortBy } from './dto/query-podcasters.dto';

describe('PodcastersService', () => {
    let service: PodcastersService;
    let databaseService: DatabaseService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PodcastersService,
                {
                    provide: DatabaseService,
                    useValue: mockPrismaClient,
                },
            ],
        }).compile();

        service = module.get<PodcastersService>(PodcastersService);
        databaseService = module.get<DatabaseService>(DatabaseService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a new podcaster successfully', async () => {
            const mockPodcaster = createMockPodcaster();
            mockPrismaClient.podcaster.create.mockResolvedValue(mockPodcaster);

            const result = await service.create('test-user-id', mockCreatePodcasterDto);

            expect(result).toEqual(mockPodcaster);
            expect(databaseService.podcaster.create).toHaveBeenCalledWith({
                data: {
                    userId: 'test-user-id',
                    ...mockCreatePodcasterDto,
                },
            });
        });

        it('should throw BadRequestException for invalid expertise tags', async () => {
            await expect(
                service.create('test-user-id', mockInvalidExpertiseTagsDto),
            ).rejects.toThrow(BadRequestException);

            expect(databaseService.podcaster.create).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException for invalid intellectual angle', async () => {
            await expect(
                service.create('test-user-id', mockInvalidIntellectualAngleDto),
            ).rejects.toThrow(BadRequestException);

            expect(databaseService.podcaster.create).not.toHaveBeenCalled();
        });

        it('should accept valid expertise tags', async () => {
            const mockPodcaster = createMockPodcaster();
            mockPrismaClient.podcaster.create.mockResolvedValue(mockPodcaster);

            const validDto = {
                ...mockCreatePodcasterDto,
                expertiseTags: ['Philosophy', 'Psychology', 'Finance'],
            };

            await service.create('test-user-id', validDto);

            expect(databaseService.podcaster.create).toHaveBeenCalled();
        });

        it('should accept valid intellectual angles', async () => {
            const mockPodcaster = createMockPodcaster();
            mockPrismaClient.podcaster.create.mockResolvedValue(mockPodcaster);

            const validAngles = [
                'Skeptical',
                'Open-minded',
                'Critical',
                'Accepting',
                'Questioning',
                'Trusting',
            ];

            for (const angle of validAngles) {
                const dto = { ...mockCreatePodcasterDto, intellectualAngle: angle };
                await service.create('test-user-id', dto);
            }

            expect(databaseService.podcaster.create).toHaveBeenCalledTimes(validAngles.length);
        });
    });

    describe('findAllByUser', () => {
        it('should return all podcasters for a user', async () => {
            const mockPodcasters = [
                createMockPodcaster(),
                createMockPodcaster({ name: 'Another Podcaster' }),
            ];
            mockPrismaClient.podcaster.findMany.mockResolvedValue(mockPodcasters);

            const result = await service.findAllByUser('test-user-id');

            expect(result).toEqual(mockPodcasters);
            expect(databaseService.podcaster.findMany).toHaveBeenCalledWith({
                where: { userId: 'test-user-id' },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should return empty array if user has no podcasters', async () => {
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            const result = await service.findAllByUser('test-user-id');

            expect(result).toEqual([]);
        });
    });

    describe('findPublic', () => {
        it('should return paginated public podcasters', async () => {
            const mockPodcasters = [
                createPublicMockPodcaster(),
                createPublicMockPodcaster({ name: 'Another Public Podcaster' }),
            ];
            mockPrismaClient.podcaster.count.mockResolvedValue(50);
            mockPrismaClient.podcaster.findMany.mockResolvedValue(
                mockPodcasters.map(p => ({
                    ...p,
                    user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
                })),
            );

            const result = await service.findPublic(mockQueryPodcastersDto);

            expect(result).toEqual({
                podcasters: expect.arrayContaining([
                    expect.objectContaining({
                        creator: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
                    }),
                ]),
                total: 50,
                page: 1,
                totalPages: 3,
            });
            expect(databaseService.podcaster.count).toHaveBeenCalledWith({
                where: { isPublic: true },
            });
        });

        it('should filter by search query', async () => {
            mockPrismaClient.podcaster.count.mockResolvedValue(10);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            await service.findPublic({ ...mockQueryPodcastersDto, search: 'philosophy' });

            expect(databaseService.podcaster.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            { name: { contains: 'philosophy', mode: 'insensitive' } },
                            { description: { contains: 'philosophy', mode: 'insensitive' } },
                        ]),
                    }),
                }),
            );
        });

        it('should filter by expertise tags', async () => {
            mockPrismaClient.podcaster.count.mockResolvedValue(10);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            await service.findPublic({
                ...mockQueryPodcastersDto,
                expertiseTags: ['Philosophy', 'History'],
            });

            expect(databaseService.podcaster.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        expertiseTags: { hasSome: ['Philosophy', 'History'] },
                    }),
                }),
            );
        });

        it('should sort by popularity', async () => {
            mockPrismaClient.podcaster.count.mockResolvedValue(10);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            await service.findPublic({
                ...mockQueryPodcastersDto,
                sortBy: PodcasterSortBy.POPULAR,
            });

            expect(databaseService.podcaster.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { playCount: 'desc' },
                }),
            );
        });

        it('should sort by likes', async () => {
            mockPrismaClient.podcaster.count.mockResolvedValue(10);
            mockPrismaClient.podcaster.findMany.mockResolvedValue([]);

            await service.findPublic({
                ...mockQueryPodcastersDto,
                sortBy: PodcasterSortBy.MOST_LIKED,
            });

            expect(databaseService.podcaster.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { likeCount: 'desc' },
                }),
            );
        });
    });

    describe('findTrending', () => {
        it('should return trending podcasters from last 30 days', async () => {
            const mockPodcasters = [createTrendingMockPodcaster()];
            mockPrismaClient.podcaster.findMany.mockResolvedValue(
                mockPodcasters.map(p => ({
                    ...p,
                    user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
                })),
            );

            const result = await service.findTrending(10);

            expect(result).toHaveLength(1);
            expect(databaseService.podcaster.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        isPublic: true,
                        updatedAt: expect.objectContaining({
                            gte: expect.any(Date),
                        }),
                    }),
                    orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }],
                    take: 10,
                }),
            );
        });
    });

    describe('findByExpertise', () => {
        it('should return podcasters with specific expertise tag', async () => {
            const mockPodcasters = [createPublicMockPodcaster()];
            mockPrismaClient.podcaster.findMany.mockResolvedValue(
                mockPodcasters.map(p => ({
                    ...p,
                    user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
                })),
            );

            const result = await service.findByExpertise('Philosophy', 20);

            expect(result).toHaveLength(1);
            expect(databaseService.podcaster.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        isPublic: true,
                        expertiseTags: { has: 'Philosophy' },
                    },
                }),
            );
        });
    });

    describe('findOne', () => {
        it('should return a public podcaster for any user', async () => {
            const mockPodcaster = createPublicMockPodcaster();
            mockPrismaClient.podcaster.findUnique.mockResolvedValue({
                ...mockPodcaster,
                user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
            });

            const result = await service.findOne('podcaster-id', 'different-user-id');

            expect(result).toEqual(
                expect.objectContaining({
                    id: mockPodcaster.id,
                    creator: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
                }),
            );
        });

        it('should return a private podcaster for the owner', async () => {
            const mockPodcaster = createMockPodcaster({ userId: 'test-user-id' });
            mockPrismaClient.podcaster.findUnique.mockResolvedValue({
                ...mockPodcaster,
                user: { id: 'test-user-id', firstName: 'John', lastName: 'Doe' },
            });

            const result = await service.findOne('podcaster-id', 'test-user-id');

            expect(result).toEqual(expect.objectContaining({ id: mockPodcaster.id }));
        });

        it('should throw ForbiddenException for private podcaster accessed by non-owner', async () => {
            const mockPodcaster = createMockPodcaster({
                userId: 'owner-id',
                isPublic: false,
            });
            mockPrismaClient.podcaster.findUnique.mockResolvedValue({
                ...mockPodcaster,
                user: { id: 'owner-id', firstName: 'John', lastName: 'Doe' },
            });

            await expect(service.findOne('podcaster-id', 'different-user-id')).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('should throw NotFoundException if podcaster does not exist', async () => {
            mockPrismaClient.podcaster.findUnique.mockResolvedValue(null);

            await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
        });
    });

    describe('update', () => {
        it('should update a podcaster successfully', async () => {
            const mockPodcaster = createMockPodcaster();
            const updatedPodcaster = { ...mockPodcaster, ...mockUpdatePodcasterDto };

            mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPodcaster);
            mockPrismaClient.podcaster.update.mockResolvedValue(updatedPodcaster);

            const result = await service.update(
                'podcaster-id',
                'test-user-id',
                mockUpdatePodcasterDto,
            );

            expect(result).toEqual(updatedPodcaster);
            expect(databaseService.podcaster.update).toHaveBeenCalledWith({
                where: { id: 'podcaster-id' },
                data: mockUpdatePodcasterDto,
            });
        });

        it('should throw NotFoundException if podcaster does not exist', async () => {
            mockPrismaClient.podcaster.findUnique.mockResolvedValue(null);

            await expect(
                service.update('non-existent-id', 'test-user-id', mockUpdatePodcasterDto),
            ).rejects.toThrow(NotFoundException);

            expect(databaseService.podcaster.update).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException if user is not the owner', async () => {
            const mockPodcaster = createMockPodcaster({ userId: 'different-user-id' });
            mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPodcaster);

            await expect(
                service.update('podcaster-id', 'test-user-id', mockUpdatePodcasterDto),
            ).rejects.toThrow(ForbiddenException);

            expect(databaseService.podcaster.update).not.toHaveBeenCalled();
        });

        it('should validate expertise tags if provided in update', async () => {
            const mockPodcaster = createMockPodcaster();
            mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPodcaster);

            await expect(
                service.update('podcaster-id', 'test-user-id', {
                    expertiseTags: ['InvalidTag'],
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should validate intellectual angle if provided in update', async () => {
            const mockPodcaster = createMockPodcaster();
            mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPodcaster);

            await expect(
                service.update('podcaster-id', 'test-user-id', {
                    intellectualAngle: 'InvalidAngle',
                }),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('remove', () => {
        it('should delete a podcaster successfully', async () => {
            const mockPodcaster = createMockPodcaster();
            mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPodcaster);
            mockPrismaClient.podcaster.delete.mockResolvedValue(mockPodcaster);

            await service.remove('podcaster-id', 'test-user-id');

            expect(databaseService.podcaster.delete).toHaveBeenCalledWith({
                where: { id: 'podcaster-id' },
            });
        });

        it('should throw NotFoundException if podcaster does not exist', async () => {
            mockPrismaClient.podcaster.findUnique.mockResolvedValue(null);

            await expect(service.remove('non-existent-id', 'test-user-id')).rejects.toThrow(
                NotFoundException,
            );

            expect(databaseService.podcaster.delete).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException if user is not the owner', async () => {
            const mockPodcaster = createMockPodcaster({ userId: 'different-user-id' });
            mockPrismaClient.podcaster.findUnique.mockResolvedValue(mockPodcaster);

            await expect(service.remove('podcaster-id', 'test-user-id')).rejects.toThrow(
                ForbiddenException,
            );

            expect(databaseService.podcaster.delete).not.toHaveBeenCalled();
        });
    });

    describe('incrementPlayCount', () => {
        it('should increment play count', async () => {
            mockPrismaClient.podcaster.update.mockResolvedValue({});

            await service.incrementPlayCount('podcaster-id');

            expect(databaseService.podcaster.update).toHaveBeenCalledWith({
                where: { id: 'podcaster-id' },
                data: { playCount: { increment: 1 } },
            });
        });
    });

    describe('incrementLikeCount', () => {
        it('should increment like count', async () => {
            mockPrismaClient.podcaster.update.mockResolvedValue({});

            await service.incrementLikeCount('podcaster-id');

            expect(databaseService.podcaster.update).toHaveBeenCalledWith({
                where: { id: 'podcaster-id' },
                data: { likeCount: { increment: 1 } },
            });
        });
    });

    describe('decrementLikeCount', () => {
        it('should decrement like count', async () => {
            mockPrismaClient.podcaster.update.mockResolvedValue({});

            await service.decrementLikeCount('podcaster-id');

            expect(databaseService.podcaster.update).toHaveBeenCalledWith({
                where: { id: 'podcaster-id' },
                data: { likeCount: { decrement: 1 } },
            });
        });
    });

    describe('incrementShareCount', () => {
        it('should increment share count', async () => {
            mockPrismaClient.podcaster.update.mockResolvedValue({});

            await service.incrementShareCount('podcaster-id');

            expect(databaseService.podcaster.update).toHaveBeenCalledWith({
                where: { id: 'podcaster-id' },
                data: { shareCount: { increment: 1 } },
            });
        });
    });
});
