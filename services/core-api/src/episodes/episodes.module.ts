import { Module, forwardRef } from '@nestjs/common';
import { EpisodesService } from './episodes.service';
import { EpisodesController } from './episodes.controller';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { BooksModule } from '../books/books.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Note: Script generation and TTS are now handled by the Python ai-worker service.
// The ai-worker consumes jobs from RabbitMQ and processes them independently.

@Module({
    imports: [DatabaseModule, CommonModule, forwardRef(() => BooksModule), UsersModule, NotificationsModule],
    controllers: [EpisodesController],
    providers: [EpisodesService],
    exports: [EpisodesService],
})
export class EpisodesModule {}
