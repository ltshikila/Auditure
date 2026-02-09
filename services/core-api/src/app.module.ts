import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PodcastersModule } from './podcasters/podcasters.module';
import { BooksModule } from './books/books.module';
import { EpisodesModule } from './episodes/episodes.module';
import { FeedModule } from './feed/feed.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { DatabaseModule } from './database/database.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { CommonModule } from './common/common.module';
import { RedisModule } from './redis/redis.module';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';

@Module({
    imports: [
        SentryModule.forRoot(), // Must be first — instruments other modules
        RedisModule, // Global module - must be imported early
        DatabaseModule, // Global module - provides Prisma client
        AuthModule,
        UsersModule,
        PodcastersModule,
        BooksModule,
        EpisodesModule,
        FeedModule,
        SubscriptionsModule, // Includes Paystack payment processing
        NotificationsModule,
        SearchModule,
        RabbitmqModule,
        CommonModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
