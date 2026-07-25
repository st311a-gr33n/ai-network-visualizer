import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, execSync, ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we're in development mode
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// Live scan state
let liveScanInterval: NodeJS.Timeout | null = null;
let liveScanProcess: ChildProcess | null = null;
let isLiveScanRunning = false;

// Secure storage path (for safeStorage-encrypted data)
let secureStoragePath: string;

function getSecureStoragePath(): string {
  if (!secureStoragePath) {
    secureStoragePath = path.join(app.getPath('userData'), 'secure-storage.json');
  }
  return secureStoragePath;
}

function readSecureStorage(): Record<string, string> {
  try {
    if (fs.existsSync(getSecureStoragePath())) {
      const raw = fs.readFileSync(getSecureStoragePath(), 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // Corrupt or empty file — reset
  }
  return {};
}

function writeSecureStorage(data: Record<string, string>): void {
  fs.writeFileSync(getSecureStoragePath(), JSON.stringify(data, null, 2), 'utf-8');
}

function createWindow(): void {
  // Determine icon path based on environment
  const iconPath = isDev
    ? path.join(__dirname, '../build/icon.png')
    : path.join(process.resourcesPath, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'default',
    show: false,
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Log Files', extensions: ['txt', 'log', 'json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  return { content, fileName, filePath };
});

ipcMain.handle('dialog:saveFile', async (_event, data: string, defaultName: string) => {
  if (!mainWindow) return null;

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, data, 'utf-8');
  return result.filePath;
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('app:getPath', (_event, name: string) => {
  return app.getPath(name as Parameters<typeof app.getPath>[0]);
});

// Secure storage handlers (safeStorage-backed encrypted persistence)
ipcMain.handle('secure-store:set', (_event, key: string, value: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption is not available on this system.');
  }
  const encrypted = safeStorage.encryptString(value);
  const store = readSecureStorage();
  store[key] = encrypted.toString('base64');
  writeSecureStorage(store);
});

ipcMain.handle('secure-store:get', (_event, key: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption is not available on this system.');
  }
  const store = readSecureStorage();
  const b64 = store[key];
  if (!b64) return null;
  const encrypted = Buffer.from(b64, 'base64');
  return safeStorage.decryptString(encrypted);
});

ipcMain.handle('secure-store:delete', (_event, key: string) => {
  const store = readSecureStorage();
  delete store[key];
  writeSecureStorage(store);
});

// Live Scan IPC Handlers

/**
 * Check if nmap is installed and available
 */
ipcMain.handle('nmap:check', async () => {
  try {
    // Try to run nmap --version to check if it's installed
    const result = execSync('nmap --version', { encoding: 'utf-8', timeout: 5000 });
    const versionMatch = result.match(/Nmap version (\d+\.\d+)/);
    return {
      available: true,
      version: versionMatch ? versionMatch[1] : 'unknown',
    };
  } catch (error) {
    return {
      available: false,
      error: 'nmap not found. Please install nmap to use live scanning.',
    };
  }
});

/**
 * Run a single nmap ping scan and return the XML output
 */
function runNmapScan(target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-sn', '-oX', '-', target];
    liveScanProcess = spawn('nmap', args);

    let stdout = '';
    let stderr = '';

    liveScanProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    liveScanProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    liveScanProcess.on('close', (code) => {
      liveScanProcess = null;
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `nmap exited with code ${code}`));
      }
    });

    liveScanProcess.on('error', (error) => {
      liveScanProcess = null;
      reject(error);
    });
  });
}

/**
 * Start periodic live scanning
 */
ipcMain.handle('live-scan:start', async (_event, config: { target: string; intervalSeconds: number }) => {
  if (isLiveScanRunning) {
    return { success: false, error: 'Live scan is already running' };
  }

  const { target, intervalSeconds } = config;

  // Validate target format (basic validation)
  if (!target || typeof target !== 'string') {
    return { success: false, error: 'Invalid target specified' };
  }

  // Validate interval
  const interval = Math.max(15, Math.min(300, intervalSeconds)) * 1000;

  isLiveScanRunning = true;

  // Function to perform a scan and send results
  const performScan = async () => {
    if (!mainWindow || !isLiveScanRunning) return;

    const startTime = Date.now();

    try {
      const xmlOutput = await runNmapScan(target);
      const scanDuration = (Date.now() - startTime) / 1000;

      mainWindow.webContents.send('live-scan:result', {
        timestamp: new Date().toISOString(),
        xmlOutput,
        scanDuration,
      });
    } catch (error) {
      if (mainWindow && isLiveScanRunning) {
        mainWindow.webContents.send('live-scan:error', {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error during scan',
        });
      }
    }
  };

  // Run initial scan immediately
  performScan();

  // Set up periodic scanning
  liveScanInterval = setInterval(performScan, interval);

  return { success: true };
});

/**
 * Stop live scanning
 */
ipcMain.handle('live-scan:stop', async () => {
  if (!isLiveScanRunning) {
    return { success: false, error: 'Live scan is not running' };
  }

  // Clear the interval
  if (liveScanInterval) {
    clearInterval(liveScanInterval);
    liveScanInterval = null;
  }

  // Kill any running nmap process
  if (liveScanProcess) {
    liveScanProcess.kill('SIGTERM');
    liveScanProcess = null;
  }

  isLiveScanRunning = false;

  if (mainWindow) {
    mainWindow.webContents.send('live-scan:stopped', {
      timestamp: new Date().toISOString(),
    });
  }

  return { success: true };
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clean up live scan on close
  if (liveScanInterval) {
    clearInterval(liveScanInterval);
    liveScanInterval = null;
  }
  if (liveScanProcess) {
    liveScanProcess.kill('SIGTERM');
    liveScanProcess = null;
  }
  isLiveScanRunning = false;

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.protocol !== 'file:' && !navigationUrl.startsWith('http://localhost')) {
      event.preventDefault();
    }
  });
});
