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

| Parameter | Range | Google Standard | Gemini TTS |
|-----------|-------|-----------------|------------|
| Gender | MALE/FEMALE | Voice selection | Voice selection |
| Accent | 6 regions | Voice ID mapping | language_code |
| Speaking Speed | 1-10 | Rate: 0.7-1.3 | Best-match voice |
| Vocal Pitch | 1-10 | Pitch: ±10 semitones | Best-match voice |
| Voice Tier | standard/gemini | — | — |

### Supported Accents

| Accent | Google Standard | Gemini TTS |
|--------|-----------------|------------|
| United States | en-US-Standard-* | en-US (GA) |
| United Kingdom | en-GB-Standard-* | en-GB (Preview) |
| Australia | en-AU-Standard-* | en-AU (Preview) |
| India | en-IN-Standard-* | en-IN (GA) |
| Canada | en-US-Standard-* | en-US |
| Ireland | en-GB-Standard-* | en-GB |

**Reference:**
- [Google Cloud TTS Voices](https://docs.cloud.google.com/text-to-speech/docs/voices)
- [Gemini TTS Languages](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#available_languages)

### Voice Tiers

| Tier | Cost | Quality | Use Case |
|------|------|---------|----------|
| Standard | $4/1M chars (~$0.06/ep) | Good | Free tier (2 episodes/month) |
| Gemini Pro | ~$0.32/10-min episode | Premium | Free tier (1 ep/mo) + All paid tiers |

**Reference:** [Gemini TTS Pricing](https://ai.google.dev/gemini-api/docs/pricing)

**Hybrid Free Tier Model:**
- Free users: 1 Gemini Pro + 2 Standard episodes/month
- Paid users: All episodes use Gemini 2.5 Pro TTS

### Gemini TTS Voice Selection

Gemini TTS uses **30 distinct voices** with unique characteristics. Voice selection algorithm:

1. **Filter by gender** (MALE/FEMALE from podcaster config)
2. **Map accent to language_code** (en-US, en-GB, en-AU, en-IN)
3. **Select best-match voice** based on speakingSpeed + vocalPitch

| Voice | Gender | Style | Speed | Pitch |
|-------|--------|-------|-------|-------|
| Kore | FEMALE | Firm | 5 | 5 |
| Charon | MALE | Informative | 5 | 3 |
| Fenrir | MALE | Excitable | 8 | 6 |
| Zephyr | FEMALE | Bright | 6 | 8 |
| Leda | FEMALE | Youthful | 5 | 9 |
| Puck | MALE | Upbeat | 7 | 7 |
| Gacrux | FEMALE | Mature | 4 | 2 |
| Algenib | MALE | Gravelly | 4 | 2 |
| ... | ... | ... | ... | ... |

**Full 30 voices:** See `src/tts/gemini_tts_client.py`

**Reference:** [Gemini TTS Voices](https://ai.google.dev/gemini-api/docs/speech-generation)

### TTS Markup Tags

Scripts include Gemini TTS markup tags for natural speech synthesis:

| Tag | Effect | Example |
|-----|--------|---------|
| `[short pause]` | ~250ms pause | "So [short pause] here's the thing..." |
| `[medium pause]` | ~500ms pause | "That's interesting. [medium pause] Let me think." |
| `[long pause]` | ~1s+ pause | "And then [long pause] everything changed." |
| `[sigh]` | Sighing sound | "[sigh] This is frustrating." |
| `[laughing]` | Laughter | "Wait, really? [laughing] That's hilarious!" |
| `[uhm]` | Thinking hesitation | "[uhm] I'm not sure about that." |
| `[excited]` | Excited delivery | "[excited] This is amazing!" |

**Reference:** [Gemini TTS Prompting Tips](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#prompting_tips)

### Gemini TTS Features

- **Native multi-speaker synthesis** (up to 9 speakers per request)
- **Non-verbal cues** ([sigh], [laugh], [uhm], etc.)
- **Natural language style prompts** (per episode type)
- **Podcast-optimized audio output** (24kHz WAV)
- **Regional accent support** (en-US, en-GB, en-AU, en-IN)

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

# Google Cloud TTS (Standard voices)
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_CREDENTIALS_PATH=/path/to/credentials.json

# Gemini 2.5 Pro TTS (Multi-speaker)
GEMINI_API_KEY=your_gemini_api_key

# TTS Configuration
TTS_VOICE_TIER=gemini  # Options: standard, gemini

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
