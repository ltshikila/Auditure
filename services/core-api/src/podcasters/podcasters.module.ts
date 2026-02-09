import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PodcastersService } from './podcasters.service';
import { PodcastersController } from './podcasters.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        DatabaseModule,
        NotificationsModule,
        MulterModule.register({
            storage: memoryStorage(),
        }),
    ],
    controllers: [PodcastersController],
    providers: [PodcastersService],
    exports: [PodcastersService],
})
export class PodcastersModule {}
