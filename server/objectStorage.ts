import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

export class ObjectStorageService {
  private storageDir: string;

  constructor() {
    this.storageDir = process.env.OBJECT_STORAGE_DIR || "/loracraft-storage";
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  async getUploadURL(filename: string): Promise<{ uploadUrl: string; storageKey: string }> {
    const objectId = randomUUID();
    const extension = filename.split('.').pop() || '';
    const objectName = extension ? `${objectId}.${extension}` : objectId;
    const fullPath = `${this.storageDir}/images/${objectName}`;
    
    const { bucketName, objectName: objName } = parseObjectPath(fullPath);
    const uploadUrl = await signObjectURL({
      bucketName,
      objectName: objName,
      method: "PUT",
      ttlSec: 900,
    });

    return { uploadUrl, storageKey: fullPath };
  }

  async getDownloadURL(storageKey: string): Promise<string> {
    const { bucketName, objectName } = parseObjectPath(storageKey);
    return signObjectURL({
      bucketName,
      objectName,
      method: "GET",
      ttlSec: 3600,
    });
  }

  async getFile(storageKey: string): Promise<File> {
    const { bucketName, objectName } = parseObjectPath(storageKey);
    const bucket = objectStorageClient.bucket(bucketName);
    return bucket.file(objectName);
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const file = await this.getFile(storageKey);
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }

  async downloadToBuffer(storageKey: string): Promise<Buffer> {
    const file = await this.getFile(storageKey);
    const [contents] = await file.download();
    return contents;
  }

  async uploadBuffer(buffer: Buffer, storageKey: string, contentType: string): Promise<void> {
    const file = await this.getFile(storageKey);
    await file.save(buffer, {
      contentType,
      resumable: false,
    });
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      const file = await this.getFile(storageKey);
      await file.delete();
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }

  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": String(metadata.size),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on("error", (err: Error) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  generateStorageKey(prefix: string, filename: string): string {
    const objectId = randomUUID();
    const extension = filename.split('.').pop() || '';
    const objectName = extension ? `${objectId}.${extension}` : objectId;
    return `${this.storageDir}/${prefix}/${objectName}`;
  }
}

export const objectStorageService = new ObjectStorageService();
