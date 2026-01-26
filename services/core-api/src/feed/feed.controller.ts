import {
    Controller,
    Get,
    Query,
    Param,
    UseGuards,
    Request,
    Logger,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedQueryDto, FeedSectionQueryDto } from './dto/feed-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('feed')
export class FeedController {
    private readonly logger = new Logger(FeedController.name);

    constructor(private readonly feedService: FeedService) {}

    /**
     * Get feed for a specific tab
     * GET /feed?tab=episodes|books|podcasters
     *
     * Returns sections with items for the home feed.
     * - Episodes tab: Continue Listening, Popular, Latest, Recommended
     * - Books tab: Popular Inspirations, Popular Books, Latest Books, Bestsellers
     * - Podcasters tab: Trending, Top Rated, New Voices
     */
    @Get()
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async getFeed(@Request() req, @Query() query: FeedQueryDto) {
        const userId = req.user.userId;
        this.logger.log(`GET /feed called with tab: ${query.tab}, userId: ${userId}`);

        try {
            const feed = await this.feedService.getFeed(query.tab, userId);
            this.logger.log(`Feed returned with ${feed.sections.length} sections`);
            return feed;
        } catch (error) {
            this.logger.error(`Error in getFeed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get paginated section data for "See All" functionality
     * GET /feed/section/:sectionId?page=1&limit=20
     *
     * Valid section IDs:
     * - Episodes: continue_listening, popular, latest, recommended
     * - Books: popular_inspirations, popular_books, latest_books, bestsellers
     * - Podcasters: trending, top_rated, new_voices
     */
    @Get('section/:sectionId')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async getSectionData(
        @Request() req,
        @Param('sectionId') sectionId: string,
        @Query() query: FeedSectionQueryDto,
    ) {
        const userId = req.user.userId;
        const page = query.page || 1;
        const limit = query.limit || 20;

        this.logger.log(
            `GET /feed/section/${sectionId} called with page: ${page}, limit: ${limit}, userId: ${userId}`,
        );

        try {
            const data = await this.feedService.getSectionData(sectionId, userId, page, limit);
            this.logger.log(`Section data returned with ${data.items.length} items`);
            return data;
        } catch (error) {
            this.logger.error(`Error in getSectionData: ${error.message}`);
            throw error;
        }
    }
}
