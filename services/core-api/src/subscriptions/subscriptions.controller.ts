import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    Request,
    Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CreatePortalSessionDto } from './dto/create-portal-session.dto';
import { StripeService } from './stripe.service';

@Controller('subscriptions')
export class SubscriptionsController {
    private readonly logger = new Logger(SubscriptionsController.name);

    constructor(
        private readonly subscriptionsService: SubscriptionsService,
        private readonly stripeService: StripeService,
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
     * Create a Stripe Checkout session for subscription purchase
     * POST /subscriptions/checkout
     */
    @Post('checkout')
    @UseGuards(JwtAuthGuard)
    async createCheckoutSession(
        @Request() req,
        @Body() dto: CreateCheckoutSessionDto,
    ) {
        const userId = req.user.userId;
        return this.subscriptionsService.createCheckoutSession(userId, dto.tier);
    }

    /**
     * Create a Stripe Customer Portal session for subscription management
     * POST /subscriptions/portal
     */
    @Post('portal')
    @UseGuards(JwtAuthGuard)
    async createPortalSession(
        @Request() req,
        @Body() dto: CreatePortalSessionDto,
    ) {
        const userId = req.user.userId;
        return this.subscriptionsService.createPortalSession(userId, dto.returnUrl);
    }

    /**
     * Redirect handler for successful checkout
     * GET /subscriptions/success
     */
    @Get('success')
    async handleSuccess() {
        const mobileScheme = this.stripeService.getMobileAppScheme();
        return {
            message: 'Subscription successful!',
            redirect: `${mobileScheme}://subscription/success`,
        };
    }

    /**
     * Redirect handler for cancelled checkout
     * GET /subscriptions/cancel
     */
    @Get('cancel')
    async handleCancel() {
        const mobileScheme = this.stripeService.getMobileAppScheme();
        return {
            message: 'Checkout cancelled',
            redirect: `${mobileScheme}://subscription/cancel`,
        };
    }
}
