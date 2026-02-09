import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { RedisService } from './redis/redis.service';
import { RabbitMQService } from './rabbitmq/rabbitmq.service';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);

    constructor(
        private readonly appService: AppService,
        private readonly databaseService: DatabaseService,
        private readonly redisService: RedisService,
        private readonly rabbitMQService: RabbitMQService,
    ) {}

    @Get()
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('health')
    async getHealth() {
        const checks: Record<string, string> = {};

        // Database check
        try {
            await this.databaseService.$queryRaw`SELECT 1`;
            checks.database = 'healthy';
        } catch {
            checks.database = 'unhealthy';
        }

        // Redis check
        try {
            const pong = await this.redisService.ping();
            checks.redis = pong ? 'healthy' : 'unhealthy';
        } catch {
            checks.redis = 'unhealthy';
        }

        // RabbitMQ check
        checks.rabbitmq = this.rabbitMQService.isConnected() ? 'healthy' : 'unhealthy';

        const allHealthy = Object.values(checks).every(s => s === 'healthy');

        return {
            status: allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            checks,
        };
    }
}
