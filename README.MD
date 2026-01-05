# BookCast

BookCast is a mobile-first application that converts book content into AI-generated podcast episodes featuring customizable virtual hosts. Users can upload books (PDF/EPUB), configure virtual "podcasters" with distinct personalities, and generate multi-speaker audio episodes (monologue, dual-host, or group conversations) using LLMs and Text-to-Speech engines.

## System Architecture

BookCast follows a **Mobile-Client / Cloud-Backend** architecture:

* **Frontend:** React Native (Expo) for iOS and Android
* **Backend (Core):** NestJS API Gateway handling routing, authentication, and orchestration
* **Backend (AI):** Python microservices for LLM script generation and TTS audio synthesis
* **Infrastructure:** PostgreSQL (relational data), RabbitMQ (async job queue), Redis (caching), AWS S3/GCP Storage (audio/book files)

## Project Structure

This project is configured as an NPM Monorepo using Workspaces.

```text
BookCast/
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
npm run start:gateway
```

5. **Configure HuggingFace API Key (optional but recommended):**

Create `infra/.env` with your HuggingFace API key:
```bash
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

6. **Run the AI Worker (via Docker Compose):**

The AI Worker is included in docker-compose. Alternatively, run standalone:
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
* LLM integration (HuggingFace Inference API - Mistral-7B) with template fallback
* TTS engine (Microsoft Edge TTS - free, unlimited)

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

Please read our contributing guidelines before submitting pull requests. Ensure all code:
* Passes linting checks
* Includes unit tests
* Maintains modular structure
* Follows TypeScript/Python best practices

## Helpful Commands
```bash
npx tree-node-cli -I "node_modules|.git|dist|.expo|.vscode" --dirs-first
```

## License

[Your License Here]