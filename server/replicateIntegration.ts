import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

export interface ReplicateConfig {
  apiKey: string;
}

export interface TrainingInput {
  datasetZipPath: string;
  triggerWord: string;
  modelName?: string;
  steps?: number;
  loraRank?: number;
  optimizer?: string;
  batchSize?: number;
  resolution?: string;
  learningRate?: number;
  captionDropoutRate?: number;
}

export interface TrainingJob {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  logs?: string;
  error?: string;
  output?: {
    version: string;
    weights: string;
  };
  metrics?: {
    predict_time?: number;
  };
}

export interface ReplicateModel {
  owner: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  hardware: string;
}

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

const FLUX_LORA_TRAINER = 'ostris/flux-dev-lora-trainer';
const SDXL_LORA_TRAINER = 'cloneofsimo/lora-training';

export class ReplicateService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(
    endpoint: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {}
  ): Promise<any> {
    const url = `${REPLICATE_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Replicate API error: ${response.status} - ${text}`);
    }

    return response.json();
  }

  async uploadFile(filePath: string): Promise<string> {
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;

    const uploadResponse = await this.request('/files', {
      method: 'POST',
      body: {
        filename: fileName,
        content_type: 'application/zip',
        content_length: fileSize
      }
    });

    const uploadUrl = uploadResponse.upload_url;
    const fileId = uploadResponse.id;

    const fileBuffer = fs.readFileSync(filePath);
    
    const uploadResult = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': fileSize.toString()
      },
      body: fileBuffer
    });

    if (!uploadResult.ok) {
      throw new Error(`Failed to upload file: ${uploadResult.status}`);
    }

    return `https://api.replicate.com/v1/files/${fileId}/content`;
  }

  async startFluxLoraTraining(input: TrainingInput): Promise<TrainingJob> {
    let inputFileUrl: string;
    
    if (input.datasetZipPath.startsWith('http')) {
      inputFileUrl = input.datasetZipPath;
    } else {
      inputFileUrl = await this.uploadFile(input.datasetZipPath);
    }

    const trainingInput = {
      input_images: inputFileUrl,
      trigger_word: input.triggerWord,
      steps: input.steps || 1000,
      lora_rank: input.loraRank || 16,
      optimizer: input.optimizer || 'adamw8bit',
      batch_size: input.batchSize || 1,
      resolution: input.resolution || '512,768,1024',
      learning_rate: input.learningRate || 0.0004,
      caption_dropout_rate: input.captionDropoutRate || 0.05
    };

    const response = await this.request('/trainings', {
      method: 'POST',
      body: {
        model: FLUX_LORA_TRAINER,
        input: trainingInput,
        destination: input.modelName ? `${input.modelName}` : undefined
      }
    });

    return {
      id: response.id,
      status: response.status,
      createdAt: response.created_at,
      startedAt: response.started_at,
      completedAt: response.completed_at,
      logs: response.logs,
      error: response.error
    };
  }

  async startSdxlLoraTraining(input: TrainingInput): Promise<TrainingJob> {
    let inputFileUrl: string;
    
    if (input.datasetZipPath.startsWith('http')) {
      inputFileUrl = input.datasetZipPath;
    } else {
      inputFileUrl = await this.uploadFile(input.datasetZipPath);
    }

    const trainingInput = {
      instance_data: inputFileUrl,
      instance_prompt: input.triggerWord,
      max_train_steps: input.steps || 3000,
      lora_rank: input.loraRank || 32,
      use_8bit_adam: true,
      train_batch_size: input.batchSize || 1,
      resolution: parseInt(input.resolution?.split(',')[0] || '1024'),
      learning_rate: input.learningRate || 1e-4
    };

    const response = await this.request('/trainings', {
      method: 'POST',
      body: {
        model: SDXL_LORA_TRAINER,
        input: trainingInput,
        destination: input.modelName ? `${input.modelName}` : undefined
      }
    });

    return {
      id: response.id,
      status: response.status,
      createdAt: response.created_at,
      startedAt: response.started_at,
      completedAt: response.completed_at,
      logs: response.logs,
      error: response.error
    };
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingJob> {
    const response = await this.request(`/trainings/${trainingId}`);

    return {
      id: response.id,
      status: response.status,
      createdAt: response.created_at,
      startedAt: response.started_at,
      completedAt: response.completed_at,
      logs: response.logs,
      error: response.error,
      output: response.output,
      metrics: response.metrics
    };
  }

  async cancelTraining(trainingId: string): Promise<TrainingJob> {
    const response = await this.request(`/trainings/${trainingId}/cancel`, {
      method: 'POST'
    });

    return {
      id: response.id,
      status: response.status,
      createdAt: response.created_at,
      startedAt: response.started_at,
      completedAt: response.completed_at,
      logs: response.logs,
      error: response.error
    };
  }

  async listTrainings(cursor?: string): Promise<{ trainings: TrainingJob[]; nextCursor?: string }> {
    const endpoint = cursor ? `/trainings?cursor=${cursor}` : '/trainings';
    const response = await this.request(endpoint);

    return {
      trainings: response.results.map((r: any) => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        error: r.error
      })),
      nextCursor: response.next ? new URL(response.next).searchParams.get('cursor') || undefined : undefined
    };
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.request('/account');
      return true;
    } catch {
      return false;
    }
  }

  async getAccount(): Promise<{ username: string; name: string }> {
    const response = await this.request('/account');
    return {
      username: response.username,
      name: response.name
    };
  }
}

export function createReplicateService(apiKey: string): ReplicateService {
  return new ReplicateService(apiKey);
}
