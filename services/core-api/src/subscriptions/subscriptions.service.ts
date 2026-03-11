import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaystackService, PaystackSubscription } from './paystack.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paystackService: PaystackService,
        private readonly notificationsService: NotificationsService,
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

        const isPaid = subscription.tier === 'STARTER' || subscription.tier === 'PRO';

        // Enforce expiry: if premium has expired, downgrade to FREE immediately
        if (isPaid && subscription.premiumExpiresAt && subscription.premiumExpiresAt < new Date()) {
            this.logger.log(
                `Premium expired for user ${userId} (expired: ${subscription.premiumExpiresAt?.toISOString()}) — downgrading to FREE`,
            );
            const freeLimits = this.getLimitsForTier('FREE');

            await this.databaseService.subscription.update({
                where: { userId },
                data: {
                    tier: 'FREE',
                    paystackSubscriptionCode: null,
                    paystackEmailToken: null,
                    geminiEpisodeLimit: freeLimits.geminiEpisodeLimit,
                    standardEpisodeLimit: freeLimits.standardEpisodeLimit,
                    geminiEpisodesUsed: 0,
                    standardEpisodesUsed: 0,
                    usagePeriodStart: new Date(),
                },
            });

            return {
                tier: 'FREE',
                isPaid: false,
                isCancelled: false,
                premiumStartedAt: subscription.premiumStartedAt,
                premiumExpiresAt: subscription.premiumExpiresAt,
                paystackSubscription: null,
                usage: {
                    geminiEpisodesUsed: 0,
                    standardEpisodesUsed: 0,
                    geminiEpisodeLimit: freeLimits.geminiEpisodeLimit,
                    standardEpisodeLimit: freeLimits.standardEpisodeLimit,
                },
            };
        }

        if (subscription.paystackSubscriptionCode && this.paystackService.isConfigured()) {
            try {
                const paystackSub = await this.paystackService.getSubscription(
                    subscription.paystackSubscriptionCode,
                );

                const status = paystackSub.status;

                if (status === 'active' || status === 'non-renewing') {
                    // Subscription exists and is either active or pending cancellation
                    paystackSubscription = {
                        status,
                        nextPaymentDate: paystackSub.next_payment_date
                            ? new Date(paystackSub.next_payment_date)
                            : null,
                    };
                    isCancelled = status === 'non-renewing';
                } else {
                    // Subscription is fully cancelled/completed on Paystack (e.g. "cancelled", "complete")
                    // Clear codes so user sees Subscribe Again instead of a broken Reactivate button
                    this.logger.log(
                        `Paystack subscription ${subscription.paystackSubscriptionCode} has status "${status}" - clearing codes`,
                    );
                    await this.databaseService.subscription.update({
                        where: { userId },
                        data: {
                            paystackSubscriptionCode: null,
                            paystackEmailToken: null,
                        },
                    });
                    isCancelled = true;
                }
            } catch (error: any) {
                this.logger.warn(
                    `Failed to fetch Paystack subscription ${subscription.paystackSubscriptionCode}: ${error.message}`,
                );
            }
        } else if (isPaid && !subscription.paystackSubscriptionCode) {
            // Paid tier but no Paystack subscription code could mean:
            // 1. Subscription was cancelled locally (user keeps benefits until expiry)
            // 2. Fresh subscription where we couldn't fetch the Paystack code yet
            // Only mark as cancelled if subscription was started more than 10 minutes ago
            // (gives time for Paystack to create subscription and webhook to arrive)
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const isRecentlyStarted =
                subscription.premiumStartedAt && subscription.premiumStartedAt > tenMinutesAgo;

            if (!isRecentlyStarted) {
                isCancelled = true;
            }
            // If recently started, assume it's a new subscription awaiting Paystack sync
        }

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
        this.logger.log(
            `Creating checkout session for user ${userId}, tier: ${tier}, isUpgrade: ${isUpgrade}`,
        );

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

        // Fallback: If codes were cleared from DB but customer has a non-renewing subscription
        // on Paystack for the same plan, try to re-enable it (avoids double-charging)
        if (
            !isUpgrade &&
            subscription.tier === requestedTier &&
            !subscription.paystackSubscriptionCode &&
            subscription.paystackCustomerCode &&
            subscription.premiumExpiresAt &&
            subscription.premiumExpiresAt > new Date()
        ) {
            try {
                const planCode = this.paystackService.getPlanCode(tier);
                const customerSubs = await this.paystackService.listCustomerSubscriptions(
                    subscription.paystackCustomerCode,
                );

                const nonRenewing = customerSubs.find(
                    sub => sub.plan?.plan_code === planCode && sub.status === 'non-renewing',
                );

                if (nonRenewing) {
                    this.logger.log(
                        `Found non-renewing subscription ${nonRenewing.subscription_code} for plan ${planCode} - attempting re-enable`,
                    );

                    await this.paystackService.enableSubscription({
                        code: nonRenewing.subscription_code,
                        token: nonRenewing.email_token,
                    });

                    // Save codes back to DB
                    await this.databaseService.subscription.update({
                        where: { userId },
                        data: {
                            paystackSubscriptionCode: nonRenewing.subscription_code,
                            paystackEmailToken: nonRenewing.email_token,
                        },
                    });

                    this.logger.log(
                        `Re-enabled subscription ${nonRenewing.subscription_code} for user ${userId}`,
                    );

                    return {
                        reEnabled: true,
                        message:
                            'Your subscription has been re-activated! You will be billed on your regular billing date.',
                    };
                }
            } catch (error: any) {
                this.logger.warn(`Fallback re-enable failed: ${error.message}`);
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
            metadata.custom_fields?.find((f: any) => f.variable_name === 'is_upgrade')?.value ===
                'true';
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
            this.logger.log(
                `Activating subscription for user ${targetUserId}, tier: ${subscriptionTier}`,
            );

            const limits = this.getLimitsForTier(subscriptionTier);

            const subscription = await this.databaseService.subscription.findUnique({
                where: { userId: targetUserId },
            });

            if (subscription) {
                // For upgrades: Cancel the old subscription on Paystack AFTER new payment succeeds
                if (isUpgrade && oldSubscriptionCode && oldEmailToken) {
                    this.logger.log(
                        `Upgrade detected - cancelling old subscription: ${oldSubscriptionCode}`,
                    );
                    try {
                        await this.paystackService.disableSubscription({
                            code: oldSubscriptionCode,
                            token: oldEmailToken,
                        });
                        this.logger.log(
                            `Old subscription ${oldSubscriptionCode} cancelled successfully`,
                        );
                    } catch (error: any) {
                        // Log but don't fail - the new subscription is already active
                        this.logger.warn(`Failed to cancel old subscription: ${error.message}`);
                    }
                }

                // Fetch subscription details from Paystack (since webhooks may not reach local server)
                // Paystack creates subscriptions asynchronously, so we may need to retry
                let paystackSubscriptionCode = subscription.paystackSubscriptionCode;
                let paystackEmailToken = subscription.paystackEmailToken;
                let premiumExpiresAt = this.calculateNextBillingDate();

                if (transaction.customer?.customer_code) {
                    const planCode = this.paystackService.getPlanCode(
                        tier || (subscriptionTier.toLowerCase() as 'starter' | 'pro'),
                    );

                    // Retry fetching subscription with delays (Paystack creates it asynchronously)
                    const maxRetries = 3;
                    const retryDelayMs = 2000; // 2 seconds between retries

                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            this.logger.log(
                                `Fetching customer subscriptions (attempt ${attempt}/${maxRetries})...`,
                            );
                            const subscriptions =
                                await this.paystackService.listCustomerSubscriptions(
                                    transaction.customer.customer_code,
                                );
                            this.logger.log(
                                `Found ${subscriptions.length} subscriptions for customer`,
                            );

                            // Find the most recent active (renewing) subscription for this plan
                            // Prefer 'active' over 'non-renewing'
                            let activeSubscription = subscriptions.find(
                                sub => sub.plan?.plan_code === planCode && sub.status === 'active',
                            );
                            if (!activeSubscription) {
                                activeSubscription = subscriptions.find(
                                    sub =>
                                        sub.plan?.plan_code === planCode &&
                                        sub.status === 'non-renewing',
                                );
                            }

                            if (activeSubscription) {
                                paystackSubscriptionCode = activeSubscription.subscription_code;
                                paystackEmailToken = activeSubscription.email_token;
                                if (activeSubscription.next_payment_date) {
                                    premiumExpiresAt = new Date(
                                        activeSubscription.next_payment_date,
                                    );
                                }
                                this.logger.log(
                                    `Found Paystack subscription: ${paystackSubscriptionCode}`,
                                );

                                // Cancel any OTHER active/non-renewing subscriptions (cleanup duplicates)
                                const otherSubscriptions = subscriptions.filter(
                                    sub =>
                                        sub.subscription_code !==
                                            activeSubscription.subscription_code &&
                                        (sub.status === 'active' || sub.status === 'non-renewing'),
                                );

                                for (const oldSub of otherSubscriptions) {
                                    try {
                                        this.logger.log(
                                            `Cancelling duplicate subscription: ${oldSub.subscription_code} (${oldSub.plan?.name}, status: ${oldSub.status})`,
                                        );
                                        await this.paystackService.disableSubscription({
                                            code: oldSub.subscription_code,
                                            token: oldSub.email_token,
                                        });
                                        this.logger.log(
                                            `Cancelled duplicate subscription: ${oldSub.subscription_code}`,
                                        );
                                    } catch (error: any) {
                                        this.logger.warn(
                                            `Failed to cancel duplicate subscription ${oldSub.subscription_code}: ${error.message}`,
                                        );
                                    }
                                }

                                break; // Success, exit retry loop
                            } else if (attempt < maxRetries) {
                                this.logger.log(
                                    `No matching subscription found yet, waiting ${retryDelayMs}ms before retry...`,
                                );
                                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                            }
                        } catch (error: any) {
                            this.logger.warn(
                                `Failed to fetch customer subscriptions (attempt ${attempt}): ${error.message}`,
                            );
                            if (attempt < maxRetries) {
                                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                            }
                        }
                    }

                    if (!paystackSubscriptionCode) {
                        this.logger.warn(
                            `Could not find subscription after ${maxRetries} attempts - will rely on webhook`,
                        );
                    }
                }

                await this.databaseService.subscription.update({
                    where: { userId: targetUserId },
                    data: {
                        tier: subscriptionTier,
                        premiumStartedAt: new Date(), // Always update to now for new payments
                        premiumExpiresAt,
                        geminiEpisodeLimit: limits.geminiEpisodeLimit,
                        standardEpisodeLimit: limits.standardEpisodeLimit,
                        geminiEpisodesUsed: 0,
                        standardEpisodesUsed: 0,
                        paystackCustomerCode:
                            transaction.customer?.customer_code ||
                            subscription.paystackCustomerCode,
                        paystackSubscriptionCode,
                        paystackEmailToken,
                    },
                });

                this.logger.log(
                    `Subscription activated for user ${targetUserId}: ${subscriptionTier}, code: ${paystackSubscriptionCode}`,
                );
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
        } else if (subscription.paystackCustomerCode) {
            // Try to find and cancel subscription by customer code (for older subscriptions missing codes)
            try {
                this.logger.log(
                    `Looking up subscriptions for customer: ${subscription.paystackCustomerCode}`,
                );
                const subscriptions = await this.paystackService.listCustomerSubscriptions(
                    subscription.paystackCustomerCode,
                );
                this.logger.log(
                    `Found ${subscriptions.length} subscriptions: ${JSON.stringify(subscriptions.map(s => ({ code: s.subscription_code, status: s.status, plan: s.plan?.plan_code })))}`,
                );
                const activeSubscription = subscriptions.find(
                    sub => sub.status === 'active' || sub.status === 'non-renewing',
                );
                if (activeSubscription) {
                    await this.paystackService.disableSubscription({
                        code: activeSubscription.subscription_code,
                        token: activeSubscription.email_token,
                    });
                    // Store the codes for future use
                    await this.databaseService.subscription.update({
                        where: { userId },
                        data: {
                            paystackSubscriptionCode: activeSubscription.subscription_code,
                            paystackEmailToken: activeSubscription.email_token,
                        },
                    });
                    this.logger.log(
                        `Found and disabled subscription ${activeSubscription.subscription_code} for user ${userId}`,
                    );
                } else {
                    // No active subscription on Paystack - mark as cancelled locally
                    // User keeps their tier benefits until premiumExpiresAt
                    this.logger.warn(
                        `No active Paystack subscription found for customer ${subscription.paystackCustomerCode} - marking as cancelled locally`,
                    );
                    await this.databaseService.subscription.update({
                        where: { userId },
                        data: {
                            paystackSubscriptionCode: null,
                            paystackEmailToken: null,
                        },
                    });

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
            } catch (error: any) {
                if (error instanceof BadRequestException) throw error;
                this.logger.error(`Failed to find/cancel subscription: ${error.message}`);
                throw new BadRequestException(
                    'Failed to cancel subscription. Please contact support.',
                );
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
                message:
                    'Your subscription has been re-activated! You will be billed on your regular billing date.',
            };
        } catch (error: any) {
            this.logger.error(`Failed to re-enable subscription: ${error.message}`);

            // If reactivation fails (subscription fully cancelled), clear the codes
            // so user sees "Subscribe Again" flow instead of stuck "Reactivate" button
            if (
                error.message?.includes('cannot be reactivated') ||
                error.message?.includes('has been cancelled')
            ) {
                this.logger.log(
                    `Subscription cannot be reactivated - clearing Paystack codes for user ${userId}`,
                );
                await this.databaseService.subscription.update({
                    where: { userId },
                    data: {
                        paystackSubscriptionCode: null,
                        paystackEmailToken: null,
                        // Clear premiumStartedAt to bypass the 10-minute grace period in getSubscriptionStatus
                        // so the subscription correctly shows as "Cancelled" instead of "Active"
                        // (premiumExpiresAt still controls benefit access)
                        premiumStartedAt: null,
                    },
                });

                throw new BadRequestException(
                    'This subscription cannot be reactivated. Please subscribe again to continue.',
                );
            }

            throw new BadRequestException(
                'Failed to re-enable subscription. Please try again or start a new subscription.',
            );
        }
    }

    /**
     * Cleanup duplicate Paystack subscriptions for a user.
     * Keeps only the subscription matching the DB record, cancels all others.
     */
    async cleanupDuplicateSubscriptions(userId: string) {
        this.logger.log(`Cleaning up duplicate subscriptions for user ${userId}`);

        const subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        if (!subscription?.paystackCustomerCode) {
            throw new BadRequestException('No Paystack customer found for this user.');
        }

        const subscriptions = await this.paystackService.listCustomerSubscriptions(
            subscription.paystackCustomerCode,
        );

        const cancelable = subscriptions.filter(
            sub => sub.status === 'active' || sub.status === 'non-renewing',
        );

        this.logger.log(`Found ${cancelable.length} active/non-renewing subscriptions`);

        if (cancelable.length <= 1) {
            return {
                message: `No duplicates. ${cancelable.length} active subscription(s).`,
                cancelled: 0,
            };
        }

        const keepCode = subscription.paystackSubscriptionCode;
        const toCancel = keepCode
            ? cancelable.filter(sub => sub.subscription_code !== keepCode)
            : cancelable.slice(1);

        let cancelled = 0;
        for (const sub of toCancel) {
            try {
                this.logger.log(
                    `Cancelling duplicate: ${sub.subscription_code} (${sub.plan?.name}, ${sub.status})`,
                );
                await this.paystackService.disableSubscription({
                    code: sub.subscription_code,
                    token: sub.email_token,
                });
                cancelled++;
            } catch (error: any) {
                this.logger.warn(`Failed to cancel ${sub.subscription_code}: ${error.message}`);
            }
        }

        return {
            message: `Cleaned up ${cancelled} duplicate(s). Kept ${keepCode || cancelable[0]?.subscription_code}.`,
            cancelled,
        };
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
                    geminiEpisodesUsed: 0,
                    standardEpisodesUsed: 0,
                    paystackCustomerCode:
                        data.customer?.customer_code || subscription.paystackCustomerCode,
                },
            });

            this.logger.log(`User ${userId} payment successful, tier: ${subscriptionTier}, usage reset`);

            const tierName = subscriptionTier === 'PRO' ? 'Pro' : 'Starter';
            await this.notificationsService.notifySystem(
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
                geminiEpisodesUsed: 0,
                standardEpisodesUsed: 0,
            },
        });

        this.logger.log(`User ${subscription.userId} subscribed to ${tier}, usage reset`);

        const tierName = tier === 'PRO' ? 'Pro' : 'Starter';
        await this.notificationsService.notifySystem(
            subscription.userId,
            `Welcome to Auditure ${tierName}!`,
            tier === 'PRO'
                ? 'Enjoy 50 podcast episodes per month with priority processing!'
                : 'Enjoy 20 podcast episodes per month!',
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

        // Don't downgrade immediately — user keeps benefits until premiumExpiresAt.
        // The disable webhook fires when the subscription is set to non-renewing,
        // not when it fully expires. Actual downgrade happens in getSubscriptionStatus
        // when premiumExpiresAt passes or when Paystack reports the sub as fully cancelled.
        const expiresAt = subscription.premiumExpiresAt
            ? new Date(subscription.premiumExpiresAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
              })
            : 'the end of your billing period';

        this.logger.log(
            `Subscription ${subscriptionCode} set to non-renewing for user ${subscription.userId} — keeping benefits until ${expiresAt}`,
        );

        await this.notificationsService.notifySystem(
            subscription.userId,
            'Subscription Cancellation Scheduled',
            `Your subscription won't renew, but you'll keep premium access until ${expiresAt}. You can reactivate anytime before then.`,
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

        await this.notificationsService.notifySystem(
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

        await this.notificationsService.notifySystem(
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
                // Hybrid model: 1 Gemini + 2 Standard (separate limits)
                return { geminiEpisodeLimit: 1, standardEpisodeLimit: 2 };
            case 'STARTER':
                // Unified: 20 total episodes (either Gemini or Standard)
                return { geminiEpisodeLimit: 20, standardEpisodeLimit: 20 };
            case 'PRO':
                // Unified: 50 total episodes (either Gemini or Standard)
                return { geminiEpisodeLimit: 50, standardEpisodeLimit: 50 };
            default:
                return { geminiEpisodeLimit: 1, standardEpisodeLimit: 2 };
        }
    }

    /**
     * Get maximum episode duration (in minutes) for a subscription tier
     */
    getMaxDurationForTier(tier: 'FREE' | 'STARTER' | 'PRO'): number {
        switch (tier) {
            case 'FREE':
                return 10;
            case 'STARTER':
            case 'PRO':
                return 30;
            default:
                return 10;
        }
    }
}
