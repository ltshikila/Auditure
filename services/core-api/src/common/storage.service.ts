import { Injectable, Logger } from '@nestjs/common';
import { promises as fs, createReadStream as fsCreateReadStream } from 'fs';
import { Readable } from 'stream';
import * as path from 'path';
import { StorageBackend } from './interfaces/storage-backend.interface';
import { GcsStorageBackend } from './gcs-storage.backend';

class LocalStorageBackend implements StorageBackend {
    private basePath: string;
    private readonly logger = new Logger('LocalStorageBackend');

    constructor(basePath: string = './storage') {
        this.basePath = basePath;
        this.logger.log(`Initialized with base path: ${basePath}`);
    }

    async uploadFile(file: Buffer, key: string, mimeType: string): Promise<string> {
        const fullPath = path.join(this.basePath, key);
        this.logger.log(`uploadFile: ${key} (${file.length} bytes, ${mimeType})`);
        this.logger.log(`Full path: ${fullPath}`);

        try {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            this.logger.log(`Directory created/verified: ${path.dirname(fullPath)}`);

            await fs.writeFile(fullPath, file);
            this.logger.log(`File written successfully: ${fullPath}`);

            return key;
        } catch (error) {
            this.logger.error(`Failed to upload file: ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    async downloadFile(key: string): Promise<Buffer> {
        const fullPath = path.join(this.basePath, key);
        this.logger.log(`downloadFile: ${key}`);
        this.logger.log(`Full path: ${fullPath}`);

        try {
            const buffer = await fs.readFile(fullPath);
            this.logger.log(`File read successfully: ${buffer.length} bytes`);
            return buffer;
        } catch (error) {
            this.logger.error(`Failed to download file: ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    async deleteFile(key: string): Promise<void> {
        const fullPath = path.join(this.basePath, key);
        this.logger.log(`deleteFile: ${key}`);

        try {
            await fs.unlink(fullPath);
            this.logger.log(`File deleted successfully: ${fullPath}`);
        } catch (error) {
            // Ignore if file doesn't exist
            if (error.code !== 'ENOENT') {
                this.logger.error(`Failed to delete file: ${error.message}`);
                throw error;
            }
            this.logger.log(`File not found (skipping): ${fullPath}`);
        }
    }

    async fileExists(key: string): Promise<boolean> {
        const fullPath = path.join(this.basePath, key);
        this.logger.log(`fileExists: ${key}`);

        try {
            await fs.access(fullPath);
            this.logger.log(`File exists: ${fullPath}`);
            return true;
        } catch {
            this.logger.log(`File does not exist: ${fullPath}`);
            return false;
        }
    }

    async getFileSize(key: string): Promise<number> {
        const fullPath = path.join(this.basePath, key);
        const stats = await fs.stat(fullPath);
        return stats.size;
    }

    createReadStream(key: string, options?: { start?: number; end?: number }): Readable {
        const fullPath = path.join(this.basePath, key);
        return fsCreateReadStream(fullPath, options);
    }
}

@Injectable()
export class StorageService {
    private backend: StorageBackend;
    private readonly logger = new Logger(StorageService.name);

    constructor() {
        const backendType = process.env.STORAGE_BACKEND || 'local';
        const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';

        this.logger.log(`Initializing storage service with backend: ${backendType}`);
        this.logger.log(`Storage path: ${storagePath}`);

        if (backendType === 'gcs') {
            const bucketName = process.env.GCS_BUCKET_NAME;
            if (!bucketName) {
                throw new Error(
                    'GCS_BUCKET_NAME environment variable is required when STORAGE_BACKEND=gcs',
                );
            }
            this.backend = new GcsStorageBackend(bucketName);
        } else {
            this.backend = new LocalStorageBackend(storagePath);
        }
    }

    async uploadFile(file: Buffer, key: string, mimeType: string): Promise<string> {
        this.logger.log(`uploadFile called: ${key} (${file?.length || 0} bytes)`);
        try {
            const result = await this.backend.uploadFile(file, key, mimeType);
            this.logger.log(`uploadFile completed: ${result}`);
            return result;
        } catch (error) {
            this.logger.error(`uploadFile failed: ${error.message}`);
            throw error;
        }
    }

    async downloadFile(key: string): Promise<Buffer> {
        this.logger.log(`downloadFile called: ${key}`);
        try {
            const result = await this.backend.downloadFile(key);
            this.logger.log(`downloadFile completed: ${result.length} bytes`);
            return result;
        } catch (error) {
            this.logger.error(`downloadFile failed: ${error.message}`);
            throw error;
        }
    }

    async deleteFile(key: string): Promise<void> {
        this.logger.log(`deleteFile called: ${key}`);
        try {
            await this.backend.deleteFile(key);
            this.logger.log(`deleteFile completed`);
        } catch (error) {
            this.logger.error(`deleteFile failed: ${error.message}`);
            throw error;
        }
    }

    async fileExists(key: string): Promise<boolean> {
        this.logger.log(`fileExists called: ${key}`);
        try {
            const result = await this.backend.fileExists(key);
            this.logger.log(`fileExists result: ${result}`);
            return result;
        } catch (error) {
            this.logger.error(`fileExists failed: ${error.message}`);
            throw error;
        }
    }

    async getFileSize(key: string): Promise<number> {
        return this.backend.getFileSize(key);
    }

    createReadStream(key: string, options?: { start?: number; end?: number }): Readable {
        return this.backend.createReadStream(key, options);
    }

    isGcsBackend(): boolean {
        return this.backend instanceof GcsStorageBackend;
    }

    async getSignedUrl(key: string, expiresInMinutes: number = 60): Promise<string> {
        if (!(this.backend instanceof GcsStorageBackend)) {
            throw new Error('Signed URLs are only available with GCS backend');
        }
        return this.backend.getSignedUrl(key, expiresInMinutes);
    }
}
