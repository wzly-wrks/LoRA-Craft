import type { Express, Request, Response } from 'express';
import { searchImages, downloadImage, type SearchEngineConfig } from './searchEngines';
import { createReplicateService, type TrainingInput } from './replicateIntegration';
import { storageAdapter } from './storageAdapter';
import { createHash } from 'crypto';

const isElectron = process.env.ELECTRON_APP === 'true';

let localDb: any = null;
if (isElectron) {
  import('./localDatabase').then(mod => {
    localDb = mod.localDb;
  });
}

interface Settings {
  openai: { apiKey: string };
  replicate: { apiKey: string };
  search: {
    defaultEngine: 'brave' | 'bing' | 'google' | 'pinterest' | 'reddit';
    brave: { apiKey: string };
    bing: { apiKey: string };
    google: { apiKey: string; searchEngineId: string };
    pinterest: { accessToken: string };
    reddit: { clientId: string; clientSecret: string };
  };
  app: {
    defaultExportPath: string;
    thumbnailSize: number;
    autoCaption: boolean;
    defaultAspectRatio: string;
  };
}

function getSettings(): Settings {
  if (!isElectron) {
    return {
      openai: { apiKey: process.env.OPENAI_API_KEY || '' },
      replicate: { apiKey: process.env.REPLICATE_API_TOKEN || '' },
      search: {
        defaultEngine: 'brave',
        brave: { apiKey: process.env.BRAVE_API_KEY || '' },
        bing: { apiKey: process.env.BING_API_KEY || '' },
        google: { 
          apiKey: process.env.GOOGLE_API_KEY || '',
          searchEngineId: process.env.GOOGLE_CSE_ID || ''
        },
        pinterest: { accessToken: process.env.PINTEREST_ACCESS_TOKEN || '' },
        reddit: { 
          clientId: process.env.REDDIT_CLIENT_ID || '',
          clientSecret: process.env.REDDIT_CLIENT_SECRET || ''
        }
      },
      app: {
        defaultExportPath: '',
        thumbnailSize: 256,
        autoCaption: false,
        defaultAspectRatio: '1:1'
      }
    };
  }

  try {
    const stored = localDb.getSetting('app_settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!parsed.search.pinterest) {
        parsed.search.pinterest = { accessToken: '' };
      }
      if (!parsed.search.reddit) {
        parsed.search.reddit = { clientId: '', clientSecret: '' };
      }
      return parsed;
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }

  return {
    openai: { apiKey: '' },
    replicate: { apiKey: '' },
    search: {
      defaultEngine: 'brave',
      brave: { apiKey: '' },
      bing: { apiKey: '' },
      google: { apiKey: '', searchEngineId: '' },
      pinterest: { accessToken: '' },
      reddit: { clientId: '', clientSecret: '' }
    },
    app: {
      defaultExportPath: '',
      thumbnailSize: 256,
      autoCaption: false,
      defaultAspectRatio: '1:1'
    }
  };
}

function saveSettings(settings: Settings): void {
  if (isElectron) {
    localDb.setSetting('app_settings', JSON.stringify(settings));
  }
}

export function registerSettingsRoutes(app: Express): void {
  app.get('/api/settings', (req: Request, res: Response) => {
    try {
      const settings = getSettings();
      const safeSettings = {
        ...settings,
        openai: { apiKey: settings.openai.apiKey ? '***configured***' : '' },
        replicate: { apiKey: settings.replicate.apiKey ? '***configured***' : '' },
        search: {
          ...settings.search,
          brave: { apiKey: settings.search.brave.apiKey ? '***configured***' : '' },
          bing: { apiKey: settings.search.bing.apiKey ? '***configured***' : '' },
          google: {
            apiKey: settings.search.google.apiKey ? '***configured***' : '',
            searchEngineId: settings.search.google.searchEngineId || ''
          },
          pinterest: { 
            accessToken: settings.search.pinterest.accessToken ? '***configured***' : '' 
          },
          reddit: {
            clientId: settings.search.reddit.clientId ? '***configured***' : '',
            clientSecret: settings.search.reddit.clientSecret ? '***configured***' : ''
          }
        }
      };
      res.json(safeSettings);
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  app.patch('/api/settings', (req: Request, res: Response) => {
    try {
      const currentSettings = getSettings();
      const updates = req.body;

      const newSettings: Settings = {
        openai: {
          apiKey: updates.openai?.apiKey !== undefined 
            ? updates.openai.apiKey 
            : currentSettings.openai.apiKey
        },
        replicate: {
          apiKey: updates.replicate?.apiKey !== undefined
            ? updates.replicate.apiKey
            : currentSettings.replicate.apiKey
        },
        search: {
          defaultEngine: updates.search?.defaultEngine || currentSettings.search.defaultEngine,
          brave: {
            apiKey: updates.search?.brave?.apiKey !== undefined
              ? updates.search.brave.apiKey
              : currentSettings.search.brave.apiKey
          },
          bing: {
            apiKey: updates.search?.bing?.apiKey !== undefined
              ? updates.search.bing.apiKey
              : currentSettings.search.bing.apiKey
          },
          google: {
            apiKey: updates.search?.google?.apiKey !== undefined
              ? updates.search.google.apiKey
              : currentSettings.search.google.apiKey,
            searchEngineId: updates.search?.google?.searchEngineId !== undefined
              ? updates.search.google.searchEngineId
              : currentSettings.search.google.searchEngineId
          },
          pinterest: {
            accessToken: updates.search?.pinterest?.accessToken !== undefined
              ? updates.search.pinterest.accessToken
              : currentSettings.search.pinterest.accessToken
          },
          reddit: {
            clientId: updates.search?.reddit?.clientId !== undefined
              ? updates.search.reddit.clientId
              : currentSettings.search.reddit.clientId,
            clientSecret: updates.search?.reddit?.clientSecret !== undefined
              ? updates.search.reddit.clientSecret
              : currentSettings.search.reddit.clientSecret
          }
        },
        app: {
          defaultExportPath: updates.app?.defaultExportPath !== undefined
            ? updates.app.defaultExportPath
            : currentSettings.app.defaultExportPath,
          thumbnailSize: updates.app?.thumbnailSize !== undefined
            ? updates.app.thumbnailSize
            : currentSettings.app.thumbnailSize,
          autoCaption: updates.app?.autoCaption !== undefined
            ? updates.app.autoCaption
            : currentSettings.app.autoCaption,
          defaultAspectRatio: updates.app?.defaultAspectRatio !== undefined
            ? updates.app.defaultAspectRatio
            : currentSettings.app.defaultAspectRatio
        }
      };

      saveSettings(newSettings);
      res.json({ message: 'Settings updated successfully' });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  app.post('/api/settings/validate-openai', async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      const key = apiKey || getSettings().openai.apiKey;
      
      if (!key) {
        return res.json({ valid: false, error: 'No API key provided' });
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });

      if (response.ok) {
        res.json({ valid: true });
      } else {
        res.json({ valid: false, error: 'Invalid API key' });
      }
    } catch (error) {
      res.json({ valid: false, error: 'Failed to validate' });
    }
  });

  app.post('/api/settings/validate-replicate', async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      const key = apiKey || getSettings().replicate.apiKey;
      
      if (!key) {
        return res.json({ valid: false, error: 'No API key provided' });
      }

      const service = createReplicateService(key);
      const valid = await service.validateApiKey();
      
      if (valid) {
        const account = await service.getAccount();
        res.json({ valid: true, username: account.username });
      } else {
        res.json({ valid: false, error: 'Invalid API key' });
      }
    } catch (error) {
      res.json({ valid: false, error: 'Failed to validate' });
    }
  });

  app.post('/api/search/images', async (req: Request, res: Response) => {
    try {
      const { query, engine, count, offset } = req.body;
      const settings = getSettings();
      
      const searchEngine = engine || settings.search.defaultEngine;
      const config: SearchEngineConfig = {
        brave: settings.search.brave,
        bing: settings.search.bing,
        google: settings.search.google,
        pinterest: settings.search.pinterest,
        reddit: settings.search.reddit
      };

      const results = await searchImages(query, searchEngine, config, { count, offset });
      res.json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
    }
  });

  app.post('/api/search/download', async (req: Request, res: Response) => {
    try {
      const { imageUrl, datasetId, workspaceId } = req.body;
      
      const { buffer, contentType } = await downloadImage(imageUrl);
      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);

      const ext = contentType.includes('png') ? '.png' : 
                  contentType.includes('gif') ? '.gif' : 
                  contentType.includes('webp') ? '.webp' : '.jpg';
      
      const storageKey = storageAdapter.generateStorageKey('images', `search_${hash}${ext}`);
      await storageAdapter.uploadBuffer(buffer, storageKey, contentType);

      let width: number | undefined;
      let height: number | undefined;
      try {
        const sharp = (await import('sharp')).default;
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (e) {
        console.error('Error getting image metadata:', e);
      }

      res.json({
        storageKey,
        hash,
        width,
        height,
        mime: contentType,
        sizeBytes: buffer.length,
        sourceUrl: imageUrl
      });
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Failed to download image' });
    }
  });

  app.post('/api/replicate/train', async (req: Request, res: Response) => {
    try {
      const settings = getSettings();
      
      if (!settings.replicate.apiKey) {
        return res.status(400).json({ error: 'Replicate API key not configured' });
      }

      const { datasetId, triggerWord, modelType, ...options } = req.body;
      const service = createReplicateService(settings.replicate.apiKey);

      const input: TrainingInput = {
        datasetZipPath: req.body.zipUrl,
        triggerWord,
        ...options
      };

      let job;
      if (modelType === 'sdxl') {
        job = await service.startSdxlLoraTraining(input);
      } else {
        job = await service.startFluxLoraTraining(input);
      }

      res.json(job);
    } catch (error) {
      console.error('Training error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start training' });
    }
  });

  app.get('/api/replicate/training/:id', async (req: Request, res: Response) => {
    try {
      const settings = getSettings();
      
      if (!settings.replicate.apiKey) {
        return res.status(400).json({ error: 'Replicate API key not configured' });
      }

      const service = createReplicateService(settings.replicate.apiKey);
      const job = await service.getTrainingStatus(req.params.id);
      res.json(job);
    } catch (error) {
      console.error('Status error:', error);
      res.status(500).json({ error: 'Failed to get training status' });
    }
  });

  app.post('/api/replicate/training/:id/cancel', async (req: Request, res: Response) => {
    try {
      const settings = getSettings();
      
      if (!settings.replicate.apiKey) {
        return res.status(400).json({ error: 'Replicate API key not configured' });
      }

      const service = createReplicateService(settings.replicate.apiKey);
      const job = await service.cancelTraining(req.params.id);
      res.json(job);
    } catch (error) {
      console.error('Cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel training' });
    }
  });

  app.get('/api/replicate/trainings', async (req: Request, res: Response) => {
    try {
      const settings = getSettings();
      
      if (!settings.replicate.apiKey) {
        return res.status(400).json({ error: 'Replicate API key not configured' });
      }

      const service = createReplicateService(settings.replicate.apiKey);
      const result = await service.listTrainings(req.query.cursor as string | undefined);
      res.json(result);
    } catch (error) {
      console.error('List error:', error);
      res.status(500).json({ error: 'Failed to list trainings' });
    }
  });

  if (isElectron) {
    app.get('/api/storage/local/*', async (req: Request, res: Response) => {
      try {
        const storageKey = '/' + req.params[0];
        const exists = await storageAdapter.exists?.(storageKey);
        
        if (!exists) {
          return res.status(404).json({ error: 'File not found' });
        }

        await storageAdapter.streamToResponse?.(storageKey, res);
      } catch (error) {
        console.error('Error serving file:', error);
        res.status(500).json({ error: 'Failed to serve file' });
      }
    });
  }
}
