// Standardized error codes for cloud storage services
// These codes are used to enable i18n translation at the UI layer

export enum CloudErrorCode {
  // File/path errors
  NOT_FOUND = 'CLOUD_NOT_FOUND',
  
  // Authentication errors
  AUTH_FAILED = 'CLOUD_AUTH_FAILED',
  PERMISSION_DENIED = 'CLOUD_PERMISSION_DENIED',
  INVALID_CREDENTIALS = 'CLOUD_INVALID_CREDENTIALS',
  
  // Server errors
  SERVER_ERROR = 'CLOUD_SERVER_ERROR',
  SERVER_UNAVAILABLE = 'CLOUD_SERVER_UNAVAILABLE',
  
  // Resource limits
  STORAGE_FULL = 'CLOUD_STORAGE_FULL',
  RATE_LIMITED = 'CLOUD_RATE_LIMITED',
  
  // Encryption errors
  ENCRYPTION_ERROR = 'CLOUD_ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'CLOUD_DECRYPTION_ERROR',
  NEXTCLOUD_ENCRYPTED_CONTENT = 'CLOUD_NEXTCLOUD_ENCRYPTED_CONTENT',

  // Sync-specific errors
  SYNC_STATE_FAILED = 'CLOUD_SYNC_STATE_FAILED',
  
  // Transfer errors
  UPLOAD_FAILED = 'CLOUD_UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'CLOUD_DOWNLOAD_FAILED',
  DELETE_FAILED = 'CLOUD_DELETE_FAILED',
  LIST_FAILED = 'CLOUD_LIST_FAILED',
  
  // Connection errors
  CONNECTION_FAILED = 'CLOUD_CONNECTION_FAILED',
  TOKEN_REFRESH_FAILED = 'CLOUD_TOKEN_REFRESH_FAILED',
}

export interface CloudErrorDetails {
  file?: string;
  status?: number;
  provider?: string;
  originalMessage?: string;
}

export interface CloudError extends Error {
  cloudErrorCode: CloudErrorCode;
  details: CloudErrorDetails;
}

/**
 * Create a structured cloud error that can be translated at the UI layer
 * 
 * @param code - The error code from CloudErrorCode enum
 * @param details - Optional details like file path, status code, etc.
 * @returns An Error object with cloudErrorCode and details attached
 */
export function createCloudError(
  code: CloudErrorCode, 
  details?: CloudErrorDetails
): CloudError {
  // Create human-readable message for logging (will be replaced by translation at UI)
  const message = `${code}${details?.file ? `: ${details.file}` : ''}`;
  const error = new Error(message) as CloudError;
  error.cloudErrorCode = code;
  error.details = details || {};
  return error;
}

/**
 * Check if an error is a CloudError with translation support
 */
export function isCloudError(error: unknown): error is CloudError {
  return error instanceof Error && 'cloudErrorCode' in error;
}

/**
 * Extract CloudErrorCode from any error if possible
 * Returns null if the error is not a CloudError
 */
export function getCloudErrorCode(error: unknown): CloudErrorCode | null {
  if (isCloudError(error)) {
    return error.cloudErrorCode;
  }
  return null;
}

const NEXTCLOUD_ENCRYPTION_CODES: CloudErrorCode[] = [
  CloudErrorCode.ENCRYPTION_ERROR,
  CloudErrorCode.SYNC_STATE_FAILED,
  CloudErrorCode.SERVER_ERROR,
];

/**
 * True when the error indicates Nextcloud server-side/E2E encryption is blocking sync.
 * Used by the UI to show the Nextcloud encryption guide toast (title + description).
 */
export function isNextcloudEncryptionError(error: unknown): boolean {
  const code = getCloudErrorCode(error);
  if (code === CloudErrorCode.NEXTCLOUD_ENCRYPTED_CONTENT) return true;
  if (isCloudError(error) && error.details?.provider === 'Nextcloud' && NEXTCLOUD_ENCRYPTION_CODES.includes(error.cloudErrorCode)) {
    return true;
  }
  // Fallback: wrapped errors (e.g. "Failed to update sync state: CLOUD_ENCRYPTION_ERROR: ...")
  const msg = error instanceof Error ? error.message?.toLowerCase() ?? '' : '';
  if (msg.includes('sync-state') && (msg.includes('cloud_encryption_error') || msg.includes('encryption'))) {
    return true;
  }
  return false;
}
