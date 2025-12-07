import fetch from 'node-fetch';
import * as sharp from 'sharp';
import { createHash } from 'crypto';

export interface DownloadedImage {
  buffer: Buffer;
  url: string;
  contentType: string;
  width: number;
  height: number;
  hash: string;
  sizeBytes: number;
}

export interface DownloadOptions {
  minResolution?: number;
  maxSizeBytes?: number;
  timeout?: number;
  retries?: number;
}

export interface DownloadResult {
  success: boolean;
  image?: DownloadedImage;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_OPTIONS: DownloadOptions = {
  minResolution: 300,
  maxSizeBytes: 50 * 1024 * 1024,
  timeout: 30000,
  retries: 2,
};

export async function downloadImage(
  url: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 0; attempt <= (opts.retries || 0); attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout || 30000);
      
      let response;
      try {
        response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': new URL(url).origin,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        if (attempt < (opts.retries || 0)) {
          await delay(1000 * (attempt + 1));
          continue;
        }
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        return {
          success: false,
          skipped: true,
          skipReason: `Not an image: ${contentType}`,
        };
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (opts.maxSizeBytes && contentLength > opts.maxSizeBytes) {
        return {
          success: false,
          skipped: true,
          skipReason: `File too large: ${contentLength} bytes`,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (opts.maxSizeBytes && buffer.length > opts.maxSizeBytes) {
        return {
          success: false,
          skipped: true,
          skipReason: `File too large: ${buffer.length} bytes`,
        };
      }

      const metadata = await (sharp as any)(buffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (opts.minResolution && (width < opts.minResolution || height < opts.minResolution)) {
        return {
          success: false,
          skipped: true,
          skipReason: `Resolution too low: ${width}x${height} (minimum: ${opts.minResolution}px)`,
        };
      }

      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);

      return {
        success: true,
        image: {
          buffer,
          url,
          contentType,
          width,
          height,
          hash,
          sizeBytes: buffer.length,
        },
      };

    } catch (error) {
      if (attempt < (opts.retries || 0)) {
        await delay(1000 * (attempt + 1));
        continue;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    success: false,
    error: 'Max retries exceeded',
  };
}

export class RateLimitedDownloader {
  private minDelay: number;
  private maxDelay: number;
  private lastRequestTime: number = 0;
  private queue: Array<{
    url: string;
    options: DownloadOptions;
    resolve: (result: DownloadResult) => void;
  }> = [];
  private processing: boolean = false;

  constructor(options: { minDelay?: number; maxDelay?: number } = {}) {
    this.minDelay = options.minDelay || 500;
    this.maxDelay = options.maxDelay || 1500;
  }

  async download(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    return new Promise((resolve) => {
      this.queue.push({ url, options, resolve });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const requiredDelay = this.getRandomDelay();
      
      if (timeSinceLastRequest < requiredDelay) {
        await delay(requiredDelay - timeSinceLastRequest);
      }

      this.lastRequestTime = Date.now();
      
      try {
        const result = await downloadImage(item.url, item.options);
        item.resolve(result);
      } catch (error) {
        item.resolve({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.processing = false;
  }

  private getRandomDelay(): number {
    return Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay;
  }

  get queueLength(): number {
    return this.queue.length;
  }
}

export async function downloadBatch(
  urls: string[],
  options: DownloadOptions & { 
    minDelay?: number; 
    maxDelay?: number;
    onProgress?: (completed: number, total: number, result: DownloadResult) => void;
  } = {}
): Promise<DownloadResult[]> {
  const downloader = new RateLimitedDownloader({
    minDelay: options.minDelay || 500,
    maxDelay: options.maxDelay || 1500,
  });

  const results: DownloadResult[] = [];
  let completed = 0;

  for (const url of urls) {
    const result = await downloader.download(url, options);
    results.push(result);
    completed++;
    
    if (options.onProgress) {
      options.onProgress(completed, urls.length, result);
    }
  }

  return results;
}

export async function downloadWithDeduplication(
  urls: string[],
  seenHashes: Set<string>,
  options: DownloadOptions & {
    minDelay?: number;
    maxDelay?: number;
    onProgress?: (completed: number, total: number, result: DownloadResult, isDuplicate: boolean) => void;
  } = {}
): Promise<{ results: DownloadResult[]; newImages: DownloadedImage[]; duplicateCount: number }> {
  const downloader = new RateLimitedDownloader({
    minDelay: options.minDelay || 500,
    maxDelay: options.maxDelay || 1500,
  });

  const results: DownloadResult[] = [];
  const newImages: DownloadedImage[] = [];
  let duplicateCount = 0;
  let completed = 0;

  for (const url of urls) {
    const result = await downloader.download(url, options);
    results.push(result);
    completed++;

    let isDuplicate = false;
    
    if (result.success && result.image) {
      if (seenHashes.has(result.image.hash)) {
        isDuplicate = true;
        duplicateCount++;
      } else {
        seenHashes.add(result.image.hash);
        newImages.push(result.image);
      }
    }

    if (options.onProgress) {
      options.onProgress(completed, urls.length, result, isDuplicate);
    }
  }

  return { results, newImages, duplicateCount };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const hasImageExtension = imageExtensions.some(ext => path.endsWith(ext));
    
    const excludePatterns = [
      /thumb_/i,
      /\/thumb\//i,
      /_thumb\./i,
      /icon/i,
      /logo/i,
      /avatar/i,
      /spacer/i,
      /pixel\./i,
      /1x1\./i,
    ];
    
    const isExcluded = excludePatterns.some(pattern => pattern.test(url));
    
    return hasImageExtension && !isExcluded;
  } catch {
    return false;
  }
}

export function normalizeImageUrl(url: string, baseUrl?: string): string | null {
  try {
    if (baseUrl) {
      return new URL(url, baseUrl).toString();
    }
    return new URL(url).toString();
  } catch {
    return null;
  }
}
