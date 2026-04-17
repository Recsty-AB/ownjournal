# CLAUDE.md - OwnJournal (personal-cipher)

## Project Overview

OwnJournal is a privacy-first encrypted journaling PWA. Core principles:

- **Zero-knowledge architecture** - Journal content is encrypted client-side (AES-256-GCM) and never stored in plaintext on servers
- **Bring Your Own Storage (BYOS)** - Users connect their own cloud storage (Google Drive, Dropbox, Nextcloud, iCloud)
- **Multi-platform** - Web PWA, Android/iOS (Capacitor), Desktop (Electron)
- **Offline-first** - Works offline with IndexedDB, syncs when connected
- **Client-side AI** - Sentiment analysis and summarization run locally via transformers.js (no server-side processing of journal content)

App ID: `app.ownjournal` | Current version: see `package.json`

## Stack

React 18 + TypeScript on Vite 5, Tailwind + shadcn/ui for styling, React Query for server state, react-router-dom v7, Capacitor 8 for mobile, Electron 39 for desktop, Supabase for auth/metadata, Stripe for subscriptions, `@huggingface/transformers` for client-side AI, Vitest + jsdom + React Testing Library for tests.

## Layout

Feature components live in `src/components/{feature}/` with tests co-located in `__tests__/` subdirectories. Routes are defined in `src/App.tsx`. Locales are under `src/i18n/locales/`. Top-level `android/`, `ios/`, `electron/`, `supabase/` are platform projects; `scripts/` holds build/verify helpers.

## Commands

Install with `npm install --legacy-peer-deps` if npm errors on peer deps. Standard scripts (`dev`, `build`, `build:dev`, `lint`, `test`, `test:coverage`, `test:ui`) are defined in `package.json`.

## Key Services (`src/services/`)

Pointers to non-obvious load-bearing modules — not a catalogue. Other services (provider-specific, auth, caches) are self-describing by filename.

| File | Purpose |
|------|---------|
| `storageServiceV2.ts` | **Core** - Cloud-first storage engine with bidirectional sync, encryption key management, circuit breaker |
| `encryptionStateManager.ts` | **Core** - Single source of truth for encryption mode/state, enforces invariants |
| `connectionStateManager.ts` | **Core** - Single source of truth for provider connections, auto-binding, provider priority |
| `uploadQueue.ts` | IndexedDB-persisted upload queue with exponential backoff |
| `transferService.ts` | Parallel file transfers with SHA-256 checksum verification |
| `localAI.ts` | Client-side AI via transformers.js, WebGPU support |

## Key Utilities (`src/utils/`)

| File | Purpose |
|------|---------|
| `encryption.ts` | PBKDF2 key derivation, AES-GCM encrypt/decrypt, master key generation |
| `userScope.ts` | Per-user localStorage/IndexedDB isolation (`u:{userId}:{key}` prefix) |
| `validation.ts` | Zod schemas for entries, tags, auth (passwords 6+ chars, titles <200 chars, content <50k chars) |
| `cloudErrorCodes.ts` | Unified `CloudErrorCode` enum for cross-provider error handling |
| `oauth.ts` | PKCE utilities (code verifier/challenge, state parameter) |
| `platformDetection.ts` | Detects web/mobile/desktop, exposes `canShowPurchaseCTA()` |

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
Consult `src/config/features.ts` for any gated features before changing related code. `isAppleFeatureAvailable()` in that file also guards iCloud/Apple Sign-In on Android native (not supported).

### Internationalization
- All user-facing strings must use `t()` from `react-i18next`
- Locale files live in `src/i18n/locales/` (21 locales); English is the fallback
- **Any commit that adds or changes a user-facing string must update all 21 locale files natively in the same commit** — not English placeholders, not "TODO translate" stubs. Match the terminology conventions already established in each locale (e.g., German "KI" not "AI", Finnish "tekoäly"). A Python script is usually the fastest way to batch-update.

### No legacy code
Delete unreachable or superseded code immediately. Do not keep it behind comments, rename it with `_old` / `_legacy` suffixes, add "(Legacy)" rows to doc tables, or leave it "for reference". Git history is the reference. If you're adding a new implementation alongside an old one, check whether the old one is still reachable; if not, delete it in the same PR.

### Store compliance (native builds)
On Capacitor (iOS/Android) builds, all purchase CTAs must be gated by `canShowPurchaseCTA()` from `src/utils/platformDetection.ts`. Apple and Google reject builds that link to web checkout from native. The rollout for this landed in v1.0.16 — when touching anything subscription/purchase-facing, verify the CTA is still gated.

## Testing

### Setup
- **Framework**: Vitest with jsdom environment
- **Libraries**: @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
- **Setup file**: `src/test/setup.ts` (mocks Web Crypto API and localStorage — real Web Crypto is not available in jsdom, so rely on the provided mock)

### Writing Tests
- Global test APIs enabled (`describe`, `it`, `expect` without imports)
- Tests are co-located in `__tests__/` subdirectories next to the code under test
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

## Documentation Index

Detailed guides are in the root directory:
- `SYNC_ARCHITECTURE.md` - Sync design and compaction strategy
- `ENCRYPTION_FLOW_FIXES.md` - Encryption flow details and fixes
- `STORAGE_CONNECTION_FLOW.md` / `STORAGE_CONNECTION_STATE_MACHINE.md` - Storage connection lifecycle
- `OAUTH_SETUP_GUIDE.md` - OAuth redirect URI configuration
- `TEST_SETUP.md` / `TESTING_GUIDE_PHASE4.md` - Test setup and strategy
- `ANDROID_SETUP.md` / `IOS_SETUP.md` / `CAPACITOR_SETUP.md` - Mobile builds
- `ELECTRON_SETUP.md` / `DESKTOP_BUILD_GUIDE.md` - Desktop builds
