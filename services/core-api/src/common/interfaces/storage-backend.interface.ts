import { Readable } from 'stream';

export interface StorageBackend {
    uploadFile(file: Buffer, key: string, mimeType: string): Promise<string>;
    downloadFile(key: string): Promise<Buffer>;
    deleteFile(key: string): Promise<void>;
    fileExists(key: string): Promise<boolean>;
    getFileSize(key: string): Promise<number>;
    createReadStream(key: string, options?: { start?: number; end?: number }): Readable;
}
