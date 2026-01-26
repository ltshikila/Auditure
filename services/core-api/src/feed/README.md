# Feed Service

The Feed Service provides the home/discovery feed functionality for the Auditure mobile app. It serves content across three tabs: Episodes, Books, and Podcasters, with each tab containing multiple curated sections.

## Table of Contents

- [Overview](#overview)
- [API Endpoints](#api-endpoints)
- [Feed Tabs & Sections](#feed-tabs--sections)
- [Business Rules](#business-rules)
- [Caching Strategy](#caching-strategy)
- [Configuration](#configuration)
- [Testing](#testing)

## Overview

The Feed Service aggregates content from Episodes, Books, and Podcasters to create a personalized discovery experience. It includes:

- **Continue Listening**: User's in-progress episodes
- **Popular Content**: Trending content based on play counts and ratings
- **Latest Releases**: Newly created content
- **Curated Sections**: Section-specific content like "NY Best Sellers"

## API Endpoints

### GET /feed

Returns the feed for a specific tab with all sections.

**Query Parameters:**
| Parameter | Type | Required | Values |
|-----------|------|----------|--------|
| tab | string | Yes | `episodes`, `books`, `podcasters` |

**Response:**
```json
{
  "tab": "episodes",
  "sections": [
    {
      "id": "continue_listening",
      "title": "Pick up where you left off",
      "type": "continue_listening",
      "items": [...],
      "hasMore": false
    },
    {
      "id": "popular",
      "title": "Popular Episodes",
      "type": "popular",
      "items": [...],
      "hasMore": true
    }
  ]
}
```

### GET /feed/section/:sectionId

Returns paginated data for a specific section ("See All" functionality).

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| sectionId | string | The section identifier |

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| page | number | 1 | - | Page number |
| limit | number | 20 | 50 | Items per page |

**Valid Section IDs:**
- Episodes: `continue_listening`, `popular`, `latest`, `recommended`
- Books: `popular_inspirations`, `popular_books`, `latest_books`, `bestsellers`
- Podcasters: `trending`, `top_rated`, `new_voices`

**Response:**
```json
{
  "items": [...],
  "page": 1,
  "limit": 20,
  "totalCount": 150,
  "totalPages": 8,
  "hasMore": true
}
```

## Feed Tabs & Sections

### Episodes Tab

| Section ID | Title | Description | Max Items |
|------------|-------|-------------|-----------|
| `continue_listening` | Pick up where you left off | User's in-progress episodes | 7 |
| `popular` | Popular Episodes | Episodes sorted by play count | 10 |
| `latest` | Latest Releases | Episodes sorted by creation date | 10 |
| `recommended` | Recommended Episodes | MVP: Same as Popular | 10 |

### Books Tab

| Section ID | Title | Description | Max Items |
|------------|-------|-------------|-----------|
| `popular_inspirations` | Popular podcast inspirations | Books with most episodes | 10 |
| `popular_books` | Popular Books | Books with highest total play count | 10 |
| `latest_books` | Latest Books | Books sorted by creation date | 10 |
| `bestsellers` | NY Best Sellers | MVP: Curated static list | 10 |

### Podcasters Tab

| Section ID | Title | Description | Max Items |
|------------|-------|-------------|-----------|
| `trending` | Trending | Podcasters sorted by play count | 10 |
| `top_rated` | Top Rated | Podcasters sorted by average rating | 10 |
| `new_voices` | New Voices | Podcasters sorted by creation date | 10 |

## Business Rules

### Continue Listening Section

The Continue Listening section has specific constraints:

1. **Maximum 7 episodes** - Only show up to 7 items
2. **30-day window** - Only include episodes started within the last 30 days
3. **Progress range** - Only include episodes with progress > 0% and < 95%
4. **Completion excluded** - Episodes at 95%+ progress are considered "complete"

```typescript
// Business rule constants
CONTINUE_LISTENING_MAX_ITEMS: 7
CONTINUE_LISTENING_MAX_DAYS: 30
CONTINUE_LISTENING_MIN_PROGRESS_PERCENT: 0
CONTINUE_LISTENING_MAX_PROGRESS_PERCENT: 95
```

### Content Visibility

- **Episodes**: Only `isPublic: true` and `generationStatus: 'COMPLETED'`
- **Books**: Only `extractionStatus: 'COMPLETED'`
- **Podcasters**: Only `isPublic: true`

### Sorting

| Section Type | Sort Order |
|--------------|------------|
| Popular/Trending | `playCount DESC, likeCount DESC` |
| Latest | `createdAt DESC` |
| Top Rated | `averageRating DESC, ratingCount DESC` |
| Continue Listening | `progressMs DESC` (most recently played) |

## Caching Strategy

The feed service uses Redis for caching to improve performance.

### Cache TTLs (Time To Live)

| Cache Key | TTL | Description |
|-----------|-----|-------------|
| `feed:episodes:popular` | 5 min | Popular episodes |
| `feed:episodes:latest` | 2 min | Latest episodes |
| `feed:books:popular` | 10 min | Popular books |
| `feed:books:inspirations` | 10 min | Popular inspirations |
| `feed:books:latest` | 5 min | Latest books |
| `feed:podcasters:trending` | 5 min | Trending podcasters |
| `feed:podcasters:top_rated` | 10 min | Top rated podcasters |
| `feed:podcasters:new_voices` | 5 min | New voices |
| `feed:user:{id}:continue` | 1 min | User's continue listening |

### Cache Behavior

- **Cache-first**: Check cache before database
- **TTL-based expiry**: No manual invalidation in MVP
- **Graceful degradation**: Cache errors fall back to database
- **Per-user caching**: Continue listening is cached per user

## Configuration

All configuration is defined in `FEED_CONFIG` constant:

```typescript
import { FEED_CONFIG } from './dto/feed-response.dto';

// Access configuration
const maxItems = FEED_CONFIG.CONTINUE_LISTENING_MAX_ITEMS; // 7
const cacheTTL = FEED_CONFIG.CACHE_TTL.EPISODES_POPULAR; // 300 seconds
const cacheKey = FEED_CONFIG.CACHE_KEYS.EPISODES_POPULAR; // 'feed:episodes:popular'
```

## Testing

### Run Unit Tests

```bash
# Run all feed tests
npm run test -- --testPathPattern=feed

# Run with coverage
npm run test:cov -- --testPathPattern=feed
```

### Run Integration Tests

```bash
# Run e2e tests
npm run test:e2e -- --testPathPattern=feed
```

### Test Files

| File | Description |
|------|-------------|
| `feed.service.spec.ts` | Unit tests for FeedService |
| `feed.controller.spec.ts` | Unit tests for FeedController |
| `test/feed.e2e-spec.ts` | Integration tests |
| `test/fixtures/feed.fixture.ts` | Test fixtures |

### Test Coverage Requirements

- Minimum 80% coverage for service methods
- All business rules must have corresponding tests
- Error handling paths should be tested

## Architecture

```
src/feed/
├── dto/
│   ├── feed-query.dto.ts      # Query parameter DTOs & enums
│   ├── feed-response.dto.ts   # Response DTOs & configuration
│   └── index.ts               # Barrel export
├── feed.controller.ts         # HTTP endpoints
├── feed.controller.spec.ts    # Controller unit tests
├── feed.service.ts            # Business logic
├── feed.service.spec.ts       # Service unit tests
├── feed.module.ts             # Module definition
└── README.md                  # This file
```

## Dependencies

- **DatabaseService**: Prisma client for database queries
- **RedisService**: Redis client for caching and playback progress

## Future Enhancements (Post-MVP)

- [ ] Recommendation engine with ML-based personalization
- [ ] NY Times Bestsellers API integration
- [ ] Cache invalidation on content changes
- [ ] A/B testing framework for feed sections
- [ ] Personalized sections based on user preferences
