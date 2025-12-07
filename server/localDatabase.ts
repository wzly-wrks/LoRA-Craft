import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type { Workspace, Dataset, Image, Export, Task, CrawlJob, InsertWorkspace, InsertDataset, InsertImage, InsertExport, InsertTask, InsertCrawlJob } from '@shared/schema';

const isElectron = process.env.ELECTRON_APP === 'true';
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'lora-craft.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    target_aspect_ratio TEXT,
    replicate_job_id TEXT,
    replicate_status TEXT,
    model_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_url TEXT,
    storage_key TEXT NOT NULL,
    thumbnail_key TEXT,
    original_filename TEXT,
    width INTEGER,
    height INTEGER,
    mime TEXT,
    size_bytes INTEGER,
    hash TEXT,
    aspect_ratio TEXT,
    caption TEXT,
    tags TEXT DEFAULT '[]',
    flagged_duplicate INTEGER DEFAULT 0,
    duplicate_of_id TEXT,
    caption_status TEXT DEFAULT 'pending',
    crop_status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    zip_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    image_count INTEGER,
    download_url TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    image_id TEXT REFERENCES images(id) ON DELETE CASCADE,
    dataset_id TEXT REFERENCES datasets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_datasets_workspace ON datasets(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_images_dataset ON images(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);
  CREATE INDEX IF NOT EXISTS idx_exports_dataset ON exports(dataset_id);

  CREATE TABLE IF NOT EXISTS crawl_jobs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    dataset_id TEXT REFERENCES datasets(id) ON DELETE CASCADE,
    celebrity_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    discovered_sites TEXT DEFAULT '[]',
    current_site TEXT,
    pages_scanned INTEGER DEFAULT 0,
    images_found INTEGER DEFAULT 0,
    images_downloaded INTEGER DEFAULT 0,
    duplicates_removed INTEGER DEFAULT 0,
    min_resolution INTEGER DEFAULT 300,
    max_images INTEGER DEFAULT 500,
    crawl_depth INTEGER DEFAULT 3,
    metadata TEXT DEFAULT '{}',
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_crawl_jobs_dataset ON crawl_jobs(dataset_id);
`);

function toWorkspace(row: any): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function toDataset(row: any): Dataset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    status: row.status,
    targetAspectRatio: row.target_aspect_ratio,
    replicateJobId: row.replicate_job_id,
    replicateStatus: row.replicate_status,
    modelUrl: row.model_url,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function toImage(row: any): Image {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    workspaceId: row.workspace_id,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    storageKey: row.storage_key,
    thumbnailKey: row.thumbnail_key,
    originalFilename: row.original_filename,
    width: row.width,
    height: row.height,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    hash: row.hash,
    aspectRatio: row.aspect_ratio,
    caption: row.caption,
    tags: row.tags ? JSON.parse(row.tags) : [],
    flaggedDuplicate: Boolean(row.flagged_duplicate),
    duplicateOfId: row.duplicate_of_id,
    captionStatus: row.caption_status,
    cropStatus: row.crop_status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function toExport(row: any): Export {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    zipKey: row.zip_key,
    status: row.status,
    imageCount: row.image_count,
    downloadUrl: row.download_url,
    error: row.error,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null
  };
}

function toTask(row: any): Task {
  return {
    id: row.id,
    imageId: row.image_id,
    datasetId: row.dataset_id,
    type: row.type,
    status: row.status,
    payload: row.payload ? JSON.parse(row.payload) : null,
    result: row.result ? JSON.parse(row.result) : null,
    error: row.error,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null
  };
}

function toCrawlJob(row: any): CrawlJob {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    celebrityName: row.celebrity_name,
    status: row.status,
    discoveredSites: row.discovered_sites ? JSON.parse(row.discovered_sites) : [],
    currentSite: row.current_site,
    pagesScanned: row.pages_scanned,
    imagesFound: row.images_found,
    imagesDownloaded: row.images_downloaded,
    duplicatesRemoved: row.duplicates_removed,
    minResolution: row.min_resolution,
    maxImages: row.max_images,
    crawlDepth: row.crawl_depth,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    error: row.error,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null
  };
}

export const localDb = {
  getWorkspaces(): Workspace[] {
    const stmt = db.prepare('SELECT * FROM workspaces ORDER BY created_at DESC');
    return stmt.all().map(toWorkspace);
  },

  getWorkspace(id: string): Workspace | undefined {
    const stmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
    const row = stmt.get(id);
    return row ? toWorkspace(row) : undefined;
  },

  createWorkspace(data: InsertWorkspace): Workspace {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO workspaces (id, name, description)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, data.name, data.description || null);
    return this.getWorkspace(id)!;
  },

  updateWorkspace(id: string, data: Partial<InsertWorkspace>): Workspace | undefined {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    updates.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getWorkspace(id);
  },

  deleteWorkspace(id: string): boolean {
    const stmt = db.prepare('DELETE FROM workspaces WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  getDatasets(workspaceId: string): Dataset[] {
    const stmt = db.prepare('SELECT * FROM datasets WHERE workspace_id = ? ORDER BY created_at DESC');
    return stmt.all(workspaceId).map(toDataset);
  },

  getDataset(id: string): Dataset | undefined {
    const stmt = db.prepare('SELECT * FROM datasets WHERE id = ?');
    const row = stmt.get(id);
    return row ? toDataset(row) : undefined;
  },

  createDataset(data: InsertDataset): Dataset {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO datasets (id, workspace_id, name, description, status, target_aspect_ratio)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.workspaceId, data.name, data.description || null, data.status || 'active', data.targetAspectRatio || null);
    return this.getDataset(id)!;
  },

  updateDataset(id: string, data: Partial<InsertDataset>): Dataset | undefined {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.targetAspectRatio !== undefined) {
      updates.push('target_aspect_ratio = ?');
      values.push(data.targetAspectRatio);
    }
    if ((data as any).replicateJobId !== undefined) {
      updates.push('replicate_job_id = ?');
      values.push((data as any).replicateJobId);
    }
    if ((data as any).replicateStatus !== undefined) {
      updates.push('replicate_status = ?');
      values.push((data as any).replicateStatus);
    }
    if ((data as any).modelUrl !== undefined) {
      updates.push('model_url = ?');
      values.push((data as any).modelUrl);
    }
    updates.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE datasets SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getDataset(id);
  },

  deleteDataset(id: string): boolean {
    const stmt = db.prepare('DELETE FROM datasets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  getImages(datasetId: string): Image[] {
    const stmt = db.prepare('SELECT * FROM images WHERE dataset_id = ? ORDER BY created_at DESC');
    return stmt.all(datasetId).map(toImage);
  },

  getImage(id: string): Image | undefined {
    const stmt = db.prepare('SELECT * FROM images WHERE id = ?');
    const row = stmt.get(id);
    return row ? toImage(row) : undefined;
  },

  getImagesByHash(hash: string, datasetId: string): Image[] {
    const stmt = db.prepare('SELECT * FROM images WHERE hash = ? AND dataset_id = ?');
    return stmt.all(hash, datasetId).map(toImage);
  },

  createImage(data: InsertImage): Image {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO images (
        id, dataset_id, workspace_id, source_type, source_url, storage_key, thumbnail_key,
        original_filename, width, height, mime, size_bytes, hash, aspect_ratio, caption,
        tags, flagged_duplicate, duplicate_of_id, caption_status, crop_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.datasetId, data.workspaceId, data.sourceType, data.sourceUrl || null,
      data.storageKey, data.thumbnailKey || null, data.originalFilename || null,
      data.width || null, data.height || null, data.mime || null, data.sizeBytes || null,
      data.hash || null, data.aspectRatio || null, data.caption || null,
      JSON.stringify(data.tags || []), data.flaggedDuplicate ? 1 : 0,
      data.duplicateOfId || null, data.captionStatus || 'pending', data.cropStatus || 'pending'
    );
    return this.getImage(id)!;
  },

  updateImage(id: string, data: Partial<Image>): Image | undefined {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.caption !== undefined) {
      updates.push('caption = ?');
      values.push(data.caption);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(data.tags));
    }
    if (data.flaggedDuplicate !== undefined) {
      updates.push('flagged_duplicate = ?');
      values.push(data.flaggedDuplicate ? 1 : 0);
    }
    if (data.captionStatus !== undefined) {
      updates.push('caption_status = ?');
      values.push(data.captionStatus);
    }
    if (data.cropStatus !== undefined) {
      updates.push('crop_status = ?');
      values.push(data.cropStatus);
    }
    if (data.thumbnailKey !== undefined) {
      updates.push('thumbnail_key = ?');
      values.push(data.thumbnailKey);
    }
    if (data.width !== undefined) {
      updates.push('width = ?');
      values.push(data.width);
    }
    if (data.height !== undefined) {
      updates.push('height = ?');
      values.push(data.height);
    }
    if (data.aspectRatio !== undefined) {
      updates.push('aspect_ratio = ?');
      values.push(data.aspectRatio);
    }
    
    if (updates.length === 0) return this.getImage(id);
    
    updates.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE images SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getImage(id);
  },

  deleteImage(id: string): boolean {
    const stmt = db.prepare('DELETE FROM images WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  getExports(datasetId: string): Export[] {
    const stmt = db.prepare('SELECT * FROM exports WHERE dataset_id = ? ORDER BY created_at DESC');
    return stmt.all(datasetId).map(toExport);
  },

  getExport(id: string): Export | undefined {
    const stmt = db.prepare('SELECT * FROM exports WHERE id = ?');
    const row = stmt.get(id);
    return row ? toExport(row) : undefined;
  },

  createExport(data: InsertExport): Export {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO exports (id, dataset_id, zip_key, status, image_count, download_url, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.datasetId, data.zipKey || null, data.status || 'pending',
      data.imageCount || null, data.downloadUrl || null, data.error || null
    );
    return this.getExport(id)!;
  },

  updateExport(id: string, data: Partial<Export>): Export | undefined {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.zipKey !== undefined) {
      updates.push('zip_key = ?');
      values.push(data.zipKey);
    }
    if (data.downloadUrl !== undefined) {
      updates.push('download_url = ?');
      values.push(data.downloadUrl);
    }
    if (data.imageCount !== undefined) {
      updates.push('image_count = ?');
      values.push(data.imageCount);
    }
    if (data.error !== undefined) {
      updates.push('error = ?');
      values.push(data.error);
    }
    if (data.completedAt !== undefined) {
      updates.push('completed_at = ?');
      values.push(data.completedAt?.toISOString() || null);
    }
    
    if (updates.length === 0) return this.getExport(id);
    values.push(id);

    const stmt = db.prepare(`UPDATE exports SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getExport(id);
  },

  // Crawl Jobs
  getCrawlJobs(datasetId?: string): CrawlJob[] {
    if (datasetId) {
      const stmt = db.prepare('SELECT * FROM crawl_jobs WHERE dataset_id = ? ORDER BY created_at DESC');
      return stmt.all(datasetId).map(toCrawlJob);
    }
    const stmt = db.prepare('SELECT * FROM crawl_jobs ORDER BY created_at DESC');
    return stmt.all().map(toCrawlJob);
  },

  getCrawlJob(id: string): CrawlJob | undefined {
    const stmt = db.prepare('SELECT * FROM crawl_jobs WHERE id = ?');
    const row = stmt.get(id);
    return row ? toCrawlJob(row) : undefined;
  },

  createCrawlJob(data: InsertCrawlJob): CrawlJob {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO crawl_jobs (
        id, dataset_id, celebrity_name, status, discovered_sites, current_site,
        pages_scanned, images_found, images_downloaded, duplicates_removed,
        min_resolution, max_images, crawl_depth, metadata, error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.datasetId || null,
      data.celebrityName,
      data.status || 'pending',
      JSON.stringify(data.discoveredSites || []),
      data.currentSite || null,
      data.pagesScanned || 0,
      data.imagesFound || 0,
      data.imagesDownloaded || 0,
      data.duplicatesRemoved || 0,
      data.minResolution || 300,
      data.maxImages || 500,
      data.crawlDepth || 3,
      JSON.stringify(data.metadata || {}),
      data.error || null
    );
    return this.getCrawlJob(id)!;
  },

  updateCrawlJob(id: string, data: Partial<CrawlJob>): CrawlJob | undefined {
    const updates: string[] = ['updated_at = datetime(\'now\')'];
    const values: any[] = [];
    
    if (data.datasetId !== undefined) {
      updates.push('dataset_id = ?');
      values.push(data.datasetId);
    }
    if (data.celebrityName !== undefined) {
      updates.push('celebrity_name = ?');
      values.push(data.celebrityName);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.discoveredSites !== undefined) {
      updates.push('discovered_sites = ?');
      values.push(JSON.stringify(data.discoveredSites));
    }
    if (data.currentSite !== undefined) {
      updates.push('current_site = ?');
      values.push(data.currentSite);
    }
    if (data.pagesScanned !== undefined) {
      updates.push('pages_scanned = ?');
      values.push(data.pagesScanned);
    }
    if (data.imagesFound !== undefined) {
      updates.push('images_found = ?');
      values.push(data.imagesFound);
    }
    if (data.imagesDownloaded !== undefined) {
      updates.push('images_downloaded = ?');
      values.push(data.imagesDownloaded);
    }
    if (data.duplicatesRemoved !== undefined) {
      updates.push('duplicates_removed = ?');
      values.push(data.duplicatesRemoved);
    }
    if (data.minResolution !== undefined) {
      updates.push('min_resolution = ?');
      values.push(data.minResolution);
    }
    if (data.maxImages !== undefined) {
      updates.push('max_images = ?');
      values.push(data.maxImages);
    }
    if (data.crawlDepth !== undefined) {
      updates.push('crawl_depth = ?');
      values.push(data.crawlDepth);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }
    if (data.error !== undefined) {
      updates.push('error = ?');
      values.push(data.error);
    }
    if (data.completedAt !== undefined) {
      updates.push('completed_at = ?');
      values.push(data.completedAt?.toISOString() || null);
    }
    
    values.push(id);

    const stmt = db.prepare(`UPDATE crawl_jobs SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getCrawlJob(id);
  },

  getSetting(key: string): string | undefined {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value;
  },

  setSetting(key: string, value: string): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run(key, value);
  },

  close(): void {
    db.close();
  }
};

export default localDb;
