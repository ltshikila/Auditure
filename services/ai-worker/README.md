# Auditure AI Worker

Python microservice for AI-powered podcast generation. Handles script generation (via OpenAI GPT-4o mini with template fallback) and text-to-speech conversion (via Google Cloud TTS + Gemini 2.5 TTS).

**SDK:** Uses the official `google-genai` SDK for Gemini TTS integration.

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
- **Chapter-Aware Scripts**: Episode introductions specify exact chapters being covered
- **Chunked Generation**: Long scripts (>1800 words) split into multiple chunks with topic tracking
- **Anti-Repetition**: Automatic extraction of covered topics and examples to prevent repetition
- **Text-to-Speech**: Gemini 2.5 Flash TTS (premium) + Google Cloud Standard (free tier)
- **Voice Tiers**: Standard ($4/1M chars) or Gemini (~$0.15/10-min episode)
- **Episode Types**: MONOLOGUE, DUO, GROUP (multi-voice support)
- **Episode Length**: 5-10 minutes (MVP), up to 30 minutes (chunked)
- **Voice Customization**: Gender, accent, speaking speed, vocal pitch
- **Multi-Speaker**: Native support (up to 9 speakers per episode)
- **Dynamic WPM**: Script length adjusts based on podcaster speaking speed
- **Natural Interruptions**: Backchannels and interjections based on chaos factor
- **Trailing Silence**: 1 second of silence at episode end for natural fade-out
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

| Tier | Input Cost | Output Cost | ~Cost/10-min | Quality |
|------|------------|-------------|--------------|---------|
| Standard | $4/1M chars | — | ~$0.024 | Good |
| Gemini Flash | $0.50/1M tokens | $10/1M audio tokens | ~$0.15 | Premium |
| Gemini Pro | $1.00/1M tokens | $20/1M audio tokens | ~$0.30 | Highest |

**Gemini Audio Token Calculation:**
- Audio tokens = duration (seconds) × 25 tokens/second
- 10-minute episode = 600s × 25 = 15,000 audio tokens
- Cost: (15,000 / 1M) × $10 = **$0.15** per 10-min episode

**Reference:** [Gemini TTS Pricing](https://ai.google.dev/gemini-api/docs/pricing)

**Hybrid Free Tier Model:**
- Free users: 1 Gemini + 2 Standard episodes/month
- Paid users: All episodes use Gemini 2.5 Flash TTS

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
| `[chuckling]` | Light laughter | "[chuckling] That's a good point." |
| `[uhm]` / `[uh]` | Thinking hesitation | "[uhm] I'm not sure about that." |
| `[whispering]` | Quieter delivery | "[whispering] Here's the secret..." |
| `[clearing throat]` | Throat clear | "[clearing throat] Anyway, moving on..." |

**Reference:** [Gemini TTS Prompting Tips](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#prompting_tips)

### Gemini TTS Features

- **Native multi-speaker synthesis** (up to 9 speakers per request)
- **Non-verbal cues** ([sigh], [laugh], [uhm], etc.)
- **Natural language style prompts** (per episode type)
- **Podcast-optimized audio output** (24kHz WAV)
- **Regional accent support** (en-US, en-GB, en-AU, en-IN)
- **Base64 audio decoding** (handled automatically by SDK wrapper)
- **1 second trailing silence** for natural episode endings

### Dynamic Words-Per-Minute (WPM)

Script length automatically adjusts based on the podcaster's **speaking speed** setting to ensure episodes meet duration targets.

**Formula:** `WPM = 130 + (speaking_speed × 10)`

| Speaking Speed | WPM | 5-8 min Target Words |
|----------------|-----|----------------------|
| 1 (slow) | 140 | 910 words |
| 4 (moderate) | 170 | 1,105 words |
| 5 (normal) | 180 | 1,170 words |
| 7 (fast) | 200 | 1,300 words |
| 10 (very fast) | 230 | 1,495 words |

This ensures that faster-speaking podcasters get more words in their scripts, while slower speakers get fewer words, maintaining consistent episode duration.

### Natural Interruptions & Backchannels

Multi-speaker episodes (DUO, GROUP) include verbal cues for natural conversation flow. The frequency and intensity are controlled by the podcaster's **chaos factor** setting.

#### DEBATE Episodes

| Chaos Factor | Style | Frequency | Examples |
|--------------|-------|-----------|----------|
| 1-3 | Polite | 2-3 times | "Actually, I see your point, but—" |
| 4-6 | Engaged | 4-6 times | "Wait, wait—I have to push back—" |
| 7-10 | Passionate | 7+ times | "—I completely disagree—", "[laughing] Oh come on—" |

#### DISCUSSION Episodes

| Chaos Factor | Style | Frequency | Examples |
|--------------|-------|-----------|----------|
| 1-3 | Gentle | Rare | "Mm-hmm", "I see", "That's interesting..." |
| 4-6 | Warm | 3-4 times | "Oh interesting!", "Yes! And building on that—" |
| 7-10 | Energetic | 5+ times | "Yes yes yes!", "Ha! So true—" |

#### LECTURE Episodes
No interruptions (monologue format).

### Script Generation

#### Chapter-Aware Content Scope

Scripts automatically include specific chapter information in the introduction based on user selection:

| Content Coverage | Example Introduction |
|------------------|---------------------|
| Single Chapter | "Today we're covering **Chapter 3: The Power of Habit**" |
| Multiple Chapters | "Today we're covering **Chapters 1-5** from..." |
| Non-consecutive | "Today we're covering **Chapters 1, 3, and 7**..." |
| Entire Book | "Today we're covering **the entire book**" |

This ensures listeners know exactly what content is being discussed.

#### Chunked Generation for Long Episodes

For target scripts exceeding 1,800 words, the generator uses **chunked generation**:

1. Script is split into multiple chunks (~1,300 words each)
2. Each chunk has position-specific instructions (intro/middle/conclusion)
3. Context from previous chunks is passed forward
4. Topics and examples are tracked to prevent repetition

#### Anti-Repetition System

Between chunks, the system extracts and tracks:

| Tracked Item | Example |
|--------------|---------|
| **Topics** | "the power of compound interest" |
| **Examples** | "the restaurant scenario with the waiter" |
| **Quotes** | "time is money" |
| **References** | "Warren Buffett", "Apple Inc." |

Subsequent chunks are explicitly instructed to avoid repeating these elements and use fresh examples.

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
