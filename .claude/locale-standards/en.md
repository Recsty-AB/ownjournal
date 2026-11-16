# English (en) — OwnJournal UI and legal standard

English is the source locale. Every other locale follows its meaning, so English edits must stay meaning-neutral
unless the owner decides otherwise. When a wording change would alter facts or emphasis, report it; don't ship it.

## Register and voice
- Second person ("you", "your entry"), friendly and plain. US spelling (color, organize, canceled, license as noun/verb).
- Contractions are house style in UI and errors ("isn't", "You're", "You've"). Legal text avoids contractions.
- Active voice where possible (Apple HIG requires it for permission purpose strings).
- "Please" is used sparingly and is house style only in "Please try again" / "Please sign in" style recoveries.

## Capitalization (house style)
- Title Case for feature names in lists, plan feature rows and Help accordion titles:
  "Voice Entry", "AI Title Suggestions", "PDF & Word Export", "Activity Insights".
- Sentence case for UI chrome: toasts, popover headings, buttons, dialog titles ("Voice entry", "Cancel recording").
- In running prose (Help bodies, FAQ answers, privacy policy) feature names are lowercase ("voice entry", "trend analysis"),
  except established product names: "Plus", "Activity Insights", "Simple mode", "E2E encryption".
- Oxford (serial) comma is house style: "title suggestions, tag suggestions, voice entry, and PDF/Word export".

## Glossary
| Concept | Use | Avoid |
|---|---|---|
| Speech-to-text feature | voice entry (prose), Voice Entry (feature name) | voice input, voice typing, speech mode |
| Action on mic button | Dictate | Record voice, Speak now |
| Converting speech | transcribe / transcription; "turned into text" in friendly copy | transcript-ify, convert audio |
| The provider | Google (Gemini) / Google's Gemini service | Gemini AI by Google, OpenAI (removed) |
| Subscription tier | Plus, a Plus subscription, "(Plus feature)" | Pro, Premium (in user-facing copy) |
| Journal item | entry | note, post |
| Encryption | E2E encryption / end-to-end encryption | E2EE |
| Limit | 5 minutes per recording; 200 minutes a month | quota, credits |

Platform names users know: Apple "Dictation", Google/Gboard "Voice typing", both "Microphone". We keep "Dictate" for the
button and "voice entry" for the feature.

## Units, numbers, typography
- Microsoft Style Guide time abbreviations in UI: min, sec, h, ms ("{{minutes}} min left", "Stops in {{seconds}} sec").
  Abbreviations take no period and are invariant for plural. Spell units out in prose ("200 minutes a month").
- Compact rows may use "200 min/month"; marketing rows "200 minutes/month". Prose: "a month" (UI) / "per month" (FAQ).
- Numerals for all quantities (5 minutes, 14 days).
- Ellipsis character "…" for in-progress states ("Transcribing…").
- Dashes: house style is a spaced em dash " — " in feature rows and prose.
- Straight ASCII apostrophes and quotes in JSON values (dominant house style; two stray curly ones exist in subscription.iap*, outside this review).

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
- "Last updated" uses Month YYYY ("November 2026").

## Known pitfalls
- Leftover plurals after removing a provider ("AI providers (Google)").
- Mixing Title Case feature names into prose ("and Voice Entry, available…").
- Over-promising claims (e.g. "even if you switch languages mid-sentence") — flag to the owner rather than soften
  unilaterally, since all locales mirror English.
- App and website privacy policies describe voice entry differently (website mentions the server relay and
  `store: false`); keep each internally consistent, and flag divergences.

## Sources
- Microsoft Writing Style Guide, date and time terms (unit abbreviations):
  https://learn.microsoft.com/en-us/style-guide/a-z-word-list-term-collections/term-collections/date-time-terms
- Apple Human Interface Guidelines, Privacy (purpose strings, pre-alert screens):
  https://developer.apple.com/design/human-interface-guidelines/privacy
- GDPR official English text: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- House style derived from src/i18n/locales/en.json (app) and the website's src/i18n/locales/en.json.
