import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
    private readonly logger = new Logger('RequestMiddleware');

    use(req: Request, res: Response, next: NextFunction) {
        const contentType = req.headers['content-type'] || '';
        const contentLength = req.headers['content-length'] || '0';

        this.logger.log(`=== INCOMING REQUEST ===`);
        this.logger.log(`Method: ${req.method}`);
        this.logger.log(`URL: ${req.url}`);
        this.logger.log(`Content-Type: ${contentType}`);
        this.logger.log(`Content-Length: ${contentLength} bytes`);
        this.logger.log(`Authorization: ${req.headers.authorization ? 'Present' : 'Missing'}`);

        // For multipart requests, log boundary info
        if (contentType.includes('multipart/form-data')) {
            const boundary = contentType.split('boundary=')[1];
            this.logger.log(`Multipart Boundary: ${boundary || 'NOT FOUND'}`);
        }

        // Track when response finishes
        res.on('finish', () => {
            this.logger.log(`=== RESPONSE SENT === ${req.method} ${req.url} -> ${res.statusCode}`);
        });

        // Track response close (client disconnect)
        res.on('close', () => {
            if (!res.writableEnded) {
                this.logger.warn(`=== CONNECTION CLOSED EARLY === ${req.method} ${req.url}`);
            }
        });

        next();
    }
}
