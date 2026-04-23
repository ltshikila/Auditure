import 'dotenv/config';
import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { shutdownAnalytics } from './common/analytics';

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    logger.log(
        `Starting NestJS application (PID: ${process.pid}, PORT: ${process.env.PORT ?? 3000})`,
    );
    logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);

    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
        rawBody: true,
    });

    // Security headers
    app.use(helmet());

    // Increase server timeouts for large file uploads
    const server = app.getHttpServer();
    server.setTimeout(600000); // 10 minutes
    server.keepAliveTimeout = 620000;
    server.headersTimeout = 621000;

    // CORS configuration
    const defaultOrigins = ['http://localhost:8081', 'exp://192.168.1.*', 'http://localhost:19006'];
    const corsOrigins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
        : defaultOrigins;

    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });

    // Global validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // Global exception filter — prevents leaking internals
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Global request logging
    app.useGlobalInterceptors(new LoggingInterceptor());

    app.enableShutdownHooks();
    const flushOnExit = async () => {
        try {
            await shutdownAnalytics();
        } catch (err) {
            logger.error(`Analytics shutdown error: ${err}`);
        }
    };
    process.on('SIGTERM', () => void flushOnExit());
    process.on('SIGINT', () => void flushOnExit());

    await app.listen(process.env.PORT ?? 3000);

    logger.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
    logger.log(`CORS origins: ${corsOrigins.join(', ')}`);
    logger.log(`Server timeout set to 10 minutes for large file uploads`);
}
bootstrap();
