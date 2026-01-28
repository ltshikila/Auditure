import { apiClient } from './api';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Types
export type SubscriptionTier = 'starter' | 'pro';

export interface CheckoutSession {
    sessionId: string;
    url: string;
}

export interface PortalSession {
    url: string;
}

export interface StripeSubscriptionDetails {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
}

export interface StripeSubscriptionStatus {
    tier: 'FREE' | 'STARTER' | 'PRO';
    isPaid: boolean;
    premiumStartedAt: string | null;
    premiumExpiresAt: string | null;
    stripeSubscription: StripeSubscriptionDetails | null;
    usage: {
        geminiEpisodesUsed: number;
        standardEpisodesUsed: number;
        geminiEpisodeLimit: number;
        standardEpisodeLimit: number;
    };
}

export interface CheckoutResult {
    success: boolean;
    cancelled?: boolean;
    error?: string;
}

export interface PricingPlan {
    price: number;
    tier: SubscriptionTier;
    episodesPerMonth: number;
    features: string[];
}

export interface Pricing {
    starter: PricingPlan;
    pro: PricingPlan;
}

class SubscriptionService {
    /**
     * Create a checkout session and open Stripe Checkout in browser
     * @param token - Auth token
     * @param tier - 'starter' or 'pro'
     */
    async startCheckout(token: string, tier: SubscriptionTier): Promise<CheckoutResult> {
        try {
            console.log(`[Subscription] Starting checkout for ${tier} plan`);

            // Create checkout session on backend
            const session = await apiClient.post<CheckoutSession>(
                '/subscriptions/checkout',
                { tier },
                token,
            );

            if (!session.url) {
                console.error('[Subscription] No checkout URL received');
                return { success: false, error: 'Failed to create checkout session' };
            }

            console.log(`[Subscription] Opening checkout URL: ${session.url}`);

            // Open checkout in in-app browser
            const returnUrl = Linking.createURL('subscription');
            const result = await WebBrowser.openAuthSessionAsync(session.url, returnUrl);

            console.log(`[Subscription] Browser result: ${result.type}`);

            if (result.type === 'success') {
                const url = result.url;
                if (url.includes('success')) {
                    console.log('[Subscription] Checkout completed successfully');
                    return { success: true };
                } else if (url.includes('cancel')) {
                    console.log('[Subscription] Checkout was cancelled');
                    return { success: false, cancelled: true };
                }
            }

            if (result.type === 'cancel' || result.type === 'dismiss') {
                return { success: false, cancelled: true };
            }

            return { success: false, error: 'Checkout did not complete' };
        } catch (error: any) {
            console.error('[Subscription] Checkout error:', error);
            return {
                success: false,
                error: error.message || 'Failed to start checkout',
            };
        }
    }

    /**
     * Open Stripe Customer Portal for subscription management
     */
    async openCustomerPortal(token: string): Promise<boolean> {
        try {
            console.log('[Subscription] Opening customer portal');

            const returnUrl = Linking.createURL('subscription');
            const session = await apiClient.post<PortalSession>(
                '/subscriptions/portal',
                { returnUrl },
                token,
            );

            if (!session.url) {
                console.error('[Subscription] No portal URL received');
                return false;
            }

            console.log(`[Subscription] Opening portal URL: ${session.url}`);
            await WebBrowser.openBrowserAsync(session.url);

            return true;
        } catch (error: any) {
            console.error('[Subscription] Portal error:', error);
            throw error;
        }
    }

    /**
     * Get current subscription status from Stripe endpoint
     */
    async getStripeSubscriptionStatus(token: string): Promise<StripeSubscriptionStatus> {
        return apiClient.get<StripeSubscriptionStatus>('/subscriptions/status', token);
    }

    /**
     * Get pricing information
     * Based on PRICING_STRATEGY.md:
     * - Starter: $9.99/month, 30 episodes
     * - Pro: $24.99/month, 100 episodes
     */
    getPricing(): Pricing {
        return {
            starter: {
                price: 9.99,
                tier: 'starter',
                episodesPerMonth: 30,
                features: [
                    '30 episodes per month',
                    'Gemini Pro voice quality',
                    'Monologue & Duo episodes',
                    '10 podcaster personalities',
                    'Download episodes',
                ],
            },
            pro: {
                price: 24.99,
                tier: 'pro',
                episodesPerMonth: 100,
                features: [
                    '100 episodes per month',
                    'Gemini Pro voice quality',
                    'All episode types (Mono, Duo, Group)',
                    'Unlimited podcaster personalities',
                    'Priority generation',
                    'Custom podcaster creation',
                    'Download episodes',
                ],
            },
        };
    }

    /**
     * Format price for display
     */
    formatPrice(price: number): string {
        return `$${price.toFixed(2)}`;
    }

    /**
     * Get tier display name
     */
    getTierDisplayName(tier: SubscriptionTier): string {
        return tier === 'starter' ? 'Starter' : 'Pro';
    }
}

export const subscriptionService = new SubscriptionService();
