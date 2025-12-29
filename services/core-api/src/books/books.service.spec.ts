import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../common/storage.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
    createMockBook,
    createCompletedMockBook,
    createMockChapter,
    mockCreateBookDto,
    mockFile,
    mockGetTextDto,
} from '../../test/fixtures/books.fixture';
import { mockPrismaClient } from '../../test/mocks/database.mock';
import { mockStorageService, mockRabbitMQService } from '../../test/mocks/services.mock';

describe('BooksService', () => {
    let service: BooksService;
    let databaseService: DatabaseService;
    let storageService: StorageService;
    let rabbitMQService: RabbitMQService;

    const mockUserId = 'user-123';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BooksService,
                {
                    provide: DatabaseService,
                    useValue: mockPrismaClient,
                },
                {
                    provide: StorageService,
                    useValue: mockStorageService,
                },
                {
                    provide: RabbitMQService,
                    useValue: mockRabbitMQService,
                },
            ],
        }).compile();

        service = module.get<BooksService>(BooksService);
        databaseService = module.get<DatabaseService>(DatabaseService);
        storageService = module.get<StorageService>(StorageService);
        rabbitMQService = module.get<RabbitMQService>(RabbitMQService);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('uploadBook', () => {
        it('should upload a book successfully', async () => {
            const mockBook = createMockBook({ userId: mockUserId });
            mockPrismaClient.book.create.mockResolvedValue(mockBook);

            const result = await service.uploadBook(mockUserId, mockFile, mockCreateBookDto);

            expect(result).toEqual(mockBook);
            expect(storageService.uploadFile).toHaveBeenCalledWith(
                mockFile.buffer,
                expect.stringContaining(mockUserId),
                mockFile.mimetype,
            );
            expect(databaseService.book.create).toHaveBeenCalled();
            expect(rabbitMQService.publishBookExtractionJob).toHaveBeenCalledWith(
                expect.objectContaining({
                    bookId: mockBook.id,
                    userId: mockUserId,
                    sourceType: mockCreateBookDto.sourceType,
                }),
            );
        });

        it('should throw BadRequestException if file is missing', async () => {
            await expect(service.uploadBook(mockUserId, null, mockCreateBookDto)).rejects.toThrow(
                BadRequestException,
            );

            expect(storageService.uploadFile).not.toHaveBeenCalled();
            expect(databaseService.book.create).not.toHaveBeenCalled();
        });

        it('should generate correct storage key format', async () => {
            const mockBook = createMockBook({ userId: mockUserId });
            mockPrismaClient.book.create.mockResolvedValue(mockBook);

            await service.uploadBook(mockUserId, mockFile, mockCreateBookDto);

            expect(storageService.uploadFile).toHaveBeenCalledWith(
                mockFile.buffer,
                expect.stringMatching(new RegExp(`^${mockUserId}/[\\w-]+/original\\.pdf$`)),
                mockFile.mimetype,
            );
        });
    });

    describe('findAll', () => {
        it('should return all books for a user', async () => {
            const mockBooks = [
                createMockBook({ userId: mockUserId }),
                createMockBook({ userId: mockUserId }),
            ];
            mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

            const result = await service.findAll(mockUserId);

            expect(result).toEqual(mockBooks);
            expect(databaseService.book.findMany).toHaveBeenCalledWith({
                where: { userId: mockUserId },
                include: { chapters: true },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should return empty array if no books found', async () => {
            mockPrismaClient.book.findMany.mockResolvedValue([]);

            const result = await service.findAll(mockUserId);

            expect(result).toEqual([]);
        });
    });

    describe('findOne', () => {
        it('should return a book by id for the owner', async () => {
            const mockBook = createMockBook({ userId: mockUserId });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

            const result = await service.findOne(mockUserId, mockBook.id);

            expect(result).toEqual(mockBook);
            expect(databaseService.book.findUnique).toHaveBeenCalledWith({
                where: { id: mockBook.id },
                include: { chapters: true },
            });
        });

        it('should throw NotFoundException if book does not exist', async () => {
            mockPrismaClient.book.findUnique.mockResolvedValue(null);

            await expect(service.findOne(mockUserId, 'non-existent-id')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ForbiddenException if user is not the owner', async () => {
            const mockBook = createMockBook({ userId: 'different-user-id' });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

            await expect(service.findOne(mockUserId, mockBook.id)).rejects.toThrow(
                ForbiddenException,
            );
        });
    });

    describe('getExtractedText', () => {
        it('should return full text from storage', async () => {
            const mockBook = createCompletedMockBook({ userId: mockUserId });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
            mockStorageService.downloadFile.mockResolvedValue(
                Buffer.from('Full book text content'),
            );

            const result = await service.getExtractedText(mockUserId, mockBook.id);

            expect(result).toBe('Full book text content');
            expect(storageService.downloadFile).toHaveBeenCalledWith(mockBook.fullTextKey);
        });

        it('should throw BadRequestException if extraction not completed', async () => {
            const mockBook = createMockBook({ userId: mockUserId, extractionStatus: 'PENDING' });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

            await expect(service.getExtractedText(mockUserId, mockBook.id)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should return specific chapters text when chapterIds provided', async () => {
            const mockChapter1 = createMockChapter({ extractedText: 'Chapter 1 text' });
            const mockChapter2 = createMockChapter({ extractedText: 'Chapter 2 text' });
            const mockBook = createCompletedMockBook({
                userId: mockUserId,
                chapters: [mockChapter1, mockChapter2],
            });

            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
            mockPrismaClient.chapter.findMany.mockResolvedValue([mockChapter1, mockChapter2]);

            const result = await service.getExtractedText(mockUserId, mockBook.id, {
                chapterIds: [mockChapter1.id, mockChapter2.id],
            });

            expect(result).toBe('Chapter 1 text\n\nChapter 2 text');
            expect(databaseService.chapter.findMany).toHaveBeenCalledWith({
                where: {
                    id: { in: [mockChapter1.id, mockChapter2.id] },
                    bookId: mockBook.id,
                },
                orderBy: { chapterNumber: 'asc' },
            });
        });

        it('should concatenate all chapters if no fullTextKey exists', async () => {
            const mockChapter = createMockChapter({ extractedText: 'Chapter text' });
            const mockBook = createCompletedMockBook({
                userId: mockUserId,
                fullTextKey: null,
                chapters: [mockChapter],
            });

            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
            mockPrismaClient.chapter.findMany.mockResolvedValue([mockChapter]);

            const result = await service.getExtractedText(mockUserId, mockBook.id);

            expect(result).toBe('Chapter text');
            expect(databaseService.chapter.findMany).toHaveBeenCalledWith({
                where: { bookId: mockBook.id },
                orderBy: { chapterNumber: 'asc' },
            });
        });
    });

    describe('getBookForEpisode', () => {
        it('should return book with chapters and user info', async () => {
            const mockBook = createCompletedMockBook();
            const bookWithUser = {
                ...mockBook,
                user: { id: 'user-id', firstName: 'John', lastName: 'Doe' },
            };
            mockPrismaClient.book.findUnique.mockResolvedValue(bookWithUser);

            const result = await service.getBookForEpisode(mockBook.id);

            expect(result).toEqual(bookWithUser);
            expect(databaseService.book.findUnique).toHaveBeenCalledWith({
                where: { id: mockBook.id },
                include: {
                    chapters: true,
                    user: { select: { id: true, firstName: true, lastName: true } },
                },
            });
        });
    });

    describe('searchBooks', () => {
        it('should search books by title', async () => {
            const mockBooks = [createCompletedMockBook({ title: 'Harry Potter' })];
            mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

            const result = await service.searchBooks('Harry');

            expect(result).toEqual(mockBooks);
            expect(databaseService.book.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { title: { contains: 'Harry', mode: 'insensitive' } },
                        { author: { contains: 'Harry', mode: 'insensitive' } },
                    ],
                    extractionStatus: 'COMPLETED',
                },
                take: 20,
                include: { user: { select: { id: true, firstName: true, lastName: true } } },
            });
        });

        it('should search books by author', async () => {
            const mockBooks = [createCompletedMockBook({ author: 'J.K. Rowling' })];
            mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

            const result = await service.searchBooks('Rowling');

            expect(result).toEqual(mockBooks);
        });

        it('should only return completed books', async () => {
            mockPrismaClient.book.findMany.mockResolvedValue([]);

            await service.searchBooks('test');

            expect(databaseService.book.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        extractionStatus: 'COMPLETED',
                    }),
                }),
            );
        });
    });

    describe('getPopularBooks', () => {
        it('should return popular books ordered by creation date', async () => {
            const mockBooks = [createCompletedMockBook(), createCompletedMockBook()];
            mockPrismaClient.book.findMany.mockResolvedValue(mockBooks);

            const result = await service.getPopularBooks(10);

            expect(result).toEqual(mockBooks);
            expect(databaseService.book.findMany).toHaveBeenCalledWith({
                where: { extractionStatus: 'COMPLETED' },
                take: 10,
                orderBy: { createdAt: 'desc' },
            });
        });
    });

    describe('delete', () => {
        it('should delete book and associated files', async () => {
            const mockBook = createCompletedMockBook({ userId: mockUserId });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
            mockPrismaClient.book.delete.mockResolvedValue(mockBook);

            await service.delete(mockUserId, mockBook.id);

            expect(storageService.deleteFile).toHaveBeenCalledWith(mockBook.fileStorageKey);
            expect(storageService.deleteFile).toHaveBeenCalledWith(mockBook.fullTextKey);
            expect(databaseService.book.delete).toHaveBeenCalledWith({
                where: { id: mockBook.id },
            });
        });

        it('should throw NotFoundException if book does not exist', async () => {
            mockPrismaClient.book.findUnique.mockResolvedValue(null);

            await expect(service.delete(mockUserId, 'non-existent-id')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ForbiddenException if user is not owner', async () => {
            const mockBook = createMockBook({ userId: 'different-user' });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

            await expect(service.delete(mockUserId, mockBook.id)).rejects.toThrow(
                ForbiddenException,
            );
        });
    });

    describe('retryExtraction', () => {
        it('should retry failed extraction', async () => {
            const mockBook = createMockBook({
                userId: mockUserId,
                extractionStatus: 'FAILED',
                extractionError: 'Some error',
            });
            const updatedBook = { ...mockBook, extractionStatus: 'PENDING', extractionError: null };

            mockPrismaClient.book.findUnique.mockResolvedValueOnce(mockBook);
            mockPrismaClient.book.update.mockResolvedValue(updatedBook);
            mockPrismaClient.book.findUnique.mockResolvedValueOnce(updatedBook);

            const result = await service.retryExtraction(mockUserId, mockBook.id);

            expect(databaseService.book.update).toHaveBeenCalledWith({
                where: { id: mockBook.id },
                data: {
                    extractionStatus: 'PENDING',
                    extractionError: null,
                },
            });
            expect(rabbitMQService.publishBookExtractionJob).toHaveBeenCalled();
            expect(result.extractionStatus).toBe('PENDING');
        });

        it('should throw BadRequestException if extraction not failed', async () => {
            const mockBook = createCompletedMockBook({ userId: mockUserId });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

            await expect(service.retryExtraction(mockUserId, mockBook.id)).rejects.toThrow(
                BadRequestException,
            );

            expect(rabbitMQService.publishBookExtractionJob).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if book does not exist', async () => {
            mockPrismaClient.book.findUnique.mockResolvedValue(null);

            await expect(service.retryExtraction(mockUserId, 'non-existent-id')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ForbiddenException if user is not owner', async () => {
            const mockBook = createMockBook({
                userId: 'different-user',
                extractionStatus: 'FAILED',
            });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

            await expect(service.retryExtraction(mockUserId, mockBook.id)).rejects.toThrow(
                ForbiddenException,
            );
        });
    });

    describe('uploadBook - Error Handling', () => {
        it('should handle storage upload failure gracefully', async () => {
            mockStorageService.uploadFile.mockRejectedValue(
                new Error('Storage service unavailable'),
            );

            await expect(
                service.uploadBook(mockUserId, mockFile, mockCreateBookDto),
            ).rejects.toThrow('Storage service unavailable');

            // Should not create book record if storage upload fails
            expect(databaseService.book.create).not.toHaveBeenCalled();
        });

        it('should handle RabbitMQ publish failure gracefully', async () => {
            const mockBook = createMockBook({ userId: mockUserId });

            // Reset storage mock to success for this test
            mockStorageService.uploadFile.mockResolvedValue('mock-storage-key');
            mockPrismaClient.book.create.mockResolvedValue(mockBook);
            mockRabbitMQService.publishBookExtractionJob.mockRejectedValue(
                new Error('RabbitMQ connection failed'),
            );

            // Should still create the book even if job queueing fails
            await expect(
                service.uploadBook(mockUserId, mockFile, mockCreateBookDto),
            ).rejects.toThrow('RabbitMQ connection failed');

            expect(databaseService.book.create).toHaveBeenCalled();
        });
    });

    describe('getExtractedText - Error Handling', () => {
        it('should throw NotFoundException if book does not exist', async () => {
            mockPrismaClient.book.findUnique.mockResolvedValue(null);

            await expect(service.getExtractedText(mockUserId, 'non-existent-id')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ForbiddenException if user is not owner', async () => {
            const mockBook = createCompletedMockBook({ userId: 'different-user' });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);

            await expect(service.getExtractedText(mockUserId, mockBook.id)).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('should handle storage download failure gracefully', async () => {
            const mockBook = createCompletedMockBook({ userId: mockUserId });
            mockPrismaClient.book.findUnique.mockResolvedValue(mockBook);
            mockStorageService.downloadFile.mockRejectedValue(
                new Error('File not found in storage'),
            );

            await expect(service.getExtractedText(mockUserId, mockBook.id)).rejects.toThrow(
                'File not found in storage',
            );
        });
    });
});
