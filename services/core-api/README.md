# Auditure Core API

Backend API service for the Auditure application - Transform books into podcast-style audio content.

## Overview

The Core API is built with NestJS and provides authentication, book management, text extraction, and integration points for the Auditure ecosystem.

### Key Features

- 🔐 **JWT Authentication** - Secure user authentication with refresh tokens
- 📧 **Email Verification** - OTP-based email verification system
- 📚 **Book Management** - Upload and manage PDF/EPUB books
- 🎧 **Audio Streaming** - Range-request audio streaming for episode playback
- 🤖 **Async Text Extraction** - Background processing with RabbitMQ
- 📖 **Chapter Detection** - Automatic chapter extraction from books
- 💾 **Flexible Storage** - Local storage with S3-ready abstraction
- 🔍 **Search & Discovery** - Full-text search for books
- 🔴 **Redis Caching** - Job progress tracking, playback progress, rate limiting
- ✅ **Comprehensive Testing** - 83 tests with 90%+ coverage

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

### Service Layer

- **AuthService** - User authentication and authorization
- **BooksService** - Book management and text extraction
- **EmailService** - Email delivery and OTP generation
- **StorageService** - File storage abstraction
- **RabbitMQService** - Async job processing
- **TextExtractionService** - PDF/EPUB text extraction
- **DatabaseService** - Prisma client wrapper

### Background Workers

- **BookExtractionWorker** - Processes book text extraction jobs
  - Downloads file from storage
  - Extracts text based on file type
  - Detects chapters automatically
  - Stores results in database

### Message Queue

RabbitMQ integration for async processing:
- Job retry with exponential backoff
- Dead letter queue for failed jobs
- Persistent messages

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

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Email verification required
- ✅ OTP expiration
- ✅ Input validation with class-validator
- ✅ SQL injection protection (Prisma)
- ✅ File type validation
- ✅ File size limits

### Recommended Additional Security

- [ ] Rate limiting (express-rate-limit)
- [ ] Helmet.js for security headers
- [ ] CORS configuration
- [ ] Request size limits
- [ ] API key authentication for service-to-service
- [ ] Audit logging
- [ ] IP whitelisting for admin endpoints

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

- 📧 Email: support@auditure.app
- 💬 Discord: [Auditure Community](https://discord.gg/auditure)
- 📚 Documentation: [docs.auditure.app](https://docs.auditure.app)
- 🐛 Issues: [GitHub Issues](https://github.com/auditure/issues)

## Roadmap

- [ ] GraphQL API support
- [ ] WebSocket support for real-time updates
- [ ] OCR for scanned PDFs
- [ ] Multi-language support
- [ ] Audio book support
- [ ] AI-powered summaries
- [ ] Social features (sharing, following)
- [ ] Reading analytics

## Acknowledgments

- NestJS team for the amazing framework
- Prisma team for the excellent ORM
- All contributors and testers

---

Built with ❤️ by the Auditure Team
