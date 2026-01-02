import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../common/storage.service';
import { ScriptGenerationService } from '../services/script-generation.service';
import { TTSService } from '../services/tts.service';
import { EpisodeGenerationJob } from '../../rabbitmq/interfaces/jobs.interface';
import { EpisodeStatus } from '../dto/episode-response.dto';

@Injectable()
export class EpisodeGenerationWorker implements OnModuleInit {
    private readonly logger = new Logger(EpisodeGenerationWorker.name);

    constructor(
        private rabbitMQService: RabbitMQService,
        private databaseService: DatabaseService,
        private storageService: StorageService,
        private scriptGenerationService: ScriptGenerationService,
        private ttsService: TTSService,
    ) {}

    async onModuleInit() {
        await this.rabbitMQService.consumeEpisodeGenerationQueue(
            this.handleGenerationJob.bind(this),
        );
        this.logger.log('Episode generation worker started');
    }

    /**
     * Main job handler for episode generation
     */
    private async handleGenerationJob(job: EpisodeGenerationJob): Promise<void> {
        this.logger.log(`Processing episode generation job: ${job.episodeId}`);

        try {
            // Step 1: Update status to SCRIPT_GENERATING
            await this.updateStatus(job.episodeId, EpisodeStatus.SCRIPT_GENERATING);

            // Step 2: Fetch required data
            const { book, podcaster } = await this.fetchRequiredData(job);

            // Step 3: Get book content based on coverage
            const bookContent = await this.scriptGenerationService.getBookContent(
                job.bookId,
                job.contentCoverage,
                job.chapters,
            );

            if (!bookContent || bookContent.trim().length === 0) {
                throw new Error('No book content available for script generation');
            }

            // Step 4: Generate script
            this.logger.log(`Generating script for episode ${job.episodeId}`);
            const scriptResult = await this.scriptGenerationService.generateScript({
                bookContent,
                bookTitle: book.title,
                bookAuthor: book.author ?? undefined,
                episodeTitle: job.title,
                podcasterName: podcaster.name,
                podcasterPersonality: {
                    tone: podcaster.tone,
                    communicationStyle: podcaster.communicationStyle,
                    humorLevel: podcaster.humorLevel,
                    conversationalDepth: podcaster.conversationalDepth,
                    chaosFactor: podcaster.chaosFactor,
                    intellectualAngle: podcaster.intellectualAngle,
                    expertiseTags: podcaster.expertiseTags,
                },
                episodeType: job.episodeType,
                episodeTheme: job.episodeTheme,
                targetLengthMin: job.targetLengthMin,
                targetLengthMax: job.targetLengthMax,
            });

            // Step 5: Update status to SCRIPT_GENERATED and save script
            await this.updateStatus(job.episodeId, EpisodeStatus.SCRIPT_GENERATED, {
                scriptContent: scriptResult.script,
            });

            // Step 6: Update status to AUDIO_GENERATING
            await this.updateStatus(job.episodeId, EpisodeStatus.AUDIO_GENERATING);

            // Step 7: Generate audio
            this.logger.log(`Generating audio for episode ${job.episodeId}`);
            const audioResult = await this.generateEpisodeAudio(
                scriptResult.script,
                podcaster,
                job.episodeType,
            );

            // Step 8: Save audio to storage
            const audioStorageKey = `${job.userId}/${job.episodeId}/audio.${audioResult.format}`;
            await this.storageService.uploadFile(
                audioResult.audioBuffer,
                audioStorageKey,
                `audio/${audioResult.format}`,
            );

            // Step 9: Update status to COMPLETED
            await this.updateStatus(job.episodeId, EpisodeStatus.COMPLETED, {
                audioFileKey: audioStorageKey,
                duration: audioResult.duration,
                audioFormat: audioResult.format,
            });

            this.logger.log(`Successfully completed episode generation: ${job.episodeId}`);
        } catch (error) {
            this.logger.error(`Episode generation failed: ${job.episodeId}`, error);

            await this.updateStatus(job.episodeId, EpisodeStatus.FAILED, {
                generationError: error.message || 'Unknown error during generation',
            });

            throw error; // Re-throw for retry logic
        }
    }

    /**
     * Fetch book and podcaster data
     */
    private async fetchRequiredData(job: EpisodeGenerationJob) {
        const [book, podcaster] = await Promise.all([
            this.databaseService.book.findUnique({
                where: { id: job.bookId },
            }),
            this.databaseService.podcaster.findUnique({
                where: { id: job.podcasterId },
            }),
        ]);

        if (!book) {
            throw new Error(`Book not found: ${job.bookId}`);
        }

        if (!podcaster) {
            throw new Error(`Podcaster not found: ${job.podcasterId}`);
        }

        return { book, podcaster };
    }

    /**
     * Generate audio based on episode type
     */
    private async generateEpisodeAudio(
        script: string,
        podcaster: any,
        episodeType: 'MONOLOGUE' | 'DUO' | 'GROUP',
    ) {
        if (episodeType === 'MONOLOGUE') {
            // Single voice
            return this.ttsService.generateAudio({
                text: script,
                gender: podcaster.gender,
                voice: podcaster.accent,
                speakingSpeed: podcaster.speakingSpeed,
                vocalPitch: podcaster.vocalPitch,
            });
        }

        // For DUO and GROUP, we need to parse the script and generate multiple voices
        const segments = this.parseScriptSegments(script, episodeType);
        const audioBuffers: Buffer[] = [];

        for (const segment of segments) {
            const voice = this.getVoiceForSpeaker(segment.speaker, podcaster);
            const result = await this.ttsService.generateAudio({
                text: segment.text,
                gender: voice.gender,
                voice: voice.accent,
                speakingSpeed: voice.speakingSpeed,
                vocalPitch: voice.vocalPitch,
            });
            audioBuffers.push(result.audioBuffer);
        }

        // Concatenate all audio segments
        const combinedBuffer = await this.ttsService.concatenateAudio(audioBuffers);
        const totalDuration = segments.reduce(
            (sum, s) => sum + this.estimateSegmentDuration(s.text),
            0,
        );

        return {
            audioBuffer: combinedBuffer,
            duration: totalDuration,
            format: 'mp3',
        };
    }

    /**
     * Parse script into speaker segments for multi-voice episodes
     */
    private parseScriptSegments(
        script: string,
        episodeType: 'DUO' | 'GROUP',
    ): { speaker: string; text: string }[] {
        const segments: { speaker: string; text: string }[] = [];

        // Try to parse speaker labels like "HOST:", "GUEST1:", etc.
        const speakerPattern = /^(HOST\d?|GUEST\d?|SPEAKER\d?):\s*/gm;
        const parts = script.split(speakerPattern);

        if (parts.length > 1) {
            // Script has speaker labels
            let currentSpeaker = 'HOST';
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i].trim();
                if (/^(HOST\d?|GUEST\d?|SPEAKER\d?)$/.test(part)) {
                    currentSpeaker = part;
                } else if (part) {
                    segments.push({ speaker: currentSpeaker, text: part });
                }
            }
        } else {
            // No speaker labels, split by paragraphs and alternate speakers
            const paragraphs = script.split(/\n\n+/).filter(p => p.trim());
            const speakers = episodeType === 'DUO'
                ? ['HOST', 'GUEST']
                : ['HOST', 'GUEST1', 'GUEST2'];

            paragraphs.forEach((paragraph, index) => {
                segments.push({
                    speaker: speakers[index % speakers.length],
                    text: paragraph.trim(),
                });
            });
        }

        return segments;
    }

    /**
     * Get voice settings for a speaker
     */
    private getVoiceForSpeaker(
        speaker: string,
        mainPodcaster: any,
    ): {
        gender: 'MALE' | 'FEMALE';
        accent: string;
        speakingSpeed: number;
        vocalPitch: number;
    } {
        // Main host uses podcaster's voice
        if (speaker === 'HOST' || speaker === 'HOST1') {
            return {
                gender: mainPodcaster.gender,
                accent: mainPodcaster.accent,
                speakingSpeed: mainPodcaster.speakingSpeed,
                vocalPitch: mainPodcaster.vocalPitch,
            };
        }

        // Generate contrasting voices for guests
        const guestConfigs = [
            { gender: mainPodcaster.gender === 'MALE' ? 'FEMALE' : 'MALE', pitchMod: 2 },
            { gender: mainPodcaster.gender, pitchMod: -2 },
            { gender: mainPodcaster.gender === 'MALE' ? 'FEMALE' : 'MALE', pitchMod: -1 },
        ];

        const guestIndex = parseInt(speaker.replace(/\D/g, '') || '1') - 1;
        const config = guestConfigs[guestIndex % guestConfigs.length];

        return {
            gender: config.gender as 'MALE' | 'FEMALE',
            accent: mainPodcaster.accent,
            speakingSpeed: Math.min(10, Math.max(1, mainPodcaster.speakingSpeed + (guestIndex % 2 === 0 ? 1 : -1))),
            vocalPitch: Math.min(10, Math.max(1, mainPodcaster.vocalPitch + config.pitchMod)),
        };
    }

    /**
     * Estimate duration for a text segment
     */
    private estimateSegmentDuration(text: string): number {
        const wordCount = text.split(/\s+/).length;
        const minutes = wordCount / 150;
        return Math.round(minutes * 60);
    }

    /**
     * Update episode status in database
     */
    private async updateStatus(
        episodeId: string,
        status: EpisodeStatus,
        additionalData?: {
            scriptContent?: string;
            audioFileKey?: string;
            duration?: number;
            audioFormat?: string;
            generationError?: string;
        },
    ): Promise<void> {
        const updateData: any = {
            generationStatus: status,
        };

        if (status === EpisodeStatus.SCRIPT_GENERATED && additionalData?.scriptContent) {
            updateData.scriptContent = additionalData.scriptContent;
            updateData.scriptGeneratedAt = new Date();
        }

        if (status === EpisodeStatus.COMPLETED && additionalData?.audioFileKey) {
            updateData.audioFileKey = additionalData.audioFileKey;
            updateData.audioGeneratedAt = new Date();
            updateData.duration = additionalData.duration;
            updateData.audioFormat = additionalData.audioFormat;
        }

        if (status === EpisodeStatus.FAILED && additionalData?.generationError) {
            updateData.generationError = additionalData.generationError;
        }

        await this.databaseService.episode.update({
            where: { id: episodeId },
            data: updateData,
        });
    }
}
