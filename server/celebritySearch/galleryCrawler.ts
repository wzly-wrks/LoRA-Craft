import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export interface GalleryPage {
  url: string;
  type: 'category' | 'album' | 'image';
  title?: string;
  imageUrls?: string[];
  childLinks?: string[];
}

export interface CrawlState {
  visitedUrls: Set<string>;
  pendingUrls: string[];
  foundImages: string[];
  currentDepth: number;
  pagesScanned: number;
}

export interface CoppermineImageInfo {
  fullSizeUrl: string;
  thumbnailUrl?: string;
  pageUrl: string;
  title?: string;
  dimensions?: { width: number; height: number };
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function parsePageType(url: string): 'category' | 'album' | 'image' | 'unknown' {
  if (url.includes('index.php?cat=')) return 'category';
  if (url.includes('thumbnails.php?album=')) return 'album';
  if (url.includes('displayimage.php?pid=') || url.includes('displayimage.php?pos=')) return 'image';
  return 'unknown';
}

export async function parseCategoryPage(
  url: string,
  html: string,
  baseUrl: string
): Promise<GalleryPage> {
  const $ = cheerio.load(html);
  const childLinks: string[] = [];

  $('a[href*="index.php?cat="]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && !href.includes('cat=0')) {
      const fullUrl = resolveUrl(href, baseUrl);
      if (!childLinks.includes(fullUrl)) {
        childLinks.push(fullUrl);
      }
    }
  });

  $('a[href*="thumbnails.php?album="]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      const fullUrl = resolveUrl(href, baseUrl);
      if (!childLinks.includes(fullUrl)) {
        childLinks.push(fullUrl);
      }
    }
  });

  const title = $('title').text().trim() || $('h1').first().text().trim();

  return {
    url,
    type: 'category',
    title,
    childLinks,
  };
}

export async function parseAlbumPage(
  url: string,
  html: string,
  baseUrl: string
): Promise<GalleryPage> {
  const $ = cheerio.load(html);
  const childLinks: string[] = [];
  const imageUrls: string[] = [];

  $('a[href*="displayimage.php?pid="], a[href*="displayimage.php?pos="]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      const fullUrl = resolveUrl(href, baseUrl);
      if (!childLinks.includes(fullUrl)) {
        childLinks.push(fullUrl);
      }
    }
  });

  $('a[href*="thumbnails.php?album="]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && !href.includes(url)) {
      const fullUrl = resolveUrl(href, baseUrl);
      const currentPageNum = getPageNumber(url);
      const linkPageNum = getPageNumber(fullUrl);
      if (linkPageNum > currentPageNum && !childLinks.includes(fullUrl)) {
        childLinks.push(fullUrl);
      }
    }
  });

  $('img.thumbnail, img[src*="thumb_"], img[src*="/thumb/"], .thumbnails img').each((_, elem) => {
    const src = $(elem).attr('src');
    if (src) {
      const fullUrl = resolveUrl(src, baseUrl);
      const fullSizeUrl = thumbnailToFullSize(fullUrl);
      if (fullSizeUrl && !imageUrls.includes(fullSizeUrl)) {
        imageUrls.push(fullSizeUrl);
      }
    }
  });

  const title = $('title').text().trim() || $('h1').first().text().trim();

  return {
    url,
    type: 'album',
    title,
    childLinks,
    imageUrls,
  };
}

export async function parseImagePage(
  url: string,
  html: string,
  baseUrl: string
): Promise<CoppermineImageInfo | null> {
  const $ = cheerio.load(html);

  let fullSizeUrl: string | undefined;

  const mainImage = $('#cpgimage, img.image, img.photo, .display img, #fullsize-image, .main-image img').first();
  if (mainImage.length) {
    fullSizeUrl = mainImage.attr('src');
  }

  if (!fullSizeUrl) {
    const largeLink = $('a[href*="/albums/"][href$=".jpg"], a[href*="/albums/"][href$=".jpeg"], a[href*="/albums/"][href$=".png"]').first();
    if (largeLink.length) {
      fullSizeUrl = largeLink.attr('href');
    }
  }

  if (!fullSizeUrl) {
    $('img').each((_, elem) => {
      const src = $(elem).attr('src');
      if (src && isLikelyFullSizeImage(src)) {
        fullSizeUrl = src;
        return false;
      }
    });
  }

  if (!fullSizeUrl) {
    const intermediateUrl = findIntermediateImage($, baseUrl);
    if (intermediateUrl) {
      fullSizeUrl = intermediateToFullSize(intermediateUrl);
    }
  }

  if (!fullSizeUrl) {
    return null;
  }

  fullSizeUrl = resolveUrl(fullSizeUrl, baseUrl);

  const title = $('title').text().trim() || $('.image-title').text().trim();

  let dimensions: { width: number; height: number } | undefined;
  const dimensionText = $('body').text().match(/(\d{3,4})\s*[xX×]\s*(\d{3,4})/);
  if (dimensionText) {
    dimensions = {
      width: parseInt(dimensionText[1], 10),
      height: parseInt(dimensionText[2], 10),
    };
  }

  return {
    fullSizeUrl,
    pageUrl: url,
    title,
    dimensions,
  };
}

function isLikelyFullSizeImage(src: string): boolean {
  const lowerSrc = src.toLowerCase();
  
  if (lowerSrc.includes('thumb_') || lowerSrc.includes('/thumb/') || lowerSrc.includes('_thumb')) {
    return false;
  }
  if (lowerSrc.includes('normal_') || lowerSrc.includes('/normal/')) {
    return false;
  }
  
  if (lowerSrc.includes('/albums/') && (lowerSrc.endsWith('.jpg') || lowerSrc.endsWith('.jpeg') || lowerSrc.endsWith('.png'))) {
    return true;
  }
  
  return false;
}

function findIntermediateImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  let intermediateUrl: string | undefined;
  
  $('img').each((_, elem) => {
    const src = $(elem).attr('src');
    if (src && src.includes('normal_')) {
      intermediateUrl = resolveUrl(src, baseUrl);
      return false;
    }
  });
  
  return intermediateUrl;
}

function intermediateToFullSize(url: string): string {
  return url.replace(/normal_/g, '');
}

function thumbnailToFullSize(thumbnailUrl: string): string | undefined {
  if (thumbnailUrl.includes('thumb_')) {
    return thumbnailUrl.replace('thumb_', '');
  }
  if (thumbnailUrl.includes('/thumb/')) {
    return thumbnailUrl.replace('/thumb/', '/');
  }
  return undefined;
}

function getPageNumber(url: string): number {
  const match = url.match(/page=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

export class CoppermineGalleryCrawler {
  private state: CrawlState;
  private baseUrl: string;
  private maxDepth: number;
  private onProgress?: (state: CrawlState) => void;

  constructor(
    startUrl: string,
    options: {
      maxDepth?: number;
      onProgress?: (state: CrawlState) => void;
    } = {}
  ) {
    this.baseUrl = new URL(startUrl).origin;
    this.maxDepth = options.maxDepth || 3;
    this.onProgress = options.onProgress;
    
    this.state = {
      visitedUrls: new Set(),
      pendingUrls: [startUrl],
      foundImages: [],
      currentDepth: 0,
      pagesScanned: 0,
    };
  }

  async crawl(
    maxImages: number,
    delayMs: { min: number; max: number } = { min: 500, max: 1500 }
  ): Promise<CoppermineImageInfo[]> {
    const images: CoppermineImageInfo[] = [];

    while (this.state.pendingUrls.length > 0 && images.length < maxImages) {
      const url = this.state.pendingUrls.shift()!;
      
      if (this.state.visitedUrls.has(url)) {
        continue;
      }
      
      this.state.visitedUrls.add(url);
      this.state.pagesScanned++;

      try {
        const html = await fetchPage(url);
        const pageType = parsePageType(url);

        switch (pageType) {
          case 'category': {
            const page = await parseCategoryPage(url, html, this.baseUrl);
            for (const link of page.childLinks || []) {
              if (!this.state.visitedUrls.has(link)) {
                this.state.pendingUrls.push(link);
              }
            }
            break;
          }
          
          case 'album': {
            const page = await parseAlbumPage(url, html, this.baseUrl);
            for (const link of page.childLinks || []) {
              if (!this.state.visitedUrls.has(link)) {
                this.state.pendingUrls.push(link);
              }
            }
            break;
          }
          
          case 'image': {
            const imageInfo = await parseImagePage(url, html, this.baseUrl);
            if (imageInfo && !this.state.foundImages.includes(imageInfo.fullSizeUrl)) {
              images.push(imageInfo);
              this.state.foundImages.push(imageInfo.fullSizeUrl);
            }
            break;
          }
          
          default: {
            const categoryPage = await parseCategoryPage(url, html, this.baseUrl);
            for (const link of categoryPage.childLinks || []) {
              if (!this.state.visitedUrls.has(link)) {
                this.state.pendingUrls.push(link);
              }
            }
          }
        }

        if (this.onProgress) {
          this.onProgress(this.state);
        }

        const delay = Math.floor(Math.random() * (delayMs.max - delayMs.min + 1)) + delayMs.min;
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.error(`Error crawling ${url}:`, error);
      }
    }

    return images;
  }

  getState(): CrawlState {
    return { ...this.state };
  }
}

export async function extractImagesFromAlbumDirect(
  albumUrl: string,
  maxImages: number = 100
): Promise<string[]> {
  const images: string[] = [];
  const visitedPages = new Set<string>();
  let currentUrl: string | null = albumUrl;
  const baseUrl = new URL(albumUrl).origin;

  while (currentUrl && images.length < maxImages) {
    if (visitedPages.has(currentUrl)) break;
    visitedPages.add(currentUrl);

    try {
      const html = await fetchPage(currentUrl);
      const $ = cheerio.load(html);

      $('a[href*="displayimage.php"]').each((_, elem) => {
        const img = $(elem).find('img').first();
        const src = img.attr('src');
        if (src && images.length < maxImages) {
          const fullUrl = resolveUrl(src, baseUrl);
          const fullSizeUrl = thumbnailToFullSize(fullUrl);
          if (fullSizeUrl && !images.includes(fullSizeUrl)) {
            images.push(fullSizeUrl);
          }
        }
      });

      let nextPageUrl: string | null = null;
      $('a').each((_, elem) => {
        const text = $(elem).text().toLowerCase();
        const href = $(elem).attr('href');
        if (href && (text.includes('next') || text === '>' || text === '»')) {
          nextPageUrl = resolveUrl(href, baseUrl);
          return false;
        }
      });

      currentUrl = nextPageUrl;
      
      if (currentUrl) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

    } catch (error) {
      console.error(`Error extracting from album ${currentUrl}:`, error);
      break;
    }
  }

  return images;
}
