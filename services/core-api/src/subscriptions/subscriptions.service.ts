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
                isCancelled: false,
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
        let isCancelled = false;

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

                // Subscription is cancelled if it's "non-renewing" on Paystack
                isCancelled = paystackSub.status === 'non-renewing';
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
            isCancelled,
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
     * @param isUpgrade - Whether this is an upgrade from an existing plan
     */
    async createCheckoutSession(userId: string, tier: 'starter' | 'pro', isUpgrade?: boolean) {
        this.logger.log(`Creating checkout session for user ${userId}, tier: ${tier}, isUpgrade: ${isUpgrade}`);

        if (!this.paystackService.isConfigured()) {
            throw new BadRequestException('Payment system is not configured');
        }

        // Get or create subscription record
        const subscription = await this.getOrCreateSubscription(userId);
        const requestedTier = tier.toUpperCase() as 'STARTER' | 'PRO';

        // Check if user has a cancelled (non-renewing) subscription to the SAME plan
        // If so, just re-enable it instead of creating a new checkout (no double charging)
        if (
            !isUpgrade &&
            subscription.tier === requestedTier &&
            subscription.paystackSubscriptionCode &&
            subscription.paystackEmailToken &&
            subscription.premiumExpiresAt &&
            subscription.premiumExpiresAt > new Date()
        ) {
            // Check if subscription is non-renewing on Paystack
            try {
                const paystackSub = await this.paystackService.getSubscription(
                    subscription.paystackSubscriptionCode,
                );

                if (paystackSub.status === 'non-renewing') {
                    this.logger.log(
                        `User ${userId} has non-renewing subscription to same plan - re-enabling instead of new checkout`,
                    );

                    // Re-enable the existing subscription (no charge until next billing date)
                    await this.paystackService.enableSubscription({
                        code: subscription.paystackSubscriptionCode,
                        token: subscription.paystackEmailToken,
                    });

                    return {
                        reEnabled: true,
                        message:
                            'Your subscription has been re-activated! You will be billed on your regular billing date.',
                    };
                }
            } catch (error: any) {
                this.logger.warn(`Error checking/re-enabling subscription: ${error.message}`);
                // Fall through to normal checkout if re-enable fails
            }
        }

        // Check if user already has an active paid subscription
        // Allow if this is an upgrade - the old subscription will be cancelled after successful payment
        if (!isUpgrade && (subscription.tier === 'STARTER' || subscription.tier === 'PRO')) {
            // Check if subscription hasn't expired
            if (!subscription.premiumExpiresAt || subscription.premiumExpiresAt > new Date()) {
                // Check if it's actively renewing (not cancelled)
                if (subscription.paystackSubscriptionCode) {
                    try {
                        const paystackSub = await this.paystackService.getSubscription(
                            subscription.paystackSubscriptionCode,
                        );
                        if (paystackSub.status === 'active') {
                            throw new BadRequestException(
                                'You already have an active subscription. Please manage it from your account.',
                            );
                        }
                    } catch (error: any) {
                        if (error instanceof BadRequestException) throw error;
                        // If we can't check Paystack, still allow checkout
                    }
                }
            }
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
        // Amount in cents (Paystack requires amount even with plan)
        const amountInCents = tier === 'starter' ? 999 : 2499;

        // Store old subscription info if this is an upgrade (for cancellation after success)
        const oldSubscriptionCode = isUpgrade ? subscription.paystackSubscriptionCode : null;
        const oldEmailToken = isUpgrade ? subscription.paystackEmailToken : null;

        const transaction = await this.paystackService.initializeTransaction({
            email: user.email,
            amount: amountInCents,
            plan: planCode,
            callback_url: `${appUrl}/subscriptions/callback`,
            metadata: {
                userId,
                tier,
                isUpgrade: isUpgrade || false,
                oldSubscriptionCode,
                oldEmailToken,
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
                    {
                        display_name: 'Is Upgrade',
                        variable_name: 'is_upgrade',
                        value: isUpgrade ? 'true' : 'false',
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
     * This also updates the subscription (in case webhooks aren't received)
     * For upgrades, cancels the old subscription AFTER successful payment
     */
    async handlePaymentCallback(reference: string) {
        this.logger.log(`Handling payment callback for reference: ${reference}`);

        if (!this.paystackService.isConfigured()) {
            throw new BadRequestException('Payment system is not configured');
        }

        const transaction = await this.paystackService.verifyTransaction(reference);

        this.logger.log(`Transaction verified: ${JSON.stringify(transaction)}`);

        if (transaction.status !== 'success') {
            this.logger.warn(`Transaction ${reference} was not successful: ${transaction.status}`);
            return { success: false, status: transaction.status };
        }

        // Extract user info from metadata
        const metadata = (transaction as any).metadata || {};
        this.logger.log(`Transaction metadata: ${JSON.stringify(metadata)}`);

        const userId =
            metadata.userId ||
            metadata.custom_fields?.find((f: any) => f.variable_name === 'user_id')?.value;
        const tier =
            metadata.tier ||
            metadata.custom_fields?.find((f: any) => f.variable_name === 'tier')?.value;
        const isUpgrade =
            metadata.isUpgrade ||
            metadata.custom_fields?.find((f: any) => f.variable_name === 'is_upgrade')?.value === 'true';
        const oldSubscriptionCode = metadata.oldSubscriptionCode;
        const oldEmailToken = metadata.oldEmailToken;

        this.logger.log(`Extracted userId: ${userId}, tier: ${tier}, isUpgrade: ${isUpgrade}`);

        // Determine tier from plan if not in metadata
        let subscriptionTier: 'STARTER' | 'PRO' = 'STARTER';
        if (tier) {
            subscriptionTier = tier.toUpperCase() as 'STARTER' | 'PRO';
        } else if (transaction.plan) {
            subscriptionTier = this.determineTierFromPlan(transaction.plan);
        }

        // Find user by metadata userId or by customer email
        let targetUserId = userId;
        if (!targetUserId && transaction.customer?.email) {
            const user = await this.databaseService.user.findUnique({
                where: { email: transaction.customer.email },
            });
            if (user) {
                targetUserId = user.id;
                this.logger.log(`Found user by email: ${targetUserId}`);
            }
        }

        if (targetUserId) {
            this.logger.log(`Activating subscription for user ${targetUserId}, tier: ${subscriptionTier}`);

            const limits = this.getLimitsForTier(subscriptionTier);

            const subscription = await this.databaseService.subscription.findUnique({
                where: { userId: targetUserId },
            });

            if (subscription) {
                // For upgrades: Cancel the old subscription on Paystack AFTER new payment succeeds
                if (isUpgrade && oldSubscriptionCode && oldEmailToken) {
                    this.logger.log(`Upgrade detected - cancelling old subscription: ${oldSubscriptionCode}`);
                    try {
                        await this.paystackService.disableSubscription({
                            code: oldSubscriptionCode,
                            token: oldEmailToken,
                        });
                        this.logger.log(`Old subscription ${oldSubscriptionCode} cancelled successfully`);
                    } catch (error: any) {
                        // Log but don't fail - the new subscription is already active
                        this.logger.warn(`Failed to cancel old subscription: ${error.message}`);
                    }
                }

                await this.databaseService.subscription.update({
                    where: { userId: targetUserId },
                    data: {
                        tier: subscriptionTier,
                        premiumStartedAt: subscription.premiumStartedAt || new Date(),
                        premiumExpiresAt: this.calculateNextBillingDate(),
                        geminiEpisodeLimit: limits.geminiEpisodeLimit,
                        standardEpisodeLimit: limits.standardEpisodeLimit,
                        paystackCustomerCode:
                            transaction.customer?.customer_code || subscription.paystackCustomerCode,
                    },
                });

                this.logger.log(`Subscription activated for user ${targetUserId}: ${subscriptionTier}`);
            }
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
     * Sets subscription to "non-renewing" on Paystack - user keeps benefits until billing period ends
     * We keep the tier and Paystack codes so user can re-enable if they change their mind
     */
    async cancelSubscription(userId: string) {
        this.logger.log(`Cancelling subscription for user ${userId}`);

        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription || subscription.tier === 'FREE') {
            throw new BadRequestException('No active subscription found.');
        }

        // Try to cancel on Paystack if we have the subscription code
        // This sets the subscription to "non-renewing" - user keeps access until billing period ends
        if (subscription.paystackSubscriptionCode && subscription.paystackEmailToken) {
            try {
                await this.paystackService.disableSubscription({
                    code: subscription.paystackSubscriptionCode,
                    token: subscription.paystackEmailToken,
                });
                this.logger.log(`Paystack subscription set to non-renewing for user ${userId}`);
            } catch (error: any) {
                this.logger.warn(`Failed to disable Paystack subscription: ${error.message}`);
                throw new BadRequestException('Failed to cancel subscription. Please try again.');
            }
        } else {
            throw new BadRequestException('No Paystack subscription found to cancel.');
        }

        // DON'T change tier to FREE or clear codes - user keeps benefits until premiumExpiresAt
        // The webhook (subscription.disable) will handle the actual downgrade when the period ends
        // Keeping codes allows user to re-enable if they change their mind

        this.logger.log(`Subscription cancelled (non-renewing) for user ${userId}`);

        const expiresAt = subscription.premiumExpiresAt
            ? new Date(subscription.premiumExpiresAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
              })
            : 'the end of your billing period';

        return {
            success: true,
            message: `Your subscription has been cancelled. You'll continue to have access until ${expiresAt}.`,
        };
    }

    /**
     * Re-enable a cancelled (non-renewing) subscription
     * Only works if subscription is still within the billing period
     */
    async reEnableSubscription(userId: string) {
        this.logger.log(`Re-enabling subscription for user ${userId}`);

        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription || subscription.tier === 'FREE') {
            throw new BadRequestException('No subscription found to re-enable.');
        }

        if (!subscription.paystackSubscriptionCode || !subscription.paystackEmailToken) {
            throw new BadRequestException('No Paystack subscription found to re-enable.');
        }

        // Check if subscription hasn't expired yet
        if (subscription.premiumExpiresAt && subscription.premiumExpiresAt < new Date()) {
            throw new BadRequestException(
                'Your billing period has ended. Please start a new subscription.',
            );
        }

        try {
            await this.paystackService.enableSubscription({
                code: subscription.paystackSubscriptionCode,
                token: subscription.paystackEmailToken,
            });
            this.logger.log(`Paystack subscription re-enabled for user ${userId}`);

            return {
                success: true,
                message: 'Your subscription has been re-activated! You will be billed on your regular billing date.',
            };
        } catch (error: any) {
            this.logger.error(`Failed to re-enable subscription: ${error.message}`);
            throw new BadRequestException('Failed to re-enable subscription. Please try again or start a new subscription.');
        }
    }

    // Webhook handlers

    async handleChargeSuccess(data: any): Promise<void> {
        this.logger.log(`Processing charge.success for reference: ${data.reference}`);

        const metadata = data.metadata || {};
        const userId =
            metadata.userId ||
            metadata.custom_fields?.find((f: any) => f.variable_name === 'user_id')?.value;

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
