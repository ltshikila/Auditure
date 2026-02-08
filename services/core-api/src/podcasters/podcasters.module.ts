import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PodcastersService } from './podcasters.service';
import { PodcastersController } from './podcasters.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        DatabaseModule,
        NotificationsModule,
        MulterModule.register({
            storage: require('multer').memoryStorage(),
        }),
    ],
    controllers: [PodcastersController],
    providers: [PodcastersService],
    exports: [PodcastersService],
})
export class PodcastersModule {}
