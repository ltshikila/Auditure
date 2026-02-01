import { Controller, Get, Post, Body, Query, UseGuards, Request, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PaystackService } from './paystack.service';

@Controller('subscriptions')
export class SubscriptionsController {
    private readonly logger = new Logger(SubscriptionsController.name);

    constructor(
        private readonly subscriptionsService: SubscriptionsService,
        private readonly paystackService: PaystackService,
    ) {}

    /**
     * Get current subscription status
     * GET /subscriptions/status
     */
    @Get('status')
    @UseGuards(JwtAuthGuard)
    async getSubscriptionStatus(@Request() req) {
        const userId = req.user.userId;
        this.logger.debug(`Fetching subscription status for user ${userId}`);
        return this.subscriptionsService.getSubscriptionStatus(userId);
    }

    /**
     * Create a Paystack checkout session for subscription purchase
     * POST /subscriptions/checkout
     */
    @Post('checkout')
    @UseGuards(JwtAuthGuard)
    async createCheckoutSession(@Request() req, @Body() dto: CreateCheckoutSessionDto) {
        const userId = req.user.userId;
        return this.subscriptionsService.createCheckoutSession(userId, dto.tier);
    }

    /**
     * Get subscription management info
     * POST /subscriptions/manage
     * Note: Paystack doesn't have a built-in portal like Stripe
     */
    @Post('manage')
    @UseGuards(JwtAuthGuard)
    async getManageSubscription(@Request() req) {
        const userId = req.user.userId;
        return this.subscriptionsService.getManageSubscriptionUrl(userId);
    }

    /**
     * Cancel subscription
     * POST /subscriptions/cancel
     */
    @Post('cancel')
    @UseGuards(JwtAuthGuard)
    async cancelSubscription(@Request() req) {
        const userId = req.user.userId;
        return this.subscriptionsService.cancelSubscription(userId);
    }

    /**
     * Callback handler for Paystack payment redirect
     * GET /subscriptions/callback
     */
    @Get('callback')
    async handleCallback(@Query('reference') reference: string, @Query('trxref') trxref: string) {
        const ref = reference || trxref;
        this.logger.log(`Payment callback received for reference: ${ref}`);

        if (!ref) {
            const mobileScheme = this.paystackService.getMobileAppScheme();
            return {
                message: 'Missing payment reference',
                redirect: `${mobileScheme}://subscription/error`,
            };
        }

        try {
            const result = await this.subscriptionsService.handlePaymentCallback(ref);
            const mobileScheme = this.paystackService.getMobileAppScheme();

            if (result.success) {
                return {
                    message: 'Payment successful!',
                    redirect: `${mobileScheme}://subscription/success`,
                };
            } else {
                return {
                    message: `Payment ${result.status}`,
                    redirect: `${mobileScheme}://subscription/failed`,
                };
            }
        } catch (error: any) {
            this.logger.error(`Callback error: ${error.message}`);
            const mobileScheme = this.paystackService.getMobileAppScheme();
            return {
                message: 'Payment verification failed',
                redirect: `${mobileScheme}://subscription/error`,
            };
        }
    }

    /**
     * Success redirect handler (for web fallback)
     * GET /subscriptions/success
     */
    @Get('success')
    handleSuccess() {
        const mobileScheme = this.paystackService.getMobileAppScheme();
        return {
            message: 'Subscription successful!',
            redirect: `${mobileScheme}://subscription/success`,
        };
    }

    /**
     * Cancel redirect handler (for web fallback)
     * GET /subscriptions/cancel-redirect
     */
    @Get('cancel-redirect')
    handleCancelRedirect() {
        const mobileScheme = this.paystackService.getMobileAppScheme();
        return {
            message: 'Checkout cancelled',
            redirect: `${mobileScheme}://subscription/cancel`,
        };
    }
}
