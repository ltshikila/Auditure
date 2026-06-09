# Feed Service

The Feed Service provides the home/discovery feed functionality for the Auditure mobile app. It serves content across three tabs: Episodes, Books, and Podcasters, with each tab containing multiple curated sections.

> **Note for developers**: The [Scaling Considerations](#scaling-considerations) section at the bottom is for future reference. Don't implement those patterns until metrics show you need them. Premature optimization is the root of all evil. Read it to understand the concepts, not as a todo list.

## Table of Contents

- [Overview](#overview)
- [API Endpoints](#api-endpoints)
- [Feed Tabs & Sections](#feed-tabs--sections)
- [Business Rules](#business-rules)
- [Why These Specific Numbers?](#why-these-specific-numbers)
- [Caching Strategy](#caching-strategy)
- [Configuration](#configuration)
- [Testing](#testing)
- [Scaling Considerations](#scaling-considerations)

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
- Episodes: `continue_listening`, `popular`, `top_rated_episodes`, `discussions`, `latest`, `quick_listens`
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
| `top_rated_episodes` | Top Rated | Rated episodes sorted by average rating | 10 |
| `discussions` | Debates & Discussions | Episodes with DEBATE/DISCUSSION theme | 10 |
| `latest` | Latest Releases | Episodes sorted by creation date | 10 |
| `quick_listens` | Quick Listens | Episodes ≤ 15 min, sorted by play count | 10 |

### Books Tab

| Section ID | Title | Description | Max Items |
|------------|-------|-------------|-----------|
| `popular_inspirations` | Popular podcast inspirations | Books with most episodes | 10 |
| `popular_books` | Popular Books | Books with highest total play count | 10 |
| `latest_books` | Latest Books | Books sorted by creation date | 10 |
| `bestsellers` | NY Best Sellers | MVP: Curated static list | 10 |

**Book Deduplication:** All book sections apply feed-level deduplication. When multiple copies of the same book exist (uploaded by different users), they are grouped by fuzzy title+author matching and only the best representative is displayed. Episode counts and play counts are aggregated across all copies. The representative is chosen by metadata completeness (cover image, author, page count), then episode count, then earliest upload date. See the [Books Service README](../books/README.md#book-deduplication--quality-based-canonical-selection) for full details.

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

## Why These Specific Numbers?

These aren't arbitrary - each is based on UX research and product decisions:

### Continue Listening: Max 7 Episodes

```
Why 7?
├── UI constraint: 7 cards fit well in horizontal scroll without feeling endless
├── Cognitive load: Miller's Law - humans process 7±2 items comfortably
├── Decision fatigue: More choices → slower decisions → worse engagement
└── Performance: Fewer items = smaller cache, faster loads
```

**Alternative considered:** 10 items. Rejected because scroll-to-find behavior indicates user doesn't remember what they were listening to.

### Continue Listening: 30-Day Window

```
Why 30 days?
├── Relevance: Episode started 2 months ago is likely abandoned
├── Content freshness: User's interests may have changed
├── Cache efficiency: Fewer episodes to track per user
└── UX clarity: "Recent" should mean recent
```

**Trade-off:** Power users who take long breaks might lose progress. Acceptable for MVP.

### Continue Listening: 0% - 95% Progress Range

```
Why 0% minimum?
└── Episode with 0% progress was started but never played (intentional click)

Why 95% maximum?
├── Audio often has 30s-1min of credits/silence at end
├── User who reached 95% effectively "finished"
├── Prevents "ghost" episodes cluttering the list
└── Common industry practice (Spotify, Audible use similar thresholds)
```

### Section Limits: 10 Items

```
Why 10 per section?
├── Horizontal scroll: 10 items is 2-3 swipes (engaging, not tedious)
├── API response size: ~10KB per section (fast even on 3G)
├── "See All" conversion: If user wants more, they'll tap "See All"
└── Industry standard: Netflix, Spotify, YouTube all use ~10
```

### Cache TTLs: Why Different Durations?

```
Popular Episodes (5 min TTL)
├── Changes moderately (play counts update)
└── Balance: fresh enough, not constant queries

Latest Episodes (2 min TTL)
├── New content appears frequently
└── Users expect to see new releases quickly

Popular Books (10 min TTL)
├── Book popularity changes slowly
└── Longer cache = fewer DB hits

Continue Listening (1 min TTL)
├── Personal data, must feel current
└── Short TTL ensures progress updates show quickly
```

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

---

## Scaling Considerations

This section covers architectural patterns needed when the application grows beyond what the MVP can handle. If you're new to distributed systems, read this carefully—these are common patterns you'll encounter in production systems.

### Understanding the Current Limitations

**The MVP uses a "Pull Model":**
```
User opens app → Request hits API → API queries database → Returns results
```

This works great for hundreds or even thousands of users. But what happens when you have:
- 100,000 users refreshing their feeds simultaneously?
- A popular podcaster with 50,000 followers publishes a new episode?
- Users expecting real-time updates when new content is available?

The database becomes a bottleneck. Every user hitting "refresh" triggers expensive queries. This is where **message queues** and **fanout patterns** come in.

---

### What is a Message Queue?

Think of a message queue like a to-do list for your servers. Instead of doing work immediately (which can overwhelm your system), you add tasks to a queue and workers process them at a sustainable pace.

**Without a queue:**
```
User Action → Server does ALL the work → User waits → Response
```

**With a queue:**
```
User Action → Server adds task to queue → Response (fast!)
                    ↓
            Worker picks up task
                    ↓
            Work happens in background
```

**Real example**: When a podcaster publishes an episode, instead of immediately sending 50,000 push notifications (which would take forever and might crash the server), we:
1. Add one message to a queue: "Episode X was published"
2. Return success to the podcaster immediately
3. Background workers pick up that message and send notifications in batches

---

### What is Fanout?

"Fanout" means taking one event and spreading it to many destinations. The term comes from electronics where one signal fans out to multiple outputs.

**Visual representation:**
```
        One Event (Episode Published)
                    │
                    ▼
            ┌───────┴───────┐
            │  Fanout       │
            │  Exchange     │
            └───────┬───────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
Queue A         Queue B         Queue C
(Notifications) (Feed Cache)    (Analytics)
    │               │               │
    ▼               ▼               ▼
Worker A        Worker B        Worker C
```

One message becomes three (or more) independent tasks that can be processed in parallel.

---

### Feed Update Strategies

There are two main approaches to building feeds at scale. Understanding both is crucial.

#### Strategy 1: Fanout on Read (Current MVP Approach)

**How it works:**
When a user opens their feed, we query the database for all the content they should see.

```
User requests feed
        │
        ▼
Query: "Get episodes from podcasters this user follows,
        sorted by date, limited to 10"
        │
        ▼
Database does the work
        │
        ▼
Return results
```

**Pros:**
- Simple to implement
- No wasted work (only compute what users actually request)
- Works well for users who follow many accounts (celebrities)

**Cons:**
- Slow reads (database query on every request)
- Database becomes bottleneck at scale
- Hard to personalize in real-time

**When to use:**
- MVP stage (where we are now)
- Users with very high follower counts (see "Celebrity Problem" below)

#### Strategy 2: Fanout on Write

**How it works:**
When new content is published, we immediately update every follower's pre-computed feed.

```
Podcaster publishes episode
        │
        ▼
Get list of all followers (e.g., 10,000 users)
        │
        ▼
For each follower:
    Add episode to their cached feed
        │
        ▼
Done! (feeds are pre-computed)

Later, when user opens app:
        │
        ▼
Read pre-computed feed from cache (super fast!)
```

**Pros:**
- Extremely fast reads (just read from cache)
- Feed is always ready
- Easy to personalize (each user has their own feed)

**Cons:**
- Expensive writes (must update many feeds)
- Wasted work if users never check their feed
- Storage intensive (storing feeds for every user)

**When to use:**
- Users follow a manageable number of accounts
- Read-heavy applications (users check feed often)

#### The Celebrity Problem

What if a podcaster has 1 million followers? Fanout on write means updating 1 million cached feeds every time they publish. That's expensive!

**Solution: Hybrid Approach**

```typescript
async function onEpisodePublished(episode: Episode) {
    const followerCount = await getFollowerCount(episode.podcasterId);

    if (followerCount < 10000) {
        // Small account: Fanout on write
        // Update all followers' cached feeds
        await fanoutToFollowers(episode);
    } else {
        // Celebrity: Fanout on read
        // Just invalidate caches, compute on demand
        await invalidateCelebrityCache(episode.podcasterId);
    }
}
```

This is what Twitter/X does. Regular users get fanout-on-write (fast reads). Celebrities (high follower count) use fanout-on-read (computed when you view their tweets).

---

### Implementing Fanout with RabbitMQ

Our application already uses RabbitMQ. Here's how we'd set up fanout for the feed service.

#### Step 1: Define Events

First, identify what events should trigger feed updates:

```typescript
// feed-events.ts
export enum FeedEventType {
    EPISODE_PUBLISHED = 'episode.published',
    EPISODE_DELETED = 'episode.deleted',
    PODCASTER_FOLLOWED = 'podcaster.followed',
    PODCASTER_UNFOLLOWED = 'podcaster.unfollowed',
    EPISODE_LIKED = 'episode.liked',
    PLAYBACK_PROGRESS = 'playback.progress',
}

export interface FeedEvent {
    type: FeedEventType;
    timestamp: Date;
    payload: any;
}
```

#### Step 2: Create a Fanout Exchange

A fanout exchange broadcasts messages to ALL connected queues:

```typescript
// rabbitmq-setup.ts
import { Channel } from 'amqplib';

async function setupFeedFanout(channel: Channel) {
    // Create the fanout exchange
    // 'fanout' type means: send to ALL bound queues
    await channel.assertExchange('feed.events', 'fanout', {
        durable: true  // Survives broker restart
    });

    // Create queues for different consumers
    // Each queue processes the same events differently

    // Queue 1: Updates cached feeds
    await channel.assertQueue('feed.cache.updates', { durable: true });
    await channel.bindQueue('feed.cache.updates', 'feed.events', '');

    // Queue 2: Sends push notifications
    await channel.assertQueue('feed.notifications', { durable: true });
    await channel.bindQueue('feed.notifications', 'feed.events', '');

    // Queue 3: Updates search index
    await channel.assertQueue('feed.search.index', { durable: true });
    await channel.bindQueue('feed.search.index', 'feed.events', '');

    // Queue 4: Analytics/metrics
    await channel.assertQueue('feed.analytics', { durable: true });
    await channel.bindQueue('feed.analytics', 'feed.events', '');
}
```

**Why four queues?**
Each queue has a different responsibility:
1. **Cache updates**: Keep user feeds fresh
2. **Notifications**: Tell users about new content
3. **Search**: Update search indexes
4. **Analytics**: Track what content is popular

They all need to know about new episodes, but they do different things with that information.

#### Step 3: Publish Events

When something happens (e.g., episode published), publish to the exchange:

```typescript
// episode.service.ts
async publishEpisode(episodeId: string, userId: string): Promise<Episode> {
    // 1. Update database
    const episode = await this.prisma.episode.update({
        where: { id: episodeId },
        data: { isPublic: true },
        include: { podcaster: true, book: true },
    });

    // 2. Publish event to fanout exchange
    // This one message will be delivered to ALL bound queues
    await this.rabbitMQ.publish('feed.events', {
        type: FeedEventType.EPISODE_PUBLISHED,
        timestamp: new Date(),
        payload: {
            episodeId: episode.id,
            podcasterId: episode.podcasterId,
            title: episode.title,
            coverImageUrl: episode.book?.coverImageUrl,
        },
    });

    // 3. Return immediately (don't wait for fanout to complete)
    return episode;
}
```

**Key insight**: The API returns immediately. The user doesn't wait for notifications to be sent or caches to be updated. That work happens asynchronously.

#### Step 4: Consume Events

Each queue has workers that process events:

```typescript
// feed-cache.worker.ts
// This worker updates users' cached feeds

async function processFeedCacheUpdate(event: FeedEvent) {
    if (event.type !== FeedEventType.EPISODE_PUBLISHED) return;

    const { podcasterId, episodeId } = event.payload;

    // Get all followers of this podcaster
    const followers = await getFollowers(podcasterId);

    // Update each follower's cached feed
    // In production, you'd batch this!
    for (const follower of followers) {
        const cacheKey = `feed:user:${follower.id}:episodes`;

        // Add new episode to the front of their feed
        await redis.lpush(cacheKey, episodeId);

        // Keep feed at reasonable size (e.g., 100 items)
        await redis.ltrim(cacheKey, 0, 99);
    }

    // Also invalidate the global "latest" cache
    await redis.del('feed:episodes:latest');
}
```

```typescript
// notification.worker.ts
// This worker sends push notifications

async function processNotification(event: FeedEvent) {
    if (event.type !== FeedEventType.EPISODE_PUBLISHED) return;

    const { podcasterId, title } = event.payload;

    // Get followers who have notifications enabled
    const followers = await getFollowersWithNotifications(podcasterId);

    // Get podcaster name
    const podcaster = await getPodcaster(podcasterId);

    // Send notifications in batches (don't overwhelm push service)
    const BATCH_SIZE = 100;
    for (let i = 0; i < followers.length; i += BATCH_SIZE) {
        const batch = followers.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(follower =>
            sendPushNotification(follower.pushToken, {
                title: `New episode from ${podcaster.name}`,
                body: title,
                data: { episodeId: event.payload.episodeId },
            })
        ));

        // Small delay between batches to avoid rate limiting
        await sleep(100);
    }
}
```

---

### Cache Invalidation Strategies

"There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

When content changes, cached data becomes stale. Here are strategies to handle this:

#### Strategy 1: Time-Based Expiry (Current MVP)

```typescript
// Set cache with TTL (Time To Live)
await redis.setex('feed:episodes:popular', 300, JSON.stringify(data));
// Cache expires automatically after 5 minutes
```

**Pros**: Simple, no coordination needed
**Cons**: Data can be stale for up to TTL duration

#### Strategy 2: Event-Based Invalidation

```typescript
// When episode is liked, invalidate popular cache
async function onEpisodeLiked(episodeId: string) {
    await redis.del('feed:episodes:popular');
    // Next request will fetch fresh data
}
```

**Pros**: Data is always fresh after changes
**Cons**: More complex, need to track all dependencies

#### Strategy 3: Stale-While-Revalidate

Serve stale data immediately, but refresh in background:

```typescript
async function getPopularEpisodes(): Promise<Episode[]> {
    const cacheKey = 'feed:episodes:popular';
    const cached = await redis.get(cacheKey);

    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        // If cache is older than 1 minute, refresh in background
        if (age > 60000) {
            // Don't await! Return stale data immediately
            this.refreshPopularEpisodesCache();
        }

        return data;
    }

    // No cache, must wait for fresh data
    return this.fetchAndCachePopularEpisodes();
}
```

**Pros**: Fast responses, data eventually consistent
**Cons**: Users might see slightly stale data

---

### Scaling the Notification System

Notifications have unique challenges at scale.

#### The Problem

Imagine this scenario:
- Popular podcaster has 100,000 followers
- They publish an episode
- We need to send 100,000 push notifications
- Each notification takes ~50ms to send
- Total time: 100,000 × 50ms = 5,000 seconds = 83 minutes!

That's unacceptable. Users expect notifications within seconds.

#### The Solution: Parallel Processing with Multiple Workers

```
Episode Published
        │
        ▼
Notification Fanout Service
        │
        ├─── Batch 1 (users 1-1000) ────→ Worker 1
        ├─── Batch 2 (users 1001-2000) ─→ Worker 2
        ├─── Batch 3 (users 2001-3000) ─→ Worker 3
        │    ... (97 more batches)
        └─── Batch 100 ─────────────────→ Worker 100
```

With 100 workers processing in parallel:
- Each worker handles 1,000 notifications
- Time per worker: 1,000 × 50ms = 50 seconds
- Total time: ~50 seconds (instead of 83 minutes!)

```typescript
// notification-fanout.service.ts
async function fanoutNotifications(event: FeedEvent) {
    const { podcasterId } = event.payload;

    // Get all followers
    const followers = await getFollowers(podcasterId);

    // Split into batches
    const BATCH_SIZE = 1000;
    const batches = chunk(followers, BATCH_SIZE);

    // Send each batch to a separate queue
    // Workers will pick them up in parallel
    for (let i = 0; i < batches.length; i++) {
        await this.rabbitMQ.sendToQueue('notifications.batch', {
            batchId: i,
            eventPayload: event.payload,
            userIds: batches[i].map(f => f.id),
        });
    }

    console.log(`Queued ${batches.length} notification batches for ${followers.length} users`);
}
```

#### Handling Failures

What if a worker crashes mid-batch? We need to ensure no notifications are lost.

```typescript
// notification-batch.worker.ts
async function processNotificationBatch(message: BatchMessage) {
    const { batchId, eventPayload, userIds } = message;

    // Track which notifications succeeded
    const results = await Promise.allSettled(
        userIds.map(userId => sendNotification(userId, eventPayload))
    );

    // Find failures
    const failures = results
        .map((result, index) => ({ result, userId: userIds[index] }))
        .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
        // Re-queue failed notifications for retry
        await this.rabbitMQ.sendToQueue('notifications.retry', {
            eventPayload,
            userIds: failures.map(f => f.userId),
            attempt: 1,
        });

        console.warn(`${failures.length} notifications failed, queued for retry`);
    }
}
```

---

### Database Scaling Considerations

As the feed service grows, database queries become the bottleneck.

#### Read Replicas

```
                    ┌─────────────┐
                    │   Primary   │
                    │  (writes)   │
                    └──────┬──────┘
                           │ replication
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │  Replica  │   │  Replica  │   │  Replica  │
    │  (reads)  │   │  (reads)  │   │  (reads)  │
    └───────────┘   └───────────┘   └───────────┘
```

- All writes go to primary database
- Reads are distributed across replicas
- Feed queries (read-heavy) use replicas

```typescript
// database.service.ts
class DatabaseService {
    private primary: PrismaClient;
    private replica: PrismaClient;

    // Use for writes
    get write() {
        return this.primary;
    }

    // Use for reads (feed queries)
    get read() {
        return this.replica;
    }
}

// feed.service.ts
async getPopularEpisodes() {
    // Use read replica for feed queries
    return this.database.read.episode.findMany({
        where: { isPublic: true, generationStatus: 'COMPLETED' },
        orderBy: { playCount: 'desc' },
        take: 10,
    });
}
```

#### Query Optimization

Add indexes for common feed queries:

```sql
-- Index for popular episodes query
CREATE INDEX idx_episodes_popular
ON episodes (is_public, generation_status, play_count DESC, like_count DESC)
WHERE is_public = true AND generation_status = 'COMPLETED';

-- Index for latest episodes query
CREATE INDEX idx_episodes_latest
ON episodes (is_public, generation_status, created_at DESC)
WHERE is_public = true AND generation_status = 'COMPLETED';

-- Index for user's continue listening
CREATE INDEX idx_episodes_user_progress
ON playback_progress (user_id, updated_at DESC);
```

---

### Monitoring and Observability

At scale, you need visibility into what's happening.

#### Key Metrics to Track

```typescript
// metrics.service.ts
class FeedMetrics {
    // Response time
    recordFeedLatency(tab: string, durationMs: number) {
        this.histogram('feed.latency', durationMs, { tab });
    }

    // Cache performance
    recordCacheHit(cacheKey: string) {
        this.increment('feed.cache.hit', { key: cacheKey });
    }

    recordCacheMiss(cacheKey: string) {
        this.increment('feed.cache.miss', { key: cacheKey });
    }

    // Queue depths (are workers keeping up?)
    recordQueueDepth(queueName: string, depth: number) {
        this.gauge('feed.queue.depth', depth, { queue: queueName });
    }

    // Error rates
    recordError(operation: string, error: Error) {
        this.increment('feed.error', { operation, type: error.name });
    }
}
```

#### Alerting Rules

```yaml
# alerts.yml
alerts:
  - name: FeedLatencyHigh
    condition: avg(feed.latency) > 500ms for 5 minutes
    severity: warning
    message: "Feed response time is degraded"

  - name: CacheHitRateLow
    condition: feed.cache.hit / (feed.cache.hit + feed.cache.miss) < 0.8
    severity: warning
    message: "Cache hit rate below 80%, check cache health"

  - name: QueueBacklogGrowing
    condition: feed.queue.depth > 10000 for 10 minutes
    severity: critical
    message: "Message queue backlog growing, workers may be failing"
```

---

### Summary: Scaling Roadmap

| Stage | Users | Strategy | Key Changes |
|-------|-------|----------|-------------|
| MVP | < 10K | Pull model, simple caching | Current implementation |
| Growth | 10K - 100K | Add read replicas, improve caching | Database replication, cache optimization |
| Scale | 100K - 1M | Fanout on write, message queues | RabbitMQ fanout, background workers |
| Large Scale | 1M+ | Hybrid fanout, sharding | Celebrity handling, database sharding |

**Remember**: Don't over-engineer early! The MVP architecture is appropriate for the current stage. Implement these patterns when metrics show you need them, not before.
