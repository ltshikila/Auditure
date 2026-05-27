import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { RevenueCatEvent } from './dto/revenuecat-webhook.dto';

type Tier = 'FREE' | 'STARTER' | 'PRO';

const PRODUCT_TO_TIER: Record<string, Tier> = {
    'auditure_premium:starter': 'STARTER',
    'auditure_premium:pro': 'PRO',
};

const TIER_LIMITS: Record<Tier, { gemini: number; standard: number }> = {
    FREE: { gemini: 1, standard: 2 },
    STARTER: { gemini: 20, standard: 20 },
    PRO: { gemini: 50, standard: 50 },
};

@Injectable()
export class RevenueCatService {
    private readonly logger = new Logger(RevenueCatService.name);

    constructor(private readonly databaseService: DatabaseService) {}

    async handleEvent(event: RevenueCatEvent): Promise<void> {
        this.logger.log(
            `RC event ${event.type} for user ${event.app_user_id} product=${event.product_id} env=${event.environment ?? 'unknown'}`,
        );

        switch (event.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'UNCANCELLATION':
                await this.applyActiveSubscription(event);
                return;

            case 'PRODUCT_CHANGE':
                await this.applyActiveSubscription(event, event.new_product_id ?? event.product_id);
                return;

            case 'CANCELLATION':
                await this.markCancelled(event);
                return;

            case 'EXPIRATION':
                await this.expire(event);
                return;

            case 'BILLING_ISSUE':
                this.logger.warn(
                    `Billing issue for user ${event.app_user_id} on ${event.product_id} — expiry handled by EXPIRATION event`,
                );
                return;

            case 'NON_RENEWING_PURCHASE':
            case 'SUBSCRIBER_ALIAS':
            case 'TRANSFER':
            case 'TEST':
                this.logger.log(`RC event ${event.type} — no-op`);
                return;

            default: {
                const unknownEvent = event as { type?: string };
                this.logger.warn(`Unhandled RC event type: ${unknownEvent.type ?? 'unknown'}`);
            }
        }
    }

    private resolveTier(productId: string): Tier | null {
        return PRODUCT_TO_TIER[productId] ?? null;
    }

    private async applyActiveSubscription(event: RevenueCatEvent, productIdOverride?: string) {
        const productId = productIdOverride ?? event.product_id;
        const tier = this.resolveTier(productId);
        if (!tier) {
            this.logger.warn(
                `Cannot map productId "${productId}" to a tier — ignoring ${event.type} for user ${event.app_user_id}`,
            );
            return;
        }

        const userId = event.app_user_id;
        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            this.logger.warn(`No Subscription row for user ${userId} — RC event ignored`);
            return;
        }

        const limits = TIER_LIMITS[tier];
        const premiumStartedAt = event.purchased_at_ms
            ? new Date(event.purchased_at_ms)
            : new Date();
        const premiumExpiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

        await this.databaseService.subscription.update({
            where: { userId },
            data: {
                tier,
                cancelledAt: null,
                premiumStartedAt,
                premiumExpiresAt,
                geminiEpisodeLimit: limits.gemini,
                standardEpisodeLimit: limits.standard,
            },
        });

        this.logger.log(
            `User ${userId} → ${tier} via ${event.type}; expires ${premiumExpiresAt?.toISOString() ?? 'unknown'}`,
        );
    }

    private async markCancelled(event: RevenueCatEvent) {
        const userId = event.app_user_id;
        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            this.logger.warn(`No Subscription row for user ${userId} — CANCELLATION ignored`);
            return;
        }
        if (subscription.cancelledAt) {
            this.logger.log(`User ${userId} already marked cancelled — skipping`);
            return;
        }
        await this.databaseService.subscription.update({
            where: { userId },
            data: {
                cancelledAt: new Date(event.event_timestamp_ms),
            },
        });
        this.logger.log(
            `User ${userId} cancelled; access continues until ${subscription.premiumExpiresAt?.toISOString() ?? 'unknown'}`,
        );
    }

    private async expire(event: RevenueCatEvent) {
        const userId = event.app_user_id;
        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            this.logger.warn(`No Subscription row for user ${userId} — EXPIRATION ignored`);
            return;
        }
        const freeLimits = TIER_LIMITS.FREE;
        await this.databaseService.subscription.update({
            where: { userId },
            data: {
                tier: 'FREE',
                cancelledAt: null,
                premiumExpiresAt: null,
                premiumStartedAt: null,
                geminiEpisodeLimit: freeLimits.gemini,
                standardEpisodeLimit: freeLimits.standard,
                geminiEpisodesUsed: 0,
                standardEpisodesUsed: 0,
                usagePeriodStart: new Date(),
            },
        });
        this.logger.log(`User ${userId} expired → FREE`);
    }
}
