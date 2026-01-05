# BookCast Backend Services

The backend is composed of a **Core API** (NestJS) and **AI Workers** (Python), decoupled via RabbitMQ message broker. This architecture ensures scalability, maintainability, and separation of concerns between business logic and computationally intensive AI tasks.

## Services Overview

### 1. Core API (`/core-api`)

A **NestJS** modular monolith that serves as the API Gateway for the mobile application.

**Architecture:** Modular monolith with domain-driven design

**Primary Responsibilities:**
* **Auth Service:** User registration, login (email/password, OAuth), JWT token management, 2FA
* **User Service:** Profile management, settings, preferences
* **Podcaster Service:** Virtual host creation, personality configuration, voice settings
* **Book Ingestion Service:** PDF/EPUB upload, text extraction, URL-based import, optional cloud storage integration
* **Episode Service:** Episode generation orchestration, status tracking, retrieval
* **Feed/Discovery Service:** Trending logic, recommendations, search functionality
* **Social Interaction Service:** Likes, comments, bookmarks, follow relationships

**Role:** Acts as the orchestrator. When a user requests episode generation, this service:
1. Validates the request and user permissions
2. Creates a job record in PostgreSQL with status `pending`
3. Enqueues a message to RabbitMQ
4. Returns a job ID to the client for status polling
5. Updates job status when workers complete processing

### 2. AI Worker (`/ai-worker`)

A **Python** microservice designed for heavy computational AI tasks.

**Responsibilities:**
* **LLM Script Generation:** Generate podcast scripts using HuggingFace API (Mistral-7B) with template fallback
* **TTS Audio Synthesis:** Convert scripts to audio using Microsoft Edge TTS (free, unlimited)
* **Audio Processing:** Concatenate multiple speaker segments, apply ffmpeg processing
* **Progress Tracking:** Update Redis with real-time progress for UI polling
* **Storage Management:** Save final audio files to local storage (S3-ready abstraction)

**Role:** Listens to RabbitMQ queue, processes generation requests, updates job status via SQLAlchemy, and reports progress to Redis.

## Running the Services

### Core API (NestJS)

```bash
cd services/core-api

# Install dependencies (if not done from root)
npm install

# Run database migrations
npm run migration:run

# Development Mode (Watch Mode)
npm run start:dev

# Production Build
npm run build
npm run start:prod

# Debug Mode
npm run start:debug
```

### AI Worker (Python)

**Prerequisites:** Ensure `infra/docker-compose.yml` is running and environment variables are configured.

**Option 1: Via Docker Compose (recommended)**
```bash
cd infra

# Create .env file with HuggingFace API key (optional but recommended)
echo "HUGGINGFACE_API_KEY=your_key_here" > .env

# Start all services including AI worker
docker-compose up -d

# View AI worker logs
docker-compose logs -f ai-worker
```

**Option 2: Run Standalone**
```bash
cd services/ai-worker

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
.\venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run worker
python -m src.main
```

## Testing

### Core API

```bash
# Unit Tests
npm run test

# Watch mode
npm run test:watch

# e2e Tests
npm run test:e2e

# Test Coverage
npm run test:cov
```

### AI Worker

```bash
# Run pytest
pytest tests/

# With coverage
pytest --cov=src tests/

# Verbose output
pytest -v tests/
```

## Messaging Architecture

We use **RabbitMQ** for asynchronous job processing (NFR-5).

**Queue:** `episode_generation_queue`

**Flow:** Core API (Producer) → RabbitMQ → AI Worker (Consumer)

### Message Structure

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "bookId": "660e8400-e29b-41d4-a716-446655440001",
  "chapterIds": ["770e8400-e29b-41d4-a716-446655440002"],
  "episodeType": "dual-host",
  "podcasterIds": [
    "880e8400-e29b-41d4-a716-446655440003",
    "990e8400-e29b-41d4-a716-446655440004"
  ],
  "settings": {
    "voiceSpeed": 1.0,
    "style": "conversational",
    "includeIntro": true,
    "includeOutro": true
  }
}
```

### Queue Configuration

* **Prefetch Count:** 1 (process one job at a time per worker)
* **Acknowledgment:** Manual (ack after successful processing)
* **Retry Policy:** 3 attempts with exponential backoff
* **Dead Letter Queue:** Failed jobs move to DLQ for manual review

## Core API Architecture

### Module Structure

```text
core-api/
├── src/
│   ├── auth/                 # Authentication & Authorization (FR-1, FR-2)
│   │   ├── guards/          # JWT, OAuth guards
│   │   ├── strategies/      # Passport strategies
│   │   └── dto/             # Login, signup DTOs
│   ├── users/                # User Management (FR-3)
│   │   ├── entities/        # User entity
│   │   └── users.service.ts
│   ├── books/                # Book Ingestion (FR-9 to FR-12)
│   │   ├── parsers/         # PDF/EPUB parsers
│   │   ├── extractors/      # Text extraction logic
│   │   └── books.service.ts
│   ├── episodes/             # Episode Orchestration (FR-16 to FR-19)
│   │   ├── entities/        # Episode, Job entities
│   │   ├── episodes.controller.ts
│   │   └── episodes.service.ts
│   ├── podcasters/           # Virtual Host Management (FR-4 to FR-8)
│   │   ├── entities/        # Podcaster entity
│   │   ├── templates/       # Personality templates
│   │   └── podcasters.service.ts
│   ├── feed/                 # Content Discovery (FR-20, FR-24, FR-25)
│   │   ├── feed.controller.ts
│   │   └── trending.service.ts
│   ├── social/               # Social Features (FR-22, FR-23)
│   │   ├── likes/
│   │   ├── comments/
│   │   └── follows/
│   ├── common/               # Shared utilities
│   │   ├── guards/          # Auth guards
│   │   ├── interceptors/    # Logging, transform
│   │   ├── filters/         # Exception filters
│   │   └── decorators/      # Custom decorators
│   └── config/               # Configuration modules
│       ├── database.config.ts
│       ├── rabbitmq.config.ts
│       └── storage.config.ts
├── test/                     # e2e tests
└── migrations/               # Database migrations
```

### Key Technologies

* **Framework:** NestJS (Node.js)
* **ORM:** Prisma with PostgreSQL
* **Validation:** class-validator, class-transformer
* **Authentication:** Passport.js (JWT, Google OAuth, Apple OAuth)
* **Security:** Helmet, CORS, rate limiting
* **Documentation:** Swagger/OpenAPI
* **Message Queue:** amqplib (RabbitMQ client)
* **Storage:** Local storage with S3-ready abstraction
* **Caching:** Redis (job progress, playback progress, rate limiting)

## AI Worker Architecture

### Processing Pipeline

1. **Consume Message** from RabbitMQ `episode_generation` queue
2. **Update Status** to `SCRIPT_GENERATING` (progress: 10%)
3. **Fetch Data** from PostgreSQL via SQLAlchemy (book content, podcaster configs) (progress: 20%)
4. **Generate Script** using HuggingFace API (Mistral-7B) or template fallback (progress: 40%)
5. **Update Status** to `SCRIPT_GENERATED` (progress: 60%)
6. **Update Status** to `AUDIO_GENERATING` (progress: 80%)
7. **Synthesize Audio** using Microsoft Edge TTS (multi-voice support)
8. **Concatenate Audio** segments if multi-speaker episode
9. **Save to Storage** at `{userId}/{episodeId}/audio.mp3`
10. **Update Status** to `COMPLETED` (progress: 100%)
11. **Acknowledge Message** to RabbitMQ

**Progress Tracking:** Real-time progress stored in Redis at key `job:{episodeId}` for UI polling.

### Project Structure

```text
ai-worker/
├── src/
│   ├── config/               # Pydantic settings configuration
│   ├── consumers/            # RabbitMQ message consumers
│   │   ├── base_consumer.py  # Abstract consumer with retry logic
│   │   └── episode_consumer.py
│   ├── generators/           # LLM script generation
│   │   ├── llm_client.py     # HuggingFace API client
│   │   ├── script_generator.py
│   │   └── templates/        # Fallback template generator
│   ├── tts/                  # Text-to-speech (Edge TTS)
│   │   └── engine.py
│   ├── storage/              # Local file storage
│   │   └── local_storage.py
│   ├── database/             # SQLAlchemy ORM
│   │   ├── client.py         # Database connection
│   │   ├── models.py         # SQLAlchemy models (matches Prisma schema)
│   │   └── repository.py     # Data access layer
│   ├── redis/                # Redis client for progress tracking
│   └── utils/                # Logging utilities
├── tests/                    # Unit & integration tests
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

### Key Technologies

* **Python:** 3.9+
* **LLM:** HuggingFace Inference API (Mistral-7B-Instruct) with template fallback
* **TTS:** Microsoft Edge TTS (free, unlimited usage)
* **Message Queue:** pika (RabbitMQ client)
* **Database:** SQLAlchemy ORM with PostgreSQL
* **Storage:** Local file storage (S3-ready abstraction)
* **Audio Processing:** pydub, ffmpeg
* **Progress Tracking:** Redis for real-time UI updates

## Environment Variables

### Core API (.env)

```bash
# Server
NODE_ENV=development
PORT=3000

# Database (NFR-6)
DATABASE_URL=postgresql://admin:password@localhost:5432/bookcast_db
DB_SSL=false

# RabbitMQ (NFR-5)
RABBITMQ_URL=amqp://user:password@localhost:5672
RABBITMQ_QUEUE=episode_generation_queue

# Redis (optional caching)
REDIS_URL=redis://localhost:6379

# JWT Authentication (SR-2)
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OAuth (SR-1 - PKCE for mobile)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-secret

# Cloud Storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET=bookcast-audio-production

# Security (NFR-10, NFR-11)
BCRYPT_ROUNDS=12
ENCRYPTION_KEY=your-aes-256-key

# Rate Limiting (SR-4)
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

### AI Worker (.env)

```bash
# RabbitMQ
RABBITMQ_URL=amqp://user:password@localhost:5672
EPISODE_GENERATION_QUEUE=episode_generation
EPISODE_GENERATION_DLQ=episode_generation_dlq

# Database
DATABASE_URL=postgresql://admin:password@localhost:5432/bookcast_db

# LLM (HuggingFace)
HUGGINGFACE_API_KEY=your-huggingface-api-key
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# Redis (for progress tracking)
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage
LOCAL_STORAGE_PATH=./storage
TTS_TEMP_DIR=./temp/tts

# Processing
LOG_LEVEL=INFO
MAX_BOOK_CONTENT_CHARS=8000
MAX_RETRIES=3
RETRY_DELAY_BASE=5
```

**Note:** The AI Worker uses Microsoft Edge TTS which requires no API key. If `HUGGINGFACE_API_KEY` is not set, the worker falls back to template-based script generation.

## Communication Flow

### Episode Generation Workflow

1. **User Action:** User requests episode generation via mobile app
2. **API Request:** Mobile app sends `POST /episodes` with configuration
3. **Validation:** Core API validates request (auth, permissions, quotas)
4. **Job Creation:** Core API creates job record in PostgreSQL with status `pending`
5. **Queue Message:** Core API publishes message to RabbitMQ
6. **Immediate Response:** Core API returns job ID and polling endpoint to client
7. **Worker Pickup:** AI Worker consumes message from queue
8. **Status Update:** Worker updates job status to `processing`
9. **LLM Generation:** Worker generates podcast script using LLM
10. **TTS Synthesis:** Worker converts script to audio using TTS
11. **Audio Upload:** Worker uploads audio file to S3/GCP Storage
12. **Completion:** Worker updates job status to `completed` with audio URL
13. **Notification:** Core API sends push notification to user (optional)
14. **Client Poll:** Mobile app polls `/episodes/:id/status` and retrieves result

### API Specifications (Section 8)

**Authentication:**
* `POST /auth/signup` - User registration
* `POST /auth/login` - Email/password login
* `POST /auth/oauth/google` - Google OAuth
* `POST /auth/oauth/apple` - Apple OAuth
* `POST /auth/2fa/enable` - Enable 2FA
* `POST /auth/refresh` - Refresh access token

**Books:**
* `POST /books` - Upload PDF/EPUB (API-2)
* `GET /books/:id` - Get book details (API-2)
* `GET /books` - List user's books
* `DELETE /books/:id` - Delete book

**Podcasters:**
* `POST /podcasters` - Create virtual host (API-3)
* `GET /podcasters` - List podcasters
* `PUT /podcasters/:id` - Update podcaster
* `DELETE /podcasters/:id` - Delete podcaster

**Episodes:**
* `POST /episodes` - Generate episode (API-4)
* `GET /episodes/:id` - Get episode details (API-4)
* `GET /episodes/:id/status` - Check generation status
* `POST /episodes/:id/regenerate` - Regenerate episode
* `DELETE /episodes/:id` - Delete episode

**Feed & Discovery:**
* `GET /feed` - Get personalized feed (API-5)
* `GET /feed/trending` - Get trending episodes
* `GET /search` - Search episodes

**Social:**
* `POST /episodes/:id/like` - Like episode
* `POST /episodes/:id/comments` - Add comment (API-6)
* `POST /podcasters/:id/follow` - Follow podcaster

## Monitoring & Observability

### Health Checks

**Core API:**
```bash
GET /health
GET /health/db
GET /health/mq
```

**AI Worker:**
* Logs processing metrics to stdout
* Exposes metrics endpoint for Prometheus (optional)

### Logging

* **Structured Logging:** Winston (Core API), Python logging (Worker)
* **Log Levels:** ERROR, WARN, INFO, DEBUG
* **Critical Events:** Login attempts, episode generation, errors (SR-3)

### Metrics to Monitor

* API response times (NFR-3: < 500ms average)
* Queue depth and processing rate
* Episode generation success/failure rate
* Database connection pool status
* Storage upload success rate

### RabbitMQ Management

Monitor queue health at: `http://localhost:15672`
* Check message rate
* Monitor consumer count
* Alert on queue buildup

## Deployment

### Docker Support

Both services include Dockerfiles for containerization:

```bash
# Build Core API
docker build -t bookcast-core-api ./services/core-api

# Build AI Worker
docker build -t bookcast-ai-worker ./services/ai-worker
```

### Kubernetes Deployment

Supports horizontal pod autoscaling (NFR-4):

```yaml
# Example HPA for Core API
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: core-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: core-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Security Implementation

* **Input Validation:** All DTOs validated with class-validator (NFR-12)
* **SQL Injection Protection:** TypeORM parameterized queries
* **XSS Protection:** Helmet middleware
* **CSRF Protection:** CSRF tokens for state-changing operations
* **Rate Limiting:** Express-rate-limit on all endpoints (SR-4)
* **CORS:** Configured for mobile app origins only
* **Secrets Management:** Environment variables, never committed to repo