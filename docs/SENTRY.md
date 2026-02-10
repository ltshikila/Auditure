# Sentry Error Monitoring

Auditure uses [Sentry](https://sentry.io/) for error monitoring and performance tracing across the NestJS backend and React Native mobile app.

---

## Architecture

```
┌─────────────────────────────────────────┐
│            Sentry Dashboard             │
│  (auditure-studios organization)        │
│                                         │
│   ┌─────────────┐  ┌────────────────┐  │
│   │  core-api   │  │  mobile-app    │  │
│   │  (NestJS)   │  │  (React Native)│  │
│   └──────▲──────┘  └───────▲────────┘  │
└──────────┼─────────────────┼────────────┘
           │                 │
    5xx errors          JS crashes
    unhandled errors    unhandled rejections
    performance traces  navigation traces
```

---

## Backend Setup (NestJS)

### Files

| File | Purpose |
|------|---------|
| `services/core-api/src/instrument.ts` | Sentry SDK initialization (must load before everything else) |
| `services/core-api/src/main.ts` | Imports `instrument.ts` at the top, before NestFactory |
| `services/core-api/src/app.module.ts` | `SentryModule.forRoot()` as the first module import |
| `services/core-api/src/common/filters/http-exception.filter.ts` | Captures exceptions to Sentry before sending sanitized response |

### How It Works

1. **`instrument.ts`** initializes the Sentry SDK with the DSN, profiling integration, and sampling rates. This file is imported at the very top of `main.ts` before any NestJS code runs.

2. **`SentryModule.forRoot()`** is the first import in `AppModule`, which allows Sentry to instrument all other modules (DB queries, HTTP requests, etc.).

3. **`GlobalExceptionFilter`** catches all exceptions globally:
   - **5xx HTTP exceptions** are reported to Sentry (server errors)
   - **Non-HTTP exceptions** (unexpected crashes) are always reported
   - **4xx HTTP exceptions** (client errors) are NOT reported — they're expected behaviour

### Configuration

Set the `SENTRY_DSN` environment variable in `services/core-api/.env`:

```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

When `SENTRY_DSN` is not set, Sentry is completely disabled — no SDK overhead, no network calls.

### Sampling Rates

| Environment | Traces |
|-------------|--------|
| Production | 20% |
| Development | 100% |

Adjust in `instrument.ts` if needed. In production, 20% provides good visibility without excessive cost.

### Packages

- `@sentry/nestjs` — NestJS-specific SDK with module integration

---

## Mobile App Setup (React Native / Expo)

### Files

| File | Purpose |
|------|---------|
| `apps/mobile-app/src/app/_layout.tsx` | Sentry init + `Sentry.wrap(RootLayout)` |
| `apps/mobile-app/app.json` | Sentry Expo plugin configuration |

### How It Works

1. **`_layout.tsx`** initializes Sentry at the top of the root layout file, before any components render. The `Sentry.wrap()` call wraps the root component with an error boundary that automatically captures React crashes.

2. **`app.json`** includes the `@sentry/react-native/expo` plugin with the organization and project names. This enables:
   - Automatic source map uploads during EAS builds
   - Native crash symbolication
   - Release tracking

### Configuration

Set the `EXPO_PUBLIC_SENTRY_DSN` environment variable in `apps/mobile-app/.env`:

```env
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

Update the Sentry plugin config in `app.json` to match your Sentry organization and project:

```json
[
  "@sentry/react-native/expo",
  {
    "organization": "auditure-studios",
    "project": "mobile-app"
  }
]
```

### Sampling Rates

| Environment | Traces |
|-------------|--------|
| Production (`!__DEV__`) | 20% |
| Development (`__DEV__`) | 100% |

### Packages

- `@sentry/react-native` — React Native SDK with Expo support

---

## What Gets Captured

### Backend (core-api)
- All unhandled exceptions (non-HTTP errors)
- HTTP 500+ server errors
- Performance traces (API endpoint latency, DB query duration)
- CPU profiles (flame graphs for slow requests)

### Mobile (mobile-app)
- JavaScript crashes and unhandled promise rejections
- React component errors (via error boundary)
- Navigation performance traces
- Native crashes (iOS/Android)

### What's NOT Captured
- 4xx client errors (400, 401, 403, 404, 409) — these are expected behaviour
- Validation errors (bad user input)
- Successful requests

---

## Verifying the Integration

### Backend

Start the server and trigger a test error:

```bash
# Start the server with Sentry enabled
cd services/core-api
npm run start:dev

# Trigger a test error (hit a non-existent internal route that causes a 500)
curl http://localhost:3000/api/test-sentry-error
```

Check your Sentry dashboard — the error should appear within seconds.

### Mobile

Open the app in development mode. Sentry will log to the console when `debug: true` is set (which it is in `__DEV__` mode). You should see:

```
[Sentry] Initializing SDK...
[Sentry] DSN: https://...@sentry.io/...
```

To test error capture, you can temporarily add this in any component:

```typescript
throw new Error('Sentry test error');
```

---

## Disabling Sentry

Simply unset or comment out the DSN environment variable:

- **Backend:** Remove or comment `SENTRY_DSN` in `services/core-api/.env`
- **Mobile:** Remove or comment `EXPO_PUBLIC_SENTRY_DSN` in `apps/mobile-app/.env`

The SDK checks for the DSN at initialization and skips all setup if it's missing. Zero overhead when disabled.
