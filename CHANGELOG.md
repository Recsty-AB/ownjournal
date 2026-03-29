# Changelog

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
