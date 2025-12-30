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
} from '@nestjs/common';
import { PodcastersService } from './podcasters.service';
import { CreatePodcasterDto } from './dto/create-podcaster.dto';
import { UpdatePodcasterDto } from './dto/update-podcaster.dto';
import { QueryPodcastersDto } from './dto/query-podcasters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('podcasters')
export class PodcastersController {
    constructor(private readonly podcastersService: PodcastersService) {}

    /**
     * Create a new podcaster (requires authentication)
     * POST /podcasters
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    create(@Request() req, @Body() createPodcasterDto: CreatePodcasterDto) {
        return this.podcastersService.create(req.user.userId, createPodcasterDto);
    }

    /**
     * Get all public podcasters with filtering and pagination
     * GET /podcasters/public?sortBy=POPULAR&page=1&limit=20&search=philosophy
     */
    @Get('public')
    findPublic(@Query() query: QueryPodcastersDto) {
        return this.podcastersService.findPublic(query);
    }

    /**
     * Get trending podcasters
     * GET /podcasters/trending?limit=10
     */
    @Get('trending')
    findTrending(@Query('limit') limit?: number) {
        return this.podcastersService.findTrending(limit ? Number(limit) : 10);
    }

    /**
     * Get podcasters by expertise/genre
     * GET /podcasters/expertise/:tag?limit=20
     */
    @Get('expertise/:tag')
    findByExpertise(@Param('tag') tag: string, @Query('limit') limit?: number) {
        return this.podcastersService.findByExpertise(
            tag,
            limit ? Number(limit) : 20,
        );
    }

    /**
     * Get current user's podcasters (requires authentication)
     * GET /podcasters/my
     */
    @Get('my')
    @UseGuards(JwtAuthGuard)
    findMy(@Request() req) {
        return this.podcastersService.findAllByUser(req.user.userId);
    }

    /**
     * Get a specific podcaster by ID
     * GET /podcasters/:id
     * Public podcasters are accessible to everyone
     * Private podcasters only accessible to owner
     */
    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        const userId = req.user?.userId;
        return this.podcastersService.findOne(id, userId);
    }

    /**
     * Update a podcaster (requires authentication and ownership)
     * PATCH /podcasters/:id
     */
    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    update(
        @Param('id') id: string,
        @Request() req,
        @Body() updatePodcasterDto: UpdatePodcasterDto,
    ) {
        return this.podcastersService.update(id, req.user.userId, updatePodcasterDto);
    }

    /**
     * Delete a podcaster (requires authentication and ownership)
     * DELETE /podcasters/:id
     */
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string, @Request() req) {
        await this.podcastersService.remove(id, req.user.userId);
    }

    /**
     * Increment play count (public endpoint)
     * POST /podcasters/:id/play
     */
    @Post(':id/play')
    @HttpCode(HttpStatus.NO_CONTENT)
    async incrementPlayCount(@Param('id') id: string) {
        await this.podcastersService.incrementPlayCount(id);
    }

    /**
     * Like a podcaster (requires authentication)
     * POST /podcasters/:id/like
     */
    @Post(':id/like')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async like(@Param('id') id: string) {
        await this.podcastersService.incrementLikeCount(id);
    }

    /**
     * Unlike a podcaster (requires authentication)
     * DELETE /podcasters/:id/like
     */
    @Delete(':id/like')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async unlike(@Param('id') id: string) {
        await this.podcastersService.decrementLikeCount(id);
    }

    /**
     * Share a podcaster (public endpoint)
     * POST /podcasters/:id/share
     */
    @Post(':id/share')
    @HttpCode(HttpStatus.NO_CONTENT)
    async share(@Param('id') id: string) {
        await this.podcastersService.incrementShareCount(id);
    }
}
