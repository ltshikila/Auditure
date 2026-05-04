import PostHog from 'posthog-react-native';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      enableSessionReplay: false,
      captureNativeAppLifecycleEvents: true,
    });
  }
  return client;
}

export function track(event: string, properties?: Record<string, any>): void {
  getPostHog()?.capture(event, properties);
}

export function identify(distinctId: string, properties?: Record<string, any>): void {
  getPostHog()?.identify(distinctId, properties);
}

export function resetAnalytics(): void {
  getPostHog()?.reset();
}
