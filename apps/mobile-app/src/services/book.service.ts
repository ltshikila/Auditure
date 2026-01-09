import { apiClient } from './api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface Book {
  id: string;
  title: string;
  author?: string;
  sourceType: 'PDF' | 'EPUB';
  extractionStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
  pageCount?: number;
  originalFileName?: string;
  createdAt: string;
  updatedAt: string;
  chapters?: Chapter[];
}

export interface Chapter {
  id: string;
  chapterNumber: number;
  title?: string;
  startPage?: number;
  endPage?: number;
  textLength?: number;
}

export interface ChapterValidationResult {
  valid: boolean;
  invalidChapters: number[];
  availableChapters: number[];
}

class BookService {
  async uploadBook(
    file: { uri: string; name: string; type: string },
    metadata: { title: string; author?: string; sourceType: 'PDF' | 'EPUB' },
    token: string
  ): Promise<Book> {
    const formData = new FormData();

    // @ts-ignore - React Native FormData handles this differently
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    });

    formData.append('title', metadata.title);
    formData.append('sourceType', metadata.sourceType);
    if (metadata.author) formData.append('author', metadata.author);

    const response = await fetch(`${API_BASE_URL}/books/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  }

  async getBooks(token: string): Promise<Book[]> {
    return apiClient.get<Book[]>('/books', token);
  }

  async getBook(id: string, token: string): Promise<Book> {
    return apiClient.get<Book>(`/books/${id}`, token);
  }

  async getChapters(bookId: string, token: string): Promise<Chapter[]> {
    return apiClient.get<Chapter[]>(`/books/${bookId}/chapters`, token);
  }

  async deleteBook(id: string, token: string): Promise<void> {
    return apiClient.delete(`/books/${id}`, token);
  }

  async retryExtraction(id: string, token: string): Promise<Book> {
    return apiClient.post<Book>(`/books/${id}/retry-extraction`, {}, token);
  }

  async validateChapters(
    bookId: string,
    chapters: number[],
    token: string
  ): Promise<ChapterValidationResult> {
    return apiClient.post<ChapterValidationResult>(
      `/books/${bookId}/validate-chapters`,
      { chapters },
      token
    );
  }
}

export const bookService = new BookService();
