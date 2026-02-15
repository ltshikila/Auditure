import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../common/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePodcasterDto } from './dto/create-podcaster.dto';
import { UpdatePodcasterDto } from './dto/update-podcaster.dto';
import { QueryPodcastersDto, PodcasterSortBy } from './dto/query-podcasters.dto';
import { PodcasterResponseDto } from './dto/podcaster-response.dto';
import { selectGeminiVoice } from './utils/gemini-voice-selector';

@Injectable()
export class PodcastersService {
    private readonly logger = new Logger(PodcastersService.name);

    constructor(
        private databaseService: DatabaseService,
        private storageService: StorageService,
        private notificationsService: NotificationsService,
    ) {}

    /**
     * Create a new podcaster/virtual podcaster
     */
    async create(
        userId: string,
        createPodcasterDto: CreatePodcasterDto,
    ): Promise<PodcasterResponseDto> {
        this.logger.log(`create() called for user ${userId}`);
        this.logger.log(`DTO: ${JSON.stringify(createPodcasterDto)}`);

        try {
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
                'Technology',
                'Education',
                'Health & Wellness',
                'Spirituality',
                'Economics',
                'Sociology',
                'Religion',
                'Mathematics',
                'Mindfulness',
            ];

            const invalidTags = createPodcasterDto.expertiseTags.filter(
                tag => !validExpertiseTags.includes(tag),
            );

            if (invalidTags.length > 0) {
                this.logger.error(`Invalid expertise tags: ${invalidTags.join(', ')}`);
                throw new BadRequestException(`Invalid expertise tags: ${invalidTags.join(', ')}`);
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
                this.logger.error(
                    `Invalid intellectual angle: ${createPodcasterDto.intellectualAngle}`,
                );
                throw new BadRequestException(
                    `Invalid intellectual angle. Must be one of: ${validAngles.join(', ')}`,
                );
            }

            // Compute the Gemini voice name based on podcaster settings
            const geminiVoiceName = selectGeminiVoice({
                gender: createPodcasterDto.gender as 'MALE' | 'FEMALE',
                voiceModel: createPodcasterDto.voiceModel,
                speakingSpeed: createPodcasterDto.speakingSpeed ?? 5,
                vocalPitch: createPodcasterDto.vocalPitch ?? 5,
            });
            this.logger.log(`Computed Gemini voice: ${geminiVoiceName}`);

            const podcaster = await this.databaseService.podcaster.create({
                data: {
                    userId,
                    ...createPodcasterDto,
                    geminiVoiceName,
                },
            });

            this.logger.log(`Podcaster created with ID: ${podcaster.id}`);
            return podcaster as PodcasterResponseDto;
        } catch (error) {
            this.logger.error(`Error in create(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Find all podcasters for a user (private + public ones they created)
     */
    async findAllByUser(userId: string): Promise<PodcasterResponseDto[]> {
        this.logger.log(`findAllByUser() called for user ${userId}`);

        try {
            const podcasters = await this.databaseService.podcaster.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
            });

            this.logger.log(`Found ${podcasters.length} podcasters for user ${userId}`);
            return podcasters as PodcasterResponseDto[];
        } catch (error) {
            this.logger.error(`Error in findAllByUser(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Find public podcasters (for feed/discovery)
     */
    async findPublic(query: QueryPodcastersDto): Promise<{
        podcasters: PodcasterResponseDto[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        this.logger.log(`findPublic() called with query: ${JSON.stringify(query)}`);

        try {
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
            this.logger.log(`Total public podcasters matching query: ${total}`);

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

            this.logger.log(`Returning ${podcasters.length} podcasters (page ${page})`);

            // Transform response
            const transformedPodcasters = podcasters.map(p => ({
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
        } catch (error) {
            this.logger.error(`Error in findPublic(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Find trending podcasters (most plays in last 30 days)
     */
    async findTrending(limit: number = 10): Promise<PodcasterResponseDto[]> {
        this.logger.log(`findTrending() called with limit: ${limit}`);

        try {
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

            this.logger.log(`Found ${podcasters.length} trending podcasters`);

            return podcasters.map(p => ({
                ...p,
                creator: p.user,
                user: undefined,
            })) as any as PodcasterResponseDto[];
        } catch (error) {
            this.logger.error(`Error in findTrending(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Find podcasters by genre/expertise
     */
    async findByExpertise(
        expertiseTag: string,
        limit: number = 20,
    ): Promise<PodcasterResponseDto[]> {
        this.logger.log(`findByExpertise() called with tag: ${expertiseTag}, limit: ${limit}`);

        try {
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

            this.logger.log(
                `Found ${podcasters.length} podcasters with expertise: ${expertiseTag}`,
            );

            return podcasters.map(p => ({
                ...p,
                creator: p.user,
                user: undefined,
            })) as any as PodcasterResponseDto[];
        } catch (error) {
            this.logger.error(`Error in findByExpertise(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Find one podcaster by ID
     */
    async findOne(id: string, userId?: string): Promise<PodcasterResponseDto> {
        this.logger.log(`findOne() called for podcaster ${id}, userId: ${userId || 'none'}`);

        try {
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
                this.logger.warn(`Podcaster not found: ${id}`);
                throw new NotFoundException('Podcaster not found');
            }

            // Check access permissions
            if (!podcaster.isPublic && podcaster.userId !== userId) {
                this.logger.warn(`Access denied to private podcaster ${id} for user ${userId}`);
                throw new ForbiddenException('Access denied to private podcaster');
            }

            this.logger.log(`Found podcaster: ${podcaster.name}`);

            return {
                ...podcaster,
                creator: podcaster.user,
                user: undefined,
            } as any as PodcasterResponseDto;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error in findOne(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Update a podcaster
     */
    async update(
        id: string,
        userId: string,
        updatePodcasterDto: UpdatePodcasterDto,
    ): Promise<PodcasterResponseDto> {
        this.logger.log(`update() called for podcaster ${id} by user ${userId}`);
        this.logger.log(`Update DTO: ${JSON.stringify(updatePodcasterDto)}`);

        try {
            // Check ownership
            const podcaster = await this.databaseService.podcaster.findUnique({
                where: { id },
            });

            if (!podcaster) {
                this.logger.warn(`Podcaster not found: ${id}`);
                throw new NotFoundException('Podcaster not found');
            }

            if (podcaster.userId !== userId) {
                this.logger.warn(
                    `User ${userId} attempted to update podcaster ${id} owned by ${podcaster.userId}`,
                );
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
                    'Technology',
                    'Education',
                    'Health & Wellness',
                    'Spirituality',
                    'Economics',
                    'Sociology',
                    'Religion',
                    'Mathematics',
                    'Mindfulness',
                ];

                const invalidTags = updatePodcasterDto.expertiseTags.filter(
                    tag => !validExpertiseTags.includes(tag),
                );

                if (invalidTags.length > 0) {
                    this.logger.error(`Invalid expertise tags: ${invalidTags.join(', ')}`);
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
                    this.logger.error(
                        `Invalid intellectual angle: ${updatePodcasterDto.intellectualAngle}`,
                    );
                    throw new BadRequestException(
                        `Invalid intellectual angle. Must be one of: ${validAngles.join(', ')}`,
                    );
                }
            }

            // Check if voice-related fields are being updated
            const voiceFieldsUpdated =
                updatePodcasterDto.gender !== undefined ||
                updatePodcasterDto.voiceModel !== undefined ||
                updatePodcasterDto.speakingSpeed !== undefined ||
                updatePodcasterDto.vocalPitch !== undefined;

            // Prepare update data
            const updateData: any = { ...updatePodcasterDto };

            // Recompute Gemini voice if voice-related fields changed
            if (voiceFieldsUpdated) {
                const geminiVoiceName = selectGeminiVoice({
                    gender: (updatePodcasterDto.gender ?? podcaster.gender) as 'MALE' | 'FEMALE',
                    voiceModel: updatePodcasterDto.voiceModel ?? podcaster.voiceModel,
                    speakingSpeed: updatePodcasterDto.speakingSpeed ?? podcaster.speakingSpeed,
                    vocalPitch: updatePodcasterDto.vocalPitch ?? podcaster.vocalPitch,
                });
                updateData.geminiVoiceName = geminiVoiceName;
                this.logger.log(`Recomputed Gemini voice: ${geminiVoiceName}`);
            }

            const updated = await this.databaseService.podcaster.update({
                where: { id },
                data: updateData,
            });

            // When a podcaster is made public, also make its completed episodes public
            if (updatePodcasterDto.isPublic === true && !podcaster.isPublic) {
                const result = await this.databaseService.episode.updateMany({
                    where: {
                        podcasterId: id,
                        generationStatus: 'COMPLETED',
                        isPublic: false,
                    },
                    data: { isPublic: true },
                });
                if (result.count > 0) {
                    this.logger.log(
                        `Made ${result.count} episodes public for podcaster ${id}`,
                    );
                }
            }

            // When a podcaster is made private, also make all its episodes private
            if (updatePodcasterDto.isPublic === false && podcaster.isPublic) {
                const result = await this.databaseService.episode.updateMany({
                    where: {
                        podcasterId: id,
                        isPublic: true,
                    },
                    data: { isPublic: false },
                });
                if (result.count > 0) {
                    this.logger.log(
                        `Made ${result.count} episodes private for podcaster ${id}`,
                    );
                }
            }

            this.logger.log(`Podcaster ${id} updated successfully`);
            return updated as PodcasterResponseDto;
        } catch (error) {
            if (
                error instanceof NotFoundException ||
                error instanceof ForbiddenException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }
            this.logger.error(`Error in update(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Upload podcaster profile picture
     */
    async uploadProfilePicture(
        id: string,
        userId: string,
        file: Express.Multer.File,
    ): Promise<PodcasterResponseDto> {
        this.logger.log(`uploadProfilePicture() called for podcaster ${id} by user ${userId}`);

        const podcaster = await this.databaseService.podcaster.findUnique({
            where: { id },
            select: { userId: true, profilePictureKey: true },
        });

        if (!podcaster) throw new NotFoundException('Podcaster not found');
        if (podcaster.userId !== userId) throw new ForbiddenException('Not authorized');

        // Delete old picture if exists
        if (podcaster.profilePictureKey) {
            await this.storageService
                .deleteFile(podcaster.profilePictureKey)
                .catch(e => this.logger.warn(`Failed to delete old profile picture: ${e.message}`));
        }

        const ext = file.originalname?.split('.').pop() || 'jpg';
        const key = `podcasters/${id}/profile-picture.${ext}`;
        await this.storageService.uploadFile(file.buffer, key, file.mimetype);

        const profilePictureUrl = `/api/storage/${key}`;

        const updated = await this.databaseService.podcaster.update({
            where: { id },
            data: { profilePictureUrl, profilePictureKey: key },
        });

        this.logger.log(`Profile picture uploaded for podcaster ${id}`);
        return updated as PodcasterResponseDto;
    }

    /**
     * Remove podcaster profile picture
     */
    async removeProfilePicture(id: string, userId: string): Promise<PodcasterResponseDto> {
        this.logger.log(`removeProfilePicture() called for podcaster ${id} by user ${userId}`);

        const podcaster = await this.databaseService.podcaster.findUnique({
            where: { id },
            select: { userId: true, profilePictureKey: true },
        });

        if (!podcaster) throw new NotFoundException('Podcaster not found');
        if (podcaster.userId !== userId) throw new ForbiddenException('Not authorized');

        if (podcaster.profilePictureKey) {
            await this.storageService
                .deleteFile(podcaster.profilePictureKey)
                .catch(e => this.logger.warn(`Failed to delete profile picture: ${e.message}`));
        }

        const updated = await this.databaseService.podcaster.update({
            where: { id },
            data: { profilePictureUrl: null, profilePictureKey: null },
        });

        this.logger.log(`Profile picture removed for podcaster ${id}`);
        return updated as PodcasterResponseDto;
    }

    /**
     * Delete a podcaster
     */
    async remove(id: string, userId: string): Promise<void> {
        this.logger.log(`remove() called for podcaster ${id} by user ${userId}`);

        try {
            const podcaster = await this.databaseService.podcaster.findUnique({
                where: { id },
            });

            if (!podcaster) {
                this.logger.warn(`Podcaster not found: ${id}`);
                throw new NotFoundException('Podcaster not found');
            }

            if (podcaster.userId !== userId) {
                this.logger.warn(
                    `User ${userId} attempted to delete podcaster ${id} owned by ${podcaster.userId}`,
                );
                throw new ForbiddenException('You can only delete your own podcasters');
            }

            await this.databaseService.podcaster.delete({
                where: { id },
            });

            this.logger.log(`Podcaster ${id} deleted successfully`);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error in remove(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    private static readonly PLAY_MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000];

    /**
     * Increment play count
     */
    async incrementPlayCount(id: string): Promise<void> {
        this.logger.log(`incrementPlayCount() called for podcaster ${id}`);

        try {
            const podcaster = await this.databaseService.podcaster.update({
                where: { id },
                data: {
                    playCount: {
                        increment: 1,
                    },
                },
                select: { playCount: true, userId: true, name: true },
            });
            this.logger.log(`Play count incremented for podcaster ${id}`);

            // Check for milestone
            if (PodcastersService.PLAY_MILESTONES.includes(podcaster.playCount)) {
                try {
                    await this.notificationsService.notifyMilestone(
                        podcaster.userId,
                        podcaster.name,
                        id,
                        podcaster.playCount,
                    );
                } catch (notifError) {
                    this.logger.error(
                        `Failed to send milestone notification: ${notifError.message}`,
                    );
                }
            }
        } catch (error) {
            this.logger.error(`Error in incrementPlayCount(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Increment like count
     */
    async incrementLikeCount(id: string): Promise<void> {
        this.logger.log(`incrementLikeCount() called for podcaster ${id}`);

        try {
            await this.databaseService.podcaster.update({
                where: { id },
                data: {
                    likeCount: {
                        increment: 1,
                    },
                },
            });
            this.logger.log(`Like count incremented for podcaster ${id}`);
        } catch (error) {
            this.logger.error(`Error in incrementLikeCount(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Decrement like count
     */
    async decrementLikeCount(id: string): Promise<void> {
        this.logger.log(`decrementLikeCount() called for podcaster ${id}`);

        try {
            // Prevent likeCount from going negative using GREATEST
            await this.databaseService.$executeRaw`
                UPDATE "podcasters" SET "likeCount" = GREATEST("likeCount" - 1, 0), "updatedAt" = NOW()
                WHERE "id" = ${id}
            `;
            this.logger.log(`Like count decremented for podcaster ${id}`);
        } catch (error) {
            this.logger.error(`Error in decrementLikeCount(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Increment share count
     */
    async incrementShareCount(id: string): Promise<void> {
        this.logger.log(`incrementShareCount() called for podcaster ${id}`);

        try {
            await this.databaseService.podcaster.update({
                where: { id },
                data: {
                    shareCount: {
                        increment: 1,
                    },
                },
            });
            this.logger.log(`Share count incremented for podcaster ${id}`);
        } catch (error) {
            this.logger.error(`Error in incrementShareCount(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Rate a podcaster (1-5 stars)
     * Creates or updates the user's rating for this podcaster
     */
    async ratePodcaster(
        podcasterId: string,
        userId: string,
        rating: number,
    ): Promise<{ averageRating: number; ratingCount: number }> {
        this.logger.log(
            `ratePodcaster() called: podcaster=${podcasterId}, user=${userId}, rating=${rating}`,
        );

        if (rating < 1 || rating > 5) {
            throw new BadRequestException('Rating must be between 1 and 5');
        }

        try {
            // Upsert the rating
            await this.databaseService.podcasterRating.upsert({
                where: {
                    podcasterId_userId: {
                        podcasterId,
                        userId,
                    },
                },
                create: {
                    podcasterId,
                    userId,
                    rating,
                },
                update: {
                    rating,
                },
            });

            // Recalculate average rating
            const aggregation = await this.databaseService.podcasterRating.aggregate({
                where: { podcasterId },
                _avg: { rating: true },
                _count: { rating: true },
            });

            const averageRating = aggregation._avg.rating || 0;
            const ratingCount = aggregation._count.rating || 0;

            // Update podcaster with new averages
            const podcaster = await this.databaseService.podcaster.update({
                where: { id: podcasterId },
                data: {
                    averageRating,
                    ratingCount,
                },
            });

            // Notify podcaster owner (don't notify yourself)
            if (podcaster.userId !== userId) {
                try {
                    await this.notificationsService.notifyNewRating(
                        podcaster.userId,
                        podcasterId,
                        podcaster.name,
                        rating,
                    );
                } catch (notifError) {
                    this.logger.error(`Failed to send rating notification: ${notifError.message}`);
                }
            }

            this.logger.log(
                `Podcaster ${podcasterId} rated: avg=${averageRating}, count=${ratingCount}`,
            );

            return { averageRating, ratingCount };
        } catch (error) {
            this.logger.error(`Error in ratePodcaster(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Get user's rating for a podcaster
     */
    async getUserRating(podcasterId: string, userId: string): Promise<number | null> {
        this.logger.log(`getUserRating() called: podcaster=${podcasterId}, user=${userId}`);

        try {
            const rating = await this.databaseService.podcasterRating.findUnique({
                where: {
                    podcasterId_userId: {
                        podcasterId,
                        userId,
                    },
                },
            });

            return rating?.rating || null;
        } catch (error) {
            this.logger.error(`Error in getUserRating(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }
}
