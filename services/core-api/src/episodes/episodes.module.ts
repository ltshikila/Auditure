import { Module } from '@nestjs/common';
import { EpisodesService } from './episodes.service';
import { EpisodesController } from './episodes.controller';
import { ScriptGenerationService } from './services/script-generation.service';
import { TTSService } from './services/tts.service';
import { EpisodeGenerationWorker } from './workers/episode-generation.worker';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [DatabaseModule, CommonModule],
    controllers: [EpisodesController],
    providers: [
        EpisodesService,
        ScriptGenerationService,
        TTSService,
        EpisodeGenerationWorker,
    ],
    exports: [EpisodesService],
})
export class EpisodesModule {}
