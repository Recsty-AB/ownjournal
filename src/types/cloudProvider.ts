// Standardized interface for all cloud storage providers

export interface CloudFile {
  name: string;
  path: string;
  modifiedAt: Date;
  size?: number;
}

export interface CloudProvider {
  name: string;
  isConnected: boolean;
  
  /**
   * Upload a file to cloud storage
   */
  upload(filePath: string, content: string): Promise<void>;
  
  /**
   * Download a file from cloud storage
   */
  download(filePath: string): Promise<string | null>;
  
  /**
   * List all files in a directory
   */
  listFiles(directoryPath: string): Promise<CloudFile[]>;
  
  /**
   * Delete a file from cloud storage
   */
  delete(filePath: string): Promise<void>;
  
  /**
   * Check if a file exists
   */
  exists(filePath: string): Promise<boolean>;
  
  /**
   * Disconnect and revoke tokens (optional, best-effort)
   * Can return void synchronously or Promise<void> asynchronously
   */
  disconnect?(): void | Promise<void>;
}

// Global window interface for cloud providers
declare global {
  interface Window {
    googleDriveSync?: CloudProvider;
    dropboxSync?: CloudProvider;
    nextcloudSync?: CloudProvider;
    iCloudSync?: CloudProvider;
  }
}
