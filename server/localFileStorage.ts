import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'data', 'storage');

const directories = ['images', 'thumbnails', 'exports'];
directories.forEach(dir => {
  const dirPath = path.join(storagePath, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

export class LocalFileStorageService {
  private basePath: string;

  constructor() {
    this.basePath = storagePath;
    console.log(`[LocalStorage] Using storage path: ${this.basePath}`);
  }

  generateStorageKey(prefix: string, filename: string): string {
    const ext = path.extname(filename);
    const uniqueId = randomUUID();
    return `/${prefix}/${uniqueId}${ext}`;
  }

  getFullPath(storageKey: string): string {
    return path.join(this.basePath, storageKey.startsWith('/') ? storageKey.slice(1) : storageKey);
  }

  async uploadBuffer(buffer: Buffer, storageKey: string, contentType?: string): Promise<void> {
    const fullPath = this.getFullPath(storageKey);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await fs.promises.writeFile(fullPath, buffer);
    console.log(`[LocalStorage] Saved file to: ${fullPath}`);
  }

  async uploadFromPath(sourcePath: string, storageKey: string): Promise<void> {
    const buffer = await fs.promises.readFile(sourcePath);
    await this.uploadBuffer(buffer, storageKey);
  }

  async getBuffer(storageKey: string): Promise<Buffer> {
    const fullPath = this.getFullPath(storageKey);
    
    if (!fs.existsSync(fullPath)) {
      throw new FileNotFoundError(`File not found: ${storageKey}`);
    }
    
    return fs.promises.readFile(fullPath);
  }

  async exists(storageKey: string): Promise<boolean> {
    const fullPath = this.getFullPath(storageKey);
    return fs.existsSync(fullPath);
  }

  async deleteFile(storageKey: string): Promise<void> {
    const fullPath = this.getFullPath(storageKey);
    
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      console.log(`[LocalStorage] Deleted file: ${fullPath}`);
    }
  }

  async getDownloadURL(storageKey: string): Promise<string> {
    return `/api/storage/local${storageKey}`;
  }

  async streamToResponse(storageKey: string, res: Response): Promise<void> {
    const fullPath = this.getFullPath(storageKey);
    
    if (!fs.existsSync(fullPath)) {
      throw new FileNotFoundError(`File not found: ${storageKey}`);
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.zip': 'application/zip'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    const stats = await fs.promises.stat(fullPath);
    res.setHeader('Content-Length', stats.size);
    
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  }

  async listFiles(prefix: string): Promise<string[]> {
    const dirPath = path.join(this.basePath, prefix);
    
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const files: string[] = [];
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(`/${prefix}/${entry.name}`);
      }
    }
    
    return files;
  }

  async getFileSize(storageKey: string): Promise<number> {
    const fullPath = this.getFullPath(storageKey);
    const stats = await fs.promises.stat(fullPath);
    return stats.size;
  }

  getStoragePath(): string {
    return this.basePath;
  }
}

export class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

export const localFileStorage = new LocalFileStorageService();
export default localFileStorage;
