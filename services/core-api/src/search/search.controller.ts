import {
    Controller,
    Get,
    Query,
    UseGuards,
    Request,
    Logger,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('search')
export class SearchController {
    private readonly logger = new Logger(SearchController.name);

    constructor(private readonly searchService: SearchService) {}

    /**
     * Search across episodes, books, and podcasters
     * GET /search?q=query&scope=all&page=1&limit=10
     *
     * Public endpoints and user's own content are searched
     * Authentication is optional - authenticated users see their private content too
     */
    @Get()
    @UseGuards(OptionalJwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async search(@Query() query: SearchQueryDto, @Request() req) {
        const userId = req.user?.userId;
        this.logger.log(
            `GET /search - q="${query.q}", scope=${query.scope}, userId=${userId || 'anonymous'}`,
        );

        return this.searchService.search(query, userId);
    }

    /**
     * Get search suggestions for autocomplete
     * GET /search/suggestions?q=partial&limit=5
     *
     * Returns quick suggestions based on partial query
     */
    @Get('suggestions')
    @UseGuards(OptionalJwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async getSuggestions(
        @Query('q') q: string,
        @Query('limit') limit?: string,
        @Request() req?,
    ) {
        const userId = req?.user?.userId;
        const parsedLimit = limit ? Math.min(parseInt(limit, 10), 10) : 5;

        this.logger.log(
            `GET /search/suggestions - q="${q}", limit=${parsedLimit}, userId=${userId || 'anonymous'}`,
        );

        return this.searchService.getSuggestions(q, userId, parsedLimit);
    }
}
