# Auditure Core API

Backend API service for the Auditure application - Transform books into podcast-style audio content.

## Overview

The Core API is built with NestJS and provides authentication, book management, text extraction, and integration points for the Auditure ecosystem.

### Key Features

- **JWT Authentication** - Secure user authentication with refresh tokens
- **Email Verification** - OTP-based email verification system
- **Book Management** - Upload and manage PDF/EPUB books
- **Virtual Podcasters** - Create and customize AI podcasters with 17 configurable traits and permanent voice assignment
- **Episode Generation** - Create podcast episodes from books with multiple formats (monologue, duo, group)
- **Audio Streaming** - Range-request audio streaming for episode playback
- **Async Processing** - Background processing with RabbitMQ for extraction and generation
- **Smart Chapter Detection** - Three-tier detection: TOC-based, dynamic pattern, and regex fallback
- **Flexible Storage** - Local storage with S3-ready abstraction
- **Search & Discovery** - Full-text search, trending content, and filtering
- **Redis Caching** - Job progress tracking, playback progress, rate limiting
- **Social Features** - Comments, likes, shares, ratings, and engagement tracking
- **Comprehensive Testing** - 83 tests with 90%+ coverage

## Project Structure

```
services/core-api/
├── src/
│   ├── auth/                    # Authentication module
│   │   ├── dto/                 # Data transfer objects
│   │   ├── guards/              # Auth guards (JWT)
│   │   ├── strategies/          # Passport strategies
│   │   └── README.md            # Auth documentation
│   ├── books/                   # Books module
│   │   ├── dto/                 # DTOs for book operations
│   │   ├── services/            # Text extraction service
│   │   ├── workers/             # Background workers
│   │   └── README.md            # Books documentation
│   ├── subscriptions/             # Subscriptions module (Paystack)
│   │   ├── subscriptions.service.ts # Subscription business logic
│   │   ├── subscriptions.controller.ts # API endpoints
│   │   ├── paystack.service.ts  # Paystack API wrapper
│   │   └── README.md            # Subscriptions documentation
│   ├── common/                  # Shared services
│   │   ├── email.service.ts     # Email/OTP service
│   │   ├── storage.service.ts   # File storage abstraction
│   │   ├── storage.controller.ts# File serving endpoint (/api/storage/*)
│   │   └── guards/              # Rate limiting guards
│   ├── database/                # Prisma integration
│   ├── redis/                   # Redis caching module
│   │   ├── redis.module.ts      # Global Redis module
│   │   └── redis.service.ts     # Progress, playback, rate limiting
│   └── rabbitmq/                # Message queue service
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Database migrations
├── test/
│   ├── mocks/                   # Test mocks
│   ├── fixtures/                # Test data factories
│   └── setup.ts                 # Global test config
└── TESTING.md                   # Testing documentation
```

## Quick Start

### Prerequisites

- Node.js >= 18
- Docker & Docker Compose (for infrastructure services)
- Resend account (for transactional emails)

### Installation

```bash
# Start infrastructure services (PostgreSQL, Redis, RabbitMQ)
cd ../../infra
docker-compose up -d
cd ../services/core-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### Infrastructure Services

All infrastructure services are managed from the `infra/` directory:

```bash
# Start services
cd infra && docker-compose up -d

# Stop services
cd infra && docker-compose down

# View logs
docker logs auditure_db
docker logs auditure_redis
docker logs auditure_mq
```

| Service | Container | Port |
|---------|-----------|------|
| PostgreSQL | auditure_db | 5432 |
| Redis | auditure_redis | 6379 |
| RabbitMQ | auditure_mq | 5672, 15672 |

### Running the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

The API will be available at `http://localhost:3000`

## Environment Configuration

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/auditure?schema=public"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret-key"
JWT_REFRESH_EXPIRES_IN="7d"

# Email (Resend API)
EMAIL_FROM="Auditure <noreply@auditure.app>"
RESEND_API_KEY="re_xxxxxxxxxxxx"

# OTP Configuration
OTP_EXPIRY_MINUTES="10"

# Storage
STORAGE_BACKEND="local"
LOCAL_STORAGE_PATH="./storage"

# RabbitMQ (optional)
RABBITMQ_URL="amqp://localhost:5672"

# Redis (for caching)
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Server
PORT="3000"
```

## API Documentation

### Authentication Endpoints

See [Auth Service Documentation](src/auth/README.md) for detailed API documentation.

**Base URL:** `/auth`

- `POST /register` - Register new user
- `POST /login` - User login
- `POST /verify` - Verify email with OTP
- `POST /refresh` - Refresh access token
- `POST /resend-otp` - Resend verification code
- `GET /me` - Get current user profile (protected)

### Books Endpoints

See [Books Service Documentation](src/books/README.md) for detailed API documentation.

**Base URL:** `/books`

- `POST /upload` - Upload book file
- `GET /` - Get all user's books
- `GET /:id` - Get single book
- `GET /:id/text` - Get extracted text
- `GET /:id/chapters` - Get book chapters
- `DELETE /:id` - Delete book
- `POST /:id/retry-extraction` - Retry failed extraction

**Public APIs for Microservices:**
- `GET /api/book/:id` - Get book for episode generation
- `GET /api/search` - Search books
- `GET /api/popular` - Get popular books

### Podcasters Endpoints

See [Podcasters Service Documentation](src/podcasters/PODCASTERS_SERVICE.md) for detailed API documentation.

**Base URL:** `/podcasters`

- `POST /` - Create podcaster (17 configurable traits)
- `GET /my` - Get user's podcasters
- `GET /public` - Browse public podcasters (paginated, filtered)
- `GET /trending` - Get trending podcasters
- `GET /:id` - Get single podcaster
- `PATCH /:id` - Update podcaster
- `DELETE /:id` - Delete podcaster
- `POST /:id/like` - Like podcaster
- `POST /:id/rate` - Rate podcaster (1-5 stars)

### Episodes Endpoints

See [Episodes Service Documentation](src/episodes/EPISODES_SERVICE.md) for detailed API documentation.

**Base URL:** `/episodes`

- `POST /` - Create episode from book + podcaster
- `POST /with-file` - Upload book and create episode in one request
- `GET /my` - Get user's episodes
- `GET /public` - Browse public episodes
- `GET /:id` - Get episode with book/podcaster details
- `GET /:id/stream` - Stream audio (range request support)
- `GET /:id/progress` - Get playback position
- `POST /:id/progress` - Save playback position
- `POST /:id/like` - Like episode
- `POST /:id/comments` - Add comment

### Subscriptions Endpoints

See [Subscriptions Documentation](src/subscriptions/README.md) for detailed API documentation.

**Base URL:** `/subscriptions`

- `GET /status` - Get subscription status and usage
- `POST /checkout` - Initialize Paystack checkout (or re-enable existing)
- `POST /manage` - Get subscription management info
- `POST /cancel` - Cancel subscription (non-renewing)
- `POST /reactivate` - Re-enable a cancelled subscription
- `POST /cleanup-duplicates` - Clean up duplicate Paystack subscriptions
- `POST /webhook` - Handle Paystack webhooks
- `GET /callback` - Payment callback (HTML redirect to app)

### Storage Endpoints

**Base URL:** `/api/storage`

- `GET /*` - Serve files from storage (cover images, etc.)
  - Example: `/api/storage/{userId}/{bookId}/cover.jpg`
  - Returns: File content with appropriate Content-Type
  - Supports: jpg, jpeg, png, gif, webp, pdf, txt, mp3, wav, ogg

## Testing

Comprehensive test suite with unit tests, integration tests, and negative testing.

### Run Tests

```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Specific module
npm test -- auth
npm test -- books
```

### Test Statistics

- **Total Tests:** 83 passing, 1 skipped
- **Test Suites:** 5 suites
- **Coverage:**
  - Auth Service: 98.7% statements, 100% functions
  - Books Service: 100% statements, 100% functions
  - Controllers: 95%+ statements

See [Testing Documentation](TESTING.md) for comprehensive testing guide.

## Database

### Prisma Schema

The application uses Prisma ORM with PostgreSQL:

```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  password          String
  firstName         String
  lastName          String
  isEmailVerified   Boolean  @default(false)
  otpCode           String?
  otpExpiry         DateTime?
  refreshToken      String?
  books             Book[]
}

model Book {
  id                String       @id @default(uuid())
  userId            String
  title             String
  author            String?
  sourceType        SourceType   // PDF, EPUB, URL
  fileStorageKey    String
  extractionStatus  ExtractionStatus @default(PENDING)
  fullTextKey       String?
  chapters          Chapter[]
  user              User @relation(...)
}

model Chapter {
  id              String @id @default(uuid())
  bookId          String
  chapterNumber   Int
  title           String?
  extractedText   String? @db.Text
  book            Book @relation(...)
}
```

### Migrations

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset
```

## Architecture

### Understanding NestJS Module Architecture

NestJS organizes code into **modules** - self-contained units that group related functionality. This isn't just for organization; it enables powerful patterns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AppModule (Root)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  AuthModule  │  │ BooksModule  │  │ FeedModule   │  │ SearchModule │    │
│  │  - Controller│  │  - Controller│  │  - Controller│  │  - Controller│    │
│  │  - Service   │  │  - Service   │  │  - Service   │  │  - Service   │    │
│  │  - Guards    │  │  - Workers   │  │  - Cache     │  │  - DTOs      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Shared Modules (Global)                          │   │
│  │  DatabaseModule │ RedisModule │ RabbitMQModule │ StorageModule        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why modules matter:**
- **Lazy loading**: Modules load only when needed, improving startup time
- **Testing isolation**: Mock dependencies per-module without affecting others
- **Feature flags**: Enable/disable entire features by including/excluding modules
- **Team scaling**: Different teams can own different modules

### Request Flow (Layered Architecture)

Every request follows the same pattern through layers. Understanding this helps you debug issues and know where to add code:

```
HTTP Request
     │
     ▼
┌─────────────┐     Validates input, handles HTTP concerns
│ Controller  │     (routes, status codes, headers)
└──────┬──────┘
       │
       ▼
┌─────────────┐     Business logic lives here
│  Service    │     (rules, calculations, orchestration)
└──────┬──────┘
       │
       ▼
┌─────────────┐     Data access (Prisma queries)
│ Repository  │     We use Prisma directly in services
└──────┬──────┘     (no separate repository layer for simplicity)
       │
       ▼
┌─────────────┐
│  Database   │
└─────────────┘
```

**Why layered architecture?**
- **Separation of concerns**: Each layer has one job
- **Testability**: Mock the layer below to test in isolation
- **Flexibility**: Swap database without changing business logic

### Service Layer

| Service | Responsibility | Key Dependencies |
|---------|---------------|------------------|
| **AuthService** | User authentication, JWT tokens, OTP verification | JwtService, EmailService |
| **BooksService** | Book CRUD, triggers extraction jobs | StorageService, RabbitMQService |
| **FeedService** | Home feed aggregation, caching | RedisService, DatabaseService |
| **SearchService** | Full-text search across entities | DatabaseService |
| **NotificationsService** | In-app + push notifications | RedisService, ExpoPushService |
| **EpisodesService** | Episode CRUD, playback progress | RedisService, StorageService |
| **PodcastersService** | Podcaster management, voice assignment | DatabaseService |
| **SubscriptionsService** | Subscription lifecycle, Paystack integration | PaystackService, DatabaseService |
| **PaystackService** | Paystack API wrapper (plans, transactions, subscriptions) | Paystack API |
| **EmailService** | Email delivery and OTP generation | Resend API |
| **StorageService** | File storage abstraction | Local/S3 backends |
| **RabbitMQService** | Async job processing | amqplib |
| **TextExtractionService** | PDF/EPUB text extraction | pdf-parse, pdfjs-dist |
| **DatabaseService** | Prisma client wrapper | @prisma/client |

### Background Workers

**Why background workers?**

Some operations are too slow for HTTP request/response:
- PDF extraction: 5-60 seconds depending on file size
- Episode generation: 30-120 seconds for AI processing

If we did these synchronously:
1. HTTP request would timeout (browsers timeout at ~30s)
2. Server thread blocked, can't serve other users
3. User stares at loading spinner

Instead, we use the **task offloading pattern**:

**Book extraction (Cloud Run Jobs):**
```
User uploads book → API returns immediately with "PENDING" status
                         ↓
              BookExtractionDispatcher → Cloud Run Jobs API
                         ↓
                  Job execution spins up
                         ↓
                  Runs src/book-extractor-main.js with BOOK_ID env
                         ↓
                  Updates status to "COMPLETED"
                         ↓
                  Publishes pending episode_generation messages
                         ↓
                  Client polls or gets push notification
```

**Episode generation (RabbitMQ + ai-worker):**
```
Episode record created → episode_generation queue → ai-worker
                                                          ↓
                                              Script → TTS → stored
```

- **BookExtractionWorker** (`workers/book-extraction.worker.ts`) - Exposes
  `extractBook(bookId, {attempt, maxRetries})` that's invoked by the Cloud Run Job
  entry point. Downloads the file, extracts text, detects chapters, writes results,
  and queues any pending episodes.
- **BookExtractionDispatcher** (`services/book-extraction-dispatcher.service.ts`) -
  Triggers a new Cloud Run Job execution from core-api when a book is uploaded or
  re-extraction is requested.

**Why Jobs for book extraction, not Services with RabbitMQ:** core-api is scale-to-zero
(for cost). A RabbitMQ consumer inside a scale-to-zero container gets killed
mid-extraction for large books. Jobs are independent executions with their own 24h
budget — they run to completion regardless of core-api's lifecycle.

### Message Queue

RabbitMQ integration for async processing:
- Job retry with exponential backoff (5s, 10s, 20s)
- Dead letter queue (DLQ) for failed jobs after max retries
- Persistent messages (survive broker restart)
- Acknowledgments (jobs aren't lost if worker crashes)

**When to use RabbitMQ vs direct processing:**
| Scenario | Approach |
|----------|----------|
| < 500ms operation | Direct (synchronous) |
| User doesn't need immediate result | Queue it |
| Operation might fail and needs retry | Queue it |
| Need to scale processing independently | Queue it |

## Development

### Code Style

```bash
# Format code
npm run format

# Lint
npm run lint
```

### Building

```bash
# Build for production
npm run build

# Build output location
dist/
```

### Database Management

```bash
# Open Prisma Studio
npx prisma studio

# View database
# Navigate to http://localhost:5555
```

## Deployment

### Production Checklist

- [ ] Set strong JWT secrets
- [ ] Configure production database
- [ ] Set up email service (Resend recommended)
- [ ] Configure S3 for file storage
- [ ] Set up RabbitMQ cluster
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Set up monitoring (Sentry, DataDog, etc.)
- [ ] Configure rate limiting
- [ ] Set up backup strategy

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

```bash
# Build image
docker build -t auditure-api .

# Run container
docker run -p 3000:3000 --env-file .env auditure-api
```

## Monitoring & Logging

### Health Check Endpoint

```http
GET /health
```

Returns application health status.

### Logging

The application uses NestJS built-in logger:

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('ServiceName');
logger.log('Info message');
logger.error('Error message');
logger.warn('Warning message');
```

## Security

### Implemented Security Measures

| Measure | Why It Matters |
|---------|---------------|
| **Password hashing (bcrypt)** | Bcrypt uses adaptive hashing with salt rounds. As computers get faster, increase rounds. Unlike SHA256, bcrypt is intentionally slow, making brute-force attacks impractical. |
| **JWT token authentication** | Stateless auth enables horizontal scaling - any server can validate the token without session storage. Trade-off: can't instantly revoke tokens (hence short 15m expiry). |
| **Email verification required** | Prevents fake account spam, ensures we can contact users, and verifies email ownership before granting access. |
| **OTP expiration (10 min)** | Time-limited codes reduce the attack window if an email is compromised. Balance between security and user convenience. |
| **Input validation (class-validator)** | Validates data shape and constraints at the API boundary. Rejects malformed requests before they reach business logic. |
| **SQL injection protection (Prisma)** | Prisma uses parameterized queries by default. Never concatenate user input into SQL strings - Prisma handles escaping. |
| **File type validation** | MIME type + extension checking prevents upload of executable files disguised as PDFs. Defense in depth with storage scanning. |
| **File size limits (50MB)** | Prevents denial-of-service via large uploads that exhaust disk/memory. Balance between usability and protection. |

### Security Anti-Patterns to Avoid

```typescript
// BAD: String concatenation (SQL injection risk)
const query = `SELECT * FROM users WHERE email = '${email}'`;

// GOOD: Prisma's parameterized queries
const user = await prisma.user.findUnique({ where: { email } });

// BAD: Storing passwords in plain text
user.password = req.body.password;

// GOOD: Hash before storing
user.password = await bcrypt.hash(req.body.password, 10);

// BAD: Trusting client-provided file types
const type = req.body.fileType; // User can lie!

// GOOD: Validate file magic bytes
const type = await fileTypeFromBuffer(buffer);
```

### Recommended Additional Security

- [ ] Rate limiting (express-rate-limit) - Prevent brute-force attacks
- [ ] Helmet.js for security headers - XSS, clickjacking protection
- [ ] CORS configuration - Restrict which domains can call the API
- [ ] Request size limits - Prevent memory exhaustion attacks
- [ ] API key authentication for service-to-service - Don't rely only on network isolation
- [ ] Audit logging - Track who did what for compliance and debugging
- [ ] IP whitelisting for admin endpoints - Defense in depth

## Performance Optimization

- **Async Processing** - Heavy operations run in background workers
- **Indexing** - Database indexes on frequently queried fields
- **Caching** - Consider Redis for frequently accessed data
- **Pagination** - Implement for large result sets
- **Connection Pooling** - Configured in Prisma

## Troubleshooting

### Common Issues

**Database Connection Issues:**
```bash
# Check database connection
npx prisma db pull

# Verify DATABASE_URL is correct
echo $DATABASE_URL
```

**Migration Issues:**
```bash
# Reset database (DEV ONLY)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate
```

**File Upload Issues:**
- Check STORAGE_BACKEND environment variable
- Verify LOCAL_STORAGE_PATH directory exists and is writable
- Ensure file size is under 50MB limit

**RabbitMQ Connection:**
```bash
# Verify RabbitMQ is running
docker ps | grep rabbitmq

# Check RABBITMQ_URL is correct
echo $RABBITMQ_URL
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new features
4. Ensure all tests pass (`npm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

### Commit Message Convention

```
type(scope): subject

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## API Versioning

Current version: `v1`

All endpoints are prefixed with `/api/v1` in production.

## Dependencies

### Core Dependencies

- **@nestjs/core** - NestJS framework
- **@nestjs/jwt** - JWT authentication
- **@nestjs/passport** - Authentication middleware
- **@prisma/client** - Database ORM
- **bcrypt** - Password hashing
- **class-validator** - Input validation
- **multer** - File upload handling
- **pdf-parse** - PDF text extraction
- **epub-parser** - EPUB text extraction
- **amqplib** - RabbitMQ client
- **resend** - Email sending via Resend API

### Development Dependencies

- **@nestjs/testing** - Testing utilities
- **jest** - Test framework
- **supertest** - HTTP testing
- **ts-jest** - TypeScript support for Jest
- **prisma** - Prisma CLI
- **typescript** - TypeScript compiler

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- Email: support@auditure.app
- Discord: [Auditure Community](https://discord.gg/auditure)
- Documentation: [docs.auditure.app](https://docs.auditure.app)
- Issues: [GitHub Issues](https://github.com/auditure/issues)

## Roadmap

**Completed:**
- [x] OCR for scanned PDFs (tesseract.js)
- [x] TOC-based chapter detection with page numbers
- [x] Dynamic pattern detection for non-standard chapter names (RULE, LAW, etc.)
- [x] Cover image extraction (Google Books API + PDF fallback)
- [x] Social features (likes, shares, play counts)
- [x] Podcaster ratings and engagement
- [x] Episode comments system

**In Progress / Planned:**
- [ ] GraphQL API support
- [ ] WebSocket support for real-time updates
- [ ] Multi-language support
- [ ] Audio book support
- [ ] AI-powered summaries
- [ ] User following/followers
- [ ] Reading analytics

## Acknowledgments

- NestJS team for the amazing framework
- Prisma team for the excellent ORM
- All contributors and testers

---

Built by the Auditure Team
