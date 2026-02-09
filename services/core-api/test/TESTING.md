# Non-Functional Testing Guide

This document covers the **reliability**, **security**, and **performance** test suites for the Auditure Core API. These tests complement the existing unit and controller specs by validating system behaviour under failure conditions, adversarial inputs, and load.

---

## Test Structure

```
services/core-api/
├── test/
│   ├── reliability/
│   │   ├── redis-degradation.spec.ts        # Redis disconnection handling
│   │   ├── rabbitmq-degradation.spec.ts     # RabbitMQ channel unavailability
│   │   └── webhook-idempotency.spec.ts      # Duplicate webhook resilience
│   ├── security/
│   │   ├── auth-security.e2e-spec.ts        # JWT attacks & input validation
│   │   └── headers-security.e2e-spec.ts     # Helmet headers & CORS
│   ├── performance/
│   │   ├── api-benchmarks.k6.js             # API load testing (k6)
│   │   └── streaming-stress.k6.js           # Audio streaming stress test (k6)
│   └── TESTING.md                           # This file
├── src/
│   └── subscriptions/
│       └── paystack-webhook-security.spec.ts  # Webhook signature verification
```

---

## Reliability Tests

Run with `npm test` (included in the default Jest suite).

### Redis Degradation (`redis-degradation.spec.ts`)

Verifies that `RedisService` degrades gracefully when Redis is disconnected. The service is instantiated **without** calling `onModuleInit()`, so the internal client remains `undefined`.

**What's tested:**
- Job progress tracking (`setJobProgress`, `getJobProgress`) returns safe defaults
- Playback progress (`setPlaybackProgress`, `getPlaybackProgress`) returns `null`/`undefined`
- Rate limiting (`checkRateLimit`) allows requests through (fails open)
- Notification streaming falls back gracefully
- Module destroy doesn't throw

### RabbitMQ Degradation (`rabbitmq-degradation.spec.ts`)

Verifies `RabbitMQService` behaviour when the AMQP channel is unavailable.

**What's tested:**
- `publishBookExtractionJob` **throws** `"Message queue unavailable"` (callers handle failure)
- `publishEpisodeGenerationJob` **throws** `"Message queue unavailable"`
- `consumeBookExtractionQueue` resolves without executing the handler
- `consumeEpisodeGenerationQueue` resolves without executing the handler
- `onModuleDestroy` handles undefined channel/connection

### Webhook Idempotency (`webhook-idempotency.spec.ts`)

Verifies that duplicate or out-of-order Paystack webhook events don't corrupt subscription data.

**What's tested:**
- Duplicate `charge.success` events don't double-extend subscription periods
- `subscription.create` on an already-active subscription is safe
- `subscription.disable` on an already-cancelled subscription is idempotent
- `subscription.not_renew` marking is safe when repeated
- `invoice.payment_failed` handling is idempotent

---

## Security Tests

### Auth Security E2E (`auth-security.e2e-spec.ts`)

Run with `npm run test:e2e`. Tests the authentication layer against common JWT attacks and input validation bypass attempts.

**What's tested:**
- **JWT attacks:** expired tokens, malformed tokens, wrong-secret tokens, missing `Bearer` prefix
- **User state:** tokens referencing non-existent or unverified users
- **Input validation:** SQL injection in email fields, forbidden/unknown fields rejected (`forbidNonWhitelisted`), missing required fields on registration
- **Authorization boundaries:** user A cannot access user B's resources

### Headers Security E2E (`headers-security.e2e-spec.ts`)

Run with `npm run test:e2e`. Tests HTTP security headers and CORS configuration.

**What's tested:**
- `X-Powered-By` header is removed (Helmet)
- Disallowed origins are rejected by CORS
- Configured origins receive proper `Access-Control-Allow-Origin`
- CORS preflight (`OPTIONS`) returns correct headers
- No server version information leaks

### Paystack Webhook Signature (`paystack-webhook-security.spec.ts`)

Run with `npm test`. Located in `src/subscriptions/` alongside the service it tests.

**What's tested:**
- Valid HMAC-SHA512 signatures are accepted
- Wrong secret keys are rejected
- Tampered payloads (modified after signing) are rejected
- Empty/missing signature headers are rejected

---

## Performance Tests (k6)

These tests require [k6](https://k6.io/) to be installed and a running server to test against. They are **not** part of the CI pipeline — run them manually against a staging environment.

### Install k6

```bash
# macOS
brew install k6

# Windows (winget)
winget install k6

# Docker
docker pull grafana/k6
```

### API Benchmarks (`api-benchmarks.k6.js`)

Two scenarios test the full API surface:

| Scenario | VUs | Duration | Description |
|----------|-----|----------|-------------|
| Smoke | 1 | 30s | Sanity check on public endpoints |
| Load | 0 → 50 | 4min | Ramp-up testing authenticated flows |

**Thresholds:**
- p95 latency < 500ms
- p99 latency < 1000ms
- Error rate < 1%

**Endpoints tested:**
- Public: health, public episodes feed, trending, search
- Authenticated: feed tabs (for_you, following, trending), profile, playback progress, episode details

**Run:**
```bash
# Against local server
k6 run test/performance/api-benchmarks.k6.js

# Against staging with credentials
k6 run \
  -e BASE_URL=https://api-staging.auditure.app \
  -e TEST_EMAIL=perf-test@auditure.com \
  -e TEST_PASSWORD=YourTestPassword \
  -e SAMPLE_EPISODE_ID=<uuid> \
  test/performance/api-benchmarks.k6.js
```

### Streaming Stress Test (`streaming-stress.k6.js`)

Simulates 20 concurrent users streaming audio with byte-range requests.

**Thresholds:**
- Range request p95 < 2000ms
- Failure rate < 1%
- 90%+ requests return HTTP 206 Partial Content

**Scenarios tested:**
- Sequential range reads (simulating playback)
- Random seeks within the file
- Rapid seeking bursts (10 seeks in quick succession)
- Edge cases: first-byte request, open-ended ranges

**Run:**
```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e EPISODE_ID=<uuid> \
  -e TEST_EMAIL=perf-test@auditure.com \
  -e TEST_PASSWORD=YourTestPassword \
  -e AUDIO_SIZE_BYTES=10485760 \
  test/performance/streaming-stress.k6.js
```

---

## CI Integration

The [CI pipeline](../../../.github/workflows/ci.yml) runs:
- `npm test` — all unit specs + reliability specs + webhook security spec
- `npm audit --audit-level=high` — dependency vulnerability check

The [security scan workflow](../../../.github/workflows/security-scan.yml) runs:
- `gitleaks` — scans for committed secrets on every push/PR

E2E security tests (`test:e2e`) and k6 performance tests are run **manually** against staging environments.

---

## Quick Reference

```bash
# Run all unit + reliability tests
cd services/core-api
npm test

# Run security E2E tests only
npm run test:e2e

# Run k6 performance tests (requires k6 + running server)
k6 run test/performance/api-benchmarks.k6.js
k6 run test/performance/streaming-stress.k6.js
```
