# Swedish (sv) – UI and legal localization standard for the OwnJournal app

Scope: app UI, Help, paywall, privacy/legal texts in `src/i18n/locales/sv.json` (and the website's `sv.json`).
For long-form blog/brand voice see the website's `.claude/locale-standards/sv.md`; this file covers UI and legal copy.

## 1. Register and address
- Informal `du / dig / din / ditt / dina` everywhere. Never `Ni / Er` as polite singular (house style + Microsoft Swedish style guide).
- Plain imperatives are polite in Swedish: `Försök igen.`, `Logga in för att …`. Avoid `vänligen` and `var god` in new strings.
- Questions to the user: `Vill du …?` (or a full question), not an English-style bare imperative with a question mark (`Transkribera din röst?` is a calque). Example: `Vill du att Google transkriberar din inspelning?`
- Sentence case for titles, buttons and headings (`Röstinmatning`, not `Röst Inmatning`).

## 2. House glossary (established in sv.json – keep)
| English | Swedish | Avoid |
|---|---|---|
| entry | inlägg, dagboksinlägg | post, entry, anteckning (in UI) |
| journal | dagbok | journal |
| editor | redigeraren | editorn |
| Plus feature | Plus-funktion | Plus-feature |
| subscription | prenumeration (UI, legal, both repos) | abonnemang |
| Plus subscriber | Plus-prenumerant (both repos); Plus-användare ok in UI | Plus-abonnent |
| cancel a subscription | säga upp (legal/FAQ), Avsluta när som helst (short CTA) | avbryta |
| Voice entry (feature) | Röstinmatning (= Google's term, Docs/Gboard) | röstinmatningen as a title |
| Dictate (button) | Diktera (Apple "Diktera text") | Tala in |
| Stop / Cancel / Discard | Stoppa / Avbryt inspelningen / Släng inspelningen | Kassera, Annullera |
| recording | inspelning | upptagning |
| transcribe / transcription | transkribera / transkribering (process), transkription (the text) | transkriptering |
| microphone access | mikrofonåtkomst / åtkomst till mikrofonen | |
| punctuation | skiljetecken | interpunktion (too technical) |
| filler words | fyllnadsord | utfyllnadsord (rarer) |
| cursor | markören | pekaren (that is the mouse pointer) |
| sign in | Logga in | Logga på |
| Try again | Försök igen | Prova igen (ok in prose, not on buttons) |
| Simple mode | Enkelt läge (capital E, also in legal text and mid-sentence) | Simple-läge, enkelt läge |
| end-to-end encryption | end-to-end-kryptering; title case only on the first word: End-to-end-kryptering | änd-till-änd, End-to-End, totalsträckskryptering |
| zero knowledge | nollkunskap, nollkunskapsarkitektur | Zero Knowledge, Noll-kunskap |
| fair use | skälig användning | rättvis användning |
| sync (noun/verb) | synkronisering / synkronisera, synkroniseras (both repos) | synkning, synka, synkas |
| backup | säkerhetskopia; JSON backup export = export av JSON-säkerhetskopia | backup |
| activity tagging | aktivitetstaggar | aktivitetsmärkning |
| streak | svit (Pågående svit, Längsta svit, humörsviter) | serie |
| mood levels | Utmärkt, Bra, Okej, Dåligt, Fruktansvärt (= app UI) | Toppen, Hemskt |
| journal entries (legal) | dagboksinlägg / inlägg | dagboksanteckningar, poster (poster only for log records) |
| Apple Account (formerly Apple ID) | Apple-konto, ditt Apple-konto, det här Apple-kontot (Apple sv-se, "Ditt Apple-konto, tidigare Apple ID") | Apple-ID, Apple ID |
| Sign in with Apple (button/feature) | Logga in med Apple (Apple sv-se) | Logga in med Apple-ID |
| Tap (EN changed Click to Tap) | Tryck på | Klicka på (keep only where EN still says click, e.g. "Hantera" in the billing-portal FAQ, padlock icon) |
| email (noun, verb) | mejl, mejla, verifieringsmejl | mail, maila |
| E2E/encryption turned on | `Med end-to-end-kryptering aktiverad` (common gender: aktiverad, not aktiverat) | |
| billing portal cancel | `där du kan säga upp din prenumeration` (don't quote Stripe's button label) | `Välj att säga upp planen` |
| Reset All Data (button, quoted in Help) | "Återställ all data" (= `storage.resetAllData`), section `Farozon` | Radera all data |
| Retries (metric label) | Omförsök | Försök igen (that is the button) |
| AI | AI (not KI) | |
| Activity Insights | Aktivitetsinsikter (capitalised as product feature) | |

## 3. Microcopy conventions (Microsoft Swedish style guide)
- Error messages: full sentences with a period, neutral, no blame: `Inspelningen är för stor. Prova en kortare.` Prefer `Det gick inte att …` / `… misslyckades.` over `Kunde inte …` in new strings.
- Buttons: verb or verb + definite object, no period: `Fortsätt`, `Inte nu`, `Släng inspelningen`.
- Ellipsis: always the single character `…`, directly after the word, no space: `Transkriberar…`, `Lägg till egen aktivitet…`. No `...` anywhere in either file.
- Never `vänligen`/`var god`; write `Kontakta oss …`, `… kan du kontakta oss`, `… ber vi dig kontakta oss`.
- Error toast with a cause: `Hittades inte – målplatsen finns inte` (en-dash, lowercase after it).
- Particle verbs keep the particle: `Stämmer av inlägg…` (not `Avstämmer`).
- Purpose clauses for enabling something: `för att kunna diktera` reads more natural than `för att diktera` after `Tillåt …`.
- `som` means both "as" and "like": write `sparas på samma sätt som resten av inlägget`, not `sparas som resten av inlägget` (reads "saved as the rest").
- Avoid double `som` chains (`funktioner som X, Y och Z, som …`): the second `som` attaches to Z. Use `till exempel` / `såsom` for the first.
- Length phrases: `upp till 5 minuter lång` (add `lång`), `200 minuter i månaden` / `per månad`.

## 4. Placeholders and numbers
- `{{seconds}} s` and `{{minutes}} min` take any number without inflection (unit symbols, no period).
- With words: `minut/minuter`, `sekund/sekunder`. Measure phrases need no preposition: `200 minuter röstinmatning`.
- Decimal comma, space as thousands separator, `kr`; `min/månad` in compact tables. Approximation: `ca 16,67 kr/månad`, never `~`.
- Percent and unit symbols take a no-break space (U+00A0): `{{percent}} %`, `<10 %`, `15 s`, `{{ms}} ms`, `5 MB`. Money: `99 USD/år`, not `99$/år`.
- Relative time: `{{minutes}} min sedan`, `{{hours}} tim sedan`, `{{days}} d sedan`.

- Plurals: i18next uses `_one` / `_other` (Intl.PluralRules `sv` = one, other). Define both for every key English splits; never a base key without suffix and never `(er)`, `(ar)` hedges. Inflect agreement in `_one`: neuter participles/adjectives `inlägg exporterat / synkroniserat / migrerat / analyserat / tillgängligt / krypterat`, `befintligt inlägg`, `Migrera det`; common gender `fil har …`, `föreslagen aktivitet`, `AI-genererad tagg`, `säkerhetspaus är aktiv`. Plurals: `konflikter`, `säkerhetspauser`. Invariant nouns (`inlägg`, `fel`, `försök`) may have identical forms.
- Count + noun labels (`entryCount_*`) are one phrase: `{{count}} inlägg`; never concatenate a number and a separate noun key.
- Prices on the website are never hard-coded: `{{price}}/år`, `ca {{monthly}}/månad` (the code formats the currency in Swedish).
- Toast past events in active past tense: `Anslöt till {{provider}} och läste in {{count}} inlägg`; failure: `Det gick inte att synkronisera med {{provider}}`.
- `auth.termsAgreement` is one `<Trans>` sentence: `Genom att fortsätta godkänner du våra <terms>Användarvillkor</terms> och vår <privacy>Integritetspolicy</privacy>.` (`vår` before the singular common-gender noun, final period, only the two tag pairs).
- Chart tooltip `moodCorrelations.tooltipDetail_*`: `{{delta}} (snitt: {{emoji}} {{avg}}, {{count}} inlägg)`; `inlägg` is invariant, so `_one` and `_other` are identical.
- Settings paths use `→` like English (`Inställningar → ditt namn → iCloud`, `Appar → Säkerhet`).

## 5. Punctuation and typography (Språkrådet, TT-språket, Microsoft)
- Dash: spaced en-dash ` – ` in both files (em-dash `—` and spaced hyphen ` - ` were converted file-wide). Numeric ranges: unspaced `–` (`24–48 timmar`). Exception: markdown syntax such as `- listor` in `editor.markdownSupport`.
- Quotes: straight double quotes `"…"` for UI labels and quoted terms (house style); single quotes `'…'` are not used. Never `„…“` or `«…»`.
- Orthography (Språkrådet recommendation, one form): `i stället`, `i dag`, `I dag`, `I går`.
- `&` is not used in headings or prose: `Hjälp och support`, `Kryptering och lösenord`.
- Product names that are English proper names stay English: Nextcloud's app `End-to-End Encryption`, CloudKit Dashboard `Allowed Origins`, Supabase email button `Verify Email Address`, typed confirmations `DELETE`, `DELETE ALL`, `DELETE ACCOUNT`.
- Months and weekdays are lowercase, also after a label: `Senast uppdaterad: november 2026`. `legal.lastUpdatedOn` = `Senast uppdaterad: {{date}}` (colon, no space before it, date after). All legal dates in both repos use `<månad> <år>` lowercase (`april 2026`, `december 2024`).
- Compounds are closed; use a hyphen with abbreviations/brands and suspension hyphens: `Plus-prenumeration`, `Gemini-API`, `PDF- och Word-export`, `AI-indata eller -utdata`.
- `status` is common gender: `din prenumerationsstatus`.

## 6. Legal / GDPR vocabulary (Swedish GDPR text, IMY)
| English | Swedish |
|---|---|
| personal data | personuppgifter |
| processing | behandling, also `AI-behandling` and the section title `AI-funktioner och behandling` (legal and privacy text in both repos); `bearbetning` only for non-legal progress UI (`Bearbetar…`) |
| legal basis: contract performance | Fullgörande av avtal (GDPR art. 6.1 b) |
| right to erasure | radera dina uppgifter (rätten att bli bortglömd) |
| data protection authority (complaint) | tillsynsmyndighet |
| personal information | personuppgifter (never `personlig information`) |
| "as is" / "as available" | "i befintligt skick" / "i mån av tillgänglighet" |
| willful misconduct | uppsåt (`grov oaktsamhet, uppsåt …`); not `uppsåtligt tjänstefel` (public-official crime) or `uppsåtlig misskötsel` |
| cross-context behavioral advertising | kontextöverskridande beteendebaserad reklam |
| embargo | ett embargo (neuter) |
| ID, synk-ID | ett ID, detta ID (neuter) |
| controller / processor | personuppgiftsansvarig / personuppgiftsbiträde |
| EEA | Europeiska ekonomiska samarbetsområdet (EES) |
| third country | tredjeland |
| adequacy decision (Art. 45) | beslut om adekvat skyddsnivå |
| appropriate safeguards (Art. 46) | lämpliga skyddsåtgärder |
| Standard Contractual Clauses | standardavtalsklausuler (SCC) (IMY); GDPR text: standardiserade dataskyddsbestämmelser |
| supplementary measures | kompletterande / ytterligare åtgärder |
| abuse monitoring | övervaka missbruk |
| at your explicit request | på din uttryckliga begäran (not `genom din uttryckliga åtgärd`) |
| rate limiting for fair use | upprätthålla gränserna för skälig användning (NOT `begränsa skälig användning` = "restrict fair use") |
| paid tier | betald nivå |
- Legal text uses `dina data` (plural agreement: `dina data förblir skyddade`); marketing/UI may keep `din data`.
- Defined terms in the app's Terms keep their capital (`dessa Villkor`, `Integritetspolicyn`); the website's shorter terms use lowercase consistently.
- The website no longer has a `legal` block (it was removed on purpose); legal text lives only in the app file. The website FAQ refund answer mirrors the app's Terms section 5 (`Ångerrätt`): EU/EES consumers, bought on the website, 14 days, proportionate amount may be kept, App Store / Google Play refunds by Apple or Google.
- AI data flow: text and recordings go `via våra servrar` to Google only during transfer (`enbart under överföringen … och sparas inte`); never write that nothing passes our servers.
- Facts to preserve: Plus only; 5 min per recording; 200 min per month; audio sent to Google (Gemini) for transcription; OwnJournal never stores audio or transcripts; only seconds are counted; Google's paid tier does not train on the data; Google may retain data for a limited time for abuse monitoring.
- Name the party instead of ambiguous `dess/deras` (`Googles modeller`). Singular vs plural must match English after provider removal (`en AI-tjänsteleverantör (Google Gemini)`, `AI-leverantör (Google)`).

## 7. Known pitfalls
- English word order and calques: `med lagring av förfrågan avstängd` (write a separate clause: `Googles lagring av förfrågan är avstängd`), `kärnfunktionaliteten för dagboken`, `anmäler sig till program` (opt in).
- Särskrivning (split compounds): `röst inmatning`, `Plus funktion` are errors.
- Norwegian/Danish bleed: `innlegg`, `krever`, `funksjon`, `opptak`, `tegnsætning`, adjective `nylig` (Swedish: `nyligen`, `senaste`, `plötslig ökning`).
- Calques fixed once, do not reintroduce: `Se det i aktion`, `Njuter av …`, `emotionella resa`, `Inga frågor ställda`, `genom design`, `30-sekunders rundtur`, `14-dagars ångerrätt`, `serverside`, `Riktext`, `anmäler sig inte till`, `kärnfunktionaliteten`.
- Capitalised month names (`November 2026`) are an English tell.

## Sources
- Microsoft Swedish localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides (sv-SE: address form, error messages, en-dash, ellipsis)
- Apple iPhone User Guide (sv-se), "Diktera text på iPhone": https://support.apple.com/sv-se/guide/iphone/iph2c0651d2/ios
- Google Docs Help (sv), "Röstinmatning", "Lägga till skiljetecken", "Stoppa röstinmatning": https://support.google.com/docs/answer/4492226?hl=sv
- IMY, "Överföring till tredje land" (adekvat skyddsnivå, lämpliga skyddsåtgärder, standardavtalsklausuler): https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/overforing-till-tredje-land/
- GDPR, Swedish text (EUR-Lex): https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32016R0679
- Apple Support (sv-se), "Apple-konto" ("Ditt Apple-konto, tidigare Apple ID"): https://support.apple.com/sv-se/apple-account
- Apple Support (sv-se) Mac guide, "Logga in med Apple": https://support.apple.com/sv-se/guide/mac-pro/apd1c52f9d30/2024/mac/15
- Språkrådet / Svenska skrivregler (month lowercase, dashes, compounds): https://www.isof.se/sprak/sprakrad
