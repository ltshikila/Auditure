# BookCast AI Worker

Python microservice for AI-powered podcast generation. Handles script generation (via HuggingFace API with template fallback) and text-to-speech conversion (via Microsoft Edge TTS).

## Architecture

```
ai-worker/
├── src/
│   ├── config/           # Pydantic settings
│   ├── consumers/        # RabbitMQ message consumers
│   ├── database/         # SQLAlchemy models & repository
│   ├── generators/       # Script generation (LLM + templates)
│   │   └── templates/    # Fallback template generator
│   ├── storage/          # Local file storage
│   ├── tts/              # Text-to-speech engine
│   └── utils/            # Logging utilities
├── tests/                # Unit & integration tests
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

## Features

- **Script Generation**: HuggingFace API (Mistral-7B) with template fallback
- **Text-to-Speech**: Microsoft Edge TTS (free, unlimited)
- **Episode Types**: MONOLOGUE, DUO, GROUP (multi-voice support)
- **Voice Customization**: Gender, accent, speaking speed, vocal pitch
- **Retry Logic**: 3 automatic retries with exponential backoff
- **Dead Letter Queue**: Failed jobs routed to DLQ after max retries

## Voice Parameters

| Parameter | Range | TTS Support |
|-----------|-------|-------------|
| Gender | MALE/FEMALE | Voice selection |
| Accent | 9 regions | Voice selection |
| Speaking Speed | 1-10 | Rate: -30% to +30% |
| Vocal Pitch | 1-10 | Pitch: -30Hz to +30Hz |

## Environment Variables

```bash
# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
EPISODE_GENERATION_QUEUE=episode_generation
EPISODE_GENERATION_DLQ=episode_generation_dlq

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/bookcast

# LLM (optional)
HUGGINGFACE_API_KEY=your_key_here
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# Storage
LOCAL_STORAGE_PATH=./storage
TTS_TEMP_DIR=./temp/tts

# Processing
LOG_LEVEL=INFO
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
docker build -t bookcast-ai-worker .

# Run
docker run -e RABBITMQ_URL=amqp://host:5672 \
           -e DATABASE_URL=postgresql://... \
           -v ./storage:/storage \
           bookcast-ai-worker
```

## System Requirements

- Python 3.9+
- ffmpeg (for audio concatenation)
- PostgreSQL 14+
- RabbitMQ 3.11+

## Processing Pipeline

```
1. Job received from RabbitMQ (episode_generation queue)
2. Status: PENDING → SCRIPT_GENERATING
3. Fetch book content + podcaster from database
4. Generate script (HuggingFace API or templates)
5. Status: SCRIPT_GENERATED
6. Status: AUDIO_GENERATING
7. Generate audio (Edge TTS)
8. Concatenate segments (if multi-voice)
9. Save to storage: {userId}/{episodeId}/audio.mp3
10. Status: COMPLETED
```

## Error Handling

- Automatic retry: 3 attempts with exponential backoff (5s, 10s, 20s)
- After max retries: Job moved to DLQ
- Status set to FAILED with error message stored
