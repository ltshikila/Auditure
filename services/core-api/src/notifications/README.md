# Notifications Service

A comprehensive notification system for the Auditure mobile app, providing in-app notifications and push notification delivery via Expo Push API.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NotificationsService                         │
│  - Create notification in DB                                    │
│  - Check user preferences                                       │
│  - Publish to Redis Stream (non-blocking)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│       PostgreSQL         │    │      Redis Stream        │
│   (notification history) │    │   "notifications:stream" │
└──────────────────────────┘    └───────────┬──────────────┘
                                            │
                                            ▼
                                ┌──────────────────────────┐
                                │  Background Consumer     │
                                │  - XREADGROUP consumer   │
                                │  - Batch + send to Expo  │
                                │  - Retry on failure      │
                                └───────────┬──────────────┘
                                            │
                                            ▼
                                ┌──────────────────────────┐
                                │    Expo Push API         │
                                │  - FCM (Android)         │
                                │  - APNs (iOS)            │
                                └──────────────────────────┘
```

## Features

- **In-app notifications**: Stored in PostgreSQL with full CRUD operations
- **Push notifications**: Delivered via Expo Push API (handles FCM/APNs)
- **Redis Streams**: Async processing for reliable delivery
- **Background consumer**: Processes notifications without blocking API requests
- **User preferences**: Respects push notification enable/disable settings
- **Automatic token cleanup**: Removes invalid push tokens automatically
- **Batch processing**: Efficiently sends multiple notifications

---

## Understanding the Architecture

### Why Redis Streams (Not Pub/Sub or RabbitMQ)?

We already use RabbitMQ for book extraction. Why Redis Streams for notifications?

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Redis Pub/Sub** | Simple, fast, built-in | Messages lost if no subscriber | Real-time chat, ephemeral events |
| **RabbitMQ** | Durable, rich features, routing | Another service to manage | Complex workflows, multiple consumers |
| **Redis Streams** | Durable, consumer groups, already have Redis | Newer, less documentation | Ordered events, competing consumers |

**We chose Redis Streams because:**
1. **Already running Redis** for caching - no new infrastructure
2. **Consumer groups** let multiple workers share the load
3. **Message acknowledgment** prevents lost notifications
4. **Simpler than RabbitMQ** for this specific use case
5. **Ordered delivery** preserves notification sequence

### Consumer Groups Explained

The problem: What if we have 10,000 notifications to send?

```
WITHOUT CONSUMER GROUPS              WITH CONSUMER GROUPS
───────────────────────              ────────────────────
Stream: [1] [2] [3] [4] [5]          Stream: [1] [2] [3] [4] [5]
              │                                    │
              ▼                        ┌───────────┼───────────┐
        Single Worker                  ▼           ▼           ▼
      Processes 1,2,3,4,5          Worker A    Worker B    Worker C
         sequentially              gets [1,4]  gets [2,5]  gets [3]

Time: 5 × 50ms = 250ms             Time: ~100ms (parallel!)
```

**Consumer groups solve:**
1. **Parallel processing**: Multiple workers divide the work
2. **Competing consumers**: Each message goes to ONE worker only
3. **Fault tolerance**: If Worker A crashes, Worker B gets its pending messages
4. **Scalability**: Add more workers to increase throughput

### Message Acknowledgment Flow

```
1. Worker reads message from stream (XREADGROUP)
   └── Message marked as "pending" for this consumer

2. Worker processes notification
   └── Sends push notification via Expo

3. Worker acknowledges message (XACK)
   └── Message removed from pending list

4. If worker crashes before XACK?
   └── Message stays pending
   └── After 60 seconds, another worker can claim it (XCLAIM)
   └── Ensures no notifications are lost
```

### Why Not Just Send Push Directly?

```typescript
// ❌ BAD: Blocking the API request
async createNotification(dto) {
  const notification = await this.prisma.notification.create(dto);
  await this.sendPushNotification(notification); // User waits for this!
  return notification;
}

// ✅ GOOD: Non-blocking with Redis Stream
async createNotification(dto) {
  const notification = await this.prisma.notification.create(dto);
  await this.redis.xadd('notifications:stream', notification); // Fast!
  return notification; // User gets response immediately
}
```

**Benefits of the queue:**
- API response in ~50ms instead of ~200ms
- If Expo is slow/down, notifications queue up (not lost)
- Retry logic happens in background, not blocking users

## Notification Types

| Type | Description | Use Case |
|------|-------------|----------|
| `EPISODE_READY` | Episode generation completed | Notify user their podcast is ready |
| `EPISODE_FAILED` | Episode generation failed | Alert user to retry or check error |
| `NEW_COMMENT` | Someone commented on an episode | Social engagement notification |
| `NEW_RATING` | Someone rated a podcaster | Creator feedback notification |
| `SUBSCRIPTION_WARNING` | Usage quota warning | Alert at 80% usage |
| `SYSTEM` | System announcements | App updates, maintenance, etc. |

## API Endpoints

### List Notifications
```http
GET /notifications?page=1&limit=20&unreadOnly=false&type=EPISODE_READY
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 20, max: 100) - Items per page
- `unreadOnly` (default: false) - Filter to unread only
- `type` - Filter by notification type

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "EPISODE_READY",
      "title": "Episode Ready! 🎧",
      "body": "Your episode \"My Podcast\" is ready to listen.",
      "data": { "episodeId": "uuid", "route": "/episodes/uuid" },
      "read": false,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "totalPages": 2,
  "unreadCount": 5
}
```

### Get Unread Count
```http
GET /notifications/unread-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "unreadCount": 5
}
```

### Get Single Notification
```http
GET /notifications/:id
Authorization: Bearer <token>
```

### Mark as Read
```http
PATCH /notifications/:id/read
Authorization: Bearer <token>
```

### Mark All as Read
```http
PATCH /notifications/read-all
Authorization: Bearer <token>
Content-Type: application/json

{
  "notificationIds": ["uuid1", "uuid2"]  // Optional - omit to mark all
}
```

### Delete Notification
```http
DELETE /notifications/:id
Authorization: Bearer <token>
```

### Delete All Notifications
```http
DELETE /notifications/all
Authorization: Bearer <token>
```

### Register Push Token
```http
POST /notifications/push-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

### Clear Push Token
```http
DELETE /notifications/push-token
Authorization: Bearer <token>
```

## Usage in Other Services

### Sending Notifications

```typescript
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EpisodesService {
  constructor(private notificationsService: NotificationsService) {}

  async onEpisodeComplete(episode: Episode) {
    // Use convenience method
    await this.notificationsService.notifyEpisodeReady(
      episode.userId,
      episode.id,
      episode.title,
    );
  }

  async onEpisodeFailed(episode: Episode, error: string) {
    await this.notificationsService.notifyEpisodeFailed(
      episode.userId,
      episode.id,
      episode.title,
      error,
    );
  }
}
```

### Available Convenience Methods

```typescript
// Episode ready
notifyEpisodeReady(userId: string, episodeId: string, episodeTitle: string)

// Episode failed
notifyEpisodeFailed(userId: string, episodeId: string, episodeTitle: string, errorMessage?: string)

// New comment
notifyNewComment(userId: string, episodeId: string, episodeTitle: string, commenterName: string)

// New rating
notifyNewRating(userId: string, podcasterId: string, podcasterName: string, rating: number)

// Subscription warning
notifySubscriptionWarning(userId: string, usagePercent: number)

// Custom system notification
notifySystem(userId: string, title: string, body: string, data?: NotificationPayload)
```

### Direct Creation

```typescript
// Single notification
await notificationsService.create({
  userId: 'user-uuid',
  type: NotificationType.SYSTEM,
  title: 'Welcome!',
  body: 'Thanks for joining Auditure.',
  data: { route: '/onboarding' },
});

// Batch notifications (e.g., notify all followers)
await notificationsService.createBatch([
  { userId: 'user-1', type: NotificationType.SYSTEM, title: 'New episode', body: '...' },
  { userId: 'user-2', type: NotificationType.SYSTEM, title: 'New episode', body: '...' },
]);
```

## Mobile App Integration

### Register Push Token (React Native / Expo)

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

async function registerForPushNotifications() {
  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return;
  }

  // Get Expo push token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-expo-project-id',
  });

  // Send to backend
  await fetch('/notifications/push-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pushToken: token.data }),
  });
}
```

### Handle Incoming Notifications

```typescript
import * as Notifications from 'expo-notifications';

// Handle notification received while app is foregrounded
Notifications.addNotificationReceivedListener((notification) => {
  const { title, body, data } = notification.request.content;
  // Show in-app notification or update badge
});

// Handle notification tap
Notifications.addNotificationResponseReceivedListener((response) => {
  const { data } = response.notification.request.content;
  if (data?.route) {
    // Navigate to the route
    navigation.navigate(data.route);
  }
});
```

### Fetch Notifications

```typescript
// Get notifications with pagination
const response = await fetch('/notifications?page=1&limit=20&unreadOnly=true', {
  headers: { 'Authorization': `Bearer ${accessToken}` },
});
const { notifications, unreadCount, totalPages } = await response.json();

// Update badge count
await Notifications.setBadgeCountAsync(unreadCount);
```

## Database Schema

```prisma
enum NotificationType {
  EPISODE_READY
  EPISODE_FAILED
  NEW_COMMENT
  NEW_RATING
  SUBSCRIPTION_WARNING
  SYSTEM
}

model Notification {
  id        String           @id @default(uuid())
  userId    String
  type      NotificationType
  title     String
  body      String
  data      Json?            // Deep linking payload
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, read, createdAt(sort: Desc)])
  @@map("notifications")
}

// Added to UserSettings
model UserSettings {
  // ... existing fields
  expoPushToken  String?  // Expo Push Notification token
}
```

## Redis Streams

The service uses Redis Streams for async notification delivery:

- **Stream**: `notifications:stream`
- **Consumer Group**: `notifications:consumers`
- **Consumer Name**: `notifications-consumer-{pid}`

### Stream Operations

| Operation | Purpose |
|-----------|---------|
| `XADD` | Add notification to stream |
| `XREADGROUP` | Read notifications with consumer group |
| `XACK` | Acknowledge processed notification |
| `XPENDING` | Check for stuck notifications |
| `XCLAIM` | Reclaim stale notifications |
| `XTRIM` | Prevent unbounded stream growth |

### Reliability Features

1. **Consumer groups**: Multiple instances can process concurrently
2. **Acknowledgments**: Notifications aren't lost if consumer crashes
3. **Stale message reclaim**: Stuck messages are re-processed after 60s
4. **Retry limit**: Messages are dropped after 5 failed attempts
5. **Stream trimming**: Old messages are pruned to prevent unbounded growth

## Error Handling

### Push Token Errors

| Error | Handling |
|-------|----------|
| `DeviceNotRegistered` | Token is automatically cleared |
| `InvalidCredentials` | Logged, notification still stored |
| `MessageTooBig` | Logged, consider truncating |
| `MessageRateExceeded` | Retried with backoff |

### Service Errors

- **User not found**: `NotFoundException` (404)
- **Access denied**: `ForbiddenException` (403)
- **Invalid token format**: `BadRequestException` (400)
- **Redis unavailable**: Graceful degradation (notifications still stored)

## Testing

### Run Tests

```bash
# Unit tests
npm run test -- --testPathPattern=notifications

# Coverage
npm run test:cov -- --testPathPattern=notifications
```

### Test Coverage

- `NotificationsService`: CRUD operations, push delivery, consumer logic
- `NotificationsController`: All REST endpoints
- `ExpoPushService`: Token validation, batch sending, error handling

### Test Fixtures

Located in `test/fixtures/notifications.fixture.ts`:

```typescript
createMockNotification(overrides)
createUnreadMockNotification(overrides)
createReadMockNotification(overrides)
createEpisodeReadyNotification(overrides)
createMockNotificationList(count, userId)
createMockUserSettingsWithPushToken(overrides)
VALID_EXPO_PUSH_TOKEN
INVALID_PUSH_TOKENS
mockExpoPushSuccessTicket
mockExpoPushDeviceNotRegisteredTicket
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |

### Expo Push API

No API key required for Expo Push API - it uses project-based authentication via the push token itself.

## Monitoring

### Logs

The service logs comprehensively:

```
[NotificationsService] create() called: type=EPISODE_READY, userId=abc123
[NotificationsService] Created notification xyz789 for user abc123
[NotificationsService] Added notification xyz789 to stream with ID: 1234567890-0
[NotificationsService] Processing notification xyz789 for user abc123
[NotificationsService] Push notification sent for xyz789: ticket ticket-abc
[NotificationsService] Acknowledged notification xyz789
```

### Metrics to Track

- Notifications created per hour
- Push delivery success rate
- Consumer lag (pending messages)
- Token invalidation rate

## Module Structure

```
src/notifications/
├── notifications.module.ts       # NestJS module definition
├── notifications.controller.ts   # REST API endpoints
├── notifications.service.ts      # Business logic & consumer
├── expo-push.service.ts          # Expo Push API client
├── dto/
│   ├── index.ts
│   ├── notification-response.dto.ts
│   └── notification-query.dto.ts
├── interfaces/
│   ├── index.ts
│   └── notification-payload.interface.ts
├── notifications.service.spec.ts
├── notifications.controller.spec.ts
├── expo-push.service.spec.ts
└── README.md
```

## Migration

When deploying, run the Prisma migration:

```bash
npx prisma migrate dev --name add_notifications
```

This will:
1. Create the `notifications` table
2. Add `expoPushToken` column to `user_settings`
3. Create necessary indexes
