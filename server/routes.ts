import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { createHash } from "crypto";
import { db as storage } from "./databaseAdapter";
import { storageAdapter, StorageNotFoundError } from "./storageAdapter";
import { generateCaption, generateTags } from "./captioning";
import { registerSettingsRoutes } from "./settingsRoutes";
import {
  insertWorkspaceSchema,
  insertDatasetSchema,
  updateImageSchema,
  updateWorkspaceSchema,
  updateDatasetSchema,
} from "@shared/schema";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

function computeImageHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/workspaces", async (req: Request, res: Response) => {
    try {
      const workspaces = await storage.getWorkspaces();
      res.json(workspaces);
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.post("/api/workspaces", async (req: Request, res: Response) => {
    try {
      const data = insertWorkspaceSchema.parse(req.body);
      const workspace = await storage.createWorkspace(data);
      res.status(201).json(workspace);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error creating workspace:", error);
        res.status(500).json({ error: "Failed to create workspace" });
      }
    }
  });

  app.get("/api/workspaces/:id", async (req: Request, res: Response) => {
    try {
      const workspace = await storage.getWorkspace(req.params.id);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json(workspace);
    } catch (error) {
      console.error("Error fetching workspace:", error);
      res.status(500).json({ error: "Failed to fetch workspace" });
    }
  });

  app.patch("/api/workspaces/:id", async (req: Request, res: Response) => {
    try {
      const data = updateWorkspaceSchema.parse(req.body);
      const workspace = await storage.updateWorkspace(req.params.id, data);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json(workspace);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error updating workspace:", error);
        res.status(500).json({ error: "Failed to update workspace" });
      }
    }
  });

  app.delete("/api/workspaces/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteWorkspace(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting workspace:", error);
      res.status(500).json({ error: "Failed to delete workspace" });
    }
  });

  app.get("/api/workspaces/:workspaceId/datasets", async (req: Request, res: Response) => {
    try {
      const datasets = await storage.getDatasets(req.params.workspaceId);
      res.json(datasets);
    } catch (error) {
      console.error("Error fetching datasets:", error);
      res.status(500).json({ error: "Failed to fetch datasets" });
    }
  });

  app.post("/api/workspaces/:workspaceId/datasets", async (req: Request, res: Response) => {
    try {
      const data = insertDatasetSchema.parse({
        ...req.body,
        workspaceId: req.params.workspaceId,
      });
      const dataset = await storage.createDataset(data);
      res.status(201).json(dataset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error creating dataset:", error);
        res.status(500).json({ error: "Failed to create dataset" });
      }
    }
  });

  app.get("/api/datasets/:id", async (req: Request, res: Response) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      res.json(dataset);
    } catch (error) {
      console.error("Error fetching dataset:", error);
      res.status(500).json({ error: "Failed to fetch dataset" });
    }
  });

  app.patch("/api/datasets/:id", async (req: Request, res: Response) => {
    try {
      const data = updateDatasetSchema.parse(req.body);
      const dataset = await storage.updateDataset(req.params.id, data);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      res.json(dataset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error updating dataset:", error);
        res.status(500).json({ error: "Failed to update dataset" });
      }
    }
  });

  app.delete("/api/datasets/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteDataset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting dataset:", error);
      res.status(500).json({ error: "Failed to delete dataset" });
    }
  });

  app.get("/api/datasets/:datasetId/images", async (req: Request, res: Response) => {
    try {
      const images = await storage.getImages(req.params.datasetId);
      const imagesWithUrls = await Promise.all(
        images.map(async (img) => {
          try {
            const url = await storageAdapter.getDownloadURL(img.storageKey);
            return { ...img, url };
          } catch {
            return { ...img, url: null };
          }
        })
      );
      res.json(imagesWithUrls);
    } catch (error) {
      console.error("Error fetching images:", error);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  app.post("/api/datasets/:datasetId/images/upload", upload.array("images", 50), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No images provided" });
      }

      const dataset = await storage.getDataset(req.params.datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const results = [];
      for (const file of files) {
        const hash = computeImageHash(file.buffer);
        const storageKey = storageAdapter.generateStorageKey("images", file.originalname);
        
        await storageAdapter.uploadBuffer(file.buffer, storageKey, file.mimetype);

        let width: number | undefined;
        let height: number | undefined;
        try {
          const sharp = (await import("sharp")).default;
          const metadata = await sharp(file.buffer).metadata();
          width = metadata.width;
          height = metadata.height;
        } catch (e) {
          console.error("Error getting image metadata:", e);
        }

        const aspectRatio = width && height ? `${width}:${height}` : undefined;

        const existingImages = await storage.getImagesByHash(hash, req.params.datasetId);
        const isDuplicate = existingImages.length > 0;

        const image = await storage.createImage({
          datasetId: req.params.datasetId,
          workspaceId: dataset.workspaceId,
          sourceType: "upload",
          storageKey,
          originalFilename: file.originalname,
          width,
          height,
          mime: file.mimetype,
          sizeBytes: file.size,
          hash,
          aspectRatio,
          flaggedDuplicate: isDuplicate,
          duplicateOfId: isDuplicate ? existingImages[0].id : undefined,
        });

        results.push(image);
      }

      res.status(201).json(results);
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  });

  app.post("/api/datasets/:datasetId/images/from-search", async (req: Request, res: Response) => {
    try {
      const { storageKey, hash, width, height, mime, sizeBytes, sourceUrl, workspaceId } = req.body;
      
      const dataset = await storage.getDataset(req.params.datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const aspectRatio = width && height ? `${width}:${height}` : undefined;
      const existingImages = await storage.getImagesByHash(hash, req.params.datasetId);
      const isDuplicate = existingImages.length > 0;

      const image = await storage.createImage({
        datasetId: req.params.datasetId,
        workspaceId: workspaceId || dataset.workspaceId,
        sourceType: "search",
        sourceUrl,
        storageKey,
        originalFilename: sourceUrl.split('/').pop() || 'search_image',
        width,
        height,
        mime,
        sizeBytes,
        hash,
        aspectRatio,
        flaggedDuplicate: isDuplicate,
        duplicateOfId: isDuplicate ? existingImages[0].id : undefined,
      });

      res.status(201).json(image);
    } catch (error) {
      console.error("Error creating image from search:", error);
      res.status(500).json({ error: "Failed to create image" });
    }
  });

  app.get("/api/images/:id", async (req: Request, res: Response) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }
      const url = await storageAdapter.getDownloadURL(image.storageKey);
      res.json({ ...image, url });
    } catch (error) {
      console.error("Error fetching image:", error);
      res.status(500).json({ error: "Failed to fetch image" });
    }
  });

  app.patch("/api/images/:id", async (req: Request, res: Response) => {
    try {
      const data = updateImageSchema.parse(req.body);
      const image = await storage.updateImage(req.params.id, data);
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.json(image);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error updating image:", error);
        res.status(500).json({ error: "Failed to update image" });
      }
    }
  });

  app.delete("/api/images/:id", async (req: Request, res: Response) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (image) {
        await storageAdapter.deleteFile(image.storageKey);
        if (image.thumbnailKey) {
          await storageAdapter.deleteFile(image.thumbnailKey);
        }
      }
      const deleted = await storage.deleteImage(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  app.get("/api/storage/image/:storageKey(*)", async (req: Request, res: Response) => {
    try {
      const storageKey = `/${req.params.storageKey}`;
      const exists = await storageAdapter.exists?.(storageKey);
      if (!exists) {
        return res.status(404).json({ error: "Image not found" });
      }
      if (storageAdapter.streamToResponse) {
        await storageAdapter.streamToResponse(storageKey, res);
      } else {
        const buffer = await storageAdapter.getBuffer(storageKey);
        res.send(buffer);
      }
    } catch (error) {
      console.error("Error serving image:", error);
      if (error instanceof StorageNotFoundError) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.status(500).json({ error: "Failed to serve image" });
    }
  });

  app.get("/api/datasets/:datasetId/exports", async (req: Request, res: Response) => {
    try {
      const exports = await storage.getExports(req.params.datasetId);
      res.json(exports);
    } catch (error) {
      console.error("Error fetching exports:", error);
      res.status(500).json({ error: "Failed to fetch exports" });
    }
  });

  app.post("/api/datasets/:datasetId/exports", async (req: Request, res: Response) => {
    try {
      const dataset = await storage.getDataset(req.params.datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      const images = await storage.getImages(req.params.datasetId);
      const validImages = images.filter(img => !img.flaggedDuplicate);

      const exportRecord = await storage.createExport({
        datasetId: req.params.datasetId,
        status: "processing",
        imageCount: validImages.length,
      });

      (async () => {
        try {
          const archiver = (await import("archiver")).default;
          const { Readable } = await import("stream");
          
          const archive = archiver("zip", { zlib: { level: 9 } });
          const chunks: Buffer[] = [];
          
          archive.on("data", (chunk: Buffer) => chunks.push(chunk));
          
          const manifest = {
            name: dataset.name,
            description: dataset.description,
            imageCount: validImages.length,
            exportedAt: new Date().toISOString(),
            images: [] as any[],
          };

          for (let i = 0; i < validImages.length; i++) {
            const img = validImages[i];
            const ext = img.mime?.split("/")[1] || "jpg";
            const filename = `${String(i + 1).padStart(4, "0")}.${ext}`;
            
            try {
              const buffer = await storageAdapter.getBuffer(img.storageKey);
              archive.append(buffer, { name: `images/${filename}` });
              
              if (img.caption) {
                archive.append(img.caption, { name: `captions/${String(i + 1).padStart(4, "0")}.txt` });
              }

              manifest.images.push({
                filename,
                originalFilename: img.originalFilename,
                caption: img.caption,
                tags: img.tags,
                width: img.width,
                height: img.height,
              });
            } catch (e) {
              console.error(`Error processing image ${img.id}:`, e);
            }
          }

          archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
          await archive.finalize();

          await new Promise<void>((resolve) => {
            archive.on("end", resolve);
          });

          const zipBuffer = Buffer.concat(chunks);
          const zipKey = storageAdapter.generateStorageKey("exports", `${dataset.name.replace(/\s+/g, "_")}.zip`);
          await storageAdapter.uploadBuffer(zipBuffer, zipKey, "application/zip");

          const downloadUrl = await storageAdapter.getDownloadURL(zipKey);

          await storage.updateExport(exportRecord.id, {
            status: "completed",
            zipKey,
            downloadUrl,
            completedAt: new Date(),
          });
        } catch (error) {
          console.error("Export failed:", error);
          await storage.updateExport(exportRecord.id, {
            status: "failed",
            error: String(error),
          });
        }
      })();

      res.status(202).json(exportRecord);
    } catch (error) {
      console.error("Error creating export:", error);
      res.status(500).json({ error: "Failed to create export" });
    }
  });

  app.get("/api/exports/:id", async (req: Request, res: Response) => {
    try {
      const exportRecord = await storage.getExport(req.params.id);
      if (!exportRecord) {
        return res.status(404).json({ error: "Export not found" });
      }
      
      if (exportRecord.status === "completed" && exportRecord.zipKey) {
        try {
          const downloadUrl = await storageAdapter.getDownloadURL(exportRecord.zipKey);
          return res.json({ ...exportRecord, downloadUrl });
        } catch {
          return res.json(exportRecord);
        }
      }
      
      res.json(exportRecord);
    } catch (error) {
      console.error("Error fetching export:", error);
      res.status(500).json({ error: "Failed to fetch export" });
    }
  });

  app.post("/api/datasets/:datasetId/dedupe", async (req: Request, res: Response) => {
    try {
      const images = await storage.getImages(req.params.datasetId);
      const hashMap = new Map<string, string>();
      let duplicatesFound = 0;

      for (const img of images) {
        if (img.hash) {
          if (hashMap.has(img.hash)) {
            await storage.updateImage(img.id, { flaggedDuplicate: true });
            duplicatesFound++;
          } else {
            hashMap.set(img.hash, img.id);
            if (img.flaggedDuplicate) {
              await storage.updateImage(img.id, { flaggedDuplicate: false });
            }
          }
        }
      }

      res.json({ duplicatesFound, totalImages: images.length });
    } catch (error) {
      console.error("Error running dedupe:", error);
      res.status(500).json({ error: "Failed to run deduplication" });
    }
  });

  app.post("/api/images/:id/caption", async (req: Request, res: Response) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }

      const caption = await generateCaption(image.storageKey);
      const updatedImage = await storage.updateImage(req.params.id, { caption });
      
      res.json({ caption, image: updatedImage });
    } catch (error) {
      console.error("Error generating caption:", error);
      res.status(500).json({ error: "Failed to generate caption" });
    }
  });

  app.post("/api/images/:id/tags", async (req: Request, res: Response) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }

      const tags = await generateTags(image.storageKey);
      const updatedImage = await storage.updateImage(req.params.id, { tags });
      
      res.json({ tags, image: updatedImage });
    } catch (error) {
      console.error("Error generating tags:", error);
      res.status(500).json({ error: "Failed to generate tags" });
    }
  });

  app.post("/api/datasets/:datasetId/caption-all", async (req: Request, res: Response) => {
    try {
      const images = await storage.getImages(req.params.datasetId);
      const uncaptionedImages = images.filter(img => !img.caption && !img.flaggedDuplicate);
      
      res.status(202).json({ 
        message: "Captioning started",
        totalImages: uncaptionedImages.length,
      });

      (async () => {
        for (const img of uncaptionedImages) {
          try {
            const caption = await generateCaption(img.storageKey);
            await storage.updateImage(img.id, { caption });
          } catch (error) {
            console.error(`Failed to caption image ${img.id}:`, error);
          }
        }
      })();
    } catch (error) {
      console.error("Error starting batch caption:", error);
      res.status(500).json({ error: "Failed to start batch captioning" });
    }
  });

  app.post("/api/images/:id/resize", async (req: Request, res: Response) => {
    try {
      const { targetWidth, targetHeight, aspectRatio } = req.body;
      const image = await storage.getImage(req.params.id);
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }

      const sharp = (await import("sharp")).default;
      const buffer = await storageAdapter.getBuffer(image.storageKey);
      
      let resizedBuffer: Buffer;
      if (aspectRatio) {
        const [w, h] = aspectRatio.split(":").map(Number);
        const metadata = await sharp(buffer).metadata();
        const currentWidth = metadata.width || 1024;
        const currentHeight = metadata.height || 1024;
        const currentRatio = currentWidth / currentHeight;
        const targetRatio = w / h;
        
        let cropWidth = currentWidth;
        let cropHeight = currentHeight;
        
        if (currentRatio > targetRatio) {
          cropWidth = Math.round(currentHeight * targetRatio);
        } else {
          cropHeight = Math.round(currentWidth / targetRatio);
        }
        
        const left = Math.round((currentWidth - cropWidth) / 2);
        const top = Math.round((currentHeight - cropHeight) / 2);
        
        resizedBuffer = await sharp(buffer)
          .extract({ left, top, width: cropWidth, height: cropHeight })
          .toBuffer();
      } else if (targetWidth && targetHeight) {
        resizedBuffer = await sharp(buffer)
          .resize(targetWidth, targetHeight, { fit: "cover" })
          .toBuffer();
      } else {
        return res.status(400).json({ error: "Must provide targetWidth/targetHeight or aspectRatio" });
      }

      await storageAdapter.uploadBuffer(resizedBuffer, image.storageKey, image.mime || "image/jpeg");
      
      const newMetadata = await sharp(resizedBuffer).metadata();
      const updatedImage = await storage.updateImage(req.params.id, {
        width: newMetadata.width,
        height: newMetadata.height,
        aspectRatio: `${newMetadata.width}:${newMetadata.height}`,
      } as any);
      
      res.json(updatedImage);
    } catch (error) {
      console.error("Error resizing image:", error);
      res.status(500).json({ error: "Failed to resize image" });
    }
  });

  app.post("/api/images/:id/remove-background", async (req: Request, res: Response) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }

      const { removeBackground } = await import("./imageProcessing");
      const originalBuffer = await storageAdapter.getBuffer(image.storageKey);
      const processedBuffer = await removeBackground(originalBuffer);
      
      const newStorageKey = image.storageKey.replace(/\.[^.]+$/, "_nobg.png");
      await storageAdapter.uploadBuffer(processedBuffer, newStorageKey, "image/png");
      
      const sharp = (await import("sharp")).default;
      const metadata = await sharp(processedBuffer).metadata();
      
      const updatedImage = await storage.updateImage(req.params.id, {
        storageKey: newStorageKey,
        width: metadata.width,
        height: metadata.height,
        mime: "image/png",
      } as any);

      res.json(updatedImage);
    } catch (error) {
      console.error("Error removing background:", error);
      res.status(500).json({ error: "Failed to remove background" });
    }
  });

  app.get("/api/training-presets", async (req: Request, res: Response) => {
    const { TRAINING_PRESETS } = await import("./imageProcessing");
    res.json(TRAINING_PRESETS);
  });

  // Celebrity Search API endpoints
  app.post("/api/celebrity-search", async (req: Request, res: Response) => {
    try {
      const { celebrityName, datasetId, options } = req.body;
      
      if (!celebrityName || typeof celebrityName !== 'string') {
        return res.status(400).json({ error: "Celebrity name is required" });
      }
      if (!datasetId || typeof datasetId !== 'string') {
        return res.status(400).json({ error: "Dataset ID is required" });
      }

      // Get Brave API key from settings (stored as JSON in app_settings)
      let braveApiKey: string | undefined;
      const settingsJson = storage.getSetting?.("app_settings");
      if (settingsJson) {
        try {
          const settings = JSON.parse(settingsJson);
          braveApiKey = settings?.search?.brave?.apiKey;
        } catch (e) {
          console.error("Error parsing app_settings:", e);
        }
      }
      
      if (!braveApiKey) {
        return res.status(400).json({ error: "Brave API key not configured. Please set it in Settings." });
      }

      const { runCelebritySearch } = await import("./celebritySearch");
      
      // Run the search asynchronously and return immediately with job ID
      const result = await runCelebritySearch(celebrityName, datasetId, {
        maxImages: options?.maxImages || 500,
        minResolution: options?.minResolution || 300,
        crawlDepth: options?.crawlDepth || 3,
        braveApiKey,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error running celebrity search:", error);
      res.status(500).json({ error: "Failed to run celebrity search" });
    }
  });

  app.get("/api/crawl-jobs", async (req: Request, res: Response) => {
    try {
      const datasetId = req.query.datasetId as string | undefined;
      if (storage.getCrawlJobs) {
        const jobs = await storage.getCrawlJobs(datasetId);
        res.json(jobs);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching crawl jobs:", error);
      res.status(500).json({ error: "Failed to fetch crawl jobs" });
    }
  });

  app.get("/api/crawl-jobs/:id", async (req: Request, res: Response) => {
    try {
      if (storage.getCrawlJob) {
        const job = await storage.getCrawlJob(req.params.id);
        if (!job) {
          return res.status(404).json({ error: "Crawl job not found" });
        }
        res.json(job);
      } else {
        res.status(404).json({ error: "Crawl jobs not supported" });
      }
    } catch (error) {
      console.error("Error fetching crawl job:", error);
      res.status(500).json({ error: "Failed to fetch crawl job" });
    }
  });

  app.post("/api/crawl-jobs/:id/cancel", async (req: Request, res: Response) => {
    try {
      const { cancelCrawlJob } = await import("./celebritySearch");
      await cancelCrawlJob(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling crawl job:", error);
      res.status(500).json({ error: "Failed to cancel crawl job" });
    }
  });

  // Get cached images for a crawl job (for preview/review)
  app.get("/api/crawl-jobs/:id/cached-images", async (req: Request, res: Response) => {
    try {
      const { getCachedImages } = await import("./celebritySearch");
      const images = getCachedImages(req.params.id);
      res.json({ images });
    } catch (error) {
      console.error("Error fetching cached images:", error);
      res.status(500).json({ error: "Failed to fetch cached images" });
    }
  });

  // Serve a cached image file
  app.get("/api/crawl-jobs/:jobId/cached-images/:imageId", async (req: Request, res: Response) => {
    try {
      const { crawlCache } = await import("./celebritySearch");
      const cachedImage = crawlCache.getCachedImage(req.params.jobId, req.params.imageId);
      
      if (!cachedImage) {
        return res.status(404).json({ error: "Cached image not found" });
      }

      const buffer = await crawlCache.readCachedImage(cachedImage);
      res.setHeader('Content-Type', cachedImage.contentType);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("Error serving cached image:", error);
      res.status(500).json({ error: "Failed to serve cached image" });
    }
  });

  // Import cached images to permanent storage
  app.post("/api/crawl-jobs/:id/import", async (req: Request, res: Response) => {
    try {
      const { datasetId, imageIds } = req.body;
      
      if (!datasetId) {
        return res.status(400).json({ error: "Dataset ID is required" });
      }

      const { importCachedImages } = await import("./celebritySearch");
      const result = await importCachedImages(req.params.id, datasetId, imageIds);
      
      res.json(result);
    } catch (error) {
      console.error("Error importing cached images:", error);
      res.status(500).json({ error: "Failed to import cached images" });
    }
  });

  // Discard cached images without importing
  app.post("/api/crawl-jobs/:id/discard", async (req: Request, res: Response) => {
    try {
      const { imageIds } = req.body;
      
      const { discardCachedImages } = await import("./celebritySearch");
      await discardCachedImages(req.params.id, imageIds);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error discarding cached images:", error);
      res.status(500).json({ error: "Failed to discard cached images" });
    }
  });

  // Get cache statistics
  app.get("/api/crawl-cache/stats", async (req: Request, res: Response) => {
    try {
      const { crawlCache } = await import("./celebritySearch");
      const stats = await crawlCache.getCacheStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ error: "Failed to fetch cache stats" });
    }
  });

  // Clear all cache (manual cleanup)
  app.post("/api/crawl-cache/clear", async (req: Request, res: Response) => {
    try {
      const { crawlCache } = await import("./celebritySearch");
      await crawlCache.clearAllCache();
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  // Discover fan sites for a celebrity (preview before full crawl)
  app.post("/api/celebrity-search/discover", async (req: Request, res: Response) => {
    try {
      const { celebrityName } = req.body;
      
      if (!celebrityName || typeof celebrityName !== 'string') {
        return res.status(400).json({ error: "Celebrity name is required" });
      }

      // Get Brave API key from settings (stored as JSON in app_settings)
      let braveApiKey: string | undefined;
      const settingsJson = storage.getSetting?.("app_settings");
      if (settingsJson) {
        try {
          const settings = JSON.parse(settingsJson);
          braveApiKey = settings?.search?.brave?.apiKey;
        } catch (e) {
          console.error("Error parsing app_settings:", e);
        }
      }
      
      if (!braveApiKey) {
        return res.status(400).json({ error: "Brave API key not configured. Please set it in Settings." });
      }

      const { discoverFanSites } = await import("./celebritySearch/siteDetector");
      const sites = await discoverFanSites(celebrityName, braveApiKey);
      
      res.json({ sites });
    } catch (error) {
      console.error("Error discovering fan sites:", error);
      res.status(500).json({ error: "Failed to discover fan sites" });
    }
  });

  registerSettingsRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
