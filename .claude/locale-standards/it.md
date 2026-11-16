# Italian (it) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/it.json`) and the website's UI/legal strings
(`ownjournal_webpage/ownjournal-website/src/i18n/locales/it.json`). Blog and long-form prose follow
the website's editorial standard (`ownjournal-website/.claude/locale-standards/it.md`); both use
informal **tu**, so the register is the same, but the editorial rules (connectors, citations,
«caporali») are for articles, not UI microcopy.

## 1. Register and address (house style)
- Informal **tu** everywhere (app and website): "Tocca il microfono", "il tuo diario", "Accedi".
  Never formal Lei/Sua; never voi.
- Imperatives in tu form for buttons and instructions: "Detta", "Riprova", "Continua", "Accedi".
- Status/progress lines are nominal: "Trascrizione in corso…", "Sincronizzazione in corso...".
- Retry hint after an error: short "Riprova." (≈40 uses in the app); no "Per favore".

## 2. Glossary (term → use → avoid)
| English | Italian | Avoid / note |
|---|---|---|
| Entry (journal) | **voce** (voce del diario, pl. voci) – house term, 200+ uses | nota (= Notes feature), annotazione |
| Voice entry (feature) | **Dettatura vocale** (app + website, sentence case) | Inserimento vocale, Voice entry, "voce vocale" |
| Dictate (button) | Detta | (Office/Word "Detta"; Apple "Dettatura") |
| Voice typing (Android) | Digitazione vocale (Gboard) | – |
| Recording | registrazione | – |
| Speech (as object) | parole, ciò che dici | "la tua voce" when "voce" (= entry) is nearby |
| Transcribe / transcription | trascrivere / trascrizione | – |
| Microphone access | accesso al microfono | – |
| Tap | toccare ("Tocca …") | premere/cliccare on touch UI |
| Stop / Cancel / Discard | Interrompi / Annulla / Elimina | – |
| Retry (action label) | Ripeti la trascrizione / Riprova | "Riprova la trascrizione" (riprovare + object = try on) |
| Continue / Not now | Continua / Non ora | – |
| Clean, punctuated text | testo pulito e ben punteggiato | "testo punteggiato" alone (= dotted) |
| Filler words | intercalari | parole riempitive |
| Plus | Plus, abbonamento Plus, abbonati Plus, (Funzionalità Plus) | piano Plus Premium |
| Subscription | abbonamento | subscription |
| AI | app UI labels: **AI** ("Analisi AI"); legal/privacy and website: **IA** | mixing within one sentence |
| Paid tier (API) | piano a pagamento | livello a pagamento (calque of "tier") |
| Prompts / outputs | prompt e output (invariable) | – |
| Fair-use limits | limiti di uso corretto | "secondo criteri di equità" (vague) |
| Activity Insights | Analisi delle attività | – |
| Resets (monthly quota) | si rinnova | si azzera (the limit is not zeroed) |
| Cursor position | nel punto in cui si trova il cursore | nel punto del cursore |
| min / per month | "{{minutes}} min" invariable; "200 min/mese" in tables, "200 minuti al mese" in prose | – |

**Pitfall – voce/voce:** "voce" is both "entry" and "voice". In voice-feature strings never write
"la tua voce" for the user's speech; say "la registrazione", "le tue parole", "ciò che dici", and
always qualify entry as "voce del diario" next to voice vocabulary.

## 3. GDPR / legal vocabulary (official Italian RGPD wording)
- GDPR → GDPR (house style; official: RGPD / Regolamento (UE) 2016/679).
- appropriate safeguards (Art. 46) → **garanzie adeguate** (not "salvaguardie appropriate").
- adequacy decision (Art. 45) → **decisione di adeguatezza**.
- Standard Contractual Clauses → **clausole contrattuali tipo (CCT)** (Decision (UE) 2021/914 and
  the Garante); avoid "Clausole Contrattuali Standard". App file capitalises "Clausole contrattuali
  tipo"; website writes it lower case – keep each file's form.
- EEA → **Spazio economico europeo (SEE)**; never "EEA" in Italian text.
- controller / processor → titolare del trattamento / responsabile del trattamento;
  consent → consenso; legitimate interest → legittimo interesse; data transfer → trasferimento.
- "maintains safeguards" → "adotta garanzie adeguate" (not "mantiene", a calque).
- "the resulting text" → "il testo ottenuto" (not "il testo risultante").
- Google is singular: "tramite la sua API" (not "la loro"); "provider di IA (Google)" singular.
- Facts must survive verbatim: 5 min per recording; 200 min per month; Plus only; audio is sent to
  Google (Gemini); OwnJournal stores neither audio nor transcripts; only seconds are counted;
  Google's paid tier does not train on the data; Google may retain data for a limited time for
  abuse monitoring.

## 4. Punctuation and typography
- No space before `: ; ? !`.
- Ellipsis: the app mostly uses "..." (legacy, ~100) but new strings use "…" (U+2026), attached:
  "Trascrizione in corso…". Do not mass-convert old strings.
- Dashes: spaced em dash " — " is the dominant form in both files (website lists: "Dettatura
  vocale — 200 minuti al mese"). Spaced en dash only in two legacy Nextcloud strings.
- Quotes: straight "…" escaped in JSON for UI; «…» only in editorial prose.
- Apostrophe: the JSON files use ASCII ' consistently; keep it in UI strings (house style).
- Units: number + space + unit ("10 s", "5 minuti", "200 min/mese"); decimal comma; prices "19,99 $".
- Months and languages are lowercase in running text. Standalone "lastUpdatedDate" values are
  capitalised in both repos ("Novembre 2026", "Dicembre 2024") – house style, keep consistent.
- No serial comma: "A, B e C"; before a vowel "ed" ("ed esportazione").
- No ampersand in prose; "PDF e Word".

## 5. UI microcopy conventions
- Sentence case for titles and labels ("Dettatura vocale", not "Dettatura Vocale"); some legacy
  website labels use title case ("Inizia Gratis") – don't spread it.
- Buttons: imperative or short noun phrase ("Detta", "Elimina registrazione", "Non ora").
- Errors: problem first, then remedy ("L'accesso al microfono è bloccato. Per dettare,
  consentilo nelle impostazioni del dispositivo o del browser."). Put the purpose clause first,
  not trailing ("… del browser per dettare" is English order).
- Placeholders: avoid adjective/verb agreement with `{{minutes}}`/`{{seconds}}` (no plural forms
  exist in the files): "Ancora {{minutes}} min questo mese", not "{{minutes}} min rimanenti"
  ("1 min rimanenti" is wrong).
- Dialog titles as questions with infinitive: "Trascrivere la registrazione con Google?".

## Sources
- Microsoft Italian style guide: https://learn.microsoft.com/it-it/globalization/reference/microsoft-style-guides
- Apple Italia, "Migliora Siri e Dettatura" (term "Dettatura"): https://support.apple.com/it-it/127070
- Gboard "Digitazione vocale" (Italian press usage): https://www.tuttoandroid.net/news/2024/08/09/gboard-digitazione-vocale-1054529/
- GDPR Art. 46 (Italian text): https://gdpr-text.com/it/read/article-46/ and EUR-Lex Regolamento (UE) 2016/679
- Decision (UE) 2021/914, "clausole contrattuali tipo": https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=it
- Garante privacy, trasferimento di dati all'estero: https://www.garanteprivacy.it/it/temi/trasferimento-di-dati-all-estero
- Website editorial standard (brand voice, tu register, typography): ownjournal-website/.claude/locale-standards/it.md
