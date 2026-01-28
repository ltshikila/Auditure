import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsWebhookController } from './subscriptions-webhook.controller';
import { StripeService } from './stripe.service';

@Module({
    controllers: [SubscriptionsController, SubscriptionsWebhookController],
    providers: [SubscriptionsService, StripeService],
    exports: [SubscriptionsService, StripeService],
})
export class SubscriptionsModule {}
