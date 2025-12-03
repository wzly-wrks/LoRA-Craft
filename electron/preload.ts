import { contextBridge, ipcRenderer } from 'electron';

interface AppSettings {
  openai: { apiKey: string };
  replicate: { apiKey: string };
  search: {
    defaultEngine: 'brave' | 'bing' | 'google';
    brave: { apiKey: string };
    bing: { apiKey: string };
    google: { apiKey: string; searchEngineId: string };
  };
  app: {
    defaultExportPath: string;
    thumbnailSize: number;
    autoCaption: boolean;
    defaultAspectRatio: string;
  };
}

interface AppPaths {
  userData: string;
  documents: string;
  downloads: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => 
    ipcRenderer.invoke('set-settings', settings),
  getSetting: (key: string): Promise<unknown> => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: unknown): Promise<unknown> => 
    ipcRenderer.invoke('set-setting', key, value),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),
  selectFiles: (options?: { filters?: { name: string; extensions: string[] }[] }): Promise<string[]> => 
    ipcRenderer.invoke('select-files', options || {}),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  getAppPaths: (): Promise<AppPaths> => ipcRenderer.invoke('get-app-paths'),
  isElectron: true
});
