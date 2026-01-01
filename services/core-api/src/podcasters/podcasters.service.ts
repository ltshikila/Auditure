import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePodcasterDto } from './dto/create-podcaster.dto';
import { UpdatePodcasterDto } from './dto/update-podcaster.dto';
import { QueryPodcastersDto, PodcasterSortBy } from './dto/query-podcasters.dto';
import { PodcasterResponseDto } from './dto/podcaster-response.dto';

@Injectable()
export class PodcastersService {
    constructor(private databaseService: DatabaseService) {}

    /**
     * Create a new podcaster/virtual podcaster
     */
    async create(
        userId: string,
        createPodcasterDto: CreatePodcasterDto,
    ): Promise<PodcasterResponseDto> {
        // Validate expertise tags
        const validExpertiseTags = [
            'Philosophy',
            'Psychology',
            'Finance',
            'History',
            'Literature',
            'Politics',
            'Self-help',
            'Science',
            'Business',
            'Art & Culture',
        ];

        const invalidTags = createPodcasterDto.expertiseTags.filter(
            (tag) => !validExpertiseTags.includes(tag),
        );

        if (invalidTags.length > 0) {
            throw new BadRequestException(
                `Invalid expertise tags: ${invalidTags.join(', ')}`,
            );
        }

        // Validate intellectual angle
        const validAngles = [
            'Skeptical',
            'Accepting',
            'Critical',
            'Pragmatic',
            'Idealistic',
            'Empirical',
        ];

        if (!validAngles.includes(createPodcasterDto.intellectualAngle)) {
            throw new BadRequestException(
                `Invalid intellectual angle. Must be one of: ${validAngles.join(', ')}`,
            );
        }

        const podcaster = await this.databaseService.podcaster.create({
            data: {
                userId,
                ...createPodcasterDto,
            },
        });

        return podcaster as PodcasterResponseDto;
    }

    /**
     * Find all podcasters for a user (private + public ones they created)
     */
    async findAllByUser(userId: string): Promise<PodcasterResponseDto[]> {
        const podcasters = await this.databaseService.podcaster.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        return podcasters as PodcasterResponseDto[];
    }

    /**
     * Find public podcasters (for feed/discovery)
     */
    async findPublic(
        query: QueryPodcastersDto,
    ): Promise<{ podcasters: PodcasterResponseDto[]; total: number; page: number; totalPages: number }> {
        const { sortBy, search, expertiseTags, gender, voiceModel } = query;

        // Apply defaults for pagination
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        // Build where clause
        const where: any = {
            isPublic: true,
        };

        // Search filter
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Expertise tags filter
        if (expertiseTags && expertiseTags.length > 0) {
            where.expertiseTags = {
                hasSome: expertiseTags,
            };
        }

        // Gender filter
        if (gender) {
            where.gender = gender;
        }

        // Voice model filter
        if (voiceModel) {
            where.voiceModel = voiceModel;
        }

        // Determine sort order
        let orderBy: any = { createdAt: 'desc' };

        if (sortBy === PodcasterSortBy.POPULAR) {
            orderBy = { playCount: 'desc' };
        } else if (sortBy === PodcasterSortBy.MOST_LIKED) {
            orderBy = { likeCount: 'desc' };
        }

        // Get total count
        const total = await this.databaseService.podcaster.count({ where });

        // Get podcasters with pagination
        const podcasters = await this.databaseService.podcaster.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        // Transform response
        const transformedPodcasters = podcasters.map((p) => ({
            ...p,
            creator: p.user,
            user: undefined,
        })) as any as PodcasterResponseDto[];

        return {
            podcasters: transformedPodcasters,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Find trending podcasters (most plays in last 30 days)
     */
    async findTrending(limit: number = 10): Promise<PodcasterResponseDto[]> {
        const podcasters = await this.databaseService.podcaster.findMany({
            where: {
                isPublic: true,
                updatedAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
            },
            orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }],
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        return podcasters.map((p) => ({
            ...p,
            creator: p.user,
            user: undefined,
        })) as any as PodcasterResponseDto[];
    }

    /**
     * Find podcasters by genre/expertise
     */
    async findByExpertise(
        expertiseTag: string,
        limit: number = 20,
    ): Promise<PodcasterResponseDto[]> {
        const podcasters = await this.databaseService.podcaster.findMany({
            where: {
                isPublic: true,
                expertiseTags: {
                    has: expertiseTag,
                },
            },
            orderBy: { playCount: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        return podcasters.map((p) => ({
            ...p,
            creator: p.user,
            user: undefined,
        })) as any as PodcasterResponseDto[];
    }

    /**
     * Find one podcaster by ID
     */
    async findOne(id: string, userId?: string): Promise<PodcasterResponseDto> {
        const podcaster = await this.databaseService.podcaster.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        if (!podcaster) {
            throw new NotFoundException('Podcaster not found');
        }

        // Check access permissions
        if (!podcaster.isPublic && podcaster.userId !== userId) {
            throw new ForbiddenException('Access denied to private podcaster');
        }

        return {
            ...podcaster,
            creator: podcaster.user,
            user: undefined,
        } as any as PodcasterResponseDto;
    }

    /**
     * Update a podcaster
     */
    async update(
        id: string,
        userId: string,
        updatePodcasterDto: UpdatePodcasterDto,
    ): Promise<PodcasterResponseDto> {
        // Check ownership
        const podcaster = await this.databaseService.podcaster.findUnique({
            where: { id },
        });

        if (!podcaster) {
            throw new NotFoundException('Podcaster not found');
        }

        if (podcaster.userId !== userId) {
            throw new ForbiddenException('You can only update your own podcasters');
        }

        // Validate expertise tags if provided
        if (updatePodcasterDto.expertiseTags) {
            const validExpertiseTags = [
                'Philosophy',
                'Psychology',
                'Finance',
                'History',
                'Literature',
                'Politics',
                'Self-help',
                'Science',
                'Business',
                'Art & Culture',
            ];

            const invalidTags = updatePodcasterDto.expertiseTags.filter(
                (tag) => !validExpertiseTags.includes(tag),
            );

            if (invalidTags.length > 0) {
                throw new BadRequestException(
                    `Invalid expertise tags: ${invalidTags.join(', ')}`,
                );
            }
        }

        // Validate intellectual angle if provided
        if (updatePodcasterDto.intellectualAngle) {
            const validAngles = [
                'Skeptical',
                'Accepting',
                'Critical',
                'Pragmatic',
                'Idealistic',
                'Empirical',
            ];

            if (!validAngles.includes(updatePodcasterDto.intellectualAngle)) {
                throw new BadRequestException(
                    `Invalid intellectual angle. Must be one of: ${validAngles.join(', ')}`,
                );
            }
        }

        const updated = await this.databaseService.podcaster.update({
            where: { id },
            data: updatePodcasterDto,
        });

        return updated as PodcasterResponseDto;
    }

    /**
     * Delete a podcaster
     */
    async remove(id: string, userId: string): Promise<void> {
        const podcaster = await this.databaseService.podcaster.findUnique({
            where: { id },
        });

        if (!podcaster) {
            throw new NotFoundException('Podcaster not found');
        }

        if (podcaster.userId !== userId) {
            throw new ForbiddenException('You can only delete your own podcasters');
        }

        await this.databaseService.podcaster.delete({
            where: { id },
        });
    }

    /**
     * Increment play count
     */
    async incrementPlayCount(id: string): Promise<void> {
        await this.databaseService.podcaster.update({
            where: { id },
            data: {
                playCount: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Increment like count
     */
    async incrementLikeCount(id: string): Promise<void> {
        await this.databaseService.podcaster.update({
            where: { id },
            data: {
                likeCount: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Decrement like count
     */
    async decrementLikeCount(id: string): Promise<void> {
        await this.databaseService.podcaster.update({
            where: { id },
            data: {
                likeCount: {
                    decrement: 1,
                },
            },
        });
    }

    /**
     * Increment share count
     */
    async incrementShareCount(id: string): Promise<void> {
        await this.databaseService.podcaster.update({
            where: { id },
            data: {
                shareCount: {
                    increment: 1,
                },
            },
        });
    }
}
