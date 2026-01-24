import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ExpoPushService } from './expo-push.service';
import { DatabaseModule } from '../database/database.module';

/**
 * Module for managing user notifications.
 *
 * Provides:
 * - REST API for notification CRUD operations
 * - Push notification delivery via Expo Push API
 * - Redis Streams for async notification processing
 * - Background consumer for reliable delivery
 *
 * Dependencies:
 * - DatabaseModule (Prisma client)
 * - RedisModule (global, for Redis Streams)
 */
@Module({
    imports: [DatabaseModule],
    controllers: [NotificationsController],
    providers: [NotificationsService, ExpoPushService],
    exports: [NotificationsService],
})
export class NotificationsModule {}
