import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DatabaseService.name);

    constructor() {
        // Prisma v7 requires an adapter for PostgreSQL
        // Parse DATABASE_URL or use defaults
        const dbUrl =
            process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5432/auditure_db';
        const url = new URL(dbUrl);

        const pool = new Pool({
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            database: url.pathname.slice(1), // Remove leading '/'
            user: url.username,
            password: url.password,
            connectionTimeoutMillis: 10_000, // 10s connection timeout
        });
        const adapter = new PrismaPg(pool);

        super({
            adapter,
            log: ['error', 'warn'],
        });
    }

    async onModuleInit() {
        this.logger.log('Connecting to database...');
        try {
            await this.$connect();
            this.logger.log('Database connected');
        } catch (error) {
            this.logger.error(`Database connection failed: ${error.message}`);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
