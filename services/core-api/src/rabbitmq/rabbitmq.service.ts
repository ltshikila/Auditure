import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { BookExtractionJob, EpisodeGenerationJob } from './interfaces/jobs.interface';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
    private connection: amqp.Connection;
    private channel: amqp.Channel;
    private readonly logger = new Logger(RabbitMQService.name);

    async onModuleInit() {
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
            this.channel = await this.connection.createChannel();

            // Declare queues
            await this.channel.assertQueue('book_extraction', { durable: true });
            await this.channel.assertQueue('book_extraction_dlq', { durable: true });
            await this.channel.assertQueue('episode_generation', { durable: true });
            await this.channel.assertQueue('episode_generation_dlq', { durable: true });

            this.logger.log('RabbitMQ connected and queues declared');
        } catch (error) {
            this.logger.error('Failed to connect to RabbitMQ', error);
        }
    }

    async publishBookExtractionJob(job: BookExtractionJob): Promise<void> {
        if (!this.channel) {
            this.logger.error('RabbitMQ channel not available, skipping job queue');
            return;
        }

        await this.channel.sendToQueue('book_extraction', Buffer.from(JSON.stringify(job)), {
            persistent: true,
        });
        this.logger.log(`Published extraction job for book ${job.bookId}`);
    }

    async consumeBookExtractionQueue(
        handler: (job: BookExtractionJob) => Promise<void>,
    ): Promise<void> {
        if (!this.channel) {
            this.logger.error('RabbitMQ channel not available');
            return;
        }

        await this.channel.consume('book_extraction', async msg => {
            if (msg) {
                try {
                    const job: BookExtractionJob = JSON.parse(msg.content.toString());
                    await handler(job);
                    this.channel.ack(msg);
                } catch (error) {
                    this.logger.error('Error processing job', error);
                    // Move to DLQ after 3 retries
                    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
                    if (retryCount >= 3) {
                        this.channel.sendToQueue('book_extraction_dlq', msg.content);
                        this.channel.ack(msg);
                        this.logger.error(`Job moved to DLQ after ${retryCount} retries`);
                    } else {
                        this.channel.nack(msg, false, false);
                        // Republish with incremented retry count
                        setTimeout(() => {
                            this.channel.sendToQueue('book_extraction', msg.content, {
                                headers: { 'x-retry-count': retryCount },
                            });
                        }, 5000 * retryCount); // Exponential backoff
                    }
                }
            }
        });
    }

    async publishEpisodeGenerationJob(job: EpisodeGenerationJob): Promise<void> {
        if (!this.channel) {
            this.logger.error('RabbitMQ channel not available, skipping job queue');
            return;
        }

        await this.channel.sendToQueue('episode_generation', Buffer.from(JSON.stringify(job)), {
            persistent: true,
        });
        this.logger.log(`Published episode generation job for episode ${job.episodeId}`);
    }

    async consumeEpisodeGenerationQueue(
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
                    this.channel.ack(msg);
                } catch (error) {
                    this.logger.error('Error processing episode generation job', error);
                    // Move to DLQ after 3 retries
                    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
                    if (retryCount >= 3) {
                        this.channel.sendToQueue('episode_generation_dlq', msg.content);
                        this.channel.ack(msg);
                        this.logger.error(`Episode job moved to DLQ after ${retryCount} retries`);
                    } else {
                        this.channel.nack(msg, false, false);
                        // Republish with incremented retry count
                        setTimeout(() => {
                            this.channel.sendToQueue('episode_generation', msg.content, {
                                headers: { 'x-retry-count': retryCount },
                            });
                        }, 5000 * retryCount); // Exponential backoff
                    }
                }
            }
        });
    }

    async onModuleDestroy() {
        await this.channel?.close();
        await this.connection?.close();
        this.logger.log('RabbitMQ connection closed');
    }
}
