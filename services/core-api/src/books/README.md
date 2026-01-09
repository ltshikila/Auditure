# Books Service

Complete book management system with file upload, text extraction, and async processing using RabbitMQ.

## Features

- ✅ PDF and EPUB file upload (up to 50MB)
- ✅ Async text extraction with RabbitMQ
- ✅ Automatic chapter detection
- ✅ Local file storage with S3-ready abstraction
- ✅ Full-text search capabilities
- ✅ Extraction retry mechanism
- ✅ Public API for Episodes and Feed services

## API Endpoints

### Book Management

All endpoints require JWT authentication:
```http
Authorization: Bearer <access_token>
```

#### Upload a Book
```http
POST /books/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: [PDF or EPUB file]
title: "The Great Gatsby"
sourceType: "PDF"
author: "F. Scott Fitzgerald" (optional)
```

**Response (201):**
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "sourceType": "PDF",
  "fileStorageKey": "books/user-uuid/filename.pdf",
  "extractionStatus": "PENDING",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

**Validation:**
- File is required (400)
- Only PDF and EPUB files allowed (400)
- Maximum file size: 50MB (413)
- Valid sourceType enum: PDF, EPUB, URL (400)

**Extraction Status Flow:**
1. `PENDING` - Book uploaded, awaiting processing
2. `PROCESSING` - Text extraction in progress
3. `COMPLETED` - Extraction successful
4. `FAILED` - Extraction failed (can retry)
5. `PARTIALLY_COMPLETED` - Some chapters extracted

---

#### Get All Books
```http
GET /books
Authorization: Bearer <access_token>
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "sourceType": "PDF",
    "extractionStatus": "COMPLETED",
    "chapters": [
      {
        "id": "chapter-uuid",
        "chapterNumber": 1,
        "title": "Chapter 1"
      }
    ],
    "createdAt": "2025-01-15T10:00:00Z"
  }
]
```

---

#### Get Single Book
```http
GET /books/:id
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "uuid",
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "sourceType": "PDF",
  "extractionStatus": "COMPLETED",
  "fullTextKey": "books/user-uuid/fulltext.txt",
  "chapters": [
    {
      "id": "chapter-uuid",
      "bookId": "uuid",
      "chapterNumber": 1,
      "title": "Chapter 1",
      "extractedText": "In my younger and more vulnerable years..."
    }
  ],
  "createdAt": "2025-01-15T10:00:00Z"
}
```

**Error Responses:**
- `404 Not Found` - Book doesn't exist
- `403 Forbidden` - Not the book owner

---

#### Get Extracted Text
```http
GET /books/:id/text?chapterIds[]=uuid1&chapterIds[]=uuid2
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `chapterIds[]` (optional) - Array of chapter IDs to retrieve
- `startPage` (optional) - Start page number (min: 1)
- `endPage` (optional) - End page number (min: 1)

**Response (200):**
```json
{
  "text": "Full extracted text or selected chapters text..."
}
```

**Error Responses:**
- `400 Bad Request` - Extraction not completed
- `404 Not Found` - Book doesn't exist
- `403 Forbidden` - Not the book owner

---

#### Get Book Chapters
```http
GET /books/:id/chapters
Authorization: Bearer <access_token>
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "chapterNumber": 1,
    "title": "Chapter 1",
    "startPage": 1,
    "endPage": 15,
    "textLength": 5420
  },
  {
    "id": "uuid",
    "chapterNumber": 2,
    "title": "Chapter 2",
    "startPage": 16,
    "endPage": 32,
    "textLength": 6100
  }
]
```

---

#### Validate Chapters
```http
POST /books/:id/validate-chapters
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "chapters": [1, 2, 3]
}
```

**Response (200):**
```json
{
  "valid": true,
  "invalidChapters": [],
  "availableChapters": [1, 2, 3, 4, 5]
}
```

**Response with invalid chapters (200):**
```json
{
  "valid": false,
  "invalidChapters": [99, 100],
  "availableChapters": [1, 2, 3, 4, 5]
}
```

Use this endpoint before creating an episode to verify that the requested chapter numbers exist in the book.

**Error Responses:**
- `404 Not Found` - Book doesn't exist
- `403 Forbidden` - Not the book owner

---

#### Delete Book
```http
DELETE /books/:id
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Book deleted successfully"
}
```

Deletes the book record and all associated files from storage.

**Error Responses:**
- `404 Not Found` - Book doesn't exist
- `403 Forbidden` - Not the book owner

---

#### Retry Failed Extraction
```http
POST /books/:id/retry-extraction
Authorization: Bearer <access_token>
```

**Response (201):**
```json
{
  "id": "uuid",
  "extractionStatus": "PENDING",
  "extractionError": null,
  "updatedAt": "2025-01-15T11:00:00Z"
}
```

Only works for books with `FAILED` extraction status.

**Error Responses:**
- `400 Bad Request` - Extraction hasn't failed
- `404 Not Found` - Book doesn't exist
- `403 Forbidden` - Not the book owner

---

### Public APIs (For Microservices)

These endpoints are used by other services (Episodes, Feed) and may have different authentication.

#### Get Book for Episode Generation
```http
GET /books/api/book/:id
```

Returns book with full chapter data and user information for episode generation.

**Response (200):**
```json
{
  "id": "uuid",
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "chapters": [...],
  "user": {
    "id": "user-uuid",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

#### Search Books
```http
GET /books/api/search?q=gatsby&limit=20
```

**Query Parameters:**
- `q` (required) - Search query
- `limit` (optional) - Max results (default: 20)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "user": {
      "id": "user-uuid",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
]
```

Only returns books with `COMPLETED` extraction status.

---

#### Get Popular Books
```http
GET /books/api/popular?limit=10
```

**Query Parameters:**
- `limit` (optional) - Max results (default: 10)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "createdAt": "2025-01-15T10:00:00Z"
  }
]
```

Returns most recently added books with `COMPLETED` status.

## Architecture

### Services

#### BooksService
Core business logic:
- `uploadBook()` - Handle file upload and queue extraction job
- `findAll()` - Get all books for a user
- `findOne()` - Get single book with authorization
- `getExtractedText()` - Retrieve full text or specific chapters
- `delete()` - Remove book and associated files
- `retryExtraction()` - Retry failed text extraction
- **Public APIs:**
  - `getBookForEpisode()` - For Episodes service
  - `searchBooks()` - For Feed service
  - `getPopularBooks()` - For Feed service

#### TextExtractionService
Handles text extraction from files:
- `extractFromPdf()` - Extract text from PDF files (with OCR fallback)
- `extractFromEpub()` - Extract text from EPUB files
- `extractChaptersFromToc()` - Extract chapters using PDF outline/TOC with page numbers
- `extractFromScannedPdf()` - OCR extraction for scanned PDFs
- `detectChaptersInText()` - Regex-based chapter detection (fallback)
- Hybrid approach: TOC-based (primary) + regex (fallback) for maximum accuracy

#### StorageService
Abstraction layer for file storage:
- `uploadFile()` - Store file in configured backend
- `downloadFile()` - Retrieve file from storage
- `deleteFile()` - Remove file from storage
- `fileExists()` - Check if file exists

**Backends:**
- `LocalStorageBackend` - Filesystem storage (current)
- `S3StorageBackend` - AWS S3 (future)

#### RabbitMQService
Message queue integration:
- `publishBookExtractionJob()` - Queue extraction task
- `consumeBookExtractionQueue()` - Process extraction jobs
- Retry logic with exponential backoff
- Dead letter queue (DLQ) after 3 attempts

### Workers

#### BookExtractionWorker
Background worker that processes extraction jobs:
1. Download file from storage
2. Extract text based on file type
3. Detect chapters automatically
4. Store extracted text and chapters
5. Update book status

### DTOs

| DTO | Purpose | Validation |
|-----|---------|------------|
| `CreateBookDto` | Book upload | Title required, valid sourceType enum, optional author |
| `GetTextDto` | Text retrieval | Optional array of chapter IDs, page range validation |

### Database Schema

```prisma
model Book {
  id                String       @id @default(uuid())
  userId            String
  title             String
  author            String?
  sourceType        SourceType   // PDF, EPUB, URL
  fileStorageKey    String
  extractionStatus  ExtractionStatus @default(PENDING)
  extractionError   String?
  fullTextKey       String?
  chapters          Chapter[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model Chapter {
  id              String @id @default(uuid())
  bookId          String
  chapterNumber   Int
  title           String?
  extractedText   String? @db.Text
  book            Book @relation(...)
}
```

## Text Extraction

### Supported Formats

#### PDF Files
- Uses `pdf-parse` for text extraction
- Uses `pdfjs-dist` for TOC extraction and OCR
- Extracts all text content with automatic chapter detection
- Metadata extraction (title, author, page count)
- Automatic fallback to OCR for scanned PDFs (< 100 chars/page)

#### EPUB Files
- Uses `epub-parser` library
- Parses HTML content
- Extracts from all spine items
- Metadata from OPF file

### Chapter Detection

Two-tier chapter detection system for maximum accuracy:

#### 1. TOC-Based Detection (Primary - Most Accurate)

Uses the PDF's built-in Table of Contents (outline) structure:

```
PDF Outline → getOutline() → TocEntry[] → Page Numbers → Chapter Split
```

**Process:**
1. Extract PDF outline using `pdfjs-dist.getOutline()`
2. Parse each entry to get destination page number via `getPageIndex()`
3. Extract text page-by-page for accurate splitting
4. Split content at chapter boundaries based on page ranges

**Handles Edge Cases:**
- **Chapters on same page**: When chapter 1 ends and chapter 2 starts on the same page, uses regex to find the exact heading position within the shared page text
- **Nested TOC entries**: Flattens sub-chapters to main chapter level
- **Missing page numbers**: Skips entries without valid destinations

**Reference:** [PDF.js API - getOutline](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html#getOutline)

#### 2. Regex-Based Detection (Fallback)

When no TOC exists, falls back to pattern matching:

```javascript
// Pattern examples
"Chapter 1: Introduction"
"CHAPTER 1"
"Part I - The Beginning"
"1. First Chapter"
```

**Filtering Logic:**
- Skips Table of Contents entries (detected by page number patterns like `Chapter 1 ... 42`)
- Skips index references
- Skips unreasonably high chapter numbers (> 50)
- Requires minimum 1000 characters per chapter

**Detection Strategy:**
1. Try TOC-based extraction first (most accurate)
2. Fall back to regex if no TOC or TOC extraction fails
3. Search for chapter markers in text
4. Split text at chapter boundaries
5. Filter out TOC/index entries
6. Store individual chapter text

### OCR for Scanned PDFs

Automatically detects and processes scanned PDFs:

```
Avg chars/page < 100 → OCR Mode → Tesseract.js → Extracted Text
```

**Process:**
1. Detect scanned PDF (< 100 characters per page average)
2. Render each page to image using `pdfjs-dist` canvas API
3. OCR each page using `tesseract.js` (English language)
4. Process pages in batches of 5 to manage memory
5. Concatenate OCR results

**Requirements:**
- `canvas` package for Node.js canvas support
- `tesseract.js` for OCR processing

## Testing

### Test Coverage

- **Unit Tests**: 31 tests covering all service methods
- **Integration Tests**: 14 tests covering all API endpoints
- **Coverage**: 100% statements for BooksService, 93.24% overall

### Running Tests

```bash
# Run all books tests
npm test -- books

# Run with coverage
npm test -- books --coverage

# Watch mode
npm test -- books --watch
```

### Test Cases

**Positive Tests:**
- ✅ Successful file upload and job queuing
- ✅ Retrieve all books for user
- ✅ Get single book with chapters
- ✅ Extract full text and specific chapters
- ✅ Delete book and files
- ✅ Retry failed extraction

**Negative Tests:**
- ✅ Upload without file (400)
- ✅ Invalid file type (400)
- ✅ File too large (413)
- ✅ Access non-existent book (404)
- ✅ Access another user's book (403)
- ✅ Get text before extraction completes (400)
- ✅ Retry non-failed extraction (400)
- ✅ Storage service failures
- ✅ RabbitMQ connection failures

## Configuration

### Environment Variables

```env
# Storage Configuration
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./storage

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672

# File Upload Limits
MAX_FILE_SIZE=52428800  # 50MB in bytes
```

### Future S3 Configuration

```env
STORAGE_BACKEND=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET=auditure-files
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

## Error Handling

| Exception | HTTP Status | When Used |
|-----------|-------------|-----------|
| `BadRequestException` | 400 | Missing file, invalid input, extraction not complete |
| `UnauthorizedException` | 401 | Invalid JWT token |
| `ForbiddenException` | 403 | Accessing another user's book |
| `NotFoundException` | 404 | Book doesn't exist |
| `PayloadTooLargeException` | 413 | File exceeds 50MB |

## Usage Example (Client Side)

```typescript
// Upload a book
const formData = new FormData();
formData.append('file', bookFile);
formData.append('title', 'The Great Gatsby');
formData.append('sourceType', 'PDF');
formData.append('author', 'F. Scott Fitzgerald');

const uploadResponse = await fetch('/books/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});

const book = await uploadResponse.json();

// Poll for extraction completion
const checkStatus = async (bookId) => {
  const response = await fetch(`/books/${bookId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const book = await response.json();

  if (book.extractionStatus === 'COMPLETED') {
    // Get extracted text
    const textResponse = await fetch(`/books/${bookId}/text`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const { text } = await textResponse.json();
    return text;
  } else if (book.extractionStatus === 'FAILED') {
    // Retry extraction
    await fetch(`/books/${bookId}/retry-extraction`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
  }
};
```

## Dependencies

```json
{
  "@nestjs/platform-express": "^11.1.10",
  "multer": "^2.0.2",
  "pdf-parse": "^2.4.5",
  "pdfjs-dist": "^4.x",
  "epub-parser": "^0.2.5",
  "amqplib": "^0.10.9",
  "he": "^1.2.0",
  "tesseract.js": "^5.x",
  "canvas": "^2.x"
}
```

**Note:** `pdfjs-dist` is used for TOC extraction and OCR page rendering. `tesseract.js` provides browser-compatible OCR. `canvas` is required for server-side rendering of PDF pages.

## Performance Considerations

1. **Async Processing**: Heavy text extraction runs in background workers
2. **Storage Optimization**: Files stored with compression when possible
3. **Caching**: Consider adding Redis for frequently accessed books
4. **Pagination**: Implement cursor-based pagination for large book lists
5. **Search Indexing**: Use full-text search engine (Elasticsearch) for better search

## Integration with Other Services

### Episodes Service
```typescript
// Get book data for episode generation
const book = await booksService.getBookForEpisode(bookId);
// Use book.chapters to generate episode scripts
```

### Feed Service
```typescript
// Search books for discovery
const books = await booksService.searchBooks('gatsby', 20);

// Get popular books for homepage
const popular = await booksService.getPopularBooks(10);
```

## Future Enhancements

- [ ] Multiple file upload support
- [x] OCR for scanned PDFs (implemented with tesseract.js)
- [x] TOC-based chapter detection with page numbers
- [ ] Language detection and translation
- [ ] Summary generation using AI
- [ ] Bookmark and annotation support
- [ ] Reading progress tracking
- [ ] Share books between users
- [ ] Export to different formats
- [ ] Audio book support
- [ ] Cloud storage integration (S3, Google Cloud)
