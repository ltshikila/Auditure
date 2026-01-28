import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '../database/database.service';
import { StripeService } from './stripe.service';

// Type helpers for Stripe objects
type StripeSubscription = Stripe.Subscription & {
    current_period_end: number;
    cancel_at_period_end: boolean;
};

type StripeInvoice = Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    billing_reason?: string | null;
};

@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly stripeService: StripeService,
    ) {}

    /**
     * Get subscription status for a user
     */
    async getSubscriptionStatus(userId: string) {
        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            return {
                tier: 'FREE',
                isPaid: false,
                stripeSubscription: null,
                usage: {
                    geminiEpisodesUsed: 0,
                    standardEpisodesUsed: 0,
                    geminiEpisodeLimit: 1,
                    standardEpisodeLimit: 2,
                },
            };
        }

        // Fetch latest from Stripe if we have a subscription ID
        let stripeSubscription: {
            status: string;
            currentPeriodEnd: Date;
            cancelAtPeriodEnd: boolean;
        } | null = null;

        if (subscription.stripeSubscriptionId && this.stripeService.isConfigured()) {
            try {
                const stripeSub = (await this.stripeService
                    .getClient()
                    .subscriptions.retrieve(subscription.stripeSubscriptionId)) as any;

                stripeSubscription = {
                    status: stripeSub.status,
                    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                };
            } catch (error: any) {
                this.logger.warn(
                    `Failed to fetch Stripe subscription ${subscription.stripeSubscriptionId}: ${error.message}`,
                );
            }
        }

        const isPaid = subscription.tier === 'STARTER' || subscription.tier === 'PRO';

        return {
            tier: subscription.tier,
            isPaid,
            premiumStartedAt: subscription.premiumStartedAt,
            premiumExpiresAt: subscription.premiumExpiresAt,
            stripeSubscription,
            usage: {
                geminiEpisodesUsed: subscription.geminiEpisodesUsed,
                standardEpisodesUsed: subscription.standardEpisodesUsed,
                geminiEpisodeLimit: subscription.geminiEpisodeLimit,
                standardEpisodeLimit: subscription.standardEpisodeLimit,
            },
        };
    }

    /**
     * Create a Stripe Checkout session for subscription purchase
     * @param userId - User ID
     * @param tier - 'starter' or 'pro'
     */
    async createCheckoutSession(userId: string, tier: 'starter' | 'pro') {
        this.logger.log(`Creating checkout session for user ${userId}, tier: ${tier}`);

        if (!this.stripeService.isConfigured()) {
            throw new BadRequestException('Payment system is not configured');
        }

        // Get or create subscription record
        const subscription = await this.getOrCreateSubscription(userId);

        // Check if user already has an active paid subscription
        if ((subscription.tier === 'STARTER' || subscription.tier === 'PRO') && subscription.stripeSubscriptionId) {
            throw new BadRequestException(
                'You already have an active subscription. Use the Customer Portal to manage it.',
            );
        }

        // Get or create Stripe customer
        let customerId = subscription.stripeCustomerId;

        if (!customerId) {
            const user = await this.databaseService.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                throw new BadRequestException('User not found');
            }

            this.logger.log(`Creating Stripe customer for user ${userId}`);

            const customer = await this.stripeService.getClient().customers.create({
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                metadata: { userId },
            });

            customerId = customer.id;

            await this.databaseService.subscription.update({
                where: { userId },
                data: { stripeCustomerId: customerId },
            });

            this.logger.log(`Created Stripe customer ${customerId} for user ${userId}`);
        }

        // Create checkout session
        const priceId = this.stripeService.getPriceId(tier);
        const appUrl = this.stripeService.getAppUrl();

        const session = await this.stripeService.getClient().checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${appUrl}/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/subscriptions/cancel`,
            metadata: { userId, tier },
            subscription_data: { metadata: { userId, tier } },
        });

        this.logger.log(`Checkout session created: ${session.id} for user ${userId}`);

        return {
            sessionId: session.id,
            url: session.url,
        };
    }

    /**
     * Create a Stripe Customer Portal session
     */
    async createPortalSession(userId: string, returnUrl?: string) {
        this.logger.log(`Creating portal session for user ${userId}`);

        if (!this.stripeService.isConfigured()) {
            throw new BadRequestException('Payment system is not configured');
        }

        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription?.stripeCustomerId) {
            throw new BadRequestException('No billing account found. Please subscribe first.');
        }

        const mobileScheme = this.stripeService.getMobileAppScheme();
        const finalReturnUrl = returnUrl || `${mobileScheme}://subscription`;

        const session = await this.stripeService.getClient().billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: finalReturnUrl,
        });

        this.logger.log(`Portal session created for user ${userId}`);

        return { url: session.url };
    }

    // Webhook handlers

    async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
        const sub = subscription as StripeSubscription;
        const subscriptionId = sub.id;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        this.logger.log(
            `Processing subscription.created: ${subscriptionId} for customer ${customerId}`,
        );

        const userSubscription = await this.findSubscriptionByCustomerId(customerId);

        if (!userSubscription) {
            this.logger.error(`No subscription record found for customer ${customerId}`);
            return;
        }

        // Determine tier from subscription metadata or price
        const tier = this.determineTierFromSubscription(sub);
        const limits = this.getLimitsForTier(tier);
        const currentPeriodEnd = new Date(sub.current_period_end * 1000);

        await this.databaseService.subscription.update({
            where: { id: userSubscription.id },
            data: {
                stripeSubscriptionId: subscriptionId,
                tier,
                premiumStartedAt: new Date(),
                premiumExpiresAt: currentPeriodEnd,
                geminiEpisodeLimit: limits.geminiEpisodeLimit,
                standardEpisodeLimit: limits.standardEpisodeLimit,
            },
        });

        this.logger.log(
            `User ${userSubscription.userId} upgraded to ${tier}, expires: ${currentPeriodEnd.toISOString()}`,
        );

        const tierName = tier === 'PRO' ? 'Pro' : 'Starter';
        await this.sendNotification(
            userSubscription.userId,
            `Welcome to Auditure ${tierName}!`,
            tier === 'PRO'
                ? 'Enjoy 100 podcast episodes per month with priority processing!'
                : 'Enjoy 30 podcast episodes per month!',
        );
    }

    async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
        const sub = subscription as StripeSubscription;
        const subscriptionId = sub.id;
        this.logger.log(`Processing subscription.updated: ${subscriptionId}`);

        const userSubscription = await this.findSubscriptionByStripeId(subscriptionId);

        if (!userSubscription) {
            this.logger.warn(`No subscription record found for Stripe subscription ${subscriptionId}`);
            return;
        }

        const tier = this.determineTierFromSubscription(sub);
        const currentPeriodEnd = new Date(sub.current_period_end * 1000);

        switch (sub.status) {
            case 'active':
            case 'trialing':
                await this.databaseService.subscription.update({
                    where: { id: userSubscription.id },
                    data: { tier, premiumExpiresAt: currentPeriodEnd },
                });
                this.logger.log(
                    `Subscription ${subscriptionId} updated to ${tier}, status: ${sub.status}, expires: ${currentPeriodEnd.toISOString()}`,
                );
                break;

            case 'past_due':
                this.logger.warn(`Subscription ${subscriptionId} is past due`);
                await this.sendNotification(
                    userSubscription.userId,
                    'Payment Issue',
                    "We couldn't process your payment. Please update your payment method.",
                );
                break;

            case 'canceled':
            case 'unpaid':
                this.logger.log(`Subscription ${subscriptionId} status changed to ${sub.status}`);
                break;
        }

        if (sub.cancel_at_period_end && sub.status === 'active') {
            this.logger.log(`Subscription ${subscriptionId} scheduled for cancellation`);
            await this.sendNotification(
                userSubscription.userId,
                'Subscription Cancellation Scheduled',
                `Your subscription will end on ${currentPeriodEnd.toLocaleDateString()}.`,
            );
        }
    }

    async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
        const subscriptionId = subscription.id;
        this.logger.log(`Processing subscription.deleted: ${subscriptionId}`);

        const userSubscription = await this.findSubscriptionByStripeId(subscriptionId);

        if (!userSubscription) {
            this.logger.warn(`No subscription record found for ${subscriptionId}`);
            return;
        }

        const freeLimits = this.getLimitsForTier('FREE');

        await this.databaseService.subscription.update({
            where: { id: userSubscription.id },
            data: {
                tier: 'FREE',
                stripeSubscriptionId: null,
                premiumExpiresAt: new Date(),
                geminiEpisodeLimit: freeLimits.geminiEpisodeLimit,
                standardEpisodeLimit: freeLimits.standardEpisodeLimit,
                geminiEpisodesUsed: 0,
                standardEpisodesUsed: 0,
                usagePeriodStart: new Date(),
            },
        });

        this.logger.log(`User ${userSubscription.userId} downgraded to FREE tier`);

        await this.sendNotification(
            userSubscription.userId,
            'Subscription Ended',
            'Your subscription has ended. Re-subscribe anytime to continue creating episodes.',
        );
    }

    async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
        const inv = invoice as StripeInvoice;
        const invoiceId = inv.id;
        this.logger.log(`Processing invoice.payment_failed: ${invoiceId}`);

        if (!inv.subscription) {
            this.logger.debug(`Invoice ${invoiceId} has no subscription, skipping`);
            return;
        }

        const subscriptionId =
            typeof inv.subscription === 'string' ? inv.subscription : inv.subscription.id;

        const userSubscription = await this.findSubscriptionByStripeId(subscriptionId);

        if (!userSubscription) {
            this.logger.warn(`No subscription record found for ${subscriptionId}`);
            return;
        }

        this.logger.warn(`Payment failed for user ${userSubscription.userId}, invoice ${invoiceId}`);

        await this.sendNotification(
            userSubscription.userId,
            'Payment Failed',
            "We couldn't process your payment. Please update your payment method.",
        );
    }

    async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
        const inv = invoice as StripeInvoice;
        const invoiceId = inv.id;
        this.logger.log(`Processing invoice.payment_succeeded: ${invoiceId}`);

        if (!inv.subscription) {
            this.logger.debug(`Invoice ${invoiceId} has no subscription, skipping`);
            return;
        }

        const subscriptionId =
            typeof inv.subscription === 'string' ? inv.subscription : inv.subscription.id;

        const userSubscription = await this.findSubscriptionByStripeId(subscriptionId);

        if (!userSubscription) {
            this.logger.debug(`No subscription record found for ${subscriptionId}, may be initial`);
            return;
        }

        try {
            const stripeSubscription = (await this.stripeService
                .getClient()
                .subscriptions.retrieve(subscriptionId)) as unknown as StripeSubscription;

            const tier = this.determineTierFromSubscription(stripeSubscription);
            const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

            await this.databaseService.subscription.update({
                where: { id: userSubscription.id },
                data: { tier, premiumExpiresAt: currentPeriodEnd },
            });

            this.logger.log(
                `Payment succeeded for user ${userSubscription.userId}, tier: ${tier}, renewed until ${currentPeriodEnd.toISOString()}`,
            );

            if (inv.billing_reason === 'subscription_cycle') {
                await this.sendNotification(
                    userSubscription.userId,
                    'Subscription Renewed',
                    'Your subscription has been renewed. Thank you!',
                );
            }
        } catch (error: any) {
            this.logger.error(`Failed to update subscription after payment: ${error.message}`);
        }
    }

    // Helper methods

    private async getOrCreateSubscription(userId: string) {
        let subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            subscription = await this.databaseService.subscription.create({
                data: {
                    userId,
                    tier: 'FREE',
                    geminiEpisodeLimit: 1,
                    standardEpisodeLimit: 2,
                },
            });
            this.logger.log(`Created default subscription for user ${userId}`);
        }

        return subscription;
    }

    private async findSubscriptionByCustomerId(customerId: string) {
        return this.databaseService.subscription.findFirst({
            where: { stripeCustomerId: customerId },
        });
    }

    private async findSubscriptionByStripeId(stripeSubscriptionId: string) {
        return this.databaseService.subscription.findFirst({
            where: { stripeSubscriptionId },
        });
    }

    private async sendNotification(userId: string, title: string, body: string): Promise<void> {
        try {
            await this.databaseService.notification.create({
                data: {
                    userId,
                    type: 'SUBSCRIPTION_WARNING',
                    title,
                    body,
                    data: { route: '/subscription' },
                },
            });
            this.logger.debug(`Notification sent to user ${userId}: ${title}`);
        } catch (error: any) {
            this.logger.error(`Failed to send notification to user ${userId}: ${error.message}`);
        }
    }

    /**
     * Determine subscription tier from Stripe subscription metadata or price
     */
    private determineTierFromSubscription(subscription: StripeSubscription): 'STARTER' | 'PRO' {
        // First check metadata (set during checkout)
        const metadataTier = subscription.metadata?.tier;
        if (metadataTier === 'pro') return 'PRO';
        if (metadataTier === 'starter') return 'STARTER';

        // Fallback: check the price ID from subscription items
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const starterPriceId = process.env.STRIPE_PRICE_ID_STARTER;
        const proPriceId = process.env.STRIPE_PRICE_ID_PRO;

        if (priceId === proPriceId) return 'PRO';
        if (priceId === starterPriceId) return 'STARTER';

        // Default to STARTER if we can't determine
        this.logger.warn(`Could not determine tier from subscription, defaulting to STARTER`);
        return 'STARTER';
    }

    /**
     * Get episode limits for a subscription tier
     * Based on PRICING_STRATEGY.md:
     * - FREE: 3 episodes/month (1 Gemini Pro + 2 Standard)
     * - STARTER: 30 episodes/month
     * - PRO: 100 episodes/month
     */
    private getLimitsForTier(tier: 'FREE' | 'STARTER' | 'PRO'): {
        geminiEpisodeLimit: number;
        standardEpisodeLimit: number;
    } {
        switch (tier) {
            case 'FREE':
                return { geminiEpisodeLimit: 1, standardEpisodeLimit: 2 };
            case 'STARTER':
                return { geminiEpisodeLimit: 30, standardEpisodeLimit: 30 };
            case 'PRO':
                return { geminiEpisodeLimit: 100, standardEpisodeLimit: 100 };
            default:
                return { geminiEpisodeLimit: 1, standardEpisodeLimit: 2 };
        }
    }
}
