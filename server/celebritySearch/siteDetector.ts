import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export interface FanSite {
  url: string;
  domain: string;
  galleryType: 'coppermine' | 'wordpress' | 'custom' | 'unknown';
  confidence: number;
  categoryUrl?: string;
  albumsFound?: number;
}

export interface WebSearchResult {
  url: string;
  title: string;
  description: string;
}

const FAN_SITE_PATTERNS = [
  /pictures?\.(com|net|org)/i,
  /gallery\.(com|net|org)/i,
  /photos?\.(com|net|org)/i,
  /images?\.(com|net|org)/i,
  /pics\.(com|net|org)/i,
  /-pictures?\.com/i,
  /-gallery\.com/i,
  /-photos?\.com/i,
];

const COPPERMINE_INDICATORS = [
  'index.php?cat=',
  'thumbnails.php?album=',
  'displayimage.php?pid=',
  'coppermine',
  'Coppermine Photo Gallery',
  'cpg_user_message',
  'class="tableb"',
  'class="navmenu"',
];

const GALLERY_PATH_PATTERNS = [
  /\/gallery\//i,
  /\/photos?\//i,
  /\/pictures?\//i,
  /\/images?\//i,
  /\/albums?\//i,
];

export async function searchForFanSites(
  celebrityName: string,
  apiKey: string,
  options: { count?: number } = {}
): Promise<WebSearchResult[]> {
  const count = options.count || 20;
  
  const queries = [
    `"${celebrityName}" fan site gallery pictures`,
    `"${celebrityName}" photo gallery thumbnails`,
    `"${celebrityName}" pictures archive high resolution`,
    `site:*pictures.net "${celebrityName}"`,
    `"${celebrityName}" coppermine gallery`,
  ];

  const allResults: WebSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries.slice(0, 2)) {
    try {
      const results = await searchBraveWeb(query, apiKey, { count: Math.ceil(count / 2) });
      for (const result of results) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push(result);
        }
      }
      await delay(500);
    } catch (error) {
      console.error(`Search failed for query: ${query}`, error);
    }
  }

  return allResults;
}

async function searchBraveWeb(
  query: string,
  apiKey: string,
  options: { count?: number; offset?: number } = {}
): Promise<WebSearchResult[]> {
  const count = options.count || 20;
  const offset = options.offset || 0;

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', count.toString());
  url.searchParams.set('offset', offset.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brave web search failed: ${response.status} - ${text}`);
  }

  const data = await response.json() as any;
  const results: WebSearchResult[] = [];

  if (data.web?.results) {
    for (const item of data.web.results) {
      results.push({
        url: item.url,
        title: item.title || '',
        description: item.description || '',
      });
    }
  }

  return results;
}

export function isFanSiteDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    return FAN_SITE_PATTERNS.some(pattern => pattern.test(domain));
  } catch {
    return false;
  }
}

export function hasGalleryPath(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    return GALLERY_PATH_PATTERNS.some(pattern => pattern.test(path));
  } catch {
    return false;
  }
}

export async function detectCoppermineGallery(url: string): Promise<{
  isCoppermine: boolean;
  categoryUrl?: string;
  confidence: number;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return { isCoppermine: false, confidence: 0 };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(url);

    let score = 0;
    const foundIndicators: string[] = [];

    for (const indicator of COPPERMINE_INDICATORS) {
      if (html.includes(indicator)) {
        score += 1;
        foundIndicators.push(indicator);
      }
    }

    // Look for Coppermine-style links with proper path detection
    // These links might be under /photos/, /gallery/, etc.
    const allLinks = $('a[href*="index.php?cat="], a[href*="thumbnails.php?album="], a[href*="displayimage.php?pid="], a[href*="displayimage.php?pos="]');
    if (allLinks.length > 0) {
      score += 3;
      foundIndicators.push(`Found ${allLinks.length} Coppermine-style links`);
    }

    const isCoppermine = score >= 2;
    const confidence = Math.min(score / 6, 1);

    let categoryUrl: string | undefined;
    if (isCoppermine) {
      // Try to find the actual gallery path from links
      // Look for any link with thumbnails.php or displayimage.php to find the real gallery base
      let galleryBasePath = '';
      
      // Check thumbnails.php links first - they're most reliable for albums
      const thumbnailLink = $('a[href*="thumbnails.php?album="]').first().attr('href');
      console.log(`[SiteDetector] Found thumbnail link: ${thumbnailLink}`);
      if (thumbnailLink) {
        try {
          const thumbUrl = new URL(thumbnailLink, baseUrl);
          console.log(`[SiteDetector] Resolved thumbnail URL: ${thumbUrl.toString()}`);
          // Extract the path before thumbnails.php
          const pathMatch = thumbUrl.pathname.match(/^(.*)\/thumbnails\.php$/);
          if (pathMatch) {
            galleryBasePath = pathMatch[1];
            console.log(`[SiteDetector] Extracted gallery base path: ${galleryBasePath}`);
          }
          // Use the album URL directly as it's more specific
          categoryUrl = thumbUrl.toString();
          console.log(`[SiteDetector] Using categoryUrl: ${categoryUrl}`);
          return { isCoppermine, categoryUrl, confidence };
        } catch (e) {
          console.error(`[SiteDetector] Error parsing thumbnail URL:`, e);
          // ignore URL parsing errors
        }
      }
      
      // Try displayimage.php links
      const displayLink = $('a[href*="displayimage.php"]').first().attr('href');
      if (displayLink) {
        try {
          const displayUrl = new URL(displayLink, baseUrl);
          const pathMatch = displayUrl.pathname.match(/^(.*)\/displayimage\.php$/);
          if (pathMatch) {
            galleryBasePath = pathMatch[1];
          }
        } catch (e) {
          // ignore
        }
      }

      // Try index.php?cat= links
      const catLink = $('a[href*="index.php?cat="]').first().attr('href');
      if (catLink) {
        try {
          const catUrl = new URL(catLink, baseUrl);
          const pathMatch = catUrl.pathname.match(/^(.*)\/index\.php$/);
          if (pathMatch && !galleryBasePath) {
            galleryBasePath = pathMatch[1];
          }
          if (!categoryUrl) {
            categoryUrl = catUrl.toString();
          }
        } catch (e) {
          // ignore
        }
      }
      
      // If we found a gallery base path, construct proper URL
      if (galleryBasePath && !categoryUrl) {
        categoryUrl = new URL(`${galleryBasePath}/index.php?cat=0`, baseUrl).toString();
      } else if (!categoryUrl) {
        // Default fallback
        categoryUrl = new URL('/index.php?cat=0', baseUrl).toString();
      }
    }

    return { isCoppermine, categoryUrl, confidence };
  } catch (error) {
    console.error(`Error detecting Coppermine gallery at ${url}:`, error);
    return { isCoppermine: false, confidence: 0 };
  }
}

export async function detectSiteType(url: string): Promise<FanSite> {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    const coppermineResult = await detectCoppermineGallery(url);
    
    if (coppermineResult.isCoppermine) {
      return {
        url,
        domain,
        galleryType: 'coppermine',
        confidence: coppermineResult.confidence,
        categoryUrl: coppermineResult.categoryUrl,
      };
    }

    return {
      url,
      domain,
      galleryType: 'unknown',
      confidence: 0.1,
    };
  } catch (error) {
    console.error(`Error detecting site type for ${url}:`, error);
    return {
      url,
      domain: new URL(url).hostname,
      galleryType: 'unknown',
      confidence: 0,
    };
  }
}

export async function discoverFanSites(
  celebrityName: string,
  apiKey: string,
  options: { maxSites?: number } = {}
): Promise<FanSite[]> {
  const maxSites = options.maxSites || 5;
  
  const searchResults = await searchForFanSites(celebrityName, apiKey, { count: 30 });
  
  const prioritizedUrls = searchResults
    .map(result => ({
      ...result,
      priority: calculateUrlPriority(result.url, result.title, result.description),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxSites * 2);

  const fanSites: FanSite[] = [];

  for (const result of prioritizedUrls) {
    if (fanSites.length >= maxSites) break;

    try {
      const siteInfo = await detectSiteType(result.url);
      
      if (siteInfo.galleryType !== 'unknown' || siteInfo.confidence > 0.3) {
        const existingDomain = fanSites.find(s => s.domain === siteInfo.domain);
        if (!existingDomain) {
          fanSites.push(siteInfo);
        }
      }

      await delay(randomDelay(500, 1500));
    } catch (error) {
      console.error(`Error processing site ${result.url}:`, error);
    }
  }

  return fanSites.sort((a, b) => b.confidence - a.confidence);
}

function calculateUrlPriority(url: string, title: string, description: string): number {
  let priority = 0;

  if (isFanSiteDomain(url)) priority += 3;
  if (hasGalleryPath(url)) priority += 2;
  if (url.includes('index.php?cat=')) priority += 4;
  if (url.includes('thumbnails.php')) priority += 3;

  const combinedText = `${title} ${description}`.toLowerCase();
  if (combinedText.includes('gallery')) priority += 2;
  if (combinedText.includes('pictures')) priority += 1;
  if (combinedText.includes('photos')) priority += 1;
  if (combinedText.includes('high quality')) priority += 2;
  if (combinedText.includes('hq')) priority += 1;

  return priority;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
