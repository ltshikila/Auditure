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

# Forced-alignment deps for live transcript timing. Install the CPU-only torch
# build explicitly (from PyTorch's CPU index) so we don't pull the ~2GB CUDA
# wheel — we only ever run alignment on CPU.
RUN pip install --no-cache-dir \
    torch==2.2.2 torchaudio==2.2.2 \
    --index-url https://download.pytorch.org/whl/cpu

# Pre-download the English wav2vec2 alignment model into the image so runtime
# needs no network/egress (and no cold-start download). The base English model
# (~360MB) keeps the worker within its 2Gi memory budget. TORCH_HOME stays set
# at runtime so the worker reads the baked-in cache.
ENV TORCH_HOME=/app/.cache/torch
RUN python -c "import torchaudio; torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H.get_model(); print('wav2vec2 base cached')"

# Verify critical imports work (fail fast at build time, not runtime)
RUN python -c "from google.cloud import storage; print('google-cloud-storage OK')" && \
    python -c "from google.cloud import texttospeech; print('google-cloud-texttospeech OK')" && \
    python -c "import google.genai; print('google-genai OK')" && \
    python -c "import openai; print('openai OK')" && \
    python -c "import torchaudio; print('torchaudio OK')"

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
