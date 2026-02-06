import { Module } from '@nestjs/common';
import { PodcastersService } from './podcasters.service';
import { PodcastersController } from './podcasters.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [DatabaseModule, NotificationsModule],
    controllers: [PodcastersController],
    providers: [PodcastersService],
    exports: [PodcastersService],
})
export class PodcastersModule {}
