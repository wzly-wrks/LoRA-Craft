import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import Store from 'electron-store';

const store = new Store({
  name: 'lora-craft-settings',
  defaults: {
    openai: { apiKey: '' },
    replicate: { apiKey: '' },
    search: {
      defaultEngine: 'brave',
      brave: { apiKey: '' },
      bing: { apiKey: '' },
      google: { apiKey: '', searchEngineId: '' },
      pinterest: { accessToken: '' },
      reddit: { clientId: '', clientSecret: '' }
    },
    app: {
      defaultExportPath: '',
      thumbnailSize: 256,
      autoCaption: false,
      defaultAspectRatio: '1:1'
    }
  }
});

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development';
const serverPort = 5000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.setMenu(null);

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${serverPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${serverPort}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  let serverPath: string;
  let command: string;
  let args: string[];

  if (isDev) {
    serverPath = path.join(__dirname, '../server/index.ts');
    command = 'npx';
    args = ['tsx', serverPath];
  } else {
    serverPath = path.join(process.resourcesPath, 'server', 'index.js');
    command = 'node';
    args = [serverPath];
  }

  serverProcess = spawn(command, args, {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: isDev ? 'development' : 'production',
      ELECTRON_APP: 'true',
      APP_DATA_PATH: app.getPath('userData'),
      DATABASE_PATH: path.join(app.getPath('userData'), 'lora-craft.db'),
      STORAGE_PATH: path.join(app.getPath('userData'), 'storage')
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('set-settings', (_, settings) => {
  Object.keys(settings).forEach(key => {
    store.set(key, settings[key]);
  });
  return store.store;
});

ipcMain.handle('get-setting', (_, key: string) => {
  return store.get(key);
});

ipcMain.handle('set-setting', (_, key: string, value: unknown) => {
  store.set(key, value);
  return store.get(key);
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('select-files', async (_, options: { filters?: { name: string; extensions: string[] }[] }) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: options.filters
  });
  return result.filePaths;
});

ipcMain.handle('open-external', (_, url: string) => {
  shell.openExternal(url);
});

ipcMain.handle('get-app-paths', () => {
  return {
    userData: app.getPath('userData'),
    documents: app.getPath('documents'),
    downloads: app.getPath('downloads')
  };
});

app.whenReady().then(() => {
  startServer();
  
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});
