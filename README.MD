# Auditure

Auditure is a mobile-first creator platform that turns books into podcast-style audio. Users upload a book (PDF or EPUB), configure virtual "podcasters" with distinct personalities and voices, and generate multi-speaker episodes (monologue or duo conversation) using an LLM for scripting and text-to-speech for audio. The AI podcaster is the product; books are the fuel.

Launched on Google Play (Android) in April 2026. iOS is on a waitlist.

## System Architecture

Auditure follows a **Mobile-Client / Cloud-Backend** split:

* **Frontend:** React Native (Expo) app for Android and iOS.
* **Core API:** NestJS modular monolith handling auth, books, podcasters, episodes, feed, search, social, subscriptions, and notifications.
* **AI Worker:** Python service that generates scripts and synthesizes audio. It runs as an always-on RabbitMQ consumer.
* **Book Extractor:** A Cloud Run **Job** (same codebase as core-api) that extracts text and chapters from uploaded files. Kept separate because core-api is scale-to-zero and would kill a long extraction mid-run.
* **Data & infra:** PostgreSQL (Cloud SQL in prod), RabbitMQ, Redis (Upstash in prod), Google Cloud Storage for audio and book files.

Production runs on **Google Cloud Run** (`us-central1`, project `auditure-483611`), not Kubernetes.

## Project Structure

This is an NPM workspaces monorepo.

```text
Auditure/
├── apps/
│   ├── mobile-app/          # React Native client (Expo)
│   └── website/             # Marketing/landing site (Vite)
├── services/
│   ├── core-api/            # NestJS backend (auth, books, episodes, feed, ...)
│   │   └── src/
│   │       ├── auth/          # Email/password + OTP + JWT
│   │       ├── users/         # User profiles & settings
│   │       ├── podcasters/    # Virtual host management
│   │       ├── books/         # Book upload, extraction dispatch, dedup
│   │       ├── episodes/      # Episode orchestration, streaming, progress
│   │       ├── feed/          # Discovery feed (episodes/books/podcasters)
│   │       ├── search/        # Unified search (Postgres ILIKE + pg_trgm)
│   │       ├── social/        # Likes, comments, ratings
│   │       ├── subscriptions/ # RevenueCat webhooks (+ legacy Paystack)
│   │       ├── notifications/ # In-app + Expo push (Redis Streams)
│   │       ├── redis/         # Caching, progress, playback position
│   │       └── rabbitmq/      # Episode-generation producer
│   └── ai-worker/           # Python service (LLM scripting + TTS)
├── infra/
│   └── docker-compose.yml   # Local dev infrastructure
└── package.json             # Root workspace configuration
```

## Getting Started

### Prerequisites

* Node.js v18+
* Docker Desktop (for local PostgreSQL, RabbitMQ, Redis)
* Python 3.9+ (for the AI worker)
* API keys: OpenAI (scripting), Gemini (TTS), Google Cloud credentials (Standard TTS + GCS in prod)

### Bootstrap

1. **Install dependencies** from the repo root:

```bash
npm install
```

2. **Start local infrastructure** (PostgreSQL, RabbitMQ, Redis):

```bash
docker-compose -f infra/docker-compose.yml up -d
```

3. **Run migrations** and generate the Prisma client:

```bash
cd services/core-api
npx prisma migrate dev
```

4. **Run the Core API:**

```bash
npm run start:core-api   # from repo root
```

5. **Configure AI keys.** Create `infra/.env` (used by the docker-compose ai-worker) or `services/ai-worker/.env`:

```bash
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project   # for Standard TTS
```

6. **Run the AI Worker:**

Via Docker (recommended):
```bash
docker-compose -f infra/docker-compose.yml up -d ai-worker
```

Standalone (development):
```bash
cd services/ai-worker
python -m venv venv
source venv/bin/activate   # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m src.main
```

7. **Run the mobile app:**

```bash
npm run start:mobile   # from repo root
```

## Tech Stack

### Frontend
* React Native + TypeScript, Expo (managed workflow), Expo Router
* `expo-av` for audio playback (background audio, mini-player, lock-screen controls)
* State via React Context (Auth, Playback)
* `react-native-purchases` (RevenueCat) for subscriptions
* PostHog (analytics) and Sentry (crash reporting)

### Backend (Core API)
* NestJS with Prisma ORM over PostgreSQL
* JWT auth (access + refresh with rotation), bcrypt password hashing
* Email/OTP verification via Resend
* RabbitMQ producer for episode generation
* Redis for caching, job progress, playback position, and notification streams
* Storage abstraction: local filesystem (dev) or Google Cloud Storage (prod)

### AI Processing (AI Worker)
* Python 3.9+
* **Scripting:** OpenAI GPT-4.1-mini with a template fallback; chunked generation and a three-layer anti-repetition system for long episodes
* **TTS:** Gemini 2.5 Flash TTS (premium, multi-speaker) with Google Cloud Standard TTS as the free-tier fallback
* Multi-speaker synthesis (up to 9 voices), dynamic words-per-minute, natural interruptions/backchannels driven by a chaos factor
* Optional self-hosted forced alignment (wav2vec2, CPU) for live transcript timing; non-vital and crash-safe

## Key Features

* **Auth:** Email/password with OTP email verification, JWT access/refresh tokens (rotation on refresh). No social login or 2FA yet.
* **Virtual podcasters:** Configurable name, avatar, personality (5 traits on a 1-10 scale), and a permanently assigned Gemini voice for consistency.
* **Book ingestion:** Upload PDF/EPUB (32MB limit, magic-byte verified). Three-tier chapter detection (TOC, dynamic pattern, regex fallback), OCR for scanned PDFs, and cover extraction (Google Books + PDF/EPUB fallback).
* **Book deduplication:** Quality-scored canonical selection so shared books converge on the best copy.
* **Flexible content selection:** Full book, specific chapters, or page ranges.
* **Episode types:** Monologue and duo conversation. Themes include lecture, discussion, and debate. (Group is planned post-MVP.)
* **Live transcript:** Karaoke-style highlight, auto-scroll, and tap-to-seek when alignment timing is available.
* **Discovery feed & search:** Curated feed across episodes, books, and podcasters; unified search with fuzzy matching.
* **Social:** Likes, comments, ratings, play counts.
* **Notifications:** In-app plus Expo push (FCM/APNs), delivered via Redis Streams.
* **Subscriptions:** Free, Starter, Pro tiers via Google Play Billing (RevenueCat).

## Subscription Plans

Three tiers (Free, Starter at $9.99/mo, Pro at $24.99/mo) billed through **RevenueCat + Google Play Billing**. Purchases happen in-app via the RevenueCat SDK; webhooks keep the Core API in sync. The legacy Paystack integration is being retired.

Tier limits, product mapping, webhook auth, and the comp-access model are documented in the [Subscriptions README](./services/core-api/src/subscriptions/README.md).

## Documentation

* [Mobile App](./apps/mobile-app/README.md) - Expo setup, routing, playback, EAS builds
* [Backend Services](./services/README.md) - Core API + AI Worker architecture
* [Infrastructure](./infra/README.md) - Local Docker Compose setup
* [Core API](./services/core-api/README.md) and its per-module READMEs (auth, books, feed, search, notifications, subscriptions)
* [AI Worker](./services/ai-worker/README.md) - scripting, TTS, voices, alignment

## Security

* JWT access tokens (15 min) with rotating refresh tokens (7 days)
* bcrypt password hashing; email verification required before activation
* Input validation via class-validator on all DTOs
* Prisma parameterized queries (no string-built SQL)
* Upload defenses: MIME allowlist, magic-byte verification, PDF JavaScript/XFA disabled at parse time, VPC egress restricted on the extractor Job
* Secrets via environment variables and GCP Secret Manager (never committed)
* TLS in transit; encryption at rest on managed data stores

Details: [auth security](./services/core-api/src/auth/README.md#security-considerations) and [book upload security](./services/core-api/src/books/README.md#upload-security).

## Branching Strategy (GitFlow)

| Branch | Purpose |
|--------|---------|
| `master` | Production. Deploys to Cloud Run on push. |
| `develop` | Integration branch. Default branch on GitHub. |
| `feature/*` | New features. Branch from `develop`, PR back to `develop`. |
| `release/*` | Release prep. Branch from `develop`, merge to `master` and `develop`. |
| `hotfix/*` | Urgent production fixes. Branch from `master`, merge to `master` and `develop`. |

CI runs tests on pushes and PRs to both `develop` and `master`. Deployment triggers only on push to `master`, and DB migrations (`prisma migrate deploy`) apply automatically after the core-api deploy. Branch protection is not enforced (GitHub Pro limitation on private repos); conventions are followed manually.

## Contributing

1. Branch from `develop` with a descriptive name (`feature/add-voice-preview`, `fix/audio-playback-bug`).
2. Keep commits atomic and use conventional commit messages: `type(scope): description` where type is one of `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
3. Ensure lint and tests pass before opening a PR.

### Linting & Tests

TypeScript (mobile app & core API):
```bash
npm run lint
npm run lint:fix
npm run test
```

Python (AI worker):
```bash
cd services/ai-worker
flake8 src/
mypy src/
pytest
```

Feature PRs target `develop`; release and hotfix PRs target `master`.

## Helpful Commands

```bash
npx tree-node-cli -I "node_modules|.git|dist|.expo|.vscode" --dirs-first
```

## License

Proprietary. All rights reserved.
