import { Controller, Get, Post, Body, Query, UseGuards, Request, Logger, Res } from '@nestjs/common';
import type { Response } from 'express';
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
        return this.subscriptionsService.createCheckoutSession(userId, dto.tier, dto.isUpgrade);
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
     * Re-enable a cancelled subscription
     * POST /subscriptions/reactivate
     */
    @Post('reactivate')
    @UseGuards(JwtAuthGuard)
    async reactivateSubscription(@Request() req) {
        const userId = req.user.userId;
        return this.subscriptionsService.reEnableSubscription(userId);
    }

    /**
     * Cleanup duplicate Paystack subscriptions
     * POST /subscriptions/cleanup-duplicates
     */
    @Post('cleanup-duplicates')
    @UseGuards(JwtAuthGuard)
    async cleanupDuplicates(@Request() req) {
        const userId = req.user.userId;
        return this.subscriptionsService.cleanupDuplicateSubscriptions(userId);
    }

    /**
     * Callback handler for Paystack payment redirect
     * GET /subscriptions/callback
     * Shows a page that redirects user back to the mobile app
     */
    @Get('callback')
    async handleCallback(
        @Query('reference') reference: string,
        @Query('trxref') trxref: string,
        @Res() res: Response,
    ) {
        const ref = reference || trxref;
        this.logger.log(`Payment callback received for reference: ${ref}`);
        const mobileScheme = this.paystackService.getMobileAppScheme();

        let deepLink: string;
        let status: 'success' | 'failed' | 'error';
        let message: string;

        if (!ref) {
            this.logger.warn('Missing payment reference in callback');
            deepLink = `${mobileScheme}://subscription?status=error&message=missing_reference`;
            status = 'error';
            message = 'Missing payment reference';
        } else {
            try {
                const result = await this.subscriptionsService.handlePaymentCallback(ref);

                if (result.success) {
                    this.logger.log(`Payment successful, redirecting to app`);
                    deepLink = `${mobileScheme}://subscription?status=success`;
                    status = 'success';
                    message = 'Payment successful! Your subscription is now active.';
                } else {
                    this.logger.log(`Payment failed with status: ${result.status}`);
                    deepLink = `${mobileScheme}://subscription?status=failed&reason=${result.status}`;
                    status = 'failed';
                    message = `Payment ${result.status}. Please try again.`;
                }
            } catch (error: any) {
                this.logger.error(`Callback error: ${error.message}`);
                deepLink = `${mobileScheme}://subscription?status=error&message=verification_failed`;
                status = 'error';
                message = 'Could not verify payment. Please contact support.';
            }
        }

        // Return HTML page that attempts redirect and shows a button as fallback
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Auditure - Payment ${status === 'success' ? 'Complete' : 'Status'}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #F5F0E6 0%, #EDE8DC 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 24px;
            padding: 40px 32px;
            max-width: 380px;
            width: 100%;
            text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        .icon {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-size: 36px;
        }
        .icon.success { background: #E8F5E9; }
        .icon.failed, .icon.error { background: #FFEBEE; }
        h1 {
            font-size: 24px;
            color: #1A1C1E;
            margin-bottom: 12px;
            font-weight: 700;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 32px;
        }
        .btn {
            display: block;
            width: 100%;
            padding: 16px 24px;
            background: linear-gradient(135deg, #BF9A54 0%, #D4AF37 100%);
            color: white;
            text-decoration: none;
            border-radius: 16px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:active {
            transform: scale(0.98);
        }
        .hint {
            color: #999;
            font-size: 13px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon ${status}">
            ${status === 'success' ? '✓' : status === 'failed' ? '✕' : '!'}
        </div>
        <h1>${status === 'success' ? 'Payment Complete!' : status === 'failed' ? 'Payment Failed' : 'Error'}</h1>
        <p>${message}</p>
        <a href="${deepLink}" class="btn" id="openApp">Return to Auditure</a>
        <p class="hint" id="hint" style="display:none;">
            If the button doesn't work, close this browser window and open Auditure from your home screen. Your subscription is already active!
        </p>
    </div>
    <script>
        // Try to redirect immediately
        setTimeout(function() {
            window.location.href = "${deepLink}";
        }, 500);

        // Show hint after 2 seconds if still on page
        setTimeout(function() {
            document.getElementById('hint').style.display = 'block';
        }, 2000);

        // Track if user clicked the button
        document.getElementById('openApp').addEventListener('click', function(e) {
            // Give the link a moment to work
            setTimeout(function() {
                document.getElementById('hint').style.display = 'block';
            }, 1000);
        });
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }

    /**
     * Success redirect handler (for web fallback)
     * GET /subscriptions/success
     */
    @Get('success')
    handleSuccess(@Res() res: Response) {
        const mobileScheme = this.paystackService.getMobileAppScheme();
        return res.redirect(`${mobileScheme}://subscription?status=success`);
    }

    /**
     * Cancel redirect handler (for web fallback)
     * GET /subscriptions/cancel-redirect
     */
    @Get('cancel-redirect')
    handleCancelRedirect(@Res() res: Response) {
        const mobileScheme = this.paystackService.getMobileAppScheme();
        return res.redirect(`${mobileScheme}://subscription?status=cancelled`);
    }
}
