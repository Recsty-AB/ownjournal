/**
 * Type definitions for Electron IPC API
 */

export interface ElectronAPI {
  // OAuth
  startOAuth: (authUrl: string) => Promise<string>;
  
  // Native file system
  readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  listFiles: (dirPath: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
  
  // Platform info
  platform: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
