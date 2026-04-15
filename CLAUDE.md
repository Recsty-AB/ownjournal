# CLAUDE.md - OwnJournal (personal-cipher)

## Project Overview

OwnJournal is a privacy-first encrypted journaling Progressive Web App. Core principles:

- **Zero-knowledge architecture** - Journal content is encrypted client-side (AES-256-GCM) and never stored in plaintext on servers
- **Bring Your Own Storage (BYOS)** - Users connect their own cloud storage (Google Drive, Dropbox, Nextcloud, iCloud)
- **Multi-platform** - Web PWA, Android/iOS (Capacitor), Desktop (Electron)
- **Offline-first** - Works offline with IndexedDB, syncs when connected
- **Client-side AI** - Sentiment analysis and summarization run locally via transformers.js (no server-side processing of journal content)

App ID: `app.ownjournal` | Current version: see `package.json`

## Quick Reference Commands

```bash
npm install              # Install dependencies (use --legacy-peer-deps if needed)
npm run dev              # Start dev server on port 8080
npm run build            # Production build to dist/
npm run build:dev        # Development build
npm run lint             # ESLint check
npm run test             # Run tests (Vitest)
npm run test -- --run    # Run tests once (no watch)
npm run test:coverage    # Tests with V8 coverage
npm run test:ui          # Vitest UI
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 with TypeScript |
| Build | Vite 5 (SWC plugin for React) |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| State | React Query (TanStack), React hooks, localStorage |
| Routing | react-router-dom v7 |
| Testing | Vitest + jsdom + React Testing Library |
| i18n | i18next (18 languages) |
| Mobile | Capacitor 8 (iOS/Android) |
| Desktop | Electron 39 (optional, scripts not in package.json by default) |
| Backend | Supabase (auth + metadata only), Stripe (subscriptions) |
| Encryption | Web Crypto API (PBKDF2 + AES-GCM) |
| AI | @huggingface/transformers (client-side, WebGPU/WASM) |

## Project Structure

```
src/
├── components/          # React components organized by feature
│   ├── auth/            #   Login, password dialogs
│   ├── demo/            #   Demo mode banner and provider
│   ├── editor/          #   Markdown editor
│   ├── help/            #   Help dialog
│   ├── journal/         #   Entry display, AI analysis, timeline, export
│   ├── layout/          #   Header
│   ├── onboarding/      #   Onboarding tour (react-joyride)
│   ├── settings/        #   Settings panels, storage config, sync diagnostics
│   ├── storage/         #   Per-provider sync UI (Google Drive, Dropbox, etc.)
│   ├── subscription/    #   Subscription banner
│   ├── sync/            #   Sync progress bar, status indicator
│   └── ui/              #   shadcn/ui primitives (DO NOT edit manually - use shadcn CLI)
├── config/              # App configuration
│   ├── features.ts      #   Feature flags (ICLOUD_ENABLED, APPLE_SIGNIN_ENABLED)
│   ├── oauth.ts         #   OAuth client IDs and helpers
│   ├── pricing.ts       #   Multi-currency pricing tiers
│   └── supabase.ts      #   Supabase URL/key (hardcoded, not from env)
├── demo/                # Mock data for demo mode
├── hooks/               # Custom React hooks
├── i18n/                # i18next config + locale JSON files
│   └── locales/         #   One JSON file per language
├── integrations/
│   └── supabase/        #   Supabase client init + auto-generated types
├── lib/
│   └── utils.ts         #   cn() helper (clsx + tailwind-merge)
├── pages/               # Route components (Index, Demo, OAuth callbacks, legal)
├── services/            # Business logic layer (see Key Services below)
├── test/
│   └── setup.ts         #   Vitest setup, crypto mocks, localStorage mock
├── types/               # TypeScript types (CloudProvider, AIMetadata, electron.d.ts)
└── utils/               # Pure utilities (see Key Utilities below)
```

### Other top-level directories

- `android/` - Capacitor Android project
- `ios/` - Capacitor iOS project
- `electron/` - Electron main process files
- `supabase/` - Supabase edge functions and config
- `scripts/` - Build/verification scripts
- `public/` - Static assets, manifest, service worker
- `icons/`, `resources/` - App icons and splash screens

## Key Services (`src/services/`)

| File | Purpose |
|------|---------|
| `storageServiceV2.ts` | **Core** - Cloud-first storage engine with bidirectional sync, encryption key management, circuit breaker |
| `encryptionStateManager.ts` | **Core** - Single source of truth for encryption mode/state, enforces invariants |
| `connectionStateManager.ts` | **Core** - Single source of truth for provider connections, auto-binding, provider priority |
| `cloudStorageService.ts` | High-level cloud provider abstraction, path normalization, upload queuing |
| `googleDriveService.ts` | Google Drive OAuth + file operations, token refresh, file ID caching |
| `dropboxService.ts` | Dropbox API integration, 409 conflict handling |
| `nextcloudDirectService.ts` | Direct WebDAV client for Nextcloud (no backend proxy) |
| `iCloudService.ts` | iCloud integration (currently disabled via feature flag) |
| `uploadQueue.ts` | IndexedDB-persisted upload queue with exponential backoff |
| `transferService.ts` | Parallel file transfers with SHA-256 checksum verification |
| `authService.ts` | OAuth abstraction, platform-aware (Web/Capacitor/Electron), PKCE |
| `localAIGenerative.ts` | Qwen3.5-based generative AI for on-device inference via `@huggingface/transformers`. Plus-gated, feature-flagged via `FEATURES.LOCAL_AI_ENABLED`. See `docs/LOCAL_AI.md` for the full architecture, device tiers, and Phase 1/2 split. |
| `localAICapabilities.ts` | Hardware capability detection for local AI (WebGPU, RAM, storage). Handles the iOS Safari `navigator.deviceMemory` gap via iPhone UA model lookup. |
| `aiCacheService.ts` | IndexedDB AI cache with 7-day expiry |

## Key Utilities (`src/utils/`)

| File | Purpose |
|------|---------|
| `encryption.ts` | PBKDF2 key derivation, AES-GCM encrypt/decrypt, master key generation |
| `passwordStorage.ts` | Encrypted password storage (AES-GCM with device-specific key) |
| `cloudCredentialStorage.ts` | Encrypted credential storage for all cloud providers |
| `oauth.ts` | PKCE utilities (code verifier/challenge generation, state parameter) |
| `validation.ts` | Zod schemas for entries, tags, auth (passwords 6+ chars, titles <200 chars, content <50k chars) |
| `pwa.ts` | Service worker registration, IndexedDB utilities |
| `userScope.ts` | Per-user localStorage/IndexedDB isolation (`u:{userId}:{key}` prefix) |
| `platformDetection.ts` | Detects web/mobile/desktop platform |

## Architecture Patterns

### Encryption Flow
1. User sets password -> PBKDF2 derives key -> generates AES-GCM master key
2. Master key encrypts/decrypts journal entries
3. Master key itself is encrypted with the password-derived key and stored
4. Cloud provider credentials are encrypted with the master key
5. Two modes: **E2E** (password required) and **Simple** (no encryption)

### Cloud Provider Abstraction
All providers implement the `CloudProvider` interface (`src/types/cloudProvider.ts`):
- `upload()`, `download()`, `listFiles()`, `delete()`, `exists()`, `disconnect()`
- Providers register on `window` for global access
- Unified error handling via `CloudErrorCode` (`src/utils/cloudErrorCodes.ts`)

### Sync Strategy
- **Cloud-first**: Primary provider is source of truth
- **Bidirectional**: Local changes upload, cloud changes download
- **Adaptive rate limiting**: Batch sizing adjusts based on success/failure rates
- **Queue persistence**: Failed uploads saved to IndexedDB, retried with exponential backoff
- **Conflict resolution**: Last-write-wins with timestamp tolerance

### User Scope Isolation
- All localStorage keys prefixed with `u:{userId}:{key}` (see `src/utils/userScope.ts`)
- IndexedDB databases named `{baseName}_{userId}`
- Prevents cross-user data leakage on shared devices

### Single Source of Truth Pattern
- `storageServiceV2` owns entry state, encryption keys, and cloud sync
- `encryptionStateManager` owns encryption mode transitions
- `connectionStateManager` owns provider connection state
- Circular dependencies avoided via lazy async imports

## Development Conventions

### Import Aliases
Use `@/` to reference `src/`:
```typescript
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
```

### Component Organization
- Feature components in `src/components/{feature}/`
- Tests co-located in `__tests__/` subdirectories alongside components
- shadcn/ui primitives in `src/components/ui/` - do NOT edit these manually; add new ones via the shadcn CLI

### TypeScript Configuration
- `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`
- `noUnusedLocals: false`, `noUnusedParameters: false`
- Target: ES2020, JSX: react-jsx, module: ESNext
- These are intentionally relaxed - do not tighten without discussion

### ESLint
- `@typescript-eslint/no-unused-vars: off`
- React hooks rules enforced
- React Refresh export warnings enabled

### Production Build
- `console.*` and `debugger` statements are stripped in production builds (via Vite esbuild `drop`)
- Use `if (import.meta.env.DEV)` guards for dev-only logging
- App version injected as `__APP_VERSION__` at build time

### Feature Flags
Check `src/config/features.ts` before working on:
- iCloud integration (`ICLOUD_ENABLED = false`)
- Apple Sign-In (`APPLE_SIGNIN_ENABLED = false`)

### Internationalization
- All user-facing strings should use `t()` from `react-i18next`
- Locale files in `src/i18n/locales/`
- 18 languages supported; English is the fallback

## Testing

### Setup
- **Framework**: Vitest with jsdom environment
- **Libraries**: @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
- **Setup file**: `src/test/setup.ts` (mocks Web Crypto API and localStorage)
- **65 test files** across services, utils, components, and pages

### Running Tests
```bash
npm run test              # Watch mode
npm run test -- --run     # Single run
npm run test:coverage     # With V8 coverage report
```

### Test File Locations
Tests are co-located in `__tests__/` subdirectories:
```
src/services/__tests__/
src/utils/__tests__/
src/components/{feature}/__tests__/
src/pages/__tests__/
src/hooks/__tests__/
src/lib/__tests__/
```

### Writing Tests
- Global test APIs enabled (`describe`, `it`, `expect` without imports)
- Use the mocked crypto from setup.ts - real Web Crypto is not available in jsdom
- Coverage excludes: `node_modules/`, `src/test/`, `*.d.ts`, `*.config.*`, `mockData/`, `src/main.tsx`

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. Runs on push/PR to `main`/`master`
2. Node.js 20.x on Ubuntu
3. `npm ci --legacy-peer-deps` -> lint -> test with coverage -> build
4. Build requires Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) from secrets
5. Coverage uploaded to Codecov
6. Lint and test steps use `continue-on-error: true`

## Environment Variables

Required in `.env` for full functionality (not needed for basic dev):
```
VITE_GOOGLE_CLIENT_ID       # Google OAuth
VITE_APPLE_CLIENT_ID        # Apple Sign-In
VITE_DROPBOX_CLIENT_ID      # Dropbox OAuth
VITE_STRIPE_PUBLISHABLE_KEY # Stripe subscriptions
```

Supabase config is hardcoded in `src/config/supabase.ts` (not read from env at runtime). CI uses `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` as secrets for the build step.

## Routes

| Path | Page | Purpose |
|------|------|---------|
| `/` | Index | Main journal app |
| `/demo` | Demo | Demo mode |
| `/terms` | TermsOfService | Legal |
| `/privacy` | PrivacyPolicy | Legal |
| `/oauth-callback` | OAuthCallback | OAuth flow completion |
| `/web-oauth-callback` | OAuthCallbackWeb | Web-specific OAuth |
| `/storage-callback` | StorageOAuthCallback | Storage provider OAuth |

## Documentation Index

Detailed guides are in the root directory:
- `SYNC_ARCHITECTURE.md` - Sync design and compaction strategy
- `ENCRYPTION_FLOW_FIXES.md` - Encryption flow details and fixes
- `STORAGE_CONNECTION_FLOW.md` / `STORAGE_CONNECTION_STATE_MACHINE.md` - Storage connection lifecycle
- `OAUTH_SETUP_GUIDE.md` - OAuth redirect URI configuration
- `TEST_SETUP.md` / `TESTING_GUIDE_PHASE4.md` - Test setup and strategy
- `ANDROID_SETUP.md` / `IOS_SETUP.md` / `CAPACITOR_SETUP.md` - Mobile builds
- `ELECTRON_SETUP.md` / `DESKTOP_BUILD_GUIDE.md` - Desktop builds
