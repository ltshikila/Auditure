import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DatabaseService.name);
    private readonly pool: Pool;

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
            max: 10, // max connections in pool
            connectionTimeoutMillis: 30_000, // 30s to acquire a connection (Cloud Run needs headroom)
            idleTimeoutMillis: 30_000, // close idle connections after 30s
            allowExitOnIdle: true, // let the pool drain on shutdown
            keepAlive: true, // prevent Cloud Run from killing idle sockets
            keepAliveInitialDelayMillis: 10_000,
        });

        const adapter = new PrismaPg(pool);

        super({
            adapter,
            log: ['error', 'warn'],
        });
        this.pool = pool;

        // Handle errors on idle clients — without this, ECONNRESET on idle connections
        // becomes an unhandled error. The pool will automatically remove the broken client.
        pool.on('error', (err) => {
            this.logger.warn(`Idle pg client error (pool will recover): ${err.message}`);
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
        await this.pool.end();
    }

    /**
     * Wraps a database operation with retry logic for transient connection errors
     * (ECONNRESET, connection timeouts, etc.)
     */
    async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
        let lastError: Error;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries && this.isRetryableError(error)) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    this.logger.warn(
                        `Retryable DB error (attempt ${attempt + 1}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }
        throw lastError!;
    }

    private isRetryableError(error: any): boolean {
        const message = error?.message || '';
        const code = error?.code || '';
        return (
            message.includes('timeout exceeded when trying to connect') ||
            message.includes('Connection terminated unexpectedly') ||
            message.includes('read ECONNRESET') ||
            code === 'ECONNRESET' ||
            code === 'ECONNREFUSED' ||
            code === 'ETIMEDOUT' ||
            code === 'EPIPE'
        );
    }
}
