export class ChapterResponseDto {
  id: string;
  chapterNumber: number;
  title?: string;
  startPage?: number;
  endPage?: number;
  textLength?: number;
}

export class BookResponseDto {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  language: string;
  pageCount?: number;
  sourceType: string;
  originalFileName?: string;
  fileSize?: number;
  extractionStatus: string;
  extractionError?: string;
  extractedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  chapters?: ChapterResponseDto[];
}
