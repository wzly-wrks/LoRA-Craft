import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getCrawlCachePath } from './appPaths';

// Temp directory for crawled images before user confirms import
const CACHE_DIR = getCrawlCachePath();

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export interface CachedImage {
  id: string;
  jobId: string;
  url: string;
  filePath: string;
  thumbnailPath?: string;
  width: number;
  height: number;
  sizeBytes: number;
  hash: string;
  contentType: string;
  createdAt: Date;
}

// In-memory index of cached images by job ID
const cacheIndex = new Map<string, CachedImage[]>();

export const crawlCache = {
  /**
   * Get the cache directory path
   */
  getCacheDir(): string {
    return CACHE_DIR;
  },

  /**
   * Save an image to the cache
   */
  async saveToCache(
    jobId: string,
    buffer: Buffer,
    metadata: {
      url: string;
      width: number;
      height: number;
      hash: string;
      contentType: string;
    }
  ): Promise<CachedImage> {
    const id = randomUUID();
    const ext = metadata.contentType.includes('png') ? '.png' : 
                metadata.contentType.includes('webp') ? '.webp' : '.jpg';
    
    // Create job-specific subdirectory
    const jobDir = path.join(CACHE_DIR, jobId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }
    
    const filePath = path.join(jobDir, `${id}${ext}`);
    await fs.promises.writeFile(filePath, buffer);
    
    const cachedImage: CachedImage = {
      id,
      jobId,
      url: metadata.url,
      filePath,
      width: metadata.width,
      height: metadata.height,
      sizeBytes: buffer.length,
      hash: metadata.hash,
      contentType: metadata.contentType,
      createdAt: new Date(),
    };
    
    // Add to index
    if (!cacheIndex.has(jobId)) {
      cacheIndex.set(jobId, []);
    }
    cacheIndex.get(jobId)!.push(cachedImage);
    
    return cachedImage;
  },

  /**
   * Get all cached images for a job
   */
  getCachedImages(jobId: string): CachedImage[] {
    return cacheIndex.get(jobId) || [];
  },

  /**
   * Get a single cached image by ID
   */
  getCachedImage(jobId: string, imageId: string): CachedImage | undefined {
    const images = cacheIndex.get(jobId);
    return images?.find(img => img.id === imageId);
  },

  /**
   * Read a cached image file
   */
  async readCachedImage(cachedImage: CachedImage): Promise<Buffer> {
    return fs.promises.readFile(cachedImage.filePath);
  },

  /**
   * Delete specific images from cache (when user rejects them)
   */
  async deleteFromCache(jobId: string, imageIds: string[]): Promise<void> {
    const images = cacheIndex.get(jobId);
    if (!images) return;
    
    for (const imageId of imageIds) {
      const image = images.find(img => img.id === imageId);
      if (image) {
        try {
          await fs.promises.unlink(image.filePath);
          if (image.thumbnailPath) {
            await fs.promises.unlink(image.thumbnailPath).catch(() => {});
          }
        } catch (e) {
          console.error(`Failed to delete cached image ${image.filePath}:`, e);
        }
      }
    }
    
    // Update index
    cacheIndex.set(jobId, images.filter(img => !imageIds.includes(img.id)));
  },

  /**
   * Clear all cached images for a job (after import or cancellation)
   */
  async clearJobCache(jobId: string): Promise<void> {
    const jobDir = path.join(CACHE_DIR, jobId);
    
    try {
      if (fs.existsSync(jobDir)) {
        await fs.promises.rm(jobDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error(`Failed to clear cache for job ${jobId}:`, e);
    }
    
    cacheIndex.delete(jobId);
  },

  /**
   * Clear entire cache (on app shutdown or manual cleanup)
   */
  async clearAllCache(): Promise<void> {
    try {
      const entries = await fs.promises.readdir(CACHE_DIR, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(CACHE_DIR, entry.name);
          await fs.promises.rm(dirPath, { recursive: true, force: true });
        }
      }
      
      cacheIndex.clear();
      console.log('[CrawlCache] Cleared all cached images');
    } catch (e) {
      console.error('Failed to clear crawl cache:', e);
    }
  },

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalJobs: number;
    totalImages: number;
    totalSizeBytes: number;
  }> {
    let totalImages = 0;
    let totalSizeBytes = 0;
    
    cacheIndex.forEach((images: CachedImage[]) => {
      totalImages += images.length;
      totalSizeBytes += images.reduce((sum: number, img: CachedImage) => sum + img.sizeBytes, 0);
    });
    
    return {
      totalJobs: cacheIndex.size,
      totalImages,
      totalSizeBytes,
    };
  },

  /**
   * Clean up old cache entries (older than specified hours)
   */
  async cleanupOldCache(maxAgeHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;
    const jobIds = Array.from(cacheIndex.keys());
    
    for (const jobId of jobIds) {
      const images = cacheIndex.get(jobId) || [];
      const oldImages = images.filter((img: CachedImage) => img.createdAt < cutoff);
      if (oldImages.length > 0) {
        await this.deleteFromCache(jobId, oldImages.map((img: CachedImage) => img.id));
        deletedCount += oldImages.length;
      }
      
      // If all images in job are old, clear the job directory
      if (cacheIndex.get(jobId)?.length === 0) {
        await this.clearJobCache(jobId);
      }
    }
    
    return deletedCount;
  },
};

// Clean up cache on process exit
const cleanup = async () => {
  console.log('[CrawlCache] Cleaning up cache on exit...');
  await crawlCache.clearAllCache();
};

process.on('exit', () => {
  // Sync cleanup for exit event
  try {
    const entries = fs.readdirSync(CACHE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        fs.rmSync(path.join(CACHE_DIR, entry.name), { recursive: true, force: true });
      }
    }
  } catch (e) {
    // Ignore errors during exit cleanup
  }
});

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Also clean up on uncaught exceptions
process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  await cleanup();
  process.exit(1);
});

export default crawlCache;
