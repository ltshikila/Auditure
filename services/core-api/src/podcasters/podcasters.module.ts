import { Module } from '@nestjs/common';
import { PodcastersService } from './podcasters.service';
import { PodcastersController } from './podcasters.controller';

@Module({
  controllers: [PodcastersController],
  providers: [PodcastersService],
})
export class PodcastersModule {}
