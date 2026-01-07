# Auditure AI Worker

Python microservice for AI-powered podcast generation. Handles script generation (via OpenAI GPT-4o mini with template fallback) and text-to-speech conversion (via Google Cloud TTS).

## Architecture

```
ai-worker/
├── src/
│   ├── config/           # Pydantic settings
│   ├── consumers/        # RabbitMQ message consumers
│   ├── database/         # SQLAlchemy models & repository
│   ├── generators/       # Script generation (LLM + templates)
│   │   └── templates/    # Fallback template generator
│   ├── redis/            # Redis client for progress tracking
│   ├── storage/          # Local file storage
│   ├── tts/              # Text-to-speech engine (Google Cloud)
│   └── utils/            # Logging utilities
├── tests/                # Unit & integration tests
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

## Features

- **Script Generation**: OpenAI GPT-4o mini with template fallback
- **Text-to-Speech**: Gemini 2.5 Pro TTS (paid) + Google Cloud Standard (free tier)
- **Voice Tiers**: Standard ($4/1M chars) or Gemini Pro (~$0.32/10-min episode)
- **Episode Types**: MONOLOGUE, DUO, GROUP (multi-voice support)
- **Episode Length**: 5-10 minutes (MVP), up to 30 minutes (chunked)
- **Voice Customization**: Gender, accent, speaking speed, vocal pitch
- **Multi-Speaker**: Native support (up to 9 speakers per episode)
- **Retry Logic**: 3 automatic retries with exponential backoff
- **Dead Letter Queue**: Failed jobs routed to DLQ after max retries
- **Real-time Progress**: Redis-based progress tracking for UI updates

## Voice Parameters

| Parameter | Range | TTS Support |
|-----------|-------|-------------|
| Gender | MALE/FEMALE | Voice selection |
| Accent | 6 regions | Voice selection |
| Speaking Speed | 1-10 | Rate: -30% to +30% |
| Vocal Pitch | 1-10 | Pitch: -30Hz to +30Hz |
| Voice Tier | STANDARD/GEMINI_PRO | Quality & cost |

### Supported Accents

| Accent | Google Cloud Voice |
|--------|-------------------|
| United States | en-US voices |
| United Kingdom | en-GB voices |
| Australia | en-AU voices |
| Canada | en-US voices |
| Ireland | en-GB voices |
| India | en-IN voices |

### Voice Tiers

| Tier | Cost | Quality | Use Case |
|------|------|---------|----------|
| Standard | $4/1M chars (~$0.06/ep) | Good | Free tier (2 episodes/month) |
| Gemini 2.5 Pro | $20/1M audio tokens (~$0.32/ep) | Premium | Free tier (1 ep/mo) + All paid |

**Hybrid Free Tier Model:**
- Free users: 1 Gemini Pro + 2 Standard episodes/month
- Paid users: All episodes use Gemini 2.5 Pro TTS

**Gemini 2.5 Pro Features:**
- Native multi-speaker synthesis (up to 9 speakers)
- Non-verbal cues ([sigh], [laugh], etc.)
- Natural language style prompts
- Podcast-optimized audio output

## Environment Variables

```bash
# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
EPISODE_GENERATION_QUEUE=episode_generation
EPISODE_GENERATION_DLQ=episode_generation_dlq

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/auditure

# Redis (for progress tracking)
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM - OpenAI
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4o-mini

# Google Cloud / Gemini TTS
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_CREDENTIALS_PATH=/path/to/credentials.json
GOOGLE_CLOUD_TTS_API_KEY=your_api_key  # For Gemini TTS
TTS_VOICE_TIER=gemini_pro  # Default tier: standard or gemini_pro

# Storage
LOCAL_STORAGE_PATH=./storage
TTS_TEMP_DIR=./temp/tts

# Processing
LOG_LEVEL=INFO
MAX_BOOK_CONTENT_CHARS=100000
```

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Run the worker
python -m src.main
```

## Docker

```bash
# Build
docker build -t auditure-ai-worker .

# Run
docker run -e RABBITMQ_URL=amqp://host:5672 \
           -e DATABASE_URL=postgresql://... \
           -v ./storage:/storage \
           auditure-ai-worker
```

## System Requirements

- Python 3.9+
- ffmpeg (for audio concatenation)
- PostgreSQL 14+
- RabbitMQ 3.11+
- Redis 6+ (for progress tracking)

## Processing Pipeline

```
1. Job received from RabbitMQ (episode_generation queue)
2. Status: PENDING → SCRIPT_GENERATING (progress: 10%)
3. Fetch book content + podcaster from database (progress: 20%)
4. Generate script (OpenAI GPT-4o mini or templates) (progress: 40%)
5. Status: SCRIPT_GENERATED (progress: 60%)
6. Status: AUDIO_GENERATING (progress: 80%)
7. Generate audio (Gemini 2.5 Pro TTS or Standard based on tier)
8. Concatenate segments (if multi-voice, or Standard tier)
9. Save to storage: {userId}/{episodeId}/audio.mp3
10. Status: COMPLETED (progress: 100%)
```

**Note:** Gemini 2.5 Pro TTS has a max output of ~11 minutes. For longer episodes, audio is chunked and stitched.

### Progress Tracking

Progress is stored in Redis at key `job:{episodeId}` as a hash:
- `progress`: Integer percentage (0-100)
- `status`: Current status string
- `updatedAt`: ISO timestamp

Progress updates:
| Stage | Progress | Status |
|-------|----------|--------|
| Started | 10% | SCRIPT_GENERATING |
| Fetching data | 20% | FETCHING_DATA |
| Generating script | 40% | SCRIPT_GENERATING |
| Script complete | 60% | SCRIPT_GENERATED |
| Generating audio | 80% | AUDIO_GENERATING |
| Complete | 100% | COMPLETED |
| Failed | 0% | FAILED |

## Error Handling

- Automatic retry: 3 attempts with exponential backoff (5s, 10s, 20s)
- After max retries: Job moved to DLQ
- Status set to FAILED with error message stored
