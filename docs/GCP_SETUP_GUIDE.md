# GCP Setup Guide for Auditure

Step-by-step guide to deploy Auditure to Google Cloud Platform.

---

## Prerequisites

Before starting, ensure you have:
- [ ] A Google account
- [ ] A credit card (for GCP billing, won't be charged if using free credits)
- [ ] Git installed locally
- [ ] Node.js 20+ installed
- [ ] Docker Desktop installed

---

## Step 1: Create GCP Account & Project (15 min)

### 1.1 Sign up for Google Cloud
1. Go to [cloud.google.com](https://cloud.google.com)
2. Click "Get started for free"
3. Sign in with your Google account
4. Enter billing information (you get $300 free credits for 90 days)
5. Complete the signup process

### 1.2 Create a new project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown (top-left, next to "Google Cloud")
3. Click "New Project"
4. Enter:
   - Project name: `Auditure Production`
   - Project ID: `auditure-prod` (or let it auto-generate)
5. Click "Create"
6. Wait for project creation (takes ~30 seconds)
7. Select your new project from the dropdown

### 1.3 Enable billing
1. Go to **Billing** in the left sidebar
2. Link your project to your billing account
3. Verify the $300 free credits are applied

---

## Step 2: Install Google Cloud CLI (10 min)

### 2.1 Download and install
**Windows:**
1. Download the installer from [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)
2. Run the installer
3. Follow the prompts (accept defaults)
4. Restart your terminal

**macOS:**
```bash
brew install google-cloud-sdk
```

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### 2.2 Initialize gcloud
```bash
gcloud init
```
1. Log in when prompted (opens browser)
2. Select your project (`auditure-prod`)
3. Choose a default region: `us-central1` (recommended)

### 2.3 Verify installation
```bash
gcloud config list
```
You should see your project ID and account.

---

## Step 3: Enable Required APIs (5 min)

Run this command to enable all necessary APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com
```

Wait for all APIs to enable (1-2 minutes).

---

## Step 4: Create Artifact Registry (5 min)

This is where your Docker images will be stored.

```bash
gcloud artifacts repositories create auditure \
  --repository-format=docker \
  --location=us-central1 \
  --description="Auditure container images"
```

Verify it was created:
```bash
gcloud artifacts repositories list
```

---

## Step 5: Set Up Cloud SQL (PostgreSQL) (10 min)

### 5.1 Create the database instance
```bash
gcloud sql instances create auditure-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=04:00 \
  --enable-point-in-time-recovery
```

⏱️ This takes 5-10 minutes. Wait for it to complete.

### 5.2 Create database and user
```bash
# Create the database
gcloud sql databases create auditure_prod --instance=auditure-db

# Generate a secure password (save this!)
# On Windows PowerShell:
$DB_PASSWORD = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
echo "Your database password: $DB_PASSWORD"

# On Mac/Linux:
DB_PASSWORD=$(openssl rand -base64 24)
echo "Your database password: $DB_PASSWORD"

# Create the user
gcloud sql users create auditure_user \
  --instance=auditure-db \
  --password=$DB_PASSWORD
```

### 5.3 Get the connection details
```bash
gcloud sql instances describe auditure-db --format="value(connectionName)"
```

Save the output - it looks like: `auditure-prod:us-central1:auditure-db`

Your DATABASE_URL will be:
```
postgresql://auditure_user:YOUR_PASSWORD@/auditure_prod?host=/cloudsql/auditure-prod:us-central1:auditure-db
```

---

## Step 6: Set Up Memorystore (Redis) (10 min)

### 6.1 Create Redis instance
```bash
gcloud redis instances create auditure-cache \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

⏱️ This takes 5-10 minutes.

### 6.2 Get the Redis IP
```bash
gcloud redis instances describe auditure-cache \
  --region=us-central1 \
  --format="value(host)"
```

Save this IP address (e.g., `10.0.0.3`) - this is your REDIS_HOST.

---

## Step 7: Create Cloud Storage Bucket (2 min)

```bash
gcloud storage buckets create gs://auditure-storage \
  --location=us-central1 \
  --uniform-bucket-level-access
```

---

## Step 8: Set Up CloudAMQP (RabbitMQ) (5 min)

CloudAMQP is a managed RabbitMQ service (not part of GCP).

1. Go to [cloudamqp.com](https://www.cloudamqp.com)
2. Sign up for a free account
3. Click "Create New Instance"
4. Choose:
   - Name: `auditure-rabbitmq`
   - Plan: `Little Lemur` (free) for development, `Tiger` for production
   - Region: `Google Cloud / us-central1`
5. Click "Create Instance"
6. Click on your instance
7. Copy the **AMQP URL** (starts with `amqps://`)

Save this URL - this is your RABBITMQ_URL.

---

## Step 9: Create Secrets in Secret Manager (10 min)

### 9.1 Generate JWT secrets
```bash
# Generate secure random strings for JWT
# Windows PowerShell:
$JWT_ACCESS = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$JWT_REFRESH = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Mac/Linux:
JWT_ACCESS=$(openssl rand -base64 48)
JWT_REFRESH=$(openssl rand -base64 48)
```

### 9.2 Create all secrets
Replace the placeholder values with your actual keys:

```bash
# Database URL (from Step 5)
echo -n "postgresql://auditure_user:YOUR_PASSWORD@/auditure_prod?host=/cloudsql/auditure-prod:us-central1:auditure-db" | \
  gcloud secrets create DATABASE_URL --data-file=-

# JWT Secrets
echo -n "YOUR_JWT_ACCESS_SECRET" | gcloud secrets create JWT_ACCESS_SECRET --data-file=-
echo -n "YOUR_JWT_REFRESH_SECRET" | gcloud secrets create JWT_REFRESH_SECRET --data-file=-

# Paystack (from your Paystack dashboard)
echo -n "sk_test_xxxxx" | gcloud secrets create PAYSTACK_SECRET_KEY --data-file=-

# Resend (from resend.com dashboard)
echo -n "re_xxxxx" | gcloud secrets create RESEND_API_KEY --data-file=-

# RabbitMQ URL (from Step 8)
echo -n "amqps://xxxxx" | gcloud secrets create RABBITMQ_URL --data-file=-

# Redis Host (from Step 6)
echo -n "10.x.x.x" | gcloud secrets create REDIS_HOST --data-file=-

# OpenAI (from platform.openai.com)
echo -n "sk-xxxxx" | gcloud secrets create OPENAI_API_KEY --data-file=-

# Gemini (from aistudio.google.com)
echo -n "xxxxx" | gcloud secrets create GEMINI_API_KEY --data-file=-
```

### 9.3 Verify secrets were created
```bash
gcloud secrets list
```

---

## Step 10: Create Service Account for GitHub Actions (10 min)

### 10.1 Create the service account
```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer"
```

### 10.2 Grant required permissions
```bash
PROJECT_ID=$(gcloud config get-value project)

# Cloud Run Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Artifact Registry Writer
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Cloud Build Editor
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

# Secret Manager Accessor
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Service Account User (for deploying to Cloud Run)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Cloud SQL Client (for migrations)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### 10.3 Create and download the key
```bash
gcloud iam service-accounts keys create ~/gcp-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com
```

### 10.4 Get the key content
```bash
# Windows PowerShell:
Get-Content ~/gcp-key.json

# Mac/Linux:
cat ~/gcp-key.json
```

Copy the entire JSON content.

---

## Step 11: Configure GitHub Repository (5 min)

### 11.1 Add the GCP service account key
1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click "New repository secret"
4. Name: `GCP_SA_KEY`
5. Value: Paste the entire JSON key from Step 10.4
6. Click "Add secret"

### 11.2 Verify the workflow files exist
Make sure these files are in your repository:
- `.github/workflows/deploy.yml`
- `.github/workflows/ci.yml`
- `services/core-api/Dockerfile`

---

## Step 12: Test Local Docker Build (5 min)

Before deploying, verify the Docker images build correctly:

```bash
# Navigate to your project
cd path/to/Auditure

# Build Core API
cd services/core-api
docker build -t core-api:test .

# Build AI Worker
cd ../ai-worker
docker build -t ai-worker:test .
```

If both build successfully, you're ready to deploy!

---

## Step 13: Deploy! (10 min)

### Option A: Automatic deployment via GitHub
1. Commit and push your changes to the `main` branch:
```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```
2. Go to your GitHub repository → **Actions** tab
3. Watch the "Deploy to GCP" workflow run
4. Wait for it to complete (5-10 minutes)

### Option B: Manual deployment
If you want to deploy manually first:

```bash
# Authenticate Docker with Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push Core API
cd services/core-api
docker build -t us-central1-docker.pkg.dev/auditure-prod/auditure/core-api:latest .
docker push us-central1-docker.pkg.dev/auditure-prod/auditure/core-api:latest

# Deploy Core API to Cloud Run
gcloud run deploy core-api \
  --image us-central1-docker.pkg.dev/auditure-prod/auditure/core-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest"

# Build and push AI Worker
cd ../ai-worker
docker build -t us-central1-docker.pkg.dev/auditure-prod/auditure/ai-worker:latest .
docker push us-central1-docker.pkg.dev/auditure-prod/auditure/ai-worker:latest

# Deploy AI Worker to Cloud Run
gcloud run deploy ai-worker \
  --image us-central1-docker.pkg.dev/auditure-prod/auditure/ai-worker:latest \
  --region us-central1 \
  --platform managed \
  --no-allow-unauthenticated \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

---

## Step 14: Run Database Migrations (5 min)

After the first deployment, run Prisma migrations:

```bash
cd services/core-api

# Install dependencies
npm ci

# Generate Prisma client
npx prisma generate

# Get DATABASE_URL from Secret Manager
export DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL)

# Run migrations
npx prisma migrate deploy
```

---

## Step 15: Verify Deployment (5 min)

### 15.1 Get your service URLs
```bash
# Core API URL
gcloud run services describe core-api --region=us-central1 --format="value(status.url)"

# AI Worker URL
gcloud run services describe ai-worker --region=us-central1 --format="value(status.url)"
```

### 15.2 Test the API
```bash
# Replace with your actual URL
curl https://core-api-xxxxx-uc.a.run.app/health
```

You should see a health check response.

---

## Step 16: Set Up Custom Domain (Optional) (15 min)

### 16.1 Map your domain
1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on `core-api`
3. Click "Manage Custom Domains"
4. Click "Add Mapping"
5. Enter: `api.auditure.app`
6. Follow the DNS verification steps

### 16.2 Update DNS
Add the DNS records provided by Google to your domain registrar.

---

## Troubleshooting

### "Permission denied" errors
```bash
# Re-authenticate
gcloud auth login
gcloud auth application-default login
```

### Cloud Run deployment fails
Check the logs:
```bash
gcloud run services logs read core-api --region=us-central1
```

### Can't connect to Cloud SQL
Make sure Cloud SQL Admin API is enabled:
```bash
gcloud services enable sqladmin.googleapis.com
```

### Secrets not accessible
Grant the Cloud Run service account access:
```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Cost Monitoring

Set up a budget alert to avoid surprises:

1. Go to **Billing** → **Budgets & alerts**
2. Click "Create Budget"
3. Set amount: $50/month (for MVP)
4. Set alert thresholds: 50%, 90%, 100%
5. Add your email for notifications

---

## Next Steps

After successful deployment:

1. [ ] Update mobile app `API_BASE_URL` to your Cloud Run URL
2. [ ] Switch Paystack to production keys
3. [ ] Set up Cloud Monitoring alerts
4. [ ] Apply for [Google Cloud for Startups](https://cloud.google.com/startup) credits
5. [ ] Configure custom domain

---

## Quick Reference

| Resource | How to access |
|----------|---------------|
| Cloud Console | [console.cloud.google.com](https://console.cloud.google.com) |
| Cloud Run | [console.cloud.google.com/run](https://console.cloud.google.com/run) |
| Cloud SQL | [console.cloud.google.com/sql](https://console.cloud.google.com/sql) |
| Secret Manager | [console.cloud.google.com/security/secret-manager](https://console.cloud.google.com/security/secret-manager) |
| Logs | [console.cloud.google.com/logs](https://console.cloud.google.com/logs) |
| Billing | [console.cloud.google.com/billing](https://console.cloud.google.com/billing) |
