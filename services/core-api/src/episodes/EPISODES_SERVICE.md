# Episodes Service Documentation

## Overview

The Episodes Service is the core content generation engine for Auditure. It handles the creation of podcast episodes from books using virtual podcasters. The service orchestrates script generation (via AI) and text-to-speech conversion to produce complete podcast episodes.

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

### Voice Tiers

| Tier | Provider | Cost | Use Case |
|------|----------|------|----------|
| **Standard** | Google Cloud Standard | $4/1M chars (~$0.024/ep) | Free tier fallback |
| **Gemini Flash** | Gemini 2.5 Flash TTS | $10/1M audio tokens (~$0.15/ep) | Default for all users |
| **Gemini Pro** | Gemini 2.5 Pro TTS | $20/1M audio tokens (~$0.30/ep) | Premium option |

### Hybrid Free Tier Model
- **Free users:** 1 Gemini + 2 Standard episodes/month
- **Paid users:** All episodes use Gemini 2.5 Flash TTS

### Gemini TTS Features
- Native multi-speaker synthesis (up to 9 speakers per request)
- Non-verbal cues ([sigh], [laugh], [uhm], etc.)
- Natural language style prompts for tone, accent, pace, emotion
- Podcast-optimized audio output (24kHz WAV)
- TTS markup tags for natural pauses and delivery
- 1 second trailing silence for natural episode endings
- Max output duration: ~11 minutes (chunk + stitch for longer)

### Dynamic WPM Calculation
Script length automatically adjusts based on podcaster's speaking speed:
- Formula: `WPM = 130 + (speaking_speed × 10)`
- Range: 140 WPM (slow) to 230 WPM (very fast)

### Natural Interruptions & Backchannels
Multi-speaker episodes (DUO, GROUP) include verbal cues controlled by **chaos factor**:
- **DEBATE episodes:** Interruptions scale from polite (chaos 1-3) to passionate (chaos 7-10)
- **DISCUSSION episodes:** Friendly backchannels scale with chaos factor
- **LECTURE episodes:** No interruptions (monologue format)

### Voice Mapping (Standard Tier)
```typescript
MALE: {
    'United States': 'en-US-Standard-A',
    'United Kingdom': 'en-GB-Standard-B',
    'Australia': 'en-AU-Standard-B',
    // ...
}
FEMALE: {
    'United States': 'en-US-Standard-C',
    'United Kingdom': 'en-GB-Standard-A',
    // ...
}
```

### Multi-Voice Episodes (DUO/GROUP)
- **Gemini TTS:** Native multi-speaker - handles speaker labels automatically
- **Standard:** Parses script for speaker labels (HOST:, GUEST1:, etc.)
- Assigns contrasting voices to different speakers
- Concatenates audio segments using ffmpeg (Standard tier only)

## Environment Variables

```env
# Script Generation (AI Worker handles this via OpenAI GPT-4o mini)
# Core API queues jobs, AI Worker generates scripts

# TTS Configuration
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_CREDENTIALS_PATH=/path/to/credentials.json
GEMINI_API_KEY=xxx               # For Gemini 2.5 TTS (via google-genai SDK)
TTS_VOICE_TIER=gemini            # Default: gemini or standard
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
- **google-genai SDK**: For Gemini 2.5 TTS integration
- **Google Cloud SDK**: For Standard TTS voices (fallback)
- **ffmpeg**: Required for audio concatenation (Standard tier multi-voice, chunked episodes)
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
