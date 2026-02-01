import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
        });
        const adapter = new PrismaPg(pool);

        super({
            adapter,
            log: ['error', 'warn'],
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
