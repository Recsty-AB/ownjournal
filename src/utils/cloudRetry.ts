// Exponential backoff retry helper for cloud storage operations

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: any) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 4, // Increased from 3 for better resilience
  initialDelayMs: 1500, // Increased from 1000ms for 429 rate limiting
  maxDelayMs: 15000, // Increased from 10000ms for longer backoff
  shouldRetry: (error: any) => {
    // Retry on network errors, 5xx, and 429 (rate limit)
    const status = error?.status;
    // Don't retry 4xx errors (except 429) - these are client errors that won't fix with retry
    if (status && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
    // Retry on network errors, 5xx, and 429 (rate limit)
    return !status || status >= 500 || status === 429;
  },
};

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry if this error type shouldn't be retried
      if (!opts.shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts - 1) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(2, attempt),
        opts.maxDelayMs
      );

      // Add jitter (±25%)
      const jitter = delay * (0.75 + Math.random() * 0.5);

      if (import.meta.env.DEV) {
        console.log(`Retry attempt ${attempt + 1}/${opts.maxAttempts} after ${Math.round(jitter)}ms`);
      }

      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }

  throw lastError;
}

// Sanitize file names for cloud storage APIs
export function sanitizeFileName(fileName: string): string {
  // Remove/escape special characters that could cause injection
  return fileName
    .replace(/['"\\]/g, '') // Remove quotes and backslashes
    .replace(/\.\./g, '') // Remove directory traversal
    .trim();
}

// Detect SSL certificate errors
export function isSSLError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorString = String(error).toLowerCase();
  
  // Common SSL/TLS error indicators
  const sslIndicators = [
    'certificate',
    'ssl',
    'tls',
    'net::err_cert',
    'sec_error',
    'ssl_error',
    'cert_',
    'self-signed',
    'expired',
    'untrusted',
    'handshake'
  ];
  
  return sslIndicators.some(indicator => 
    errorMessage.includes(indicator) || errorString.includes(indicator)
  );
}

// Extract error details from API responses
export async function getApiErrorDetails(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return data.error?.message || data.message || JSON.stringify(data);
    }
    const text = await response.text();
    return text.substring(0, 200); // Limit error message length
  } catch {
    return response.statusText;
  }
}
