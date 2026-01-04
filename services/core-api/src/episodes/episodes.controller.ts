import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    Query,
    HttpCode,
    HttpStatus,
    Res,
    Headers,
    StreamableFile,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { EpisodesService } from './episodes.service';
import { CreateEpisodeDto, CreateEpisodeWithFileDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { QueryEpisodesDto } from './dto/query-episodes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

const bookFileFilter = (req, file, callback) => {
    console.log('[Multer] fileFilter called:', file?.originalname, file?.mimetype);
    const allowedMimes = ['application/pdf', 'application/epub+zip'];
    if (!allowedMimes.includes(file.mimetype)) {
        console.log('[Multer] File rejected - invalid mimetype:', file.mimetype);
        return callback(new BadRequestException('Only PDF and EPUB files are allowed'), false);
    }
    console.log('[Multer] File accepted');
    callback(null, true);
};

@Controller('episodes')
export class EpisodesController {
    private readonly logger = new Logger(EpisodesController.name);

    constructor(private readonly episodesService: EpisodesService) {}

    /**
     * Create a new episode (requires authentication)
     * POST /episodes
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    create(@Request() req, @Body() createEpisodeDto: CreateEpisodeDto) {
        return this.episodesService.create(req.user.userId, createEpisodeDto);
    }

    /**
     * Create a new episode with file upload (requires authentication)
     * Uploads a book file (PDF/EPUB), extracts text, and creates an episode
     * POST /episodes/with-file
     */
    @Post('with-file')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
            fileFilter: bookFileFilter,
        }),
    )
    async createWithFile(
        @Request() req,
        @UploadedFile() file: any,
        @Body() createEpisodeDto: CreateEpisodeWithFileDto,
    ) {
        this.logger.log(`createWithFile called by user: ${req.user.userId}`);
        this.logger.log(`File received: ${file ? `${file.originalname} (${file.mimetype}, ${file.size} bytes)` : 'NO FILE'}`);
        this.logger.log(`DTO: ${JSON.stringify(createEpisodeDto)}`);

        if (!file) {
            this.logger.error('No file provided in request');
            throw new BadRequestException('File is required');
        }

        try {
            const result = await this.episodesService.createWithFile(req.user.userId, file, createEpisodeDto);
            this.logger.log(`Episode created successfully: ${result.episode.id}`);
            return result;
        } catch (error) {
            this.logger.error(`Error creating episode with file: ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Get all public episodes with filtering and pagination
     * GET /episodes/public?sortBy=popular&page=1&limit=20&search=philosophy
     */
    @Get('public')
    findPublic(@Query() query: QueryEpisodesDto) {
        return this.episodesService.findPublic(query);
    }

    /**
     * Get trending episodes
     * GET /episodes/trending?limit=10
     */
    @Get('trending')
    findTrending(@Query('limit') limit?: number) {
        return this.episodesService.findTrending(limit ? Number(limit) : 10);
    }

    /**
     * Get episodes by podcaster
     * GET /episodes/podcaster/:podcasterId?limit=20
     */
    @Get('podcaster/:podcasterId')
    findByPodcaster(
        @Param('podcasterId') podcasterId: string,
        @Query('limit') limit?: number,
    ) {
        return this.episodesService.findByPodcaster(
            podcasterId,
            limit ? Number(limit) : 20,
        );
    }

    /**
     * Get episodes by book
     * GET /episodes/book/:bookId?limit=20
     */
    @Get('book/:bookId')
    findByBook(@Param('bookId') bookId: string, @Query('limit') limit?: number) {
        return this.episodesService.findByBook(bookId, limit ? Number(limit) : 20);
    }

    /**
     * Get current user's episodes (requires authentication)
     * GET /episodes/my
     */
    @Get('my')
    @UseGuards(JwtAuthGuard)
    findMy(@Request() req) {
        return this.episodesService.findAllByUser(req.user.userId);
    }

    /**
     * Get a specific episode by ID
     * GET /episodes/:id
     * Public episodes are accessible to everyone
     * Private episodes only accessible to owner
     */
    @Get(':id')
    @UseGuards(OptionalJwtAuthGuard)
    findOne(@Param('id') id: string, @Request() req) {
        const userId = req.user?.userId;
        return this.episodesService.findOne(id, userId);
    }

    /**
     * Update an episode (requires authentication and ownership)
     * PATCH /episodes/:id
     */
    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    update(
        @Param('id') id: string,
        @Request() req,
        @Body() updateEpisodeDto: UpdateEpisodeDto,
    ) {
        return this.episodesService.update(id, req.user.userId, updateEpisodeDto);
    }

    /**
     * Delete an episode (requires authentication and ownership)
     * DELETE /episodes/:id
     */
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string, @Request() req) {
        await this.episodesService.remove(id, req.user.userId);
    }

    /**
     * Increment play count (public endpoint)
     * POST /episodes/:id/play
     */
    @Post(':id/play')
    @HttpCode(HttpStatus.NO_CONTENT)
    async incrementPlayCount(@Param('id') id: string) {
        await this.episodesService.incrementPlayCount(id);
    }

    /**
     * Like an episode (requires authentication)
     * POST /episodes/:id/like
     */
    @Post(':id/like')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async like(@Param('id') id: string) {
        await this.episodesService.incrementLikeCount(id);
    }

    /**
     * Unlike an episode (requires authentication)
     * DELETE /episodes/:id/like
     */
    @Delete(':id/like')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async unlike(@Param('id') id: string) {
        await this.episodesService.decrementLikeCount(id);
    }

    /**
     * Share an episode (public endpoint)
     * POST /episodes/:id/share
     */
    @Post(':id/share')
    @HttpCode(HttpStatus.NO_CONTENT)
    async share(@Param('id') id: string) {
        await this.episodesService.incrementShareCount(id);
    }

    /**
     * Make episode public (requires authentication and ownership)
     * POST /episodes/:id/publish
     */
    @Post(':id/publish')
    @UseGuards(JwtAuthGuard)
    async publish(@Param('id') id: string, @Request() req) {
        return this.episodesService.makePublic(id, req.user.userId);
    }

    /**
     * Retry failed episode generation (requires authentication and ownership)
     * POST /episodes/:id/retry
     */
    @Post(':id/retry')
    @UseGuards(JwtAuthGuard)
    async retry(@Param('id') id: string, @Request() req) {
        return this.episodesService.retryGeneration(id, req.user.userId);
    }

    /**
     * Stream episode audio with range request support
     * GET /episodes/:id/stream
     */
    @Get(':id/stream')
    @UseGuards(OptionalJwtAuthGuard)
    async streamAudio(
        @Param('id') id: string,
        @Request() req,
        @Res({ passthrough: true }) res: Response,
        @Headers('range') range?: string,
    ): Promise<StreamableFile> {
        return this.episodesService.streamAudio(
            id,
            req.user?.userId,
            range,
            res,
        );
    }

    /**
     * Save playback progress (requires authentication)
     * POST /episodes/:id/progress
     */
    @Post(':id/progress')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async saveProgress(
        @Param('id') id: string,
        @Request() req,
        @Body() body: { position: number },
    ) {
        await this.episodesService.savePlaybackProgress(
            req.user.userId,
            id,
            body.position,
        );
    }

    /**
     * Get playback progress (requires authentication)
     * GET /episodes/:id/progress
     */
    @Get(':id/progress')
    @UseGuards(JwtAuthGuard)
    async getProgress(@Param('id') id: string, @Request() req) {
        return this.episodesService.getPlaybackProgress(req.user.userId, id);
    }

    /**
     * Get episode generation progress from Redis
     * GET /episodes/:id/generation-progress
     */
    @Get(':id/generation-progress')
    @UseGuards(OptionalJwtAuthGuard)
    async getGenerationProgress(@Param('id') id: string) {
        return this.episodesService.getGenerationProgress(id);
    }
}
