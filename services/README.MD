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

## Service Details

This document covers how the two services fit together. Each service's internals, module layout, technology choices, and full environment-variable reference live in its own README:

* **Core API** - modules, layered architecture, and env vars: [`core-api/README.md`](./core-api/README.md), with per-module docs under `core-api/src/*/README.md`.
* **AI Worker** - script generation, chunking, TTS voices, forced alignment, pipeline stages, and env vars: [`ai-worker/README.md`](./ai-worker/README.md).

## Environment Variables

Each service owns its own reference to avoid drift:

* Core API: [`core-api/README.md`](./core-api/README.md#environment-configuration)
* AI Worker: [`ai-worker/README.md`](./ai-worker/README.md#environment-variables)

Locally, the AI Worker's variables are wired through [`infra/docker-compose.yml`](../infra/README.md#ai-worker-configuration).

## Episode Generation Workflow

1. User creates an episode from a book + podcaster in the mobile app (`POST /episodes`).
2. Core API validates auth, permissions, and quota (check-only at creation).
3. Core API creates the `Episode` record and publishes to the `episode_generation` queue. If the book is still extracting, the message is deferred and published when extraction finishes.
4. Core API responds immediately; the client polls status or receives a push notification.
5. AI Worker consumes the message, generates the script, synthesizes audio, and stores the file.
6. On success the worker sets status `COMPLETED`, consumes quota, and delivers a push notification (directly, since core-api may be scaled to zero).
7. Client polls `/episodes/:id` and streams the audio.

### API Reference

Endpoints are documented per module (they are the source of truth):

| Domain | Documentation |
|--------|---------------|
| Auth | [`auth/README.md`](./core-api/src/auth/README.md) |
| Books | [`books/README.md`](./core-api/src/books/README.md) |
| Feed | [`feed/README.md`](./core-api/src/feed/README.md) |
| Search | [`search/README.md`](./core-api/src/search/README.md) |
| Notifications | [`notifications/README.md`](./core-api/src/notifications/README.md) |
| Subscriptions | [`subscriptions/README.md`](./core-api/src/subscriptions/README.md) |
| Podcasters / Episodes | See `core-api/README.md` and `core-api/src/*/*_SERVICE.md` |

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
