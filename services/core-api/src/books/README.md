# Books Service

Complete book management system with file upload, text extraction, and async processing using RabbitMQ.

## Features

- PDF and EPUB file upload (up to 32MB, magic-byte verified)
- Async text extraction with RabbitMQ
- Automatic chapter detection
- Cover image extraction (Google Books API + PDF/EPUB fallback)
- Local file storage with S3-ready abstraction
- Full-text search capabilities
- Extraction retry mechanism
- Public API for Episodes and Feed services

---

## Understanding the Architecture

### Why Async Processing?

PDF extraction can take 5-60 seconds depending on file size. If we processed synchronously:

```
SYNCHRONOUS (Bad)                      ASYNCHRONOUS (Good)
─────────────────                      ──────────────────
User uploads 50MB PDF                  User uploads 50MB PDF
     │                                      │
     ▼                                      ▼
Server starts extracting...            Server saves file, queues job
     │ (30 seconds)                         │ (100ms)
     ▼                                      ▼
Browser shows spinner...               Server returns { status: "PENDING" }
     │ (maybe timeout!)                     │
     ▼                                      ▼
Server finishes                        User can browse app
Returns response                       Worker processes in background
                                            │
                                            ▼
                                       Notification: "Book ready!"
```

**Problems with synchronous:**
1. HTTP timeout (browsers/proxies timeout at 30-60s)
2. Server thread blocked (can't serve other users)
3. User stuck on loading screen
4. If connection drops, work is lost

**Benefits of async:**
1. Fast response (user isn't waiting)
2. Scalable (add more workers for more throughput)
3. Resilient (retry failed jobs automatically)
4. User experience (they can do other things)

### Storage Abstraction (Strategy Pattern)

The `StorageService` is an **interface** with multiple implementations. This is the Strategy Pattern in action:

```typescript
// Interface (the contract)
interface StorageBackend {
  upload(key: string, data: Buffer): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

// Implementation 1: Local filesystem (development)
class LocalStorageBackend implements StorageBackend {
  async upload(key, data) {
    await fs.writeFile(`./storage/${key}`, data);
  }
}

// Implementation 2: AWS S3 (production)
class S3StorageBackend implements StorageBackend {
  async upload(key, data) {
    await s3.putObject({ Bucket: 'auditure', Key: key, Body: data });
  }
}
```

**Why this pattern?**
1. **Develop without cloud credentials** - Use LocalStorageBackend
2. **Swap providers easily** - Change one config value, not business logic
3. **Test without real storage** - Use MockStorageBackend in tests
4. **Single responsibility** - BooksService doesn't know/care where files go

**Configuration:**
```env
STORAGE_BACKEND=local  # Development
STORAGE_BACKEND=s3     # Production
```

### Chapter Detection: Why Three Tiers?

Books are messy. There's no standard format. Our three-tier approach handles real-world diversity:

```
Tier 1: TOC-Based (Best)
├── Book has PDF outline/bookmarks
├── Get exact page numbers from outline
├── Most accurate chapter boundaries
└── Works for ~60% of professional PDFs

Tier 2: Dynamic Pattern Detection (Smart)
├── No TOC, but consistent naming
├── Detect patterns like "RULE 1", "LAW 1", "CHAPTER 1"
├── Group by prefix, verify sequence
└── Works for ~25% of books

Tier 3: Regex Fallback (Last Resort)
├── No TOC, no consistent pattern
├── Search for "Chapter X" patterns in text
├── Less accurate, may miss custom names
└── Works for remaining ~15%
```

**Why not just use regex?**
- "Chapter 1" in the Table of Contents would create a false chapter
- Page numbers in TOC entries ("Chapter 1 ..... 42") confuse regex
- Books using "Part", "Section", "Rule" need custom patterns

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
  "coverImageUrl": "https://books.google.com/books/content?id=xxx&printsec=frontcover&img=1&zoom=4",
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
  "coverImageUrl": "https://books.google.com/books/content?id=xxx&printsec=frontcover&img=1&zoom=4",
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

**Cover Image Sources:**
- `coverImageUrl` may be an external URL (Google Books) or a local storage path (`/api/storage/{userId}/{bookId}/cover.jpg`)
- See [Cover Image Extraction](#cover-image-extraction) for details

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

## Book Deduplication & Quality-Based Canonical Selection

When multiple users upload the same book, the system ensures a single canonical version is used across all episodes and feeds.

### How It Works

```
User A uploads "A Game of Thrones" (messy PDF, 3 chapters, no cover)
     │
     ▼
Step 1: Upload-time matching
     │  Search for existing COMPLETED books with fuzzy title match
     │  If match found → return existing book (skip upload + extraction)
     │  If no match → proceed with upload + extraction
     │
     ▼
Step 2: Post-extraction consolidation
     │  After extraction completes and metadata is enriched (title/author from PDF + Google Books)
     │  Search again for matching books with enriched metadata
     │  Compare quality scores across all copies
     │  Move episodes to the highest-quality canonical version
     │
     ▼
Step 3: Feed-level deduplication (safety net)
     │  When building feed sections, group duplicate books by fuzzy match
     │  Display only the best representative per group
     │  Aggregate episode counts and play counts across copies
```

### Quality Scoring

Each book copy gets a quality score (0–76 max) to determine which version is canonical:

| Signal | Points | Rationale |
|--------|--------|-----------|
| Extraction: COMPLETED | +10 | Full extraction preferred over partial |
| Extraction: PARTIALLY_COMPLETED | +3 | Better than nothing |
| Cover image | +10 | Indicates good Google Books match |
| Author metadata | +5 | Better enrichment |
| ISBN | +3 | Reliable identifier |
| Page count | +3 | More metadata |
| Genre tags | up to +5 | Google Books categories |
| Chapter count | up to +30 | More chapters = better TOC detection |
| Avg chapter length | up to +10 | Longer chapters = cleaner extraction |

**Key behavior:** A newer upload with better chapters/metadata **upgrades** the canonical — episodes from the old version are reassigned to the higher-quality copy.

### Fuzzy Matching

Matching uses shared utilities in `utils/book-matching.utils.ts`:

- **Title matching:** Exact, containment (handles subtitles), main-title before colon/dash
- **Author matching:** Normalized comparison, containment (handles middle names/initials), null authors treated as wildcards
- **Combined:** Both title AND author must match

### Safe Deletion

When a user deletes their book:
1. Check if other users' episodes reference it (from consolidation)
2. If yes, find an alternative copy and reassign those episodes
3. If no alternative exists, log a warning (cascade delete will remove episodes)

### Key Files

| File | Purpose |
|------|---------|
| `utils/book-matching.utils.ts` | Shared normalization, fuzzy matching, quality scoring |
| `books.service.ts` | Upload-time matching (`findExistingBook`), book detail aggregation |
| `workers/book-extraction.worker.ts` | Post-extraction consolidation (`consolidateWithCanonical`) |
| `../../feed/feed.service.ts` | Feed-level deduplication (`deduplicateBooks`) |

---

## Architecture

### Services

#### BooksService
Core business logic:
- `uploadBook()` - Handle file upload, check for existing duplicates, and queue extraction job
- `findExistingBook()` - Search for existing COMPLETED books matching a title/author
- `findAll()` - Get all books for a user
- `findOne()` - Get single book with authorization
- `getBookDetail()` - Get book with aggregated episodes across all duplicate copies
- `getExtractedText()` - Retrieve full text or specific chapters
- `delete()` - Remove book with safe episode reassignment for other users
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
- `applyChapterPatternDetection()` - Dynamically detect chapter naming conventions (RULE, LAW, etc.)
- `extractFromScannedPdf()` - OCR extraction for scanned PDFs
- `detectChaptersInText()` - Regex-based chapter detection (fallback)
- `extractEnhancedMetadata()` - Extract comprehensive metadata (title, author, subject, keywords, dates)
- `extractPageLabels()` - Extract page labels (Roman numerals, custom prefixes)
- `isChapterContent()` - Intelligent front/back matter filtering
- Three-tier approach: TOC-based (primary) + dynamic pattern detection + regex (fallback)
- Coordinate-based same-page chapter splitting for precise boundaries

#### CoverExtractionService
Handles cover image extraction with fallback strategy:
- `extractCover()` - Main entry point for cover extraction
- `fetchGoogleBooksCover()` - Query Google Books API for high-quality covers
- `scoreGoogleBooksResult()` - Score candidates by title match, author, page count (replaces first-match-wins)
- `isDerivativeWork()` - Filter out summaries, workbooks, study guides, cliff notes, etc.
- `extractPdfCover()` - Extract embedded images or render first page
- `extractEpubCover()` - Extract cover from EPUB metadata (partial)
- Title validation to prevent incorrect cover matches
- High-resolution image upgrade (zoom=4)

#### StorageService
Abstraction layer for file storage:
- `uploadFile()` - Store file in configured backend
- `downloadFile()` - Retrieve file from storage
- `deleteFile()` - Remove file from storage
- `fileExists()` - Check if file exists

**Backends:**
- `LocalStorageBackend` - Filesystem storage (current)
- `S3StorageBackend` - AWS S3 (future)

#### BookExtractionDispatcher
Triggers the book-extractor Cloud Run Job for extraction work:
- `dispatch(bookId)` - Kicks off a new Job execution with `BOOK_ID` env override
- Uses the `@google-cloud/run` SDK
- Retries are handled by Cloud Run Jobs itself (configured via `--max-retries`)

Why a Job (not RabbitMQ + always-on worker): book extraction is bursty and idle most of the day.
Running it inside a scale-to-zero Service caused Cloud Run to kill the container mid-extraction
for large books. Each Job execution is independent and gets its own 24h budget.

### Workers

#### BookExtractionWorker
The `extractBook(bookId, context)` method runs the actual extraction pipeline. It's invoked
by `src/book-extractor-main.ts` inside the Cloud Run Job execution container:
1. Download file from storage
2. Extract text based on file type
3. Clean metadata titles (strip download site tags like `(PDFDrive.com)`, `[BooksLD]`, file extensions)
4. Clean metadata authors (reject publishers, software names, websites, placeholders)
5. Detect chapters automatically
6. Store extracted text and chapters
7. Update book status
8. Post-extraction consolidation: compare quality with existing copies and establish canonical version
9. Publish episode_generation jobs for any pending episodes tied to this book

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
  coverImageUrl     String?      // External URL (Google Books) or local storage path
  coverImageKey     String?      // Storage key for locally extracted covers
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
- Uses `pdfjs-dist` for TOC extraction, page labels, and OCR
- Extracts all text content with automatic chapter detection
- **Enhanced metadata extraction:**
  - Title, author, subject, keywords
  - Creation and modification dates
  - Page count and language
- **Page label support:**
  - Roman numerals (i, ii, iii, iv...)
  - Custom prefixes (A-1, A-2, B-1...)
  - Mixed numbering schemes
- Automatic fallback to OCR for scanned PDFs (< 100 chars/page)

#### EPUB Files
- Uses `epub-parser` library
- Parses HTML content
- Extracts from all spine items
- Metadata from OPF file

### Chapter Detection

Three-tier chapter detection system for maximum accuracy:

#### 1. TOC-Based Detection (Primary - Most Accurate)

Uses the PDF's built-in Table of Contents (outline) structure:

```
PDF Outline → getOutline() → TocEntry[] → Page Numbers + Coordinates → Chapter Split
```

**Process:**
1. Extract PDF outline using `pdfjs-dist.getOutline()`
2. Extract page labels using `pdfjs-dist.getPageLabels()` (Roman numerals, etc.)
3. Parse each entry to get:
   - Destination page number via `getPageIndex()`
   - Y coordinate from destination array (for same-page splitting)
   - Page label (e.g., "iv", "12", "A-3")
4. Filter entries using `isChapterContent()` to exclude front/back matter
5. Extract text page-by-page for accurate splitting
6. Split content at chapter boundaries using coordinates when available

**TocEntry Structure:**
```typescript
interface TocEntry {
  title: string;
  pageNumber: number;      // 0-indexed physical page
  pageLabel?: string;      // Display label (e.g., "i", "ii", "1")
  chapterNumber?: number;
  level: number;           // Nesting depth (0 = top level)
  destType?: string;       // PDF destination type (XYZ, Fit, FitH)
  destY?: number;          // Y coordinate for same-page splitting
  isChapter: boolean;      // True if actual chapter content
}
```

**Front/Back Matter Filtering:**
Automatically identifies and filters non-chapter content:
- **Front matter**: Cover, Title Page, Copyright, Dedication, Acknowledgments, Preface, Foreword, Table of Contents
- **Back matter**: Index, Bibliography, References, Appendix, Glossary, Notes, Afterword, Epilogue

**Handles Edge Cases:**
- **Chapters on same page**: Uses Y coordinates from PDF destinations for precise splitting. Falls back to regex title matching when coordinates aren't available.
- **Page labels**: Correctly handles PDFs with Roman numeral front matter (i, ii, iii) transitioning to Arabic numerals (1, 2, 3)
- **Nested TOC entries**: Processes recursively, tracking depth level
- **Missing page numbers**: Skips entries without valid destinations

**Reference:** [PDF.js API - getOutline](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html#getOutline)

#### 2. Dynamic Pattern Detection (Automatic)

Automatically detects chapter naming conventions from TOC structure without hardcoding patterns. This enables support for books using non-standard chapter names like "RULE 1", "MEDITATION 1", "COMMANDMENT 1", etc.

**Algorithm:**
1. Group all level-0 (top-level) TOC entries by their prefix
2. Extract the prefix and number from each entry (e.g., "RULE 1" → prefix: "RULE", number: 1)
3. Check if entries form a sequential pattern
4. Mark entries as chapters if:
   - At least 3 entries share the same prefix
   - Numbers are roughly sequential (80%+ coverage ratio)

**Example Detection:**
```
TOC Entries:                    Result:
├── RULE 1: Stand up straight   → Chapter 1 (prefix: "RULE")
├── RULE 2: Treat yourself...   → Chapter 2 (prefix: "RULE")
├── RULE 3: Make friends...     → Chapter 3 (prefix: "RULE")
├── ...                         → ...
└── RULE 12: Pet a cat          → Chapter 12 (prefix: "RULE")
```

**Benefits:**
- Works with any naming convention automatically
- No code changes needed for new patterns
- Detects patterns like: LAW, RULE, PRINCIPLE, STEP, MEDITATION, HABIT, SECRET, COMMANDMENT
- Falls back to hardcoded patterns if dynamic detection doesn't find matches

**Coverage Ratio Calculation:**
```
coverageRatio = actualEntries / expectedRange
expectedRange = maxNumber - minNumber + 1

Example: RULE 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12 (missing 4)
actualEntries = 11, expectedRange = 12, coverageRatio = 91.6% ✓
```

#### 3. Regex-Based Detection (Fallback)

When no TOC exists, falls back to pattern matching:

```javascript
// Pattern examples
"Chapter 1: Introduction"
"CHAPTER 1"
"Part I - The Beginning"
"1. First Chapter"
"RULE 1: Stand up straight"
"LAW 1: Never outshine the master"
```

**Filtering Logic:**
- Skips Table of Contents entries (detected by page number patterns like `Chapter 1 ... 42`)
- Skips index references
- Skips mid-sentence references by checking the word after the chapter number — e.g., `"Chapter 2 is your intuitive prediction..."` gets rejected because "is" is a common sentence starter. The filter includes short words like `is`, `in`, `it`, `as`, `at`, `by`, `of`, `on`, `to` since these are the most common mid-sentence starters.
- Skips unreasonably high chapter numbers (> 50)
- Requires minimum 2500 characters per chapter
- **Sanity check**: if only one chapter is detected AND it contains >70% of the total book text, rejects the detection as a false positive. This triggers the "Full Book" fallback with a user-facing warning, rather than silently producing one bogus chapter that swallows the whole book.

**Detection Strategy:**
1. Try TOC-based extraction first (most accurate)
2. Apply dynamic pattern detection to identify chapter naming convention
3. Fall back to regex if no TOC or TOC extraction fails
4. Search for chapter markers in text (numeric first, then written-out like "Chapter One")
5. Split text at chapter boundaries
6. Filter out TOC/index entries and mid-sentence references
7. Apply single-chapter-dominance sanity check
8. Store individual chapter text, or fall through to "Full Book" fallback

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

## Cover Image Extraction

The `CoverExtractionService` automatically extracts or fetches cover images during book processing.

### Extraction Strategy

Cover images are obtained using a priority-based fallback strategy:

```
1. Google Books API (highest quality)
   ↓ (if no match found)
2. PDF/EPUB File Extraction
   ↓ (if extraction fails)
3. No cover image
```

### Google Books API (Primary)

Queries the free Google Books API to find high-quality cover images:

**Search Strategy (in order):**
1. **ISBN search** - Most accurate (`isbn:9780743273565`)
2. **Title + Author** - Combined search (`intitle:gatsby+inauthor:fitzgerald`)
3. **Title only** - Fallback for incorrect author metadata

**Result Selection (Scoring System):**

Instead of picking the first matching result, all candidates are scored and the highest-scoring one is selected:

| Signal | Points | Rationale |
|--------|--------|-----------|
| Exact title match | +50 | Strongly preferred |
| Close containment match (< 1.5x length) | +30 | Subtitle differences |
| Weak containment match (> 1.5x length) | +10 | Likely derivative |
| Author match | +20 | Confirms correct book |
| Page count >= 200 | +15 | Full-length book |
| Page count 100-199 | +10 | Moderate length |
| Page count < 100 | -10 | Likely summary/pamphlet |
| Derivative work detected | reject | Filtered out entirely |

**Derivative Work Filtering:**

Titles containing these keywords (beyond the expected title) are automatically rejected:
`summary`, `analysis`, `workbook`, `study guide`, `companion`, `cliff notes`, `sparknotes`, `book review`, `quick read`, `key takeaways`

This prevents matching a 73-page "The Laws of Human Nature: Summary and Illustration" when the user uploaded the actual 550-page book.

**Metadata Cleaning:**

Before searching Google Books, PDF/EPUB metadata is cleaned:
- **Titles:** Strip download site tags (`(PDFDrive.com)`, `[BooksLD]`, `(z-lib.org)`), file extensions, "Free PDF" suffixes
- **Authors:** Reject software names (`calibre`, `Adobe`), publisher names (`Penguin`, `HarperCollins`), websites, and placeholders (`unknown`, `N/A`)

**Additional Features:**
- Placeholder image detection via PNG compression ratio analysis
- Automatic HTTPS upgrade
- High-resolution images (zoom=4 parameter)
- Removes page curl effect (`edge=curl`)

**Example Response:**
```typescript
{
  coverImageUrl: "https://books.google.com/books/content?id=xxx&zoom=4",
  coverImageKey: null,  // External URL, not stored locally
  source: "google_books"
}
```

### PDF Cover Extraction (Fallback)

When Google Books doesn't have a cover, extracts from the PDF file:

**Method 1: Embedded Image Extraction**
- Scans first page for image objects
- Extracts the largest embedded image
- Converts to JPEG using canvas

**Method 2: Page Rendering**
- Renders first page at 2x scale
- Converts canvas to JPEG
- Fallback when no embedded images exist

**Example Response:**
```typescript
{
  coverImageUrl: "/api/storage/{userId}/{bookId}/cover.jpg",
  coverImageKey: "{userId}/{bookId}/cover.jpg",
  source: "pdf_extraction"
}
```

### EPUB Cover Extraction

Looks for cover in EPUB metadata:
- Checks `metadata.cover` property
- Searches manifest for `cover-image` ID
- Note: EPUB extraction is partially implemented

### Cover URL Resolution

Cover URLs can be:
- **External**: Google Books URLs (served directly)
- **Local**: Storage paths served via `/api/storage/*`

**Client-side handling:**
```typescript
function resolveCoverUrl(coverImageUrl: string | null): string | null {
  if (!coverImageUrl) return null;

  // External URL - use directly
  if (coverImageUrl.startsWith('http')) {
    return coverImageUrl;
  }

  // Local path - prepend API base URL
  return `${API_BASE_URL}${coverImageUrl}`;
}
```

### Dependencies

- `pdfjs-dist` - PDF parsing and image extraction
- `canvas` - Server-side image rendering
- `epub-parser` - EPUB metadata access (for cover extraction)

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
- Successful file upload and job queuing
- Retrieve all books for user
- Get single book with chapters
- Extract full text and specific chapters
- Delete book and files
- Retry failed extraction

**Negative Tests:**
- Upload without file (400)
- Invalid file type (400)
- File too large (413)
- Access non-existent book (404)
- Access another user's book (403)
- Get text before extraction completes (400)
- Retry non-failed extraction (400)
- Storage service failures
- RabbitMQ connection failures

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

## Upload Security

Users upload arbitrary PDF and EPUB files. Both formats can carry executable
payloads (PDF JavaScript, EPUB scripts/HTML), and document-borne malware is
a real attack class. The defenses below sit at the upload boundary so a
malicious file never reaches the parser uninspected.

### Defenses currently in place

| Layer | Defense | Where |
|---|---|---|
| HTTP upload | 32 MB hard size limit | `books.controller.ts` Multer `limits.fileSize` |
| HTTP upload | MIME allowlist (`application/pdf`, `application/epub+zip`) | `books.controller.ts` `bookFileFilter` |
| Service | **Magic-byte verification** matching the declared MIME | `BooksService.verifyFileMagicBytes` |
| PDF parser | **PDF JavaScript execution disabled** (`isEvalSupported: false`, `enableXfa: false`) on every `pdfjs.getDocument` call | `TextExtractionService` (all 3 call sites) |
| Container | Extractor runs as non-root `appuser` | `Dockerfile` |
| Network | VPC egress restricted to private ranges on the book-extractor Job | `.github/workflows/deploy.yml` |

### Magic-byte verification

The MIME allowlist alone is not sufficient — `file.mimetype` in a multipart
upload is whatever the client claims, so a payload renamed `book.pdf` with
header `Content-Type: application/pdf` passes the filter. After the file
buffer is in memory, `BooksService.verifyFileMagicBytes` checks:

- **PDF**: first 5 bytes must be `%PDF-` (ISO 32000 mandates this).
- **EPUB**: first 4 bytes must be ZIP local-file-header signature (`PK\x03\x04`)
  AND the string `application/epub+zip` must appear in the first 200 bytes
  (the EPUB spec places it at offset 38 in a conforming archive).

A failed check throws `BadRequestException` and the file is never written
to GCS or dispatched for extraction.

### PDF JavaScript neutralization

`pdfjs-dist` will execute embedded PDF JavaScript (`@OpenAction`, form-field
handlers, XFA scripts) at parse time by default. Every `pdfjs.getDocument`
call in `TextExtractionService` passes:

```ts
{
  data: uint8Array,
  isEvalSupported: false,   // refuse JS eval inside the parser
  enableXfa: false,         // refuse XFA forms (which can carry JS)
}
```

This applies to the TOC-based chapter detector, the PDF.js outline reader,
and the OCR rendering path.

### Known gaps (not currently defended)

The following risks are acknowledged but not yet mitigated. Each can become
a hardening ticket if the threat model justifies the cost.

| Gap | Risk | Possible mitigation |
|---|---|---|
| No antivirus/malware scan on upload | A file matching valid PDF/EPUB shape but carrying known malware is still stored in GCS and parsed | ClamAV sidecar, or GCP file scanner API on the bucket |
| EPUB HTML sanitization is regex-based (`stripHtml`) | A crafted EPUB with malformed HTML can survive the strip and reach the extracted-text store | Replace with `sanitize-html` / `DOMPurify` |
| No ZIP-bomb guard on EPUBs | A 32 MB EPUB can decompress to TB; saved by Cloud Run's 2 GB memory limit, but the Job will OOM-crash | Use `yauzl`/`unzipper` with `maxEntries` and uncompressed-size caps before handing to `@gxl/epub-parser` |
| `pdf-parse` 1.x is unconfigured | Library bundles an old `pdfjs-dist`; smaller risk than modern pdfjs but still loads JS-bearing PDFs without explicit disable | Migrate fully to `pdfjs-dist` with the security options above, or pin to a `pdf-parse` fork that exposes config |
| No per-user upload-rate quota | A single user can spam uploads and consume Cloud Run Job slots | Rate limit at the controller (`@Throttle`) |

## Error Handling

| Exception | HTTP Status | When Used |
|-----------|-------------|-----------|
| `BadRequestException` | 400 | Missing file, invalid input, extraction not complete, **failed magic-byte verification** |
| `UnauthorizedException` | 401 | Invalid JWT token |
| `ForbiddenException` | 403 | Accessing another user's book |
| `NotFoundException` | 404 | Book doesn't exist |
| `PayloadTooLargeException` | 413 | File exceeds 32MB |

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
- [x] Dynamic pattern detection for non-standard chapter names (RULE, LAW, MEDITATION, etc.)
- [x] Enhanced metadata extraction (subject, keywords, creation/modification dates)
- [x] Page label support (Roman numerals, custom prefixes)
- [x] Coordinate-based same-page chapter splitting
- [x] Front/back matter filtering (preface, index, bibliography, etc.)
- [x] Cover image extraction (Google Books API + PDF/EPUB fallback)
- [x] Google Books scoring system (filter summaries, prefer originals by page count/author)
- [x] PDF metadata cleaning (download site tags, publisher-as-author rejection)
- [ ] Language detection and translation
- [ ] Summary generation using AI
- [ ] Bookmark and annotation support
- [ ] Reading progress tracking
- [x] Book deduplication with quality-based canonical selection
- [ ] Share books between users
- [ ] Export to different formats
- [ ] Audio book support
- [ ] Cloud storage integration (S3, Google Cloud)
