import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

if (process.env.POSTHOG_API_KEY) {
    client = new PostHog(process.env.POSTHOG_API_KEY, {
        host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
        flushAt: 20,
        flushInterval: 10000,
    });
}

export function trackEvent(
    distinctId: string,
    event: string,
    properties?: Record<string, any>,
): void {
    if (!client) return;
    try {
        client.capture({ distinctId, event, properties });
    } catch (err) {
        console.error('[Analytics] capture failed', err);
    }
}

export function identifyUser(distinctId: string, properties?: Record<string, any>): void {
    if (!client) return;
    try {
        client.identify({ distinctId, properties });
    } catch (err) {
        console.error('[Analytics] identify failed', err);
    }
}

export async function shutdownAnalytics(): Promise<void> {
    if (client) {
        try {
            await client.shutdown();
        } catch (err) {
            console.error('[Analytics] shutdown failed', err);
        }
    }
}
