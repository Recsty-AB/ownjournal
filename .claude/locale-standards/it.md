# Italian (it) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/it.json`) and the website's UI/legal strings
(`ownjournal_webpage/ownjournal-website/src/i18n/locales/it.json`). Blog and long-form prose follow
the website's editorial standard (`ownjournal-website/.claude/locale-standards/it.md`). Both use
informal **tu**, so the register is the same, but the editorial rules (connectors, citations,
«caporali») apply to articles, not to UI microcopy. One term per concept across both repos. The
app's term wins unless it is wrong.

## 1. Register and address (house style)
- Informal **tu** everywhere, in product UI and legal text in both repos. Never formal Lei/Sua, never voi.
- Buttons and instructions use the tu imperative: "Detta", "Riprova", "Continua", "Tocca …".
- Status and progress lines are nominal plus "…": "Caricamento…", "Trascrizione in corso…". Add
  "in corso" when the bare noun could be read as a verb or label ("Modifica in corso…", not "Modifica…").
- Never "Per favore", "Si prega" or "ti preghiamo". Write the imperative ("Riprova.", "Tieni aperta…").
- Do not open sentences with "Questo eliminerà / rimuoverà …" (a calque of "This will"). Use the
  passive future: "Verranno eliminate definitivamente…", "L'abbonamento verrà annullato…".
- Avoid "con successo" (calque): "Disconnessione effettuata", "Voce rimossa.", "Password cambiata."

## 2. Glossary (term → use → avoid)
| English | Italian | Avoid / note |
|---|---|---|
| Entry (journal) | **voce** (voce del diario, pl. voci) | nota (= Notes feature), annotazione |
| Voice entry | **Dettatura vocale** | Inserimento vocale |
| AI | **IA** in both repos, UI and legal: "Analisi IA", "funzionalità di IA", "modelli di IA", "servizio di IA", "provider di IA", "basato sull'IA", "l'IA", "elaborazione tramite IA" | AI (English acronym). Italian norm: Treccani, EU AI Act (it) "IA" |
| Encrypt / decrypt / encryption | **crittografare / decrittografare / crittografia** (Microsoft term), also in legal | cifrare, decifrare, cifratura (mixing) |
| Failed (status) | **non riuscito/a** ("Connessione non riuscita") | fallito/a (calque) |
| Failures (metrics) | **errori** ("Tasso di errori", "Errori recenti") | fallimenti |
| Storage | **archiviazione** ("archiviazione cloud", "provider di archiviazione") | storage, cloud storage |
| Connect (storage) | **connettere / Connetti** | collegare (in the website, mixed) |
| Tap (touch UI) / click (browser, email, web portal) | **Tocca** / **fai clic su** | Clicca, premi |
| Plus member / Plus users | **abbonato Plus / abbonati Plus** | membro Plus, utenti Plus |
| Plus feature | **Funzionalità Plus** | Funzione Plus |
| Free plan | **piano gratuito**; pricing card and column header **Gratuito** | piano Gratis, "Tutto in Gratis" |
| Upgrade to Plus | **Passa a Plus** | Fai l'upgrade |
| Cancel subscription | **annullare / annullamento** (Apple and Google Italia), also in Terms | cancellare/cancellazione (used only for data erasure) |
| Danger Zone | **Zona pericolosa** | Zona pericolo |
| Mood tracking | **Monitoraggio dell'umore** | Tracciamento umore |
| Activity tagging | **Etichette attività** | Etichettatura attività |
| Activity Insights | **Analisi delle attività** | Analisi attività |
| Trend analysis | **Analisi delle tendenze** | Analisi dei trend, Analisi tendenze |
| Patterns | **schemi ricorrenti** | pattern (bare loanword) |
| Mood levels | Ottimo, Buono, Così così, **Cattivo**, Pessimo (both repos) | Scarso, Fantastico/Bene/Male |
| Zero knowledge | **zero-knowledge** (lower case, hyphenated; "Architettura zero-knowledge") | Zero Knowledge |
| Simple mode | **modalità semplice** (also in legal) | modalità Simple |
| Email | **email** (un'email) | e-mail |
| Support (contact) | **assistenza** ("Contatta l'assistenza") | supporto |
| Resets (monthly quota) | **si rinnova** ("Si rinnova il mese prossimo") | si reimposta, si azzera |
| Paid tier | **piano a pagamento** | livello a pagamento |
| Payment processor | **gestore dei pagamenti** | processore di pagamento |
| Legal (section) | **Note legali** | Legale |
| Recording / speech | registrazione / parole, ciò che dici | "la tua voce" (clashes with voce = entry) |
| Filler words | intercalari | parole riempitive |
| Fair-use limits | limiti di uso corretto | criteri di equità |

**voce/voce pitfall:** "voce" means both entry and voice. Never write "la tua voce" for the
user's speech ("trasforma le tue parole in testo"). Always say "voce del diario" near voice vocabulary.

## 3. GDPR and legal vocabulary (official Italian RGPD wording)
- GDPR → GDPR (house style); article references in lower case: "ai sensi dell'articolo 37 del GDPR".
- Legal basis → **base giuridica del trattamento**. The bases are **esecuzione del contratto**,
  **legittimo interesse** (Art. 6(1)(f)) and **consenso**, written in lower case inside the list.
- Rights: "accedere ai tuoi dati, riceverli in un formato portabile (portabilità), ottenere la
  **rettifica**, ottenere la **cancellazione**, chiedere la **limitazione del trattamento**,
  **opporti** al trattamento, **proporre reclamo all'autorità di controllo**".
- Personal-data processing → **trattare / trattamento**. Technical AI processing → "elaborazione tramite IA".
- controller / processor → titolare del trattamento / responsabile del trattamento.
- DPO → "Responsabile della protezione dei dati (DPO)".
- appropriate safeguards → **garanzie adeguate**; adequacy decision → **decisione di adeguatezza**.
- Standard Contractual Clauses → **clausole contrattuali tipo (CCT)**, lower case in both repos.
- EEA → **Spazio economico europeo (SEE)**; never "EEA" and never "Spazio Economico Europeo".
- material changes / breach → **modifiche sostanziali / violare in modo sostanziale** (not "materiale").
- gross negligence, wilful misconduct → **colpa grave, dolo**. Mandatory rights → **diritti imperativi**.
- Severability → "Clausola di salvaguardia". Terminate an account → "chiudere l'account".
- Google is singular: "la sua API", "il nostro provider di IA".
- `legal.privacy.aiProcessing.content` must be **identical** in app and website. Edit the app first, then copy it.
- Facts must stay unchanged: 5 min per recording, 200 min per month, Plus only, audio goes to Google
  (Gemini), OwnJournal stores neither audio nor transcripts, only seconds are counted, Google's
  paid tier does not train on the data, and Google may keep data briefly for abuse monitoring.

## 4. Punctuation and typography (both whole files)
- No space before `: ; ? !`. After a colon inside a sentence, continue in lower case
  ("Suggerimento: puoi…", "Mobile (Android/iOS): i file…"). Numbered headings ("Passaggio 1: Trova…")
  and product prefixes ("Plus: Suggerisci tag") keep the capital.
- Ellipsis: always "…" (U+2026), attached to the word. Never "...".
- Dash: spaced em dash " — " for asides and "title — explanation" error messages, followed by lower
  case ("Non trovato — la posizione di destinazione non esiste"). No spaced hyphen " - " and no
  unspaced "—". Ranges use a hyphen ("24-48 ore", "30-60 secondi"). Note: Microsoft's Italian guide
  prescribes a spaced hyphen instead of an em dash. That is a deliberate house deviation for
  typographic correctness, consistent with the website.
- Quotes: straight double quotes for UI labels and button names (Tocca "Gestisci"), escaped in
  JSON. No single-quoted labels (code such as `'always'` is unchanged). «…» only in editorial prose.
- Apostrophe: ASCII ' everywhere (no ’).
- Units: number, space, unit: "5 MB", "15 s", "{{ms}} ms", "{{minutes}} min fa", "{{hours}} h fa".
  Prices: "19,99 $", "0 $", "circa 1,67 $/mese", "99 $/anno".
- Dates in legal texts: lower-case month plus year ("novembre 2026", "aprile 2026"), the same in
  privacy and terms in both repos. Label: "Ultimo aggiornamento: {{date}}".
- No serial comma ("A, B e C"); "ed" before a vowel ("ed esportazione").

## 5. UI microcopy conventions
- Sentence case for every title, label, button and legal heading in both repos ("Inizia gratis",
  "Vedi prezzi", "Ultimo aggiornamento", "Termini di servizio", "Informativa sulla privacy").
  Proper nouns and acronyms keep their capitals.
- Errors: problem first, then remedy. Put the purpose clause first ("Per dettare, consentilo…").
- Placeholder grammar: Italian has no plural forms in these files, so avoid agreement with
  `{{count}}`, `{{minutes}}` or `{{seconds}}`. Use the label pattern: "Conflitti registrati: {{count}}.",
  "Voci non migrate: {{count}}", "Ancora {{minutes}} min questo mese". Never use "conflitto/i".
- Placeholder sentence subjects that refer to entries or notes agree in the feminine
  ("Salvata localmente. Verrà sincronizzata…").
- Dialog titles are questions with an infinitive: "Trascrivere la registrazione con Google?".
- "Pattern", "workflow", "storage" and "upgrade" are not acceptable bare loanwords in UI text. "Prompt",
  "output", "backup", "log", "token", "provider", "self-hosted" and "mirroring" are acceptable.
- Keep `{{placeholders}}`, URLs, HTML/markdown, shortcuts and product names unchanged.

## Sources
- Microsoft Italian style guide (capitalization, months lower case, dashes, ellipsis, quotes):
  https://download.microsoft.com/download/f/f/7/ff70427c-1f7e-429f-96be-724d2e49cd47/ita-ita-StyleGuide.pdf
- Microsoft style guides index: https://learn.microsoft.com/it-it/globalization/reference/microsoft-style-guides
- Apple Italia, "Dettatura": https://support.apple.com/it-it/127070
- GDPR (Regolamento (UE) 2016/679), Italian text, Art. 6, 15-21, 37, 46: https://gdpr-text.com/it/read/article-46/
- Decision (UE) 2021/914, "clausole contrattuali tipo": https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=it
- Garante privacy, trasferimento di dati all'estero: https://www.garanteprivacy.it/it/temi/trasferimento-di-dati-all-estero
- Website editorial standard: ownjournal-website/.claude/locale-standards/it.md
