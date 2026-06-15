# Storage Persistence Fix — Test Plan & Checklist

Covers the fix on branch `claude/user-email-review-hl8n8r`
(commit "Add persistent storage request and iCloud env-config reconnect").

## Background

WebKit browsers lose user preferences on fresh sign-ins. Reported by a user on
**DuckDuckGo** and **Safari**: encryption mode (E2E/Simple) and the iCloud sync
preference are not retained, forcing re-toggling encryption, re-setting a
password, and reconnecting iCloud each session.

Root cause: both preferences live only in user-scoped `localStorage`
(`journalEncryptionMode`, `preferred_primary_provider`) and
`navigator.storage.persist()` was never requested, so WebKit evicts them
(Safari ITP ~7-day eviction; DuckDuckGo clears site data on close).

## What the committed fix does

- `src/utils/pwa.ts` — adds `requestPersistentStorage()` (best-effort, idempotent).
- `src/main.tsx` — calls it once at bootstrap.
- `src/services/connectionStateManager.ts` — when stored iCloud credentials are
  gone, reconnects iCloud from env-only CloudKit config (`VITE_APPLE_CLOUDKIT_*`)
  reusing a surviving Apple session, **gated on**
  `PrimaryProviderStorage.get() === 'iCloud'`.

## Known limitations (do NOT claim these are fixed/verified)

- **DuckDuckGo clear-on-close is NOT fixed.** It clears cookies too, so no
  CloudKit session survives, and `persist()` is ignored.
- The iCloud reconnect is gated on `preferred_primary_provider`, which itself
  lives in evicted storage — so after a full eviction the gate reads `null` and
  the reconnect does not fire. It mainly helps a narrow Safari sub-case (ITP
  evicted localStorage but the Apple cookie survived).
- `persist()` is best-effort: Safari may deny the grant (more likely granted for
  installed/home-screen PWAs and high-engagement sites).
- All iOS browsers are WebKit underneath, so "Chrome/Firefox/DuckDuckGo on iOS"
  behave like Safari, not like their desktop namesakes.

---

## 1. Automated — runs anywhere (no browser needed)

- [ ] `npm install --legacy-peer-deps`
- [ ] `npm test` (Vitest/jsdom) — expect **793 passed**, 0 failed (126 skipped).
- [ ] `npm run build` — succeeds, no type errors.
- [ ] `npx vitest run src/utils/__tests__/pwa.persistentStorage.test.ts` — 6 pass.

These prove logic + no regression. They do **not** prove real-browser behavior.

## 2. Automated — real browser engine (Playwright, needs `cdn.playwright.dev` egress)

Run against the dev server (`npm run dev`, default port 8080/5173) using the
auth-free `/demo` route. Test in **Chromium and WebKit**.

- [ ] App boots in Chromium at `/demo` with no console errors.
- [ ] App boots in **WebKit** at `/demo` with no console errors.
- [ ] `await navigator.storage.persisted()` returns a boolean without throwing;
      `requestPersistentStorage()` was invoked at startup (check no exception).
- [ ] **Simulated eviction:** after loading, clear the scoped keys
      `u:{userId}:journalEncryptionMode` and `u:{userId}:preferred_primary_provider`
      via `localStorage.removeItem(...)`, reload, and confirm the app does not
      crash and behaves as designed (falls back to defaults gracefully).

Note: Playwright WebKit ≠ Safari-the-app. It cannot reproduce real ITP timing,
DuckDuckGo clear-on-close, or CloudKit/Apple auth.

## 3. Manual — real device (the only authoritative test for the reported bug)

Test target: the live Cloudflare Pages preview —
**https://claude-user-email-review-hl8.ownjournal.pages.dev** (no local build
needed; run these on a real Safari / DuckDuckGo device against this URL).

### Safari (macOS / iOS) — the case the fix targets
1. [ ] Sign in, set **E2E + password**, connect **iCloud**, add an entry; confirm it syncs.
2. [ ] Console: `await navigator.storage.persisted()` → **expect `true`**.
       If `false`, the fix did nothing for Safari (persist denied — try installing as a PWA).
3. [ ] Web Inspector → Storage: delete `u:{userId}:journalEncryptionMode` and
       `u:{userId}:preferred_primary_provider` (simulating eviction, Apple cookie kept).
4. [ ] Reload. **Expect:** prompts for password / reconnects iCloud rather than
       silently dropping to Simple mode with no provider.

### DuckDuckGo — the user's actual browser (expected to STILL fail)
1. [ ] Set up as above.
2. [ ] Fully close the browser (triggers clear-on-close).
3. [ ] Reopen + sign in. **Expected: still reset** — confirms this case is not fixed.
       Mitigation to verify: "fireproofing"/disabling clear-on-close retains prefs.

### Chrome / Firefox (desktop) — regression sanity
1. [ ] Set up, close, reopen → prefs persist as before (these were never the bug).

### Password re-entry (by design, all browsers)
- [ ] On a new device/browser the password must be re-entered once
      (zero-knowledge — it is never stored server-side). Mode/provider should not
      need re-toggling once the above works.

---

## Pass criteria

- Section 1 fully green = safe to ship without regression.
- Section 2 green = app works in a real engine incl. WebKit, persist runs,
  eviction is handled gracefully.
- Section 3 Safari steps green = the targeted improvement actually works on Safari.
- Section 3 DuckDuckGo failing is **expected** and must be communicated as such —
  it is a known, documented limitation, not a passed test.
