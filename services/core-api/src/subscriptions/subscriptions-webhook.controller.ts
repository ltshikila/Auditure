import {
    Controller,
    Post,
    Headers,
    Req,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaystackService } from './paystack.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions/webhook')
export class SubscriptionsWebhookController {
    private readonly logger = new Logger(SubscriptionsWebhookController.name);

    constructor(
        private readonly paystackService: PaystackService,
        private readonly subscriptionsService: SubscriptionsService,
    ) {}

    /**
     * Handle Paystack webhook events
     * POST /subscriptions/webhook
     *
     * IMPORTANT: This endpoint receives raw body for signature verification
     * and is NOT protected by JWT auth (Paystack sends webhooks directly)
     */
    @Post()
    async handleWebhook(
        @Headers('x-paystack-signature') signature: string,
        @Req() req: RawBodyRequest<Request>,
    ) {
        if (!signature) {
            this.logger.warn('Webhook received without x-paystack-signature header');
            throw new BadRequestException('Missing x-paystack-signature header');
        }

        const rawBody = req.rawBody;
        if (!rawBody) {
            this.logger.error('Webhook received without raw body - check middleware configuration');
            throw new BadRequestException('Missing request body');
        }

        // Verify webhook signature
        const payload = rawBody.toString('utf8');
        const isValid = this.paystackService.verifyWebhookSignature(payload, signature);

        if (!isValid) {
            this.logger.error('Webhook signature verification failed');
            throw new BadRequestException('Webhook signature verification failed');
        }

        let event: { event: string; data: any };

        try {
            event = JSON.parse(payload);
        } catch (err: any) {
            this.logger.error(`Failed to parse webhook payload: ${err.message}`);
            throw new BadRequestException('Invalid webhook payload');
        }

        this.logger.log(`Webhook received: ${event.event}`);

        // Process the event
        try {
            await this.processEvent(event);
        } catch (error: any) {
            this.logger.error(
                `Error processing webhook ${event.event}: ${error.message}`,
                error.stack,
            );
            // Return 200 to acknowledge receipt - Paystack will retry on 4xx/5xx
        }

        return { received: true, event: event.event };
    }

    private async processEvent(event: { event: string; data: any }): Promise<void> {
        switch (event.event) {
            case 'charge.success':
                await this.subscriptionsService.handleChargeSuccess(event.data);
                break;

            case 'subscription.create':
                await this.subscriptionsService.handleSubscriptionCreate(event.data);
                break;

            case 'subscription.disable':
                await this.subscriptionsService.handleSubscriptionDisable(event.data);
                break;

            case 'subscription.not_renew':
                await this.subscriptionsService.handleSubscriptionNotRenew(event.data);
                break;

            case 'invoice.payment_failed':
                await this.subscriptionsService.handleInvoicePaymentFailed(event.data);
                break;

            case 'invoice.create':
                this.logger.log(`Invoice created for upcoming charge`);
                break;

            case 'invoice.update':
                this.logger.log(`Invoice updated`);
                break;

            default:
                this.logger.debug(`Unhandled webhook event type: ${event.event}`);
        }
    }
}
