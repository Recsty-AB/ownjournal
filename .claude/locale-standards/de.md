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
| Apple Account (formerly Apple ID, renamed 2024) | der Apple Account (Apple DE spelling, no hyphen, masculine: „mit Ihrem Apple Account“, „für Ihren Apple Account“) | Apple-ID, Apple ID, Apple-Konto, Apple-Account |
| Sign in with Apple (button/feature) | Mit Apple anmelden (Apple's official DE label) | Mit Apple-ID anmelden; "Mit Apple fortfahren" only for the Continue-with-Apple button |
| Reconnect | die Verbindung erneut herstellen / erneut verbinden (with object) | "verbinden Sie erneut" (no object) |
| Title suggestions | (KI-)Titelvorschläge | – |
| Cursor position | an der Cursorposition | – |
| per month / min | pro Monat; "Min." with number, "200 Min./Monat" in tables | min |

## 3. GDPR / legal vocabulary (official DSGVO wording)
- Consent lines: users *accept* the Nutzungsbedingungen but only *take note of* the Datenschutzerklärung
  (it is information under Art. 13 DSGVO, not a contract): „Indem Sie fortfahren, akzeptieren Sie unsere
  Nutzungsbedingungen und nehmen unsere Datenschutzerklärung zur Kenntnis.“ – never „akzeptieren Sie … die Datenschutzerklärung“.
- Average in compact chart labels/tooltips: „Ø 3,4“ (no colon after Ø).
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
- The website no longer has its own legal block (deleted on purpose); legal text lives only in the app.
- AI requests and voice recordings pass "über unsere Server" only in transit ("durchläuft unsere Server nur
  auf dem Weg zu unserem KI-Anbieter und wird nicht gespeichert"); never claim we do not process them at all.
- Refunds (website FAQ) mirror Terms `legal.terms.withdrawal`: EU/EWR consumers, website purchases only,
  14 Tage widerrufen, anteiliger Betrag bei Nutzung, App Store/Google Play erstatten Apple bzw. Google.
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
- "z. B." with a space; prices are never hard-coded: website uses "{{price}}/Jahr", "ca. {{monthly}}/Monat"
  (code formats amount + currency in de, e.g. "19,99 $"); "ca." not "~".
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
- Tap vs. click (house rule, mirrors English): in-app controls → "Tippen Sie auf …" on every platform
  (+-Schaltfläche, „Einrichtungshilfe“, „Verbinden“, Profilsymbol, „Mit Google fortfahren“). "Klicken Sie" only
  where English keeps "click": web-only surfaces (Stripe portal „Verwalten“), Nextcloud web UI, browser
  address bar, links in e-mails, Apple sign-in popup. Typing a character → "eingeben" ("Geben Sie # ein").
- Settings tabs: Speicher, Allgemein (= "Preferences"; never "Einstellungen", which is the dialog title),
  Konto, Diagnose. In prose: zum Tab „Konto“, im Abschnitt „Abonnement“, im Bereich „Gefahrenzone“.
- Cite labels exactly as the file defines them: storage.resetAllData „Alle Daten zurücksetzen“,
  storage.dangerZone „Gefahrenzone“, storage.resetButton „Alles löschen“.
- Do not quote third-party button labels (Stripe portal) – describe the action ("… in dem Sie Ihr
  Abonnement kündigen können").

## 5a. Plurals (i18next, Intl.PluralRules("de") = one, other)
- Every English `_one/_other` key needs exactly `_one` and `_other` in de; no base key, no other suffixes.
- `_one` uses the real singular with agreeing verb/adjective/pronoun: "{{count}} Eintrag ist …, migrieren
  Sie ihn", "{{count}} verschlüsselter Eintrag benötigt", "{{count}} von {{total}} Einträgen konnte nicht".
- Never "(e)", "(n)", "(s)" hedges ("Konflikt(e)", "Sicherheitspause(n)").
- Count labels are number + noun in one key ("{{count}} Eintrag" / "{{count}} Einträge"), never concatenated.

## 6. Pitfalls seen in machine-written copy
- Stray du-forms in otherwise Sie-texts ("Bitte versuche es erneut", "Genieße", "Prüfe", "Probiere",
  "Markiere", "Finde heraus"). Scan whole files for them after every batch.
- Terms agreement renders prefix + " " + termsLink + " " + and + " " + privacyLink + suffix. German uses
  "Wenn Sie fortfahren, akzeptieren Sie unsere … und …" with `auth.termsAgreementSuffix` = "" (a "zustimmen"
  construction would need suffix " zu").
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
- Apple "Apple Account" / „Mit Apple anmelden“ (DE): https://support.apple.com/de-de/HT4895 ;
  https://developer.apple.com/de/help/account/capabilities/about-sign-in-with-apple/
- Duden (spelling, Stopp, units, dashes): https://www.duden.de/sprachwissen/rechtschreibregeln
- House style: existing `src/i18n/locales/de.json` (Sie-form, KI, Plus-Abonnement, Fair-Use-Limits,
  geeignete Garantien gemäß Artikel 46 DSGVO).

## 7. Dreams glossary (dream journal and reflection)
| English | German | Avoid / source |
|---|---|---|
| Dream journal | Traumtagebuch | attested (gesundheit.gv.at, de.wikipedia) |
| Nightmare / lucid dream | Albtraum / Klartraum | Alptraum (valid, not house), luzider Traum in chips; de.wikipedia |
| Dream reflection (feature) / button | Traumreflexion / „Traum reflektieren“; status „Reflexion wird erstellt…“ | Traumdeutung (implies symbol lookup), „Wird reflektiert…“ (reads as light/physics); judgment |
| Dream patterns (card) / its report | Traummuster / Traummuster-Auswertung („Auswertung erstellen“) | Traummuster-Bericht; judgment |
| Awe / anxiety (chips, next to Angst) | Staunen / Beklemmung | Ehrfurcht (religious), Ängstlichkeit; judgment |
| Personal associations (Jung) | Einfälle | Assoziationen in UI prose; judgment |
| Waking life | Wachleben, im Wachen | judgment, dream-research usage |
| Health professional (care text) | sich ärztlich oder psychotherapeutisch beraten lassen | Gesundheitsfachkraft (calque); judgment after gesundheit.gv.at „professionelle Hilfe“ |
| Crisis line (DE/AT/CH neutral) | „wenden Sie sich an einen Krisendienst“; emergency: „rufen Sie den Notruf an“ | „an ein Krisentelefon wenden“ (one calls a phone, turns to a service); gesundheit.gv.at |
| Tokens (legal) | „den in Tokens gemessenen Umfang der genutzten KI-Verarbeitung“ | Token (as plural); Duden plural Tokens, file „OAuth-Tokens“ |
| How this works (link) | So funktioniert es | judgment (matches Help title „So funktioniert die Traumreflexion“) |
