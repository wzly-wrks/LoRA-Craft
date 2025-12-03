import type { Workspace, Dataset, Image, Export, Task, InsertWorkspace, InsertDataset, InsertImage, InsertExport, InsertTask } from '@shared/schema';

const isElectron = process.env.ELECTRON_APP === 'true';

export interface IDatabase {
  getWorkspaces(): Promise<Workspace[]> | Workspace[];
  getWorkspace(id: string): Promise<Workspace | undefined> | Workspace | undefined;
  createWorkspace(data: InsertWorkspace): Promise<Workspace> | Workspace;
  updateWorkspace(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined> | Workspace | undefined;
  deleteWorkspace(id: string): Promise<void> | void;

  getDatasets(workspaceId: string): Promise<Dataset[]> | Dataset[];
  getDataset(id: string): Promise<Dataset | undefined> | Dataset | undefined;
  createDataset(data: InsertDataset): Promise<Dataset> | Dataset;
  updateDataset(id: string, data: Partial<InsertDataset>): Promise<Dataset | undefined> | Dataset | undefined;
  deleteDataset(id: string): Promise<void> | void;

  getImages(datasetId: string): Promise<Image[]> | Image[];
  getImage(id: string): Promise<Image | undefined> | Image | undefined;
  getImagesByHash(hash: string, datasetId: string): Promise<Image[]> | Image[];
  createImage(data: InsertImage): Promise<Image> | Image;
  updateImage(id: string, data: Partial<Image>): Promise<Image | undefined> | Image | undefined;
  deleteImage(id: string): Promise<void> | void;

  getExports(datasetId: string): Promise<Export[]> | Export[];
  getExport(id: string): Promise<Export | undefined> | Export | undefined;
  createExport(data: InsertExport): Promise<Export> | Export;
  updateExport(id: string, data: Partial<Export>): Promise<Export | undefined> | Export | undefined;

  getSetting?(key: string): string | undefined;
  setSetting?(key: string, value: string): void;
}

let database: IDatabase;

if (isElectron) {
  // Use local SQLite database for Electron/desktop mode
  const { localDb } = await import('./localDatabase');
  database = localDb;
} else {
  // Use cloud PostgreSQL database
  const { storage } = await import('./storage');
  database = storage;
}

export const db = database;
export default db;
