// Storage for user's preferred primary provider selection
import { scopedKey } from './userScope';

const PRIMARY_PROVIDER_KEY = 'preferred_primary_provider';

export const PrimaryProviderStorage = {
  get: (): string | null => {
    try {
      return localStorage.getItem(scopedKey(PRIMARY_PROVIDER_KEY));
    } catch {
      return null;
    }
  },
  
  set: (providerName: string): void => {
    try {
      localStorage.setItem(scopedKey(PRIMARY_PROVIDER_KEY), providerName);
    } catch (error) {
      console.error('Failed to save primary provider preference:', error);
    }
  },
  
  clear: (): void => {
    try {
      localStorage.removeItem(scopedKey(PRIMARY_PROVIDER_KEY));
    } catch {
      // Ignore clear errors
    }
  },
};
