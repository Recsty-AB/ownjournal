# Local AI (on-device generative AI)

OwnJournal's local AI mode runs generative AI features directly on the
user's device using Qwen3.5 (Alibaba, March 2026) via the
`@huggingface/transformers` library. It is a Plus-gated feature and an
opt-in alternative to cloud AI — cloud remains the default for every
user and continues to work exactly as before.

This document covers the architecture, device requirements, user flow,
and the Phase 1 / Phase 2 split. It is the source of truth for anyone
working on on-device inference in the codebase.

---

## Goals

1. **Full zero-knowledge AI on capable hardware.** Users who care
   about privacy above all else get a realistic path to never send
   journal content to any server for AI processing.
2. **No regression for cloud users.** Default mode stays cloud; the
   local path is purely opt-in.
3. **Honest hardware requirements.** No silent quality degradation —
   either the device can run Qwen3.5-4B well, or local mode is marked
   unavailable and cloud remains.
4. **Plus-gated.** Local AI is part of the Plus tier, same as cloud AI.
   Non-Plus users see a lock card in the AI Settings tab.
5. **Store-compliant.** Nothing in the local AI UI directs users to
   external payment. Plus-gating is enforced but the upgrade CTA
   still respects the platform rules from `LOCAL_AI_ENABLED` and
   `canShowPurchaseCTA()`.

---

## Tier decisions

Qwen3.5-4B is the **minimum** baseline. We intentionally do **not**
offer a smaller 2B fallback tier — users get either the real thing or
nothing. The rationale:

- 2B quality is visibly worse on non-English languages, especially for
  trend analysis. A noticeably mediocre trend analysis is worse UX
  than the cloud-processed one.
- "Download once, great result" is a cleaner product story than "pick
  one of three quality tiers".
- The engineering cost of supporting multiple mobile model variants
  (model switching, cache management, per-feature routing) is high
  relative to the value.

On **desktop** we offer two models:

| Tier | Model | Size | RAM needed | Target hardware |
|---|---|---|---|---|
| Normal | Qwen3.5-4B | 2.5 GB | 4 GB inference / 6 GB system | Most modern laptops / desktops with WebGPU |
| Advanced | Qwen3.5-9B | 5.5 GB | 8 GB inference / 16 GB system | High-end desktops, preferably with discrete GPU |

On **mobile** we offer only Qwen3.5-4B.

### Supported devices — mobile

Mobile local AI requires **all** of:

- **WebGPU** (iOS 18+ Safari/WKWebView, Android Chrome 113+)
- **6 GB+ system RAM** — enforced via capability detection
- **3 GB+ free storage** for the model download
- **~4 GB RAM available at inference time**

Representative supported devices:

- **iPhone**: 13 Pro / 13 Pro Max, 14 (all), 15 (all), 16 (all), 17 (all)
- **iPhone NOT supported**: 12 and earlier, 13 / 13 mini (4 GB RAM)
- **Google Pixel**: 7 series and newer
- **Samsung Galaxy**: S22 series and newer
- **Other Android**: anything with 6 GB+ RAM and WebGPU-capable Chrome

### Supported hardware — desktop

- **WebGPU** required
- **Qwen3.5-4B**: 8 GB system RAM (or more)
- **Qwen3.5-9B**: 16 GB system RAM (or more)
- Any Electron desktop build, or the web app on a modern browser
  (Chrome, Edge, or Safari 18+)

---

## Capability detection

`src/services/localAICapabilities.ts` runs a four-layer check:

1. **Hard gates (always enforced):**
   - WebGPU adapter must be actually requestable (`navigator.gpu.requestAdapter()` must return a non-null adapter)
   - Platform must be recognized (mobile or desktop)
2. **Platform-aware RAM estimation:**
   - **Electron desktop**: query `os.totalmem()` via IPC (`electronAPI.getSystemRAM()`). `navigator.deviceMemory` caps at 8 GB on desktop and is useless for distinguishing 4B- from 9B-capable systems.
   - **Chromium/Chrome on Android**: `navigator.deviceMemory` is reliable (in GB, capped at 8).
   - **iOS Safari/WKWebView**: `navigator.deviceMemory` is not exposed. Falls back to a per-iPhone-model RAM lookup table (`IPHONE_RAM_TABLE`). Requires the Capacitor Device plugin to provide the exact model name in `window.Capacitor.deviceModel` for accurate results; otherwise returns `null` and the user is allowed to opt in with runtime validation.
3. **Storage quota**: `navigator.storage.estimate()`, require ≥ 1.2× model size as headroom.
4. **Optional runtime smoke test**: expensive, only run on explicit user action, not passively during detection.

The returned `LocalAICapability` is one of four tiers:

- `unsupported`: one hard gate failed. UI shows a clear reason and the user stays on cloud AI.
- `mobile-4b`: mobile device that meets 4B requirements. Only Qwen3.5-4B offered.
- `desktop-4b`: desktop that meets 4B requirements but not 9B. Only Qwen3.5-4B offered.
- `desktop-9b-capable`: desktop with 16 GB+ RAM. Both Normal (4B) and Advanced (9B) offered.

**iPhone model detection caveat**: because Safari deliberately doesn't
expose `navigator.deviceMemory`, we rely on the Capacitor Device
plugin exposing the model string. Without that, iOS users see the
detection result as "unknown RAM" and can opt in manually. The first
inference will fail fast if the device cannot handle it, which is why
Phase 2 should include a tiny WebGPU smoke test before the full
download starts.

---

## User flow

1. User opens **Settings → AI tab**.
2. If **not Plus**: lock card. Nothing else visible.
3. If **Plus** and `LOCAL_AI_ENABLED === false`: "coming soon" card showing the Cloud AI mode as active. This is the Phase 1 production state.
4. If **Plus** and `LOCAL_AI_ENABLED === true`:
   - Show mode radio: Cloud AI (default, active) or Local AI.
   - If user selects Local AI:
     - Capability detection runs (cached across renders).
     - If `unsupported`: show the reason, tell user cloud remains available, disable Local AI radio.
     - If supported: show device capability panel (WebGPU, RAM, storage status), model selection (1 or 2 models depending on tier), and the download / benchmark / delete controls.
     - Show the "Local only (strict)" sub-toggle — defaults to off (allow cloud fallback), on means features that can't run locally are disabled.
5. Downloading:
   - Progress bar with bytes and percent.
   - `localAIGenerative.loadModel()` wraps `transformers.js` pipeline loading and aggregates per-file progress events into a single 0–100 stream.
   - On completion, `lastVerifiedAt` is stored in preferences.
6. Benchmarking:
   - User explicitly triggers via "Run benchmark" button.
   - Phase 1: returns estimated values from the model registry.
   - Phase 2: will run a real short generation and report actual tokens/sec, time-to-first-token, and peak memory.
7. Deleting:
   - `localAIGenerative.clearCache()` clears the transformers.js OPFS/Cache API entries and unloads the model from memory.

---

## Architecture

```
src/
├── config/
│   ├── features.ts                LOCAL_AI_ENABLED flag
│   └── localAIModels.ts           Model registry (4B + 9B specs)
├── services/
│   ├── localAI.ts                 LEGACY — mt5-small/distilbart pipelines
│   │                              wired into existing `mode === 'local'`
│   │                              path in TagSuggestion/TitleSuggestion.
│   │                              NOT touched in Phase 1.
│   ├── localAICapabilities.ts     NEW — device detection
│   └── localAIGenerative.ts       NEW — Qwen3.5 loader + inference
├── utils/
│   ├── userScope.ts               Existing per-user scoping
│   └── localAISettings.ts         NEW — user prefs persistence
├── hooks/
│   ├── useLocalAICapability.ts    NEW — detection hook
│   └── useAIMode.ts               NEW — per-feature mode resolver
└── components/settings/
    ├── AISettings.tsx             REWRITTEN — new AI tab UI
    └── SettingsDialog.tsx         MODIFIED — new 'ai' tab registered
```

### Key design decisions

- **Lazy import of `@huggingface/transformers`.** The library is ~5 MB minified. `localAIGenerative.ts` does `await import('@huggingface/transformers')` on first use instead of a top-level import, so users who never enable local mode don't pay the bundle cost.
- **Legacy `localAI.ts` left untouched.** It still serves the older local-mode code paths in `TagSuggestion` / `TitleSuggestion` / `AIAnalysis` that were wired up before this feature. Phase 2 will migrate those paths to the new service and retire the legacy one.
- **Settings persistence is user-scoped.** `localAISettings.ts` uses `scopedKey()` from `userScope.ts`, so account switches do not leak preferences across users.
- **Mode resolver hook is centralized.** `useAIMode(feature, { isPro })` is the single place every feature component calls. No platform/feature-flag checks scattered through the codebase.

---

## Phase 1 vs Phase 2

### Phase 1 (this release — feature flag `LOCAL_AI_ENABLED = false`)

- Model registry with real specs
- Capability detection service (real — works on all platforms)
- Settings persistence layer (real)
- `localAIGenerative` service (real lazy loader, real download progress, scaffolded benchmark)
- `useLocalAICapability` hook (real)
- `useAIMode` hook (real, currently not called by feature components)
- `AISettings.tsx` — new AI Settings tab UI (real, feature-flag-gated)
- `SettingsDialog` wiring for the new tab (real)
- English i18n strings (real; other 20 locales fall back to English on AI tab content until translated)
- This documentation

**What Phase 1 does NOT do:**

- Does **not** wire Qwen into `TagSuggestion`, `TitleSuggestion`, `AIAnalysis`, or `TrendAnalysis`. They still use their existing cloud/legacy-local paths. Flipping `LOCAL_AI_ENABLED` to `true` will reveal the Settings UI but will not change what happens when a user actually triggers AI in an entry.
- Does **not** translate the AI tab to non-English locales beyond the tab title.
- Does **not** ship real inference or real benchmark output — `runBenchmark()` returns estimated values from the registry.
- Does **not** handle OOM recovery or fall-back-to-cloud on inference failure.

### Phase 2 (follow-up work before the flag flips)

The concrete steps to graduate from Phase 1 to "local AI works end-to-end":

1. **Wire the mode resolver into feature components.**
   - `TagSuggestion.tsx`: call `useAIMode('tagSuggestion', { isPro })` and branch on the result. Local path calls `localAIGenerative.generateTagSuggestions(...)`.
   - `TitleSuggestion.tsx`: same for `titleSuggestion`.
   - `AIAnalysis.tsx`: same for `entryAnalysis`.
   - `TrendAnalysis.tsx`: same for `trendAnalysis`.

2. **Implement real inference helpers in `localAIGenerative.ts`.**
   Each Phase 2 method takes the same inputs as the cloud edge function and returns the same shape:
   - `generateTags(content, existingTags, predefinedActivities)` → tag sets + activities
   - `generateTitle(content, language)` → title candidates
   - `analyzeEntry(content, mood, tags)` → `EntryAIMetadata`
   - `analyzeTrends(aggregates, entries, language)` → trend analysis JSON
   Each method must run the Qwen tokenizer, call `model.generate()` with a simplified prompt (the cloud prompts are too long for small models — see "Prompt tailoring" below), and parse the structured output.

3. **Simplify the trend analysis prompt for local inference.** The cloud version of the trend prompt is ~100 lines with strict tone rules. Small models will ignore parts of it. Create a shortened local variant that keeps the JSON schema and the core warmth instruction, and drops the detailed style guidance. Accept somewhat less polished output in exchange for reliable schema compliance.

4. **Replace `runBenchmark()` with a real generation.** Run a fixed short prompt (deterministic, in English to avoid tokenizer bias), measure time-to-first-token and sustained tokens/sec, and report them honestly.

5. **OOM and error recovery.** If local inference fails with an OOM or WebGPU error, surface a clear message and offer: (a) retry, (b) switch to cloud for this request (respecting the `localOnly` preference), (c) switch to cloud permanently.

6. **Runtime WebGPU smoke test before first download.** Tiny (≤ 5 MB) compute op to validate the adapter actually works, run once at the moment the user clicks "Download model". Catches broken WebGPU drivers that `navigator.gpu.requestAdapter()` lets through.

7. **Capacitor Device plugin integration.** On iOS, read the device model string into `window.Capacitor.deviceModel` at app boot, so the `IPHONE_RAM_TABLE` lookup has real data to work with. Without this, iOS detection falls back to "unknown RAM" and requires manual user opt-in.

8. **Full i18n.** Translate the `settings.aiTab.*` keys into the other 20 locales. Follow the existing convention of using native translations that match the target language's UI tone.

9. **Flip `FEATURES.LOCAL_AI_ENABLED = true`.**

10. **Announce in CHANGELOG.** "On-device AI (beta) — Plus subscribers can now run AI features locally on capable hardware."

---

## Privacy and compliance notes

- **Plus gating is enforced in `useAIMode`** — `isPro: false` short-circuits to cloud AI regardless of user preference. Non-Plus users cannot activate local mode.
- **No external payment CTA anywhere in the AI tab.** The only Plus-gate UI is an informational lock card. Users who want to upgrade find the existing subscription surfaces (which are already platform-gated via `canShowPurchaseCTA()`).
- **User-scoped preferences.** All local AI preferences live under `u:{userId}:local_ai_prefs_v1` in localStorage. Account switches and sign-out properly isolate.
- **Model cache is shared across users on the device.** `@huggingface/transformers` stores the model in the Cache API / OPFS, which is origin-scoped, not user-scoped. This is OK — the model is public, not sensitive — but it means a user switching to a different account does not need to redownload.
- **Journal content never touches the cache.** Local inference holds tokens in RAM; nothing is persisted to disk.

---

## Known limitations (Phase 1)

- Mode resolver is implemented but not called by feature components. Local mode toggle has no effect on actual AI output until Phase 2.
- Benchmark returns estimated values rather than measured ones.
- iPhone RAM table is best-effort; we depend on Capacitor Device plugin for the model hint, which is not yet wired.
- Non-English AI tab UI strings fall back to English.
- No resume-on-interruption for downloads yet (transformers.js handles some of this automatically via HTTP range requests + Cache API, but we do not expose a manual resume button).

---

## When adding a new model

Update `src/config/localAIModels.ts`:

1. Add a new entry to `LOCAL_AI_MODELS` with the real HuggingFace repo path, size estimates (download, disk, inference RAM, required system RAM), supported platforms, and supported features.
2. The UI picks up the new model automatically via `getModelsForPlatform(platform)`.
3. If the new model needs a different transformers.js loader class, update `localAIGenerative.doLoad()` to dispatch on `modelId`.
4. Update this doc's "Tier decisions" table.
5. Add capability gates if the new model has stricter requirements than the existing 4B baseline.

---

## Testing checklist (Phase 2)

Before flipping `LOCAL_AI_ENABLED` to `true`:

- [ ] Capability detection returns correct tier on: iPhone 15, Pixel 8, MacBook Pro M3, Windows 11 laptop with 8 GB RAM, Windows 11 desktop with 32 GB RAM, iPhone 12 (should be unsupported), 4 GB RAM budget Android (should be unsupported)
- [ ] Download completes end-to-end over a throttled 3G connection with one network interruption
- [ ] Storage quota failure path shows the right error message
- [ ] Mode switch mid-session from cloud to local and back does not leak state
- [ ] `localOnly` strict mode correctly disables features when local is unavailable
- [ ] Model switch (Normal → Advanced) on desktop frees the previous model's memory
- [ ] Delete model actually frees the OPFS cache (check browser DevTools)
- [ ] Benchmark numbers are within 50% of expected values on known hardware
- [ ] Non-English journal entries produce Japanese/Chinese/Korean/Thai output that is readable and tonally appropriate
- [ ] Trend analysis local variant produces valid JSON that matches the cloud schema
- [ ] Plus gating: non-Plus users see the lock card and cannot activate local mode via dev tools manipulation of localStorage

---

## Rollback plan

If local AI causes issues after flipping the flag:

1. Flip `FEATURES.LOCAL_AI_ENABLED` back to `false` and ship a patch release.
2. The AI Settings tab reverts to the "coming soon" placeholder.
3. Cloud AI continues working normally.
4. User's downloaded models are left in the cache (harmless; 2.5 GB of dead storage until the user's browser evicts it).
5. User preferences are left in localStorage (harmless; they pick up again when the flag comes back).

Nothing in the feature modifies journal data, cloud sync, or any shared state, so rollback is pure UI.
