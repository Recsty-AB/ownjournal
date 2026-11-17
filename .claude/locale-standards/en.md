# English (en) — OwnJournal UI and legal standard

English is the source locale. Every other locale follows its meaning, so English edits must stay meaning-neutral
unless the owner decides otherwise. When a wording change would alter facts or emphasis, report it; don't ship it.
Scope: the app's src/i18n/locales/en.json and the website's src/i18n/locales/en.json (product UI and legal text;
website blog content is out of scope).

## Register and voice
- Second person ("you", "your entry"), friendly and plain, in both repos (UI and legal). US spelling everywhere,
  legal text included: analyze, license (noun and verb), defense, unauthorized, organization, canceled/canceling
  (but "cancellation"), color, behavior.
- Contractions are house style in UI and errors ("isn't", "You're", "You've"). Legal text avoids contractions.
- Active voice where possible (Apple HIG requires it for permission purpose strings).
- "Please" is used sparingly and is house style only in "Please try again" / "Please sign in" style recoveries.

## Capitalization (house style)
- Title Case for feature names in lists, plan feature rows and Help accordion titles:
  "Voice Entry", "AI Title Suggestions", "PDF & Word Export", "Activity Insights".
- Existing buttons and dialog titles are mostly Title Case ("Sign In", "Sign Out", "Reset All Data"); toasts,
  descriptions and the newer voice UI are sentence case ("Voice entry", "Cancel recording"). Do not mass-recase;
  only fix mismatches within one surface (e.g. "Sign In" next to "Sign out" in the same menu -> "Sign Out").
- Website CTAs are Title Case ("Get Started Free", "Start Free Trial", "View Pricing").
- Legal section titles are Title Case in both repos ("Account Deletion", "Sync and Device Identifier").
- In running prose (Help bodies, FAQ answers, privacy policy) feature names are lowercase ("voice entry", "trend analysis"),
  except established product names: "Plus", "Activity Insights", "Simple mode", "E2E encryption".
- Proper nouns: "Markdown" (capital M), "Privacy Policy" / "Terms of Service" when naming our documents.
- Oxford (serial) comma is house style: "Google Drive, Dropbox, or Nextcloud"; "a timestamp, and, for voice entry, ...".

## Glossary
| Concept | Use | Avoid |
|---|---|---|
| Speech-to-text feature | voice entry (prose), Voice Entry (feature name) | voice input, voice typing, speech mode |
| Action on mic button | Dictate | Record voice, Speak now |
| Converting speech | transcribe / transcription; "turned into text" in friendly copy | transcript-ify, convert audio |
| The provider | Google (Gemini) / Google's Gemini service; singular "our AI provider" | "AI providers" (only one), OpenAI (removed) |
| Subscription tier | Plus, a Plus subscription, "(Plus feature)" | Pro, Premium (in user-facing copy) |
| Journal item | entry | note, post |
| Encryption | E2E encryption / end-to-end encryption | E2EE |
| Limit | 5 minutes per recording; 200 minutes a month | quota, credits |
| Account creation (noun) | sign-up | signup |
| Reset section in Settings | "Reset All Data" in the Danger Zone (the real label) | "DELETE All Data", "Delete All" |

Platform names users know: Apple "Dictation", Google/Gboard "Voice typing", both "Microphone". We keep "Dictate" for the
button and "voice entry" for the feature.

## Tap vs. click (house rule)
- "Tap" for controls inside the OwnJournal app that exist on mobile (the app is mobile-first; one verb for all
  platforms): "Tap the + button", "Tap "Setup Help"", "Tap your profile icon".
- "Click" only for actions outside the app UI or on web/desktop-only surfaces: the Nextcloud web interface, the
  browser address bar, links in emails, the Stripe billing portal and its "Manage" entry (web only), the Apple
  sign-in popup on the web.
- "Select" for choosing an option from a list or menu ("select Export Data").

## Units, numbers, typography
- Microsoft Style Guide time abbreviations in UI: min, sec, h, ms ("{{minutes}} min left", "Stops in {{seconds}} sec",
  "{{ms}} ms"). Abbreviations take no period and are invariant for plural. Spell units out in prose ("200 minutes a month").
  Compact relative times ("{{minutes}}m ago", "Auto (15s)") are allowed in dense status UI.
- File sizes with a space: "5 MB", "20 MB".
- Compact rows may use "200 min/month"; marketing rows "200 minutes/month". Prose: "a month" (UI) / "per month" (FAQ).
- Numerals for all quantities (5 minutes, 14 days). Numeric ranges use an unspaced en dash: "24–48 hours", "30–60 seconds".
- "fewer" for countable nouns ("{{limit}} words or fewer").
- Ellipsis character "…" for every in-progress state and placeholder ("Transcribing…", "Search entries…"); never "...".
- Dashes: a spaced em dash " — " for breaks in prose and rows; never " - " or an unspaced "—". The word after the dash
  is lowercase unless it is a proper noun ("Not found — the target location doesn't exist"). Markdown syntax
  ("- lists", "- bullet point") keeps its hyphen.
- "e.g.," and "i.e.," take a comma.
- Navigation paths use "→" ("Settings → your name → iCloud", "Apps → Security").
- Straight ASCII apostrophes and quotes in JSON values. UI labels cited in text use double quotes ("Continue with Google"),
  never single quotes.

## UI microcopy
- Buttons: verb or verb + object, 1–3 words ("Retry transcription", "Discard recording", "Continue", "Not now").
- Pre-permission/consent dialog: Apple HIG says use "Continue"/"Next" for the button that leads to the system alert;
  a decline option is only acceptable because this dialog collects legal consent (sending audio to Google).
- Errors: say what happened, then what to do, in two short sentences
  ("Microphone access is blocked. Allow it in your device or browser settings to dictate.").
- Keep error/toast text under ~100 characters for phone screens.

## Permission purpose strings (iOS Info.plist, macOS extendInfo)
- Apple HIG: brief, complete, specific sentence; sentence case; active voice; ends with a period.
- The system shows it after "OwnJournal Would Like to Access the Microphone", so don't restate the request.
- Keep iOS `ios/App/App/Info.plist` and `electron-builder.json` mac.extendInfo identical.
- Never claim more than is true: OwnJournal never stores audio; Google may retain data briefly for abuse monitoring,
  so avoid an unqualified "is never stored" without a subject.

## Legal/privacy text
- GDPR vocabulary as in the official English text (EUR-Lex 32016R0679): "personal data", "controller", "processor",
  "appropriate safeguards" (Art. 46), "adequacy decision", "Standard Contractual Clauses (SCCs)", "EEA".
- Precision over brevity; no contractions; use singular when there is one provider ("our AI provider (Google)").
- Facts that must survive every edit: Plus only; audio sent to Google (Gemini) for transcription; OwnJournal stores no
  audio or transcripts; only seconds are counted; Google's paid tier does not train on the data; Google may retain data
  for a limited time for abuse monitoring.
- Date label: "Last updated: {{date}}" (sentence case, colon, date after it); the website's bare label is "Last updated".
  Dates use Month YYYY ("November 2026") for both privacy and terms, in both repos.
- The website's legal.privacy.aiProcessing.content must be byte-identical to the app's.

## Known pitfalls
- Leftover plurals after removing a provider ("AI providers (Google)", "third-party AI services").
- Mixing Title Case feature names into prose ("and Voice Entry, available…").
- British spellings creeping into legal text (analyse, licence, defence, unauthorised, cancelled).
- Help text pointing at labels that no longer exist; check the real label (e.g. storage.resetAllData) before citing it.
- The website legal pages (privacy and terms) are older and shorter than the app's; keep each internally consistent
  and flag factual divergences to the owner instead of silently aligning them.

## Sources
- Microsoft Writing Style Guide, date and time terms (unit abbreviations):
  https://learn.microsoft.com/en-us/style-guide/a-z-word-list-term-collections/term-collections/date-time-terms
- Microsoft Writing Style Guide, dashes and hyphens; ellipses; "select" vs "click"/"tap":
  https://learn.microsoft.com/en-us/style-guide/punctuation/dashes-hyphens/
  https://learn.microsoft.com/en-us/style-guide/a-z-word-list-term-collections/s/select
- Apple Human Interface Guidelines, Privacy (purpose strings, pre-alert screens):
  https://developer.apple.com/design/human-interface-guidelines/privacy
- GDPR official English text: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- House style derived from src/i18n/locales/en.json (app) and the website's src/i18n/locales/en.json.
