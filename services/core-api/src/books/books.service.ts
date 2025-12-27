import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../common/storage.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { CreateBookDto } from './dto/create-book.dto';
import { GetTextDto } from './dto/get-text.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class BooksService {
  constructor(
    private databaseService: DatabaseService,
    private storageService: StorageService,
    private rabbitMQService: RabbitMQService,
  ) {}

  async uploadBook(
    userId: string,
    file: any,
    createBookDto: CreateBookDto,
  ) {
    // 1. Validate file exists
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // 2. Generate storage key
    const bookId = randomUUID();
    const fileExtension = file.mimetype === 'application/pdf' ? 'pdf' : 'epub';
    const storageKey = `${userId}/${bookId}/original.${fileExtension}`;

    // 3. Upload file to storage
    await this.storageService.uploadFile(
      file.buffer,
      storageKey,
      file.mimetype
    );

    // 4. Create book record
    const book = await this.databaseService.book.create({
      data: {
        id: bookId,
        userId,
        title: createBookDto.title,
        author: createBookDto.author,
        isbn: createBookDto.isbn,
        language: createBookDto.language || 'en',
        sourceType: createBookDto.sourceType,
        originalFileName: file.originalname,
        fileStorageKey: storageKey,
        fileSize: file.size,
        fileMimeType: file.mimetype,
        extractionStatus: 'PENDING',
      },
    });

    // 5. Queue extraction job
    await this.rabbitMQService.publishBookExtractionJob({
      bookId: book.id,
      userId,
      fileStorageKey: storageKey,
      sourceType: createBookDto.sourceType as 'PDF' | 'EPUB',
    });

    return book;
  }

  async findAll(userId: string) {
    return this.databaseService.book.findMany({
      where: { userId },
      include: { chapters: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const book = await this.databaseService.book.findUnique({
      where: { id },
      include: { chapters: true },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return book;
  }

  async getExtractedText(userId: string, bookId: string, options?: GetTextDto): Promise<string> {
    const book = await this.findOne(userId, bookId);

    if (book.extractionStatus !== 'COMPLETED') {
      throw new BadRequestException('Book extraction is not completed yet');
    }

    // If specific chapters requested
    if (options?.chapterIds && options.chapterIds.length > 0) {
      const chapters = await this.databaseService.chapter.findMany({
        where: {
          id: { in: options.chapterIds },
          bookId,
        },
        orderBy: { chapterNumber: 'asc' },
      });

      return chapters.map(ch => ch.extractedText).join('\n\n');
    }

    // Return full text
    if (book.fullTextKey) {
      const textBuffer = await this.storageService.downloadFile(book.fullTextKey);
      return textBuffer.toString('utf-8');
    }

    // Fallback: concatenate all chapters
    const chapters = await this.databaseService.chapter.findMany({
      where: { bookId },
      orderBy: { chapterNumber: 'asc' },
    });

    return chapters.map(ch => ch.extractedText).join('\n\n');
  }

  // PUBLIC API for Episodes Service to consume
  async getBookForEpisode(bookId: string) {
    return this.databaseService.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: true,
        user: { select: { id: true, firstName: true, lastName: true } }
      },
    });
  }

  // PUBLIC API for Feed Service to search/filter books
  async searchBooks(query: string, limit: number = 20) {
    return this.databaseService.book.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { author: { contains: query, mode: 'insensitive' } },
        ],
        extractionStatus: 'COMPLETED',
      },
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getPopularBooks(limit: number = 10) {
    // Returns books that can be used by Feed service to find popular episodes
    return this.databaseService.book.findMany({
      where: { extractionStatus: 'COMPLETED' },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const book = await this.findOne(userId, id);

    // Delete file from storage
    if (book.fileStorageKey) {
      await this.storageService.deleteFile(book.fileStorageKey);
    }

    // Delete extracted text
    if (book.fullTextKey) {
      await this.storageService.deleteFile(book.fullTextKey);
    }

    // Delete database record (cascade deletes chapters)
    await this.databaseService.book.delete({ where: { id } });
  }

  async retryExtraction(userId: string, id: string) {
    const book = await this.findOne(userId, id);

    if (book.extractionStatus !== 'FAILED') {
      throw new BadRequestException('Can only retry failed extractions');
    }

    // Update status back to pending
    await this.databaseService.book.update({
      where: { id },
      data: {
        extractionStatus: 'PENDING',
        extractionError: null,
      },
    });

    // Re-queue job
    await this.rabbitMQService.publishBookExtractionJob({
      bookId: book.id,
      userId: book.userId,
      fileStorageKey: book.fileStorageKey,
      sourceType: book.sourceType as 'PDF' | 'EPUB',
    });

    return this.findOne(userId, id);
  }
}
