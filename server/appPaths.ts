import path from 'path';
import fs from 'fs';
import os from 'os';

const isElectron = process.env.ELECTRON_APP === 'true';
const isDev = process.env.NODE_ENV === 'development';

/**
 * Get the app data directory for storing user data (database, settings, images).
 * 
 * In development: Uses ./data in the project directory
 * In production (Tauri): Uses the user's app data directory
 *   - Windows: %APPDATA%/lora-craft
 *   - macOS: ~/Library/Application Support/lora-craft  
 *   - Linux: ~/.local/share/lora-craft
 */
export function getAppDataPath(): string {
  // In development, use the project's data folder
  if (isDev) {
    return path.join(process.cwd(), 'data');
  }

  // In production, use the system's app data directory
  let appDataDir: string;
  
  switch (process.platform) {
    case 'win32':
      appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      break;
    case 'darwin':
      appDataDir = path.join(os.homedir(), 'Library', 'Application Support');
      break;
    default: // Linux and others
      appDataDir = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
      break;
  }

  return path.join(appDataDir, 'lora-craft');
}

/**
 * Get the database file path
 */
export function getDatabasePath(): string {
  return process.env.DATABASE_PATH || path.join(getAppDataPath(), 'lora-craft.db');
}

/**
 * Get the storage directory path for images/files
 */
export function getStoragePath(): string {
  return process.env.STORAGE_PATH || path.join(getAppDataPath(), 'storage');
}

/**
 * Get the settings file path
 */
export function getSettingsPath(): string {
  return path.join(getAppDataPath(), 'settings.json');
}

/**
 * Get the crawl cache path
 */
export function getCrawlCachePath(): string {
  return path.join(getAppDataPath(), 'crawl-cache');
}

/**
 * Ensure the app data directory exists
 */
export function ensureAppDataDir(): void {
  const appDataPath = getAppDataPath();
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }
  console.log(`[AppPaths] Using app data path: ${appDataPath}`);
}
