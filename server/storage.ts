import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import {
  workspaces,
  datasets,
  images,
  exports,
  tasks,
  crawlJobs,
  type Workspace,
  type InsertWorkspace,
  type Dataset,
  type InsertDataset,
  type Image,
  type InsertImage,
  type Export,
  type InsertExport,
  type Task,
  type InsertTask,
  type UpdateImage,
  type CrawlJob,
  type InsertCrawlJob,
} from "@shared/schema";

export interface IStorage {
  getWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: string, workspace: Partial<InsertWorkspace>): Promise<Workspace | undefined>;
  deleteWorkspace(id: string): Promise<boolean>;

  getDatasets(workspaceId: string): Promise<Dataset[]>;
  getDataset(id: string): Promise<Dataset | undefined>;
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  updateDataset(id: string, dataset: Partial<InsertDataset>): Promise<Dataset | undefined>;
  deleteDataset(id: string): Promise<boolean>;

  getImages(datasetId: string): Promise<Image[]>;
  getImage(id: string): Promise<Image | undefined>;
  createImage(image: InsertImage): Promise<Image>;
  updateImage(id: string, update: UpdateImage): Promise<Image | undefined>;
  deleteImage(id: string): Promise<boolean>;
  getImagesByHash(hash: string, datasetId: string): Promise<Image[]>;

  getExports(datasetId: string): Promise<Export[]>;
  getExport(id: string): Promise<Export | undefined>;
  createExport(exp: InsertExport): Promise<Export>;
  updateExport(id: string, exp: Partial<Export>): Promise<Export | undefined>;

  getTasks(datasetId?: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<Task>): Promise<Task | undefined>;

  getCrawlJobs(datasetId?: string): Promise<CrawlJob[]>;
  getCrawlJob(id: string): Promise<CrawlJob | undefined>;
  createCrawlJob(job: InsertCrawlJob): Promise<CrawlJob>;
  updateCrawlJob(id: string, job: Partial<CrawlJob>): Promise<CrawlJob | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getWorkspaces(): Promise<Workspace[]> {
    return db.select().from(workspaces).orderBy(desc(workspaces.createdAt));
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const [created] = await db.insert(workspaces).values(workspace).returning();
    return created;
  }

  async updateWorkspace(id: string, workspace: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const [updated] = await db
      .update(workspaces)
      .set({ ...workspace, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const deleted = await db
      .delete(workspaces)
      .where(eq(workspaces.id, id))
      .returning({ id: workspaces.id });
    return deleted.length > 0;
  }

  async getDatasets(workspaceId: string): Promise<Dataset[]> {
    return db.select().from(datasets).where(eq(datasets.workspaceId, workspaceId)).orderBy(desc(datasets.createdAt));
  }

  async getDataset(id: string): Promise<Dataset | undefined> {
    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, id));
    return dataset;
  }

  async createDataset(dataset: InsertDataset): Promise<Dataset> {
    const [created] = await db.insert(datasets).values(dataset).returning();
    return created;
  }

  async updateDataset(id: string, dataset: Partial<InsertDataset>): Promise<Dataset | undefined> {
    const [updated] = await db
      .update(datasets)
      .set({ ...dataset, updatedAt: new Date() })
      .where(eq(datasets.id, id))
      .returning();
    return updated;
  }

  async deleteDataset(id: string): Promise<boolean> {
    const deleted = await db
      .delete(datasets)
      .where(eq(datasets.id, id))
      .returning({ id: datasets.id });
    return deleted.length > 0;
  }

  async getImages(datasetId: string): Promise<Image[]> {
    return db.select().from(images).where(eq(images.datasetId, datasetId)).orderBy(desc(images.createdAt));
  }

  async getImage(id: string): Promise<Image | undefined> {
    const [image] = await db.select().from(images).where(eq(images.id, id));
    return image;
  }

  async createImage(image: InsertImage): Promise<Image> {
    const [created] = await db.insert(images).values(image).returning();
    return created;
  }

  async updateImage(id: string, update: UpdateImage): Promise<Image | undefined> {
    const [updated] = await db
      .update(images)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(images.id, id))
      .returning();
    return updated;
  }

  async deleteImage(id: string): Promise<boolean> {
    const deleted = await db
      .delete(images)
      .where(eq(images.id, id))
      .returning({ id: images.id });
    return deleted.length > 0;
  }

  async getImagesByHash(hash: string, datasetId: string): Promise<Image[]> {
    return db.select().from(images).where(and(eq(images.hash, hash), eq(images.datasetId, datasetId)));
  }

  async getExports(datasetId: string): Promise<Export[]> {
    return db.select().from(exports).where(eq(exports.datasetId, datasetId)).orderBy(desc(exports.createdAt));
  }

  async getExport(id: string): Promise<Export | undefined> {
    const [exp] = await db.select().from(exports).where(eq(exports.id, id));
    return exp;
  }

  async createExport(exp: InsertExport): Promise<Export> {
    const [created] = await db.insert(exports).values(exp).returning();
    return created;
  }

  async updateExport(id: string, exp: Partial<Export>): Promise<Export | undefined> {
    const [updated] = await db.update(exports).set(exp).where(eq(exports.id, id)).returning();
    return updated;
  }

  async getTasks(datasetId?: string): Promise<Task[]> {
    if (datasetId) {
      return db.select().from(tasks).where(eq(tasks.datasetId, datasetId)).orderBy(desc(tasks.createdAt));
    }
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: string, task: Partial<Task>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set(task).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async getCrawlJobs(datasetId?: string): Promise<CrawlJob[]> {
    if (datasetId) {
      return db.select().from(crawlJobs).where(eq(crawlJobs.datasetId, datasetId)).orderBy(desc(crawlJobs.createdAt));
    }
    return db.select().from(crawlJobs).orderBy(desc(crawlJobs.createdAt));
  }

  async getCrawlJob(id: string): Promise<CrawlJob | undefined> {
    const [job] = await db.select().from(crawlJobs).where(eq(crawlJobs.id, id));
    return job;
  }

  async createCrawlJob(job: InsertCrawlJob): Promise<CrawlJob> {
    const [created] = await db.insert(crawlJobs).values(job).returning();
    return created;
  }

  async updateCrawlJob(id: string, job: Partial<CrawlJob>): Promise<CrawlJob | undefined> {
    const [updated] = await db.update(crawlJobs).set({ ...job, updatedAt: new Date() }).where(eq(crawlJobs.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
