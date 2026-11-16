# Danish (da) – UI and legal localization standard for the OwnJournal app

Scope: app UI, Help, paywall, privacy/legal texts in `src/i18n/locales/da.json` (and the website's `da.json`).
For long-form blog/brand voice see the website's `.claude/locale-standards/da.md`; this file covers UI and legal copy.

## 1. Register and address
- Informal `du / dig / din / dit / dine` everywhere. Never `De / Dem / Deres`. (House style + Microsoft Danish style guide.)
- Active voice by default; passive (`-s` form or `blive` + participle) is fine in error messages so the user is not blamed (Microsoft).
- Avoid `venligst` in new strings; a plain imperative is polite in Danish (`Prøv igen.`). Existing `Prøv venligst igen` strings are tolerated.
- Questions to the user: prefer `Vil du …?` over a bare imperative with a question mark (`Transskribér …?` is not Danish). Microsoft: "Vil du …" is the neutral form; `Er du sikker på, at du vil …` only before destructive actions.

## 2. House glossary (established in da.json – keep)
| English | Danish | Avoid |
|---|---|---|
| entry | indlæg, dagbogsindlæg | innlegg (nb), oppføring (nb), entry |
| journal | dagbog | dagbok (nb), journal |
| Plus feature | Plus-funktion | Plus-funksjon (nb) |
| requires | kræver | krever (nb) |
| available | tilgængelig | tilgjengelig (nb) |
| settings | Indstillinger | Innstillinger (nb) |
| tag suggestions | tagforslag | |
| title suggestions | titelforslag | tittel (nb) |
| trend analysis | tendensanalyse (app) / trendanalyse (website) | |
| Activity Insights | Aktivitetsindsigt (app), aktivitetsindsigter (website) | |
| Photo memories | Fotominder | Fotominner (nb) |
| editor | editoren | |
| cloud storage | cloudlagring / skylagring (both in use) | |
| sign in / log in | Log ind | Logg inn (nb) |
| Cancel | Annuller | (Annullér – minority form in the file) |
| Discard | Kassér (accent: avoids reading as noun `kasser`) | |
| Try again | Prøv igen | Prøv igjen / på nytt (nb) |
| Voice entry (feature) | Stemmeinput (house term, both repos) | stemmeindtastning |
| Dictate (button) | Dikter (Apple "Dikter tekst", Google "Dikter præsentationsnoter") | |
| recording | optagelse | opptak (nb) |
| transcribe / transcription | transskribere / transskription | transkribere |
| microphone | mikrofon | |
| punctuation | tegnsætning | |
| filler words | fyldord | |
| fair use | rimelig brug | fair brug (older strings) |
| AI | AI (house style; not KI) | |

Owner decision noted: "Stemmeinput" is understandable but a hybrid. Native platform alternatives are `Diktering` (Apple, Microsoft) and `Indtaling` (Google Docs "Værktøjer > Indtaling"). Do not switch piecemeal; rename everywhere at once if chosen.

## 3. Imperatives and accents
- Microsoft: stressed `-er` imperatives normally take no accent (`rediger`, `annuller`, `dikter`). Use the accent only when the form can be misread as a noun or present tense (`kopiér`, `markér`, `sortér`, `kassér`).
- Avoid consonant-cluster imperatives (`Ændr`, `Lagr`, `Frakobl`); use synonyms (`Skift`, `Gem`, `Afbryd`).

## 4. Microcopy conventions
- Error messages: complete sentences that end with a period; include the article (`Optagelsen er for stor.`, not `For stor optagelse`). Avoid opening with `Kan ikke …`/`Kunne ikke …` in new strings (Microsoft); use `… blev ikke …`, `… mislykkedes.`
- Buttons: short verb or verb + object, no period (`Fortsæt`, `Ikke nu`, `Kassér optagelsen`).
- Progress: present tense + ellipsis character `…` with no space (`Transskriberer…`).
- Placeholders: `{{minutes}} min` / `{{seconds}} s` work for any number (unit symbol, no inflection). With words, plural forms are `minut/minutter`, `sekund/sekunder`. Avoid genitive constructions around a number (`alle {{minutes}} minutters stemmeinput` – awkward); write `alle dine {{minutes}} minutter med stemmeinput`.
- Avoid zeugma with `blive`: `bliver til tekst og indsat` mixes "become" and passive; write `omdannes til tekst, som indsættes …`.

## 5. Punctuation and typography
- Dash: spaced en-dash ` – `; never em-dash `—` (Microsoft: em-dash is not used in Danish). The app file still has legacy em-dashes; new strings use en-dash.
- Ellipsis: single character `…`.
- Comma: the file uses startkomma (comma before every subordinate clause: `viser, hvilke`, `krypteret, hvis du …`). Keep it consistent (Dansk Sprognævn allows both systems, but not mixed).
- Months and weekdays lowercase, also standalone after a label: `Sidst opdateret: november 2026`.
- Decimal comma, `kr.` with period; `pr.` (per) with period; `min` and `s` as unit symbols without period.
- Compounds are written as one word or with a hyphen before an abbreviation/brand: `Plus-abonnement`, `Gemini-API`, `PDF- og Word-eksport` (suspension hyphen).

## 6. Legal / GDPR vocabulary (Danish GDPR text, Datatilsynet)
| English | Danish |
|---|---|
| GDPR | databeskyttelsesforordningen (GDPR) – the file uses "GDPR" |
| personal data | personoplysninger |
| processing | behandling |
| controller / processor | dataansvarlig / databehandler |
| appropriate safeguards (Art. 46) | fornødne garantier (official Danish GDPR + Datatilsynet; not "passende sikkerhedsforanstaltninger") |
| adequacy decision (Art. 45) | tilstrækkelighedsafgørelse |
| Standard Contractual Clauses | standardkontraktbestemmelser (SCC'er) |
| supplementary measures | supplerende foranstaltninger |
| EEA | Det Europæiske Økonomiske Samarbejdsområde (EØS) |
| European Commission | Europa-Kommissionen |
| at your explicit request / through your explicit action | på din udtrykkelige foranledning |
| rely on (a transfer basis) | basere overførslen på (not "stole på") |
| abuse monitoring | overvågning af misbrug |
- Legal facts to preserve: Plus only; 5 min per recording; 200 min per month; audio sent to Google (Gemini) for transcription; OwnJournal never stores audio or transcripts; only seconds are counted; Google's paid tier does not train on the data; Google may retain data for a limited time for abuse monitoring.
- Prefer naming the party (`Googles modeller`) over ambiguous `deres/dennes`.
- `login` is neuter: `et sikkert login`.

## 7. Known pitfalls
- **Norwegian (bokmål) bleed** is the main risk in this file. Tells: `funksjon`, `krever`, `innlegg`, `tittel`, `igjen`, `grense nådd`, `nullstilles`, `Logg inn`, `ditt`, `neste` (da: `næste`), `veldig`, `kveld`, `lengde`, `Oppsummering`, `-minner`, `Bruk` as a button (da: `Anvend`/`Brug`), `for å` (da: `for at`).
- False friends with nb/sv: `frokost`, `grine`, `rolig`; `eventuelt` ≠ eventually; `aktuelt` ≠ actually.
- English calques: `stole på` (rely on, legal), `ved din handling`, `realisere at`, `adressere`, `baseret på en undersøgelse`.

## Sources
- Microsoft Danish style guide: https://download.microsoft.com/download/8/f/9/8f99052e-43df-49ac-a877-b8364e2331d7/dan-dnk-StyleGuide.pdf (imperative accents, error messages, en-dash, ellipsis, "Vil du …")
- Apple iPhone User Guide (da-dk), "Dikter tekst på iPhone": https://support.apple.com/da-dk/guide/iphone/iph2c0651d2/ios
- Google Docs Help (da), "Skriv og rediger med din stemme" – Indtaling: https://support.google.com/docs/answer/4492226?hl=da
- Datatilsynet, "Vejledning om overførsel til tredjelande" (april 2024): https://www.datatilsynet.dk/Media/638478180234447566/Vejledning%20om%20overf%C3%B8rsel%20til%20tredjelande.pdf (fornødne garantier, tilstrækkelighedsafgørelse, standardkontraktbestemmelser, supplerende foranstaltninger)
- GDPR, Danish text (EUR-Lex): https://eur-lex.europa.eu/legal-content/DA/TXT/?uri=CELEX:32016R0679
- Dansk Sprognævn (comma, month capitalization): https://dsn.dk / https://sproget.dk
