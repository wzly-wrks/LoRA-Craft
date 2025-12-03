import sharp from "sharp";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";
import { Readable } from "stream";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface ResizeOptions {
  targetWidth?: number;
  targetHeight?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  background?: { r: number; g: number; b: number; alpha: number };
}

export async function resizeImage(
  imageBuffer: Buffer,
  options: ResizeOptions
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { targetWidth, targetHeight, fit = "inside" } = options;

  let sharpInstance = sharp(imageBuffer);
  const metadata = await sharpInstance.metadata();

  if (!targetWidth && !targetHeight) {
    throw new Error("Either targetWidth or targetHeight must be specified");
  }

  sharpInstance = sharpInstance.resize({
    width: targetWidth,
    height: targetHeight,
    fit,
    withoutEnlargement: false,
    background: options.background || { r: 0, g: 0, b: 0, alpha: 0 },
  });

  const outputBuffer = await sharpInstance.png().toBuffer();
  const newMetadata = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    width: newMetadata.width || targetWidth || metadata.width || 0,
    height: newMetadata.height || targetHeight || metadata.height || 0,
  };
}

export async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const imageStream = Readable.from(imageBuffer);
  const imageFile = await toFile(imageStream, "image.png", { type: "image/png" });

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: [imageFile],
    prompt: "Remove the background from this image completely, leaving only the main subject with a transparent background. Keep the subject exactly as it appears, with perfect edge detection and no artifacts.",
  });

  const resultBase64 = response.data?.[0]?.b64_json ?? "";
  if (!resultBase64) {
    throw new Error("Failed to get result from background removal");
  }

  return Buffer.from(resultBase64, "base64");
}

export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

export const TRAINING_PRESETS = [
  { name: "Square 512", width: 512, height: 512, description: "Standard SDXL training" },
  { name: "Square 768", width: 768, height: 768, description: "Higher quality SDXL" },
  { name: "Square 1024", width: 1024, height: 1024, description: "Flux training recommended" },
  { name: "Portrait 768x1024", width: 768, height: 1024, description: "Portrait orientation" },
  { name: "Landscape 1024x768", width: 1024, height: 768, description: "Landscape orientation" },
  { name: "Portrait 512x768", width: 512, height: 768, description: "SDXL portrait" },
  { name: "Landscape 768x512", width: 768, height: 512, description: "SDXL landscape" },
] as const;
