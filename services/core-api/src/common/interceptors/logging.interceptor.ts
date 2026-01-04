import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, query, params } = request;
        const userAgent = request.get('user-agent') || '';
        const ip = request.ip || request.connection?.remoteAddress;
        const userId = request.user?.userId || 'anonymous';

        const now = Date.now();

        // Log incoming request
        this.logger.log(
            `${method} ${url} | User: ${userId} | IP: ${ip}`,
        );

        // Log request body for POST/PUT/PATCH (excluding sensitive fields)
        if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
            const sanitizedBody = this.sanitizeBody(body);
            if (Object.keys(sanitizedBody).length > 0) {
                this.logger.debug(`Body: ${JSON.stringify(sanitizedBody)}`);
            }
        }

        // Log query params if present
        if (query && Object.keys(query).length > 0) {
            this.logger.debug(`🔍 Query: ${JSON.stringify(query)}`);
        }

        // Log route params if present
        if (params && Object.keys(params).length > 0) {
            this.logger.debug(`Params: ${JSON.stringify(params)}`);
        }

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const response = context.switchToHttp().getResponse();
                    const statusCode = response.statusCode;
                    const duration = Date.now() - now;

                    this.logger.log(
                        `${method} ${url} | ${statusCode} | ${duration}ms`,
                    );

                    // Log response summary for debugging
                    if (data && typeof data === 'object') {
                        const responseInfo = this.getResponseSummary(data);
                        if (responseInfo) {
                            this.logger.debug(`Response: ${responseInfo}`);
                        }
                    }
                },
                error: (error) => {
                    const duration = Date.now() - now;
                    const statusCode = error.status || error.statusCode || 500;

                    this.logger.error(
                        `${method} ${url} | ${statusCode} | ${duration}ms | ${error.message}`,
                    );
                },
            }),
        );
    }

    private sanitizeBody(body: any): any {
        if (!body || typeof body !== 'object') {
            return body;
        }

        const sensitiveFields = [
            'password',
            'token',
            'refreshToken',
            'accessToken',
            'secret',
            'apiKey',
            'authorization',
            'otpCode',
        ];

        const sanitized = { ...body };

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        // For file uploads, just show file info
        if (sanitized.file) {
            sanitized.file = '[FILE]';
        }

        return sanitized;
    }

    private getResponseSummary(data: any): string | null {
        if (Array.isArray(data)) {
            return `Array[${data.length}]`;
        }

        if (data.id) {
            return `{ id: ${data.id}${data.title ? `, title: "${data.title}"` : ''}${data.email ? `, email: "${data.email}"` : ''} }`;
        }

        if (data.accessToken) {
            return '{ accessToken: [TOKEN], ... }';
        }

        return null;
    }
}
