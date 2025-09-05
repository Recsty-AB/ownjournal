import type { TFunction } from "i18next";

/**
 * Translates Supabase authentication errors into user-friendly localized messages.
 * Used across authentication flows (login, signup, password reset/update).
 */
export const translateAuthError = (
  error: Error, 
  t: TFunction
): { title: string; description: string } => {
  const message = error.message.toLowerCase();
  
  // Rate limiting (during password reset)
  if (message.includes('security purposes') || message.includes('request this after')) {
    return {
      title: t('auth.rateLimited'),
      description: t('auth.rateLimitedDesc')
    };
  }
  
  // Weak password (during signup or password update)
  if (message.includes('weak') || message.includes('easy to guess')) {
    return {
      title: t('auth.weakPassword'),
      description: t('auth.weakPasswordDesc')
    };
  }
  
  // User already exists (during signup)
  if (message.includes('user already registered')) {
    return {
      title: t('auth.userAlreadyExists'),
      description: t('auth.userAlreadyExistsDesc')
    };
  }
  
  // Invalid credentials (during login)
  if (message.includes('invalid login credentials')) {
    return {
      title: t('auth.invalidCredentials'),
      description: t('auth.invalidCredentialsDesc')
    };
  }
  
  // Email not confirmed
  if (message.includes('email not confirmed')) {
    return {
      title: t('auth.authError'),
      description: t('auth.accountCreatedDesc')
    };
  }
  
  // Default fallback - use the original error message if it's reasonable
  return {
    title: t('auth.authError'),
    description: error.message || t('common.unknownError')
  };
};
