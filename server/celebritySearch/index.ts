import { discoverFanSites, FanSite } from './siteDetector';
import { CoppermineGalleryCrawler, CoppermineImageInfo } from './galleryCrawler';
import { downloadWithDeduplication, DownloadedImage } from './imageDownloader';
import { ImageDeduplicator, meetsMinimumResolution } from './deduplicator';
import { storage } from '../storage';
import { objectStorageService } from '../objectStorage';
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

export async function runCelebritySearch(
  celebrityName: string,
  datasetId: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
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
    status: 'running',
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

  const imageIds: string[] = [];
  const seenHashes = new Set<string>();
  const deduplicator = new ImageDeduplicator(0.92);

  let totalPagesScanned = 0;
  let totalImagesFound = 0;
  let totalImagesDownloaded = 0;
  let totalDuplicatesRemoved = 0;

  try {
    console.log(`[CrawlJob ${jobId}] Starting celebrity search for: ${celebrityName}`);
    
    console.log(`[CrawlJob ${jobId}] Discovering fan sites...`);
    const fanSites = await discoverFanSites(celebrityName, braveApiKey, {
      maxSites: opts.maxSites,
    });

    console.log(`[CrawlJob ${jobId}] Found ${fanSites.length} potential fan sites`);

    await storage.updateCrawlJob(jobId, {
      discoveredSites: fanSites.map(s => ({ url: s.url, type: s.galleryType, confidence: s.confidence })),
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
              storage.updateCrawlJob(jobId, {
                pagesScanned: totalPagesScanned,
                imagesFound: state.foundImages.length,
              }).catch(console.error);
            },
          });

          const remainingImages = opts.maxImages - totalImagesDownloaded;
          const foundImages = await crawler.crawl(remainingImages);
          
          console.log(`[CrawlJob ${jobId}] Found ${foundImages.length} images on ${site.url}`);
          totalImagesFound += foundImages.length;

          const imageUrls = foundImages.map(img => img.fullSizeUrl);
          
          const { newImages, duplicateCount } = await downloadWithDeduplication(
            imageUrls,
            seenHashes,
            {
              minResolution: opts.minResolution,
              minDelay: 500,
              maxDelay: 1500,
              onProgress: (completed, total, result, isDuplicate) => {
                if (result.success && !isDuplicate) {
                  totalImagesDownloaded++;
                }
                if (isDuplicate) {
                  totalDuplicatesRemoved++;
                }
                
                if (completed % 10 === 0) {
                  storage.updateCrawlJob(jobId, {
                    imagesDownloaded: totalImagesDownloaded,
                    duplicatesRemoved: totalDuplicatesRemoved,
                  }).catch(console.error);
                }
              },
            }
          );

          totalDuplicatesRemoved += duplicateCount;

          for (const downloadedImage of newImages) {
            try {
              const isDuplicatePerceptual = await deduplicator.checkDuplicate(downloadedImage.buffer);
              if (isDuplicatePerceptual.isDuplicate) {
                totalDuplicatesRemoved++;
                continue;
              }

              await deduplicator.addImage(downloadedImage.hash, downloadedImage.buffer);

              const storageKey = objectStorageService.generateStorageKey(
                'images',
                `${celebrityName.replace(/\s+/g, '_')}_${downloadedImage.hash}.jpg`
              );

              await objectStorageService.uploadBuffer(
                downloadedImage.buffer,
                storageKey,
                downloadedImage.contentType
              );

              const aspectRatio = downloadedImage.width && downloadedImage.height
                ? `${downloadedImage.width}:${downloadedImage.height}`
                : undefined;

              const image = await storage.createImage({
                datasetId,
                workspaceId: dataset.workspaceId,
                sourceType: 'crawl',
                sourceUrl: downloadedImage.url,
                storageKey,
                originalFilename: downloadedImage.url.split('/').pop() || 'image.jpg',
                width: downloadedImage.width,
                height: downloadedImage.height,
                mime: downloadedImage.contentType,
                sizeBytes: downloadedImage.sizeBytes,
                hash: downloadedImage.hash,
                aspectRatio,
                flaggedDuplicate: false,
              });

              imageIds.push(image.id);

            } catch (error) {
              console.error(`[CrawlJob ${jobId}] Error saving image:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`[CrawlJob ${jobId}] Error crawling site ${site.url}:`, error);
      }
    }

    await storage.updateCrawlJob(jobId, {
      status: 'completed',
      pagesScanned: totalPagesScanned,
      imagesFound: totalImagesFound,
      imagesDownloaded: totalImagesDownloaded,
      duplicatesRemoved: totalDuplicatesRemoved,
      currentSite: null,
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
  if (!job || job.status !== 'running') {
    return false;
  }

  await storage.updateCrawlJob(jobId, {
    status: 'cancelled',
  });

  return true;
}

export { FanSite } from './siteDetector';
export { CoppermineImageInfo } from './galleryCrawler';
export { DownloadedImage, DownloadResult } from './imageDownloader';
export { ImageHash, DuplicateResult, ImageDeduplicator } from './deduplicator';
