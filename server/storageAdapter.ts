import type { Response } from 'express';
import { objectStorageService } from './objectStorage';

const isElectron = process.env.ELECTRON_APP === 'true';

interface StorageService {
  generateStorageKey(prefix: string, filename: string): string;
  uploadBuffer(buffer: Buffer, storageKey: string, contentType?: string): Promise<void>;
  getBuffer(storageKey: string): Promise<Buffer>;
  deleteFile(storageKey: string): Promise<void>;
  getDownloadURL(storageKey: string): Promise<string>;
  streamToResponse?(storageKey: string, res: Response): Promise<void>;
  exists?(storageKey: string): Promise<boolean>;
}

const cloudStorageService: StorageService = {
  generateStorageKey: (prefix, filename) => objectStorageService.generateStorageKey(prefix, filename),
  uploadBuffer: (buffer, key, type) => objectStorageService.uploadBuffer(buffer, key, type),
  getBuffer: async (key) => {
    const file = await objectStorageService.getFile(key);
    const [buffer] = await file.download();
    return buffer;
  },
  deleteFile: (key) => objectStorageService.deleteFile(key),
  getDownloadURL: (key) => objectStorageService.getDownloadURL(key),
  streamToResponse: async (key, res) => {
    const file = await objectStorageService.getFile(key);
    await objectStorageService.downloadObject(file, res);
  },
  exists: async (key) => {
    try {
      const file = await objectStorageService.getFile(key);
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }
};

export const storageAdapter = cloudStorageService;

export class StorageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageNotFoundError';
  }
}

export default storageAdapter;
