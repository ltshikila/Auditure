import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EpisodeGenerationJob } from './interfaces/jobs.interface';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    private connection: amqp.Connection | null = null;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    private channel: amqp.Channel | null = null;
    private readonly logger = new Logger(RabbitMQService.name);
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isShuttingDown = false;

    // Store consumer handler so it can be re-registered on reconnect
    private episodeGenerationHandler: ((job: EpisodeGenerationJob) => Promise<void>) | null = null;

    async onModuleInit() {
        await this.connect();
    }

    private async connect(): Promise<void> {
        try {
            const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

            // Race against a timeout to prevent blocking startup if RabbitMQ is unreachable
            const CONNECT_TIMEOUT = 10_000; // 10 seconds
            this.connection = await Promise.race([
                amqp.connect(url),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error('RabbitMQ connection timeout after 10s')),
                        CONNECT_TIMEOUT,
                    ),
                ),
            ]);

            // Prevent ECONNRESET on the connection from crashing the process
            this.connection.on('error', err => {
                this.logger.error(`RabbitMQ connection error: ${err.message}`);
            });

            this.connection.on('close', () => {
                this.logger.warn('RabbitMQ connection closed');
                this.channel = null;
                this.connection = null;
                if (!this.isShuttingDown) {
                    this.scheduleReconnect();
                }
            });

            this.channel = await this.connection.createChannel();

            this.channel.on('error', err => {
                this.logger.error(`RabbitMQ channel error: ${err.message}`);
            });

            this.channel.on('close', () => {
                this.logger.warn('RabbitMQ channel closed');
                this.channel = null;
            });

            // Declare queues
            await this.channel.assertQueue('episode_generation', { durable: true });
            await this.channel.assertQueue('episode_generation_dlq', { durable: true });

            this.logger.log('RabbitMQ connected and queues declared');

            // Re-register consumer on reconnect
            if (this.episodeGenerationHandler) {
                await this.registerEpisodeGenerationConsumer(this.episodeGenerationHandler);
            }
        } catch (error) {
            this.logger.error('Failed to connect to RabbitMQ', error);
            if (!this.isShuttingDown) {
                this.scheduleReconnect();
            }
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        const delay = 5_000;
        this.logger.log(`Scheduling RabbitMQ reconnect in ${delay / 1000}s...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            void this.connect();
        }, delay);
    }

    isConnected(): boolean {
        return !!this.channel;
    }

    async publishEpisodeGenerationJob(job: EpisodeGenerationJob): Promise<void> {
        if (!this.channel) {
            this.logger.error('RabbitMQ channel not available, cannot publish job');
            throw new Error('Message queue unavailable - episode generation job cannot be queued');
        }

        await this.channel.sendToQueue('episode_generation', Buffer.from(JSON.stringify(job)), {
            persistent: true,
        });
        this.logger.log(`Published episode generation job for episode ${job.episodeId}`);
    }

    async consumeEpisodeGenerationQueue(
        handler: (job: EpisodeGenerationJob) => Promise<void>,
    ): Promise<void> {
        this.episodeGenerationHandler = handler;
        await this.registerEpisodeGenerationConsumer(handler);
    }

    private async registerEpisodeGenerationConsumer(
        handler: (job: EpisodeGenerationJob) => Promise<void>,
    ): Promise<void> {
        if (!this.channel) {
            this.logger.error('RabbitMQ channel not available');
            return;
        }

        await this.channel.consume('episode_generation', async msg => {
            if (msg) {
                try {
                    const job: EpisodeGenerationJob = JSON.parse(msg.content.toString());
                    await handler(job);
                    this.channel?.ack(msg);
                } catch (error) {
                    this.logger.error('Error processing episode generation job', error);
                    // Move to DLQ after 3 retries
                    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
                    if (retryCount >= 3) {
                        this.channel?.sendToQueue('episode_generation_dlq', msg.content);
                        this.channel?.ack(msg);
                        this.logger.error(`Episode job moved to DLQ after ${retryCount} retries`);
                    } else {
                        this.channel?.nack(msg, false, false);
                        // Republish with incremented retry count
                        setTimeout(() => {
                            this.channel?.sendToQueue('episode_generation', msg.content, {
                                headers: { 'x-retry-count': retryCount },
                            });
                        }, 5000 * retryCount); // Exponential backoff
                    }
                }
            }
        });
    }

    async onModuleDestroy() {
        this.isShuttingDown = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        await this.channel?.close();
        await this.connection?.close();
        this.logger.log('RabbitMQ connection closed');
    }
}
