import { apiRequest } from "./queryClient";
import type {
  Workspace,
  InsertWorkspace,
  Dataset,
  InsertDataset,
  Image,
  UpdateImage,
  Export,
} from "@shared/schema";

export interface ImageWithUrl extends Image {
  url: string | null;
}

export interface DedupeResult {
  duplicatesFound: number;
  totalImages: number;
}

export const api = {
  workspaces: {
    getAll: async (): Promise<Workspace[]> => {
      const res = await fetch("/api/workspaces", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json();
    },

    get: async (id: string): Promise<Workspace> => {
      const res = await fetch(`/api/workspaces/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workspace");
      return res.json();
    },

    create: async (data: InsertWorkspace): Promise<Workspace> => {
      const res = await apiRequest("POST", "/api/workspaces", data);
      return res.json();
    },

    update: async (id: string, data: Partial<InsertWorkspace>): Promise<Workspace> => {
      const res = await apiRequest("PATCH", `/api/workspaces/${id}`, data);
      return res.json();
    },

    delete: async (id: string): Promise<void> => {
      await apiRequest("DELETE", `/api/workspaces/${id}`);
    },
  },

  datasets: {
    getAll: async (workspaceId: string): Promise<Dataset[]> => {
      const res = await fetch(`/api/workspaces/${workspaceId}/datasets`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch datasets");
      return res.json();
    },

    get: async (id: string): Promise<Dataset> => {
      const res = await fetch(`/api/datasets/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dataset");
      return res.json();
    },

    create: async (workspaceId: string, data: Omit<InsertDataset, "workspaceId">): Promise<Dataset> => {
      const res = await apiRequest("POST", `/api/workspaces/${workspaceId}/datasets`, data);
      return res.json();
    },

    update: async (id: string, data: Partial<InsertDataset>): Promise<Dataset> => {
      const res = await apiRequest("PATCH", `/api/datasets/${id}`, data);
      return res.json();
    },

    delete: async (id: string): Promise<void> => {
      await apiRequest("DELETE", `/api/datasets/${id}`);
    },
  },

  images: {
    getAll: async (datasetId: string): Promise<ImageWithUrl[]> => {
      const res = await fetch(`/api/datasets/${datasetId}/images`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },

    get: async (id: string): Promise<ImageWithUrl> => {
      const res = await fetch(`/api/images/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch image");
      return res.json();
    },

    upload: async (datasetId: string, files: File[]): Promise<Image[]> => {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      
      const res = await fetch(`/api/datasets/${datasetId}/images/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload images");
      return res.json();
    },

    update: async (id: string, data: UpdateImage): Promise<Image> => {
      const res = await apiRequest("PATCH", `/api/images/${id}`, data);
      return res.json();
    },

    delete: async (id: string): Promise<void> => {
      await apiRequest("DELETE", `/api/images/${id}`);
    },
  },

  exports: {
    create: async (datasetId: string): Promise<Export> => {
      const res = await apiRequest("POST", `/api/datasets/${datasetId}/exports`);
      return res.json();
    },

    get: async (id: string): Promise<Export> => {
      const res = await fetch(`/api/exports/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch export");
      return res.json();
    },

    getAll: async (datasetId: string): Promise<Export[]> => {
      const res = await fetch(`/api/datasets/${datasetId}/exports`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch exports");
      return res.json();
    },
  },

  operations: {
    runDedupe: async (datasetId: string): Promise<DedupeResult> => {
      const res = await apiRequest("POST", `/api/datasets/${datasetId}/dedupe`);
      return res.json();
    },

    generateCaption: async (imageId: string): Promise<{ caption: string; image: Image }> => {
      const res = await apiRequest("POST", `/api/images/${imageId}/caption`);
      return res.json();
    },

    generateTags: async (imageId: string): Promise<{ tags: string[]; image: Image }> => {
      const res = await apiRequest("POST", `/api/images/${imageId}/tags`);
      return res.json();
    },

    captionAll: async (datasetId: string): Promise<{ message: string; totalImages: number }> => {
      const res = await apiRequest("POST", `/api/datasets/${datasetId}/caption-all`);
      return res.json();
    },

    resizeImage: async (
      imageId: string,
      options: { targetWidth?: number; targetHeight?: number; aspectRatio?: string }
    ): Promise<Image> => {
      const res = await apiRequest("POST", `/api/images/${imageId}/resize`, options);
      return res.json();
    },
  },
};
