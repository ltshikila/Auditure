# Auditure AI Worker Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Verify critical imports work (fail fast at build time, not runtime)
RUN python -c "from google.cloud import storage; print('google-cloud-storage OK')" && \
    python -c "from google.cloud import texttospeech; print('google-cloud-texttospeech OK')" && \
    python -c "import google.genai; print('google-genai OK')"

# Copy application code
COPY . .

# Create directories for storage and temp files
RUN mkdir -p /storage /app/temp/tts

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV LOCAL_STORAGE_PATH=/storage
ENV TTS_TEMP_DIR=/app/temp/tts

# Run the worker
CMD ["python", "-m", "src.main"]
