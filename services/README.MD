# Auditure Backend Services

The backend is a **Core API** (NestJS) plus an **AI Worker** (Python), decoupled by RabbitMQ. Long book extraction runs separately as a Cloud Run **Job**. This separation keeps business logic in a scale-to-zero API while heavy AI and extraction work runs where it can take as long as it needs.

## Services Overview

### 1. Core API (`/core-api`)

A **NestJS** modular monolith serving the mobile app.

**Modules:**
* **Auth** - Registration, login, OTP email verification, JWT access/refresh tokens (email/password only; no social login or 2FA)
* **Users** - Profiles, settings, push token, preferences
* **Podcasters** - Virtual host creation, personality traits, permanent Gemini voice assignment
* **Books** - PDF/EPUB upload, extraction dispatch, chapter data, deduplication
* **Episodes** - Episode orchestration, audio streaming (range requests), playback progress
* **Feed** - Discovery feed across episodes, books, and podcasters
* **Search** - Unified search (Postgres ILIKE + pg_trgm)
* **Social** - Likes, comments, ratings
* **Subscriptions** - RevenueCat webhook handling and tier mapping (legacy Paystack stubs retained)
* **Notifications** - In-app notifications and Expo push via Redis Streams
* **Redis / RabbitMQ** - Shared caching and messaging infrastructure

**Role (episode generation orchestrator):** When a user creates an episode, the Core API validates the request and quota, creates an `Episode` record, and publishes a message to the `episode_generation` RabbitMQ queue. If the book is not yet extracted, the message is deferred and published once extraction completes.

### 2. AI Worker (`/ai-worker`)

A **Python** service for the compute-heavy generation pipeline.

**Responsibilities:**
* **Script generation** - OpenAI GPT-4.1-mini with a template fallback; chunked generation for long episodes with a three-layer anti-repetition system
* **TTS synthesis** - Gemini 2.5 Flash TTS (premium, native multi-speaker) or Google Cloud Standard TTS (free-tier fallback)
* **Audio assembly** - Concatenate multi-speaker/multi-chunk segments (pydub + ffmpeg), add trailing silence
* **Live transcript timing** - Optional forced alignment (wav2vec2, CPU) producing per-line timestamps; crash-safe and non-vital
* **Progress tracking** - Real-time progress written to Redis for UI polling

**Role:** Consumes from RabbitMQ, reads book/podcaster data via SQLAlchemy, generates and stores audio, updates episode status, consumes quota on success, and notifies the user.

### 3. Book Extractor (Cloud Run Job)

Book extraction runs as a **Cloud Run Job** using the core-api codebase (`src/book-extractor-main.ts`), dispatched by `BookExtractionDispatcher` via the `@google-cloud/run` Jobs API. It downloads the file, extracts text, detects chapters, extracts a cover, runs deduplication/consolidation, and publishes any deferred episode-generation messages.

**Why a Job, not a consumer inside core-api:** core-api is scale-to-zero with CPU throttling. A long-running consumer there gets killed mid-extraction for large books. Each Job execution is independent with its own budget.

## Running the Services

### Core API (NestJS)

```bash
cd services/core-api
npm install
npx prisma migrate dev        # run migrations + generate client
npm run start:dev             # watch mode
npm run build && npm run start:prod   # production
```

### AI Worker (Python)

**Prerequisites:** Local infra running (`infra/docker-compose.yml`) and AI keys configured.

Via Docker Compose (recommended):
```bash
cd infra
# Provide keys in infra/.env: OPENAI_API_KEY, GEMINI_API_KEY, GOOGLE_CLOUD_PROJECT_ID
docker-compose up -d
docker-compose logs -f ai-worker
```

Standalone:
```bash
cd services/ai-worker
python -m venv venv
source venv/bin/activate       # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m src.main
```

## Testing

### Core API
```bash
npm run test          # unit tests
npm run test:watch    # watch mode
npm run test:cov      # coverage
npm run test:e2e      # e2e
```

### AI Worker
```bash
pytest                # or: pytest -v
pytest --cov=src
```

## Messaging Architecture

**RabbitMQ** decouples episode generation from the API.

**Queue:** `episode_generation` (dead-letter queue `episode_generation_dlq`)

**Flow:** Core API (producer) → RabbitMQ → AI Worker (consumer)

### Message Structure

The message references the episode record; the worker fetches full detail from the database.

```json
{
  "episodeId": "660e8400-e29b-41d4-a716-446655440001",
  "attempt": 1
}
```

### Queue Configuration

* **Prefetch:** 1 (one job at a time per worker)
* **Acknowledgment:** Manual (ack after successful processing)
* **Retry:** 3 attempts with exponential backoff (5s, 10s, 20s)
* **Dead-letter queue:** Failed jobs route to the DLQ after max retries

> Notifications use **Redis Streams** rather than RabbitMQ. See the [Notifications README](./core-api/src/notifications/README.md).

## Core API Architecture

### Module Structure

```text
core-api/
├── src/
│   ├── auth/              # Email/password + OTP + JWT (guards, strategies, dto)
│   ├── users/            # User profiles & settings
│   ├── books/            # Upload, extraction dispatch, dedup (workers/, services/)
│   ├── episodes/         # Orchestration, streaming, playback progress
│   ├── podcasters/       # Virtual host management + voice assignment
│   ├── feed/             # Discovery feed
│   ├── search/           # Unified search (ILIKE + pg_trgm)
│   ├── social/           # Likes, comments, ratings
│   ├── subscriptions/    # RevenueCat webhooks (+ legacy Paystack stubs)
│   ├── notifications/    # In-app + Expo push (Redis Streams)
│   ├── common/           # Storage, email, guards, filters, interceptors
│   ├── database/         # Prisma service
│   ├── redis/            # Redis module (cache, progress, playback, streams)
│   └── rabbitmq/         # Episode-generation producer
├── prisma/               # schema.prisma + migrations
├── test/                 # e2e tests, mocks, fixtures
└── book-extractor-main.ts  # Cloud Run Job entry point
```

### Key Technologies

* **Framework:** NestJS (Node.js)
* **ORM:** Prisma with PostgreSQL
* **Validation:** class-validator, class-transformer
* **Auth:** Passport JWT strategy, bcrypt
* **Email:** Resend
* **Message queue:** amqplib (RabbitMQ)
* **Storage:** local filesystem (dev) or Google Cloud Storage (prod), behind a `StorageService` abstraction
* **Caching / streams:** Redis (job progress, playback position, rate limiting, notification streams)

## AI Worker Architecture

### Processing Pipeline

1. Consume message from RabbitMQ `episode_generation` queue
2. Status → `SCRIPT_GENERATING` (progress 10%)
3. Fetch book content + podcaster config via SQLAlchemy (progress 20%)
4. Generate script with OpenAI GPT-4.1-mini (or template fallback) (progress 40%)
5. Status → `SCRIPT_GENERATED` (progress 60%)
6. Status → `AUDIO_GENERATING` (progress 80%)
7. Synthesize audio with Gemini 2.5 Flash TTS (or Standard by tier)
8. Concatenate segments (multi-speaker or multi-chunk)
9. Save audio to storage at `{userId}/{episodeId}/audio.mp3`
10. Status → `COMPLETED` (progress 100%); quota consumed; user notified
11. (Optional) Forced alignment → store `transcriptSegments` for live transcript

**Progress tracking:** Redis hash at key `job:{episodeId}`.

### Project Structure

```text
ai-worker/
├── src/
│   ├── config/           # Pydantic settings
│   ├── consumers/        # RabbitMQ consumers (base + episode)
│   ├── generators/       # Script generation (LLM + templates/)
│   ├── tts/              # TTS engine + alignment/
│   ├── storage/          # Local/GCS file storage
│   ├── database/         # SQLAlchemy client, models, repository
│   ├── redis/            # Progress tracking
│   └── utils/            # Logging
├── scripts/              # One-off ops (e.g. backfill_segments.py)
├── tests/
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

### Key Technologies

* **Python:** 3.9+
* **LLM:** OpenAI GPT-4.1-mini with template fallback
* **TTS:** Gemini 2.5 Flash TTS (via `google-genai`) + Google Cloud Standard TTS
* **Message queue:** pika (RabbitMQ)
* **Database:** SQLAlchemy over PostgreSQL
* **Audio:** pydub, ffmpeg
* **Alignment (optional):** torch + torchaudio (CPU), baked into the Docker image
* **Progress:** Redis

## Environment Variables

### Core API

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://admin:password@localhost:5432/auditure_db

# RabbitMQ
RABBITMQ_URL=amqp://user:password@localhost:5672

# Redis
REDIS_URL=redis://localhost:6379          # prod uses an Upstash URL

# JWT
JWT_SECRET=change-me
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me
JWT_REFRESH_EXPIRES_IN=7d

# Email (Resend)
RESEND_API_KEY=re_xxx
EMAIL_FROM="Auditure <noreply@auditure.app>"
OTP_EXPIRY_MINUTES=10

# Storage
STORAGE_BACKEND=local                     # or 'gcs' in prod
LOCAL_STORAGE_PATH=./storage
GCS_BUCKET_NAME=                          # required when STORAGE_BACKEND=gcs

# Subscriptions (RevenueCat)
REVENUECAT_WEBHOOK_AUTH_HEADER=           # static Authorization header value RC sends

# Book extraction (Cloud Run Job)
GCP_PROJECT_ID=auditure-483611
GCP_REGION=us-central1
BOOK_EXTRACTOR_JOB=book-extractor
```

### AI Worker

```bash
# RabbitMQ
RABBITMQ_URL=amqp://user:password@localhost:5672
EPISODE_GENERATION_QUEUE=episode_generation
EPISODE_GENERATION_DLQ=episode_generation_dlq

# Database
DATABASE_URL=postgresql://admin:password@localhost:5432/auditure_db

# Redis (progress)
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM (OpenAI)
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4.1-mini

# TTS
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project
GOOGLE_APPLICATION_CREDENTIALS=/app/google-credentials.json
GEMINI_API_KEY=your-gemini-key
TTS_VOICE_TIER=standard                   # standard | gemini

# Forced alignment (optional)
ALIGNMENT_ENABLED=true
ALIGNMENT_TIMEOUT_S=600

# Processing
LOG_LEVEL=INFO
MAX_BOOK_CONTENT_CHARS=100000
```

**Note:** If `OPENAI_API_KEY` is unset, the worker falls back to template-based scripts. Gemini TTS requires `GEMINI_API_KEY`; Standard TTS requires Google Cloud credentials.

## Episode Generation Workflow

1. User creates an episode from a book + podcaster in the mobile app (`POST /episodes`).
2. Core API validates auth, permissions, and quota (check-only at creation).
3. Core API creates the `Episode` record and publishes to the `episode_generation` queue. If the book is still extracting, the message is deferred and published when extraction finishes.
4. Core API responds immediately; the client polls status or receives a push notification.
5. AI Worker consumes the message, generates the script, synthesizes audio, and stores the file.
6. On success the worker sets status `COMPLETED`, consumes quota, and delivers a push notification (directly, since core-api may be scaled to zero).
7. Client polls `/episodes/:id` and streams the audio.

### API Surface (selected)

**Auth:** `POST /auth/register`, `/auth/login`, `/auth/verify`, `/auth/refresh`, `/auth/resend-otp`, `GET /auth/me`

**Books:** `POST /books/upload`, `GET /books`, `GET /books/:id`, `GET /books/:id/chapters`, `POST /books/:id/retry-extraction`, `DELETE /books/:id`

**Podcasters:** `POST /podcasters`, `GET /podcasters/my`, `GET /podcasters/public`, `PATCH /podcasters/:id`, `POST /podcasters/:id/rate`

**Episodes:** `POST /episodes`, `POST /episodes/with-file`, `GET /episodes/my`, `GET /episodes/:id`, `GET /episodes/:id/stream`, `GET|POST /episodes/:id/progress`

**Feed & Search:** `GET /feed?tab=`, `GET /feed/section/:id`, `GET /search`, `GET /search/suggestions`

**Notifications:** `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/push-token`

**Subscriptions:** `GET /subscriptions/status`, `POST /subscriptions/rc-webhook`

## Deployment

Both services build from Dockerfiles and deploy to **Google Cloud Run** (`us-central1`) via `.github/workflows/deploy.yml` on push to `master`.

```bash
docker build -t auditure-core-api ./services/core-api
docker build -t auditure-ai-worker ./services/ai-worker
```

**Cloud Run topology:**
* **core-api** - scale-to-zero with CPU throttling (cost savings). Do not run long-lived consumers inside it.
* **ai-worker** - `--min-instances 1 --no-cpu-throttling` (RabbitMQ consumer needs always-on CPU).
* **book-extractor** - Cloud Run Job, dispatched per upload/re-extraction.
* **migrate** - job runs `prisma migrate deploy` after `deploy-core-api`.

All env vars and secrets must be declared in `deploy.yml`, or they get wiped on redeploy.

## Monitoring & Observability

* **Health check:** `GET /health` on core-api.
* **Logging:** NestJS logger (core-api) and Python logging (worker) to stdout, aggregated by Cloud Logging.
* **RabbitMQ:** local management UI at `http://localhost:15672`.
* **Metrics to watch:** queue depth, generation success/failure rate, API latency, DB pool.

## Security Implementation

* Input validation on all DTOs (class-validator)
* Prisma parameterized queries (no string-built SQL)
* Upload hardening: MIME allowlist, magic-byte verification, PDF JavaScript/XFA disabled at parse time, restricted VPC egress on the extractor Job
* JWT auth on user-facing endpoints; webhook signature/secret verification
* CORS restricted to app origins; secrets via env vars and GCP Secret Manager
