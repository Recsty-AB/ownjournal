// Input validation for cloud storage providers
import { z } from 'zod';

/**
 * Normalize server URL - adds https:// if missing, converts http:// to https://
 */
export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim();
  
  if (!trimmed) return trimmed;
  
  // If no protocol, add https://
  if (!trimmed.match(/^https?:\/\//i)) {
    return `https://${trimmed}`;
  }
  
  // If http://, convert to https://
  if (trimmed.match(/^http:\/\//i)) {
    return trimmed.replace(/^http:/i, 'https:');
  }
  
  return trimmed;
}

// Nextcloud validation - uses translation keys for messages
export const nextcloudServerUrlSchema = z
  .string()
  .trim()
  .min(1, { message: "validation.serverUrlRequired" })
  .max(255, { message: "validation.serverUrlTooLong" })
  .transform(normalizeServerUrl)  // Auto-add https:// if missing
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, { message: "validation.httpsRequired" })
  .refine((url) => {
    try {
      const parsed = new URL(url);
      // Block IP addresses for security
      return !/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname);
    } catch {
      return false;
    }
  }, { message: "validation.ipNotAllowed" });

export const nextcloudUsernameSchema = z
  .string()
  .trim()
  .min(1, { message: "validation.usernameRequired" })
  .max(200, { message: "validation.usernameTooLong" })
  .regex(/^[a-zA-Z0-9._@-]+$/, { 
    message: "validation.usernameInvalidChars" 
  });

export const nextcloudAppPasswordSchema = z
  .string()
  .trim()
  .min(1, { message: "validation.appPasswordRequired" })
  .max(500, { message: "validation.appPasswordTooLong" });

export const nextcloudConfigSchema = z.object({
  serverUrl: nextcloudServerUrlSchema,
  username: nextcloudUsernameSchema,
  appPassword: nextcloudAppPasswordSchema,
});

// Rate limiting helper
export class ConnectionRateLimiter {
  private attempts: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly maxAttempts = 5;
  private readonly windowMs = 60000; // 1 minute

  canAttempt(provider: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(provider);

    if (!record || now > record.resetAt) {
      this.attempts.set(provider, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingTime(provider: string): number {
    const record = this.attempts.get(provider);
    if (!record) return 0;
    return Math.max(0, record.resetAt - Date.now());
  }

  reset(provider: string): void {
    this.attempts.delete(provider);
  }
}

export const connectionRateLimiter = new ConnectionRateLimiter();
