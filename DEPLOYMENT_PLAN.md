# Auditure Deployment Plan

## Overview

Deploy Auditure - a mobile app that converts books into AI-generated podcast episodes - to production.

### Architecture Summary
- **Mobile App**: React Native/Expo (iOS + Android)
- **Core API**: NestJS (TypeScript) on Node.js
- **AI Worker**: Python microservice (episode generation)
- **Infrastructure**: PostgreSQL, RabbitMQ, Redis
- **External Services**: Paystack, Resend, OpenAI, Google Gemini TTS

---

## Cloud Platform Comparison

### Tier 1: Hyperscalers (AWS, GCP, Azure)

#### Google Cloud Platform (GCP)

| Aspect | Details |
|--------|---------|
| **Free Credits** | $300 for 90 days (new accounts) |
| **Startup Program** | Up to $350,000 over 2 years (AI startups, Series A or below) |
| **Always Free** | 1 f1-micro VM, 5GB Cloud Storage, 1GB Firestore |
| **Managed PostgreSQL** | Cloud SQL from ~$9/month (db-f1-micro) |
| **Managed Redis** | Memorystore from ~$35/month (1GB Basic) |
| **Container Hosting** | Cloud Run: pay-per-request, scales to zero |
| **Bandwidth** | $0.12/GB egress (first 1GB free/month) |

**Pros:**
- Native Gemini API integration (your TTS is already configured here)
- Best AI/ML tooling and TPU access
- Cloud Run is excellent for containerized microservices
- Strong Kubernetes (GKE) support
- Fastest-growing in AI segment

**Cons:**
- Complex billing and IAM
- Smaller ecosystem than AWS
- Support can be slow on lower tiers

**Best for Auditure because:** You're already using Gemini TTS and Google Cloud credentials are configured.

---

#### Amazon Web Services (AWS)

| Aspect | Details |
|--------|---------|
| **Free Credits** | $200 + 12 months free tier |
| **Startup Program** | AWS Activate: up to $25,000 credits |
| **Always Free** | 750 hrs/month EC2 t2.micro (12 months), Lambda 1M requests |
| **Managed PostgreSQL** | RDS from ~$13/month (db.t3.micro) |
| **Managed Redis** | ElastiCache from ~$12/month (cache.t3.micro) |
| **Container Hosting** | ECS Fargate: ~$0.04/vCPU-hour + $0.004/GB-hour |
| **Bandwidth** | $0.09/GB egress (first 100GB free/month) |

**Pros:**
- Largest ecosystem and service catalog (200+ services)
- Most documentation and community resources
- Best for enterprise and compliance requirements
- Mature, battle-tested infrastructure

**Cons:**
- Complex pricing (bandwidth costs add up quickly)
- Steeper learning curve
- Can be overkill for smaller projects

**Best for:** Infrastructure-heavy apps, enterprise requirements, if you need services not available elsewhere.

---

#### Microsoft Azure

| Aspect | Details |
|--------|---------|
| **Free Credits** | $200 for 30 days |
| **Startup Program** | Founders Hub: up to $150,000 credits (no funding required!) |
| **Always Free** | 750 hrs B1S VM (12 months), 250GB SQL Database |
| **Managed PostgreSQL** | Azure Database from ~$13/month (Basic tier) |
| **Managed Redis** | Azure Cache from ~$16/month (Basic C0) |
| **Container Hosting** | Container Apps: similar pricing to Cloud Run |
| **Bandwidth** | $0.087/GB egress (first 100GB free) |

**Pros:**
- Best startup program ($150k, no funding required)
- Excellent if using Microsoft stack (.NET, Windows)
- Strong enterprise integrations
- Good hybrid cloud options

**Cons:**
- Less relevant for Node.js/Python stacks
- Portal UX can be confusing
- Documentation sometimes outdated

**Best for:** Startups wanting maximum free credits, Microsoft-centric teams.

---

### Tier 2: Developer-Friendly PaaS (Railway, Render, Fly.io)

#### Railway

| Aspect | Details |
|--------|---------|
| **Free Tier** | $5/month credit (Hobby plan) |
| **Pricing** | Usage-based: ~$25/mo for 2GB/1CPU, ~$85/mo for 4GB/2CPU |
| **PostgreSQL** | Built-in, included in usage pricing |
| **Redis** | Built-in, included in usage pricing |
| **Deployment** | Git push, instant deploys |

**Pros:**
- Fastest setup (connect GitHub, deploy in minutes)
- PostgreSQL and Redis included out of the box
- Great developer experience
- Template marketplace for common stacks

**Cons:**
- Gets expensive quickly at scale
- Limited regions (US/EU only)
- No advanced networking features
- Costs increase fast for real-world apps

**Best for:** MVPs, prototypes, small production apps.

---

#### Render

| Aspect | Details |
|--------|---------|
| **Free Tier** | Free for static sites, 750 hrs/month for web services |
| **Pricing** | Starter from $7/month, Pro from $19/month per user |
| **PostgreSQL** | Managed, from $7/month (256MB) |
| **Redis** | Managed, from $10/month |
| **Deployment** | Git push, zero config for standard apps |

**Pros:**
- "New Heroku" experience - simple and predictable
- Good managed database offerings
- Free SSL, global CDN included
- Background workers supported

**Cons:**
- Per-seat pricing on teams (adds up with developers)
- Less flexible than Railway
- Cold starts on free tier

**Best for:** Teams wanting Heroku-like simplicity.

---

#### Fly.io

| Aspect | Details |
|--------|---------|
| **Free Tier** | 3 shared-cpu VMs, 160GB bandwidth |
| **Pricing** | Pay-per-second, ~$5/mo for basic VM |
| **PostgreSQL** | Built-in with global replication |
| **Redis** | No managed option (self-host or use Upstash) |
| **Deployment** | Dockerfile-based, runs globally |

**Pros:**
- True global edge deployment (30+ regions)
- Lowest latency for geographically distributed users
- Apps can scale to zero
- Built-in Postgres with read replicas

**Cons:**
- No managed Redis (need third-party like Upstash)
- More DevOps knowledge required
- Costs can spike if not carefully managed

**Best for:** Apps needing global low-latency, edge computing.

---

### Tier 3: Budget Options (DigitalOcean, Hetzner, Oracle)

#### DigitalOcean

| Aspect | Details |
|--------|---------|
| **Free Credits** | $200 for 60 days (new accounts) |
| **Droplets** | From $4/month (1 vCPU, 512MB) |
| **Managed PostgreSQL** | From $15/month |
| **Managed Redis** | From $15/month |
| **Kubernetes** | From $12/month (control plane free) |
| **Bandwidth** | 500GB-1TB included, $0.01/GB overage |

**Pros:**
- Simple, predictable pricing
- Excellent documentation and tutorials
- Good managed database options
- Generous bandwidth included
- App Platform for PaaS-like experience

**Cons:**
- Fewer regions than hyperscalers
- Less enterprise features
- No serverless containers (Cloud Run equivalent)

**Best for:** Developers who want simplicity + managed services without hyperscaler complexity.

---

#### Hetzner

| Aspect | Details |
|--------|---------|
| **Free Credits** | None |
| **VPS** | From €3.49/month (1 vCPU, 2GB RAM, 20TB bandwidth!) |
| **Managed PostgreSQL** | ❌ Not available |
| **Managed Redis** | ❌ Not available |
| **Bandwidth** | 20TB included (insane value) |

**Pros:**
- Cheapest raw compute (50% less than DO/AWS)
- 20TB bandwidth included per server
- Great for self-hosted infrastructure
- European data centers (GDPR friendly)

**Cons:**
- No managed databases (must self-host everything)
- No PaaS features
- Requires more DevOps expertise
- Limited to EU and US regions

**Best for:** Cost-conscious teams comfortable with self-hosting databases.

---

#### Oracle Cloud (OCI)

| Aspect | Details |
|--------|---------|
| **Free Credits** | $300 for 30 days |
| **Always Free (Forever)** | 4 ARM cores + 24GB RAM, 200GB storage, 10TB bandwidth |
| **Managed PostgreSQL** | Available (paid) |
| **Managed Redis** | OCI Cache (paid) |

**Pros:**
- **Best always-free tier in the industry** (4 CPU, 24GB RAM forever)
- 10TB/month outbound bandwidth free
- ARM instances are genuinely powerful
- Good for staging/dev environments

**Cons:**
- ARM capacity often unavailable (out of stock)
- Confusing console UX
- Smaller community and fewer tutorials
- Enterprise-focused, less developer-friendly

**Best for:** Free staging environments, budget-conscious testing, always-on services.

---

### Cost Estimates by Scale

#### Assumptions
- **Episode size:** ~15MB audio file (10-15 min podcast)
- **TTS cost:** ~$0.15/episode (Gemini 2.5 Flash)
- **Books per user:** ~2 books/month average
- **Episodes per book:** ~10 episodes average
- **Audio streaming:** ~500MB/user/month

---

#### MVP Stage (0-500 users, 1,000 episodes/month)

| Component | GCP | Railway | DigitalOcean | Hetzner |
|-----------|-----|---------|--------------|---------|
| Compute (API) | $30 | $25 | $24 | $7 |
| Compute (AI Worker) | $20 | $25 | $12 | $4 |
| PostgreSQL | $9 | included | $15 | self-host |
| Redis | $35 | included | $15 | self-host |
| RabbitMQ | $19 (CloudAMQP) | included | $19 | self-host |
| Storage (15GB) | $0.50 | $1 | $2 | $1 |
| Bandwidth (250GB) | $25 | included | included | included |
| **Subtotal Infra** | **$138** | **$51** | **$87** | **$12** |
| TTS (1k episodes) | $150 | $150 | $150 | $150 |
| **Total Monthly** | **$288** | **$201** | **$237** | **$162** |

**Winner at MVP:** Railway (simplest) or Hetzner (cheapest, if you can self-host)

---

#### Growth Stage (500-2,000 users, 5,000 episodes/month)

| Component | GCP | Railway | DigitalOcean | Hetzner |
|-----------|-----|---------|--------------|---------|
| Compute (API) | $80 | $85 | $48 | $14 |
| Compute (AI Worker) | $50 | $85 | $24 | $7 |
| PostgreSQL (4GB) | $50 | included | $60 | self-host |
| Redis (2GB) | $70 | included | $30 | self-host |
| RabbitMQ | $29 | included | $29 | self-host |
| Storage (75GB) | $2 | $5 | $8 | $3 |
| Bandwidth (1TB) | $100 | included | included | included |
| **Subtotal Infra** | **$381** | **$175** | **$199** | **$24** |
| TTS (5k episodes) | $750 | $750 | $750 | $750 |
| **Total Monthly** | **$1,131** | **$925** | **$949** | **$774** |

**Winner at Growth:** Railway (still simple) or Hetzner (if you've built DevOps capacity)

---

#### Scale Stage (2,000-10,000 users, 20,000 episodes/month)

| Component | GCP | AWS | DigitalOcean | Hetzner |
|-----------|-----|-----|--------------|---------|
| Compute (API, 2 instances) | $200 | $250 | $96 | $28 |
| Compute (AI Worker, 2 instances) | $150 | $180 | $48 | $14 |
| PostgreSQL (8GB, HA) | $150 | $180 | $120 | self-host |
| Redis (4GB) | $140 | $120 | $60 | self-host |
| RabbitMQ | $99 | $150 | $99 | self-host |
| Storage (300GB) | $8 | $7 | $30 | $10 |
| Bandwidth (5TB) | $400 | $450 | $40 | included |
| CDN | $50 | $50 | included | $50 |
| **Subtotal Infra** | **$1,197** | **$1,387** | **$493** | **$102** |
| TTS (20k episodes) | $3,000 | $3,000 | $3,000 | $3,000 |
| **Total Monthly** | **$4,197** | **$4,387** | **$3,493** | **$3,102** |

**Winner at Scale:** DigitalOcean (balance) or Hetzner (requires strong DevOps)

---

#### Enterprise Stage (10,000+ users, 50,000+ episodes/month)

| Component | GCP | AWS |
|-----------|-----|-----|
| Compute (auto-scaling) | $500+ | $600+ |
| PostgreSQL (HA, read replicas) | $400+ | $450+ |
| Redis Cluster | $300+ | $280+ |
| RabbitMQ (dedicated) | $200+ | $300+ |
| Storage (1TB+) | $25+ | $25+ |
| Bandwidth (15TB+) | $1,200+ | $1,350+ |
| CDN | $150+ | $150+ |
| **Subtotal Infra** | **$2,775+** | **$3,155+** |
| TTS (50k episodes) | $7,500 | $7,500 |
| **Total Monthly** | **$10,275+** | **$10,655+** |

At this scale, negotiate enterprise discounts (20-40% off) and consider reserved instances.

---

#### Cost Scaling Summary

| Stage | Users | Episodes/mo | GCP | Railway | DO | Hetzner |
|-------|-------|-------------|-----|---------|-----|---------|
| **MVP** | 0-500 | 1,000 | $288 | $201 | $237 | $162 |
| **Growth** | 500-2k | 5,000 | $1,131 | $925 | $949 | $774 |
| **Scale** | 2k-10k | 20,000 | $4,197 | N/A* | $3,493 | $3,102 |
| **Enterprise** | 10k+ | 50,000+ | $10,275+ | N/A* | N/A* | N/A* |

*N/A = Platform may hit limitations or become cost-prohibitive at this scale

---

#### Key Cost Insights

1. **TTS dominates costs** - At scale, Gemini TTS (~$0.15/episode) is 70%+ of your bill
   - Consider: Caching popular episodes, batch processing during off-peak, negotiating API discounts

2. **Bandwidth is a hidden killer** on GCP/AWS
   - GCP: $0.12/GB, AWS: $0.09/GB
   - DigitalOcean/Hetzner include massive bandwidth (1-20TB)
   - **Tip:** Use Cloudflare (free) or CDN to cache audio files

3. **Railway caps out** around 2k users
   - Great for MVP, migrate to GCP/DO when you hit limits

4. **Hetzner is 5-10x cheaper** for raw compute
   - Trade-off: You manage PostgreSQL, Redis, RabbitMQ yourself
   - Only choose if you have DevOps expertise

5. **Startup credits change everything**
   - GCP: Up to $350k (AI startups)
   - Azure: Up to $150k (no funding required)
   - AWS: Up to $25k
   - **Apply early** - credits can run your infrastructure for 1-2 years

---

### Platform Comparison Summary

| Platform | MVP Cost | Scale Cost | Complexity | Managed Services | Best For |
|----------|----------|------------|------------|------------------|----------|
| **GCP** | $288 | $4,197 | Medium | ✅ Full | Gemini integration, AI apps |
| **AWS** | $300 | $4,387 | High | ✅ Full | Enterprise, compliance |
| **Azure** | $280 | $4,000 | Medium | ✅ Full | Max startup credits |
| **Railway** | $201 | N/A | Very Low | ✅ Built-in | Fast MVP, validation |
| **Render** | $180 | $800 | Very Low | ✅ Built-in | Small teams |
| **Fly.io** | $150 | $600 | Low | ⚠️ Partial | Global edge, low latency |
| **DigitalOcean** | $237 | $3,493 | Low | ✅ Yes | Balance of cost/simplicity |
| **Hetzner** | $162 | $3,102 | High | ❌ No | Maximum savings |
| **Oracle** | $0 | $50 | Medium | ⚠️ Limited | Free staging/dev |

---

### Recommendation for Auditure

**Chosen Platform: Google Cloud Platform (GCP)**
- Native Gemini TTS integration (already configured in your codebase)
- Cloud Run is perfect for containerized microservices
- Apply for [Google Cloud for Startups](https://cloud.google.com/startup) for up to $350k credits
- Best AI/ML tooling in the industry

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
