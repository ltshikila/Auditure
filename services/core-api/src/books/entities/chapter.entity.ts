export class Chapter {
    id: string;
    bookId: string;
    chapterNumber: number;
    title?: string;
    startPage?: number;
    endPage?: number;
    textLength?: number;
    extractedText?: string;
    createdAt: Date;
    updatedAt: Date;
}
