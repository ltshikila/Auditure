import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsWebhookController } from './subscriptions-webhook.controller';
import { RevenueCatService } from './revenuecat.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';
import { PaystackService } from './paystack.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [
        SubscriptionsController,
        SubscriptionsWebhookController,
        RevenueCatWebhookController,
    ],
    providers: [SubscriptionsService, PaystackService, RevenueCatService],
    exports: [SubscriptionsService, PaystackService, RevenueCatService],
})
export class SubscriptionsModule {}
