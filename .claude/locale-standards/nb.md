# Norwegian Bokmål (nb) – UI and legal localization standard for the OwnJournal app

Scope: app UI, Help, paywall, privacy/legal texts in `src/i18n/locales/nb.json` and the website's `no.json` (same language, different code). One term per concept across both repos; the app's term wins unless wrong. The website no longer has a `legal` block (removed 2026-11; legal text lives only in the app).
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
| tag | etikett, etiketter, etikettforslag, etikettfiltre (both repos, owner decision 2026-11) | tag, tagger, tagforslag |
| Plus feature | Plus-funksjon | Plus-funktion (da) |
| requires / needs | krever | kræver (da) |
| available | tilgjengelig | tilgængelig (da) |
| Cancel | Avbryt | Annuller (da) |
| Discard | Forkast | Kassér (da) |
| Try again | Prøv igjen / på nytt | Prøv igen (da) |
| sign in | Logg inn | Log ind (da) |
| settings | innstillinger | indstillinger (da) |
| Voice entry (feature) | Diktering (both repos; Apple's nb term; lowercase `diktering` in running text) | Taleinndata, stemmeinput |
| Dictate (button/tooltip) | Start diktering | `Dikter` (= noun "poet"), `Diktér` |
| recording | opptak | optagelse (da) |
| transcribe / transcription | transkribere / transkripsjon, transkribering (process) | transskribere (da) |
| microphone access | tilgang til mikrofonen | |
| punctuation | tegnsetting | tegnsætning (da) |
| filler words | fyllord | |
| editor | redigeringsfeltet (both repos) | redigeringsvinduet, editoren |
| offline | frakoblet / på nett (prose), offline (feature labels) | online (use `på nett`) |
| self-hosted | egenhostet, egenhosting | selvhostet, selvhosting, `Egenhosting lagring` |
| zero knowledge | Zero Knowledge, Zero Knowledge-arkitektur (both repos) | null kunnskap |
| Simple mode | enkel modus (capital only sentence-initially or as a label) | Simple-modus, Enkel-modus |
| backup (JSON) | sikkerhetskopi; `eksport av JSON-sikkerhetskopi` | backup, JSON-backup-eksport |
| streaks | serier, humørserier | rekker |
| mood levels | Strålende, Bra, Greit, Dårlig, Forferdelig (app labels, also website FAQ) | Topp, Okei |
| payment processor | betalingsleverandør | betalingsprosessor |
| web / desktop (platforms) | nett / skrivebord (prose and badges) | Web, Desktop mid-sentence |
| URL inflected | URL-en, URL-er, server-URL-en | URLen, URLer |
| Step N | Trinn N | Steg N (mixed) |
| fair use | rimelig bruk | |
| AI | AI (house style, not KI) | |
| Activity Insights | Aktivitetsinnsikt | |
| Photo memories | Fotominner | Fotominder (da) |
| Apple Account (renamed from Apple ID, 2024) | Apple-konto, Apple-kontoen din, denne Apple-kontoen (Apple nb support) | Apple ID, Apple-ID-en |
| Sign in with Apple (button/feature) | Logg på med Apple (Apple's official nb feature name; brand exception to house `Logg inn`) | Logg inn med Apple ID |
| Tap (in-app control) / Click | `Trykk på …` where English says Tap (Apple/Google nb); `Klikk på …` only where English keeps Click (Nextcloud web UI, address bar, e-mail links, Stripe portal «Administrer», Apple web pop-up). `trykk Enter` for keys | `Klikk` for in-app controls, bare `Trykk «X»` without `på` |
| cancel a subscription | si opp abonnementet, oppsigelse (`Avbryt` stays for buttons/processes; website `Avbryt når som helst` is accepted marketing copy) | kansellere |
| Reset All Data (storage.resetAllData) | «Tilbakestill alle data» in the button, the Danger Zone «Faresone» named as `i delen «Faresone»` | «SLETT alle data», «Slett alt» |

Owner decision (2026-11): the feature is `Diktering` everywhere (renamed from `Taleinndata` in both repos at once). Entry is always `innlegg`; `oppføring` only for a record/log row (abonnementsoppføring, transaksjonsoppføringer, diagnostic log entries).

## 3. Grammar pitfalls
- Strong adjective after `hvert/hver/et/en`: `hvert transkribert opptak`, not `hvert transkriberte opptak`.
- Definite after `alle` + number: `alle {{minutes}} minuttene` (correct). Unit symbols with placeholders: `{{minutes}} min`, `{{seconds}} s` – no inflection problems.
- Avoid passive zeugma; `gjøres om til tekst og settes inn` is fine (both `-s` passives).
- `via deres API` is accepted for a company; prefer naming it (`Googles betalte API`).
- Comma before a subordinate clause that follows a long subject: `skylagringsleverandøren du har valgt, kan …`.

## 3a. Plurals (i18next, `nb` categories: one, other)
- Every key that has `_one/_other` in en.json needs both `_one` and `_other` in nb.json, never the bare key. No `(er)`/`(r)` hedges.
- `innlegg`, `ord`, `feil`, `forsøk` are identical in both forms, but agreeing words change: `1 kryptert innlegg` / `2 krypterte innlegg`, `klart/klare`, `tilgjengelig/tilgjengelige`, `foreslått aktivitet/foreslåtte aktiviteter`, `fil/filer`, `konflikt/konflikter`, `sikkerhetspause er aktiv/sikkerhetspauser er aktive`, pronoun `det/dem`.
- Website prices: never hard-code an amount or currency; use `{{price}}/år` and `ca. {{monthly}}/måned` (the code formats the currency).
- `auth.termsAgreement` (one `<Trans>` sentence): `Ved å fortsette godtar du <terms>tjenestevilkårene</terms> og <privacy>personvernerklæringen</privacy> våre.` – definite lowercase forms in running text, possessive after, final period. Standalone link labels (`Tjenestevilkår`, `Personvernerklæring`) stay indefinite title forms. Never `våre` + mixed plural/singular nouns.
- Chart tooltip `moodCorrelations.tooltipDetail_*`: `{{delta}} (gj.sn.: {{emoji}} {{avg}}, {{count}} innlegg)` – `innlegg` is the same in one/other.

## 4. Microcopy conventions
- Buttons: short verb or verb + object, no period (`Fortsett`, `Ikke nå`, `Forkast opptaket`, `Avbryt opptaket`).
- Progress labels: present tense + ellipsis with no space (`Transkriberer…`, `Synkroniserer…`). Always the single `…` character; the whole file was converted (no `...` left).
- Confirmations: `Vil du fortsette?`, `Vil du laste ned …?` – never a bare infinitive question.
- No `vennligst` anywhere (removed file-wide). Legal: `kan du kontakte oss`, `ber vi deg kontakte oss`, `må du ikke bruke tjenesten`.
- Error pattern `Tittel – detalj` with lowercase after the dash (`Ikke funnet – målplasseringen finnes ikke`).
- Error messages are full sentences with a period.
- Teasers/tooltips: one or two short sentences.
- Menu paths use `→` (`Innstillinger → navnet ditt → iCloud`), not `>`.
- Countable limits: `{{limit}} ord eller færre`, not `eller mindre`.
- No comma-imperative calque after an adverbial (`På mobil, trykk …`); write `På mobil kan du trykke …`.

## 5. Punctuation and typography
- Dash: spaced en-dash ` – ` in prose, lists and titles; unspaced en-dash for ranges (`24–48 timer`). No em-dash `—` and no spaced hyphen ` - ` as a dash anywhere (both files converted). Exception: the Markdown list hint `- lister` is syntax.
- Quotes: `«…»` for all quoted UI labels, typed confirmations (`«DELETE ALL»`) and English button names (`«Verify Email Address»`, `«Allowed Origins»`). No straight `"…"` or `'…'` quotes.
- Months and weekdays lowercase, also standalone after a label. Legal dates: `Sist oppdatert: november 2026` / `april 2026` / `desember 2024` – same style for privacy and terms in both repos. `legal.lastUpdatedOn` = `Sist oppdatert: {{date}}`.
- Decimal comma; percent and units with a no-break space (U+00A0): `{{percent}} %`, `100 %`, `15 s`, `{{ms}} ms`; `kr` without period (Danish uses `kr.`). Prices on the website come from placeholders: `{{price}}/år`, `ca. {{monthly}}/måned` (`ca.`, not `~`).
- Abbreviation inflection with hyphen: `URL-en`, `SDK-er`, `API-tokenet`.
- Sentence case in headings and titles.

## 6. Legal / GDPR vocabulary (Norwegian GDPR text, personopplysningsloven, Lovdata)
| English (GDPR) | Bokmål (official) | Avoid |
|---|---|---|
| appropriate safeguards (Art. 46) | nødvendige garantier | passende sikkerhetsforanstaltninger (Danish calque: `foranstaltning`) |
| adequacy decision (Art. 45) | beslutning om tilstrekkelig beskyttelsesnivå | tilstrekkelighetsbeslutning |
| Standard Contractual Clauses | standard personvernbestemmelser (SCC) – two words, as in GDPR art. 46(2)(c) on Lovdata and EDPB's nb page; verified 2026-11 | standard kontraktklausuler, standardkontraktsklausuler, `standardpersonvernbestemmelser` (one word is not the official form) |
| supplementary measures | supplerende tiltak | |
| controller / processor | behandlingsansvarlig / databehandler | |
| personal data | personopplysninger | persondata (da) |
| EEA | EØS (Det europeiske økonomiske samarbeidsområdet) | |
| privacy policy | personvernerklæring | |
| abuse monitoring | overvåking av misbruk / å overvåke misbruk | misbruksovervåking (heavy), policyhåndhevelse (anglicism) |
| policy enforcement | håndheving av retningslinjer | |
| opt in | melde seg på, samtykke til | `velge inn i` (calque) |
| prompts / outputs | forespørsler / utdata | |
| fair use / fair-use rate limiting | rimelig bruk; å håndheve grenser for rimelig bruk (consistently, both repos) | rettferdig bruk, `begrensning av rimelig bruk` (wrong meaning) |
| contract performance (Art. 6(1)(b)) | oppfyllelse av avtale | kontraktsoppfyllelse, oppfyllelse av kontrakt |
| legitimate interests | berettigede interesser | |
| data subject rights | få innsyn, få rettet, få slettet, begrense behandlingen, protestere mot behandlingen, klage til personvernmyndigheten | korrigere unøyaktige data, `slette (sletting)` |
| Data Retention (heading) | Lagringstid (distinct from `Datalagring` = Data Storage) | |
| right of withdrawal | angrerett, `angre kjøpet`, angrefrist | `gå fra kjøpet` (legal only: `gå fra avtalen`) |
| passes through our servers only in transit | går bare gjennom serverne våre på vei til …, og lagres ikke | |
| supervisory authority (company) | Integritetsskyddsmyndigheten (IMY), imy.se – the company is Swedish; never Datatilsynet here | Datatilsynet / datatilsynet.no |
| governing law | Gjeldende rett | Gjeldende lov |
| defined terms | lowercase in running text: `disse vilkårene`, `personvernerklæringen vår`; section names in «» | `disse Vilkårene`, `vår Personvernerklæring` |

Legal facts that must survive translation: 5 minutes per recording; 200 minutes per month; Plus only; audio sent to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds counted; Google's paid tier does not train on data; Google may retain data for a limited time for abuse monitoring.

## 7. Danish drift checklist (seen in this codebase)
`funktion`→`funksjon`, `kræver`→`krever`, `annuller`→`avbryt`, `optagelse`→`opptak`, `efter`→`etter`, `nogen`→`noen`, `måske`→`kanskje`, `foranstaltning`→`tiltak`/`garanti`, `persondata`→`personopplysninger`, `kr.`→`kr`, `tegnsætning`→`tegnsetting`.

## 8. Dreams glossary (dream reflection, 2026-11)
| English | Bokmål | Avoid | Evidence |
|---|---|---|---|
| Dream reflection (feature) | Drømmerefleksjon; lowercase `drømmerefleksjon` in running text, indefinite as a name | `Drømmerefleksjonen` as the feature name | judgment |
| Dream patterns (feature) / its report | «Drømmemønstre» (card title); report = `mønsterrapport`, outside the card first mention `mønsterrapport under «Drømmemønstre»` | `drømmemønsterrapport`, `Drømmemønster-rapport` | judgment |
| nightmare | mareritt | mardrøm (dated) | SNL «drøm», NHI «Mareritt» |
| lucid dream | klardrøm (alt. bevisst drøm) | lucid drøm | no.wikipedia «Bevisst drøm» |
| recurring | tilbakevendende; prose `drømmer som kommer igjen` | gjentakende (as chip) | SNL, Klikk |
| anxiety (feeling chip) | Uro (pairs with Frykt as in `frykt og uro`) | Angst (clinical next to angstlidelse) | Dagbladet/Helsenorge via OsloMet: «frykt, redselen eller uroen» |
| a series of dreams (Jung) | flere drømmer sett i sammenheng | `en rekke drømmer` (reads "many dreams") | judgment |
| multi-select flag heading | `Stemmer noe av dette?` | `Hva slags drøm var det?` (asks for one) | judgment |
| health professional / crisis line | helsepersonell / hjelpetelefon | | SML, Helsenorge |
| tokens (AI usage) | `omfanget av AI-behandlingen målt i tokens` | | judgment |

## Sources
- EDPB SME guide (nb), «Standard personvernbestemmelser (SCC-er)»: https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_nb
- GDPR in Norwegian (personopplysningsloven, ch. V): https://lovdata.no/dokument/NL/lov/2018-06-15-38/KAPITTEL_gdpr-5
- SCC under Art. 46(2)(c), Norwegian: https://europalov.no/rettsakt/standard-avtalevilkar-for-overforing-av-personopplysninger-til-utlandet/id-9617
- Helsedirektoratet, transfers outside EU/EØS: https://www.helsedirektoratet.no/normen/bruk-av-skytjenester-til-behandling-av-helse-og-personopplysninger/anskaffelser-ved-bruk-av-skytjenester/krav-til-overforingsgrunnlag-ved-bruk-av-databehandler-utenfor-eu-eos
- Google Gboard (nb) "Stemmestyrt skriving": https://support.google.com/gboard/answer/11197787?hl=no
- Google Docs (nb) "Skriv og rediger med stemmen": https://support.google.com/docs/answer/4492226?hl=no
- Regjeringen.no writing rules (follow Språkrådet): https://www.regjeringen.no/no/om-nettstedet/innholdsstrategi/ti-bud-for-godt-innhold-pa-regjeringen.no/skriveregler-for-regjeringen.no/id2517901/
- Apple-konto (formerly Apple-ID): https://support.apple.com/no-no/apple-account
- «Logg på med Apple» in Apple's nb iPhone User Guide: https://support.apple.com/no-no/guide/iphone/iphdebc1050f/18/ios
- Microsoft Norwegian style guide: https://learn.microsoft.com/globalization/reference/microsoft-style-guides
