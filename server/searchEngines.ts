import fetch from 'node-fetch';

export interface SearchResult {
  url: string;
  thumbnailUrl: string;
  title: string;
  width?: number;
  height?: number;
  source: 'brave' | 'bing' | 'google' | 'pinterest' | 'reddit';
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
  pinterest?: { accessToken: string };
  reddit?: { clientId: string; clientSecret: string; subreddits?: string };
}

export async function searchBrave(
  query: string,
  apiKey: string,
  options: { count?: number; offset?: number; safeSearch?: string } = {}
): Promise<SearchResult[]> {
  const count = options.count || 20;
  const offset = options.offset || 0;
  // Brave only accepts 'off' or 'strict', default to 'off' for better results
  const safeSearch = options.safeSearch === 'strict' ? 'strict' : 'off';

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
      const fullUrl = item.properties?.url || item.url;
      results.push({
        url: fullUrl,
        // Use full image URL for better quality preview
        thumbnailUrl: fullUrl,
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
        // Use the full image for better quality preview (thumbnailLink is very small)
        thumbnailUrl: item.link,
        title: item.title || '',
        width: item.image?.width,
        height: item.image?.height,
        source: 'google'
      });
    }
  }

  return results;
}

export async function searchPinterest(
  query: string,
  accessToken: string,
  options: { count?: number } = {}
): Promise<SearchResult[]> {
  const count = options.count || 20;

  const url = new URL('https://api.pinterest.com/v5/search/pins');
  url.searchParams.set('query', query);
  url.searchParams.set('page_size', count.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinterest search failed: ${response.status} - ${text}`);
  }

  const data = await response.json() as any;
  const results: SearchResult[] = [];

  if (data.items) {
    for (const item of data.items) {
      const imageUrl = item.media?.images?.['1200x']?.url || 
                       item.media?.images?.originals?.url ||
                       item.media?.images?.['600x']?.url;
      
      if (imageUrl) {
        results.push({
          url: imageUrl,
          thumbnailUrl: item.media?.images?.['150x150']?.url || imageUrl,
          title: item.title || item.description || '',
          width: item.media?.images?.originals?.width,
          height: item.media?.images?.originals?.height,
          source: 'pinterest'
        });
      }
    }
  }

  return results;
}

export async function searchReddit(
  query: string,
  clientId: string,
  clientSecret: string,
  options: { count?: number; safeSearch?: string; subreddits?: string } = {}
): Promise<SearchResult[]> {
  const count = options.count || 25;
  
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const userAgent = 'LoRACraft/1.0.0 (Desktop App for LoRA Training Dataset Creation; https://github.com/weezly/lora-craft)';
  
  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Reddit auth failed: ${tokenResponse.status} - ${text}`);
  }

  const tokenData = await tokenResponse.json() as any;
  const accessToken = tokenData.access_token;

  // Build the search query
  let searchQuery = `${query} (site:i.redd.it OR site:imgur.com OR site:i.imgur.com)`;
  
  // If subreddits specified, add subreddit filter
  const subreddits = options.subreddits?.split(',').map(s => s.trim()).filter(s => s.length > 0);
  let searchUrl: URL;
  
  if (subreddits && subreddits.length > 0) {
    // Search within specific subreddits
    const subredditPath = subreddits.length === 1 
      ? `r/${subreddits[0]}` 
      : `r/${subreddits.join('+')}`;
    searchUrl = new URL(`https://oauth.reddit.com/${subredditPath}/search`);
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('restrict_sr', 'true'); // Restrict to subreddit
  } else {
    // Search all of Reddit
    searchUrl = new URL('https://oauth.reddit.com/search');
    searchUrl.searchParams.set('q', searchQuery);
  }
  
  searchUrl.searchParams.set('type', 'link');
  searchUrl.searchParams.set('limit', count.toString());
  searchUrl.searchParams.set('sort', 'relevance');
  
  const filterNSFW = options.safeSearch !== 'off';
  if (filterNSFW) {
    searchUrl.searchParams.set('include_over_18', 'false');
  }

  const searchResponse = await fetch(searchUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': userAgent
    }
  });

  if (!searchResponse.ok) {
    const text = await searchResponse.text();
    throw new Error(`Reddit search failed: ${searchResponse.status} - ${text}`);
  }

  const data = await searchResponse.json() as any;
  const results: SearchResult[] = [];

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  if (data.data?.children) {
    for (const child of data.data.children) {
      const post = child.data;
      let imageUrl = post.url;
      
      if (post.is_gallery && post.media_metadata) {
        const firstKey = Object.keys(post.media_metadata)[0];
        if (firstKey) {
          const media = post.media_metadata[firstKey];
          imageUrl = media.s?.u?.replace(/&amp;/g, '&') || imageUrl;
        }
      }
      
      const isImage = imageExtensions.some(ext => imageUrl?.toLowerCase().includes(ext)) ||
                      imageUrl?.includes('i.redd.it') ||
                      imageUrl?.includes('i.imgur.com');

      const isNSFW = post.over_18 === true;
      const shouldInclude = isImage && imageUrl && (!filterNSFW || !isNSFW);

      if (shouldInclude) {
        results.push({
          url: imageUrl,
          thumbnailUrl: post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default' 
            ? post.thumbnail 
            : imageUrl,
          title: post.title || '',
          source: 'reddit'
        });
      }
    }
  }

  return results;
}

export async function searchImages(
  query: string,
  engine: 'brave' | 'bing' | 'google' | 'pinterest' | 'reddit',
  config: SearchEngineConfig,
  options: { count?: number; offset?: number; safeSearch?: string } = {}
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
        { count: options.count, start: options.offset, safeSearch: options.safeSearch }
      );

    case 'pinterest':
      if (!config.pinterest?.accessToken) {
        throw new Error('Pinterest access token not configured');
      }
      return searchPinterest(query, config.pinterest.accessToken, { count: options.count });

    case 'reddit':
      if (!config.reddit?.clientId || !config.reddit?.clientSecret) {
        throw new Error('Reddit client ID or secret not configured');
      }
      return searchReddit(query, config.reddit.clientId, config.reddit.clientSecret, { 
        count: options.count, 
        safeSearch: options.safeSearch || 'moderate',
        subreddits: config.reddit.subreddits
      });

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
