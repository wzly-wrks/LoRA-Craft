import type { Response } from 'express';
import { objectStorageService } from './objectStorage';
import { localFileStorage, FileNotFoundError } from './localFileStorage';

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

const localStorageService: StorageService = {
  generateStorageKey: (prefix, filename) => localFileStorage.generateStorageKey(prefix, filename),
  uploadBuffer: (buffer, key, type) => localFileStorage.uploadBuffer(buffer, key, type),
  getBuffer: (key) => localFileStorage.getBuffer(key),
  deleteFile: (key) => localFileStorage.deleteFile(key),
  getDownloadURL: (key) => localFileStorage.getDownloadURL(key),
  streamToResponse: (key, res) => localFileStorage.streamToResponse(key, res),
  exists: (key) => localFileStorage.exists(key),
};

const cloudStorageService: StorageService = {
  generateStorageKey: (prefix, filename) => objectStorageService.generateStorageKey(prefix, filename),
  uploadBuffer: (buffer, key, type) =>
    objectStorageService.uploadBuffer(buffer, key, type ?? "application/octet-stream"),
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

export const storageAdapter: StorageService = isElectron ? localStorageService : cloudStorageService;

export class StorageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageNotFoundError';
  }
}

export default storageAdapter;
