import { Controller, Get, Param, Res, NotFoundException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

@Controller('api/storage')
export class StorageController {
    private readonly logger = new Logger(StorageController.name);

    constructor(private readonly storageService: StorageService) {}

    /**
     * Serve a file from storage.
     * URL format: /api/storage/:userId/:bookId/cover.jpg
     * The key is everything after /api/storage/
     */
    @Get('*path')
    async serveFile(@Param('path') path: string[], @Res() res: Response) {
        // Extract the file path from the named wildcard parameter
        const key = Array.isArray(path) ? path.join('/') : path;

        if (!key) {
            throw new NotFoundException('File path required');
        }

        this.logger.log(`Serving file: ${key}`);

        try {
            // Check if file exists
            const exists = await this.storageService.fileExists(key);
            if (!exists) {
                this.logger.warn(`File not found: ${key}`);
                throw new NotFoundException(`File not found: ${key}`);
            }

            // Download file
            const buffer = await this.storageService.downloadFile(key);

            // Determine content type from extension
            const contentType = this.getContentType(key);

            // Set headers
            res.set({
                'Content-Type': contentType,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            });

            this.logger.log(`Serving ${key}: ${buffer.length} bytes, ${contentType}`);
            res.send(buffer);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error serving file ${key}: ${error.message}`);
            throw new NotFoundException(`File not found: ${key}`);
        }
    }

    private getContentType(filename: string): string {
        const ext = filename.toLowerCase().split('.').pop();
        const mimeTypes: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            pdf: 'application/pdf',
            txt: 'text/plain',
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            ogg: 'audio/ogg',
        };
        return mimeTypes[ext || ''] || 'application/octet-stream';
    }
}
