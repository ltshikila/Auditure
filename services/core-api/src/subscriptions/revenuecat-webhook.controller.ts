import {
    BadRequestException,
    Controller,
    Headers,
    Logger,
    Post,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RevenueCatService } from './revenuecat.service';
import type { RevenueCatWebhookPayload } from './dto/revenuecat-webhook.dto';

@Controller('subscriptions/rc-webhook')
export class RevenueCatWebhookController {
    private readonly logger = new Logger(RevenueCatWebhookController.name);

    constructor(private readonly revenueCatService: RevenueCatService) {}

    /**
     * RevenueCat webhook endpoint.
     * POST /subscriptions/rc-webhook
     *
     * Auth: RC sends a static `Authorization` header that we configure in the
     * RC dashboard. We compare it to REVENUECAT_WEBHOOK_AUTH_HEADER from env.
     *
     * Not behind JwtAuthGuard — RC calls it directly. We always return 200 on
     * processing errors so RC doesn't retry forever; bad-auth/bad-body still
     * return 4xx because retrying those won't help.
     */
    @Post()
    async handle(
        @Headers('authorization') authHeader: string | undefined,
        @Req() req: Request,
    ) {
        const expected = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
        if (!expected) {
            this.logger.error('REVENUECAT_WEBHOOK_AUTH_HEADER is not configured');
            throw new UnauthorizedException('Webhook auth not configured');
        }
        if (!authHeader || authHeader !== expected) {
            this.logger.warn('RC webhook auth header mismatch');
            throw new UnauthorizedException('Invalid webhook auth');
        }

        const body = req.body as RevenueCatWebhookPayload | undefined;
        if (!body?.event?.type || !body.event.app_user_id) {
            throw new BadRequestException('Invalid RC webhook payload');
        }

        try {
            await this.revenueCatService.handleEvent(body.event);
        } catch (err: any) {
            this.logger.error(
                `RC event ${body.event.type} (${body.event.id}) for user ${body.event.app_user_id} failed: ${err.message}`,
                err.stack,
            );
            // Swallow so RC doesn't retry on transient backend errors. Real
            // problems surface in logs + Sentry; RC also has dashboard event
            // history for replay if we need to recover state.
        }

        return { received: true };
    }
}
