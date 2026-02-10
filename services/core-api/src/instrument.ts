import * as Sentry from '@sentry/nestjs';

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
        environment: process.env.NODE_ENV || 'development',
    });
}
