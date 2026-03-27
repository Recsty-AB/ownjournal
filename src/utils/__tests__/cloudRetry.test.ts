import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, sanitizeFileName, getApiErrorDetails, isSSLError } from '../cloudRetry';

describe('cloudRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(operation, { maxAttempts: 3, initialDelayMs: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx errors', async () => {
      const error500 = { status: 500, message: 'Server error' };
      const operation = vi.fn()
        .mockRejectedValueOnce(error500)
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(operation, { maxAttempts: 3, initialDelayMs: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 rate limit', async () => {
      const error429 = { status: 429, message: 'Too many requests' };
      const operation = vi.fn()
        .mockRejectedValueOnce(error429)
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(operation, { maxAttempts: 3, initialDelayMs: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors (except 429)', async () => {
      const error400 = { status: 400, message: 'Bad request' };
      const operation = vi.fn().mockRejectedValue(error400);
      
      await expect(retryWithBackoff(operation, { maxAttempts: 3 })).rejects.toEqual(error400);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max attempts', async () => {
      const error = new Error('Persistent error');
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(retryWithBackoff(operation, { maxAttempts: 3, initialDelayMs: 10 })).rejects.toThrow('Persistent error');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use custom shouldRetry function', async () => {
      const error = { code: 'CUSTOM_ERROR' };
      const operation = vi.fn().mockRejectedValue(error);
      const shouldRetry = vi.fn().mockReturnValue(false);
      
      await expect(retryWithBackoff(operation, { shouldRetry })).rejects.toEqual(error);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(error);
    });

    it('should apply exponential backoff with jitter', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retryWithBackoff(operation, { 
        maxAttempts: 3, 
        initialDelayMs: 100,
        maxDelayMs: 500 
      });
      const duration = Date.now() - startTime;
      
      // Should have some delay (at least 75ms from first retry with jitter)
      expect(duration).toBeGreaterThan(75);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove quotes and backslashes', () => {
      expect(sanitizeFileName('file"name.txt')).toBe('filename.txt');
      expect(sanitizeFileName("file'name.txt")).toBe('filename.txt');
      expect(sanitizeFileName('file\\name.txt')).toBe('filename.txt');
    });

    it('should remove directory traversal attempts', () => {
      // sanitizeFileName removes '..' sequences but leaves slashes intact
      expect(sanitizeFileName('../../../etc/passwd')).toBe('///etc/passwd');
      expect(sanitizeFileName('file..name.txt')).toBe('filename.txt');
    });

    it('should trim whitespace', () => {
      expect(sanitizeFileName('  file.txt  ')).toBe('file.txt');
    });

    it('should handle multiple special characters', () => {
      // Removes quotes/backslashes, then removes '..', then trims
      expect(sanitizeFileName(' "../file\'s\\name.txt" ')).toBe('/filesname.txt');
    });
  });

  describe('getApiErrorDetails', () => {
    it('should extract JSON error message', async () => {
      const response = {
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: { message: 'Custom error' } }),
        statusText: 'Bad Request',
      } as unknown as Response;
      
      const details = await getApiErrorDetails(response);
      expect(details).toBe('Custom error');
    });

    it('should extract JSON message field', async () => {
      const response = {
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Direct message' }),
        statusText: 'Bad Request',
      } as unknown as Response;
      
      const details = await getApiErrorDetails(response);
      expect(details).toBe('Direct message');
    });

    it('should stringify JSON if no message found', async () => {
      const response = {
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ code: 'ERROR_CODE', details: 'Some details' }),
        statusText: 'Bad Request',
      } as unknown as Response;
      
      const details = await getApiErrorDetails(response);
      expect(details).toContain('ERROR_CODE');
    });

    it('should extract text response', async () => {
      const response = {
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Plain text error',
        statusText: 'Bad Request',
      } as unknown as Response;
      
      const details = await getApiErrorDetails(response);
      expect(details).toBe('Plain text error');
    });

    it('should truncate long error messages', async () => {
      const longText = 'a'.repeat(300);
      const response = {
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => longText,
        statusText: 'Bad Request',
      } as unknown as Response;
      
      const details = await getApiErrorDetails(response);
      expect(details).toHaveLength(200);
    });

    it('should fallback to statusText on parse error', async () => {
      const response = {
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => { throw new Error('Parse error'); },
        statusText: 'Internal Server Error',
      } as unknown as Response;
      
      const details = await getApiErrorDetails(response);
      expect(details).toBe('Internal Server Error');
    });
  });

  describe('isSSLError', () => {
    it('should detect certificate errors in error message', () => {
      const error = new Error('SSL certificate has expired');
      expect(isSSLError(error)).toBe(true);
    });

    it('should detect SSL errors in error message', () => {
      const error = new Error('SSL handshake failed');
      expect(isSSLError(error)).toBe(true);
    });

    it('should detect TLS errors in error message', () => {
      const error = new Error('TLS connection failed');
      expect(isSSLError(error)).toBe(true);
    });

    it('should detect browser cert errors', () => {
      const error = new Error('net::ERR_CERT_DATE_INVALID');
      expect(isSSLError(error)).toBe(true);
    });

    it('should detect self-signed certificate errors', () => {
      const error = new Error('self-signed certificate in certificate chain');
      expect(isSSLError(error)).toBe(true);
    });

    it('should detect expired certificate errors', () => {
      const error = new Error('certificate has expired');
      expect(isSSLError(error)).toBe(true);
    });

    it('should detect untrusted certificate errors', () => {
      const error = new Error('certificate not trusted');
      expect(isSSLError(error)).toBe(true);
    });

    it('should handle error objects without message', () => {
      const error = { status: 500 };
      expect(isSSLError(error)).toBe(false);
    });

    it('should return false for non-SSL errors', () => {
      const error = new Error('Network timeout');
      expect(isSSLError(error)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const error = new Error('SSL CERTIFICATE ERROR');
      expect(isSSLError(error)).toBe(true);
    });
  });
});
