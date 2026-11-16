# Norwegian Bokmål (nb) – UI and legal localization standard for the OwnJournal app

Scope: app UI, Help, paywall, privacy/legal texts in `src/i18n/locales/nb.json` and the website's `no.json` (same language, different code).
For long-form blog/brand voice see the website's `.claude/locale-standards/no.md`; this file covers UI and legal copy.

## 1. Register and variety
- Moderate Bokmål only. Nynorsk forms (`ikkje`, `berre`, `korleis`, `kva`) are errors.
- Informal `du / deg / din / ditt / dine` everywhere. Never `De / Dem / Deres`.
- Plain imperatives are polite (`Prøv igjen.`, `Logg inn for å …`). Do not add `vennligst` to new strings.
- Questions to the user: `Vil du …?`, not a bare infinitive with a question mark (`Transkribere …?` is an English calque).
- Error messages: passive or impersonal so the user is not blamed (`Opptaket er for stort.`, `Fant ingen mikrofon.`).

## 2. House glossary (established in nb.json / no.json – keep)
| English | Bokmål | Avoid |
|---|---|---|
| entry | innlegg | oppføring (only for "record" in legal text), indlæg (da) |
| journal | dagbok, dagboken | dagbog (da) |
| tag (app) | etikett, etikettforslag | – (website uses `tag`, `tagforslag`; do not mix inside one repo) |
| Plus feature | Plus-funksjon | Plus-funktion (da) |
| requires / needs | krever | kræver (da) |
| available | tilgjengelig | tilgængelig (da) |
| Cancel | Avbryt | Annuller (da) |
| Discard | Forkast | Kassér (da) |
| Try again | Prøv igjen / på nytt | Prøv igen (da) |
| sign in | Logg inn | Log ind (da) |
| settings | innstillinger | indstillinger (da) |
| Voice entry (feature) | Taleinndata (house term in both repos; Android's term for voice input) | stemmeinput |
| Dictate (button/tooltip) | Start diktering (Apple: `Diktering`) | `Dikter` (= noun "poet"), `Diktér` |
| recording | opptak | optagelse (da) |
| transcribe / transcription | transkribere / transkripsjon, transkribering (process) | transskribere (da) |
| microphone access | tilgang til mikrofonen | |
| punctuation | tegnsetting | tegnsætning (da) |
| filler words | fyllord | |
| editor | redigeringsfeltet (app), redigeringsvinduet (website) | |
| offline | frakoblet (prose), offline (feature labels) | |
| fair use | rimelig bruk | |
| AI | AI (house style, not KI) | |
| Activity Insights | Aktivitetsinnsikt | |
| Photo memories | Fotominner | Fotominder (da) |

Owner note: Google's Norwegian UI calls voice typing `Stemmestyrt skriving` (Gboard) and Apple uses `Diktering`. `Taleinndata` is understandable and consistent; rename everywhere at once if ever changed.

## 3. Grammar pitfalls
- Strong adjective after `hvert/hver/et/en`: `hvert transkribert opptak`, not `hvert transkriberte opptak`.
- Definite after `alle` + number: `alle {{minutes}} minuttene` (correct). Unit symbols with placeholders: `{{minutes}} min`, `{{seconds}} s` – no inflection problems.
- Avoid passive zeugma; `gjøres om til tekst og settes inn` is fine (both `-s` passives).
- `via deres API` is accepted for a company; prefer naming it (`Googles betalte API`).
- Comma before a subordinate clause that follows a long subject: `skylagringsleverandøren du har valgt, kan …`.

## 4. Microcopy conventions
- Buttons: short verb or verb + object, no period (`Fortsett`, `Ikke nå`, `Forkast opptaket`, `Avbryt opptaket`).
- Progress labels: present tense + ellipsis with no space (`Transkriberer…`, `Synkroniserer…`). Use the single `…` character in new strings; legacy `...` remains in older strings.
- Error messages are full sentences with a period.
- Teasers/tooltips: one or two short sentences.

## 5. Punctuation and typography
- Dash: spaced en-dash ` – `. Em-dash `—` is not Norwegian; the files still contain legacy em-dashes (e.g. website pricing list), keep consistent within a list, use en-dash in new prose.
- Quotes: `«…»`.
- Months and weekdays lowercase, also standalone after a label: `Sist oppdatert: november 2026`.
- Decimal comma; `50 %` with a space; `kr` without period (Danish uses `kr.`).
- Sentence case in headings and titles.

## 6. Legal / GDPR vocabulary (Norwegian GDPR text, personopplysningsloven, Lovdata)
| English (GDPR) | Bokmål (official) | Avoid |
|---|---|---|
| appropriate safeguards (Art. 46) | nødvendige garantier | passende sikkerhetsforanstaltninger (Danish calque: `foranstaltning`) |
| adequacy decision (Art. 45) | beslutning om tilstrekkelig beskyttelsesnivå | tilstrekkelighetsbeslutning |
| Standard Contractual Clauses | standard personvernbestemmelser (SCC) vedtatt av Kommisjonen | standard kontraktklausuler, standardkontraktsklausuler |
| supplementary measures | supplerende tiltak | |
| controller / processor | behandlingsansvarlig / databehandler | |
| personal data | personopplysninger | persondata (da) |
| EEA | EØS (Det europeiske økonomiske samarbeidsområdet) | |
| privacy policy | personvernerklæring | |
| abuse monitoring | overvåking av misbruk / å overvåke misbruk | misbruksovervåking (heavy), policyhåndhevelse (anglicism) |
| policy enforcement | håndheving av retningslinjer | |
| opt in | melde seg på, samtykke til | `velge inn i` (calque) |
| prompts / outputs | forespørsler / utdata | |
| fair-use rate limiting | å håndheve grenser for rimelig bruk | `begrensning av rimelig bruk` (wrong meaning) |

Legal facts that must survive translation: 5 minutes per recording; 200 minutes per month; Plus only; audio sent to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds counted; Google's paid tier does not train on data; Google may retain data for a limited time for abuse monitoring.

## 7. Danish drift checklist (seen in this codebase)
`funktion`→`funksjon`, `kræver`→`krever`, `annuller`→`avbryt`, `optagelse`→`opptak`, `efter`→`etter`, `nogen`→`noen`, `måske`→`kanskje`, `foranstaltning`→`tiltak`/`garanti`, `persondata`→`personopplysninger`, `kr.`→`kr`, `tegnsætning`→`tegnsetting`.

## Sources
- GDPR in Norwegian (personopplysningsloven, ch. V): https://lovdata.no/dokument/NL/lov/2018-06-15-38/KAPITTEL_gdpr-5
- SCC under Art. 46(2)(c), Norwegian: https://europalov.no/rettsakt/standard-avtalevilkar-for-overforing-av-personopplysninger-til-utlandet/id-9617
- Helsedirektoratet, transfers outside EU/EØS: https://www.helsedirektoratet.no/normen/bruk-av-skytjenester-til-behandling-av-helse-og-personopplysninger/anskaffelser-ved-bruk-av-skytjenester/krav-til-overforingsgrunnlag-ved-bruk-av-databehandler-utenfor-eu-eos
- Google Gboard (nb) "Stemmestyrt skriving": https://support.google.com/gboard/answer/11197787?hl=no
- Google Docs (nb) "Skriv og rediger med stemmen": https://support.google.com/docs/answer/4492226?hl=no
- Regjeringen.no writing rules (follow Språkrådet): https://www.regjeringen.no/no/om-nettstedet/innholdsstrategi/ti-bud-for-godt-innhold-pa-regjeringen.no/skriveregler-for-regjeringen.no/id2517901/
- Microsoft Norwegian style guide: https://learn.microsoft.com/globalization/reference/microsoft-style-guides
