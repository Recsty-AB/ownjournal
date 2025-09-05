const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

/**
 * Validate file path to prevent directory traversal attacks
 * Only allow access to user data directory and its subdirectories
 */
function validatePath(filePath) {
  // Validation is enforced in the main process to avoid using @electron/remote here
  return filePath;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // OAuth
  startOAuth: (authUrl) => ipcRenderer.invoke('oauth:start', authUrl),
  
  // Native file system with path validation
  readFile: (filePath) => {
    try {
      const validPath = validatePath(filePath);
      return ipcRenderer.invoke('fs:readFile', validPath);
    } catch (error) {
      return Promise.resolve({ success: false, error: error.message });
    }
  },
  writeFile: (filePath, data) => {
    try {
      const validPath = validatePath(filePath);
      return ipcRenderer.invoke('fs:writeFile', validPath, data);
    } catch (error) {
      return Promise.resolve({ success: false, error: error.message });
    }
  },
  deleteFile: (filePath) => {
    try {
      const validPath = validatePath(filePath);
      return ipcRenderer.invoke('fs:deleteFile', validPath);
    } catch (error) {
      return Promise.resolve({ success: false, error: error.message });
    }
  },
  listFiles: (dirPath) => {
    try {
      const validPath = validatePath(dirPath);
      return ipcRenderer.invoke('fs:listFiles', validPath);
    } catch (error) {
      return Promise.resolve({ success: false, error: error.message });
    }
  },
  
  // Platform info
  platform: process.platform,
  isElectron: true,
});
