import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsWebhookController } from './subscriptions-webhook.controller';
import { PaystackService } from './paystack.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [SubscriptionsController, SubscriptionsWebhookController],
    providers: [SubscriptionsService, PaystackService],
    exports: [SubscriptionsService, PaystackService],
})
export class SubscriptionsModule {}
