# Episodes Service Documentation

## Overview

The Episodes Service is the core content generation engine for BookCast. It handles the creation of podcast episodes from books using virtual podcasters. The service orchestrates script generation (via AI) and text-to-speech conversion to produce complete podcast episodes.

## Architecture

```
episodes/
├── dto/
│   ├── create-episode.dto.ts      # Episode creation validation
│   ├── update-episode.dto.ts      # Episode update (partial)
│   ├── episode-response.dto.ts    # Response shape
│   └── query-episodes.dto.ts      # Query filtering/pagination
├── entities/
│   └── episode.entity.ts          # Entity type definitions
├── episodes.controller.ts         # REST API endpoints
├── episodes.service.ts            # Business logic
└── episodes.module.ts             # Module configuration
```

## Database Schema

```prisma
model Episode {
  id                    String         @id @default(uuid())
  userId                String
  podcasterId           String
  bookId                String

  // Core Content
  title                 String
  description           String?

  // Content Configuration
  contentCoverage       ContentCoverage  # ENTIRE_BOOK, MULTIPLE_CHAPTERS, SINGLE_CHAPTER
  chapters              Int[]            # Chapter numbers to cover
  episodeType           EpisodeType      # MONOLOGUE, DUO, GROUP
  episodeTheme          EpisodeTheme     # LECTURE, DISCUSSION, DEBATE
  targetLengthMin       Int              # Min target length (minutes)
  targetLengthMax       Int              # Max target length (minutes)

  // Generated Content
  scriptContent         String?          # Generated podcast script
  audioFileKey          String?          # Storage key for audio

  // Generation Status
  generationStatus      EpisodeStatus    # PENDING -> COMPLETED/FAILED
  scriptGeneratedAt     DateTime?
  audioGeneratedAt      DateTime?
  generationError       String?

  // Audio Properties
  duration              Int?             # Actual duration (seconds)
  audioFormat           String?          # mp3, wav, etc.

  // Metadata
  isPublic              Boolean   @default(false)
  playCount             Int       @default(0)
  likeCount             Int       @default(0)
  shareCount            Int       @default(0)
}
```

## API Endpoints

### Episode Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/episodes` | Required | Create new episode |
| GET | `/episodes/my` | Required | Get user's episodes |
| GET | `/episodes/:id` | Optional | Get episode by ID |
| PATCH | `/episodes/:id` | Required | Update episode |
| DELETE | `/episodes/:id` | Required | Delete episode |

### Discovery

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/episodes/public` | None | Get public episodes (paginated) |
| GET | `/episodes/trending` | None | Get trending episodes |
| GET | `/episodes/podcaster/:id` | None | Get episodes by podcaster |
| GET | `/episodes/book/:id` | None | Get episodes by book |

### Engagement

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/episodes/:id/play` | None | Increment play count |
| POST | `/episodes/:id/like` | Required | Like episode |
| DELETE | `/episodes/:id/like` | Required | Unlike episode |
| POST | `/episodes/:id/share` | None | Increment share count |

### Episode Actions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/episodes/:id/publish` | Required | Make episode public |
| POST | `/episodes/:id/retry` | Required | Retry failed generation |

### Audio Streaming & Playback

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/episodes/:id/stream` | Optional | Stream audio with range request support |
| POST | `/episodes/:id/progress` | Required | Save playback position to Redis |
| GET | `/episodes/:id/progress` | Required | Get saved playback position |
| GET | `/episodes/:id/generation-progress` | Optional | Get real-time generation progress from Redis |

## Generation Pipeline

### 1. Episode Creation
```
User Request → Validate Book/Podcaster → Create Episode (PENDING) → Queue Job
```

### 2. Script Generation (Worker)
```
PENDING → SCRIPT_GENERATING → Call HuggingFace API → SCRIPT_GENERATED
```

### 3. Audio Generation (Worker)
```
SCRIPT_GENERATED → AUDIO_GENERATING → Call Edge TTS → Save Audio → COMPLETED
```

### Status Flow
```
PENDING → SCRIPT_GENERATING → SCRIPT_GENERATED → AUDIO_GENERATING → COMPLETED
                ↓                    ↓                    ↓
              FAILED ←─────────── FAILED ←────────────── FAILED
```

## Script Generation Service

### Configuration
- **API**: HuggingFace Inference API (free tier)
- **Model**: Mistral-7B-Instruct-v0.2 (configurable via `HUGGINGFACE_MODEL`)
- **Fallback**: Template-based generation when API unavailable

### Prompt Engineering
The service builds prompts that include:
- Book content and metadata
- Podcaster personality traits
- Episode type (monologue/duo/group)
- Episode theme (lecture/discussion/debate)
- Target length constraints

### Personality Integration
Podcaster traits are converted to descriptive text:
- Tone (1-10) → "calm and measured" to "energetic and enthusiastic"
- Communication style → "storytelling" to "analytical"
- Humor level → "serious" to "comedic"
- Conversational depth → "surface-level" to "deep philosophical"
- Chaos factor → "structured" to "spontaneous"

## TTS Service

### Primary: Edge TTS (Free)
- Uses Microsoft Edge's neural voices
- Supports multiple accents and genders
- Configurable speaking rate and pitch

### Voice Mapping
```typescript
MALE: {
    'United States': 'en-US-GuyNeural',
    'United Kingdom': 'en-GB-RyanNeural',
    'Australia': 'en-AU-WilliamNeural',
    // ...
}
FEMALE: {
    'United States': 'en-US-JennyNeural',
    'United Kingdom': 'en-GB-SoniaNeural',
    // ...
}
```

### Multi-Voice Episodes (DUO/GROUP)
- Parses script for speaker labels (HOST:, GUEST1:, etc.)
- Assigns contrasting voices to different speakers
- Concatenates audio segments using ffmpeg

### Fallbacks
1. Google TTS API (if `GOOGLE_TTS_API_KEY` configured)
2. Silent placeholder audio (for testing)

## Environment Variables

```env
# Script Generation
HUGGINGFACE_API_KEY=hf_xxx       # HuggingFace API key (optional, enables AI)
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# TTS
GOOGLE_TTS_API_KEY=xxx           # Google TTS fallback (optional)
TTS_TEMP_DIR=./temp/tts          # Temp directory for audio processing

# Storage
LOCAL_STORAGE_PATH=./storage     # Where audio files are saved

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# Redis (for caching & progress tracking)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Dependencies

### System Requirements
- **edge-tts**: `pip install edge-tts` (for TTS)
- **ffmpeg**: Required for audio concatenation (DUO/GROUP episodes)
- **ffprobe**: Required for audio duration detection
- **Redis**: Required for progress tracking and playback state

### RabbitMQ Queues
- `episode_generation`: Main job queue
- `episode_generation_dlq`: Dead letter queue (after 3 retries)

### Redis Keys
- `job:{episodeId}`: Generation progress tracking (hash: progress, status, updatedAt)
- `playback:{userId}:{episodeId}`: Playback position in milliseconds
- `ratelimit:{key}`: Rate limiting counters

## Usage Examples

### Create Episode
```typescript
POST /episodes
{
  "bookId": "uuid",
  "podcasterId": "uuid",
  "title": "Understanding Stoic Philosophy",
  "contentCoverage": "MULTIPLE_CHAPTERS",
  "chapters": [1, 2, 3],
  "episodeType": "MONOLOGUE",
  "episodeTheme": "LECTURE",
  "targetLengthMin": 15,
  "targetLengthMax": 25
}
```

### Query Public Episodes
```typescript
GET /episodes/public?sortBy=popular&episodeType=MONOLOGUE&page=1&limit=20
```

### Stream Audio with Range Request
```typescript
// Full file
GET /episodes/:id/stream

// Partial content (seeking)
GET /episodes/:id/stream
Headers: { Range: "bytes=1000000-2000000" }
Response: 206 Partial Content
```

### Save/Resume Playback
```typescript
// Save progress
POST /episodes/:id/progress
Body: { "position": 125000 }  // milliseconds

// Get progress
GET /episodes/:id/progress
Response: { "position": 125000 }
```

### Track Generation Progress
```typescript
// Poll while generating
GET /episodes/:id/generation-progress
Response: {
  "progress": 60,
  "status": "SCRIPT_GENERATED",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Response Shape
```typescript
{
  "id": "uuid",
  "title": "Understanding Stoic Philosophy",
  "generationStatus": "COMPLETED",
  "duration": 1200,
  "playCount": 150,
  "podcaster": {
    "id": "uuid",
    "name": "Philosophy Phil",
    "profilePictureUrl": "..."
  },
  "book": {
    "id": "uuid",
    "title": "Meditations",
    "author": "Marcus Aurelius"
  }
}
```

## Error Handling

### Validation Errors (400)
- Missing required fields
- Invalid content coverage with no chapters
- Target length min > max
- Book extraction not completed

### Permission Errors (403)
- Creating episode from another user's book
- Accessing private podcaster
- Updating another user's episode

### Not Found (404)
- Book/Podcaster/Episode doesn't exist

### Generation Failures
- Stored in `generationError` field
- Retryable via POST `/episodes/:id/retry`
- Moves to DLQ after 3 automatic retries

## Testing

### Unit Tests (Recommended)
- Service methods with mocked dependencies
- Validation logic
- Status transitions

### Integration Tests
- Full API endpoint testing
- Database operations
- Queue interactions

### E2E Testing
- Full generation pipeline (requires external services)
- Audio output verification
