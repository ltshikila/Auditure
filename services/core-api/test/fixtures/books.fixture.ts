// Test fixtures for book data
import { randomUUID } from 'crypto';

export const createMockBook = (overrides = {}) => ({
  id: randomUUID(),
  userId: randomUUID(),
  title: 'Test Book',
  author: 'Test Author',
  isbn: '978-0-123456-78-9',
  language: 'en',
  pageCount: 200,
  sourceType: 'PDF',
  originalFileName: 'test-book.pdf',
  fileStorageKey: 'user-id/book-id/original.pdf',
  fileSize: 1024000, // 1MB
  fileMimeType: 'application/pdf',
  extractionStatus: 'PENDING',
  extractionError: null,
  extractedAt: null,
  fullTextKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  chapters: [],
  ...overrides,
});

export const createCompletedMockBook = (overrides = {}) =>
  createMockBook({
    extractionStatus: 'COMPLETED',
    extractedAt: new Date(),
    fullTextKey: 'user-id/book-id/fulltext.txt',
    chapters: [createMockChapter()],
    ...overrides,
  });

export const createMockChapter = (overrides = {}) => ({
  id: randomUUID(),
  bookId: randomUUID(),
  chapterNumber: 1,
  title: 'Chapter 1',
  startPage: 1,
  endPage: 10,
  textLength: 5000,
  extractedText: 'This is the extracted text for chapter 1.',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockCreateBookDto = {
  title: 'Test Book',
  author: 'Test Author',
  isbn: '978-0-123456-78-9',
  sourceType: 'PDF' as const,
  language: 'en',
};

export const mockFile = {
  buffer: Buffer.from('mock pdf content'),
  originalname: 'test-book.pdf',
  mimetype: 'application/pdf',
  size: 1024000,
};

export const mockGetTextDto = {
  chapterIds: [],
  startPage: undefined,
  endPage: undefined,
};
