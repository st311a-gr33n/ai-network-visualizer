const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File dialog operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data, defaultName) => ipcRenderer.invoke('dialog:saveFile', data, defaultName),

  // File system operations
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

  // App utilities
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),

  // Platform info
  platform: process.platform,
  isElectron: true,

  // Nmap / Live Scan operations
  nmapCheck: () => ipcRenderer.invoke('nmap:check'),
  liveScanStart: (config) => ipcRenderer.invoke('live-scan:start', config),
  liveScanStop: () => ipcRenderer.invoke('live-scan:stop'),

  // Live scan event listeners
  onLiveScanResult: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('live-scan:result', handler);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('live-scan:result', handler);
  },
  onLiveScanError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('live-scan:error', handler);
    return () => ipcRenderer.removeListener('live-scan:error', handler);
  },
  onLiveScanStopped: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('live-scan:stopped', handler);
    return () => ipcRenderer.removeListener('live-scan:stopped', handler);
  },
});
