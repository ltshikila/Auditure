import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaystackService, PaystackSubscription } from './paystack.service';

@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paystackService: PaystackService,
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
                paystackSubscription: null,
                usage: {
                    geminiEpisodesUsed: 0,
                    standardEpisodesUsed: 0,
                    geminiEpisodeLimit: 1,
                    standardEpisodeLimit: 2,
                },
            };
        }

        // Fetch latest from Paystack if we have a subscription code
        let paystackSubscription: {
            status: string;
            nextPaymentDate: Date | null;
        } | null = null;

        if (subscription.paystackSubscriptionCode && this.paystackService.isConfigured()) {
            try {
                const paystackSub = await this.paystackService.getSubscription(
                    subscription.paystackSubscriptionCode,
                );

                paystackSubscription = {
                    status: paystackSub.status,
                    nextPaymentDate: paystackSub.next_payment_date
                        ? new Date(paystackSub.next_payment_date)
                        : null,
                };
            } catch (error: any) {
                this.logger.warn(
                    `Failed to fetch Paystack subscription ${subscription.paystackSubscriptionCode}: ${error.message}`,
                );
            }
        }

        const isPaid = subscription.tier === 'STARTER' || subscription.tier === 'PRO';

        return {
            tier: subscription.tier,
            isPaid,
            premiumStartedAt: subscription.premiumStartedAt,
            premiumExpiresAt: subscription.premiumExpiresAt,
            paystackSubscription,
            usage: {
                geminiEpisodesUsed: subscription.geminiEpisodesUsed,
                standardEpisodesUsed: subscription.standardEpisodesUsed,
                geminiEpisodeLimit: subscription.geminiEpisodeLimit,
                standardEpisodeLimit: subscription.standardEpisodeLimit,
            },
        };
    }

    /**
     * Initialize a Paystack transaction for subscription purchase
     * @param userId - User ID
     * @param tier - 'starter' or 'pro'
     */
    async createCheckoutSession(userId: string, tier: 'starter' | 'pro') {
        this.logger.log(`Creating checkout session for user ${userId}, tier: ${tier}`);

        if (!this.paystackService.isConfigured()) {
            throw new BadRequestException('Payment system is not configured');
        }

        // Get or create subscription record
        const subscription = await this.getOrCreateSubscription(userId);

        // Check if user already has an active paid subscription
        if (
            (subscription.tier === 'STARTER' || subscription.tier === 'PRO') &&
            subscription.paystackSubscriptionCode
        ) {
            throw new BadRequestException(
                'You already have an active subscription. Please manage it from your account.',
            );
        }

        // Get user details
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Get or create Paystack customer
        let customerCode = subscription.paystackCustomerCode;

        if (!customerCode) {
            this.logger.log(`Creating Paystack customer for user ${userId}`);

            const customer = await this.paystackService.createCustomer({
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                metadata: { userId },
            });

            customerCode = customer.customer_code;

            await this.databaseService.subscription.update({
                where: { userId },
                data: { paystackCustomerCode: customerCode },
            });

            this.logger.log(`Created Paystack customer ${customerCode} for user ${userId}`);
        }

        // Initialize transaction with plan
        const planCode = this.paystackService.getPlanCode(tier);
        const appUrl = this.paystackService.getAppUrl();

        const transaction = await this.paystackService.initializeTransaction({
            email: user.email,
            plan: planCode,
            callback_url: `${appUrl}/subscriptions/callback`,
            metadata: {
                userId,
                tier,
                custom_fields: [
                    {
                        display_name: 'User ID',
                        variable_name: 'user_id',
                        value: userId,
                    },
                    {
                        display_name: 'Tier',
                        variable_name: 'tier',
                        value: tier,
                    },
                ],
            },
        });

        this.logger.log(`Checkout session created: ${transaction.reference} for user ${userId}`);

        return {
            reference: transaction.reference,
            accessCode: transaction.access_code,
            url: transaction.authorization_url,
        };
    }

    /**
     * Handle successful payment callback
     */
    async handlePaymentCallback(reference: string) {
        this.logger.log(`Handling payment callback for reference: ${reference}`);

        if (!this.paystackService.isConfigured()) {
            throw new BadRequestException('Payment system is not configured');
        }

        const transaction = await this.paystackService.verifyTransaction(reference);

        if (transaction.status !== 'success') {
            this.logger.warn(`Transaction ${reference} was not successful: ${transaction.status}`);
            return { success: false, status: transaction.status };
        }

        return { success: true, status: transaction.status };
    }

    /**
     * Get subscription management URL
     * Note: Paystack doesn't have a built-in portal like Stripe
     * Users manage subscriptions via email links or a custom management page
     */
    async getManageSubscriptionUrl(userId: string) {
        this.logger.log(`Getting subscription management URL for user ${userId}`);

        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription?.paystackSubscriptionCode) {
            throw new BadRequestException('No active subscription found.');
        }

        // Return info for managing subscription
        // Paystack sends management links via email
        return {
            message:
                'To manage your subscription, please check your email for the subscription management link from Paystack, or contact support.',
            subscriptionCode: subscription.paystackSubscriptionCode,
        };
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(userId: string) {
        this.logger.log(`Cancelling subscription for user ${userId}`);

        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription?.paystackSubscriptionCode || !subscription?.paystackEmailToken) {
            throw new BadRequestException('No active subscription found.');
        }

        await this.paystackService.disableSubscription({
            code: subscription.paystackSubscriptionCode,
            token: subscription.paystackEmailToken,
        });

        this.logger.log(`Subscription cancelled for user ${userId}`);

        return {
            success: true,
            message: 'Subscription will be cancelled at the end of the billing period.',
        };
    }

    // Webhook handlers

    async handleChargeSuccess(data: any): Promise<void> {
        this.logger.log(`Processing charge.success for reference: ${data.reference}`);

        const metadata = data.metadata || {};
        const userId =
            metadata.userId ||
            metadata.custom_fields?.find((f: any) => f.variable_name === 'user_id')?.value;
        const _tier =
            metadata.tier ||
            metadata.custom_fields?.find((f: any) => f.variable_name === 'tier')?.value;

        if (!userId) {
            this.logger.warn(`No userId found in charge metadata for reference ${data.reference}`);
            return;
        }

        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            this.logger.error(`No subscription record found for user ${userId}`);
            return;
        }

        // If this is a subscription payment, the plan will be in the data
        if (data.plan) {
            const subscriptionTier = this.determineTierFromPlan(data.plan);
            const limits = this.getLimitsForTier(subscriptionTier);

            await this.databaseService.subscription.update({
                where: { userId },
                data: {
                    tier: subscriptionTier,
                    premiumStartedAt: subscription.premiumStartedAt || new Date(),
                    premiumExpiresAt: this.calculateNextBillingDate(),
                    geminiEpisodeLimit: limits.geminiEpisodeLimit,
                    standardEpisodeLimit: limits.standardEpisodeLimit,
                    paystackCustomerCode:
                        data.customer?.customer_code || subscription.paystackCustomerCode,
                },
            });

            this.logger.log(`User ${userId} payment successful, tier: ${subscriptionTier}`);

            const tierName = subscriptionTier === 'PRO' ? 'Pro' : 'Starter';
            await this.sendNotification(
                userId,
                'Payment Successful',
                `Your ${tierName} subscription payment was successful. Thank you!`,
            );
        }
    }

    async handleSubscriptionCreate(data: PaystackSubscription): Promise<void> {
        this.logger.log(`Processing subscription.create: ${data.subscription_code}`);

        const customerEmail = data.customer?.email;
        if (!customerEmail) {
            this.logger.warn('No customer email in subscription create event');
            return;
        }

        // Find user by customer code or email
        let subscription = await this.databaseService.subscription.findFirst({
            where: { paystackCustomerCode: data.customer.customer_code },
        });

        if (!subscription) {
            // Try to find by user email
            const user = await this.databaseService.user.findUnique({
                where: { email: customerEmail },
            });

            if (user) {
                subscription = await this.databaseService.subscription.findUnique({
                    where: { userId: user.id },
                });
            }
        }

        if (!subscription) {
            this.logger.error(
                `No subscription record found for customer ${data.customer.customer_code}`,
            );
            return;
        }

        const tier = this.determineTierFromPlan(data.plan);
        const limits = this.getLimitsForTier(tier);

        await this.databaseService.subscription.update({
            where: { id: subscription.id },
            data: {
                paystackSubscriptionCode: data.subscription_code,
                paystackEmailToken: data.email_token,
                paystackCustomerCode: data.customer.customer_code,
                tier,
                premiumStartedAt: new Date(),
                premiumExpiresAt: data.next_payment_date
                    ? new Date(data.next_payment_date)
                    : this.calculateNextBillingDate(),
                geminiEpisodeLimit: limits.geminiEpisodeLimit,
                standardEpisodeLimit: limits.standardEpisodeLimit,
            },
        });

        this.logger.log(`User ${subscription.userId} subscribed to ${tier}`);

        const tierName = tier === 'PRO' ? 'Pro' : 'Starter';
        await this.sendNotification(
            subscription.userId,
            `Welcome to Auditure ${tierName}!`,
            tier === 'PRO'
                ? 'Enjoy 100 podcast episodes per month with priority processing!'
                : 'Enjoy 30 podcast episodes per month!',
        );
    }

    async handleSubscriptionDisable(data: any): Promise<void> {
        const subscriptionCode = data.subscription_code;
        this.logger.log(`Processing subscription.disable: ${subscriptionCode}`);

        const subscription = await this.databaseService.subscription.findFirst({
            where: { paystackSubscriptionCode: subscriptionCode },
        });

        if (!subscription) {
            this.logger.warn(`No subscription record found for ${subscriptionCode}`);
            return;
        }

        const freeLimits = this.getLimitsForTier('FREE');

        await this.databaseService.subscription.update({
            where: { id: subscription.id },
            data: {
                tier: 'FREE',
                paystackSubscriptionCode: null,
                paystackEmailToken: null,
                premiumExpiresAt: new Date(),
                geminiEpisodeLimit: freeLimits.geminiEpisodeLimit,
                standardEpisodeLimit: freeLimits.standardEpisodeLimit,
                geminiEpisodesUsed: 0,
                standardEpisodesUsed: 0,
                usagePeriodStart: new Date(),
            },
        });

        this.logger.log(`User ${subscription.userId} downgraded to FREE tier`);

        await this.sendNotification(
            subscription.userId,
            'Subscription Ended',
            'Your subscription has ended. Re-subscribe anytime to continue creating episodes.',
        );
    }

    async handleSubscriptionNotRenew(data: any): Promise<void> {
        const subscriptionCode = data.subscription_code;
        this.logger.log(`Processing subscription.not_renew: ${subscriptionCode}`);

        const subscription = await this.databaseService.subscription.findFirst({
            where: { paystackSubscriptionCode: subscriptionCode },
        });

        if (!subscription) {
            this.logger.warn(`No subscription record found for ${subscriptionCode}`);
            return;
        }

        await this.sendNotification(
            subscription.userId,
            'Subscription Cancellation Scheduled',
            'Your subscription will not renew. You can continue using premium features until the end of your billing period.',
        );
    }

    async handleInvoicePaymentFailed(data: any): Promise<void> {
        this.logger.log(`Processing invoice.payment_failed`);

        const subscriptionCode = data.subscription?.subscription_code;
        if (!subscriptionCode) {
            this.logger.debug('No subscription in invoice, skipping');
            return;
        }

        const subscription = await this.databaseService.subscription.findFirst({
            where: { paystackSubscriptionCode: subscriptionCode },
        });

        if (!subscription) {
            this.logger.warn(`No subscription record found for ${subscriptionCode}`);
            return;
        }

        this.logger.warn(`Payment failed for user ${subscription.userId}`);

        await this.sendNotification(
            subscription.userId,
            'Payment Failed',
            "We couldn't process your subscription payment. Please update your payment method.",
        );
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
     * Determine subscription tier from Paystack plan
     */
    private determineTierFromPlan(plan: any): 'STARTER' | 'PRO' {
        if (!plan) return 'STARTER';

        const planCode = plan.plan_code || plan;
        const starterPlanCode = process.env.PAYSTACK_PLAN_CODE_STARTER;
        const proPlanCode = process.env.PAYSTACK_PLAN_CODE_PRO;

        if (planCode === proPlanCode) return 'PRO';
        if (planCode === starterPlanCode) return 'STARTER';

        // Check by plan name as fallback
        const planName = plan.name?.toLowerCase() || '';
        if (planName.includes('pro')) return 'PRO';

        return 'STARTER';
    }

    /**
     * Calculate next billing date (30 days from now)
     */
    private calculateNextBillingDate(): Date {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
    }

    /**
     * Get episode limits for a subscription tier
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
