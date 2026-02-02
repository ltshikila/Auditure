# Auditure Deployment Plan

## Overview

Deploy Auditure - a mobile app that converts books into AI-generated podcast episodes - to production on **Google Cloud Platform (GCP)**.

### Architecture Summary
- **Mobile App**: React Native/Expo (iOS + Android)
- **Core API**: NestJS (TypeScript) on Cloud Run
- **AI Worker**: Python microservice on Cloud Run
- **Database**: Cloud SQL (PostgreSQL 15)
- **Cache**: Memorystore (Redis)
- **Queue**: CloudAMQP (managed RabbitMQ)
- **Storage**: Cloud Storage
- **External Services**: Paystack, Resend, OpenAI, Google Gemini TTS

### Why GCP?
- Native Gemini TTS integration (already configured)
- Cloud Run: serverless containers that scale to zero
- Best AI/ML tooling in the industry
- Apply for [Google Cloud for Startups](https://cloud.google.com/startup) for up to $350k credits

---

## Cost Estimates

### Assumptions
- **Episode size:** ~15MB audio file (10-15 min podcast)
- **TTS cost:** ~$0.15/episode (Gemini 2.5 Flash)
- **Books per user:** ~2 books/month average
- **Episodes per book:** ~10 episodes average

### GCP Monthly Costs by Scale

| Stage | Users | Episodes/mo | Infra | TTS | Total |
|-------|-------|-------------|-------|-----|-------|
| **MVP** | 0-500 | 1,000 | ~$125 | $150 | **~$275** |
| **Growth** | 500-2k | 5,000 | ~$380 | $750 | **~$1,130** |
| **Scale** | 2k-10k | 20,000 | ~$1,200 | $3,000 | **~$4,200** |

**Key insight:** TTS dominates costs at scale (70%+ of bill). Consider caching popular episodes and using Cloudflare CDN for audio delivery.

---

## Phase 1: GCP Infrastructure Setup

### 1.1 GCP Services to Provision

| Service | GCP Product | Configuration | MVP Cost |
|---------|-------------|---------------|----------|
| Compute (API) | Cloud Run | 1 vCPU, 1GB RAM, auto-scale | ~$30/mo |
| Compute (Worker) | Cloud Run | 1 vCPU, 2GB RAM | ~$20/mo |
| Database | Cloud SQL | PostgreSQL 15, db-f1-micro | ~$9/mo |
| Cache | Memorystore | Redis 1GB Basic | ~$35/mo |
| Message Queue | CloudAMQP | RabbitMQ Little Lemur (free) → Tiger | $0-19/mo |
| Storage | Cloud Storage | Standard, multi-region | ~$0.50/mo |
| Secrets | Secret Manager | All API keys & credentials | ~$0.50/mo |
| CDN | Cloud CDN | Audio file delivery | ~$10/mo |
| **Total MVP** | | | **~$125/mo** + TTS |

### 1.2 Domain & SSL
- [ ] Register/configure `api.auditure.app`
- [ ] Provision SSL certificates (managed by Cloud Run)
- [ ] Configure Cloud CDN for audio file delivery
- [ ] Set up Cloud Armor for DDoS protection (optional)

### 1.3 GCP Project Setup
```bash
# Create project
gcloud projects create auditure-prod --name="Auditure Production"
gcloud config set project auditure-prod

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

---

## Phase 2: Containerization

### 2.1 Core API Dockerfile (TO CREATE)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 2.2 AI Worker Dockerfile (EXISTS)
- Located at `services/ai-worker/Dockerfile`
- Includes FFmpeg for audio processing
- Ready for production

### 2.3 Artifact Registry Setup
```bash
# Create container registry
gcloud artifacts repositories create auditure \
  --repository-format=docker \
  --location=us-central1 \
  --description="Auditure container images"

# Build and push images
gcloud builds submit --tag us-central1-docker.pkg.dev/auditure-prod/auditure/core-api
gcloud builds submit --tag us-central1-docker.pkg.dev/auditure-prod/auditure/ai-worker
```

---

## Phase 3: CI/CD Pipeline

### 3.1 GitHub Actions Workflow (GCP)

```yaml
# .github/workflows/deploy.yml
name: Deploy to GCP

on:
  push:
    branches: [main]

env:
  PROJECT_ID: auditure-prod
  REGION: us-central1
  REGISTRY: us-central1-docker.pkg.dev

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Test Core API
        run: cd services/core-api && npm ci && npm test
      - name: Test AI Worker
        run: cd services/ai-worker && pip install -r requirements.txt && pytest

  deploy-core-api:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - name: Build and push
        run: |
          gcloud builds submit services/core-api \
            --tag $REGISTRY/$PROJECT_ID/auditure/core-api:$GITHUB_SHA
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy core-api \
            --image $REGISTRY/$PROJECT_ID/auditure/core-api:$GITHUB_SHA \
            --region $REGION \
            --platform managed \
            --allow-unauthenticated

  deploy-ai-worker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - name: Build and push
        run: |
          gcloud builds submit services/ai-worker \
            --tag $REGISTRY/$PROJECT_ID/auditure/ai-worker:$GITHUB_SHA
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ai-worker \
            --image $REGISTRY/$PROJECT_ID/auditure/ai-worker:$GITHUB_SHA \
            --region $REGION \
            --platform managed \
            --no-allow-unauthenticated
```

### 3.2 Deployment Stages
1. **Development** - Local Docker Compose
2. **Staging** - Cloud Run (staging project)
3. **Production** - Cloud Run (production project)

---

## Phase 4: Database Migration

### 4.1 Cloud SQL Setup
```bash
# Create PostgreSQL instance
gcloud sql instances create auditure-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=04:00 \
  --enable-point-in-time-recovery

# Create database and user
gcloud sql databases create auditure_prod --instance=auditure-db
gcloud sql users create auditure_user --instance=auditure-db --password=[GENERATE]
```

- [ ] Provision Cloud SQL PostgreSQL instance
- [ ] Configure Cloud SQL Auth Proxy for secure connections
- [ ] Set up automated backups (daily, 30-day retention)
- [ ] Enable point-in-time recovery

### 4.2 Migration Strategy
```bash
# Run from Core API container
npx prisma migrate deploy
```

### 4.3 Data Considerations
- Existing 9 migrations ready for production
- No data migration needed (fresh deployment)

---

## Phase 5: Environment Configuration

### 5.1 Secret Manager Setup

```bash
# Create secrets
echo -n "postgresql://..." | gcloud secrets create DATABASE_URL --data-file=-
echo -n "[jwt-secret]" | gcloud secrets create JWT_ACCESS_SECRET --data-file=-
echo -n "[jwt-secret]" | gcloud secrets create JWT_REFRESH_SECRET --data-file=-
echo -n "[paystack-key]" | gcloud secrets create PAYSTACK_SECRET_KEY --data-file=-
echo -n "[resend-key]" | gcloud secrets create RESEND_API_KEY --data-file=-
echo -n "[openai-key]" | gcloud secrets create OPENAI_API_KEY --data-file=-
echo -n "[gemini-key]" | gcloud secrets create GEMINI_API_KEY --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:auditure-prod@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Core API Secrets:**
| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | Cloud SQL connection string |
| `JWT_ACCESS_SECRET` | 256-bit random string |
| `JWT_REFRESH_SECRET` | 256-bit random string |
| `ENCRYPTION_KEY` | AES-256 encryption key |
| `PAYSTACK_SECRET_KEY` | Production Paystack key |
| `RESEND_API_KEY` | Email service key |
| `RABBITMQ_URL` | CloudAMQP connection string |
| `REDIS_HOST` | Memorystore IP address |

**AI Worker Secrets:**
| Secret | Description |
|--------|-------------|
| `OPENAI_API_KEY` | GPT-4o mini access |
| `GEMINI_API_KEY` | Gemini TTS access |
| `DATABASE_URL` | Cloud SQL connection string |
| `RABBITMQ_URL` | CloudAMQP connection string |

### 5.2 Mobile App Configuration
```
API_BASE_URL=https://api.auditure.app
```

---

## Phase 6: Mobile App Release

### 6.1 iOS Deployment
- [ ] Configure Apple Developer account
- [ ] Set up App Store Connect
- [ ] Create production app bundle
- [ ] Submit for App Store review

### 6.2 Android Deployment
- [ ] Configure Google Play Console
- [ ] Generate signed release APK/AAB
- [ ] Create store listing
- [ ] Submit for Play Store review

### 6.3 EAS Build Configuration
```json
// eas.json
{
  "build": {
    "production": {
      "distribution": "store",
      "android": { "buildType": "app-bundle" },
      "ios": { "resourceClass": "m-medium" }
    }
  }
}
```

---

## Phase 7: Monitoring & Observability

### 7.1 Cloud Monitoring Setup
```bash
# Create uptime check
gcloud monitoring uptime-check-configs create api-health \
  --display-name="API Health Check" \
  --monitored-resource-type=uptime-url \
  --resource-labels="host=api.auditure.app,project_id=auditure-prod"

# Create alert policy for errors
gcloud alpha monitoring policies create \
  --display-name="High Error Rate" \
  --condition-filter='resource.type="cloud_run_revision"' \
  --condition-threshold-value=5 \
  --notification-channels=[YOUR_CHANNEL_ID]
```

- [ ] Set up Cloud Monitoring dashboards
- [ ] Configure alerting (error rates > 1%, latency > 500ms)
- [ ] Create custom metrics for episode generation

### 7.2 Key Metrics to Track
- API response times (target: <500ms)
- Episode generation success rate
- Queue depth (RabbitMQ)
- TTS cost per episode (~$0.15)
- User signups & subscriptions

### 7.3 Cloud Logging
- [ ] Cloud Run logs automatically stream to Cloud Logging
- [ ] Set up log-based alerting for payment failures
- [ ] Create log sinks for long-term audit storage
- [ ] Configure log-based metrics for episode generation tracking

---

## Phase 8: Security Hardening

### 8.1 Pre-Launch Checklist
- [ ] Rotate all API keys for production
- [ ] Enable WAF/DDoS protection
- [ ] Configure rate limiting (already implemented)
- [ ] Set up CORS for production domain only
- [ ] Enable audit logging

### 8.2 Compliance
- [ ] Privacy policy for app stores
- [ ] Terms of service
- [ ] GDPR data handling procedures

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database provisioned & migrated
- [ ] SSL certificates active
- [ ] Monitoring configured

### Deployment Day
- [ ] Deploy Core API to Cloud Run
- [ ] Deploy AI Worker to Cloud Run
- [ ] Verify health endpoints (`/health`)
- [ ] Run Prisma migrations
- [ ] Run smoke tests
- [ ] Monitor Cloud Logging for errors

### Post-Deployment
- [ ] Submit mobile apps for review
- [ ] Enable production Paystack keys
- [ ] Announce launch
- [ ] Monitor first 24 hours closely

---

## Timeline

| Phase | Duration |
|-------|----------|
| Phase 1: Infrastructure | 1-2 days |
| Phase 2: Containerization | 1 day |
| Phase 3: CI/CD | 1 day |
| Phase 4: Database | 0.5 days |
| Phase 5: Configuration | 0.5 days |
| Phase 6: Mobile Release | 1-2 weeks (app review) |
| Phase 7: Monitoring | 1 day |
| Phase 8: Security | 1 day |

**Total Backend Deployment: ~5-7 days**
**Mobile App Availability: +1-2 weeks (store review)**

---

## Next Steps

1. **Immediate**: Create Core API Dockerfile
2. **Immediate**: Create GCP project and enable APIs
3. **Immediate**: Set up GitHub Actions workflow with GCP auth
4. **Immediate**: Provision Cloud SQL, Memorystore, Cloud Storage
5. **Immediate**: Apply for [Google Cloud for Startups](https://cloud.google.com/startup) ($350k credits)
6. **Before Launch**: Switch Paystack to production keys
7. **Before Launch**: Configure custom domain + SSL
