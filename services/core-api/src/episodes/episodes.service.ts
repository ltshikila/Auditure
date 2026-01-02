import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
    StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../common/storage.service';
import { CreateEpisodeDto, ContentCoverage } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { QueryEpisodesDto, EpisodeSortBy } from './dto/query-episodes.dto';
import { EpisodeResponseDto, EpisodeStatus } from './dto/episode-response.dto';

@Injectable()
export class EpisodesService {
    private readonly logger = new Logger(EpisodesService.name);

    constructor(
        private databaseService: DatabaseService,
        private rabbitMQService: RabbitMQService,
        private redisService: RedisService,
        private storageService: StorageService,
    ) {}

    /**
     * Create a new episode and queue it for generation
     */
    async create(
        userId: string,
        createEpisodeDto: CreateEpisodeDto,
    ): Promise<EpisodeResponseDto> {
        // Validate book exists and belongs to user
        const book = await this.databaseService.book.findUnique({
            where: { id: createEpisodeDto.bookId },
        });

        if (!book) {
            throw new NotFoundException('Book not found');
        }

        if (book.userId !== userId) {
            throw new ForbiddenException('You can only create episodes from your own books');
        }

        // Validate book extraction is completed
        if (book.extractionStatus !== 'COMPLETED') {
            throw new BadRequestException(
                'Book extraction must be completed before creating an episode',
            );
        }

        // Validate podcaster exists and belongs to user or is public
        const podcaster = await this.databaseService.podcaster.findUnique({
            where: { id: createEpisodeDto.podcasterId },
        });

        if (!podcaster) {
            throw new NotFoundException('Podcaster not found');
        }

        if (!podcaster.isPublic && podcaster.userId !== userId) {
            throw new ForbiddenException('Access denied to private podcaster');
        }

        // Validate chapters if content coverage requires them
        if (
            createEpisodeDto.contentCoverage !== ContentCoverage.ENTIRE_BOOK &&
            createEpisodeDto.chapters.length === 0
        ) {
            throw new BadRequestException(
                'Chapters must be specified for chapter-based content coverage',
            );
        }

        // Validate target length range
        if (createEpisodeDto.targetLengthMin > createEpisodeDto.targetLengthMax) {
            throw new BadRequestException(
                'Target length minimum cannot be greater than maximum',
            );
        }

        // Create the episode
        const episode = await this.databaseService.episode.create({
            data: {
                userId,
                ...createEpisodeDto,
                generationStatus: 'PENDING',
            },
        });

        // Queue the episode for generation
        await this.rabbitMQService.publishEpisodeGenerationJob({
            episodeId: episode.id,
            userId,
            podcasterId: createEpisodeDto.podcasterId,
            bookId: createEpisodeDto.bookId,
            title: createEpisodeDto.title,
            contentCoverage: createEpisodeDto.contentCoverage,
            chapters: createEpisodeDto.chapters,
            episodeType: createEpisodeDto.episodeType,
            episodeTheme: createEpisodeDto.episodeTheme,
            targetLengthMin: createEpisodeDto.targetLengthMin,
            targetLengthMax: createEpisodeDto.targetLengthMax,
        });

        this.logger.log(`Created episode ${episode.id} and queued for generation`);

        return episode as EpisodeResponseDto;
    }

    /**
     * Find all episodes for a user
     */
    async findAllByUser(userId: string): Promise<EpisodeResponseDto[]> {
        const episodes = await this.databaseService.episode.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                podcaster: {
                    select: {
                        id: true,
                        name: true,
                        profilePictureUrl: true,
                    },
                },
                book: {
                    select: {
                        id: true,
                        title: true,
                        author: true,
                    },
                },
            },
        });

        return episodes as EpisodeResponseDto[];
    }

    /**
     * Find public episodes (for feed/discovery)
     */
    async findPublic(
        query: QueryEpisodesDto,
    ): Promise<{ episodes: EpisodeResponseDto[]; total: number; page: number; totalPages: number }> {
        const { sortBy, search, episodeType, episodeTheme, status, podcasterId, bookId } = query;

        // Apply defaults for pagination
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        // Build where clause
        const where: any = {
            isPublic: true,
            generationStatus: 'COMPLETED', // Only show completed episodes in public feed
        };

        // Search filter
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Episode type filter
        if (episodeType) {
            where.episodeType = episodeType;
        }

        // Episode theme filter
        if (episodeTheme) {
            where.episodeTheme = episodeTheme;
        }

        // Status filter (override public feed constraint if explicitly requested)
        if (status) {
            where.generationStatus = status;
        }

        // Podcaster filter
        if (podcasterId) {
            where.podcasterId = podcasterId;
        }

        // Book filter
        if (bookId) {
            where.bookId = bookId;
        }

        // Determine sort order
        let orderBy: any = { createdAt: 'desc' };

        if (sortBy === EpisodeSortBy.POPULAR) {
            orderBy = { playCount: 'desc' };
        } else if (sortBy === EpisodeSortBy.MOST_LIKED) {
            orderBy = { likeCount: 'desc' };
        }

        // Get total count
        const total = await this.databaseService.episode.count({ where });

        // Get episodes with pagination
        const episodes = await this.databaseService.episode.findMany({
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
                podcaster: {
                    select: {
                        id: true,
                        name: true,
                        profilePictureUrl: true,
                    },
                },
                book: {
                    select: {
                        id: true,
                        title: true,
                        author: true,
                    },
                },
            },
        });

        // Transform response
        const transformedEpisodes = episodes.map((e) => ({
            ...e,
            creator: e.user,
            user: undefined,
        })) as any as EpisodeResponseDto[];

        return {
            episodes: transformedEpisodes,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Find trending episodes (most plays in last 30 days)
     */
    async findTrending(limit: number = 10): Promise<EpisodeResponseDto[]> {
        const episodes = await this.databaseService.episode.findMany({
            where: {
                isPublic: true,
                generationStatus: 'COMPLETED',
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
                podcaster: {
                    select: {
                        id: true,
                        name: true,
                        profilePictureUrl: true,
                    },
                },
                book: {
                    select: {
                        id: true,
                        title: true,
                        author: true,
                    },
                },
            },
        });

        return episodes.map((e) => ({
            ...e,
            creator: e.user,
            user: undefined,
        })) as any as EpisodeResponseDto[];
    }

    /**
     * Find episodes by podcaster
     */
    async findByPodcaster(
        podcasterId: string,
        limit: number = 20,
    ): Promise<EpisodeResponseDto[]> {
        const episodes = await this.databaseService.episode.findMany({
            where: {
                podcasterId,
                isPublic: true,
                generationStatus: 'COMPLETED',
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                book: {
                    select: {
                        id: true,
                        title: true,
                        author: true,
                    },
                },
            },
        });

        return episodes as EpisodeResponseDto[];
    }

    /**
     * Find episodes by book
     */
    async findByBook(
        bookId: string,
        limit: number = 20,
    ): Promise<EpisodeResponseDto[]> {
        const episodes = await this.databaseService.episode.findMany({
            where: {
                bookId,
                isPublic: true,
                generationStatus: 'COMPLETED',
            },
            orderBy: { playCount: 'desc' },
            take: limit,
            include: {
                podcaster: {
                    select: {
                        id: true,
                        name: true,
                        profilePictureUrl: true,
                    },
                },
            },
        });

        return episodes as EpisodeResponseDto[];
    }

    /**
     * Find one episode by ID
     */
    async findOne(id: string, userId?: string): Promise<EpisodeResponseDto> {
        const episode = await this.databaseService.episode.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                podcaster: {
                    select: {
                        id: true,
                        name: true,
                        profilePictureUrl: true,
                    },
                },
                book: {
                    select: {
                        id: true,
                        title: true,
                        author: true,
                    },
                },
            },
        });

        if (!episode) {
            throw new NotFoundException('Episode not found');
        }

        // Check access permissions
        if (!episode.isPublic && episode.userId !== userId) {
            throw new ForbiddenException('Access denied to private episode');
        }

        return {
            ...episode,
            creator: episode.user,
            user: undefined,
        } as any as EpisodeResponseDto;
    }

    /**
     * Update an episode
     */
    async update(
        id: string,
        userId: string,
        updateEpisodeDto: UpdateEpisodeDto,
    ): Promise<EpisodeResponseDto> {
        // Check ownership
        const episode = await this.databaseService.episode.findUnique({
            where: { id },
        });

        if (!episode) {
            throw new NotFoundException('Episode not found');
        }

        if (episode.userId !== userId) {
            throw new ForbiddenException('You can only update your own episodes');
        }

        // Don't allow updates if generation is in progress
        if (
            episode.generationStatus === 'SCRIPT_GENERATING' ||
            episode.generationStatus === 'AUDIO_GENERATING'
        ) {
            throw new BadRequestException(
                'Cannot update episode while generation is in progress',
            );
        }

        // Validate target length range if provided
        const targetLengthMin = updateEpisodeDto.targetLengthMin ?? episode.targetLengthMin;
        const targetLengthMax = updateEpisodeDto.targetLengthMax ?? episode.targetLengthMax;

        if (targetLengthMin > targetLengthMax) {
            throw new BadRequestException(
                'Target length minimum cannot be greater than maximum',
            );
        }

        const updated = await this.databaseService.episode.update({
            where: { id },
            data: updateEpisodeDto,
        });

        return updated as EpisodeResponseDto;
    }

    /**
     * Delete an episode
     */
    async remove(id: string, userId: string): Promise<void> {
        const episode = await this.databaseService.episode.findUnique({
            where: { id },
        });

        if (!episode) {
            throw new NotFoundException('Episode not found');
        }

        if (episode.userId !== userId) {
            throw new ForbiddenException('You can only delete your own episodes');
        }

        await this.databaseService.episode.delete({
            where: { id },
        });
    }

    /**
     * Update episode generation status
     */
    async updateGenerationStatus(
        id: string,
        status: EpisodeStatus,
        additionalData?: {
            scriptContent?: string;
            audioFileKey?: string;
            duration?: number;
            audioFormat?: string;
            generationError?: string;
        },
    ): Promise<void> {
        const updateData: any = {
            generationStatus: status,
        };

        if (status === EpisodeStatus.SCRIPT_GENERATED && additionalData?.scriptContent) {
            updateData.scriptContent = additionalData.scriptContent;
            updateData.scriptGeneratedAt = new Date();
        }

        if (status === EpisodeStatus.COMPLETED && additionalData?.audioFileKey) {
            updateData.audioFileKey = additionalData.audioFileKey;
            updateData.audioGeneratedAt = new Date();
            updateData.duration = additionalData.duration;
            updateData.audioFormat = additionalData.audioFormat;
        }

        if (status === EpisodeStatus.FAILED && additionalData?.generationError) {
            updateData.generationError = additionalData.generationError;
        }

        await this.databaseService.episode.update({
            where: { id },
            data: updateData,
        });
    }

    /**
     * Increment play count
     */
    async incrementPlayCount(id: string): Promise<void> {
        await this.databaseService.episode.update({
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
        await this.databaseService.episode.update({
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
        await this.databaseService.episode.update({
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
        await this.databaseService.episode.update({
            where: { id },
            data: {
                shareCount: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Make episode public
     */
    async makePublic(id: string, userId: string): Promise<EpisodeResponseDto> {
        const episode = await this.databaseService.episode.findUnique({
            where: { id },
        });

        if (!episode) {
            throw new NotFoundException('Episode not found');
        }

        if (episode.userId !== userId) {
            throw new ForbiddenException('You can only make your own episodes public');
        }

        if (episode.generationStatus !== 'COMPLETED') {
            throw new BadRequestException(
                'Only completed episodes can be made public',
            );
        }

        const updated = await this.databaseService.episode.update({
            where: { id },
            data: { isPublic: true },
        });

        return updated as EpisodeResponseDto;
    }

    /**
     * Retry failed episode generation
     */
    async retryGeneration(id: string, userId: string): Promise<EpisodeResponseDto> {
        const episode = await this.databaseService.episode.findUnique({
            where: { id },
        });

        if (!episode) {
            throw new NotFoundException('Episode not found');
        }

        if (episode.userId !== userId) {
            throw new ForbiddenException('You can only retry your own episodes');
        }

        if (episode.generationStatus !== 'FAILED') {
            throw new BadRequestException('Only failed episodes can be retried');
        }

        // Reset status and clear error
        await this.databaseService.episode.update({
            where: { id },
            data: {
                generationStatus: 'PENDING',
                generationError: null,
            },
        });

        // Re-queue for generation
        await this.rabbitMQService.publishEpisodeGenerationJob({
            episodeId: episode.id,
            userId: episode.userId,
            podcasterId: episode.podcasterId,
            bookId: episode.bookId,
            title: episode.title,
            contentCoverage: episode.contentCoverage as any,
            chapters: episode.chapters,
            episodeType: episode.episodeType as any,
            episodeTheme: episode.episodeTheme as any,
            targetLengthMin: episode.targetLengthMin,
            targetLengthMax: episode.targetLengthMax,
        });

        this.logger.log(`Retrying episode generation for ${episode.id}`);

        return episode as EpisodeResponseDto;
    }

    /**
     * Stream audio file with range request support
     */
    async streamAudio(
        id: string,
        userId: string | undefined,
        range: string | undefined,
        res: Response,
    ): Promise<StreamableFile> {
        const episode = await this.findOne(id, userId);

        if (!episode.audioFileKey) {
            throw new NotFoundException('Audio file not found for this episode');
        }

        // Check if file exists
        const exists = await this.storageService.fileExists(episode.audioFileKey);
        if (!exists) {
            throw new NotFoundException('Audio file not found in storage');
        }

        // Download the audio file
        const audioBuffer = await this.storageService.downloadFile(
            episode.audioFileKey,
        );
        const fileSize = audioBuffer.length;

        // Determine content type based on format
        const contentType =
            episode.audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg';

        // Handle range requests for seeking
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            res.status(206);
            res.set({
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
            });

            return new StreamableFile(audioBuffer.subarray(start, end + 1));
        }

        // Full file response
        res.set({
            'Accept-Ranges': 'bytes',
            'Content-Length': fileSize,
            'Content-Type': contentType,
        });

        return new StreamableFile(audioBuffer);
    }

    /**
     * Save playback progress to Redis
     */
    async savePlaybackProgress(
        userId: string,
        episodeId: string,
        positionMs: number,
    ): Promise<void> {
        // Verify episode exists and user has access
        await this.findOne(episodeId, userId);
        await this.redisService.setPlaybackProgress(userId, episodeId, positionMs);
    }

    /**
     * Get playback progress from Redis
     */
    async getPlaybackProgress(
        userId: string,
        episodeId: string,
    ): Promise<{ position: number } | null> {
        const position = await this.redisService.getPlaybackProgress(
            userId,
            episodeId,
        );
        return position !== null ? { position } : null;
    }

    /**
     * Get episode generation progress from Redis
     */
    async getGenerationProgress(
        episodeId: string,
    ): Promise<{ progress: number; status: string; updatedAt: string } | null> {
        return this.redisService.getJobProgress(episodeId);
    }
}
