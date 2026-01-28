import {
    Controller,
    Post,
    Headers,
    Req,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions/webhook')
export class SubscriptionsWebhookController {
    private readonly logger = new Logger(SubscriptionsWebhookController.name);

    constructor(
        private readonly stripeService: StripeService,
        private readonly subscriptionsService: SubscriptionsService,
    ) {}

    /**
     * Handle Stripe webhook events
     * POST /subscriptions/webhook
     *
     * IMPORTANT: This endpoint receives raw body for signature verification
     * and is NOT protected by JWT auth (Stripe sends webhooks directly)
     */
    @Post()
    async handleWebhook(
        @Headers('stripe-signature') signature: string,
        @Req() req: { rawBody?: Buffer },
    ) {
        if (!signature) {
            this.logger.warn('Webhook received without stripe-signature header');
            throw new BadRequestException('Missing stripe-signature header');
        }

        const rawBody = req.rawBody;
        if (!rawBody) {
            this.logger.error('Webhook received without raw body - check middleware configuration');
            throw new BadRequestException('Missing request body');
        }

        let event: Stripe.Event;

        try {
            event = this.stripeService.getClient().webhooks.constructEvent(
                rawBody,
                signature,
                this.stripeService.getWebhookSecret(),
            );
        } catch (err: any) {
            this.logger.error(`Webhook signature verification failed: ${err.message}`);
            throw new BadRequestException('Webhook signature verification failed');
        }

        this.logger.log(`Webhook received: ${event.type} (${event.id})`);

        // Process the event
        try {
            await this.processEvent(event);
        } catch (error: any) {
            this.logger.error(
                `Error processing webhook ${event.type}: ${error.message}`,
                error.stack,
            );
            // Return 200 to acknowledge receipt - Stripe will retry on 4xx/5xx
        }

        return { received: true, eventId: event.id };
    }

    private async processEvent(event: Stripe.Event): Promise<void> {
        switch (event.type) {
            case 'customer.subscription.created':
                await this.subscriptionsService.handleSubscriptionCreated(
                    event.data.object as Stripe.Subscription,
                );
                break;

            case 'customer.subscription.updated':
                await this.subscriptionsService.handleSubscriptionUpdated(
                    event.data.object as Stripe.Subscription,
                );
                break;

            case 'customer.subscription.deleted':
                await this.subscriptionsService.handleSubscriptionDeleted(
                    event.data.object as Stripe.Subscription,
                );
                break;

            case 'invoice.payment_failed':
                await this.subscriptionsService.handlePaymentFailed(
                    event.data.object as Stripe.Invoice,
                );
                break;

            case 'invoice.payment_succeeded':
                await this.subscriptionsService.handlePaymentSucceeded(
                    event.data.object as Stripe.Invoice,
                );
                break;

            default:
                this.logger.debug(`Unhandled webhook event type: ${event.type}`);
        }
    }
}
