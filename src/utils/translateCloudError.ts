// Helper to translate cloud errors at the UI layer
import { TFunction } from 'i18next';
import { CloudErrorCode, isCloudError, CloudError } from './cloudErrorCodes';

/**
 * Translate a cloud error to a user-friendly message using i18n
 * 
 * This function handles:
 * 1. Structured CloudErrors with codes and details
 * 2. Fallback pattern matching for legacy error messages
 * 3. Raw error messages as final fallback
 * 
 * @param error - The error to translate
 * @param t - The i18next translation function
 * @returns A translated error message
 */
export function translateCloudError(error: Error, t: TFunction): string {
  // Handle structured CloudErrors
  if (isCloudError(error)) {
    return translateCloudErrorCode(error, t);
  }
  
  // Fallback: Pattern match on error message for legacy errors
  const message = error.message?.toLowerCase() || '';
  
  // Nextcloud encryption guide (before generic 500/encryption so we show the guide)
  if (message.includes('nextcloud') && (message.includes('500') || message.includes('sync-state') || message.includes('encryption') || message.includes('hbegin'))) {
    return t('index.nextcloudEncryptionErrorDesc');
  }
  // Wrapped sync-state errors (e.g. "Failed to update sync state: CLOUD_ENCRYPTION_ERROR: /OwnJournal/sync-state.json")
  if (message.includes('sync-state') && (message.includes('cloud_encryption_error') || message.includes('encryption'))) {
    return t('index.nextcloudEncryptionErrorDesc');
  }
  
  // Not found patterns
  if (message.includes('404') || message.includes('not found') || message.includes('not_found')) {
    // Try to extract file path from message
    const fileMatch = error.message.match(/file:\s*([^\s]+)/i);
    if (fileMatch) {
      return t('cloudErrors.notFoundWithFile', { file: fileMatch[1] });
    }
    return t('cloudErrors.notFound');
  }
  
  // Permission/auth patterns
  if (message.includes('401') || message.includes('unauthorized')) {
    return t('cloudErrors.authFailed');
  }
  if (message.includes('403') || message.includes('permission denied') || message.includes('forbidden')) {
    return t('cloudErrors.permissionDenied');
  }
  
  // Server error patterns
  if (message.includes('500') || message.includes('internal server error')) {
    return t('cloudErrors.serverError');
  }
  if (message.includes('503') || message.includes('service unavailable') || message.includes('unavailable')) {
    return t('cloudErrors.serverUnavailable');
  }
  
  // Storage/rate limit patterns
  if (message.includes('507') || message.includes('storage full') || message.includes('insufficient')) {
    return t('cloudErrors.storageFull');
  }
  if (message.includes('429') || message.includes('rate') || message.includes('too many')) {
    return t('cloudErrors.rateLimited');
  }
  
  // Encryption patterns
  if (message.includes('encrypt') || message.includes('decrypt')) {
    return t('cloudErrors.encryptionError');
  }
  
  // Sync state patterns
  if (message.includes('sync-state') || message.includes('sync state')) {
    return t('cloudErrors.syncStateFailed');
  }
  
  // No cloud storage patterns
  if (message.includes('no cloud storage connected') || message.includes('no primary provider')) {
    return t('sync.noCloudStorage');
  }
  
  // CLOUD_KEY_REQUIRED pattern (case-insensitive)
  if (message.includes('cloud_key_required') || message.toLowerCase() === 'cloud_key_required') {
    return t('encryption.encryptedEntriesNeedCloud');
  }

  // NETWORK_ERROR_CHECKING_KEY pattern - transient error during encryption key check
  if (message.includes('network_error_checking_key')) {
    return t('cloudErrors.networkErrorCheckingKey', 'Temporary network error — please try again in a moment');
  }

  // Return original message as fallback
  return error.message;
}

/**
 * Translate a structured CloudError using its code and details
 */
function translateCloudErrorCode(error: CloudError, t: TFunction): string {
  const { cloudErrorCode: code, details } = error;
  
  switch (code) {
    case CloudErrorCode.NOT_FOUND:
      return details.file 
        ? t('cloudErrors.notFoundWithFile', { file: details.file })
        : t('cloudErrors.notFound');
    
    case CloudErrorCode.AUTH_FAILED:
    case CloudErrorCode.INVALID_CREDENTIALS:
      return t('cloudErrors.authFailed');
    
    case CloudErrorCode.PERMISSION_DENIED:
      return t('cloudErrors.permissionDenied');
    
    case CloudErrorCode.SERVER_ERROR:
      if (details.provider === 'Nextcloud') return t('index.nextcloudEncryptionErrorDesc');
      return t('cloudErrors.serverError');
    
    case CloudErrorCode.SERVER_UNAVAILABLE:
      return t('cloudErrors.serverUnavailable');
    
    case CloudErrorCode.STORAGE_FULL:
      return t('cloudErrors.storageFull');
    
    case CloudErrorCode.RATE_LIMITED:
      return t('cloudErrors.rateLimited');
    
    case CloudErrorCode.NEXTCLOUD_ENCRYPTED_CONTENT:
      return t('index.nextcloudEncryptionErrorDesc');
    
    case CloudErrorCode.ENCRYPTION_ERROR:
    case CloudErrorCode.DECRYPTION_ERROR:
      if (details.provider === 'Nextcloud') return t('index.nextcloudEncryptionErrorDesc');
      return t('cloudErrors.encryptionError');
    
    case CloudErrorCode.SYNC_STATE_FAILED:
      if (details.provider === 'Nextcloud') return t('index.nextcloudEncryptionErrorDesc');
      return t('cloudErrors.syncStateFailed');
    
    case CloudErrorCode.UPLOAD_FAILED:
      return details.file
        ? t('cloudErrors.uploadFailedWithFile', { file: details.file })
        : t('cloudErrors.uploadFailed');
    
    case CloudErrorCode.DOWNLOAD_FAILED:
      return details.file
        ? t('cloudErrors.downloadFailedWithFile', { file: details.file })
        : t('cloudErrors.downloadFailed');
    
    case CloudErrorCode.DELETE_FAILED:
      return t('cloudErrors.deleteFailed');
    
    case CloudErrorCode.LIST_FAILED:
      return t('cloudErrors.listFailed');
    
    case CloudErrorCode.CONNECTION_FAILED:
      return t('cloudErrors.connectionFailed');
    
    case CloudErrorCode.TOKEN_REFRESH_FAILED:
      return t('cloudErrors.tokenRefreshFailed');
    
    default:
      // Fallback to original message
      return details.originalMessage || error.message;
  }
}
