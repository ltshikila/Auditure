import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { BookExtractionJob } from './interfaces/jobs.interface';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly logger = new Logger(RabbitMQService.name);

  async onModuleInit() {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Declare queues
      await this.channel.assertQueue('book_extraction', { durable: true });
      await this.channel.assertQueue('book_extraction_dlq', { durable: true });

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

    await this.channel.sendToQueue(
      'book_extraction',
      Buffer.from(JSON.stringify(job)),
      { persistent: true }
    );
    this.logger.log(`Published extraction job for book ${job.bookId}`);
  }

  async consumeBookExtractionQueue(
    handler: (job: BookExtractionJob) => Promise<void>
  ): Promise<void> {
    if (!this.channel) {
      this.logger.error('RabbitMQ channel not available');
      return;
    }

    await this.channel.consume('book_extraction', async (msg) => {
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
                headers: { 'x-retry-count': retryCount }
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
