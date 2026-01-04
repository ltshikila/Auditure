import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    // Increase server timeouts for large file uploads
    const server = app.getHttpServer();
    server.setTimeout(600000); // 10 minutes
    server.keepAliveTimeout = 620000; // Slightly longer than setTimeout
    server.headersTimeout = 621000; // Slightly longer than keepAliveTimeout

    app.enableCors({
        origin: ['http://localhost:8081', 'exp://192.168.1.*', 'http://localhost:19006'],
        credentials: true,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // Enable global request logging
    app.useGlobalInterceptors(new LoggingInterceptor());

    await app.listen(process.env.PORT ?? 3000);

    const logger = new Logger('Bootstrap');
    logger.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
    logger.log(`Server timeout set to 10 minutes for large file uploads`);
    logger.log(`All HTTP requests will be logged`);
}
bootstrap();
