import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
    StreamableFile,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../common/storage.service';
import { BooksService } from '../books/books.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
    CreateEpisodeDto,
    CreateEpisodeWithFileDto,
    ContentCoverage,
} from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { QueryEpisodesDto, EpisodeSortBy } from './dto/query-episodes.dto';
import { EpisodeResponseDto, EpisodeStatus } from './dto/episode-response.dto';
import { CommentResponseDto } from './dto/comment.dto';

@Injectable()
export class EpisodesService {
    private readonly logger = new Logger(EpisodesService.name);

    // Official Gemini TTS tags that should be stripped from user-facing transcripts
    private static readonly TTS_TAGS_PATTERN =
        /\[(sigh|laughing|uhm|short pause|medium pause|long pause|whispering|shouting|sarcasm|extremely fast)\]/gi;

    constructor(
        private databaseService: DatabaseService,
        private rabbitMQService: RabbitMQService,
        private redisService: RedisService,
        private storageService: StorageService,
        @Inject(forwardRef(() => BooksService))
        private booksService: BooksService,
        private usersService: UsersService,
        private notificationsService: NotificationsService,
    ) {}

    /**
     * Clean TTS markup tags from transcript for user display.
     * Removes official Gemini TTS tags like [laughing], [sigh], [short pause], etc.
     * Also removes any other bracketed tags that may have slipped through.
     */
    private cleanTranscriptForDisplay(scriptContent: string | null): string | null {
        if (!scriptContent) return scriptContent;

        let cleaned = scriptContent;

        // Remove official TTS tags
        cleaned = cleaned.replace(EpisodesService.TTS_TAGS_PATTERN, '');

        // Remove any other bracketed tags (catch-all for unofficial tags like [nodding], [thoughtfully])
        // Only remove single-word or two-word tags to avoid removing actual content in brackets
        cleaned = cleaned.replace(/\[([a-zA-Z]+(\s[a-zA-Z]+)?)\]/g, '');

        // Clean up extra whitespace that may result from tag removal
        cleaned = cleaned.replace(/\s{2,}/g, ' ');
        cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');

        return cleaned.trim();
    }

    /**
     * Clean transcripts for an array of episodes
     */
    private cleanEpisodesTranscripts<T extends { scriptContent?: string | null }>(
        episodes: T[],
    ): T[] {
        return episodes.map(episode => ({
            ...episode,
            scriptContent: this.cleanTranscriptForDisplay(episode.scriptContent ?? null),
        }));
    }

    /**
     * Create a new episode and queue it for generation
     */
    async create(userId: string, createEpisodeDto: CreateEpisodeDto): Promise<EpisodeResponseDto> {
        this.logger.log(`create() called for user ${userId}`);
        this.logger.log(`DTO: ${JSON.stringify(createEpisodeDto)}`);

        try {
            // Validate book exists and belongs to user
            this.logger.log(`Looking up book ${createEpisodeDto.bookId}`);
            const book = await this.databaseService.book.findUnique({
                where: { id: createEpisodeDto.bookId },
            });

            if (!book) {
                this.logger.error(`Book ${createEpisodeDto.bookId} not found`);
                throw new NotFoundException('Book not found');
            }

            if (book.userId !== userId) {
                this.logger.error(
                    `Book ${createEpisodeDto.bookId} does not belong to user ${userId}`,
                );
                throw new ForbiddenException('You can only create episodes from your own books');
            }

            // Validate book extraction is completed (or partially completed)
            if (!['COMPLETED', 'PARTIALLY_COMPLETED'].includes(book.extractionStatus)) {
                this.logger.error(
                    `Book ${createEpisodeDto.bookId} extraction not completed: ${book.extractionStatus}`,
                );
                throw new BadRequestException(
                    'Book extraction must be completed before creating an episode',
                );
            }

            // Log warning for partially completed books
            if (book.extractionStatus === 'PARTIALLY_COMPLETED') {
                this.logger.warn(
                    `Creating episode from partially extracted book ${createEpisodeDto.bookId}. ` +
                        'Some chapters may have limited or missing content.',
                );
            }

            // Validate podcaster exists and belongs to user or is public
            this.logger.log(`Looking up podcaster ${createEpisodeDto.podcasterId}`);
            const podcaster = await this.databaseService.podcaster.findUnique({
                where: { id: createEpisodeDto.podcasterId },
            });

            if (!podcaster) {
                this.logger.error(`Podcaster ${createEpisodeDto.podcasterId} not found`);
                throw new NotFoundException('Podcaster not found');
            }

            if (!podcaster.isPublic && podcaster.userId !== userId) {
                this.logger.error(
                    `Podcaster ${createEpisodeDto.podcasterId} access denied for user ${userId}`,
                );
                throw new ForbiddenException('Access denied to private podcaster');
            }

            // Validate chapters if content coverage requires them
            if (
                createEpisodeDto.contentCoverage !== ContentCoverage.ENTIRE_BOOK &&
                createEpisodeDto.chapters.length === 0
            ) {
                this.logger.error('Chapters required but not provided');
                throw new BadRequestException(
                    'Chapters must be specified for chapter-based content coverage',
                );
            }

            // Validate target length range
            if (createEpisodeDto.targetLengthMin > createEpisodeDto.targetLengthMax) {
                this.logger.error(
                    `Invalid target length range: ${createEpisodeDto.targetLengthMin} > ${createEpisodeDto.targetLengthMax}`,
                );
                throw new BadRequestException(
                    'Target length minimum cannot be greater than maximum',
                );
            }

            // Enforce tier-based duration limits (Free=10min, Starter/Pro=30min)
            const subscription = await this.databaseService.subscription.findUnique({
                where: { userId },
                select: { tier: true },
            });
            const tier = (subscription?.tier || 'FREE') as 'FREE' | 'STARTER' | 'PRO';
            const maxDuration = tier === 'FREE' ? 10 : 30;

            if (createEpisodeDto.targetLengthMax > maxDuration) {
                throw new BadRequestException(
                    `Your plan allows episodes up to ${maxDuration} minutes. Upgrade for longer episodes.`,
                );
            }

            // Check subscription quota before creating
            const voiceTier = createEpisodeDto.voiceTier || 'STANDARD';
            const hasQuota = await this.usersService.checkAndConsumeQuota(userId, voiceTier);
            if (!hasQuota) {
                const tierLabel = String(voiceTier) === 'GEMINI' ? 'Gemini' : 'Standard';
                throw new BadRequestException(
                    `You've reached your monthly ${tierLabel} episode limit. Upgrade your plan for more episodes.`,
                );
            }

            // Warn user if usage is getting high
            try {
                const sub = await this.usersService.getSubscription(userId);
                const totalUsed = sub.usage.geminiEpisodes.used + sub.usage.standardEpisodes.used;
                const totalLimit =
                    sub.usage.geminiEpisodes.limit + sub.usage.standardEpisodes.limit;
                const usagePercent = Math.round((totalUsed / totalLimit) * 100);
                if (usagePercent >= 80) {
                    await this.notificationsService.notifySubscriptionWarning(userId, usagePercent);
                }
            } catch (error) {
                this.logger.error(`Failed to send quota warning: ${error.message}`);
            }

            // Create the episode
            this.logger.log('Creating episode in database');
            const episode = await this.databaseService.episode.create({
                data: {
                    userId,
                    ...createEpisodeDto,
                    generationStatus: 'PENDING',
                },
            });
            this.logger.log(`Episode created with ID: ${episode.id}`);

            // Queue the episode for generation
            this.logger.log('Publishing episode generation job to RabbitMQ');
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
                voiceTier: createEpisodeDto.voiceTier || 'STANDARD',
            });

            this.logger.log(`Created episode ${episode.id} and queued for generation`);

            return episode as EpisodeResponseDto;
        } catch (error) {
            this.logger.error(`Error in create(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Create a new episode with file upload
     * This uploads the book, waits for extraction, then creates the episode
     */
    async createWithFile(
        userId: string,
        file: any,
        createEpisodeDto: CreateEpisodeWithFileDto,
    ): Promise<{ episode: EpisodeResponseDto; book: any; message: string }> {
        this.logger.log(`createWithFile() called for user ${userId}`);
        this.logger.log(`File: ${file?.originalname} (${file?.mimetype}, ${file?.size} bytes)`);
        this.logger.log(`DTO: ${JSON.stringify(createEpisodeDto)}`);

        try {
            // Validate file exists
            if (!file) {
                this.logger.error('No file provided');
                throw new BadRequestException('File is required');
            }

            // Validate podcaster exists and belongs to user or is public
            this.logger.log(`Looking up podcaster ${createEpisodeDto.podcasterId}`);
            const podcaster = await this.databaseService.podcaster.findUnique({
                where: { id: createEpisodeDto.podcasterId },
            });

            if (!podcaster) {
                this.logger.error(`Podcaster ${createEpisodeDto.podcasterId} not found`);
                throw new NotFoundException('Podcaster not found');
            }
            this.logger.log(`Found podcaster: ${podcaster.name}`);

            if (!podcaster.isPublic && podcaster.userId !== userId) {
                this.logger.error(
                    `Podcaster ${createEpisodeDto.podcasterId} access denied for user ${userId}`,
                );
                throw new ForbiddenException('Access denied to private podcaster');
            }

            // Validate target length range
            if (createEpisodeDto.targetLengthMin > createEpisodeDto.targetLengthMax) {
                this.logger.error(
                    `Invalid target length range: ${createEpisodeDto.targetLengthMin} > ${createEpisodeDto.targetLengthMax}`,
                );
                throw new BadRequestException(
                    'Target length minimum cannot be greater than maximum',
                );
            }

            // Enforce tier-based duration limits (Free=10min, Starter/Pro=30min)
            const subscription = await this.databaseService.subscription.findUnique({
                where: { userId },
                select: { tier: true },
            });
            const tier = (subscription?.tier || 'FREE') as 'FREE' | 'STARTER' | 'PRO';
            const maxDuration = tier === 'FREE' ? 10 : 30;

            if (createEpisodeDto.targetLengthMax > maxDuration) {
                throw new BadRequestException(
                    `Your plan allows episodes up to ${maxDuration} minutes. Upgrade for longer episodes.`,
                );
            }

            // Check subscription quota before processing
            const voiceTier = createEpisodeDto.voiceTier || 'STANDARD';
            const hasQuota = await this.usersService.checkAndConsumeQuota(userId, voiceTier);
            if (!hasQuota) {
                const tierLabel = String(voiceTier) === 'GEMINI' ? 'Gemini' : 'Standard';
                throw new BadRequestException(
                    `You've reached your monthly ${tierLabel} episode limit. Upgrade your plan for more episodes.`,
                );
            }

            // Warn user if usage is getting high
            try {
                const sub = await this.usersService.getSubscription(userId);
                const totalUsed = sub.usage.geminiEpisodes.used + sub.usage.standardEpisodes.used;
                const totalLimit =
                    sub.usage.geminiEpisodes.limit + sub.usage.standardEpisodes.limit;
                const usagePercent = Math.round((totalUsed / totalLimit) * 100);
                if (usagePercent >= 80) {
                    await this.notificationsService.notifySubscriptionWarning(userId, usagePercent);
                }
            } catch (error) {
                this.logger.error(`Failed to send quota warning: ${error.message}`);
            }

            // Determine source type from file mimetype
            const sourceType = file.mimetype === 'application/pdf' ? 'PDF' : 'EPUB';
            this.logger.log(`Source type: ${sourceType}`);

            // Extract book title from filename (remove extension)
            const bookTitle =
                file.originalname
                    .replace(/\.(pdf|epub)$/i, '')
                    .replace(/[-_]/g, ' ')
                    .trim() || 'Untitled Book';
            this.logger.log(`Book title: ${bookTitle}`);

            // Upload the book using BooksService
            this.logger.log('Uploading book via BooksService...');
            let book;
            try {
                book = await this.booksService.uploadBook(userId, file, {
                    title: bookTitle,
                    sourceType: sourceType as any,
                });
                this.logger.log(`Book uploaded successfully with ID: ${book.id}`);
            } catch (uploadError) {
                this.logger.error(`Failed to upload book: ${uploadError.message}`);
                this.logger.error(`Upload error stack: ${uploadError.stack}`);
                throw new BadRequestException(`Failed to upload book: ${uploadError.message}`);
            }

            // Create the episode with PENDING status
            this.logger.log('Creating episode in database...');
            let episode;
            try {
                episode = await this.databaseService.episode.create({
                    data: {
                        userId,
                        bookId: book.id,
                        podcasterId: createEpisodeDto.podcasterId,
                        title: createEpisodeDto.title,
                        description: createEpisodeDto.description,
                        contentCoverage: createEpisodeDto.contentCoverage,
                        chapters: createEpisodeDto.chapters || [],
                        episodeType: createEpisodeDto.episodeType,
                        episodeTheme: createEpisodeDto.episodeTheme,
                        targetLengthMin: createEpisodeDto.targetLengthMin,
                        targetLengthMax: createEpisodeDto.targetLengthMax,
                        voiceTier: createEpisodeDto.voiceTier || 'STANDARD',
                        generationStatus: 'PENDING',
                    },
                });
                this.logger.log(`Episode created with ID: ${episode.id}`);
            } catch (dbError) {
                this.logger.error(`Failed to create episode in database: ${dbError.message}`);
                this.logger.error(`Database error stack: ${dbError.stack}`);
                throw new BadRequestException(`Failed to create episode: ${dbError.message}`);
            }

            // If book extraction is already complete (unlikely but possible for small files),
            // queue the episode immediately
            if (book.extractionStatus === 'COMPLETED') {
                this.logger.log('Book extraction already complete, queuing episode generation...');
                try {
                    await this.rabbitMQService.publishEpisodeGenerationJob({
                        episodeId: episode.id,
                        userId,
                        podcasterId: createEpisodeDto.podcasterId,
                        bookId: book.id,
                        title: createEpisodeDto.title,
                        contentCoverage: createEpisodeDto.contentCoverage,
                        chapters: createEpisodeDto.chapters || [],
                        episodeType: createEpisodeDto.episodeType,
                        episodeTheme: createEpisodeDto.episodeTheme,
                        targetLengthMin: createEpisodeDto.targetLengthMin,
                        targetLengthMax: createEpisodeDto.targetLengthMax,
                        voiceTier: createEpisodeDto.voiceTier || 'STANDARD',
                    });
                    this.logger.log(`Episode ${episode.id} queued for generation immediately`);
                } catch (mqError) {
                    this.logger.error(`Failed to queue episode generation: ${mqError.message}`);
                    this.logger.error(`RabbitMQ error stack: ${mqError.stack}`);
                    // Don't throw here - the episode is created, it can be retried later
                }

                return {
                    episode: episode as EpisodeResponseDto,
                    book,
                    message: 'Episode created and queued for generation',
                };
            }

            // Book extraction is still processing
            // The episode will be queued after extraction completes
            this.logger.log(
                `Episode ${episode.id} created, waiting for book extraction to complete`,
            );

            return {
                episode: episode as EpisodeResponseDto,
                book,
                message:
                    'Episode created. Book is being processed. Episode generation will start automatically once extraction is complete.',
            };
        } catch (error) {
            this.logger.error(`Error in createWithFile(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
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
                        coverImageUrl: true,
                    },
                },
            },
        });

        return this.cleanEpisodesTranscripts(episodes) as EpisodeResponseDto[];
    }

    /**
     * Find public episodes (for feed/discovery)
     */
    async findPublic(query: QueryEpisodesDto): Promise<{
        episodes: EpisodeResponseDto[];
        total: number;
        page: number;
        totalPages: number;
    }> {
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
                        coverImageUrl: true,
                    },
                },
            },
        });

        // Transform response and clean transcripts
        const transformedEpisodes = episodes.map(e => ({
            ...e,
            scriptContent: this.cleanTranscriptForDisplay(e.scriptContent),
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
                        coverImageUrl: true,
                    },
                },
            },
        });

        return episodes.map(e => ({
            ...e,
            scriptContent: this.cleanTranscriptForDisplay(e.scriptContent),
            creator: e.user,
            user: undefined,
        })) as any as EpisodeResponseDto[];
    }

    /**
     * Find episodes by podcaster
     */
    async findByPodcaster(podcasterId: string, limit: number = 20): Promise<EpisodeResponseDto[]> {
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
                        coverImageUrl: true,
                    },
                },
            },
        });

        return this.cleanEpisodesTranscripts(episodes) as EpisodeResponseDto[];
    }

    /**
     * Find episodes by book
     */
    async findByBook(bookId: string, limit: number = 20): Promise<EpisodeResponseDto[]> {
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

        return this.cleanEpisodesTranscripts(episodes) as EpisodeResponseDto[];
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
                        coverImageUrl: true,
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
            scriptContent: this.cleanTranscriptForDisplay(episode.scriptContent),
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
            throw new BadRequestException('Cannot update episode while generation is in progress');
        }

        // Validate target length range if provided
        const targetLengthMin = updateEpisodeDto.targetLengthMin ?? episode.targetLengthMin;
        const targetLengthMax = updateEpisodeDto.targetLengthMax ?? episode.targetLengthMax;

        if (targetLengthMin > targetLengthMax) {
            throw new BadRequestException('Target length minimum cannot be greater than maximum');
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
     * Like an episode (with proper user tracking)
     */
    async likeEpisode(episodeId: string, userId: string): Promise<void> {
        // Check if already liked
        const existing = await this.databaseService.episodeLike.findUnique({
            where: { episodeId_userId: { episodeId, userId } },
        });
        if (existing) return; // Already liked, no-op

        // Create like + increment count in transaction
        const episode = await this.databaseService.$transaction(async tx => {
            await tx.episodeLike.create({
                data: { episodeId, userId },
            });
            return tx.episode.update({
                where: { id: episodeId },
                data: { likeCount: { increment: 1 } },
                select: { userId: true, title: true },
            });
        });

        // Notify episode owner (don't notify yourself)
        if (episode.userId !== userId) {
            try {
                const liker = await this.databaseService.user.findUnique({
                    where: { id: userId },
                    select: { firstName: true, lastName: true },
                });
                const likerName = liker ? `${liker.firstName} ${liker.lastName}`.trim() : 'Someone';
                await this.notificationsService.notifyNewLike(
                    episode.userId,
                    episodeId,
                    episode.title,
                    likerName,
                );
            } catch (error) {
                this.logger.error(`Failed to send like notification: ${error.message}`);
            }
        }
    }

    /**
     * Unlike an episode
     */
    async unlikeEpisode(episodeId: string, userId: string): Promise<void> {
        // Check if liked
        const existing = await this.databaseService.episodeLike.findUnique({
            where: { episodeId_userId: { episodeId, userId } },
        });
        if (!existing) return; // Not liked, no-op

        // Delete like + decrement count in transaction
        await this.databaseService.$transaction(async tx => {
            await tx.episodeLike.delete({
                where: { episodeId_userId: { episodeId, userId } },
            });
            await tx.episode.update({
                where: { id: episodeId },
                data: { likeCount: { decrement: 1 } },
            });
        });
    }

    /**
     * Get episodes liked by user
     */
    async getLikedEpisodes(userId: string): Promise<EpisodeResponseDto[]> {
        const likes = await this.databaseService.episodeLike.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                episode: {
                    include: {
                        podcaster: { select: { id: true, name: true, profilePictureUrl: true } },
                        book: {
                            select: {
                                id: true,
                                title: true,
                                author: true,
                                coverImageUrl: true,
                                language: true,
                            },
                        },
                    },
                },
            },
        });
        return likes.map(like => like.episode as unknown as EpisodeResponseDto);
    }

    /**
     * Check if user has liked an episode
     */
    async isEpisodeLiked(episodeId: string, userId: string): Promise<boolean> {
        const like = await this.databaseService.episodeLike.findUnique({
            where: { episodeId_userId: { episodeId, userId } },
        });
        return !!like;
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
            throw new BadRequestException('Only completed episodes can be made public');
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
            include: { book: true },
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

        // Reset episode status and clear error
        await this.databaseService.episode.update({
            where: { id },
            data: {
                generationStatus: 'PENDING',
                generationError: null,
            },
        });

        // Check if the book extraction also failed - if so, retry that too
        if (episode.book?.extractionStatus === 'FAILED') {
            this.logger.log(
                `Book ${episode.bookId} extraction also failed, re-triggering extraction`,
            );

            // Reset book status
            await this.databaseService.book.update({
                where: { id: episode.bookId },
                data: {
                    extractionStatus: 'PENDING',
                    extractionError: null,
                },
            });

            // Re-queue book extraction (which will then queue the episode when done)
            await this.rabbitMQService.publishBookExtractionJob({
                bookId: episode.bookId,
                userId: episode.userId,
                fileStorageKey: episode.book.fileStorageKey,
                sourceType: episode.book.sourceType as 'PDF' | 'EPUB',
            });

            this.logger.log(
                `Retrying book extraction for ${episode.bookId}, episode ${episode.id} will be queued after extraction`,
            );
        } else {
            // Book is fine, just re-queue the episode generation
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
                voiceTier: (episode.voiceTier as any) || 'STANDARD',
            });

            this.logger.log(`Retrying episode generation for ${episode.id}`);
        }

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
        const audioBuffer = await this.storageService.downloadFile(episode.audioFileKey);
        const fileSize = audioBuffer.length;

        // Determine content type based on format
        const contentType = episode.audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg';

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
    async getPlaybackProgress(userId: string, episodeId: string): Promise<{ position: number }> {
        const position = await this.redisService.getPlaybackProgress(userId, episodeId);
        // Always return a valid object to prevent empty response issues
        return { position: position ?? 0 };
    }

    /**
     * Get episode generation progress from Redis
     */
    async getGenerationProgress(
        episodeId: string,
    ): Promise<{ progress: number; status: string; updatedAt: string }> {
        const progress = await this.redisService.getJobProgress(episodeId);

        // Return default progress if not found in Redis
        if (!progress) {
            return {
                progress: 0,
                status: 'pending',
                updatedAt: new Date().toISOString(),
            };
        }

        return progress;
    }

    /**
     * Get comments for an episode
     */
    async getComments(episodeId: string): Promise<CommentResponseDto[]> {
        // Verify episode exists
        const episode = await this.databaseService.episode.findUnique({
            where: { id: episodeId },
        });

        if (!episode) {
            throw new NotFoundException('Episode not found');
        }

        const comments = await this.databaseService.episodeComment.findMany({
            where: { episodeId },
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePictureUrl: true,
                    },
                },
            },
        });

        return comments as CommentResponseDto[];
    }

    /**
     * Add a comment to an episode
     */
    async addComment(
        episodeId: string,
        userId: string,
        content: string,
    ): Promise<CommentResponseDto> {
        // Verify episode exists
        const episode = await this.databaseService.episode.findUnique({
            where: { id: episodeId },
        });

        if (!episode) {
            throw new NotFoundException('Episode not found');
        }

        const comment = await this.databaseService.episodeComment.create({
            data: {
                episodeId,
                userId,
                content,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePictureUrl: true,
                    },
                },
            },
        });

        // Notify episode owner (don't notify yourself)
        if (episode.userId !== userId) {
            try {
                const commenterName = `${comment.user.firstName} ${comment.user.lastName}`.trim();
                await this.notificationsService.notifyNewComment(
                    episode.userId,
                    episodeId,
                    episode.title,
                    commenterName,
                );
            } catch (error) {
                this.logger.error(`Failed to send comment notification: ${error.message}`);
            }
        }

        return comment as CommentResponseDto;
    }

    /**
     * Delete a comment
     */
    async deleteComment(commentId: string, userId: string): Promise<void> {
        const comment = await this.databaseService.episodeComment.findUnique({
            where: { id: commentId },
        });

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        if (comment.userId !== userId) {
            throw new ForbiddenException('You can only delete your own comments');
        }

        await this.databaseService.episodeComment.delete({
            where: { id: commentId },
        });
    }

    /**
     * Get author info from Open Library API
     */
    async getAuthorInfo(authorName: string): Promise<{
        name: string;
        bio?: string;
        birthDate?: string;
        deathDate?: string;
        photoUrl?: string;
        wikipedia?: string;
        works?: number;
    } | null> {
        if (!authorName) {
            return null;
        }

        try {
            // Search for author on Open Library
            const searchUrl = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}&limit=1`;
            const searchResponse = await fetch(searchUrl);

            if (!searchResponse.ok) {
                this.logger.warn(
                    `Open Library search failed for "${authorName}": ${searchResponse.status}`,
                );
                return null;
            }

            const searchData = await searchResponse.json();

            if (!searchData.docs || searchData.docs.length === 0) {
                this.logger.warn(`No author found on Open Library for "${authorName}"`);
                return null;
            }

            const authorDoc = searchData.docs[0];
            const authorKey = authorDoc.key;

            // Fetch detailed author info
            const authorUrl = `https://openlibrary.org/authors/${authorKey}.json`;
            const authorResponse = await fetch(authorUrl);

            if (!authorResponse.ok) {
                this.logger.warn(
                    `Open Library author fetch failed for "${authorKey}": ${authorResponse.status}`,
                );
                return {
                    name: authorDoc.name || authorName,
                    works: authorDoc.work_count,
                };
            }

            const authorData = await authorResponse.json();

            // Extract bio - can be a string or an object with 'value' key
            let bio: string | undefined;
            if (authorData.bio) {
                bio = typeof authorData.bio === 'string' ? authorData.bio : authorData.bio.value;
            }

            return {
                name: authorData.name || authorDoc.name || authorName,
                bio,
                birthDate: authorData.birth_date,
                deathDate: authorData.death_date,
                photoUrl: authorDoc.key
                    ? `https://covers.openlibrary.org/a/olid/${authorKey}-M.jpg`
                    : undefined,
                wikipedia: authorData.wikipedia,
                works: authorDoc.work_count,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch author info for "${authorName}": ${error.message}`);
            return null;
        }
    }
}
