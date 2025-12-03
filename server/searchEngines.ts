import fetch from 'node-fetch';

export interface SearchResult {
  url: string;
  thumbnailUrl: string;
  title: string;
  width?: number;
  height?: number;
  source: 'brave' | 'bing' | 'google';
}

export interface SearchOptions {
  query: string;
  count?: number;
  offset?: number;
  safeSearch?: 'off' | 'moderate' | 'strict';
}

export interface SearchEngineConfig {
  brave?: { apiKey: string };
  bing?: { apiKey: string };
  google?: { apiKey: string; searchEngineId: string };
}

export async function searchBrave(
  query: string,
  apiKey: string,
  options: { count?: number; offset?: number; safeSearch?: string } = {}
): Promise<SearchResult[]> {
  const count = options.count || 20;
  const offset = options.offset || 0;
  const safeSearch = options.safeSearch || 'moderate';

  const url = new URL('https://api.search.brave.com/res/v1/images/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', count.toString());
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('safesearch', safeSearch);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brave search failed: ${response.status} - ${text}`);
  }

  const data = await response.json() as any;
  const results: SearchResult[] = [];

  if (data.results) {
    for (const item of data.results) {
      results.push({
        url: item.properties?.url || item.url,
        thumbnailUrl: item.thumbnail?.src || item.properties?.url || item.url,
        title: item.title || '',
        width: item.properties?.width,
        height: item.properties?.height,
        source: 'brave'
      });
    }
  }

  return results;
}

export async function searchBing(
  query: string,
  apiKey: string,
  options: { count?: number; offset?: number; safeSearch?: string } = {}
): Promise<SearchResult[]> {
  const count = options.count || 20;
  const offset = options.offset || 0;
  const safeSearch = options.safeSearch || 'Moderate';

  const url = new URL('https://api.bing.microsoft.com/v7.0/images/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', count.toString());
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('safeSearch', safeSearch);

  const response = await fetch(url.toString(), {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bing search failed: ${response.status} - ${text}`);
  }

  const data = await response.json() as any;
  const results: SearchResult[] = [];

  if (data.value) {
    for (const item of data.value) {
      results.push({
        url: item.contentUrl,
        thumbnailUrl: item.thumbnailUrl,
        title: item.name || '',
        width: item.width,
        height: item.height,
        source: 'bing'
      });
    }
  }

  return results;
}

export async function searchGoogle(
  query: string,
  apiKey: string,
  searchEngineId: string,
  options: { count?: number; start?: number; safeSearch?: string } = {}
): Promise<SearchResult[]> {
  const num = Math.min(options.count || 10, 10);
  const start = (options.start || 0) + 1;
  const safe = options.safeSearch === 'off' ? 'off' : 'active';

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('q', query);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', searchEngineId);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('num', num.toString());
  url.searchParams.set('start', start.toString());
  url.searchParams.set('safe', safe);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google search failed: ${response.status} - ${text}`);
  }

  const data = await response.json() as any;
  const results: SearchResult[] = [];

  if (data.items) {
    for (const item of data.items) {
      results.push({
        url: item.link,
        thumbnailUrl: item.image?.thumbnailLink || item.link,
        title: item.title || '',
        width: item.image?.width,
        height: item.image?.height,
        source: 'google'
      });
    }
  }

  return results;
}

export async function searchImages(
  query: string,
  engine: 'brave' | 'bing' | 'google',
  config: SearchEngineConfig,
  options: { count?: number; offset?: number } = {}
): Promise<SearchResult[]> {
  switch (engine) {
    case 'brave':
      if (!config.brave?.apiKey) {
        throw new Error('Brave API key not configured');
      }
      return searchBrave(query, config.brave.apiKey, options);

    case 'bing':
      if (!config.bing?.apiKey) {
        throw new Error('Bing API key not configured');
      }
      return searchBing(query, config.bing.apiKey, options);

    case 'google':
      if (!config.google?.apiKey || !config.google?.searchEngineId) {
        throw new Error('Google API key or Search Engine ID not configured');
      }
      return searchGoogle(
        query,
        config.google.apiKey,
        config.google.searchEngineId,
        { count: options.count, start: options.offset }
      );

    default:
      throw new Error(`Unknown search engine: ${engine}`);
  }
}

export async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, contentType };
}
