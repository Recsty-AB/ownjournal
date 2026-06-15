import { defineConfig, devices } from '@playwright/test';

// Dev server runs over HTTPS (vite basic-ssl) on port 8080, so every context
// must ignore the self-signed cert. Tests live in e2e/ and are named *.e2e.ts
// so the Vitest default {test,spec} glob never picks them up.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'https://127.0.0.1:8080',
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'https://127.0.0.1:8080/demo',
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The Supabase client (src/integrations/supabase/client.ts) calls
    // createClient at import time and throws "supabaseUrl is required" on an
    // empty URL, which aborts the whole bundle before React mounts. The
    // auth-free /demo route never talks to Supabase, so throwaway placeholders
    // are enough to let the app boot. Real values come from CI secrets.
    env: {
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'placeholder-anon-key',
      VITE_SUPABASE_PROJECT_ID: 'placeholder',
    },
  },
});
