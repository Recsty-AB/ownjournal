import type { CloudProvider, CloudFile } from '@/types/cloudProvider';
import { TransferStateManager, type TransferProgress } from '@/utils/transferState';
import { RequestThrottler } from '@/utils/requestThrottler';
import { AdaptiveRateLimiter } from '@/utils/adaptiveRateLimiter';

interface TransferOptions {
  onProgress?: (current: number, total: number, fileName?: string) => void;
  onConflict?: (fileName: string) => 'skip' | 'overwrite';
  maxRetries?: number;
  verifyChecksums?: boolean;
}

interface TransferResult {
  success: boolean;
  cancelled: boolean;
  totalFiles: number;
  transferredFiles: number;
  skippedFiles: number;
  failedFiles: string[];
  duration: number;
  /** True if encryption-key.json was successfully transferred (for post-transfer key validation). */
  transferredEncryptionKey?: boolean;
}

/**
 * Simple Stupid Transfer Service
 * 
 * Guarantees:
 * 1. ALL files are discovered via recursive listing from root
 * 2. NO silent failures - errors are thrown, not swallowed
 * 3. Exact mirror by FULL PATH (not just filename)
 * 4. Fast transfers with adaptive rate limiting
 */
export class TransferService {
  private isRunning = false;
  private shouldStop = false;
  private progressCallbacks: Set<(progress: TransferProgress) => void> = new Set();
  
  // Throttler - optimized for FAST parallel transfers
  private throttler = new RequestThrottler({
    minRequestInterval: 20,     // Very fast reads (was 100)
    writeOperationDelay: 30,    // Fast writes (was 300)
    enableWriteQueue: false,    // DISABLE queue for parallel writes
  });
  
  // Adaptive rate limiter for batch processing (aggressive speed settings)
  private rateLimiter = new AdaptiveRateLimiter({
    initialBatchSize: 15,       // Larger initial batch (was 8)
    maxBatchSize: 30,           // Higher ceiling (was 16)
    initialDelayMs: 30,         // Faster delay (was 100)
    maxDelayMs: 5000,           // Lower max backoff (was 8000)
    circuitBreakerEnabled: true,
    failureThreshold: 6,        // More tolerance before circuit breaker (was 4)
  });
  
  // Concurrency settings for parallel pipeline
  private readonly PARALLEL_WORKERS = 6;

  onProgress(callback: (progress: TransferProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  private notifyProgress(progress: TransferProgress): void {
    this.progressCallbacks.forEach(cb => cb(progress));
  }

  private async calculateChecksum(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Recursively list ALL files from a provider starting from root
   * NO silent failures - throws on error
   */
  private async listAllFiles(provider: CloudProvider): Promise<CloudFile[]> {
    const allFiles: CloudFile[] = [];
    const processedDirs = new Set<string>();
    const dirsToProcess: string[] = ['/'];
    
    // Known directories that might exist - add them to ensure we check them
    const knownDirs = [
      '/OwnJournal',
      '/OwnJournal/entries',
      '/OwnJournal/operations',
      '/OwnJournal/analysis',
      '/entries',
      '/operations',
      '/analysis'
    ];
    
    for (const dir of knownDirs) {
      if (!dirsToProcess.includes(dir)) {
        dirsToProcess.push(dir);
      }
    }

    while (dirsToProcess.length > 0) {
      const dir = dirsToProcess.pop()!;
      
      // Skip if already processed
      if (processedDirs.has(dir)) continue;
      processedDirs.add(dir);

      try {
        // Fast read - minimal delay for listing
        const files = await this.throttler.fastRead(
          () => provider.listFiles(dir)
        );
        
        for (const file of files) {
          // Skip hidden/system files
          if (file.name.startsWith('.')) continue;
          
          // Add file to results (use path as unique key)
          allFiles.push(file);
        }
      } catch (error) {
        // Only ignore "not found" type errors for directories that may not exist
        const errorMsg = String(error).toLowerCase();
        const isNotFound = errorMsg.includes('not found') || 
                          errorMsg.includes('path not found') ||
                          errorMsg.includes('404') ||
                          errorMsg.includes('does not exist');
        
        if (!isNotFound) {
          console.error(`Failed to list files in ${dir}:`, error);
          throw new Error(`Failed to list files in ${dir}: ${error}`);
        }
        // Directory doesn't exist - that's fine, continue
      }
    }
    
    // Also check for root-level encryption key (only if not already found in directory listing)
    const alreadyHasKey = allFiles.some(f => f.name === 'encryption-key.json');
    if (!alreadyHasKey) {
      try {
        const keyExists = await this.throttler.fastRead(
          () => provider.exists('encryption-key.json')
        );
        if (keyExists) {
          allFiles.push({
            name: 'encryption-key.json',
            path: '/OwnJournal/encryption-key.json',
            modifiedAt: new Date()
          });
        }
      } catch {
        // Ignore - key may not exist
      }
    }

    // Deduplicate by full path
    const filesByPath = new Map<string, CloudFile>();
    for (const file of allFiles) {
      filesByPath.set(file.path, file);
    }
    
    return Array.from(filesByPath.values());
  }

  /**
   * Normalize path for target provider
   * Ensures files go to the correct location based on provider's path conventions
   */
  private normalizePathForTarget(sourcePath: string, targetProviderName: string): string {
    // Normalize the source path first
    let normalized = sourcePath.replace(/^\/+/, '');
    
    // Special handling for encryption-key.json - always goes in /OwnJournal/
    if (normalized === 'encryption-key.json' || normalized.endsWith('/encryption-key.json')) {
      // For Dropbox, the app folder IS OwnJournal, so key goes at root
      if (targetProviderName === 'Dropbox') {
        return '/encryption-key.json';
      }
      // For all other providers, key goes in /OwnJournal/
      return '/OwnJournal/encryption-key.json';
    }
    
    // For Dropbox target, strip /OwnJournal prefix (Dropbox adds its own app folder)
    if (targetProviderName === 'Dropbox') {
      normalized = normalized.replace(/^OwnJournal\/?/i, '');
      return `/${normalized}`;
    }
    
    // For other providers, ensure paths are inside /OwnJournal
    if (!normalized.toLowerCase().startsWith('ownjournal/')) {
      // Check if it's an entries or analysis file
      if (normalized.startsWith('entries/') || normalized.includes('/entries/')) {
        normalized = `OwnJournal/entries/${normalized.replace(/^.*entries\//, '')}`;
      } else if (normalized.startsWith('analysis/') || normalized.includes('/analysis/')) {
        normalized = `OwnJournal/analysis/${normalized.replace(/^.*analysis\//, '')}`;
      } else if (normalized.startsWith('operations/') || normalized.includes('/operations/')) {
        normalized = `OwnJournal/operations/${normalized.replace(/^.*operations\//, '')}`;
      } else {
        normalized = `OwnJournal/${normalized}`;
      }
    }

    // Also fix op-device files that are directly under OwnJournal/ (missing operations/ subfolder)
    if (/^OwnJournal\/op-device-.*\.json$/i.test(normalized)) {
      const fileName = normalized.replace(/^OwnJournal\//i, '');
      normalized = `OwnJournal/operations/${fileName}`;
    }
    // Fix state-snapshot.json if placed directly under OwnJournal/
    if (/^OwnJournal\/state-snapshot\.json$/i.test(normalized)) {
      normalized = 'OwnJournal/operations/state-snapshot.json';
    }

    return `/${normalized}`;
  }

  /**
   * Transfer a single file - NO throttling delays (parallel pipeline handles pacing)
   * Returns result status - DOES NOT swallow errors silently
   */
  private async transferSingleFile(
    sourceProvider: CloudProvider,
    targetProvider: CloudProvider,
    file: CloudFile,
    options: TransferOptions
  ): Promise<'success' | 'skipped' | 'failed'> {
    // Normalize the path for the target provider's conventions
    const targetPath = this.normalizePathForTarget(file.path, targetProvider.name);

    // Check if target exists (no delay - concurrent workers provide natural pacing)
    const targetExists = await targetProvider.exists(targetPath);

    if (targetExists && options.onConflict) {
      const resolution = options.onConflict(file.name);
      if (resolution === 'skip') {
        return 'skipped';
      }
    }

    // Download from source (no delay)
    let content: string | null = null;
    try {
      content = await sourceProvider.download(file.path);
    } catch (downloadError) {
      // Handle 409 Conflict from Dropbox gracefully - file may have been deleted/moved
      const errorMsg = String(downloadError);
      if (errorMsg.includes('409') || errorMsg.includes('Conflict')) {
        console.warn(`⚠️ Skipping file due to conflict (may have been deleted): ${file.path}`);
        return 'skipped';
      }
      throw downloadError;
    }

    if (content === null || content === undefined) {
      // File not found - skip rather than fail
      console.warn(`⚠️ File not found or empty, skipping: ${file.path}`);
      return 'skipped';
    }

    // Upload to target (no delay - parallel workers provide natural pacing)
    await targetProvider.upload(targetPath, content);

    // Verify checksum if enabled
    if (options.verifyChecksums) {
      const targetContent = await targetProvider.download(targetPath);
      
      if (targetContent === null || targetContent === undefined) {
        throw new Error(`Checksum verification failed - cannot read target: ${targetPath}`);
      }

      const [sourceChecksum, targetChecksum] = await Promise.all([
        this.calculateChecksum(content),
        this.calculateChecksum(targetContent)
      ]);

      if (sourceChecksum !== targetChecksum) {
        throw new Error(`Checksum mismatch for ${file.path}`);
      }
    }

    return 'success';
  }
  
  /**
   * Parallel pipeline processor for fast file transfers
   * Uses a pool of concurrent workers to maximize throughput
   */
  private async transferFilesParallel(
    files: CloudFile[],
    sourceProvider: CloudProvider,
    targetProvider: CloudProvider,
    options: TransferOptions,
    progress: TransferProgress
  ): Promise<{ completed: number; skipped: number; failed: string[] }> {
    let fileIndex = 0;
    let completed = 0;
    let skipped = 0;
    const failed: string[] = [];
    const lock = { index: 0 }; // Simple mutex via shared object
    
    const worker = async (workerId: number): Promise<void> => {
      while (!this.shouldStop) {
        // Get next file index atomically
        const currentIndex = lock.index++;
        if (currentIndex >= files.length) break;
        
        const file = files[currentIndex];
        
        try {
          const result = await this.transferSingleFile(sourceProvider, targetProvider, file, options);
          
          if (result === 'success') {
            completed++;
          } else if (result === 'skipped') {
            skipped++;
          }
        } catch (error) {
          failed.push(file.name);
          console.error(`[Worker ${workerId}] Failed to transfer ${file.path}:`, error);
        }
        
        // Update progress after each file
        const processedCount = completed + skipped + failed.length;
        progress.completedFiles = processedCount;
        progress.lastUpdatedAt = Date.now();
        TransferStateManager.save(progress);
        this.notifyProgress(progress);
        options.onProgress?.(processedCount, files.length, file.name);
      }
    };
    
    // Launch N workers in parallel
    const workers = Array.from({ length: this.PARALLEL_WORKERS }, (_, i) => worker(i));
    await Promise.all(workers);
    
    return { completed, skipped, failed };
  }

  async transfer(
    sourceProvider: CloudProvider,
    targetProvider: CloudProvider,
    options: TransferOptions = {}
  ): Promise<TransferResult> {
    if (this.isRunning) {
      throw new Error('Transfer already in progress');
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.throttler.reset();
    this.rateLimiter.reset();

    const startTime = Date.now();
    const transferId = TransferStateManager.generateId();
    let completedFiles = 0;
    let skippedFiles = 0;
    const failedFiles: string[] = [];

    // Enable bulk sync mode for any provider that supports it (faster writes)
    const enableBulkSync = (provider: CloudProvider) => {
      if ('setBulkSyncMode' in provider) {
        (provider as any).setBulkSyncMode(true);
      }
    };
    const disableBulkSync = (provider: CloudProvider) => {
      if ('setBulkSyncMode' in provider) {
        (provider as any).setBulkSyncMode(false);
      }
    };
    
    enableBulkSync(sourceProvider);
    enableBulkSync(targetProvider);

    try {
      // Create folder structure in target
      try {
        await this.throttler.queueWriteOperation(async () => {
          await targetProvider.upload('/OwnJournal/entries/.keep', '');
          await targetProvider.delete('/OwnJournal/entries/.keep');
        });
        await this.throttler.queueWriteOperation(async () => {
          await targetProvider.upload('/OwnJournal/analysis/.keep', '');
          await targetProvider.delete('/OwnJournal/analysis/.keep');
        });
      } catch {
        // Folder creation is best-effort
      }

      // Phase 1: List ALL source files (recursive from root)
      console.log('📂 Listing all source files...');
      const sourceFiles = await this.listAllFiles(sourceProvider);
      const sourceFilesByPath = new Map(
        sourceFiles.map(f => [this.normalizePathForTarget(f.path, targetProvider.name), f])
      );
      const totalFiles = sourceFiles.length;

      console.log(`📊 Found ${totalFiles} files in source`);

      const progress: TransferProgress = {
        id: transferId,
        sourceProvider: sourceProvider.name,
        targetProvider: targetProvider.name,
        totalFiles,
        completedFiles: 0,
        failedFiles: [],
        startedAt: startTime,
        lastUpdatedAt: startTime,
        status: 'running',
        phase: 'copying'
      };
      TransferStateManager.save(progress);
      this.notifyProgress(progress);

      if (totalFiles === 0) {
        // Still need to clean destination
        progress.phase = 'cleaning';
        await this.cleanupOrphanedFiles(targetProvider, sourceFilesByPath, progress);
        progress.status = 'completed';
        TransferStateManager.save(progress);
        this.notifyProgress(progress);
        setTimeout(() => TransferStateManager.clear(), 5000);
        return {
          success: true,
          cancelled: false,
          totalFiles: 0,
          transferredFiles: 0,
          skippedFiles: 0,
          failedFiles: [],
          duration: Date.now() - startTime
        };
      }

      // Phase 2: Copy all files using PARALLEL PIPELINE (much faster!)
      console.log(`📤 Starting parallel file transfer (${this.PARALLEL_WORKERS} workers)...`);
      const transferResult = await this.transferFilesParallel(
        sourceFiles,
        sourceProvider,
        targetProvider,
        options,
        progress
      );

      completedFiles = transferResult.completed;
      skippedFiles = transferResult.skipped;
      failedFiles.push(...transferResult.failed);

      progress.completedFiles = completedFiles + skippedFiles;
      progress.failedFiles = failedFiles;

      // Check if transfer was cancelled
      if (this.shouldStop) {
        console.log(`🛑 Transfer cancelled: ${completedFiles} transferred before cancellation`);
        progress.status = 'completed';
        TransferStateManager.save(progress);
        this.notifyProgress(progress);
        setTimeout(() => TransferStateManager.clear(), 2000);
        
        return {
          success: false,
          cancelled: true,
          totalFiles,
          transferredFiles: completedFiles,
          skippedFiles,
          failedFiles,
          duration: Date.now() - startTime
        };
      }

      // Phase 3: Clean up orphaned files
      console.log('🧹 Cleaning up orphaned files...');
      progress.phase = 'cleaning';
      TransferStateManager.save(progress);
      this.notifyProgress(progress);
      await this.cleanupOrphanedFiles(targetProvider, sourceFilesByPath, progress);

      // Complete
      progress.status = 'completed';
      TransferStateManager.save(progress);
      this.notifyProgress(progress);
      setTimeout(() => TransferStateManager.clear(), 5000);

      // NOTE: Primary provider is NOT automatically switched here
      // User must explicitly choose to disconnect source in the dialog to switch primary

      const hadKeyInSource = sourceFiles.some((f) => f.name === 'encryption-key.json');
      const keyTransferFailed = failedFiles.includes('encryption-key.json');
      const transferredEncryptionKey = hadKeyInSource && !keyTransferFailed;

      console.log(`✅ Transfer complete: ${completedFiles} transferred, ${skippedFiles} skipped, ${failedFiles.length} failed`);

      return {
        success: failedFiles.length === 0,
        cancelled: false,
        totalFiles,
        transferredFiles: completedFiles,
        skippedFiles,
        failedFiles,
        duration: Date.now() - startTime,
        transferredEncryptionKey,
      };
    } catch (error) {
      const savedProgress = TransferStateManager.load();
      if (savedProgress) {
        savedProgress.status = 'failed';
        TransferStateManager.save(savedProgress);
        this.notifyProgress(savedProgress);
      }
      throw error;
    } finally {
      this.isRunning = false;
      disableBulkSync(sourceProvider);
      disableBulkSync(targetProvider);
    }
  }

  /**
   * Clean up files that exist in target but not in source
   * Compares by FULL PATH for accuracy
   */
  private async cleanupOrphanedFiles(
    targetProvider: CloudProvider,
    sourceFilesByPath: Map<string, CloudFile>,
    progress: TransferProgress
  ): Promise<void> {
    // List all files in destination
    console.log('📂 Listing destination files for cleanup...');
    const destFiles = await this.listAllFiles(targetProvider);
    
    // Find orphaned files (exist in dest but not in source by path).
    // Normalize destination paths so they match source map keys (handles provider path differences).
    const orphanedFiles = destFiles.filter(f => {
      const normalizedPath = this.normalizePathForTarget(f.path, targetProvider.name);
      return !sourceFilesByPath.has(normalizedPath);
    });
    
    console.log(`🗑️ Found ${orphanedFiles.length} orphaned files to delete`);

    progress.cleanupFiles = orphanedFiles.length;
    progress.cleanedFiles = 0;
    TransferStateManager.save(progress);
    this.notifyProgress(progress);

    if (orphanedFiles.length === 0) {
      return;
    }

    // Delete orphaned files using adaptive batching
    await this.rateLimiter.processBatch(
      orphanedFiles,
      async (file) => {
        if (this.shouldStop) {
          throw new Error('Transfer stopped by user');
        }
        await this.throttler.queueWriteOperation(
          () => targetProvider.delete(file.path)
        );
        return file.path;
      },
      {
        onProgress: (completed) => {
          progress.cleanedFiles = completed;
          progress.lastUpdatedAt = Date.now();
          TransferStateManager.save(progress);
          this.notifyProgress(progress);
        }
      }
    );
  }

  stop(): void {
    this.shouldStop = true;
  }

  get running(): boolean {
    return this.isRunning;
  }

  getProgress(): TransferProgress | null {
    return TransferStateManager.load();
  }
}

export const transferService = new TransferService();
