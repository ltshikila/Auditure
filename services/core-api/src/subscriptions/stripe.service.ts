import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
    private readonly logger = new Logger(StripeService.name);
    private stripe: Stripe;

    onModuleInit() {
        const secretKey = process.env.STRIPE_SECRET_KEY;

        if (!secretKey) {
            this.logger.warn(
                'STRIPE_SECRET_KEY not configured - Stripe functionality will be disabled',
            );
            return;
        }

        this.stripe = new Stripe(secretKey, {
            apiVersion: '2025-12-15.clover',
            typescript: true,
        });

        this.logger.log('Stripe SDK initialized successfully');
    }

    getClient(): Stripe {
        if (!this.stripe) {
            throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
        }
        return this.stripe;
    }

    isConfigured(): boolean {
        return !!this.stripe;
    }

    /**
     * Get Stripe price ID for a subscription tier
     * @param tier - 'starter' or 'pro'
     */
    getPriceId(tier: 'starter' | 'pro'): string {
        const priceId =
            tier === 'starter'
                ? process.env.STRIPE_PRICE_ID_STARTER
                : process.env.STRIPE_PRICE_ID_PRO;

        if (!priceId) {
            throw new Error(`Stripe price ID for ${tier} tier is not configured`);
        }

        return priceId;
    }

    getWebhookSecret(): string {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
            throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
        }
        return secret;
    }

    getAppUrl(): string {
        return process.env.APP_URL || 'http://localhost:3000';
    }

    getMobileAppScheme(): string {
        return process.env.MOBILE_APP_SCHEME || 'auditure';
    }
}
