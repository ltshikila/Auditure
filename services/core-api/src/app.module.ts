import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PodcastersModule } from './podcasters/podcasters.module';
import { BooksModule } from './books/books.module';
import { EpisodesModule } from './episodes/episodes.module';
import { FeedModule } from './feed/feed.module';
import { SocialModule } from './social/social.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { DatabaseModule } from './database/database.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { CommonModule } from './common/common.module';

@Module({
    imports: [
        AuthModule,
        UsersModule,
        PodcastersModule,
        BooksModule,
        EpisodesModule,
        FeedModule,
        SocialModule,
        SubscriptionsModule,
        DatabaseModule,
        RabbitmqModule,
        CommonModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
