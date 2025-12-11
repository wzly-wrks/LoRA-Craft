import OpenAI from "openai";
import { storageAdapter } from "./storageAdapter";
import fs from "fs";
import { getSettingsPath } from "./appPaths";

const isElectron = process.env.ELECTRON_APP === 'true';

function getOpenAIKeyFromSettings(): string {
  if (!isElectron) {
    return process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  }
  
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.openai?.apiKey) {
        return settings.openai.apiKey;
      }
    }
  } catch (error) {
    console.error('Error reading OpenAI key from settings:', error);
  }
  
  // Fallback to environment variables
  return process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
}

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  const apiKey = getOpenAIKeyFromSettings();
  
  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Set it in Settings or use OPENAI_API_KEY environment variable.");
  }
  
  // Recreate client if key changed or doesn't exist
  if (!openai) {
    openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey,
    });
  }
  
  return openai;
}

export async function generateCaption(storageKey: string): Promise<string> {
  const buffer = await storageAdapter.getBuffer(storageKey);
  const base64Image = buffer.toString("base64");
  
  const mimeType = storageKey.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert image captioner for AI model training datasets. 
Your task is to create detailed, descriptive captions that capture the key visual elements of the image.

Guidelines for captions:
- Start with the main subject and their key characteristics
- Include clothing, accessories, pose, and expression if applicable
- Describe the setting, lighting, and atmosphere
- Mention style (photo, illustration, etc.) and camera angle if relevant
- Use natural, flowing language
- Be specific about colors, textures, and materials
- Keep captions between 50-150 words
- Do not include any preamble like "This image shows" - start directly with the description
- Use commas to separate different elements naturally`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: "Generate a detailed training caption for this image:",
          },
        ],
      },
    ],
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function generateTags(storageKey: string): Promise<string[]> {
  const buffer = await storageAdapter.getBuffer(storageKey);
  const base64Image = buffer.toString("base64");
  
  const mimeType = storageKey.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert at tagging images for AI training datasets.
Generate a list of relevant tags that describe the image content.

Tag guidelines:
- Include subject type (person, animal, object, landscape, etc.)
- Include style (photo, digital art, painting, etc.)
- Include mood and atmosphere
- Include colors and lighting
- Include composition elements
- Include any notable features or accessories
- Use lowercase, single words or hyphenated phrases
- Generate 5-15 relevant tags
- Return tags as a JSON array of strings`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "low",
            },
          },
          {
            type: "text",
            text: "Generate tags for this image. Return only a JSON array of strings.",
          },
        ],
      },
    ],
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content?.trim() || "[]";
  
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch {
    return content.split(",").map((tag) => tag.trim().replace(/["\[\]]/g, "").toLowerCase());
  }
}
