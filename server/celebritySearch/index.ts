import { discoverFanSites, FanSite } from './siteDetector';
import { CoppermineGalleryCrawler, CoppermineImageInfo } from './galleryCrawler';
import { downloadWithDeduplication, DownloadedImage } from './imageDownloader';
import { ImageDeduplicator, meetsMinimumResolution } from './deduplicator';
import { db as storage } from '../databaseAdapter';
import { storageAdapter } from '../storageAdapter';
import { crawlCache } from '../crawlCache';
import type { CrawlJob, InsertCrawlJob } from '../../shared/schema';

export interface CrawlOptions {
  maxImages?: number;
  minResolution?: number;
  crawlDepth?: number;
  maxSites?: number;
  braveApiKey?: string;
}

export interface CrawlResult {
  jobId: string;
  status: 'completed' | 'failed' | 'partial';
  imagesDownloaded: number;
  duplicatesRemoved: number;
  pagesScanned: number;
  sitesDiscovered: number;
  error?: string;
  imageIds: string[];
}

export interface CrawlProgress {
  status: string;
  currentSite?: string;
  pagesScanned: number;
  imagesFound: number;
  imagesDownloaded: number;
  duplicatesRemoved: number;
}

const DEFAULT_OPTIONS: Required<Omit<CrawlOptions, 'braveApiKey'>> = {
  maxImages: 500,
  minResolution: 300,
  crawlDepth: 3,
  maxSites: 5,
};

const runningJobs = new Map<string, { cancelled: boolean }>();

export async function runCelebritySearch(
  celebrityName: string,
  datasetId: string,
  options: CrawlOptions = {}
): Promise<{ jobId: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const braveApiKey = opts.braveApiKey || process.env.BRAVE_API_KEY;
  if (!braveApiKey) {
    throw new Error('Brave API key is required. Set BRAVE_API_KEY environment variable or pass braveApiKey option.');
  }

  const dataset = await storage.getDataset(datasetId);
  if (!dataset) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  const crawlJobData: InsertCrawlJob = {
    datasetId,
    celebrityName,
    status: 'pending',
    minResolution: opts.minResolution,
    maxImages: opts.maxImages,
    crawlDepth: opts.crawlDepth,
    discoveredSites: [],
    pagesScanned: 0,
    imagesFound: 0,
    imagesDownloaded: 0,
    duplicatesRemoved: 0,
  };

  const crawlJob = await storage.createCrawlJob(crawlJobData);
  const jobId = crawlJob.id;

  runningJobs.set(jobId, { cancelled: false });

  executeCrawl(jobId, dataset.workspaceId, celebrityName, datasetId, opts, braveApiKey).catch(console.error);

  return { jobId };
}

async function executeCrawl(
  jobId: string,
  workspaceId: string,
  celebrityName: string,
  datasetId: string,
  opts: Required<Omit<CrawlOptions, 'braveApiKey'>>,
  braveApiKey: string
): Promise<CrawlResult> {
  const jobState = runningJobs.get(jobId);
  if (!jobState) {
    return { jobId, status: 'failed', imagesDownloaded: 0, duplicatesRemoved: 0, pagesScanned: 0, sitesDiscovered: 0, error: 'Job not found', imageIds: [] };
  }

  const imageIds: string[] = [];
  const seenHashes = new Set<string>();
  const deduplicator = new ImageDeduplicator(0.92);

  let totalPagesScanned = 0;
  let totalImagesFound = 0;
  let totalImagesDownloaded = 0;
  let totalDuplicatesRemoved = 0;

  try {
    console.log(`[CrawlJob ${jobId}] Starting celebrity search for: ${celebrityName}`);
    
    await storage.updateCrawlJob(jobId, { status: 'searching' });
    
    console.log(`[CrawlJob ${jobId}] Discovering fan sites...`);
    const fanSites = await discoverFanSites(celebrityName, braveApiKey, {
      maxSites: opts.maxSites,
    });

    if (jobState.cancelled) {
      await storage.updateCrawlJob(jobId, { status: 'cancelled' });
      runningJobs.delete(jobId);
      return { jobId, status: 'partial', imagesDownloaded: 0, duplicatesRemoved: 0, pagesScanned: 0, sitesDiscovered: 0, error: 'Cancelled by user', imageIds: [] };
    }

    console.log(`[CrawlJob ${jobId}] Found ${fanSites.length} potential fan sites`);

    await storage.updateCrawlJob(jobId, {
      discoveredSites: fanSites.map(s => ({ url: s.url, type: s.galleryType, confidence: s.confidence })),
      status: 'crawling',
    });

    if (fanSites.length === 0) {
      await storage.updateCrawlJob(jobId, {
        status: 'completed',
        error: 'No fan sites discovered',
      });

      return {
        jobId,
        status: 'completed',
        imagesDownloaded: 0,
        duplicatesRemoved: 0,
        pagesScanned: 0,
        sitesDiscovered: 0,
        imageIds: [],
      };
    }

    for (const site of fanSites) {
      if (jobState.cancelled) {
        await storage.updateCrawlJob(jobId, { status: 'cancelled' });
        runningJobs.delete(jobId);
        return { jobId, status: 'partial', imagesDownloaded: totalImagesDownloaded, duplicatesRemoved: totalDuplicatesRemoved, pagesScanned: totalPagesScanned, sitesDiscovered: fanSites.length, error: 'Cancelled by user', imageIds };
      }
      
      if (totalImagesDownloaded >= opts.maxImages) {
        console.log(`[CrawlJob ${jobId}] Reached max images limit: ${opts.maxImages}`);
        break;
      }

      console.log(`[CrawlJob ${jobId}] Crawling site: ${site.url} (type: ${site.galleryType})`);
      
      await storage.updateCrawlJob(jobId, {
        currentSite: site.url,
      });

      try {
        if (site.galleryType === 'coppermine' && site.categoryUrl) {
          const crawler = new CoppermineGalleryCrawler(site.categoryUrl, {
            maxDepth: opts.crawlDepth,
            onProgress: (state) => {
              totalPagesScanned = state.pagesScanned;
              try {
                const result = storage.updateCrawlJob(jobId, {
                  pagesScanned: totalPagesScanned,
                  imagesFound: state.foundImages.length,
                });
                // Handle both sync and async returns
                if (result && typeof (result as any).catch === 'function') {
                  (result as Promise<any>).catch(console.error);
                }
              } catch (e) {
                console.error('Error updating crawl job:', e);
              }
            },
          });

          const remainingImages = opts.maxImages - totalImagesDownloaded;
          const foundImages = await crawler.crawl(remainingImages);
          
          console.log(`[CrawlJob ${jobId}] Found ${foundImages.length} images on ${site.url}`);
          totalImagesFound += foundImages.length;

          if (jobState.cancelled) {
            await storage.updateCrawlJob(jobId, { status: 'cancelled' });
            runningJobs.delete(jobId);
            return { jobId, status: 'partial', imagesDownloaded: totalImagesDownloaded, duplicatesRemoved: totalDuplicatesRemoved, pagesScanned: totalPagesScanned, sitesDiscovered: fanSites.length, error: 'Cancelled by user', imageIds };
          }

          await storage.updateCrawlJob(jobId, { status: 'downloading', imagesFound: totalImagesFound });

          const imageUrls = foundImages.map(img => img.fullSizeUrl);
          console.log(`[CrawlJob ${jobId}] Starting download of ${imageUrls.length} image URLs`);
          if (imageUrls.length > 0) {
            console.log(`[CrawlJob ${jobId}] Sample URLs:`, imageUrls.slice(0, 3));
          }
          
          let successCount = 0;
          let failCount = 0;
          let skipCount = 0;

          // Download and cache images immediately as they're downloaded
          const { duplicateCount, cancelled: downloadCancelled } = await downloadWithDeduplication(
            imageUrls,
            seenHashes,
            {
              minResolution: opts.minResolution,
              minDelay: 300,
              maxDelay: 800,
              shouldCancel: () => jobState.cancelled,
              onProgress: async (completed, total, result, isDuplicate) => {
                // Log every result to debug
                if (result.success) {
                  successCount++;
                } else if (result.skipped) {
                  skipCount++;
                  if (completed <= 5) {
                    console.log(`[CrawlJob ${jobId}] Skipped #${completed}: ${result.skipReason}`);
                  }
                } else {
                  failCount++;
                  if (completed <= 5) {
                    console.log(`[CrawlJob ${jobId}] Failed #${completed}: ${result.error}`);
                  }
                }

                if (isDuplicate) {
                  totalDuplicatesRemoved++;
                }
                
                // Cache successful non-duplicate images immediately
                if (result.success && result.image && !isDuplicate) {
                  try {
                    const isDuplicatePerceptual = await deduplicator.checkDuplicate(result.image.buffer);
                    if (isDuplicatePerceptual.isDuplicate) {
                      totalDuplicatesRemoved++;
                    } else {
                      await deduplicator.addImage(result.image.hash, result.image.buffer);
                      
                      // Save to cache immediately
                      await crawlCache.saveToCache(jobId, result.image.buffer, {
                        url: result.image.url,
                        width: result.image.width,
                        height: result.image.height,
                        hash: result.image.hash,
                        contentType: result.image.contentType,
                      });
                      
                      totalImagesDownloaded++;
                      if (totalImagesDownloaded <= 3) {
                        console.log(`[CrawlJob ${jobId}] Cached image #${totalImagesDownloaded}: ${result.image.width}x${result.image.height}`);
                      }
                    }
                  } catch (e) {
                    console.error(`[CrawlJob ${jobId}] Error caching image:`, e);
                  }
                }
                
                // Update progress every 3 images
                if (completed % 3 === 0) {
                  try {
                    const updateResult = storage.updateCrawlJob(jobId, {
                      imagesDownloaded: totalImagesDownloaded,
                      duplicatesRemoved: totalDuplicatesRemoved,
                    });
                    if (updateResult && typeof (updateResult as any).catch === 'function') {
                      (updateResult as Promise<any>).catch(console.error);
                    }
                  } catch (e) {
                    console.error('Error updating crawl job:', e);
                  }
                }

                // Log summary periodically
                if (completed % 20 === 0) {
                  console.log(`[CrawlJob ${jobId}] Progress: ${completed}/${total} - Success: ${successCount}, Failed: ${failCount}, Skipped: ${skipCount}, Cached: ${totalImagesDownloaded}`);
                }
              },
            }
          );

          totalDuplicatesRemoved += duplicateCount;

          // Check if cancelled after processing this site
          if (downloadCancelled || jobState.cancelled) {
            console.log(`[CrawlJob ${jobId}] Job cancelled. Cached images: ${totalImagesDownloaded}`);
            
            await storage.updateCrawlJob(jobId, {
              status: 'cancelled',
              pagesScanned: totalPagesScanned,
              imagesFound: totalImagesFound,
              imagesDownloaded: totalImagesDownloaded,
              duplicatesRemoved: totalDuplicatesRemoved,
              currentSite: null,
            });

            runningJobs.delete(jobId);
            
            // Return partial results - cached images are preserved
            return {
              jobId,
              status: 'partial',
              imagesDownloaded: totalImagesDownloaded,
              duplicatesRemoved: totalDuplicatesRemoved,
              pagesScanned: totalPagesScanned,
              sitesDiscovered: fanSites.length,
              error: 'Cancelled by user - cached images preserved',
              imageIds,
            };
          }
        }
      } catch (error) {
        console.error(`[CrawlJob ${jobId}] Error crawling site ${site.url}:`, error);
      }
    }

    runningJobs.delete(jobId);
    
    await storage.updateCrawlJob(jobId, {
      status: 'completed',
      pagesScanned: totalPagesScanned,
      imagesFound: totalImagesFound,
      imagesDownloaded: totalImagesDownloaded,
      duplicatesRemoved: totalDuplicatesRemoved,
      currentSite: null,
      completedAt: new Date(),
    });

    console.log(`[CrawlJob ${jobId}] Completed. Downloaded: ${totalImagesDownloaded}, Duplicates removed: ${totalDuplicatesRemoved}`);

    return {
      jobId,
      status: 'completed',
      imagesDownloaded: totalImagesDownloaded,
      duplicatesRemoved: totalDuplicatesRemoved,
      pagesScanned: totalPagesScanned,
      sitesDiscovered: fanSites.length,
      imageIds,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CrawlJob ${jobId}] Fatal error:`, error);

    runningJobs.delete(jobId);
    
    await storage.updateCrawlJob(jobId, {
      status: 'failed',
      error: errorMessage,
    });

    return {
      jobId,
      status: 'failed',
      imagesDownloaded: totalImagesDownloaded,
      duplicatesRemoved: totalDuplicatesRemoved,
      pagesScanned: totalPagesScanned,
      sitesDiscovered: 0,
      error: errorMessage,
      imageIds,
    };
  }
}

export async function getCrawlJobStatus(jobId: string): Promise<CrawlJob | null> {
  const job = await storage.getCrawlJob(jobId);
  return job || null;
}

export async function cancelCrawlJob(jobId: string): Promise<boolean> {
  const job = await storage.getCrawlJob(jobId);
  if (!job) {
    return false;
  }
  
  const activeStatuses = ['pending', 'searching', 'crawling', 'downloading'];
  if (!activeStatuses.includes(job.status)) {
    return false;
  }

  const jobState = runningJobs.get(jobId);
  if (jobState) {
    jobState.cancelled = true;
  } else {
    await storage.updateCrawlJob(jobId, { status: 'cancelled' });
  }

  // NOTE: Don't clear cache on cancel - preserve downloaded images for user review
  // User can still import what was downloaded or manually discard

  return true;
}

/**
 * Import selected cached images to permanent storage
 */
export async function importCachedImages(
  jobId: string,
  datasetId: string,
  imageIds?: string[] // If not provided, import all
): Promise<{ imported: number; failed: number; imageIds: string[] }> {
  const cachedImages = crawlCache.getCachedImages(jobId);
  const imagesToImport = imageIds 
    ? cachedImages.filter(img => imageIds.includes(img.id))
    : cachedImages;

  const dataset = await storage.getDataset(datasetId);
  if (!dataset) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  const job = await storage.getCrawlJob?.(jobId);
  const celebrityName = job?.celebrityName || 'unknown';

  let imported = 0;
  let failed = 0;
  const newImageIds: string[] = [];

  for (const cachedImage of imagesToImport) {
    try {
      const buffer = await crawlCache.readCachedImage(cachedImage);

      const storageKey = storageAdapter.generateStorageKey(
        'images',
        `${celebrityName.replace(/\s+/g, '_')}_${cachedImage.hash}.jpg`
      );

      await storageAdapter.uploadBuffer(
        buffer,
        storageKey,
        cachedImage.contentType
      );

      const aspectRatio = cachedImage.width && cachedImage.height
        ? `${cachedImage.width}:${cachedImage.height}`
        : undefined;

      const image = await storage.createImage({
        datasetId,
        workspaceId: dataset.workspaceId,
        sourceType: 'crawl',
        sourceUrl: cachedImage.url,
        storageKey,
        originalFilename: cachedImage.url.split('/').pop() || 'image.jpg',
        width: cachedImage.width,
        height: cachedImage.height,
        mime: cachedImage.contentType,
        sizeBytes: cachedImage.sizeBytes,
        hash: cachedImage.hash,
        aspectRatio,
        flaggedDuplicate: false,
      });

      newImageIds.push(image.id);
      imported++;

    } catch (error) {
      console.error(`Failed to import cached image ${cachedImage.id}:`, error);
      failed++;
    }
  }

  // Clear imported images from cache
  if (imageIds) {
    await crawlCache.deleteFromCache(jobId, imageIds);
  } else {
    await crawlCache.clearJobCache(jobId);
  }

  return { imported, failed, imageIds: newImageIds };
}

/**
 * Discard cached images without importing
 */
export async function discardCachedImages(
  jobId: string,
  imageIds?: string[] // If not provided, discard all
): Promise<void> {
  if (imageIds) {
    await crawlCache.deleteFromCache(jobId, imageIds);
  } else {
    await crawlCache.clearJobCache(jobId);
  }
}

/**
 * Get cached images for review
 */
export function getCachedImages(jobId: string) {
  return crawlCache.getCachedImages(jobId);
}

// Re-export types for external consumers
export type { FanSite } from './siteDetector';
export type { CoppermineImageInfo } from './galleryCrawler';
export type { DownloadedImage, DownloadResult } from './imageDownloader';
export type { ImageHash, DuplicateResult } from './deduplicator';
export { ImageDeduplicator } from './deduplicator';
export { crawlCache } from '../crawlCache';
