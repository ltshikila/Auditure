import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface TTSInput {
    text: string;
    voice?: string;
    gender: 'MALE' | 'FEMALE';
    speakingSpeed: number; // 1-10
    vocalPitch: number; // 1-10
}

export interface TTSResult {
    audioBuffer: Buffer;
    duration: number;
    format: string;
}

@Injectable()
export class TTSService {
    private readonly logger = new Logger(TTSService.name);
    private readonly tempDir = process.env.TTS_TEMP_DIR || './temp/tts';

    // Edge TTS voice mapping
    private readonly voices = {
        MALE: {
            'United States': 'en-US-GuyNeural',
            'United Kingdom': 'en-GB-RyanNeural',
            'Australia': 'en-AU-WilliamNeural',
            'Canada': 'en-CA-LiamNeural',
            'Ireland': 'en-IE-ConnorNeural',
            'India': 'en-IN-PrabhatNeural',
            default: 'en-US-GuyNeural',
        },
        FEMALE: {
            'United States': 'en-US-JennyNeural',
            'United Kingdom': 'en-GB-SoniaNeural',
            'Australia': 'en-AU-NatashaNeural',
            'Canada': 'en-CA-ClaraNeural',
            'Ireland': 'en-IE-EmilyNeural',
            'India': 'en-IN-NeerjaNeural',
            default: 'en-US-JennyNeural',
        },
    };

    constructor() {
        this.ensureTempDir();
    }

    private async ensureTempDir(): Promise<void> {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            this.logger.error('Failed to create temp directory', error);
        }
    }

    /**
     * Generate audio from text using Edge TTS
     */
    async generateAudio(input: TTSInput): Promise<TTSResult> {
        const voice = this.selectVoice(input.gender, input.voice);
        const rate = this.calculateRate(input.speakingSpeed);
        const pitch = this.calculatePitch(input.vocalPitch);

        try {
            // Try Edge TTS first
            return await this.generateWithEdgeTTS(input.text, voice, rate, pitch);
        } catch (error) {
            this.logger.warn('Edge TTS failed, trying fallback', error);
            // Fallback to Google TTS API (free tier)
            return await this.generateWithGoogleTTS(input.text, input.gender);
        }
    }

    /**
     * Select appropriate voice based on gender and accent
     */
    private selectVoice(gender: 'MALE' | 'FEMALE', accent?: string): string {
        const voiceMap = this.voices[gender] || this.voices.MALE;
        if (accent && voiceMap[accent as keyof typeof voiceMap]) {
            return voiceMap[accent as keyof typeof voiceMap];
        }
        return voiceMap.default;
    }

    /**
     * Calculate speaking rate adjustment from 1-10 scale
     * Edge TTS uses percentage: -50% to +50%
     */
    private calculateRate(speakingSpeed: number): string {
        // Map 1-10 to -30% to +30%
        const percentage = ((speakingSpeed - 5.5) / 4.5) * 30;
        const sign = percentage >= 0 ? '+' : '';
        return `${sign}${Math.round(percentage)}%`;
    }

    /**
     * Calculate pitch adjustment from 1-10 scale
     * Edge TTS uses Hz: -50Hz to +50Hz
     */
    private calculatePitch(vocalPitch: number): string {
        // Map 1-10 to -30Hz to +30Hz
        const hz = ((vocalPitch - 5.5) / 4.5) * 30;
        const sign = hz >= 0 ? '+' : '';
        return `${sign}${Math.round(hz)}Hz`;
    }

    /**
     * Generate audio using Edge TTS (via edge-tts npm package or CLI)
     */
    private async generateWithEdgeTTS(
        text: string,
        voice: string,
        rate: string,
        pitch: string,
    ): Promise<TTSResult> {
        const outputFile = path.join(this.tempDir, `${randomUUID()}.mp3`);
        const textFile = path.join(this.tempDir, `${randomUUID()}.txt`);

        try {
            // Write text to temp file to handle long content
            await fs.writeFile(textFile, text, 'utf-8');

            // Use edge-tts CLI
            await this.executeEdgeTTS(textFile, outputFile, voice, rate, pitch);

            // Read the generated audio
            const audioBuffer = await fs.readFile(outputFile);
            const duration = await this.getAudioDuration(outputFile);

            return {
                audioBuffer,
                duration,
                format: 'mp3',
            };
        } finally {
            // Cleanup temp files
            await this.cleanupTempFiles([outputFile, textFile]);
        }
    }

    /**
     * Execute edge-tts command
     */
    private executeEdgeTTS(
        inputFile: string,
        outputFile: string,
        voice: string,
        rate: string,
        pitch: string,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // Using edge-tts CLI (install with: pip install edge-tts)
            const args = [
                '-f', inputFile,
                '--write-media', outputFile,
                '-v', voice,
                '--rate', rate,
                '--pitch', pitch,
            ];

            const process = spawn('edge-tts', args);

            let stderr = '';

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`edge-tts failed with code ${code}: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Failed to spawn edge-tts: ${error.message}`));
            });
        });
    }

    /**
     * Fallback: Generate audio using Google Text-to-Speech API
     */
    private async generateWithGoogleTTS(
        text: string,
        gender: 'MALE' | 'FEMALE',
    ): Promise<TTSResult> {
        const apiKey = process.env.GOOGLE_TTS_API_KEY;

        if (!apiKey) {
            // Last resort: generate silence placeholder
            return this.generatePlaceholderAudio(text);
        }

        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text: text.substring(0, 5000) }, // API limit
                    voice: {
                        languageCode: 'en-US',
                        ssmlGender: gender,
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                    },
                }),
            },
        );

        if (!response.ok) {
            throw new Error(`Google TTS API error: ${response.status}`);
        }

        const result = await response.json();
        const audioBuffer = Buffer.from(result.audioContent, 'base64');

        return {
            audioBuffer,
            duration: this.estimateDuration(text),
            format: 'mp3',
        };
    }

    /**
     * Generate placeholder audio for testing when TTS is unavailable
     */
    private async generatePlaceholderAudio(text: string): Promise<TTSResult> {
        this.logger.warn('No TTS service available, generating placeholder');

        // Create a minimal valid MP3 file (silent)
        // This is a minimal MP3 frame that represents silence
        const silentMp3 = Buffer.from([
            0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ]);

        return {
            audioBuffer: silentMp3,
            duration: this.estimateDuration(text),
            format: 'mp3',
        };
    }

    /**
     * Get audio duration using ffprobe
     */
    private async getAudioDuration(filePath: string): Promise<number> {
        return new Promise((resolve) => {
            const ffprobe = spawn('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                filePath,
            ]);

            let output = '';

            ffprobe.stdout.on('data', (data) => {
                output += data.toString();
            });

            ffprobe.on('close', () => {
                const duration = parseFloat(output.trim());
                resolve(isNaN(duration) ? this.estimateDuration('') : Math.round(duration));
            });

            ffprobe.on('error', () => {
                // If ffprobe is not available, estimate duration
                resolve(0);
            });
        });
    }

    /**
     * Estimate duration based on word count
     */
    private estimateDuration(text: string): number {
        const wordCount = text.split(/\s+/).length;
        const minutes = wordCount / 150; // Average speaking rate
        return Math.round(minutes * 60);
    }

    /**
     * Cleanup temporary files
     */
    private async cleanupTempFiles(files: string[]): Promise<void> {
        for (const file of files) {
            try {
                await fs.unlink(file);
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Concatenate multiple audio buffers into one
     * Useful for combining different speakers in DUO/GROUP episodes
     */
    async concatenateAudio(audioBuffers: Buffer[]): Promise<Buffer> {
        if (audioBuffers.length === 0) {
            throw new Error('No audio buffers to concatenate');
        }

        if (audioBuffers.length === 1) {
            return audioBuffers[0];
        }

        const tempFiles: string[] = [];
        const listFile = path.join(this.tempDir, `${randomUUID()}_list.txt`);
        const outputFile = path.join(this.tempDir, `${randomUUID()}_output.mp3`);

        try {
            // Write each buffer to a temp file
            for (let i = 0; i < audioBuffers.length; i++) {
                const tempFile = path.join(this.tempDir, `${randomUUID()}_part${i}.mp3`);
                await fs.writeFile(tempFile, audioBuffers[i]);
                tempFiles.push(tempFile);
            }

            // Create ffmpeg concat list
            const listContent = tempFiles.map(f => `file '${f}'`).join('\n');
            await fs.writeFile(listFile, listContent);

            // Concatenate using ffmpeg
            await this.executeFFmpegConcat(listFile, outputFile);

            return await fs.readFile(outputFile);
        } finally {
            // Cleanup
            await this.cleanupTempFiles([...tempFiles, listFile, outputFile]);
        }
    }

    /**
     * Execute ffmpeg concatenation
     */
    private executeFFmpegConcat(listFile: string, outputFile: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-f', 'concat',
                '-safe', '0',
                '-i', listFile,
                '-c', 'copy',
                outputFile,
            ]);

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg concat failed with code ${code}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(error);
            });
        });
    }
}
