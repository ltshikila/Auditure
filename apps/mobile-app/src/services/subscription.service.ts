import { apiClient } from './api';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Types
export type SubscriptionTier = 'starter' | 'pro';

export interface CheckoutSession {
    reference: string;
    accessCode: string;
    url: string;
}

export interface PaystackSubscriptionDetails {
    status: string;
    nextPaymentDate: string | null;
}

export interface SubscriptionStatus {
    tier: 'FREE' | 'STARTER' | 'PRO';
    isPaid: boolean;
    isCancelled: boolean;
    premiumStartedAt: string | null;
    premiumExpiresAt: string | null;
    paystackSubscription: PaystackSubscriptionDetails | null;
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
    reEnabled?: boolean;
    message?: string;
    error?: string;
}

export interface ReactivateResult {
    success: boolean;
    message: string;
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

export interface ManageSubscriptionResult {
    message: string;
    subscriptionCode?: string;
}

export interface CancelSubscriptionResult {
    success: boolean;
    message: string;
}

class SubscriptionService {
    /**
     * Create a checkout session and open Paystack Checkout in browser
     * @param token - Auth token
     * @param tier - 'starter' or 'pro'
     * @param options - Optional settings (isUpgrade: true for upgrades)
     */
    async startCheckout(
        token: string,
        tier: SubscriptionTier,
        options?: { isUpgrade?: boolean },
    ): Promise<CheckoutResult> {
        try {
            const isUpgrade = options?.isUpgrade ?? false;
            console.log(`[Subscription] Starting checkout for ${tier} plan (upgrade: ${isUpgrade})`);

            // Create checkout session on backend
            const response = await apiClient.post<CheckoutSession | { reEnabled: boolean; message: string }>(
                '/subscriptions/checkout',
                { tier, isUpgrade },
                token,
            );

            // Check if subscription was re-enabled (same plan, just reactivating)
            if ('reEnabled' in response && response.reEnabled) {
                console.log('[Subscription] Subscription re-enabled without new checkout');
                return { success: true, reEnabled: true, message: response.message };
            }

            const session = response as CheckoutSession;

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
                } else if (url.includes('cancel') || url.includes('failed')) {
                    console.log('[Subscription] Checkout was cancelled or failed');
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
     * Get subscription management info
     * Note: Paystack doesn't have a built-in portal like Stripe
     * Users manage subscriptions via email links
     */
    async getManageSubscriptionInfo(token: string): Promise<ManageSubscriptionResult> {
        try {
            console.log('[Subscription] Getting subscription management info');
            return await apiClient.post<ManageSubscriptionResult>(
                '/subscriptions/manage',
                {},
                token,
            );
        } catch (error: any) {
            console.error('[Subscription] Manage subscription error:', error);
            throw error;
        }
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(token: string): Promise<CancelSubscriptionResult> {
        try {
            console.log('[Subscription] Cancelling subscription');
            return await apiClient.post<CancelSubscriptionResult>(
                '/subscriptions/cancel',
                {},
                token,
            );
        } catch (error: any) {
            console.error('[Subscription] Cancel subscription error:', error);
            throw error;
        }
    }

    /**
     * Reactivate a cancelled subscription
     * Only works if the subscription is in the grace period (non-renewing but not yet expired)
     */
    async reactivateSubscription(token: string): Promise<ReactivateResult> {
        try {
            console.log('[Subscription] Reactivating subscription');
            return await apiClient.post<ReactivateResult>(
                '/subscriptions/reactivate',
                {},
                token,
            );
        } catch (error: any) {
            console.error('[Subscription] Reactivate subscription error:', error);
            throw error;
        }
    }

    /**
     * Get current subscription status
     */
    async getSubscriptionStatus(token: string): Promise<SubscriptionStatus> {
        return apiClient.get<SubscriptionStatus>('/subscriptions/status', token);
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
