import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageBackend } from './interfaces/storage-backend.interface';

class LocalStorageBackend implements StorageBackend {
  private basePath: string;

  constructor(basePath: string = './storage') {
    this.basePath = basePath;
  }

  async uploadFile(file: Buffer, key: string, mimeType: string): Promise<string> {
    const fullPath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file);
    return key;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, key);
    return fs.readFile(fullPath);
  }

  async deleteFile(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore if file doesn't exist
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async fileExists(key: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

@Injectable()
export class StorageService {
  private backend: StorageBackend;

  constructor() {
    const backendType = process.env.STORAGE_BACKEND || 'local';
    const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';

    if (backendType === 'local') {
      this.backend = new LocalStorageBackend(storagePath);
    }
    // Future: Add S3StorageBackend here
  }

  async uploadFile(file: Buffer, key: string, mimeType: string): Promise<string> {
    return this.backend.uploadFile(file, key, mimeType);
  }

  async downloadFile(key: string): Promise<Buffer> {
    return this.backend.downloadFile(key);
  }

  async deleteFile(key: string): Promise<void> {
    return this.backend.deleteFile(key);
  }

  async fileExists(key: string): Promise<boolean> {
    return this.backend.fileExists(key);
  }
}
