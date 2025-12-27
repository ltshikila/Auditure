import React, { createContext, useContext, useState, useEffect } from 'react';
import { bookService, Book } from '../services/book.service';
import { useAuth } from './AuthContext';
import { StorageService } from '../services/storage.service';

interface BooksContextType {
  books: Book[];
  loading: boolean;
  error: string | null;
  uploadBook: (file: any, metadata: any) => Promise<void>;
  refreshBooks: () => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  retryExtraction: (id: string) => Promise<void>;
}

const BooksContext = createContext<BooksContextType | undefined>(undefined);

export const BooksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const refreshBooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await StorageService.getAccessToken();
      if (token) {
        const fetchedBooks = await bookService.getBooks(token);
        setBooks(fetchedBooks);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch books');
    } finally {
      setLoading(false);
    }
  };

  const uploadBook = async (file: any, metadata: any) => {
    try {
      setLoading(true);
      setError(null);
      const token = await StorageService.getAccessToken();
      if (!token) throw new Error('Not authenticated');

      await bookService.uploadBook(file, metadata, token);
      await refreshBooks();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (id: string) => {
    try {
      setLoading(true);
      const token = await StorageService.getAccessToken();
      if (!token) throw new Error('Not authenticated');

      await bookService.deleteBook(id, token);
      setBooks(books.filter(b => b.id !== id));
    } catch (err: any) {
      setError(err.message || 'Delete failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const retryExtraction = async (id: string) => {
    try {
      setLoading(true);
      const token = await StorageService.getAccessToken();
      if (!token) throw new Error('Not authenticated');

      await bookService.retryExtraction(id, token);
      await refreshBooks();
    } catch (err: any) {
      setError(err.message || 'Retry failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshBooks();
    }
  }, [isAuthenticated]);

  return (
    <BooksContext.Provider
      value={{
        books,
        loading,
        error,
        uploadBook,
        refreshBooks,
        deleteBook,
        retryExtraction,
      }}
    >
      {children}
    </BooksContext.Provider>
  );
};

export const useBooks = () => {
  const context = useContext(BooksContext);
  if (!context) {
    throw new Error('useBooks must be used within BooksProvider');
  }
  return context;
};
