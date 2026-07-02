# Auditure AI Worker

Python microservice for AI-powered podcast generation. Handles script generation (via OpenAI GPT-4.1-mini with template fallback), text-to-speech conversion (via Google Cloud TTS + Gemini 2.5 Flash TTS), and optional forced alignment for live transcript timing.

**SDK:** Uses the official `google-genai` SDK for Gemini TTS integration.

---

## Understanding the Architecture

### Why Python (Not Node.js)?

The core-api is Node.js. Why not keep the AI worker in the same language?

| Factor | Node.js | Python |
|--------|---------|--------|
| **AI/ML ecosystem** | Growing (OpenAI SDK exists) | Mature (OpenAI, Google AI, all Python-first) |
| **Audio processing** | Limited options | pydub, librosa, soundfile (battle-tested) |
| **TTS SDKs** | Available but often ports | Native, well-documented, up-to-date |
| **Type safety** | TypeScript (excellent) | Type hints (optional, improving) |
| **Team familiarity** | Web devs know JS | AI/ML engineers know Python |

**We chose Python because:**
1. **First-class AI support** - OpenAI, Google Gemini SDKs are Python-native
2. **Audio libraries** - pydub for audio manipulation is simple and reliable
3. **Examples/documentation** - Most AI tutorials and samples are Python
4. **Hiring** - ML engineers expect Python

**Trade-off:** Two languages means:
- Two deployment pipelines (Docker works for both)
- Two sets of dependencies to audit
- Context switching when debugging across services

This is an acceptable trade-off for specialized AI workloads.

### Why Chunked Generation?

The LLM has token limits and quality degrades for very long outputs:

```
SINGLE GENERATION (problematic)        CHUNKED GENERATION (our approach)
──────────────────────────────         ────────────────────────────────
"Generate a 5,000-word script"         Chunk 1: "Generate intro (1,300 words)"
           │                                   │
           ▼                                   ▼
Model struggles with coherence         Clean intro, tracked topics
Quality drops in later sections                │
May hit token limits                   Chunk 2: "Generate middle, avoid: [topics]"
                                               │
                                               ▼
                                       Fresh examples, builds on intro
                                               │
                                       Chunk 3: "Generate conclusion"
                                               │
                                               ▼
                                       Strong ending, no repetition
```

**Why chunk at 1,800 words?**
- LLM output limits: ~4K tokens ≈ 3,000 words max
- Quality sweet spot: Models produce better content under 1,500 words
- Buffer for variance: Target 1,300 words/chunk, allows some overflow

**Anti-repetition (three layers):**

1. **Outline-first planning (primary).** Before the chunk loop, one cheap LLM call
   (`_plan_segments`) partitions the episode's focus (including any editor's notes)
   into N distinct beats — one per chunk. Each chunk's prompt then says "THIS part
   covers ONLY: <beat>". This is what stops two chunks re-arguing the same thesis;
   without it, every chunk received the identical scope and looped on it. Each chunk
   also gets only its *slice* of the emotional arc (`build_chunk_arc_position`):
   first chunk = opening, middle chunks = escalation/tension, last = climax +
   resolution. Injecting the full 5-act arc into every chunk made each chunk run a
   complete mini-episode. If planning fails, generation proceeds with layer 2 only.

2. **Topic ledger (legacy fallback).** Between chunks we extract and pass forward
   topics, examples, and quotes already used ("compound interest", "the restaurant
   scenario"). Regex-based, so it only blocks reuse of specific nouns/examples —
   not thesis-level looping. Kept as the fallback when planning fails.

3. **Repetition gate (backstop).** After the final script is assembled we score
   exact-phrase repetition over 5-word shingles (`_repetition_score`). If the
   redundant-shingle ratio ≥ 0.03 or any single phrase appears ≥ 10 times, one
   targeted rewrite pass runs (`_reduce_repetition`). The rewrite is only kept if
   it measurably reduces repetition AND stays above the length floor — it can never
   make a script worse. Thresholds were calibrated on real production scripts: the
   known-looping episode scored 0.048 / x18, the worst healthy one 0.011 / x9.

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
│   │   └── alignment/    # Forced alignment for live transcript timing
│   └── utils/            # Logging utilities
├── scripts/              # One-off ops scripts (e.g. backfill_segments.py)
├── tests/                # Unit & integration tests
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

## Features

- **Script Generation**: OpenAI GPT-4.1-mini with template fallback
- **Chapter-Aware Scripts**: Episode introductions specify exact chapters being covered
- **Chunked Generation**: Long scripts (>1800 words) split into multiple chunks, each assigned a distinct beat via outline-first planning
- **Anti-Repetition**: Three layers — outline-first segment planning, topic-ledger fallback, and a post-assembly repetition gate with a targeted rewrite pass (see "Why Chunked Generation?")
- **Text-to-Speech**: Gemini 2.5 Flash TTS (premium) + Google Cloud Standard (free tier)
- **Live Transcript Timing**: Optional self-hosted forced alignment (wav2vec2, CPU) produces per-line timestamps for highlight/auto-scroll/tap-to-seek. Non-vital and crash-safe — never blocks generation
- **Voice Tiers**: Standard ($4/1M chars) or Gemini (~$0.15/10-min episode)
- **Episode Types**: MONOLOGUE, DUO (GROUP planned post-MVP)
- **Episode Length**: Free: 5-10 min, Paid: 5-30 min (chunked for episodes > 11 min)
- **Voice Customization**: Gender, accent, speaking speed, vocal pitch, voice model
- **Permanent Voice Assignment**: Each podcaster has a stored Gemini voice for consistency
- **Multi-Speaker**: Native support (up to 9 speakers per episode)
- **Dynamic WPM**: Script length adjusts based on podcaster speaking speed
- **Natural Interruptions**: Backchannels and interjections based on chaos factor
- **Natural Thinking Moments**: Speakers pause and hesitate when challenged with tough points
- **Batched TTS**: Multi-turn batching reduces API calls by ~80% (4 turns/batch max)
- **Trailing Silence**: 1 second of silence at episode end for natural fade-out
- **Retry Logic**: 3 automatic retries with exponential backoff
- **Dead Letter Queue**: Failed jobs routed to DLQ after max retries
- **Real-time Progress**: Redis-based progress tracking for UI updates

## Voice Parameters

| Parameter | Range | Google Standard | Gemini TTS |
|-----------|-------|-----------------|------------|
| Gender | MALE/FEMALE | Voice selection | Voice selection |
| Accent | 4 regions | Voice ID mapping | language_code |
| Speaking Speed | 1-10 | Rate: 0.7-1.3 | Voice selection score |
| Vocal Pitch | 1-10 | Pitch: ±10 semitones | Voice selection score |
| Voice Model | 6 presets | — | Style preference bonus |
| Voice Tier | standard/gemini | — | — |
| **geminiVoiceName** | 30 voices | — | **Stored voice (permanent)** |

### Supported Accents

| Accent | Google Standard | Gemini TTS |
|--------|-----------------|------------|
| United States | en-US-Standard-* | en-US (GA) |
| United Kingdom | en-GB-Standard-* | en-GB (Preview) |
| Australia | en-AU-Standard-* | en-AU (Preview) |
| India | en-IN-Standard-* | en-IN (GA) |

*Note: Canada and Ireland are supported as fallbacks (mapped to en-US and en-GB respectively) but not exposed in the UI.*

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
- Free users: 1 Gemini + 2 Standard episodes/month (up to 10 min each)
- Paid users: 20 (Starter) or 50 (Pro) unified episodes/month using Gemini 2.5 Flash TTS (up to 30 min each)

### Gemini TTS Voice Selection

Gemini TTS uses **30 distinct voices** with unique characteristics.

#### Permanent Voice Assignment
Each podcaster has a **permanently assigned** Gemini voice stored in the database (`geminiVoiceName`). This ensures:
- **Consistency**: Same podcaster always uses the same voice
- **Determinism**: Voice doesn't vary between episodes
- **Performance**: No recalculation needed at generation time

The voice is computed by the core-api when a podcaster is created or when voice-related fields are updated.

#### Voice Selection Algorithm (used at podcaster creation)
1. **Filter by gender** (MALE/FEMALE from podcaster config)
2. **Map accent to language_code** (en-US, en-GB, en-AU, en-IN)
3. **Calculate score** for each voice:
   - Base: Euclidean distance for speakingSpeed + vocalPitch
   - Bonus: Style preference from voiceModel (CONVERSATIONAL→Easy-going, ENERGETIC→Bright, etc.)
4. **Select voice** with lowest score → stored as `geminiVoiceName`

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

### Personality Traits (4-Tier System)

Each podcaster has 5 personality traits on a 1-10 scale. All traits use a proportional 4-tier system so every value produces a meaningfully different result:

| Trait | 1-3 | 4-6 | 7-8 | 9-10 |
|-------|-----|-----|-----|------|
| **Tone** | Calm, measured, thoughtful | Balanced, conversational | Energetic, enthusiastic, dynamic | ELECTRIC — bursting with passion, infectious excitement |
| **Communication** | Storytelling, narrative-focused | Balanced stories & analysis | Analytical, fact-driven | Rapid-fire analysis — courtroom lawyer on espresso |
| **Humor** | Serious, professional | Occasional light humor | Comedic, entertaining | Relentlessly funny — roasts everything, drops one-liners |
| **Depth** | Accessible, surface-level | Moderately detailed | Deep philosophical exploration | Obsessively deep — rabbit holes, obscure references |
| **Chaos** | Structured, organized | Semi-structured with tangents | Spontaneous, free-flowing | UNHINGED — chaotic, provocative, wildly unpredictable |

### Natural Interruptions & Backchannels

Multi-speaker episodes (DUO) include verbal cues for natural conversation flow. The frequency and intensity are controlled by the podcaster's **chaos factor** setting.

#### DISCUSSION Episodes

| Chaos Factor | Style | Frequency | Examples |
|--------------|-------|-----------|----------|
| 1-3 | Gentle | Rare | "Mm-hmm", "I see", "That's interesting..." |
| 4-6 | Warm | 3-4 times | "Oh interesting!", "Yes! And building on that—" |
| 7-8 | Energetic | 5+ times | "Yes yes yes!", "Ha! So true—" |
| 9-10 | Explosive | 7+ times | "Oh PLEASE—", "[laughing] That's RIDICULOUS!", "No no no—" |

#### LECTURE Episodes
No interruptions (monologue format).

### DEBATE Episodes (Enhanced Format)

Debate episodes use a comprehensive **DebateConfig** system that randomizes speaker positions, outcomes, and dynamics to create entertaining debates where listeners question both sides.

#### Randomized Elements

| Element | Description | Options |
|---------|-------------|---------|
| **Host Position** | Randomly assigned stance | ADVOCATE (40%), CRITIC (25%), MODERATE (25%), DEVILS_ADVOCATE (10%) |
| **Guest Positions** | Contrasts with host | If host advocates → guests likely critics (and vice versa) |
| **Guest Chaos Factors** | Random 1-10 per guest | Independent of host's chaos factor |
| **Debate Outcome** | How the debate resolves | ADVOCATE_WINS, CRITIC_WINS, SYNTHESIS, AGREE_TO_DISAGREE, UNEXPECTED_ALLIANCE |
| **Formality Level** | Based on host chaos ±1 | 1-3 formal, 4-6 conversational, 7-10 heated |

#### Position Types

| Position | Role | Behavior |
|----------|------|----------|
| **ADVOCATE** | Supports book's ideas | Finds value, practical applications, defends thesis |
| **CRITIC** | Challenges book's ideas | Questions assumptions, points out flaws, demands evidence |
| **MODERATE** | Balanced perspective | Sees merit in both sides, seeks nuance and middle ground |
| **DEVILS_ADVOCATE** | Provocateur | Intentionally argues against to test ideas |

#### Formality Spectrum

| Formality | Style | Structure | Techniques |
|-----------|-------|-----------|------------|
| **1-3 (Formal)** | Oxford-style debate | Opening statements → Evidence → Rebuttals → Resolution | Steel-manning, evidence-based arguments, graceful concessions |
| **4-6 (Conversational)** | Friends who disagree | Opening hook → Back-and-forth → Peak tension → Landing | Quick acknowledgments, real-world examples, strategic concessions |
| **7-8 (Heated)** | Entertainment-first | Explosive opening → Escalating clash → Climax → Resolution | Visceral examples, strategic provocations, humor as weapon |
| **9-10 (Explosive)** | All-out verbal warfare | START hot, STAY hot — no cooling down | Personal jabs, mocking laughs, stubborn refusal to concede anything |

#### Interaction Style by Combined Chaos

The interaction intensity is determined by averaging the host's formality level with guest chaos factors:

| Combined Chaos | Interruptions | Style |
|----------------|---------------|-------|
| 1-3 | 2-3 times | Measured, polite interjections |
| 4-6 | 4-6 times | Engaged, "Sorry to interrupt, but—" |
| 7-8 | 7+ times | Heated, rapid-fire exchanges |
| 9-10 | CONSTANT | Explosive — shouting over each other, personal jabs, mocking laughs, neither backs down |

#### Debate Outcomes

| Outcome | Description |
|---------|-------------|
| **ADVOCATE_WINS** | Pro-book position emerges more convincing, but critic's concerns acknowledged |
| **CRITIC_WINS** | Skepticism proves well-founded, advocates concede key points |
| **SYNTHESIS** | Both sides find unexpected common ground |
| **AGREE_TO_DISAGREE** | Mutual respect but fundamental disagreement remains |
| **UNEXPECTED_ALLIANCE** | A critic is genuinely won over by a compelling argument |

**Chaos-aware outcomes:** At chaos 9-10, the outcome is heavily biased (90%) toward **AGREE_TO_DISAGREE** — but instead of polite respect, neither speaker concedes an inch. The ending feels like the argument could restart at any moment.

#### Entertainment Goal

The primary goal of debates is to make listeners **question both positions**:
- Both sides must present strong, convincing arguments
- Listeners should change their mind multiple times during the debate
- Neither side should be obviously "right"
- Passion and entertainment value are prioritized

#### Guest Personality Flavors

Each guest receives a randomized personality flavor based on their position:

| Position | Possible Flavors |
|----------|------------------|
| ADVOCATE | "enthusiastic supporter", "thoughtful believer", "practical implementer", "passionate advocate" |
| CRITIC | "skeptical academic", "pragmatic questioner", "contrarian thinker", "analytical doubter" |
| MODERATE | "balanced mediator", "nuanced observer", "diplomatic bridge-builder", "open-minded explorer" |

**Example Log Output:**
```
Generated debate config: host=advocate, guests=[('GUEST', 'critic', 7)], outcome=synthesis, formality=8
```

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

1. An upfront planning call (`_plan_segments`) divides the episode's focus into one distinct beat per chunk (editor's notes constrain the plan when present)
2. Script is split into multiple chunks (~1,300 words each), each owning its assigned beat
3. Each chunk gets position-specific instructions AND only its slice of the emotional arc (opening / escalation / climax+resolution) — never the full arc
4. Context from previous chunks is passed forward
5. Topics and examples are tracked as a fallback when planning fails

#### Anti-Repetition System

Three layers (see "Why Chunked Generation?" above for rationale):

| Layer | Mechanism | Catches |
|-------|-----------|---------|
| **Segment plan** | One beat per chunk, distinct by construction | Thesis-level looping (chunks re-arguing the same point) |
| **Topic ledger** | Regex-extracted topics/examples/quotes passed forward | Reuse of specific nouns and examples (fallback layer) |
| **Repetition gate** | 5-gram shingle scoring on the final script + one conditional rewrite pass | Whatever slips through — only applied if measurably better and length-safe |

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
OPENAI_MODEL=gpt-4.1-mini

# Google Cloud TTS (Standard voices)
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_CREDENTIALS_PATH=/path/to/credentials.json

# Gemini 2.5 Flash TTS (Multi-speaker)
GEMINI_API_KEY=your_gemini_api_key

# TTS Configuration
TTS_VOICE_TIER=gemini  # Options: standard, gemini

# Storage
LOCAL_STORAGE_PATH=./storage
TTS_TEMP_DIR=./temp/tts

# Forced alignment (live transcript timing) — optional, non-vital
ALIGNMENT_ENABLED=true      # set false to disable entirely
ALIGNMENT_TIMEOUT_S=600     # hard cap on the alignment subprocess
TORCH_HOME=/app/.cache/torch  # where the baked wav2vec2 model is cached (set in Dockerfile)

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
- ffmpeg (for audio concatenation and alignment audio decode)
- PostgreSQL 14+
- RabbitMQ 3.11+
- Redis 6+ (for progress tracking)
- torch + torchaudio (CPU-only) — for forced alignment. Installed via the Dockerfile from PyTorch's CPU index (not in `requirements.txt`, to avoid the ~2GB CUDA wheel). Imported lazily, so the rest of the worker runs fine without them.

## Processing Pipeline

```
1. Job received from RabbitMQ (episode_generation queue)
2. Status: PENDING → SCRIPT_GENERATING (progress: 10%)
3. Fetch book content + podcaster from database (progress: 20%)
4. Generate script (OpenAI GPT-4.1-mini or templates) (progress: 40%)
5. Status: SCRIPT_GENERATED (progress: 60%)
6. Status: AUDIO_GENERATING (progress: 80%)
7. Generate audio (Gemini 2.5 Flash TTS or Standard based on tier)
8. Concatenate segments (if multi-voice, or Standard tier)
9. Save to storage: {userId}/{episodeId}/audio.mp3
10. Status: COMPLETED (progress: 100%) → quota consumed, user notified
11. (Optional) Forced alignment → store transcriptSegments for live transcript
```

**Note:** Gemini 2.5 Flash TTS has a max output of ~11 minutes. For longer episodes, audio is chunked and stitched.

## Live Transcript Timing (Forced Alignment)

Powers the mobile transcript's live tracking (highlight the spoken line, auto-scroll, tap-to-seek). Since we already have the exact script text, this is **forced alignment**, not transcription — no large ASR model or per-use API cost.

**How it works**
- Uses torchaudio's English `WAV2VEC2_ASR_BASE_960H` (~360MB, CPU) — small enough to run within the worker's existing 2Gi budget. The model is **baked into the Docker image** so runtime needs no download/egress.
- After audio is generated, the script is split into sentence-sized lines, decoded to 16kHz mono via ffmpeg, and aligned in **15s windows** (bounds memory; wav2vec2 self-attention is O(T²)). Per-word timings are collapsed to per-line `{text, start, end}` (seconds) and stored on `episodes.transcriptSegments` (JSONB).
- The mobile app turns sync on **per-episode** when segments are present; episodes without them fall back to a static transcript.

**Crash-safe by design (non-vital feature)**
- Runs **after** the episode is `COMPLETED`, quota is consumed, and the user is notified. A crash/timeout here can never re-run TTS — the idempotency guard skips already-completed episodes on redelivery.
- Alignment runs in an **isolated subprocess** with a hard timeout (`ALIGNMENT_TIMEOUT_S`, default 600s). Any failure (error, hang, OOM) → no segments stored, episode unaffected.
- Master switch: set `ALIGNMENT_ENABLED=false` to disable entirely.

**Backfilling existing episodes**

Re-align already-generated episodes that predate this feature (or any that failed alignment). Run from the `ai-worker` directory with the same env as the worker:

```bash
python -m scripts.backfill_segments              # up to 100 episodes
python -m scripts.backfill_segments --limit 500  # process more
python -m scripts.backfill_segments --dry-run    # list candidates only
```

It only touches COMPLETED episodes with audio + script but no segments yet, and reuses the same crash-safe aligner.

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
