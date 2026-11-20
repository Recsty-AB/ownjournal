# Danish (da) – UI and legal localization standard for the OwnJournal app

Scope: app UI, Help, paywall, privacy/legal texts in `src/i18n/locales/da.json` (and the website's `da.json`).
For long-form blog/brand voice see the website's `.claude/locale-standards/da.md`; this file covers UI and legal copy.

## 1. Register and address
- Informal `du / dig / din / dit / dine` everywhere, product UI and legal text, both repos. Never `De / Dem / Deres`. (House style + Microsoft Danish style guide.) `bedes du` is tolerated; it is not a different address form.
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
| danger zone | Farezone (`i sektionen Farezone`) | Fareområdet |
| Reset All Data (storage.resetAllData) | `Nulstil alle data` – quote this exact label in help/recovery text | `SLET alle data`, `Slet alt` |
| cancel (a subscription) | opsige (`opsige dit abonnement`) | annullere planen |
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
| Apple Account (formerly Apple ID) | Apple-konto, common gender: `din Apple-konto`, `denne Apple-konto` (Apple da-dk, 2024 rename) | Apple ID, Apple-id, `dit Apple ID` |
| Sign in with Apple (button/feature) | Log ind med Apple (Apple da-dk) | Log ind med Apple ID, Log på med Apple (third-party wording) |

Owner decision (2026-11): the feature is `Diktering` everywhere in both repos (`Diktering kræver et Plus-abonnement`, `minutter med diktering`). `Stemmeinput` is retired.
One term per concept across both repos; the app's term wins unless it is wrong.

## 3. Imperatives and accents
- Microsoft: stressed `-er` imperatives normally take no accent (`rediger`, `annuller`, `dikter`, `aktiver`, `deaktiver`, `filtrer`, `dekrypter`). Use the accent only when the form can be misread as a noun or present tense (`kopiér`, `markér`, `notér`, `sortér`, `kassér`). House: always `Kopiér`, always `Annuller`.
- Avoid consonant-cluster imperatives (`Ændr`, `Lagr`, `Frakobl`); use synonyms (`Skift`, `Gem`, `Afbryd`).

## 4. Microcopy conventions
- Error messages: complete sentences that end with a period; include the article (`Optagelsen er for stor.`, not `For stor optagelse`). Avoid opening with `Kan ikke …`/`Kunne ikke …` in new strings (Microsoft); use `… blev ikke …`, `… mislykkedes.`
- Buttons: short verb or verb + object, no period (`Fortsæt`, `Ikke nu`, `Kassér optagelsen`).
- Progress: present tense + ellipsis character `…` with no space (`Transskriberer…`).
- Plurals (i18next): Danish uses exactly `_one` and `_other` (`Intl.PluralRules('da')`). Every English `_one/_other` key needs both; no bare base key, no `(er)`/`(r)` hedges. `indlæg`, `fejl`, `forsøg`, `tag` are invariant, but agreement changes: `1 krypteret indlæg` / `krypterede`, `tilgængeligt` / `tilgængelige`, `er ikke krypteret … det` / `krypterede … dem`, `1 fil` / `filer`, `1 konflikt` / `konflikter`, `1 sikkerhedspause er aktiv` / `pauser er aktive`, `1 AI-genereret tag` / `AI-genererede tags`, `1 foreslået aktivitet` / `foreslåede`.
- Placeholders: `{{minutes}} min` / `{{seconds}} s` work for any number (unit symbol, no inflection). With words, plural forms are `minut/minutter`, `sekund/sekunder`. Avoid genitive constructions around a number (`alle {{minutes}} minutters stemmeinput` – awkward); write `alle dine {{minutes}} minutter med stemmeinput`.
- Avoid zeugma with `blive`: `bliver til tekst og indsat` mixes "become" and passive; write `omdannes til tekst, som indsættes …`.

- Tap vs. click (mirrors the English house rule): in-app controls → `Tryk på …` / `Tryk her` / `prøv at trykke på` (Apple/Google Danish). `Klik på …` only where English keeps "click": Nextcloud web UI, browser address bar, links in e-mails, the Stripe portal (`klik på "Administrer"`), the Apple sign-in popup on the web. Choosing from a list → `Vælg`. Keys: `tryk Enter` for the keyboard.
- Auth line: `auth.termsAgreement` is one `<Trans>` sentence with exactly one `<terms>…</terms>` and one `<privacy>…</privacy>` pair: `Ved at fortsætte accepterer du vores <terms>Servicevilkår</terms> og <privacy>Privatlivspolitik</privacy>.` (ends with a period; no other tags).
- Chart tooltip `moodCorrelations.tooltipDetail_*`: `{{delta}} (gns. {{emoji}} {{avg}}, {{count}} indlæg)` – abbreviation `gns.` (gennemsnit) with period and no colon; `indlæg` is invariant in `_one`/`_other`.
- Website prices: never hard-code an amount or currency; use `{{price}}` / `{{monthly}}` (the code formats the visitor's currency): `Det koster {{price}}/år (~{{monthly}}/måned).`

## 5. Punctuation and typography
- Dash: spaced en-dash ` – `; never em-dash `—` and never a spaced hyphen ` - ` as a dash (Microsoft). Both files are clean (2026-11). After a dash in an error message continue in lowercase (`Ikke fundet – målplaceringen findes ikke`). Exception: Markdown syntax hints (`- lister`).
- Ranges: unspaced en-dash (`24–48 timer`, `30–60 sekunder`).
- Ellipsis: single character `…` everywhere (both files clean).
- Quotation marks: straight double quotes `"…"` (Microsoft Danish style guide: "straight double quotation marks"), also around UI labels: `Klik på "Administrer"`. No single quotes as quotation marks; apostrophes stay (`URL'en`, `SCC'er`, `AI'en`).
- Percent and units: space before `%` and units (`100 %`, `{{percent}} %`, `5 MB`, `{{ms}} ms`, `15 s`). Relative time: `for {{minutes}} min siden`, `for {{hours}} t siden`, `for {{days}} d siden`.
- `&` only in quoted third-party UI labels (`Enheder & sessioner` in Nextcloud); otherwise `og`.
- `per` → `pr.` (`pr. ugedag`, `pr. indlæg`). `+-knappen`, `{{tag}}-blokken` (hyphen after a symbol/placeholder in a compound).
- Comma: the file uses startkomma (comma before every subordinate clause: `viser, hvilke`, `krypteret, hvis du …`). Keep it consistent (Dansk Sprognævn allows both systems, but not mixed).
- Months and weekdays lowercase, also standalone after a label: `Sidst opdateret: november 2026`. Legal dates use `<måned> <år>` lowercase for both privacy and terms (`april 2026`, `december 2024`). `legal.lastUpdatedOn` = `Sidst opdateret: {{date}}` (sentence case, colon, no space before it).
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
- The website no longer has a `legal` block (removed 2026-11; it links to the app's legal pages). Legal text lives only in the app `da.json`.
- Defined terms `Vilkår` / `Privatlivspolitik` stay capitalized in the app terms (house style). In website FAQ running text, `vores servicevilkår` / `vores privatlivspolitik` are lowercase.
- AI processing: text and recordings pass *via vores servere* only in transit (`passerer kun gennem vores servere under overførslen … og opbevares ikke`); never claim they go directly to Google. Google "may keep" data briefly → `opbevarer den højst kortvarigt` / `kan opbevare` (not a flat statement that it does).
- Refunds (website FAQ mirrors the Terms): `fortryde købet inden for 14 dage`, `tilbageholde et beløb, der står i forhold til din brug`; App Store/Google Play purchases are refunded by Apple/Google.
- Encryption claims: entries are encrypted on the device only with E2E on (`Når end-to-end-kryptering er slået til, …`); never "alle data krypteres". Sign-in is required (`Log ind, tilslut …`); never "ingen konto nødvendig".
- `login` is neuter: `et sikkert login`.

## 7. Known pitfalls
- **Norwegian (bokmål) bleed** is the main risk in this file (about 60 ai.*, suggestions.*, exportDialog.* strings were rewritten in 2026-11). Tells: `funksjon`, `krever`, `innlegg`, `tittel`, `igjen`, `grense nådd`, `nullstilles`, `Logg inn`, `ditt`, `neste` (da: `næste`), `veldig`, `kveld`, `lengde`, `Oppsummering`, `-minner`, `Bruk` as a button (da: `Anvend`/`Brug`), `for å` (da: `for at`).
- False friends with nb/sv: `frokost`, `grine`, `rolig`; `eventuelt` ≠ eventually; `aktuelt` ≠ actually.
- English calques: `stole på` (rely on, legal), `ved din handling`, `realisere at`, `adressere`, `baseret på en undersøgelse`.

## Sources
- Apple Support (da-dk), "Support til Apple-konto" ("tidligere kaldet Apple-id"): https://support.apple.com/da-dk/apple-account
- Apple iPhone User Guide (da-dk) contents ("Log ind med Apple"): https://support.apple.com/da-dk/guide/iphone/welcome/ios
- Microsoft Danish style guide: https://download.microsoft.com/download/8/f/9/8f99052e-43df-49ac-a877-b8364e2331d7/dan-dnk-StyleGuide.pdf (imperative accents, error messages, en-dash, ellipsis, "Vil du …")
- Apple iPhone User Guide (da-dk), "Dikter tekst på iPhone": https://support.apple.com/da-dk/guide/iphone/iph2c0651d2/ios
- Google Docs Help (da), "Skriv og rediger med din stemme" – Indtaling: https://support.google.com/docs/answer/4492226?hl=da
- Datatilsynet, "Vejledning om overførsel til tredjelande" (april 2024): https://www.datatilsynet.dk/Media/638478180234447566/Vejledning%20om%20overf%C3%B8rsel%20til%20tredjelande.pdf (fornødne garantier, tilstrækkelighedsafgørelse, standardkontraktbestemmelser, supplerende foranstaltninger)
- GDPR, Danish text (EUR-Lex): https://eur-lex.europa.eu/legal-content/DA/TXT/?uri=CELEX:32016R0679
- Dansk Sprognævn (comma, month capitalization): https://dsn.dk / https://sproget.dk

## 8. Dreams glossary (dream reflection, 2026-11)
| English | Danish | Avoid | Status |
|---|---|---|---|
| Dream reflection / Dream patterns (features) | Drømmerefleksion / Drømmemønstre; in prose `en rapport om (dine) drømmemønstre` | Drømmeanalyse, Drømmetydning | judgment (house) |
| Reflect on this dream (button) | Reflekter over drømmen (quote exactly in help/guide) | Reflektér, Reflekter drømmen | judgment |
| dream journal / nightmare / recurring | drømmedagbog / mareridt / tilbagevendende | drømmejournal | videnskab.dk, lex.dk |
| lucid dream | klar drøm | lucid drøm | videnskab.dk |
| awe (feeling chip) | Ærefrygt | Betagelse (= fascination), Undren (overlaps Nysgerrighed) | Danish Keltner translations |
| anxiety (feeling chip) | Uro | Angst (clinical) | website standard §12 |
| crisis wording | `skal du kontakte alarmnummeret eller en krisetelefon` | `det lokale alarmnummer`, `sundhedsprofessionel` | Livslinien ("skal du kontakte 112") |
| health professional (care text) | en læge eller psykolog | sundhedsprofessionel, fagperson | judgment |
| Jung | C.G. Jung, then Jung; genitive Jungs | Carl Jung's | da.wikipedia |
| AI usage in tokens (legal) | forbruget af AI-behandling målt i tokens | tokenforbrug (unexplained) | judgment |
| failed generation (toast) | `Det lykkedes ikke at lave rapporten/refleksionen …` | `Rapporten mislykkedes` (reads as a bad report) | judgment |
