import { Module } from '@nestjs/common';
import { PodcastersService } from './podcasters.service';
import { PodcastersController } from './podcasters.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [PodcastersController],
    providers: [PodcastersService],
    exports: [PodcastersService],
})
export class PodcastersModule {}
