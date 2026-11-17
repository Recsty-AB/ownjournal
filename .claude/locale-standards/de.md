# German (de) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/de.json`) and the website's UI/legal strings.
Blog prose follows the website's long-form standard
(`ownjournal_webpage/ownjournal-website/.claude/locale-standards/de.md`), which uses **du**;
that register does NOT apply to the app or the website UI.

## 1. Register and address (house style)
- **Formal "Sie"** everywhere in the app (≈430 occurrences, zero "du") and on the website UI/legal
  pages. Possessives: Ihr/Ihre, capitalised. Never mix in du-imperatives ("Finde heraus …").
- Imperatives in Sie form: "Tippen Sie auf …", "Erlauben Sie …", "Bitte melden Sie sich an …".
- Status/progress lines are impersonal: "Wird transkribiert…", "Wird synchronisiert…" – never first
  person ("Synchronisiere…", "Übertrage…", "Scanne…", "Verbinde mit …").
- Polite "Bitte" in error retries ("Bitte versuchen Sie es erneut.") – established in the file.

## 2. Glossary (term → use → avoid)
| English | German | Avoid / note |
|---|---|---|
| Voice entry (feature) | Spracheingabe | Voice Entry, Sprachtagebuch |
| Dictate (button) | Diktieren | (Apple: "Diktieren"/"Diktierfunktion") |
| Voice typing (Android) | Spracheingabe (Gboard term) | – |
| Recording | Aufnahme / Sprachaufnahme | Recording |
| Audio (noun) | Audioaufnahme, Audiodaten | "das Audio" (colloquial) |
| Transcribe / transcript | transkribieren / Transkript, Transkription | – |
| Speech (vs. language) | Gesprochenes, gesprochene Sprache | bare "Sprache" when "language" could be read |
| "your voice" (as object of transcribe) | Ihre Sprachaufnahme | "Ihre Stimme transkribieren" (calque) |
| Microphone access | Mikrofonzugriff | – |
| Tap (touch) | tippen auf | Avoid "tippen" for typing in the same sentence – use "schreiben" |
| Stop (button) | Stopp | – |
| Cancel / Discard | abbrechen / verwerfen | – |
| Continue / Not now | Weiter / Nicht jetzt | – |
| Entry | Eintrag | – |
| Tag | Tag (pl. Tags), Tag-Vorschläge | Schlagwort |
| AI | KI (KI-Funktionen, KI-Anbieter) | AI |
| Plus | Plus, Plus-Abonnement, Plus-Abonnent, Plus-Funktion | Plus-Plan |
| Subscription | Abonnement (Abo in short UI) | Subscription |
| Paid tier (API) | kostenpflichtiger Tarif | "Stufe" (calque of tier) |
| Prompts | Prompts (established in KI-Kontext) | Eingabeaufforderungen (Windows-console term) |
| Fair-use limit | Fair-Use-Limit; "zur Durchsetzung von Fair-Use-Limits" | "Begrenzung der fairen Nutzung" (inverts meaning) |
| Activity Insights | Aktivitäts-Einblicke (both repos, also as section titles) | Aktivitäten-Insights, Einblicke in Ihre Aktivitäten (as name) |
| Streaks | Serien (Stimmungsserien) | Streaks |
| Journal (product noun) | Tagebuch | Journal (only inside "OwnJournal") |
| Backup | Backup, Backup-Datei, JSON-Backup | Sicherung (as noun; verb "sichern" is fine) |
| Sync (noun) | Synchronisierung; "Sync" only in compact compounds (Cloud-Sync, Multi-Geräte-Sync) | Synchronisation |
| Simple mode | einfacher Modus (UI and legal) | Simple-Modus |
| Plus users | Plus-Abonnenten | Plus-Benutzer, Plus-Nutzer |
| Plan (pricing) | Tarif (kostenloser Tarif, Plus-Tarif) | Plan, Stufe; "Alles aus Kostenlos" → "Alles aus dem kostenlosen Tarif" |
| Service (the product) | Dienst (Tagebuchdienst, Drittanbieter-Dienste, KI-Dienst/KI-Anbieter) | Service, Tagebuchservice |
| Appearance (settings) | Darstellung | Erscheinung |
| Apple ID | Apple-ID (Apple's German spelling) | Apple ID |
| Reconnect | die Verbindung erneut herstellen / erneut verbinden (with object) | "verbinden Sie erneut" (no object) |
| Title suggestions | (KI-)Titelvorschläge | – |
| Cursor position | an der Cursorposition | – |
| per month / min | pro Monat; "Min." with number, "200 Min./Monat" in tables | min |

## 3. GDPR / legal vocabulary (official DSGVO wording)
- Privacy policy → **Datenschutzerklärung** everywhere (title, links, footer, "diese Datenschutzerklärung");
  never "Datenschutzrichtlinie" or "diese Richtlinie". Third parties' policies: "Datenschutzerklärungen".
- Data retention section → **Speicherdauer** (not a second "Datenspeicherung").
- Right of access (Art. 15) → "Recht auf **Auskunft**"; inaccurate data → "unrichtige Daten";
  complaint → "Beschwerde bei der zuständigen Datenschutz-Aufsichtsbehörde".
- collect → **erheben** (not "sammeln"); personal data → **personenbezogene Daten** (not "persönliche").
- Contact section title → "Kontakt" (matches the „Kontakt“ cross-reference in californiaRights).
- Age clause: "mindestens 13 Jahre alt sein oder das … höhere Alter der digitalen Einwilligung erreicht
  haben"; children: "nicht für Kinder unter 13 Jahren bzw. unter dem … Alter … bestimmt".
- Dates: "Monat JJJJ" ("November 2026"), label "Zuletzt aktualisiert: {{date}}" in both repos.
- Website `legal.privacy.aiProcessing.content` is a verbatim copy of the app's value.
- appropriate safeguards (Art. 46) → **geeignete Garantien** (not "angemessene Schutzmaßnahmen").
- adequacy decision (Art. 45) → **Angemessenheitsbeschluss**.
- Standard Contractual Clauses → **Standardvertragsklauseln (SCC)**; DSGVO text itself says
  "Standarddatenschutzklauseln" – either is correct, the file uses Standardvertragsklauseln.
- controller / processor → Verantwortlicher / Auftragsverarbeiter; consent → Einwilligung;
  legitimate interests → berechtigte Interessen; EEA → Europäischer Wirtschaftsraum (EWR);
  GDPR → DSGVO; data transfer → Datenübermittlung.
- "maintains safeguards" → "sichert … durch geeignete Garantien ab" / "hat … getroffen"
  (not "unterhält", a calque of "maintains").
- Purpose phrases: "zur Missbrauchsüberwachung", "zur Durchsetzung von …"; avoid passive
  infinitive calques ("um in Text umgewandelt zu werden" → "zur Umwandlung in Text").
- "resulting text" → "der daraus entstandene Text" (not "der resultierende Text").
- Legal text keeps exact facts: 5 min per recording, 200 min per month, Plus only, audio goes to
  Google (Gemini), OwnJournal stores neither audio nor transcripts, only seconds are counted, paid
  tier = no training, Google may retain data for a limited time for abuse monitoring.

## 4. Punctuation and typography
- Quotes: „…“ (house style uses „…“ already, e.g. „{{theme}}“).
- Dash: spaced en dash " – " in BOTH repos (owner decision; em dashes and " - " converted). Ranges:
  unspaced en dash ("24–48 Stunden"). Error "Title - sentence" pairs use a colon ("Speicher voll: …").
  Exception: markdown syntax in editor.* ("- Listen") stays a hyphen.
- Quotes: every quoted UI label, button name or term uses „…“ – never "…" or '…' (incl. „DELETE ALL“,
  „Mit Google fortfahren“). Product apostrophes stay (Let's Encrypt).
- Ellipsis: single character "…"; directly attached in status lines ("Wird transkribiert…"), the
  established app pattern.
- Units: number + space + unit ("10 s", "5 Minuten", "25 %", "{{rate}} %", "5 MB", "{{ms}} ms");
  "Min." works for singular and plural ("Noch 1 Min."). Relative time: "vor {{minutes}} Min.",
  "vor {{hours}} Std.", "vor {{days}} Tg." (abbreviations avoid singular/plural problems).
- "z. B." with a space; prices "99 $/Jahr", "ca. 1,67 $/Monat" (not "~").
- Compounds with multi-word names are fully hyphenated: Google-Drive-Speicher, Google-Play-Konto,
  App-Store-Konto, Apple-Developer-Konto, Google-OAuth-Token, Dropbox-Cloud-Speicher.
- Lowercase inside parentheses after a label: "(empfohlen)", "(privat)", "(kein Passwort)";
  "Ende-zu-Ende-verschlüsselt" (adjective, hyphenated, lowercase v).
- Comma before infinitive/relative clauses in labels: "Anmelden, um fortzufahren", "Alles, was Sie …".
- No serial comma: "A, B und C". Ampersand only in compact labels ("PDF- & Word-Export");
  in running text "PDF- und Word-Export".
- Hyphenated compounds with proper names/abbreviations: Gemini-Dienst, Plus-Abonnement, KI-Anbieter,
  E2E-Modus.

## 5. UI microcopy conventions
- Buttons: verb infinitive or short noun ("Diktieren", "Aufnahme verwerfen", "Weiter").
- Errors: state the problem, then the fix, Sie-form ("Der Mikrofonzugriff ist blockiert. Erlauben
  Sie ihn in den Geräte- oder Browsereinstellungen, um zu diktieren.").
- Avoid ambiguity of "Sprache" (language/speech): "keine Sprache erkannt" can mean "no language
  detected" – prefer "nichts Gesprochenes erkannt".
- Questions as dialog titles end with "?" ("Ihre Sprachaufnahme mit Google transkribieren?").
- Keep toasts under ~2 short sentences for phone width.

## 6. Pitfalls seen in machine-written copy
- Stray du-forms in otherwise Sie-texts ("Bitte versuche es erneut", "Genieße", "Prüfe", "Probiere",
  "Markiere", "Finde heraus"). Scan whole files for them after every batch.
- "auth.termsAgreementPrefix" is followed by two links in code with no suffix, so the German must not
  need a final verb: "Wenn Sie fortfahren, akzeptieren Sie unsere … und …".
- Passive of "vertrauen" ("werden von Browsern nicht vertraut") is ungrammatical → "Browser vertrauen …
  nicht" / "stufen es als nicht vertrauenswürdig ein".
- Double "tippen" (tap + type) in one sentence.
- "Sobald Sie stoppen" → "Sobald Sie die Aufnahme beenden".
- "in Ihren Eintrag kommt …" (colloquial) → "… wird in Ihren Eintrag eingefügt".
- "Limit anwenden" (calque of apply) → "Limit durchsetzen/einhalten".
- Lists that drop or invent features vs. English (check parity item by item).

## Sources
- Microsoft German localization style guide: https://aka.ms/german-styleguide
  (via https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides)
- DSGVO Art. 46 German text (“Datenübermittlung vorbehaltlich geeigneter Garantien”,
  “Standarddatenschutzklauseln”): https://dsgvo-gesetz.de/art-46-dsgvo/ ;
  official: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679
- Gboard help (German UI term "Spracheingabe", Mikrofonberechtigung):
  https://support.google.com/gboard/answer/9058584?hl=de
- Apple German UI terms "Diktieren", "Diktierfunktion", "Mikrofontaste" (Apple Support DE /
  Apple Community DE): https://communities.apple.com/de/thread/254818867
- Duden (spelling, Stopp, units, dashes): https://www.duden.de/sprachwissen/rechtschreibregeln
- House style: existing `src/i18n/locales/de.json` (Sie-form, KI, Plus-Abonnement, Fair-Use-Limits,
  geeignete Garantien gemäß Artikel 46 DSGVO).
