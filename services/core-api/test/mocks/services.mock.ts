// Mock services for testing

export const mockEmailService = {
  sendOTP: jest.fn().mockResolvedValue(undefined),
};

export const mockStorageService = {
  uploadFile: jest.fn().mockResolvedValue('mock-storage-key'),
  downloadFile: jest.fn().mockResolvedValue(Buffer.from('mock file content')),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  fileExists: jest.fn().mockResolvedValue(true),
};

export const mockRabbitMQService = {
  publishBookExtractionJob: jest.fn().mockResolvedValue(undefined),
  consumeBookExtractionQueue: jest.fn().mockResolvedValue(undefined),
};

export const mockTextExtractionService = {
  extractFromPdf: jest.fn().mockResolvedValue({
    fullText: 'Mock extracted PDF text',
    chapters: [
      { chapterNumber: 1, title: 'Chapter 1', text: 'Chapter 1 content' },
    ],
    metadata: { title: 'Test Book', author: 'Test Author', pageCount: 100 },
  }),
  extractFromEpub: jest.fn().mockResolvedValue({
    fullText: 'Mock extracted EPUB text',
    chapters: [
      { chapterNumber: 1, title: 'Chapter 1', text: 'Chapter 1 content' },
    ],
    metadata: { title: 'Test Book', author: 'Test Author' },
  }),
};
