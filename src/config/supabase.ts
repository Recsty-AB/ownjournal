export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID ?? '',
};
