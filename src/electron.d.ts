// Type declarations for Electron API exposed via preload script

interface NmapCheckResult {
  available: boolean;
  version?: string;
  error?: string;
}

interface LiveScanConfig {
  target: string;
  intervalSeconds: number;
}

interface LiveScanStartResult {
  success: boolean;
  error?: string;
}

interface LiveScanResultData {
  timestamp: string;
  xmlOutput: string;
  scanDuration: number;
}

interface LiveScanErrorData {
  timestamp: string;
  error: string;
}

interface LiveScanStoppedData {
  timestamp: string;
}

interface ElectronAPI {
  // File dialog operations
  openFile: () => Promise<{ content: string; fileName: string; filePath: string } | null>;
  saveFile: (data: string, defaultName: string) => Promise<string | null>;

  // File system operations
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;

  // App utilities
  getAppPath: (name: string) => Promise<string>;

  // Platform info
  platform: string;
  isElectron: boolean;

  // Secure storage (safeStorage-backed, OS-level encryption)
  secureStoreSet: (key: string, value: string) => Promise<void>;
  secureStoreGet: (key: string) => Promise<string | null>;
  secureStoreDelete: (key: string) => Promise<void>;

  // Nmap / Live Scan operations
  nmapCheck: () => Promise<NmapCheckResult>;
  liveScanStart: (config: LiveScanConfig) => Promise<LiveScanStartResult>;
  liveScanStop: () => Promise<{ success: boolean; error?: string }>;

  // Live scan event listeners (return unsubscribe functions)
  onLiveScanResult: (callback: (data: LiveScanResultData) => void) => () => void;
  onLiveScanError: (callback: (data: LiveScanErrorData) => void) => () => void;
  onLiveScanStopped: (callback: (data: LiveScanStoppedData) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
