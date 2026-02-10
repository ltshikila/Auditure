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

        // Cloud SQL on Cloud Run uses Unix sockets via ?host=/cloudsql/project:region:instance
        // pg.Pool needs host set to the socket directory path (starts with /)
        const socketHost = url.searchParams.get('host');
        const pool = new Pool({
            host: socketHost || url.hostname,
            port: socketHost ? undefined : parseInt(url.port) || 5432,
            database: url.pathname.slice(1), // Remove leading '/'
            user: url.username,
            password: decodeURIComponent(url.password),
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
