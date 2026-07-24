# Auditure Infrastructure

This directory contains the Infrastructure-as-Code (IaC) configuration for running the local development environment using **Docker Compose**. This setup provides all the foundational services required for Auditure development without requiring cloud resources.

## Services

The `docker-compose.yml` spins up the following services:

| Service | Container Name | Port | Description | SRS Reference |
|:--------|:---------------|:-----|:------------|:--------------|
| **PostgreSQL** | `auditure_db` | `5432` | Primary relational database for Users, Books, Episodes, and Metadata | Section 6.3 |
| **RabbitMQ** | `auditure_mq` | `5672` (AMQP)<br>`15672` (UI) | Message broker handling the async job queue for episode generation | Section 6.3, NFR-5 |
| **Redis** | `auditure_redis` | `6379` | In-memory cache for job progress tracking, playback progress (resume position), and rate limiting | Section 6.3 |
| **AI Worker** | `auditure_ai_worker` | N/A | Python microservice for script generation (OpenAI GPT-4o mini) and TTS audio synthesis (Gemini 2.5 Flash + Google Cloud TTS) | FR-Episode |

## Usage

### Start All Services

Run in detached mode (background):

```bash
docker-compose up -d
```

### Start Specific Services

```bash
# Only database
docker-compose up -d postgres

# Only message queue
docker-compose up -d rabbitmq

# Only AI worker (requires postgres, rabbitmq, redis)
docker-compose up -d ai-worker
```

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove Volumes

```bash
# WARNING: This deletes all data
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f ai-worker

# Last 100 lines
docker-compose logs --tail=100 rabbitmq
```

### Restart a Service

```bash
docker-compose restart auditure_mq
```

### Check Service Status

```bash
docker-compose ps
```

## Default Credentials

**Warning:** These credentials are for **local development ONLY**. Never use these in production environments.

### PostgreSQL

* **Host:** `localhost`
* **Port:** `5432`
* **Database:** `auditure_db`
* **User:** `admin`
* **Password:** `password`

**Connection String:**
```
postgresql://admin:password@localhost:5432/auditure_db
```

**Connect via CLI:**
```bash
psql postgresql://admin:password@localhost:5432/auditure_db
```

### RabbitMQ Management Dashboard

Access the UI at: [http://localhost:15672](http://localhost:15672)

* **User:** `user`
* **Password:** `password`

**Features:**
* Monitor queue depth and message rates
* View connections and channels
* Inspect message contents
* Configure exchanges and bindings
* Monitor system resources

**AMQP Connection String:**
```
amqp://user:password@localhost:5672
```

### Redis

* **Host:** `localhost`
* **Port:** `6379`
* **Password:** None (authentication disabled for local dev)
* **Database:** `0` (default)

**Connection String:**
```
redis://localhost:6379
```

**Connect via CLI:**
```bash
redis-cli -h localhost -p 6379
```

## AI Worker Configuration

The AI Worker service requires additional configuration via environment variables. Create a `.env` file in the `infra/` directory (read by docker-compose):

```bash
# infra/.env
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
TTS_VOICE_TIER=standard        # standard | gemini
```

Google Cloud Standard TTS additionally needs a service-account credentials file mounted at `/app/google-credentials.json` (see the compose volume below).

### AI Worker Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `OPENAI_API_KEY` | (required for LLM) | OpenAI key for script generation. If unset, the worker falls back to template scripts. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model used for script generation |
| `GEMINI_API_KEY` | (required for Gemini TTS) | Gemini 2.5 Flash TTS key |
| `GOOGLE_CLOUD_PROJECT_ID` | (required for Standard TTS) | GCP project for Google Cloud Standard TTS |
| `TTS_VOICE_TIER` | `standard` | `standard` (Google Cloud) or `gemini` (Gemini 2.5 Flash) |
| `LOG_LEVEL` | `INFO` | Logging verbosity (DEBUG, INFO, WARNING, ERROR) |
| `LOCAL_STORAGE_PATH` | `/storage` | Path for generated audio files |
| `TTS_TEMP_DIR` | `/app/temp/tts` | Temporary directory for TTS processing |

### Technology Stack

The AI Worker uses:
* **Script Generation:** OpenAI GPT-4o-mini with template fallback
* **Text-to-Speech:** Gemini 2.5 Flash TTS (premium, multi-speaker) + Google Cloud Standard TTS (free tier)
* **TTS SDK:** `google-genai` for Gemini TTS integration
* **Database:** SQLAlchemy ORM connecting to PostgreSQL
* **Message Queue:** pika (RabbitMQ client)

**TTS Pricing:**
| Tier | Cost | Use Case |
|------|------|----------|
| Standard | $4/1M chars (~$0.024/ep) | Free tier fallback |
| Gemini Flash | ~$0.15/10-min episode | Default for all users |

## Data Persistence

Docker volumes are configured to persist data even after containers are stopped:

* `postgres_data` - Stores PostgreSQL database files

**Shared Storage:** The AI Worker mounts `../services/core-api/storage:/storage` to share generated audio files with the core-api service. This ensures both services access the same audio files.

**Benefits:**
* Data survives container restarts
* Faster subsequent startups
* No data loss during development

### View Volumes

```bash
docker volume ls | grep auditure
```

### Inspect Volume

```bash
docker volume inspect auditure_postgres_data
```

### Reset Database Completely

To wipe all data and start fresh:

```bash
docker-compose down -v
docker-compose up -d
```

The `-v` flag removes all volumes, including persisted data.

### Backup Database

```bash
# Create backup
docker exec auditure_db pg_dump -U admin auditure_db > backup.sql

# Restore from backup
docker exec -i auditure_db psql -U admin auditure_db < backup.sql
```

## Configuration

### docker-compose.yml Structure

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: auditure_db
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
      POSTGRES_DB: auditure_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - auditure_net

  rabbitmq:
    image: rabbitmq:3-management
    container_name: auditure_mq
    environment:
      RABBITMQ_DEFAULT_USER: user
      RABBITMQ_DEFAULT_PASS: password
    ports:
      - "5672:5672"
      - "15672:15672"
    networks:
      - auditure_net

  redis:
    image: redis:alpine
    container_name: auditure_redis
    ports:
      - "6379:6379"
    networks:
      - auditure_net

  ai-worker:
    build:
      context: ../services/ai-worker
      dockerfile: Dockerfile
    container_name: auditure_ai_worker
    environment:
      RABBITMQ_URL: amqp://user:password@rabbitmq:5672
      DATABASE_URL: postgresql://admin:password@postgres:5432/auditure_db
      LOCAL_STORAGE_PATH: /storage
      TTS_TEMP_DIR: /app/temp/tts
      # LLM - OpenAI GPT-4o mini
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_MODEL: gpt-4o-mini
      OPENAI_MAX_TOKENS: 16000
      # Google Cloud TTS
      GOOGLE_CLOUD_PROJECT_ID: ${GOOGLE_CLOUD_PROJECT_ID}
      GOOGLE_APPLICATION_CREDENTIALS: /app/google-credentials.json
      # Gemini TTS
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      TTS_VOICE_TIER: ${TTS_VOICE_TIER:-standard}
      LOG_LEVEL: INFO
      REDIS_HOST: redis
      REDIS_PORT: 6379
    volumes:
      # Shared storage with core-api for audio files
      - ../services/core-api/storage:/storage
      # Google Cloud service-account credentials (for Standard TTS)
      - ../services/ai-worker/google-credentials.json:/app/google-credentials.json:ro
    depends_on:
      - rabbitmq
      - postgres
      - redis
    networks:
      - auditure_net
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  auditure_net:
    driver: bridge
```

## Production vs. Local

This Docker Compose stack is for **local development only**. In production these are managed services:

| Local (compose) | Production |
|:----------------|:-----------|
| PostgreSQL container | Google Cloud SQL (`auditure_prod`) |
| Redis container | Upstash Redis (services read `REDIS_URL`) |
| RabbitMQ container | Managed RabbitMQ |
| Local `/storage` volume | Google Cloud Storage (`STORAGE_BACKEND=gcs`) |
| `ai-worker` compose service | Cloud Run service (`--min-instances 1 --no-cpu-throttling`) |
| n/a | core-api Cloud Run service (scale-to-zero) + `book-extractor` Cloud Run Job |

### Customization

To modify service configurations, edit `docker-compose.yml`:

**Change Database Name:**
```yaml
environment:
  POSTGRES_DB: my_custom_db
```

**Change Port Mapping:**
```yaml
ports:
  - "5433:5432"  # Use local port 5433 instead of 5432
```

**Add Resource Limits:**
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

## Health Checks

All services include health checks to ensure they're ready to accept connections.

### PostgreSQL

```bash
# Using Docker
docker exec auditure_db pg_isready -U admin

# Expected output: accepting connections
```

### RabbitMQ

```bash
# Using Docker
docker exec auditure_mq rabbitmq-diagnostics ping

# Expected output: Ping succeeded
```

### Redis

```bash
# Using Docker
docker exec auditure_redis redis-cli ping

# Expected output: PONG
```

### Check All Services

```bash
docker-compose ps
```

Healthy services will show "Up" and "(healthy)" in the status column.

## Troubleshooting

### Port Already in Use

If you see "port already allocated" errors:

1. **Check what's using the port:**
   ```bash
   # macOS/Linux
   lsof -i :5432
   
   # Windows
   netstat -ano | findstr :5432
   ```

2. **Options:**
   * Stop the conflicting service
   * Change the port in `docker-compose.yml`
   * Use a different port mapping: `"5433:5432"`

### Container Won't Start

**View detailed logs:**
```bash
docker-compose logs auditure_db
```

**Common issues:**
* Insufficient disk space
* Port conflicts
* Corrupted volume data

**Solution - Fresh start:**
```bash
docker-compose down -v
docker-compose up -d
```

### Database Connection Refused

**Check if container is running:**
```bash
docker ps | grep auditure_db
```

**If not running, check logs and restart:**
```bash
docker-compose logs auditure_db
docker-compose restart auditure_db
```

**Wait for health check to pass:**
```bash
# Container may be starting up
docker-compose ps
# Wait until status shows (healthy)
```

### RabbitMQ Management UI Not Loading

1. **Verify container is running:**
   ```bash
   docker ps | grep auditure_mq
   ```

2. **Check logs:**
   ```bash
   docker-compose logs auditure_mq
   ```

3. **Wait for startup:**
   RabbitMQ can take 30-60 seconds to fully start. Look for:
   ```
   Server startup complete
   ```

4. **Try restarting:**
   ```bash
   docker-compose restart auditure_mq
   ```

### Redis Connection Issues

**Test connection:**
```bash
docker exec auditure_redis redis-cli ping
```

**If no response:**
```bash
docker-compose restart auditure_redis
```

### Permission Denied Errors

**Linux/macOS:**
```bash
# Fix volume permissions
sudo chown -R $USER:$USER ./volumes
```

### Out of Disk Space

**Check Docker disk usage:**
```bash
docker system df
```

**Clean up unused resources:**
```bash
# Remove stopped containers
docker container prune

# Remove unused volumes
docker volume prune

# Remove unused images
docker image prune

# Nuclear option (careful!)
docker system prune -a --volumes
```

## Accessing Services

### PostgreSQL via CLI

**Using Docker exec:**
```bash
docker exec -it auditure_db psql -U admin -d auditure_db
```

**Using local psql:**
```bash
psql postgresql://admin:password@localhost:5432/auditure_db
```

**Common Commands:**
```sql
-- List databases
\l

-- List tables
\dt

-- Describe table
\d users

-- Run query
SELECT * FROM users;

-- Exit
\q
```

### RabbitMQ Management UI

Navigate to [http://localhost:15672](http://localhost:15672)

**Default Login:**
* Username: `user`
* Password: `password`

**Key Features:**
* **Overview:** System health and message rates
* **Connections:** Active AMQP connections
* **Channels:** Communication channels
* **Exchanges:** Message routing
* **Queues:** View `episode_generation_queue` depth and consumers
* **Admin:** User management and permissions

### Redis via CLI

**Using Docker exec:**
```bash
docker exec -it auditure_redis redis-cli
```

**Common Commands:**
```bash
# Test connection
PING

# Get all keys
KEYS *

# Get specific value
GET key_name

# Set value
SET mykey "myvalue"

# Delete key
DEL mykey

# Check if key exists
EXISTS mykey

# Exit
EXIT
```

## Production Considerations

This Docker Compose setup is designed for **local development only**. For production deployments (NFR-7, NFR-8):

### Use Managed Services

* **Database:** AWS RDS, Google Cloud SQL, Azure Database
  * Automated backups (NFR-9)
  * Multi-AZ deployments for high availability (NFR-8)
  * Vertical and horizontal scaling (NFR-6)
  * Point-in-time recovery

* **Message Queue:** AWS SQS/SNS, CloudAMQP, Azure Service Bus
  * Managed scaling
  * Built-in monitoring
  * Dead letter queue support

* **Cache:** AWS ElastiCache, Redis Cloud, Azure Cache for Redis
  * Automatic failover
  * Cluster mode for scalability
  * Backup and restore

### Security Hardening

* **Secrets Management:** AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
* **SSL/TLS:** Enable encryption in transit (NFR-10)
* **Encryption at Rest:** Enable for all data stores (NFR-11)
* **Network Isolation:** VPC, private subnets, security groups
* **Audit Logging:** CloudWatch, Stackdriver, Application Insights (SR-3)

### Monitoring & Alerting

* **Application Monitoring:** New Relic, Datadog, Prometheus + Grafana
* **Log Aggregation:** ELK Stack, CloudWatch Logs, Splunk
* **Uptime Monitoring:** PagerDuty, Pingdom, UptimeRobot
* **Metrics:** Track response times, error rates, queue depth

### Backup Strategy

* **Database:** Daily automated backups with 30-day retention (NFR-9)
* **Disaster Recovery:** Multi-region replication
* **Testing:** Regular restore testing

### Infrastructure as Code

For production, use:
* **Terraform:** Multi-cloud infrastructure provisioning
* **AWS CloudFormation:** AWS-specific IaC
* **Google Cloud Deployment Manager:** GCP-specific IaC
* **Kubernetes Manifests:** Container orchestration (NFR-4)

## Notes

* **Startup Order:** The infrastructure must be running before starting the Core API or AI Worker
* **Network:** All services are connected via a Docker bridge network named `auditure_network` (auto-created)
* **Data Persistence:** Data persists between container restarts unless volumes are explicitly removed with `-v` flag
* **Resource Usage:** Monitor Docker resource usage in Docker Desktop settings
* **Updates:** Periodically update service images for security patches:
  ```bash
  docker-compose pull
  docker-compose up -d
  ```

## Related Documentation

* [Core API Setup](../services/core-api/README.md)
* [AI Worker Setup](../services/ai-worker/README.md)
* [Root Project README](../README.md)

## Additional Resources

* [Docker Compose Documentation](https://docs.docker.com/compose/)
* [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
* [RabbitMQ Docker Hub](https://hub.docker.com/_/rabbitmq)
* [Redis Docker Hub](https://hub.docker.com/_/redis)