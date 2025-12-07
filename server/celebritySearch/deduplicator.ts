import * as sharp from 'sharp';

export interface ImageHash {
  hash: string;
  width: number;
  height: number;
}

export interface DuplicateResult {
  isDuplicate: boolean;
  similarity: number;
  matchingHash?: string;
}

const HASH_SIZE = 16;
const HASH_BITS = HASH_SIZE * HASH_SIZE;

export async function computePerceptualHash(imageBuffer: Buffer): Promise<ImageHash> {
  const image = (sharp as any)(imageBuffer);
  const metadata = await image.metadata();
  
  const resized = await image
    .resize(HASH_SIZE, HASH_SIZE, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  const pixels: number[] = Array.from(resized);
  const mean = pixels.reduce((sum: number, val: number) => sum + val, 0) / pixels.length;

  let hash = '';
  for (let i = 0; i < pixels.length; i++) {
    hash += pixels[i] >= mean ? '1' : '0';
  }

  const hexHash = binaryToHex(hash);

  return {
    hash: hexHash,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

export async function computeDifferenceHash(imageBuffer: Buffer): Promise<string> {
  const resized = await (sharp as any)(imageBuffer)
    .resize(HASH_SIZE + 1, HASH_SIZE, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  let hash = '';
  for (let row = 0; row < HASH_SIZE; row++) {
    for (let col = 0; col < HASH_SIZE; col++) {
      const idx = row * (HASH_SIZE + 1) + col;
      hash += resized[idx] < resized[idx + 1] ? '1' : '0';
    }
  }

  return binaryToHex(hash);
}

function binaryToHex(binary: string): string {
  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex;
}

function hexToBinary(hex: string): string {
  let binary = '';
  for (let i = 0; i < hex.length; i++) {
    binary += parseInt(hex[i], 16).toString(2).padStart(4, '0');
  }
  return binary;
}

export function computeHammingDistance(hash1: string, hash2: string): number {
  const bin1 = hexToBinary(hash1);
  const bin2 = hexToBinary(hash2);
  
  let distance = 0;
  const minLen = Math.min(bin1.length, bin2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (bin1[i] !== bin2[i]) {
      distance++;
    }
  }
  
  distance += Math.abs(bin1.length - bin2.length);
  
  return distance;
}

export function computeSimilarity(hash1: string, hash2: string): number {
  const distance = computeHammingDistance(hash1, hash2);
  return 1 - (distance / HASH_BITS);
}

export class ImageDeduplicator {
  private hashes: Map<string, string> = new Map();
  private similarityThreshold: number;

  constructor(similarityThreshold: number = 0.9) {
    this.similarityThreshold = similarityThreshold;
  }

  async addImage(imageId: string, imageBuffer: Buffer): Promise<DuplicateResult> {
    const { hash } = await computePerceptualHash(imageBuffer);
    
    const entries = Array.from(this.hashes.entries());
    for (const [existingId, existingHash] of entries) {
      const similarity = computeSimilarity(hash, existingHash);
      if (similarity >= this.similarityThreshold) {
        return {
          isDuplicate: true,
          similarity,
          matchingHash: existingId,
        };
      }
    }

    this.hashes.set(imageId, hash);
    return {
      isDuplicate: false,
      similarity: 0,
    };
  }

  async checkDuplicate(imageBuffer: Buffer): Promise<DuplicateResult> {
    const { hash } = await computePerceptualHash(imageBuffer);
    
    const entries = Array.from(this.hashes.entries());
    for (const [existingId, existingHash] of entries) {
      const similarity = computeSimilarity(hash, existingHash);
      if (similarity >= this.similarityThreshold) {
        return {
          isDuplicate: true,
          similarity,
          matchingHash: existingId,
        };
      }
    }

    return {
      isDuplicate: false,
      similarity: 0,
    };
  }

  getHash(imageId: string): string | undefined {
    return this.hashes.get(imageId);
  }

  clear(): void {
    this.hashes.clear();
  }

  get size(): number {
    return this.hashes.size;
  }
}

export async function getImageMetadata(imageBuffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}> {
  const metadata = await (sharp as any)(imageBuffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: imageBuffer.length,
  };
}

export async function meetsMinimumResolution(
  imageBuffer: Buffer,
  minResolution: number
): Promise<boolean> {
  const metadata = await (sharp as any)(imageBuffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  return width >= minResolution && height >= minResolution;
}
