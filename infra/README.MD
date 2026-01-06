# Narratica Infrastructure

This directory contains the Infrastructure-as-Code (IaC) configuration for running the local development environment using **Docker Compose**. This setup provides all the foundational services required for Narratica development without requiring cloud resources.

## Services

The `docker-compose.yml` spins up the following services:

| Service | Container Name | Port | Description | SRS Reference |
|:--------|:---------------|:-----|:------------|:--------------|
| **PostgreSQL** | `narratica_db` | `5432` | Primary relational database for Users, Books, Episodes, and Metadata | Section 6.3 |
| **RabbitMQ** | `narratica_mq` | `5672` (AMQP)<br>`15672` (UI) | Message broker handling the async job queue for episode generation | Section 6.3, NFR-5 |
| **Redis** | `narratica_redis` | `6379` | In-memory cache for job progress tracking, playback progress (resume position), and rate limiting | Section 6.3 |
| **AI Worker** | `narratica_ai_worker` | N/A | Python microservice for script generation (OpenAI GPT-4o mini) and TTS audio synthesis (Google Cloud TTS) | FR-Episode |

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
docker-compose restart narratica_mq
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
* **Database:** `narratica_db`
* **User:** `admin`
* **Password:** `password`

**Connection String:**
```
postgresql://admin:password@localhost:5432/narratica_db
```

**Connect via CLI:**
```bash
psql postgresql://admin:password@localhost:5432/narratica_db
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

The AI Worker service requires additional configuration via environment variables. Create a `.env` file in the `infra/` directory:

```bash
# infra/.env
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

### AI Worker Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `HUGGINGFACE_API_KEY` | (required) | HuggingFace API key for LLM script generation |
| `HUGGINGFACE_MODEL` | `mistralai/Mistral-7B-Instruct-v0.2` | Model to use for script generation |
| `LOG_LEVEL` | `INFO` | Logging verbosity (DEBUG, INFO, WARNING, ERROR) |
| `LOCAL_STORAGE_PATH` | `/storage` | Path for generated audio files |
| `TTS_TEMP_DIR` | `/app/temp/tts` | Temporary directory for TTS processing |

**Note:** If `HUGGINGFACE_API_KEY` is not set, the worker will fall back to template-based script generation (no LLM).

### Technology Stack

The AI Worker uses:
* **Script Generation:** HuggingFace Inference API (Mistral-7B-Instruct) with template fallback
* **Text-to-Speech:** Microsoft Edge TTS (free, unlimited usage)
* **Database:** SQLAlchemy ORM connecting to PostgreSQL
* **Message Queue:** pika (RabbitMQ client)

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
docker volume ls | grep narratica
```

### Inspect Volume

```bash
docker volume inspect narratica_postgres_data
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
docker exec narratica_db pg_dump -U admin narratica_db > backup.sql

# Restore from backup
docker exec -i narratica_db psql -U admin narratica_db < backup.sql
```

## Configuration

### docker-compose.yml Structure

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: narratica_db
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
      POSTGRES_DB: narratica_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - narratica_net

  rabbitmq:
    image: rabbitmq:3-management
    container_name: narratica_mq
    environment:
      RABBITMQ_DEFAULT_USER: user
      RABBITMQ_DEFAULT_PASS: password
    ports:
      - "5672:5672"
      - "15672:15672"
    networks:
      - narratica_net

  redis:
    image: redis:alpine
    container_name: narratica_redis
    ports:
      - "6379:6379"
    networks:
      - narratica_net

  ai-worker:
    build:
      context: ../services/ai-worker
      dockerfile: Dockerfile
    container_name: narratica_ai_worker
    environment:
      RABBITMQ_URL: amqp://user:password@rabbitmq:5672
      DATABASE_URL: postgresql://admin:password@postgres:5432/narratica_db
      LOCAL_STORAGE_PATH: /storage
      TTS_TEMP_DIR: /app/temp/tts
      HUGGINGFACE_API_KEY: ${HUGGINGFACE_API_KEY:-}
      HUGGINGFACE_MODEL: mistralai/Mistral-7B-Instruct-v0.2
      LOG_LEVEL: INFO
      REDIS_HOST: redis
      REDIS_PORT: 6379
    volumes:
      # Shared storage with core-api for audio files
      - ../services/core-api/storage:/storage
    depends_on:
      - rabbitmq
      - postgres
      - redis
    networks:
      - narratica_net
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  narratica_net:
    driver: bridge
```

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
docker exec narratica_db pg_isready -U admin

# Expected output: accepting connections
```

### RabbitMQ

```bash
# Using Docker
docker exec narratica_mq rabbitmq-diagnostics ping

# Expected output: Ping succeeded
```

### Redis

```bash
# Using Docker
docker exec narratica_redis redis-cli ping

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
docker-compose logs narratica_db
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
docker ps | grep narratica_db
```

**If not running, check logs and restart:**
```bash
docker-compose logs narratica_db
docker-compose restart narratica_db
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
   docker ps | grep narratica_mq
   ```

2. **Check logs:**
   ```bash
   docker-compose logs narratica_mq
   ```

3. **Wait for startup:**
   RabbitMQ can take 30-60 seconds to fully start. Look for:
   ```
   Server startup complete
   ```

4. **Try restarting:**
   ```bash
   docker-compose restart narratica_mq
   ```

### Redis Connection Issues

**Test connection:**
```bash
docker exec narratica_redis redis-cli ping
```

**If no response:**
```bash
docker-compose restart narratica_redis
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
docker exec -it narratica_db psql -U admin -d narratica_db
```

**Using local psql:**
```bash
psql postgresql://admin:password@localhost:5432/narratica_db
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
docker exec -it narratica_redis redis-cli
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
* **Network:** All services are connected via a Docker bridge network named `narratica_network` (auto-created)
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