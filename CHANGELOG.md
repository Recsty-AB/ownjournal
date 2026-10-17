# Changelog

## v1.0.29 (Oct 16, 2026)

### Improvements
- Android release builds now use R8 code optimization, obfuscation, and resource shrinking
- Updated Capacitor to 8.5.3 for improved safe-area and keyboard handling

### Bug Fixes
- Android: headers, dialogs, drawers, notifications, and floating controls respect system bars and display cutouts with edge-to-edge enabled
- Android: system bar backgrounds follow light, dark, and paper themes, including on older WebViews and after rotation
- Removed the legacy Status Bar and Android Edge-to-Edge Support plugins identified by Google Play's deprecated-API report

### Developer Notes
- Android versionCode: `10029`; iOS build: `32`
- System bars now use AndroidX edge-to-edge and Capacitor's built-in `SystemBars`; the local `SystemChrome` plugin paints native padding without deprecated window-color APIs
- Google Play must process the new Android bundle to reassess its DEX optimization scores and diagnostics

---

## v1.0.28 (Oct 13, 2026)

### Improvements
- iOS and Android ask for a store review at most once per user, via the OS review sheet (StoreKit / Play In-App Review): only after saving a new entry, with at least 15 entries, 14+ days since the first save, while online and with no sync error in the session
- Android: "Rate OwnJournal on Google Play" link in Settings → Preferences. iOS gets the same link once an App Store URL is configured
- Web: the iCloud card explains up front that Apple blocks browser access for Apple IDs with Advanced Data Protection, and a failed Apple sign-in popup now says why instead of silently resetting
- AI analysis moved to current Gemini models; the OpenAI fallback is removed

### Bug Fixes
- Native Sign in with Apple no longer breaks with "Unacceptable audience in id_token" after the client secret is rotated: the rotation script now keeps the app bundle ID in Supabase's Apple Client IDs

### Developer Notes
- New native dependency `@capacitor-community/in-app-review` for the review prompt
- `npm run apple:secret` / `apple:secret:push` generate the Sign in with Apple client secret (an ES256 JWT that Apple caps at 6 months), and a scheduled workflow rotates it on 1 Jan / 1 Jun / 1 Nov
- Edge function changes in this release require `supabase functions deploy ai-analyze` to take effect in production

---

## v1.0.17 (Apr 26, 2026)

### Improvements
- Always-visible "New Entry" floating action button
- Wider page layout, with SEO/PWA metadata and accessibility/performance polish
- Mood stats now render an empty state when the selected date range has no data

### Bug Fixes
- Back-to-top button now appears and stays anchored near content
- Returning Plus users no longer see a "Free Plan → Plus Plan" flicker on login — subscription state applies optimistically from local cache before the network round-trip
- "Delete All" now also clears the cached entry snapshot, so previously-deleted entries cannot reappear
- Fixed Stripe webhook reading subscription period dates from the wrong field, which could cause subscription state desync

### Legal & Compliance
- Privacy Policy and Terms of Service rewritten for App Store Guideline 3.1.2 and EU Consumer Rights Directive compliance — adds subscription/auto-renewal disclosures, 14-day right of withdrawal, Apple Schedule 1 EULA terms, US state privacy rights, and accurate AI/data disclosure. Translated across all 21 languages

---

## v1.0.16 (Apr 14, 2026)

### Store Compliance
- Purchase CTAs are now hidden on iOS and Android native builds to comply with Apple App Store anti-steering rules and Google Play billing policy. Subscription status is still visible in Settings as plain text ("Plus Plan" / "Free Plan"), but upgrade and manage-subscription surfaces are only shown on web and desktop
- Added a neutral `ownjournal.app` link in Settings → Preferences → Legal so native users can still reach the website without any purchase CTA
- `handleUpgrade` and `handleManageSubscription` now short-circuit on native as defense in depth, so a stale button ref or regression cannot reach Stripe checkout or the billing portal

### Bug Fixes
- Fixed trend analysis returning English output when the UI language was set to one of 18 previously unmapped locales (Korean, German, French, Chinese, Dutch, Polish, Hindi, Thai, etc.). The edge function's language map now covers every UI locale, and BCP-47 region tags like `ja-JP` are normalized server-side. Requires redeploying the `ai-analyze` edge function
- Fixed AI tag suggestions returning zero activities on first response for some entries. The edge function now performs a targeted activities-only retry when tags were extracted successfully but activities came back empty. Requires redeploying the `ai-analyze` edge function

### Developer Notes
- Edge function changes in this release require `supabase functions deploy ai-analyze` to take effect in production

---

## v1.0.15 (Apr 13, 2026)

### Bug Fixes
- Fixed trend analysis from a previous account remaining on screen after switching to another account in the same browser — the component is now isolated per user and rejects cloud payloads that don't belong to the current user's entries
- Fixed "Apply All" in AI tag suggestions only applying tags, ignoring the suggested activities shown alongside them

### Improvements
- Added a dedicated "Apply tags" button next to the suggested tags row, mirroring the existing "Apply activities" button — "Apply All" now only appears when both tags and activities are suggested together
- Translated the new "Apply tags" label into all 17 supported languages

---

## v1.0.14 (Apr 11, 2026)

### Bug Fixes
- Fixed trend analysis not reloading after entries sync from cloud — on a second device, the analysis would remain hidden until manually regenerated
- Fixed activity suggestions missing from AI tag suggestions when cached response predated the activity feature

---

## v1.0.13 (Apr 10, 2026)

### Changes
- **Photo uploads are now free** — attach photos to journal entries without a Plus subscription

---

## v1.0.12 (Apr 9, 2026)

### Improvements
- **Mood picker readability** — mood buttons now show text always, with emoji as a supplementary visual on larger screens (previously emoji-only on mobile, which was hard to read)
- **Activity picker on mobile** — compact bottom drawer with full text labels and a 2-column grid, replacing the emoji-only pill row that was hard to decipher on small screens
- **Collapsible activity filter** — the activities filter in the timeline now folds like the tags filter, with state persisted across sessions
- **Filter order** — timeline filters reordered to Tags → Activities → Mood
- **AI activity suggestions (Plus)** — the "Suggest Tags" feature now also suggests activities from the predefined list based on entry content, shown in the same suggestion panel

### Bug Fixes
- Fixed edit button silently failing when another entry was being edited — now shows a clear toast with a "Go to editing entry" action that scrolls to the entry currently open for editing
- Fixed activity drawer state persisting across edit-mode exits (would auto-reopen next time)
- Fixed cached AI tag suggestions not re-filtering against the current tag list after changes

---

## v1.0.11 (Apr 9, 2026)

### Features
- **Indonesian language (Bahasa Indonesia)** — added as a new supported language with native-quality translations
- **Vietnamese language (Tiếng Việt)** — added as a new supported language with native-quality translations
- **Thai language (ภาษาไทย)** — added as a new supported language with native-quality translations

---

## v1.0.10 (Apr 8, 2026)

### Features
- **Emoji mood picker** — mood buttons now show emoji faces (😄😊😐😟😢) with text on desktop, emoji-only on mobile
- **Activity tagging** — tag entries with what you were doing (exercise, social, work, meditation, etc.) from 15 predefined activities or create custom ones
- **Mood calendar heatmap** — month-view calendar where each day is colored by your mood, with navigation and tooltips
- **Mood statistics dashboard** — interactive charts showing mood distribution, trends over time, day-of-week patterns, and mood streaks
- **Activity insights (Plus)** — discover which activities correlate with better or worse moods via a visual correlation chart

### Improvements
- Mood emojis shown in timeline filters, entry badges, and PDF/Word exports
- Activity filtering added to timeline alongside existing mood and tag filters
- Help center updated with documentation for all new mood tracking features
- Updated FAQ to include Activity Insights in Plus feature list

### Bug Fixes
- Fixed entry body disappearing when switching to edit mode after import (stale state from startup snapshot cache)

---

## v1.0.8 (Apr 5, 2026)

### Features
- **Brazilian Portuguese (pt-BR)** — added as the 18th supported language, with natural Brazilian vocabulary, grammar, and nuances distinct from European Portuguese

### Improvements
- **14-day free trial** — extended from 10 days to give more time to explore Plus features
- **iOS OAuth fix** — Google and Apple sign-in now work reliably on iOS via Universal Links
- **Cleaner Android experience** — Apple Sign-In and iCloud storage options are hidden on Android, where they are not supported

### Bug Fixes
- Fixed OAuth redirect not returning to the app on iOS native (added Universal Links and URL scheme support)
- Fixed duplicate OAuth callback handling code (consolidated into shared helper)

---

## v1.0.7 (Apr 4, 2026)

### Features
- **14-day free trial** — try all Plus features free for 14 days before subscribing
- Trial status banner with days remaining countdown
- Translated trial UI into all 17 supported languages

---

## v1.0.6 (Mar 29, 2026)

### Improvements
- Camera hardware no longer required — app can now be installed on devices without a camera

---

## v1.0.5 (Mar 29, 2026)

### Features
- **Apple Sign-In** — sign in with your Apple ID
- **iCloud sync** — new storage option using iCloud with automatic conflict resolution
- **Instant startup** — journal list appears immediately on launch instead of waiting for decryption
- **Open source** — OwnJournal is now open source under the AGPL-3.0 license

### Bug Fixes
- Fixed false "network error checking key" message when reconnecting to Google Drive
- Fixed minor wording on encryption screens

---

## v1.0.4 (Feb 24, 2026)

### Bug Fixes
- Fixed encryption key being deleted during cloud-to-cloud storage transfer

---

## v1.0.3 (Feb 23, 2026)

### Features
- Reveal password option on password fields
- Snapshot-based sync compaction for faster, more reliable syncing

### Improvements
- Faster sync speed (~5x improvement)
- Per-user data isolation — multiple accounts on the same device no longer leak data between users
- Clearer error messages for encryption key mismatches and decryption failures
- Improved Nextcloud E2E setup guidance

### Bug Fixes
- Fixed E2E decryption failures when setting up encryption then syncing to Google Drive
- Fixed deleted entries reappearing after cross-provider transfer
- Fixed cloud entries still showing after "Reset All Data"
- Fixed E2E password re-prompt appearing unnecessarily after OAuth sign-in
- Fixed Google Drive entries reappearing after delete
- Fixed "Sign in failed" flash during Google OAuth
- Fixed sign-out errors and storage provider not being remembered across sessions
- Fixed "Failed to get master key after initialization" on first E2E password set
- Fixed Dropbox and Nextcloud entry retrieval issues
- Fixed first-time sync completing with 0 entries

---

## v1.0.2 (Feb 18, 2026) — First Android Release

### Features
- Encrypted journaling with E2E encryption (AES-256-GCM) or simple mode
- Cloud sync with Google Drive, Dropbox, and Nextcloud
- Offline support with automatic sync when back online
- AI-powered journal analysis (sentiment, summaries) running client-side
- 18 languages supported
- Data import/export
- Markdown editor

### Highlights
- Floating scroll navigation button
- Localized journal dates across the UI
- Warning shown before re-running AI analysis

### Bug Fixes
- Fixed offline sync — entries now sync reliably after airplane mode
- Fixed sync button doing nothing until app restart
- Fixed offline-deleted entries reappearing after sync
- Fixed entry ordering in the journal list
- Fixed Google Sign-In flow
- Fixed Android App Links (assetlinks.json)
- Fixed Japanese and other translation issues
