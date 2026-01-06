# Narratica AI Worker Dockerfile
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
