import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { GetTextDto } from './dto/get-text.dto';

const bookFileFilter = (req, file, callback) => {
    const allowedMimes = ['application/pdf', 'application/epub+zip'];
    if (!allowedMimes.includes(file.mimetype)) {
        return callback(new BadRequestException('Only PDF and EPUB files are allowed'), false);
    }
    callback(null, true);
};

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BooksController {
    constructor(private readonly booksService: BooksService) {}

    @Post('upload')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
            fileFilter: bookFileFilter,
        }),
    )
    async uploadBook(
        @Request() req,
        @UploadedFile() file: any,
        @Body() createBookDto: CreateBookDto,
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        return this.booksService.uploadBook(req.user.userId, file, createBookDto);
    }

    @Get()
    async findAll(@Request() req) {
        return this.booksService.findAll(req.user.userId);
    }

    @Get(':id/detail')
    async getBookDetail(@Request() req, @Param('id') id: string, @Query('limit') limit?: string) {
        return this.booksService.getBookDetail(id, limit ? Number(limit) : 6, req.user.userId);
    }

    @Get(':id')
    async findOne(@Request() req, @Param('id') id: string) {
        return this.booksService.findOne(req.user.userId, id);
    }

    @Get(':id/text')
    async getExtractedText(@Request() req, @Param('id') id: string, @Query() options: GetTextDto) {
        const text = await this.booksService.getExtractedText(req.user.userId, id, options);
        return { text };
    }

    @Get(':id/chapters')
    async getChapters(@Request() req, @Param('id') id: string) {
        const book = await this.booksService.findOne(req.user.userId, id);
        return book.chapters;
    }

    @Post(':id/validate-chapters')
    async validateChapters(
        @Request() req,
        @Param('id') id: string,
        @Body() body: { chapters: number[] },
    ) {
        // First verify user owns the book
        await this.booksService.findOne(req.user.userId, id);
        return this.booksService.validateChapterNumbers(id, body.chapters);
    }

    @Delete(':id')
    async remove(@Request() req, @Param('id') id: string) {
        await this.booksService.delete(req.user.userId, id);
        return { message: 'Book deleted successfully' };
    }

    @Post(':id/retry-extraction')
    async retryExtraction(@Request() req, @Param('id') id: string) {
        return this.booksService.retryExtraction(req.user.userId, id);
    }

    @Post(':id/force-reextract')
    async forceReExtract(@Request() req, @Param('id') id: string) {
        return this.booksService.forceReExtract(req.user.userId, id);
    }
}
