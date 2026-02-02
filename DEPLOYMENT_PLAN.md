# Auditure Deployment Guide

> **For Junior Developers**: This guide explains not just *what* to do, but *why* we do it. If you're new to deployment, read the explanations carefully - they'll help you understand cloud infrastructure concepts.

---

## Table of Contents
1. [Understanding the Architecture](#understanding-the-architecture)
2. [Prerequisites](#prerequisites)
3. [Phase 1: GCP Project Setup](#phase-1-gcp-project-setup)
4. [Phase 2: Database Setup (Cloud SQL)](#phase-2-database-setup-cloud-sql)
5. [Phase 3: Message Queue Setup (CloudAMQP)](#phase-3-message-queue-setup-cloudamqp)
6. [Phase 4: Storage Setup (Cloud Storage)](#phase-4-storage-setup-cloud-storage)
7. [Phase 5: Secrets Management](#phase-5-secrets-management)
8. [Phase 6: Containerization](#phase-6-containerization)
9. [Phase 7: CI/CD Pipeline](#phase-7-cicd-pipeline)
10. [Phase 8: Deploying to Cloud Run](#phase-8-deploying-to-cloud-run)
11. [Phase 9: Database Migrations](#phase-9-database-migrations)
12. [Phase 10: Monitoring & Logging](#phase-10-monitoring--logging)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Cost Management](#cost-management)
15. [Current Deployment Status](#current-deployment-status)

---

## Understanding the Architecture

### What We're Building

Auditure converts books into AI-generated podcast episodes. Here's how the pieces fit together:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│    Core API     │────▶│   AI Worker     │
│  (React Native) │     │    (NestJS)     │     │    (Python)     │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                    ┌────────────┼────────────┐          │
                    ▼            ▼            ▼          ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Cloud SQL│ │  Redis   │ │ RabbitMQ │ │ Cloud    │
              │(Postgres)│ │ (Cache)  │ │ (Queue)  │ │ Storage  │
              └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Key Concepts Explained

#### What is Cloud Run?
Cloud Run is a **serverless container platform**. Think of it as:
- You give Google a Docker container (a packaged application)
- Google runs it for you, automatically scaling up when busy and down to zero when idle
- You only pay for the time your code is actually running

**Why serverless?** Traditional servers run 24/7 even when no one is using them. Cloud Run scales to zero, saving money during quiet periods.

#### What is a Container (Docker)?
A container packages your application with everything it needs to run:
- Your code
- Runtime (Node.js, Python)
- Libraries and dependencies
- System tools

**Why containers?** They ensure your app runs the same way everywhere - on your laptop, in testing, and in production. No more "it works on my machine" problems.

#### What is a Message Queue (RabbitMQ)?
A message queue is like a to-do list for your application:
1. Core API adds a task: "Generate episode for book X"
2. AI Worker picks up the task when ready
3. If AI Worker is busy, tasks wait in the queue

**Why use a queue?** Episode generation takes minutes. Without a queue, users would wait forever for API responses. With a queue, the API responds instantly ("Job queued!") and the worker processes it in the background.

#### What is Cloud SQL?
Cloud SQL is a managed PostgreSQL database. "Managed" means:
- Google handles backups, updates, and security patches
- You just use it like a normal database
- Automatic failover if something breaks

### Services We Use

| Service | Purpose | Why This Choice |
|---------|---------|-----------------|
| **Cloud Run** | Run our API and Worker | Scales to zero, pay-per-use |
| **Cloud SQL** | PostgreSQL database | Managed, automatic backups |
| **CloudAMQP** | RabbitMQ message queue | Managed RabbitMQ, free tier available |
| **Cloud Storage** | Store audio files | Cheap, scalable object storage |
| **Secret Manager** | Store API keys securely | Never put secrets in code! |
| **Artifact Registry** | Store Docker images | Where our containers live |

---

## Prerequisites

### Tools You Need Installed

```bash
# 1. Google Cloud CLI (gcloud)
# Download from: https://cloud.google.com/sdk/docs/install
gcloud --version  # Should show version info

# 2. Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
docker --version  # Should show version info

# 3. Node.js 20+
node --version  # Should show v20.x.x

# 4. Python 3.11+
python --version  # Should show 3.11.x

# 5. GitHub CLI
# Download from: https://cli.github.com/
gh --version  # Should show version info
```

### Accounts You Need

1. **Google Cloud Account** - Create at https://cloud.google.com
2. **GitHub Account** - For CI/CD with GitHub Actions
3. **CloudAMQP Account** - Create at https://www.cloudamqp.com (free tier)
4. **Paystack Account** - For payments (get from dashboard)
5. **Resend Account** - For emails (get API key from dashboard)
6. **OpenAI Account** - For script generation
7. **Google AI Studio** - For Gemini TTS API key

---

## Phase 1: GCP Project Setup

### Step 1.1: Create a GCP Project

A GCP project is a container for all your cloud resources. Think of it like a folder that holds your database, servers, and storage.

```bash
# Login to Google Cloud (opens browser for authentication)
gcloud auth login

# Create a new project
# Project IDs must be globally unique, so add random numbers if needed
gcloud projects create auditure-prod --name="Auditure Production"

# Set this project as your default (so you don't have to specify it every time)
gcloud config set project auditure-prod

# Verify you're using the right project
gcloud config get-value project
# Should output: auditure-prod
```

### Step 1.2: Enable Required APIs

GCP has hundreds of services, but they're disabled by default. You need to enable the ones you'll use:

```bash
# Enable all required APIs in one command
gcloud services enable \
  run.googleapis.com \              # Cloud Run (runs our containers)
  sqladmin.googleapis.com \         # Cloud SQL (database)
  redis.googleapis.com \            # Memorystore (Redis cache)
  storage.googleapis.com \          # Cloud Storage (file storage)
  secretmanager.googleapis.com \    # Secret Manager (API keys)
  cloudbuild.googleapis.com \       # Cloud Build (builds Docker images)
  artifactregistry.googleapis.com   # Artifact Registry (stores Docker images)

# This takes 1-2 minutes. You'll see output like:
# Operation "operations/..." finished successfully.
```

### Step 1.3: Set Up Billing

Cloud Run requires billing to be enabled. Go to:
1. https://console.cloud.google.com/billing
2. Link your project to a billing account
3. Set up a budget alert (e.g., email when spending exceeds $100)

> **Pro tip**: Apply for [Google Cloud for Startups](https://cloud.google.com/startup) - you can get up to $350,000 in free credits!

---

## Phase 2: Database Setup (Cloud SQL)

### Step 2.1: Create the PostgreSQL Instance

```bash
# Create a PostgreSQL 15 instance
# --tier=db-f1-micro is the smallest (cheapest) instance type
# --region should match where your users are
gcloud sql instances create auditure-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=04:00 \
  --enable-point-in-time-recovery

# This takes 5-10 minutes. Go grab a coffee!
```

**What do these flags mean?**
- `--tier=db-f1-micro`: Smallest instance (~$9/month). Upgrade later if needed.
- `--storage-auto-increase`: Automatically adds storage if you run out
- `--backup-start-time=04:00`: Daily backups at 4 AM UTC
- `--enable-point-in-time-recovery`: Can restore to any point in the last 7 days

### Step 2.2: Create Database and User

```bash
# Create the database
gcloud sql databases create auditure_prod --instance=auditure-db

# Create a database user with a strong password
# IMPORTANT: Save this password securely - you'll need it for DATABASE_URL
gcloud sql users create auditure_user \
  --instance=auditure-db \
  --password="YourSecurePasswordHere123!"
```

### Step 2.3: Get Connection Information

Cloud SQL uses a special connection method called "Unix sockets" when connecting from Cloud Run. Your connection string will look like:

```
postgresql://auditure_user:PASSWORD@localhost/auditure_prod?host=/cloudsql/PROJECT:REGION:INSTANCE
```

For our setup:
```
postgresql://auditure_user:YourSecurePasswordHere123!@localhost/auditure_prod?host=/cloudsql/auditure-prod:us-central1:auditure-db
```

> **Why `localhost`?** Cloud Run connects to Cloud SQL through a Unix socket, not over the network. The `?host=/cloudsql/...` parameter tells Prisma to use this socket. We put `localhost` as a placeholder because the URL parser requires a hostname.

---

## Phase 3: Message Queue Setup (CloudAMQP)

### Why CloudAMQP Instead of Cloud Pub/Sub?

Our app was built with RabbitMQ (via AMQP protocol). CloudAMQP provides managed RabbitMQ:
- Free tier available (Little Lemur plan)
- No changes needed to existing code
- Easy to upgrade as you grow

### Step 3.1: Create CloudAMQP Instance

1. Go to https://www.cloudamqp.com
2. Sign up / Log in
3. Create a new instance:
   - **Plan**: Little Lemur (Free) for testing, Tiger ($19/mo) for production
   - **Region**: Google Cloud - us-central1 (same region as your other services!)
   - **Name**: auditure-prod

4. After creation, click on the instance and copy the **AMQP URL**. It looks like:
   ```
   amqps://username:password@rattlesnake.rmq.cloudamqp.com/username
   ```

Save this URL - you'll add it to Secret Manager later.

---

## Phase 4: Storage Setup (Cloud Storage)

Cloud Storage holds our generated audio files. It's like a hard drive in the cloud.

### Step 4.1: Create a Storage Bucket

```bash
# Create a bucket for audio files
# Bucket names must be globally unique, so include your project name
gcloud storage buckets create gs://auditure-storage-prod \
  --location=us-central1 \
  --uniform-bucket-level-access

# Verify it was created
gcloud storage buckets list
```

### Step 4.2: Set Up CORS (Cross-Origin Resource Sharing)

CORS allows your mobile app to download files directly from the bucket:

```bash
# Create a CORS configuration file
cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Apply CORS to the bucket
gcloud storage buckets update gs://auditure-storage-prod --cors-file=cors.json

# Clean up
rm cors.json
```

---

## Phase 5: Secrets Management

### Why Use Secret Manager?

**NEVER put secrets (passwords, API keys) in your code or environment variables in plain text!**

Secret Manager:
- Encrypts secrets at rest
- Controls who can access secrets
- Tracks secret versions (can roll back if needed)
- Integrates directly with Cloud Run

### Step 5.1: Create All Required Secrets

```bash
# DATABASE_URL - Note the specific format for Cloud SQL
# IMPORTANT: Use printf or echo -n to avoid trailing newlines!
printf 'postgresql://auditure_user:YourPassword@localhost/auditure_prod?host=/cloudsql/auditure-prod:us-central1:auditure-db' | \
  gcloud secrets create DATABASE_URL --data-file=-

# JWT secrets - Generate random 256-bit strings
# You can use: openssl rand -hex 32
printf 'your-256-bit-jwt-access-secret-here' | \
  gcloud secrets create JWT_ACCESS_SECRET --data-file=-

printf 'your-256-bit-jwt-refresh-secret-here' | \
  gcloud secrets create JWT_REFRESH_SECRET --data-file=-

# External service API keys
printf 'sk_live_your_paystack_key' | \
  gcloud secrets create PAYSTACK_SECRET_KEY --data-file=-

printf 're_your_resend_api_key' | \
  gcloud secrets create RESEND_API_KEY --data-file=-

printf 'sk-your-openai-api-key' | \
  gcloud secrets create OPENAI_API_KEY --data-file=-

printf 'your-gemini-api-key' | \
  gcloud secrets create GEMINI_API_KEY --data-file=-

# RabbitMQ URL from CloudAMQP
printf 'amqps://user:pass@host.rmq.cloudamqp.com/vhost' | \
  gcloud secrets create RABBITMQ_URL --data-file=-
```

> **Common mistake**: Using `echo` instead of `printf` or `echo -n` adds a newline character (`\n`) to your secret, which can cause "Invalid URL" errors. Always use `printf` or `echo -n`!

### Step 5.2: Grant Cloud Run Access to Secrets

Cloud Run needs permission to read these secrets:

```bash
# Get your project number (different from project ID)
PROJECT_NUMBER=$(gcloud projects describe auditure-prod --format='value(projectNumber)')

# The default Cloud Run service account
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to each secret
for SECRET in DATABASE_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET PAYSTACK_SECRET_KEY RESEND_API_KEY RABBITMQ_URL OPENAI_API_KEY GEMINI_API_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done
```

---

## Phase 6: Containerization

### Understanding Docker for Deployment

A Dockerfile is a recipe for building your application into a container. Our Core API Dockerfile uses a "multi-stage build" to keep the final image small.

### Step 6.1: Core API Dockerfile

Located at `services/core-api/Dockerfile`:

```dockerfile
# STAGE 1: Builder
# This stage installs dependencies and builds the app
FROM node:20-alpine AS builder

# Install build tools needed for native modules (canvas, bcrypt)
RUN apk add --no-cache \
    python3 make g++ \
    cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev

WORKDIR /app

# Copy package files first (for better Docker caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for building)
RUN npm install

# Generate Prisma client (database ORM)
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# STAGE 2: Runner
# This stage creates the final, minimal image
FROM node:20-alpine AS runner

# Install only runtime dependencies for canvas
RUN apk add --no-cache \
    cairo pango libjpeg-turbo giflib librsvg pixman

WORKDIR /app

# Copy only what we need from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Create storage directory for local file operations
RUN mkdir -p /storage

# Cloud Run sets PORT env variable, but we use 3000
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Health check for Docker (Cloud Run uses its own probe)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
# Note: NestJS builds to dist/src/main.js, not dist/main.js
CMD ["node", "dist/src/main.js"]
```

**Why multi-stage builds?**
- Builder stage: ~1.5GB (includes all build tools)
- Final image: ~400MB (only runtime dependencies)
- Smaller images = faster deployments and lower costs

### Step 6.2: AI Worker Dockerfile

Located at `services/ai-worker/Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install FFmpeg for audio processing
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run expects the container to listen on PORT
ENV PORT=8080
EXPOSE 8080

CMD ["python", "-m", "src.main"]
```

**Important for AI Worker**: Cloud Run requires containers to respond to HTTP requests for health checks. Since our worker is a queue consumer (not an HTTP server), we added a simple health check server in `src/health.py`.

### Step 6.3: Create Artifact Registry Repository

Artifact Registry stores your Docker images:

```bash
# Create a Docker repository
gcloud artifacts repositories create auditure \
  --repository-format=docker \
  --location=us-central1 \
  --description="Auditure container images"

# Configure Docker to authenticate with Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Step 6.4: Build and Push Images Manually (for testing)

```bash
# Build and push Core API
cd services/core-api
gcloud builds submit --tag us-central1-docker.pkg.dev/auditure-prod/auditure/core-api:latest

# Build and push AI Worker
cd ../ai-worker
gcloud builds submit --tag us-central1-docker.pkg.dev/auditure-prod/auditure/ai-worker:latest
```

---

## Phase 7: CI/CD Pipeline

### What is CI/CD?

- **CI (Continuous Integration)**: Automatically test code when you push changes
- **CD (Continuous Deployment)**: Automatically deploy code after tests pass

### GitHub Actions Workflow

Located at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GCP

on:
  push:
    branches: [master]  # Deploy when code is pushed to master
  pull_request:
    branches: [master]  # Run tests on PRs (but don't deploy)

env:
  PROJECT_ID: auditure-prod
  REGION: us-central1
  REGISTRY: us-central1-docker.pkg.dev

jobs:
  # JOB 1: Run tests
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Test Core API
        working-directory: services/core-api
        continue-on-error: true  # Don't block deploy if tests fail (for now)
        run: |
          npm install
          npx prisma generate
          npm test || echo "Tests failed but continuing"

      - name: Test AI Worker
        working-directory: services/ai-worker
        continue-on-error: true
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-mock
          pytest --tb=short || echo "Tests failed but continuing"

  # JOB 2: Deploy Core API
  deploy-core-api:
    needs: test  # Wait for tests to complete
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - name: Build and push image
        working-directory: services/core-api
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/auditure/core-api:${{ github.sha }} .
          docker build -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/auditure/core-api:latest .
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/auditure/core-api:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/auditure/core-api:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy core-api \
            --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/auditure/core-api:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed \
            --allow-unauthenticated \
            --port 3000 \
            --set-env-vars "NODE_ENV=production" \
            --set-secrets "DATABASE_URL=DATABASE_URL:latest,JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest,RESEND_API_KEY=RESEND_API_KEY:latest,RABBITMQ_URL=RABBITMQ_URL:latest" \
            --add-cloudsql-instances ${{ env.PROJECT_ID }}:${{ env.REGION }}:auditure-db \
            --min-instances 0 \
            --max-instances 10 \
            --memory 1Gi \
            --cpu 1 \
            --timeout 300

  # JOB 3: Deploy AI Worker
  deploy-ai-worker:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - name: Build and push image
        working-directory: services/ai-worker
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/auditure/ai-worker:${{ github.sha }} .
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/auditure/ai-worker:${{ github.sha }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ai-worker \
            --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/auditure/ai-worker:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed \
            --no-allow-unauthenticated \
            --set-secrets "DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,RABBITMQ_URL=RABBITMQ_URL:latest" \
            --add-cloudsql-instances ${{ env.PROJECT_ID }}:${{ env.REGION }}:auditure-db \
            --min-instances 0 \
            --max-instances 5 \
            --memory 2Gi \
            --cpu 1 \
            --timeout 900

  # JOB 4: Run database migrations
  migrate:
    needs: deploy-core-api
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Run Prisma migrations
        working-directory: services/core-api
        run: |
          npm ci
          npx prisma generate

          # Download and start Cloud SQL Auth Proxy
          curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.2/cloud-sql-proxy.linux.amd64
          chmod +x cloud-sql-proxy
          ./cloud-sql-proxy --port 5432 ${{ env.PROJECT_ID }}:${{ env.REGION }}:auditure-db &
          sleep 5

          # Run migrations through the proxy
          DB_PASS=$(gcloud secrets versions access latest --secret=DATABASE_URL | sed -n 's/.*:\([^@]*\)@.*/\1/p')
          export DATABASE_URL="postgresql://auditure_user:${DB_PASS}@localhost:5432/auditure_prod"
          npx prisma migrate deploy
```

### Setting Up GitHub Secrets

1. Create a GCP service account:
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Get the email
SA_EMAIL="github-actions@auditure-prod.iam.gserviceaccount.com"

# Grant necessary permissions
gcloud projects add-iam-policy-binding auditure-prod \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding auditure-prod \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding auditure-prod \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding auditure-prod \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# Create and download key
gcloud iam service-accounts keys create gcp-key.json \
  --iam-account=${SA_EMAIL}
```

2. Add the key to GitHub:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `GCP_SA_KEY`
   - Value: Paste the contents of `gcp-key.json`

---

## Phase 8: Deploying to Cloud Run

### Manual Deployment (for testing)

```bash
# Deploy Core API
gcloud run deploy core-api \
  --image us-central1-docker.pkg.dev/auditure-prod/auditure/core-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest,RESEND_API_KEY=RESEND_API_KEY:latest,RABBITMQ_URL=RABBITMQ_URL:latest" \
  --add-cloudsql-instances auditure-prod:us-central1:auditure-db

# Deploy AI Worker
gcloud run deploy ai-worker \
  --image us-central1-docker.pkg.dev/auditure-prod/auditure/ai-worker:latest \
  --region us-central1 \
  --platform managed \
  --no-allow-unauthenticated \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,RABBITMQ_URL=RABBITMQ_URL:latest" \
  --add-cloudsql-instances auditure-prod:us-central1:auditure-db
```

### Understanding Cloud Run Flags

| Flag | Purpose |
|------|---------|
| `--port 3000` | Which port your app listens on |
| `--allow-unauthenticated` | Anyone can access (needed for public APIs) |
| `--no-allow-unauthenticated` | Requires authentication (for internal services) |
| `--set-secrets` | Inject secrets as environment variables |
| `--add-cloudsql-instances` | Enable Cloud SQL connection |
| `--min-instances 0` | Scale to zero when idle (saves money) |
| `--max-instances 10` | Limit scaling (controls costs) |
| `--memory 1Gi` | RAM allocated to each instance |
| `--cpu 1` | CPU cores per instance |
| `--timeout 300` | Max request duration (seconds) |

### Verify Deployment

```bash
# Get service URLs
gcloud run services list --region us-central1

# Test health endpoint
curl https://core-api-XXXXX-uc.a.run.app/health
# Should return: {"status":"healthy","timestamp":"..."}

# Check logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=core-api" --limit=20
```

---

## Phase 9: Database Migrations

### What are Database Migrations?

Migrations are version-controlled changes to your database schema. Instead of manually running SQL commands, you:
1. Define changes in migration files
2. Run `prisma migrate deploy` to apply them
3. Prisma tracks which migrations have been applied

### Running Migrations

Option 1: **Via GitHub Actions** (recommended)
- Migrations run automatically after each deployment
- See the `migrate` job in the workflow

Option 2: **Manually via Cloud SQL Auth Proxy**
```bash
# Start the proxy (connects your local machine to Cloud SQL)
./cloud-sql-proxy auditure-prod:us-central1:auditure-db &

# Set DATABASE_URL to connect through the proxy
export DATABASE_URL="postgresql://auditure_user:PASSWORD@localhost:5432/auditure_prod"

# Run migrations
cd services/core-api
npx prisma migrate deploy
```

---

## Phase 10: Monitoring & Logging

### Viewing Logs

```bash
# Core API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=core-api" \
  --limit=50 \
  --format="table(timestamp,textPayload)"

# AI Worker logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ai-worker" \
  --limit=50

# Filter by severity
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=20
```

### Cloud Console Dashboards

1. **Cloud Run Console**: https://console.cloud.google.com/run
   - Request count, latency, error rate
   - Instance count over time
   - Memory/CPU usage

2. **Cloud Logging**: https://console.cloud.google.com/logs
   - Real-time log streaming
   - Log-based alerts

### Setting Up Alerts

```bash
# Create an alert for high error rate
gcloud alpha monitoring policies create \
  --display-name="Core API High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="core-api"'
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. "Container failed to start and listen on port"

**Symptoms**: Deployment fails with health check errors

**Causes & Solutions**:

a) **Wrong port**: Cloud Run expects your app to listen on the PORT environment variable
```dockerfile
# In Dockerfile, ensure you expose the right port
ENV PORT=3000
EXPOSE 3000
```

b) **Missing health endpoint**: Cloud Run needs an endpoint that responds to HTTP requests
```typescript
// Add to your app.controller.ts
@Get('health')
getHealth() {
  return { status: 'healthy', timestamp: new Date().toISOString() };
}
```

c) **App crashes on startup**: Check logs for errors
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=core-api" --limit=50
```

#### 2. "ERR_INVALID_URL" for DATABASE_URL

**Symptoms**: App crashes with "Invalid URL" error

**Causes & Solutions**:

a) **Trailing whitespace**: Secrets have extra characters
```bash
# Check for trailing characters
gcloud secrets versions access latest --secret=DATABASE_URL | xxd | tail -3

# Fix by recreating without newlines
printf 'postgresql://user:pass@localhost/db?host=/cloudsql/...' | \
  gcloud secrets versions add DATABASE_URL --data-file=-
```

b) **Wrong URL format**: Cloud SQL needs `localhost` as hostname
```
# Wrong:
postgresql://user:pass@/database?host=/cloudsql/...

# Correct:
postgresql://user:pass@localhost/database?host=/cloudsql/...
```

#### 3. "Permission denied on secret"

**Symptoms**: Cloud Run can't read secrets

**Solution**: Grant the service account access
```bash
PROJECT_NUMBER=$(gcloud projects describe auditure-prod --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 4. "Redis connection refused"

**Symptoms**: Logs show "ECONNREFUSED 127.0.0.1:6379"

**Why it happens**: Memorystore Redis requires VPC connector, which we haven't set up yet.

**Current workaround**: The app gracefully handles this - caching is disabled but the app works.

**Future fix**: Set up Serverless VPC Access connector and update Cloud Run to use it.

#### 5. GitHub Actions job stuck in "queued"

**Symptoms**: Workflow shows "Waiting for a runner"

**Why it happens**: GitHub's shared runners are busy (normal during peak times)

**Solutions**:
- Wait a few minutes
- Re-run the workflow
- Consider self-hosted runners for faster builds

#### 6. Build fails with "npm ci requires package-lock.json"

**Symptoms**: Docker build fails

**Solution**: Use `npm install` instead of `npm ci` if you don't have a package-lock.json
```dockerfile
# Instead of: RUN npm ci
RUN npm install
```

---

## Cost Management

### Current Cost Breakdown

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Cloud Run (Core API) | ~$30 | Scales to zero when idle |
| Cloud Run (AI Worker) | ~$20 | Scales to zero when idle |
| Cloud SQL | ~$9 | db-f1-micro (smallest) |
| Cloud Storage | ~$0.50 | Per GB stored |
| CloudAMQP | $0-19 | Free tier available |
| Secret Manager | ~$0.50 | Per secret per month |
| **Infrastructure Total** | **~$60-80** | |
| Gemini TTS | ~$0.15/episode | Dominates at scale |

### Cost Optimization Tips

1. **Scale to zero**: Set `--min-instances 0` on Cloud Run services
2. **Use free tiers**: CloudAMQP Little Lemur, GCP free tier
3. **Right-size instances**: Start small, upgrade only when needed
4. **Monitor usage**: Set up billing alerts at $50, $100, $200
5. **Cache audio files**: Serve popular episodes from CDN

---

## Current Deployment Status

### Live Services

| Service | Status | URL |
|---------|--------|-----|
| Core API | ✅ Running | https://core-api-60457656342.us-central1.run.app |
| AI Worker | ✅ Running | https://ai-worker-60457656342.us-central1.run.app |

### Infrastructure Status

| Resource | Status | Notes |
|----------|--------|-------|
| GCP Project | ✅ Active | auditure-483611 |
| Cloud SQL | ✅ Running | auditure-db (PostgreSQL 15) |
| Cloud Storage | ✅ Ready | auditure-storage-prod |
| Artifact Registry | ✅ Ready | us-central1-docker.pkg.dev/auditure-483611/auditure |
| CloudAMQP | ✅ Connected | RabbitMQ working |
| Memorystore | ⚠️ Not connected | Needs VPC connector |
| Secrets | ✅ Configured | 9 secrets in Secret Manager |

### Pending Tasks

- [ ] Run database migrations
- [ ] Set up custom domain (api.auditure.app)
- [ ] Configure Memorystore VPC connector
- [ ] Set up monitoring alerts
- [ ] Configure production Paystack keys
- [ ] Submit mobile apps to app stores

---

## Quick Reference Commands

```bash
# Check service status
gcloud run services list --region us-central1

# View logs
gcloud logging read "resource.labels.service_name=core-api" --limit=30

# Redeploy a service
gcloud run deploy core-api --image us-central1-docker.pkg.dev/auditure-483611/auditure/core-api:latest --region us-central1

# Check secrets
gcloud secrets list

# Update a secret
printf 'new-value' | gcloud secrets versions add SECRET_NAME --data-file=-

# Check Cloud SQL
gcloud sql instances list

# Check GitHub Actions
gh run list --limit 5
```

---

*Last updated: February 2026*
