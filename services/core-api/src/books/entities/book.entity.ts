export class Book {
    id: string;
    userId: string;
    title: string;
    author?: string;
    isbn?: string;
    language: string;
    pageCount?: number;
    sourceType: 'PDF' | 'EPUB' | 'URL';
    originalFileName?: string;
    fileStorageKey: string;
    fileSize?: number;
    fileMimeType?: string;
    extractionStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIALLY_COMPLETED';
    extractionError?: string;
    extractedAt?: Date;
    fullTextKey?: string;
    createdAt: Date;
    updatedAt: Date;
}
