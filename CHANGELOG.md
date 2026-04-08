# Changelog

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
