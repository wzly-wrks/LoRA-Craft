import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const workspaces = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const datasets = pgTable("datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  targetAspectRatio: text("target_aspect_ratio"),
  replicateJobId: text("replicate_job_id"),
  replicateStatus: text("replicate_status"),
  modelUrl: text("model_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const images = pgTable("images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").notNull().references(() => datasets.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  storageKey: text("storage_key").notNull(),
  thumbnailKey: text("thumbnail_key"),
  originalFilename: text("original_filename"),
  width: integer("width"),
  height: integer("height"),
  mime: text("mime"),
  sizeBytes: integer("size_bytes"),
  hash: text("hash"),
  aspectRatio: text("aspect_ratio"),
  caption: text("caption"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  flaggedDuplicate: boolean("flagged_duplicate").default(false),
  duplicateOfId: varchar("duplicate_of_id"),
  captionStatus: text("caption_status").default("pending"),
  cropStatus: text("crop_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const exports = pgTable("exports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").notNull().references(() => datasets.id, { onDelete: "cascade" }),
  zipKey: text("zip_key"),
  status: text("status").notNull().default("pending"),
  imageCount: integer("image_count"),
  downloadUrl: text("download_url"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageId: varchar("image_id").references(() => images.id, { onDelete: "cascade" }),
  datasetId: varchar("dataset_id").references(() => datasets.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  payload: jsonb("payload"),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const crawlJobs = pgTable("crawl_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").references(() => datasets.id, { onDelete: "cascade" }),
  celebrityName: text("celebrity_name").notNull(),
  status: text("status").notNull().default("pending"),
  discoveredSites: jsonb("discovered_sites").default(sql`'[]'::jsonb`),
  currentSite: text("current_site"),
  pagesScanned: integer("pages_scanned").default(0),
  imagesFound: integer("images_found").default(0),
  imagesDownloaded: integer("images_downloaded").default(0),
  duplicatesRemoved: integer("duplicates_removed").default(0),
  minResolution: integer("min_resolution").default(300),
  maxImages: integer("max_images").default(500),
  crawlDepth: integer("crawl_depth").default(3),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDatasetSchema = createInsertSchema(datasets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExportSchema = createInsertSchema(exports).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertCrawlJobSchema = createInsertSchema(crawlJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const updateImageSchema = z.object({
  caption: z.string().optional(),
  tags: z.array(z.string()).optional(),
  flaggedDuplicate: z.boolean().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

export const updateDatasetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["active", "archived"]).optional(),
  targetAspectRatio: z.string().optional(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = z.infer<typeof insertDatasetSchema>;
export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;
export type Export = typeof exports.$inferSelect;
export type InsertExport = z.infer<typeof insertExportSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type CrawlJob = typeof crawlJobs.$inferSelect;
export type InsertCrawlJob = z.infer<typeof insertCrawlJobSchema>;
export type UpdateImage = z.infer<typeof updateImageSchema>;
