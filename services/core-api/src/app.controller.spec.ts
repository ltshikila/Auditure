import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { RedisService } from './redis/redis.service';
import { RabbitMQService } from './rabbitmq/rabbitmq.service';

describe('AppController', () => {
    let appController: AppController;

    const mockDatabaseService = {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const mockRedisService = {
        ping: jest.fn().mockResolvedValue(true),
    };

    const mockRabbitMQService = {
        isConnected: jest.fn().mockReturnValue(true),
    };

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                AppService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: RedisService, useValue: mockRedisService },
                { provide: RabbitMQService, useValue: mockRabbitMQService },
            ],
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe('root', () => {
        it('should return "Hello World!"', () => {
            expect(appController.getHello()).toBe('Hello World!');
        });
    });

    describe('health', () => {
        it('should return healthy when all services are up', async () => {
            const result = await appController.getHealth();
            expect(result.status).toBe('healthy');
            expect(result.checks.database).toBe('healthy');
            expect(result.checks.redis).toBe('healthy');
            expect(result.checks.rabbitmq).toBe('healthy');
        });

        it('should return degraded when a service is down', async () => {
            mockRedisService.ping.mockResolvedValueOnce(false);
            const result = await appController.getHealth();
            expect(result.status).toBe('degraded');
            expect(result.checks.redis).toBe('unhealthy');
        });
    });
});
