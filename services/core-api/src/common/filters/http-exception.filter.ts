import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'An unexpected error occurred';
        let error = 'Internal Server Error';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const resp = exceptionResponse as Record<string, unknown>;
                message = (resp.message as string) || message;
                error = (resp.error as string) || error;
            }

            // Report 5xx HTTP exceptions to Sentry
            if (status >= 500) {
                Sentry.captureException(exception);
            }
        } else {
            // Unexpected non-HTTP errors — always report to Sentry
            Sentry.captureException(exception);

            this.logger.error(
                `Unhandled exception: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
                exception instanceof Error ? exception.stack : undefined,
            );
        }

        response.status(status).json({
            statusCode: status,
            message,
            error,
            timestamp: new Date().toISOString(),
        });
    }
}
