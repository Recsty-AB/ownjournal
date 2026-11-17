# Danish (da) – UI and legal localization standard for the OwnJournal app

Scope: app UI, Help, paywall, privacy/legal texts in `src/i18n/locales/da.json` (and the website's `da.json`).
For long-form blog/brand voice see the website's `.claude/locale-standards/da.md`; this file covers UI and legal copy.

## 1. Register and address
- Informal `du / dig / din / dit / dine` everywhere, product UI and legal text, both repos. Never `De / Dem / Deres`. (House style + Microsoft Danish style guide.) `bedes du` (website legal) is tolerated; it is not a different address form.
- Active voice by default; passive (`-s` form or `blive` + participle) is fine in error messages so the user is not blamed (Microsoft).
- Avoid `venligst` in new strings; a plain imperative is polite in Danish (`Prøv igen.`). Existing `Prøv venligst igen` strings are tolerated.
- Instructions with a condition: `Hvis problemet fortsætter, kan du prøve at …` (not `…, prøv at …`). `Når du har logget ind, skal du klikke …` (not `Efter at have logget ind, klik …`).
- Questions to the user: prefer `Vil du …?` over a bare imperative with a question mark (`Transskribér …?` is not Danish). Microsoft: "Vil du …" is the neutral form; `Er du sikker på, at du vil …` only before destructive actions.

## 2. House glossary (established in da.json – keep)
| English | Danish | Avoid |
|---|---|---|
| entry | indlæg, dagbogsindlæg | innlegg (nb), oppføring (nb), indgang, post(er), entry |
| journal | dagbog | dagbok (nb), journal |
| Plus feature | Plus-funktion | Plus-funksjon (nb) |
| requires | kræver | krever (nb) |
| available | tilgængelig | tilgjengelig (nb) |
| settings | Indstillinger | Innstillinger (nb) |
| tag / tags | tag / tags (also as label: `Tags`) | Etiketter, emner, emneknagger, tag-forslag |
| tag suggestions | tagforslag | |
| title suggestions | titelforslag | tittel (nb) |
| trend analysis | Tendensanalyse / tendensanalyse (both repos) | Trendanalyse |
| Activity Insights (feature name) | Aktivitetsindsigt (capitalized, singular, both repos) | aktivitetsindsigter, Indsigt per aktivitet |
| activity tagging | Aktivitetsmarkering | Aktivitetsmærkning |
| mood tracking | Humørsporing (`Humørsporing med emoji`) | Humørlog |
| zero knowledge | Zero Knowledge; `Zero Knowledge-arkitektur` (title), `zero knowledge-arkitektur` (running text) | Nul viden |
| backup | sikkerhedskopi, sikkerhedskopiering; `Eksport af JSON-sikkerhedskopi` | backup, JSON-backup-eksport |
| self-hosted | selvhostet, `hoste selv`, selvhosting | self-hostet, self-hoste |
| password manager | adgangskodeadministrator | password manager, adgangskodemanager |
| danger zone | Farezone | Fareområdet |
| Photo memories | Fotominder | Fotominner (nb) |
| editor | editoren | |
| cloud storage / cloud provider | skylagring, skyudbyder, skyfiler (both repos) | cloudlagring, cloud-lagring, cloudlager, cloududbyder |
| connect (button) | `Tilslut Google Drive` (direct object) | `Tilslut til …` |
| connect to (running text) | `opret forbindelse til …` | `tilslut til …` |
| connected to X (status/toast) | `Forbundet til Google Drive` | `Tilsluttet til …` |
| offline | offline (`Du er offline`) | frakoblet |
| Support (tab) | Support | Støtte |
| sign in / log in | Log ind | Logg inn (nb) |
| Cancel | Annuller | (Annullér – minority form in the file) |
| Discard | Kassér (accent: avoids reading as noun `kasser`) | |
| Try again | Prøv igen | Prøv igjen / på nytt (nb) |
| Voice entry (feature) | Diktering (owner decision 2026-11, both repos; Apple/Microsoft term) | Stemmeinput, stemmeindtastning |
| Dictate (button) | Dikter (Apple "Dikter tekst", Google "Dikter præsentationsnoter") | |
| recording | optagelse | opptak (nb) |
| transcribe / transcription | transskribere / transskription | transkribere |
| microphone | mikrofon | |
| punctuation | tegnsætning | |
| filler words | fyldord | |
| fair use | rimelig brug | fair brug (older strings) |
| AI | AI (house style; not KI) | |
| Simple mode | simpel tilstand (lowercase mid-sentence, also in legal text) | Simple-tilstand |
| Google Drive | Google Drive (product name, never translated) | Google Drev |

Owner decision (2026-11): the feature is `Diktering` everywhere in both repos (`Diktering kræver et Plus-abonnement`, `minutter med diktering`). `Stemmeinput` is retired.
One term per concept across both repos; the app's term wins unless it is wrong.

## 3. Imperatives and accents
- Microsoft: stressed `-er` imperatives normally take no accent (`rediger`, `annuller`, `dikter`, `aktiver`, `deaktiver`, `filtrer`, `dekrypter`). Use the accent only when the form can be misread as a noun or present tense (`kopiér`, `markér`, `notér`, `sortér`, `kassér`). House: always `Kopiér`, always `Annuller`.
- Avoid consonant-cluster imperatives (`Ændr`, `Lagr`, `Frakobl`); use synonyms (`Skift`, `Gem`, `Afbryd`).

## 4. Microcopy conventions
- Error messages: complete sentences that end with a period; include the article (`Optagelsen er for stor.`, not `For stor optagelse`). Avoid opening with `Kan ikke …`/`Kunne ikke …` in new strings (Microsoft); use `… blev ikke …`, `… mislykkedes.`
- Buttons: short verb or verb + object, no period (`Fortsæt`, `Ikke nu`, `Kassér optagelsen`).
- Progress: present tense + ellipsis character `…` with no space (`Transskriberer…`).
- Placeholders: `{{minutes}} min` / `{{seconds}} s` work for any number (unit symbol, no inflection). With words, plural forms are `minut/minutter`, `sekund/sekunder`. Avoid genitive constructions around a number (`alle {{minutes}} minutters stemmeinput` – awkward); write `alle dine {{minutes}} minutter med stemmeinput`.
- Avoid zeugma with `blive`: `bliver til tekst og indsat` mixes "become" and passive; write `omdannes til tekst, som indsættes …`.

## 5. Punctuation and typography
- Dash: spaced en-dash ` – `; never em-dash `—` and never a spaced hyphen ` - ` as a dash (Microsoft). Both files are clean (2026-11). After a dash in an error message continue in lowercase (`Ikke fundet – målplaceringen findes ikke`). Exception: Markdown syntax hints (`- lister`).
- Ranges: unspaced en-dash (`24–48 timer`, `30–60 sekunder`).
- Ellipsis: single character `…` everywhere (both files clean).
- Quotation marks: straight double quotes `"…"` (Microsoft Danish style guide: "straight double quotation marks"), also around UI labels: `Klik på "Administrer"`. No single quotes as quotation marks; apostrophes stay (`URL'en`, `SCC'er`, `AI'en`).
- Percent and units: space before `%` and units (`100 %`, `{{percent}} %`, `5 MB`, `{{ms}} ms`, `15 s`). Relative time: `for {{minutes}} min siden`, `for {{hours}} t siden`, `for {{days}} d siden`.
- `&` only in quoted third-party UI labels (`Enheder & sessioner` in Nextcloud); otherwise `og`.
- `per` → `pr.` (`pr. ugedag`, `pr. indlæg`). `+-knappen`, `{{tag}}-blokken` (hyphen after a symbol/placeholder in a compound).
- Comma: the file uses startkomma (comma before every subordinate clause: `viser, hvilke`, `krypteret, hvis du …`). Keep it consistent (Dansk Sprognævn allows both systems, but not mixed).
- Months and weekdays lowercase, also standalone after a label: `Sidst opdateret: november 2026`. Legal dates use `<måned> <år>` lowercase in both repos for both privacy and terms (`april 2026`, `december 2024`). `legal.lastUpdatedOn` = `Sidst opdateret: {{date}}` (sentence case, colon, no space before it).
- Decimal comma, `kr.` with period; `pr.` (per) with period; `min` and `s` as unit symbols without period.
- Compounds are written as one word or with a hyphen before an abbreviation/brand: `Plus-abonnement`, `Gemini-API`, `PDF- og Word-eksport` (suspension hyphen).

## 6. Legal / GDPR vocabulary (Danish GDPR text, Datatilsynet)
| English | Danish |
|---|---|
| GDPR | databeskyttelsesforordningen (GDPR) – the file uses "GDPR" |
| personal data / personal information (also CCPA section) | personoplysninger (avoid: personlige oplysninger) |
| right of access / rectification / erasure / restriction | få indsigt i, få urigtige data berigtiget, få data slettet (ret til sletning), få behandlingen begrænset (avoid: få adgang til, korrigere unøjagtige) |
| object to processing | gøre indsigelse mod behandlingen |
| contract performance (Art. 6(1)(b)) | opfyldelse af en kontrakt (avoid: opfyldelse af aftale, kontraktopfyldelse) |
| legitimate interests / consent | legitime interesser / samtykke |
| supervisory authority | tilsynsmyndighed (`company.supervisoryAuthority` = Integritetsskyddsmyndigheten (IMY), imy.se – the company is Swedish; never Datatilsynet) |
| EU residents | bosiddende i EU (avoid: EU-borgere) |
| mandatory consumer protection rights | ufravigelige forbrugerrettigheder (avoid: tvingende/obligatoriske forbrugerrettighedsbeskyttelser) |
| fair use (limits) | rimelig brug, grænser for rimelig brug af … (avoid: fair-brug-grænser) |
| right of withdrawal | fortrydelsesret; `kan du inden for 14 dage fortryde …`; `fortrydelsesfristen på 14 dage` (avoid: 14-dages fortrydelsesret til at træde tilbage) |
| "Continued use constitutes acceptance" | `Hvis du fortsætter med at bruge tjenesten efter ændringerne, accepterer du …` (avoid: `Fortsat brug udgør accept`) |
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
- `legal.privacy.aiProcessing.content` must be identical in the app and website `da.json`.
- Defined terms `Vilkår` / `Privatlivspolitik` stay capitalized in the app terms (house style); the website terms use lowercase `vilkår`. Do not mix within one document.
- `login` is neuter: `et sikkert login`.

## 7. Known pitfalls
- **Norwegian (bokmål) bleed** is the main risk in this file (about 60 ai.*, suggestions.*, exportDialog.* strings were rewritten in 2026-11). Tells: `funksjon`, `krever`, `innlegg`, `tittel`, `igjen`, `grense nådd`, `nullstilles`, `Logg inn`, `ditt`, `neste` (da: `næste`), `veldig`, `kveld`, `lengde`, `Oppsummering`, `-minner`, `Bruk` as a button (da: `Anvend`/`Brug`), `for å` (da: `for at`).
- False friends with nb/sv: `frokost`, `grine`, `rolig`; `eventuelt` ≠ eventually; `aktuelt` ≠ actually.
- English calques: `stole på` (rely on, legal), `ved din handling`, `realisere at`, `adressere`, `baseret på en undersøgelse`.

## Sources
- Microsoft Danish style guide: https://download.microsoft.com/download/8/f/9/8f99052e-43df-49ac-a877-b8364e2331d7/dan-dnk-StyleGuide.pdf (imperative accents, error messages, en-dash, ellipsis, "Vil du …")
- Apple iPhone User Guide (da-dk), "Dikter tekst på iPhone": https://support.apple.com/da-dk/guide/iphone/iph2c0651d2/ios
- Google Docs Help (da), "Skriv og rediger med din stemme" – Indtaling: https://support.google.com/docs/answer/4492226?hl=da
- Datatilsynet, "Vejledning om overførsel til tredjelande" (april 2024): https://www.datatilsynet.dk/Media/638478180234447566/Vejledning%20om%20overf%C3%B8rsel%20til%20tredjelande.pdf (fornødne garantier, tilstrækkelighedsafgørelse, standardkontraktbestemmelser, supplerende foranstaltninger)
- GDPR, Danish text (EUR-Lex): https://eur-lex.europa.eu/legal-content/DA/TXT/?uri=CELEX:32016R0679
- Dansk Sprognævn (comma, month capitalization): https://dsn.dk / https://sproget.dk
