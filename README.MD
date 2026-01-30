# Auditure

Auditure is a mobile-first application that converts book content into AI-generated podcast episodes featuring customizable virtual hosts. Users can upload books (PDF/EPUB), configure virtual "podcasters" with distinct personalities, and generate multi-speaker audio episodes (monologue, dual-host, or group conversations) using LLMs and Text-to-Speech engines.

## System Architecture

Auditure follows a **Mobile-Client / Cloud-Backend** architecture:

* **Frontend:** React Native (Expo) for iOS and Android
* **Backend (Core):** NestJS API Gateway handling routing, authentication, and orchestration
* **Backend (AI):** Python microservices for LLM script generation and TTS audio synthesis
* **Infrastructure:** PostgreSQL (relational data), RabbitMQ (async job queue), Redis (caching), AWS S3/GCP Storage (audio/book files)

## Project Structure

This project is configured as an NPM Monorepo using Workspaces.

```text
Auditure/
├── apps/
│   └── mobile-app/          # React Native client (Expo)
├── services/
│   ├── core-api/            # NestJS Backend (Auth, Users, Orchestration)
│   │   ├── auth/            # Authentication & OAuth
│   │   ├── users/           # User profiles & settings
│   │   ├── podcasters/      # Virtual host management
│   │   ├── books/           # Book ingestion & extraction
│   │   ├── episodes/        # Episode generation orchestration
│   │   ├── feed/            # Discovery & trending logic
│   │   └── social/          # Likes, comments, bookmarks
│   └── ai-worker/           # Python Service (LLM & TTS Generation)
├── infra/
│   └── docker-compose.yml   # Local development infrastructure
└── package.json             # Root workspace configuration
```

## Getting Started

### Prerequisites

* Node.js (v18+)
* Docker Desktop (for PostgreSQL, RabbitMQ, Redis)
* Python 3.9+ (for AI workers)
* AWS/GCP credentials (for object storage in production)

### Bootstrap the Project

1. **Install Dependencies:** Run from the root to install all workspace dependencies.

```bash
npm install
```

2. **Start Infrastructure:** Spin up PostgreSQL, RabbitMQ, and Redis.

```bash
docker-compose -f infra/docker-compose.yml up -d
```

3. **Run Database Migrations:**

```bash
cd services/core-api
npm run migration:run
```

4. **Run the Backend (Core API):**

```bash
npm run start:core-api
```

5. **Configure API Keys (required for AI features):**

Create `infra/.env` with your API keys:
```bash
# Script Generation (OpenAI GPT-4o mini)
OPENAI_API_KEY=your_openai_api_key_here

# Text-to-Speech (Gemini 2.5 Flash TTS)
GEMINI_API_KEY=your_gemini_api_key_here
```

6. **Run the AI Worker:**

**Option A: Via Docker (Recommended)**
```bash
docker-compose -f infra/docker-compose.yml up -d ai-worker
```

**Option B: Standalone (for development)**
```bash
cd services/ai-worker
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m src.main
```

7. **Run the Mobile App:**

```bash
npm run start:mobile
```

## Tech Stack

### Frontend
* React Native with TypeScript
* Expo for cross-platform development
* Audio playback libraries

### Backend
* Node.js with NestJS framework
* Prisma ORM for database access
* Passport.js for OAuth (Google/Apple)
* JWT authentication with refresh tokens

### AI Processing
* Python 3.9+
* LLM integration (OpenAI GPT-4o mini) with template fallback
* TTS engine: Gemini 2.5 Flash TTS (~$0.15/ep) + Google Cloud Standard (free tier fallback)
* Multi-speaker synthesis with up to 9 voices per episode
* Dynamic WPM calculation based on podcaster speaking speed
* Natural interruptions and backchannels based on chaos factor

### Data & Infrastructure
* PostgreSQL (relational data)
* RabbitMQ (async job queue)
* Redis (caching layer)
* AWS S3 or GCP Storage (audio and book files)
* Docker + Kubernetes (production deployment)

## Key Features

* **Multi-Auth Support:** Email/password, Google OAuth, Apple OAuth, optional 2FA
* **Virtual Podcaster Creation:** Customizable name, avatar, personality, voice, speaking style
* **Book Ingestion:** Upload PDF/EPUB files or provide URLs for extraction
* **Flexible Content Selection:** Process full books, specific chapters, or page ranges
* **Episode Types:** Generate monologues, dual-host conversations, or group discussions
* **Social Features:** Like, comment, bookmark episodes, follow podcasters
* **Discovery Feed:** Browse trending episodes with search by title, author, keywords

## Documentation

For detailed information about specific components:

* [Mobile App Documentation](./apps/mobile-app/README.md) - React Native setup, development workflow
* [Backend Services Documentation](./services/README.md) - Core API and AI Worker details
* [Infrastructure Setup](./infra/README.md) - Docker Compose configuration and troubleshooting

## Security

* TLS encryption for all data transmission
* AES-256 encryption for stored sensitive data
* PKCE flow for OAuth on mobile clients
* Short-lived access tokens with refresh token rotation
* Rate limiting on all API endpoints
* GDPR/CCPA compliance for user data

## Performance Targets

* UI rendering at 60fps
* API latency < 500ms average
* 99.9% uptime target
* Asynchronous episode generation with user notifications
* Horizontal scaling support via Docker/Kubernetes

## Contributing

We welcome contributions! Please follow these guidelines before submitting pull requests.

### Getting Started

1. Fork the repository and create a feature branch from `master`
2. Use descriptive branch names: `feature/add-voice-preview`, `fix/audio-playback-bug`, `refactor/episode-service`
3. Keep commits atomic and focused on a single change

### Code Quality Requirements

#### Linting

All code must pass linting checks before merge:

**TypeScript (Mobile App & Core API):**
```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix
```

**Python (AI Worker):**
```bash
cd services/ai-worker

# Run flake8 for style checks
flake8 src/

# Run mypy for type checking
mypy src/
```

#### Testing

All new features and bug fixes must include tests:

**TypeScript:**
```bash
# Run Jest tests
npm run test

# Run with coverage
npm run test:coverage
```

**Python:**
```bash
cd services/ai-worker

# Run pytest
pytest

# Run with coverage
pytest --cov=src
```

* Aim for >80% code coverage on new code
* Include unit tests for business logic
* Add integration tests for API endpoints and service interactions

### Code Style

#### TypeScript Best Practices

* Use strict TypeScript (`strict: true` in tsconfig)
* Define explicit return types for functions
* Use interfaces for object shapes, types for unions/primitives
* Prefer `const` over `let`, avoid `var`
* Use async/await over raw Promises
* Follow NestJS conventions: decorators, dependency injection, DTOs with class-validator

#### Python Best Practices

* Follow PEP 8 style guidelines
* Use type hints for all function signatures
* Use Pydantic models for data validation
* Prefer f-strings for string formatting
* Use context managers for resource handling
* Keep functions focused and under 50 lines

### Modular Structure

* **Mobile App:** One component per file, co-locate styles and tests
* **Core API:** One module per domain (auth, users, episodes), use NestJS module boundaries
* **AI Worker:** Separate concerns into generators, clients, consumers, and models
* Avoid circular dependencies between modules
* Keep shared utilities in dedicated `common/` or `utils/` directories

### Commit Messages

Use conventional commit format:
```
type(scope): short description

[optional body with more details]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
* `feat(episodes): add support for group conversations`
* `fix(tts): handle timeout errors in Gemini client`
* `docs(readme): expand contributing guidelines`

### Pull Request Process

1. Ensure all checks pass (lint, tests, build)
2. Update documentation if adding new features
3. Add a clear PR description explaining the changes
4. Request review from at least one maintainer
5. Squash commits before merge if requested

## Helpful Commands
```bash
npx tree-node-cli -I "node_modules|.git|dist|.expo|.vscode" --dirs-first
```

## License

[Your License Here]