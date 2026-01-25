# Search Service

A comprehensive search system for the Auditure mobile app, providing unified search across episodes, books, and virtual podcasters with fuzzy matching and autocomplete suggestions.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SearchController                           │
│  - GET /search?q=query&scope=all                               │
│  - GET /search/suggestions?q=partial                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SearchService                             │
│  - Unified search across all categories                        │
│  - Scoped search with pagination                               │
│  - Autocomplete suggestions                                     │
│  - Query sanitization                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL                               │
│  - Episodes (title, description, podcaster name, book title)   │
│  - Books (title, author)                                       │
│  - Podcasters (name, description, expertise tags)              │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Unified search**: Search across episodes, books, and podcasters in a single request
- **Scoped search**: Filter results by category with pagination
- **Case-insensitive matching**: Uses PostgreSQL `mode: 'insensitive'`
- **Autocomplete suggestions**: Quick suggestions for search-as-you-type
- **Access control**: Respects public/private visibility and user ownership
- **Query sanitization**: Prevents XSS and injection attacks

## Search Scopes

| Scope | Description | Authenticated Required |
|-------|-------------|------------------------|
| `all` | Search all categories, return grouped results | No (public content only) |
| `episodes` | Search episodes only with pagination | No (public + user's own if authenticated) |
| `books` | Search user's books only | Yes |
| `podcasters` | Search podcasters with pagination | No (public + user's own if authenticated) |

## API Endpoints

### Search All Categories
```http
GET /search?q=philosophy&scope=all&limit=10
Authorization: Bearer <token> (optional)
```

**Query Parameters:**
- `q` (required) - Search query (min 1 character)
- `scope` (default: all) - Search scope: `all`, `episodes`, `books`, `podcasters`
- `page` (default: 1) - Page number for scoped searches
- `limit` (default: 10, max: 50) - Results per category/page

**Response (scope=all):**
```json
{
  "query": "philosophy",
  "episodes": {
    "results": [
      {
        "id": "uuid",
        "title": "Philosophy of Mind",
        "description": "...",
        "duration": 1800,
        "isPublic": true,
        "playCount": 150,
        "createdAt": "2025-01-15T10:30:00Z",
        "podcaster": {
          "id": "uuid",
          "name": "Sophia",
          "profilePictureUrl": "https://..."
        },
        "book": {
          "id": "uuid",
          "title": "Being and Time",
          "author": "Martin Heidegger",
          "coverImageUrl": "https://..."
        }
      }
    ],
    "total": 25,
    "hasMore": true
  },
  "books": {
    "results": [...],
    "total": 5,
    "hasMore": false
  },
  "podcasters": {
    "results": [...],
    "total": 8,
    "hasMore": false
  }
}
```

### Search with Pagination (Scoped)
```http
GET /search?q=philosophy&scope=episodes&page=2&limit=20
Authorization: Bearer <token> (optional)
```

**Response (scoped):**
```json
{
  "query": "philosophy",
  "scope": "episodes",
  "results": [...],
  "total": 45,
  "page": 2,
  "totalPages": 3,
  "hasMore": true
}
```

### Get Search Suggestions
```http
GET /search/suggestions?q=phil&limit=5
Authorization: Bearer <token> (optional)
```

**Response:**
```json
{
  "episodes": [
    { "id": "uuid", "title": "Philosophy Podcast" }
  ],
  "books": [
    { "id": "uuid", "title": "Philosophy 101" }
  ],
  "podcasters": [
    { "id": "uuid", "name": "Phil the Philosopher" }
  ]
}
```

## Search Fields

### Episodes
- `title` - Episode title
- `description` - Episode description
- `podcaster.name` - Associated podcaster name
- `book.title` - Associated book title

### Books
- `title` - Book title
- `author` - Book author

### Podcasters
- `name` - Podcaster name
- `description` - Podcaster description
- `expertiseTags` - Expertise areas (exact match)

## Access Control

### Episodes
- Public episodes are searchable by everyone
- Private episodes are only visible to their owner
- Only completed episodes (`generationStatus: 'COMPLETED'`) are included

### Books
- Books are private by default
- Only the owner can search their own books
- Unauthenticated users receive empty results for books
- Only extracted books (`extractionStatus: 'COMPLETED'`) are included

### Podcasters
- Public podcasters are searchable by everyone
- Private podcasters are only visible to their owner

## Mobile App Integration

### Search Service (Frontend)

```typescript
import { searchService } from '@/services/search.service';

// Search all categories
const results = await searchService.searchAll('philosophy', token);
console.log(results.episodes.results);
console.log(results.books.results);
console.log(results.podcasters.results);

// Search specific category with pagination
const episodes = await searchService.searchEpisodes('philosophy', 2, 20, token);
console.log(episodes.results);
console.log(episodes.page, '/', episodes.totalPages);

// Get autocomplete suggestions
const suggestions = await searchService.getSuggestions('phil', 5, token);
console.log(suggestions.episodes);
```

### Search Screen Features

The mobile search screen includes:
- **Search-as-you-type**: Debounced (300ms) search requests
- **Recent searches**: Stored in AsyncStorage (max 10)
- **Category tabs**: Filter by All, Episodes, Books, Podcasters
- **Section headers**: Grouped results with "See all" links
- **Empty states**: No results found, initial state
- **Loading states**: Activity indicator during search

### Recent Searches

```typescript
// Stored in AsyncStorage under key 'recent_searches'
const recentSearches = ['philosophy', 'self-help', 'business'];

// Automatically saved on successful search
// Can be cleared individually or all at once
```

## Error Handling

| Error | Status | Description |
|-------|--------|-------------|
| Empty query | 400 | Search query cannot be empty |
| Invalid scope | 400 | Invalid search scope provided |

## Query Sanitization

The service sanitizes all search queries:
- Trims whitespace
- Limits to 100 characters
- Removes potentially dangerous characters: `< > { } [ ] \`

## Performance Considerations

### Current Implementation (PostgreSQL with pg_trgm)
- Uses `ILIKE` (case-insensitive LIKE) via Prisma
- pg_trgm extension enabled for fuzzy text matching
- GIN indexes on searchable text fields for efficient ILIKE queries
- Performs well for datasets up to ~500K-1M records

### Database Indexes

The following indexes are created by migration `20260124000000_add_search_indexes`:

**B-tree Indexes (exact/prefix matching):**
| Table | Index | Fields |
|-------|-------|--------|
| books | books_title_idx | title |
| books | books_author_idx | author |
| books | books_userId_extractionStatus_idx | userId, extractionStatus |
| episodes | episodes_title_idx | title |
| episodes | episodes_isPublic_generationStatus_playCount_idx | isPublic, generationStatus, playCount |
| episodes | episodes_userId_generationStatus_idx | userId, generationStatus |
| podcasters | podcasters_name_idx | name |
| podcasters | podcasters_isPublic_playCount_idx | isPublic, playCount |

**GIN Trigram Indexes (fuzzy search via pg_trgm):**
| Table | Index | Field |
|-------|-------|-------|
| episodes | episodes_title_trgm_idx | title |
| episodes | episodes_description_trgm_idx | description |
| books | books_title_trgm_idx | title |
| books | books_author_trgm_idx | author |
| podcasters | podcasters_name_trgm_idx | name |
| podcasters | podcasters_description_trgm_idx | description |

### Applying the Migration

```bash
# Run the migration
npx prisma migrate deploy

# Or in development
npx prisma migrate dev
```

### Scaling Options
When dataset exceeds 1M+ records, consider:
1. **Full-text search**: PostgreSQL built-in FTS with tsvector
2. **Elasticsearch**: For larger datasets with advanced features

## Testing

### Run Tests

```bash
# Unit tests
npm run test -- --testPathPattern=search

# Coverage
npm run test:cov -- --testPathPattern=search
```

### Test Coverage

- `SearchService`: Unified search, scoped search, suggestions, error handling
- `SearchController`: All REST endpoints, authentication handling

### Test Fixtures

Located in `test/fixtures/search.fixture.ts`:

```typescript
createMockEpisodeSearchResult(overrides)
createMockBookSearchResult(overrides)
createMockPodcasterSearchResult(overrides)
createMockEpisodeList(count)
createMockBookList(count)
createMockPodcasterList(count)
createMockPrismaEpisode(overrides)
createMockPrismaBook(overrides)
createMockPrismaPodcaster(overrides)
```

## Module Structure

```
src/search/
├── search.module.ts           # NestJS module definition
├── search.controller.ts       # REST API endpoints
├── search.service.ts          # Business logic
├── dto/
│   ├── index.ts
│   ├── search-query.dto.ts    # Request validation
│   └── search-response.dto.ts # Response types
├── search.service.spec.ts     # Service unit tests
├── search.controller.spec.ts  # Controller unit tests
└── README.md
```

## Configuration

No additional environment variables required. Uses the same PostgreSQL database as the rest of the application.

## Logging

The service logs comprehensively:

```
[SearchService] search() called: q="philosophy", scope=all, page=1, limit=10, userId=abc123
[SearchService] searchAll() called: query="philosophy", limit=10
[SearchService] searchEpisodes() called: query="philosophy", page=1, limit=10
[SearchService] searchEpisodes() found 15 episodes
[SearchService] searchBooks() called: query="philosophy", page=1, limit=10
[SearchService] searchBooks() found 3 books
[SearchService] searchPodcasters() called: query="philosophy", page=1, limit=10
[SearchService] searchPodcasters() found 5 podcasters
[SearchService] searchAll() results: episodes=15, books=3, podcasters=5
```
