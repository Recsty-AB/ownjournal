# OwnJournal

A privacy-first encrypted journaling Progressive Web App with zero-knowledge architecture.

## Features

- **End-to-end encryption** — AES-256-GCM client-side encryption; your data is never stored in plaintext on servers
- **Bring Your Own Storage** — Sync to Google Drive, Dropbox, Nextcloud, or iCloud (your cloud, your data)
- **Native iCloud sync on iOS** — Zero-UI CloudKit integration on iOS native builds; no extra prompts or sign-ins (web and Android use OAuth-based providers)
- **Offline-first** — Works without internet via IndexedDB, syncs when connected
- **Multi-platform** — Web/PWA, Android, iOS (Capacitor), Desktop (Electron)
- **Client-side AI** — Optional sentiment analysis and summarization via transformers.js (runs locally, WebGPU when available)
- **21 languages** — Full i18n support, natively translated
- **Markdown editor** — Formatting with live preview
- **Tags & moods** — Organize and track your emotional journey

## Quick Start

```bash
git clone https://github.com/Recsty-AB/ownjournal.git
cd ownjournal
cp .env.example .env    # Edit with your credentials
npm install --legacy-peer-deps
npm run dev             # http://localhost:8080
```

### Prerequisites

- Node.js 20+
- npm

### Environment Setup

Copy `.env.example` to `.env` and fill in your values. At minimum you need:

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Yes | Supabase project ID |
| `VITE_GOOGLE_CLIENT_ID` | No | Google Drive sync / Google Sign-In |
| `VITE_DROPBOX_CLIENT_ID` | No | Dropbox sync |
| `VITE_APPLE_CLIENT_ID` | No | Apple Sign-In (currently disabled via feature flag) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | No | Subscription billing |

See [OAUTH_SETUP_GUIDE.md](OAUTH_SETUP_GUIDE.md) for OAuth provider configuration.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React PWA     │    │  Cloud Storage   │    │  Auth Provider   │
│                 │    │                  │    │                  │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │ Encrypted │◄─┼────┼─►│ Encrypted │  │    │  │  OAuth    │  │
│  │ IndexedDB │  │    │  │ Files     │  │    │  │  Tokens   │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
│                 │    │                  │    │                  │
│  ┌───────────┐  │    │  Google Drive    │    │  Google / Apple  │
│  │ Service   │  │    │  Dropbox         │    │                  │
│  │ Worker    │  │    │  Nextcloud       │    │                  │
│  └───────────┘  │    │  iCloud          │    │                  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Encryption Flow

1. User sets password → PBKDF2 derives key → generates AES-GCM master key
2. Master key encrypts/decrypts journal entries
3. Master key itself is encrypted with the password-derived key and stored
4. Cloud provider OAuth tokens are also encrypted with the master key
5. Two modes: **E2E** (password required) and **Simple** (no encryption)

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 (SWC) |
| Styling | Tailwind CSS 3 + shadcn/ui |
| State | TanStack Query, React hooks |
| Routing | react-router-dom v7 |
| Testing | Vitest + React Testing Library |
| i18n | i18next (21 languages) |
| Mobile | Capacitor 8 |
| Desktop | Electron 39 |
| Backend | Supabase (auth + metadata only) |
| Encryption | Web Crypto API (PBKDF2 + AES-GCM) |
| AI | @huggingface/transformers (client-side) |

## Project Structure

```
src/
├── components/      # React components by feature
├── config/          # App configuration (features, oauth, pricing)
├── hooks/           # Custom React hooks
├── i18n/            # i18next config + 21 locale files
├── pages/           # Route components
├── services/        # Business logic (storage, sync, encryption, AI)
├── types/           # TypeScript types
└── utils/           # Pure utilities (encryption, OAuth, validation)
```

## Commands

```bash
npm run dev           # Dev server (port 8080)
npm run build         # Production build
npm run build:dev     # Development-mode build
npm run lint          # ESLint
npm run test          # Vitest (watch mode)
npm run test -- --run # Vitest (single run)
npm run test:coverage # Coverage report
npm run test:ui       # Vitest UI

# iOS (requires macOS + Xcode)
npm run ios:sync      # Build, sync Capacitor, patch native plugins
npm run ios:open      # Open Xcode project
npm run ios:run       # Build and run on simulator/device
```

## Deployment

### Web (Cloudflare Pages)

OwnJournal deploys to **Cloudflare Pages**. The build is a static SPA (`dist/`) with a couple of platform-specific files:

- `public/_headers` — sets `Content-Type: application/json` for `/.well-known/assetlinks.json` (Android App Links) and `/.well-known/apple-app-site-association` (iOS Universal Links)
- `public/_redirects` — serves `.well-known` files statically, redirects `/storage-callback` to the `ownjournal://` custom scheme for native OAuth, and falls back to `index.html` for SPA routes

```bash
npm run build   # Output in dist/
```

Set the environment variables from `.env.example` in the Cloudflare Pages project settings (Production and Preview environments).

### Mobile (iOS / Android)

```bash
# iOS
npm run ios:sync && npm run ios:open    # Requires macOS + Xcode

# Android
npm run build && npx cap sync android
npx cap open android                    # Requires Android Studio
```

On native builds, purchase CTAs are gated by `canShowPurchaseCTA()` in `src/utils/platformDetection.ts` to comply with App Store anti-steering rules and Google Play billing policy.

See [ANDROID_SETUP.md](ANDROID_SETUP.md), [IOS_SETUP.md](IOS_SETUP.md), [CAPACITOR_SETUP.md](CAPACITOR_SETUP.md), and [docs/CLOUDKIT_ICLOUD.md](docs/CLOUDKIT_ICLOUD.md) for the native iCloud plugin.

### Desktop (Electron)

See [ELECTRON_SETUP.md](ELECTRON_SETUP.md) and [DESKTOP_BUILD_GUIDE.md](DESKTOP_BUILD_GUIDE.md).

## Security & Privacy

- **Zero-knowledge** — Journal content is encrypted client-side before upload
- **No server-side storage of entries** — Only auth metadata is stored in Supabase
- **PKCE OAuth** — Industry-standard secure authentication
- **Client-side AI** — AI analysis runs locally in your browser via WebGPU/WASM
- **Auditable** — Source code is open for review

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — Release history
- [OAUTH_SETUP_GUIDE.md](OAUTH_SETUP_GUIDE.md) — OAuth provider setup
- [SYNC_ARCHITECTURE.md](SYNC_ARCHITECTURE.md) — Sync design and compaction
- [ENCRYPTION_FLOW_FIXES.md](ENCRYPTION_FLOW_FIXES.md) — Encryption internals
- [STORAGE_CONNECTION_FLOW.md](STORAGE_CONNECTION_FLOW.md) / [STORAGE_CONNECTION_STATE_MACHINE.md](STORAGE_CONNECTION_STATE_MACHINE.md) — Provider connection lifecycle
- [NEXTCLOUD_ENCRYPTION_FLOW.md](NEXTCLOUD_ENCRYPTION_FLOW.md) — Nextcloud-specific encryption notes
- [TEST_SETUP.md](TEST_SETUP.md) / [TESTING_GUIDE_PHASE4.md](TESTING_GUIDE_PHASE4.md) — Test configuration and strategy
- [ANDROID_SETUP.md](ANDROID_SETUP.md) / [ANDROID_QUICKSTART.md](ANDROID_QUICKSTART.md) / [IOS_SETUP.md](IOS_SETUP.md) / [CAPACITOR_SETUP.md](CAPACITOR_SETUP.md) — Mobile builds
- [docs/CLOUDKIT_ICLOUD.md](docs/CLOUDKIT_ICLOUD.md) / [docs/APPLE_SIGNIN_SETUP.md](docs/APPLE_SIGNIN_SETUP.md) — Apple platform integrations
- [ELECTRON_SETUP.md](ELECTRON_SETUP.md) / [DESKTOP_BUILD_GUIDE.md](DESKTOP_BUILD_GUIDE.md) — Desktop builds

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This means you can view, fork, and modify the code, but if you deploy a modified version — even as a hosted service — you must release your source code under the same license.
