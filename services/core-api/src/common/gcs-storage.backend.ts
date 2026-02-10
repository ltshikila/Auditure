import { Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { Storage, Bucket } from '@google-cloud/storage';
import { StorageBackend } from './interfaces/storage-backend.interface';

export class GcsStorageBackend implements StorageBackend {
    private readonly logger = new Logger('GcsStorageBackend');
    private storage: Storage;
    private bucket: Bucket;
    private bucketName: string;

    constructor(bucketName: string) {
        this.bucketName = bucketName;
        this.storage = new Storage();
        this.bucket = this.storage.bucket(bucketName);
        this.logger.log(`Initialized with bucket: ${bucketName}`);
    }

    async uploadFile(file: Buffer, key: string, mimeType: string): Promise<string> {
        const blob = this.bucket.file(key);
        await blob.save(file, {
            contentType: mimeType,
            resumable: false,
        });
        this.logger.log(`Uploaded ${key} (${file.length} bytes, ${mimeType})`);
        return key;
    }

    async downloadFile(key: string): Promise<Buffer> {
        const [buffer] = await this.bucket.file(key).download();
        this.logger.log(`Downloaded ${key} (${buffer.length} bytes)`);
        return buffer;
    }

    async deleteFile(key: string): Promise<void> {
        try {
            await this.bucket.file(key).delete();
            this.logger.log(`Deleted ${key}`);
        } catch (error: any) {
            if (error.code === 404) {
                this.logger.log(`File not found (skipping): ${key}`);
                return;
            }
            throw error;
        }
    }

    async fileExists(key: string): Promise<boolean> {
        const [exists] = await this.bucket.file(key).exists();
        return exists;
    }

    async getFileSize(key: string): Promise<number> {
        const [metadata] = await this.bucket.file(key).getMetadata();
        return parseInt(metadata.size as string, 10);
    }

    createReadStream(key: string, options?: { start?: number; end?: number }): Readable {
        return this.bucket.file(key).createReadStream(options);
    }

    async getSignedUrl(key: string, expiresInMinutes: number = 60): Promise<string> {
        const [url] = await this.bucket.file(key).getSignedUrl({
            action: 'read',
            expires: Date.now() + expiresInMinutes * 60 * 1000,
        });
        return url;
    }
}
