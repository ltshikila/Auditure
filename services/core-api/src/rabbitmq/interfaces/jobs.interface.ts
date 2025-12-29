export interface BookExtractionJob {
    bookId: string;
    userId: string;
    fileStorageKey: string;
    sourceType: 'PDF' | 'EPUB';
}
