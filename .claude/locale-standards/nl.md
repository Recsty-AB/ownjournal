# Dutch (nl) — UI, Help, website product copy and legal standard for OwnJournal

Target variety: Netherlands Dutch. Scope: app `src/i18n/locales/nl.json` and the website's
`src/i18n/locales/nl.json` (product UI, FAQ, pricing, legal). Website blog posts follow the website repo's
`.claude/locale-standards/nl.md` and are out of scope here.

## 1. Register (owner decision, Nov 2026)

- **Formal `u` / `uw` everywhere** in both repos: app UI, toasts, errors, Help, onboarding, `voice.*`,
  `legal.privacy.*`, `legal.terms.*`, and all website product/FAQ/pricing/legal strings.
  No `je`/`jij`/`jou`/`jouw`/`jullie` anywhere in these files.
- Verb forms: `u heeft` (not `u hebt`), `u kunt`, `u bent`, `heeft u…?`, `wilt u…?`, `kunt u…?`.
- Questions addressed to the company use the name, not `jullie`: `Welke betaalmethoden accepteert OwnJournal?`
- Reflexive: `u … zich` (`als u zich met Google heeft geregistreerd`).

## 2. Glossary (one term per concept, both repos)

| English | Use | Avoid |
|---|---|---|
| entry / journal entry | `item`, `dagboekitem` (also in legal text and on the website) | `vermelding`, `notitie` (for entries) |
| note (Notes feature) | `notitie` – only for the separate Notes feature (`notes.*`) | |
| journaling | `dagboekschrijven`, `een dagboek bijhouden`, `schrijven` | `journalen` |
| encryption / encrypt / decrypt | `versleuteling`, `versleutelen`, `ontsleutelen`; compounds `versleutelingssleutel`, `versleutelingswachtwoord`, `versleutelingsmodus` | `encryptie`, `ontcijferen`, `Versleutelsleutel` |
| end-to-end encryption | `end-to-end-versleuteling` (noun); `end-to-end versleuteld` (participle); mode label `End-to-end versleuteld` | `End-to-End encryptie` |
| zero knowledge | `zero-knowledge`, `zero-knowledge-architectuur` | `Zero Knowledge` |
| Simple mode | `eenvoudige modus` (UI label `Eenvoudige modus`), also in legal | `Simple-modus` |
| provider | `provider`, `cloudprovider`, `opslagprovider`, `AI-provider` | `aanbieder`, `AI-dienstverlener` |
| AI service | `AI-dienst` | `AI-service` |
| AI-powered | `AI-gestuurd` | `AI-aangedreven` |
| sync | `synchronisatie`, `synchroniseren` | bare `sync`, `syncs` |
| sign in / sign out | `inloggen` / `uitloggen` (`Log in om …`, `Inloggen met Apple`) | `aanmelden` for sign-in |
| Apple Account (ex-Apple ID, renamed 2024) | `Apple Account` (Apple NL keeps it in English; `uw Apple Account`, `dit Apple Account`, compounds `Apple Account-wachtwoord`) | `Apple ID`, `Apple-account`, `Apple-ID` |
| Sign in with Apple (button / feature) | `Log in met Apple` (Apple's official NL name; button label exactly this) | `Inloggen met Apple ID`, `Aanmelden met Apple` |
| sign up | `registreren`, `een account aanmaken` | `aanmelden` (ambiguous) |
| Plus member / user / subscriber | `Plus-abonnee(s)` | `Plus-lid`, `Plus-gebruiker` |
| Free plan | `het gratis abonnement` (lower case), `Alles uit het gratis abonnement` | `het Gratis abonnement`, `Alles in Gratis` |
| cancel subscription | `opzeggen` | `annuleren` (except quoted portal buttons) |
| refund | `terugbetaling` | `restitutie` |
| support (team) | `de ondersteuning`, `Ondersteuning` | `support` (except the e-mail address) |
| self-hosted | `zelfgehost(e)`, `zelf hosten` | `zelf-gehoste`, `self-hosted` |
| mood tracking | `stemming bijhouden` | `stemmingstracking`, `Stemmingsmonitoring` |
| activity tagging | `activiteiten koppelen` | `activiteitstags`, `Tag activiteiten` |
| Activity Insights (feature name) | `Activiteitsinzichten` | `Inzichten per activiteit` |
| Mood statistics | `Stemmingsstatistieken` (`Stemmingsoverzicht` only = AI mood snapshot) | |
| Photo memories | `Fotoherinneringen` | `Foto-herinneringen` |
| over time | `in de loop van de tijd` | `door de tijd` |
| abuse monitoring | `misbruikbewaking`; "to detect abuse" = `om misbruik op te sporen` | `misbruikmonitoring` |
| fair use | `redelijk gebruik`, `limieten voor redelijk gebruik` | `eerlijk gebruik`, `eerlijk-gebruik-limieten` |
| paid tier | `betaalde versie` | `betaald niveau`, `betaalde laag` |
| voice entry / dictate | `Spraakinvoer` / `Dicteren` | |
| recording / transcription | `opname` (pl. `opnamen`), `transcriptie`, `omzetten in tekst` | |
| filler words | `stopwoordjes` | `vulwoorden` |
| slide (carousel) | `dia` | `slide` |
| reset (limit) | `wordt gereset` | |
| password manager | `wachtwoordbeheerder` | `wachtwoordmanager` |
| tab / button names | `het tabblad Opslag`, `de knop Delen`, `de knop +` | `het Opslag-tabblad`, `Deel-knop`, `+ knop` |
| scroll | `scrollen`, imperative `scrol` | `scroll` |
| tap / click | mirror English: **Tap** (in-app control) = `tik op`, `tikken`; **Click** (web-only surface: Stripe portal, Nextcloud web UI, browser, e-mail link, Apple pop-up) = `klik op` | `tap`, `druk op` |
| withdraw (EU right) | `herroepen`, `herroepingsrecht`; refund = `terugbetalen` | `annuleren` |

Mood labels (app = website): Geweldig, Goed, Oké, Matig, Slecht. Activity "Exercise" = `Bewegen`.

## 3. Legal / GDPR vocabulary (AVG)

- GDPR = `AVG`; EEA = `EER`. Personal data = `persoonsgegevens` (not `persoonlijke informatie`).
- Controller `verwerkingsverantwoordelijke`; processor `verwerker`; DPO `functionaris voor
  gegevensbescherming (FG)` (lower case in running text); supervisory authority `toezichthoudende autoriteit`.
- Rights (art. 15–21): `recht op inzage`, `rectificatie`, `wissing (“recht op vergetelheid”)`,
  `beperking van de verwerking`, `overdraagbaarheid`, `bezwaar`. Legal bases: `de uitvoering van de
  overeenkomst`, `gerechtvaardigde belangen`, `toestemming`; title `Rechtsgronden voor de verwerking`.
- Transfers: `doorgifte` (`Internationale doorgifte van gegevens`), `passende waarborgen`,
  `adequaatheidsbesluit`, `standaardcontractbepalingen (SCC's)` (one word, lower case).
- Explicit(ly) = `uitdrukkelijk`. Statutory rights = `wettelijke rechten`; mandatory consumer rights =
  `dwingende consumentenrechten`; courts = `de Zweedse rechter`; materially = `wezenlijk`.
- Defined terms: `deze Voorwaarden`, `ons Privacybeleid` / `dit Privacybeleid` (capitalised when they
  refer to the document); document title `Algemene voorwaarden` (also for "Terms of Service").
- Dates: month in lower case, no day: `april 2026`, `november 2026`, `december 2024`, same style for
  privacy and terms in both repos. Label `Laatst bijgewerkt: {{date}}` (no space before the colon).
- Facts to keep exact: audio goes to Google (Gemini); OwnJournal never stores audio, transcripts or AI
  content on its servers; only seconds are counted; Google's paid API does not train on the data; Google may
  retain data for a limited time only for abuse monitoring; 5 min per recording; 200 min per month; Plus only.
- AI requests and recordings go **via our servers** to Google only in transit (`alleen via onze servers doorgestuurd naar
  onze AI-provider, zonder dat wij deze bewaren`); keep that in `legal.privacy.aiProcessing` and `legal.privacy.dpo`.
- The website no longer has its own `legal` block (it links to the app's legal pages); don't recreate it.

## 4. Typography (both files)

- Ellipsis: single character `…`, no space before it (`Laden…`, `Eigen activiteit toevoegen…`).
- Dash: spaced en dash ` – ` for parenthetical/explanatory breaks and "label – text" patterns. Never the em
  dash `—`, never a spaced hyphen ` - `. Lower case after the dash unless a proper noun follows
  (`Niet gevonden – de doellocatie bestaat niet`).
- Ranges: unspaced en dash `24–48 uur`, `30–60 seconden`.
- Quotes: curly double quotes `“…”` for UI labels, quoted terms and short quotes (`klik op “Beheren”`).
  The apostrophe stays the plain `'` (`pagina's`, `thema's`, `Let's Encrypt`). Never straight `"…"`
  or single-quote pairs `'…'` as quotation marks.
- Colon: lower case after a colon in running text and list items (`Tip: u kunt …`, `Google: klik op …`).
  Headings of the form `Stap 1: …`, `Optie 1: …`, `Methode 1: …` keep their capital.
- Units with a space: `5 MB`, `{{ms}} ms`, `15 s`, `{{seconds}} s`, `{{minutes}} min geleden`,
  `{{hours}} u geleden`, `{{days}} d geleden`, `200 min/maand`. Percent: `{{percent}}%` (no space).
- Currency: `€ 19,99`, `€ 0` (space after €, decimal comma) in fixed text only. Website prices are
  placeholders formatted in code for the visitor's currency: `{{price}} per jaar (ongeveer {{monthly}} per maand)`,
  `~{{monthly}}/maand`. Never hard-code an amount or currency next to these placeholders.
- Menu paths: arrow ` → ` (`Instellingen → [uw naam] → iCloud`, `Apps → Beveiliging`), not `>`.
- Compounds closed or hyphenated, never open: `cloudsynchronisatie`, `JSON-back-upexport`, `AES-256-GCM-versleuteling`,
  `PDF- en Word-export`, `Plus-functie`, `pop-upvenster`, `privédagboek`, `privé-AI-functies`.
  Avoid `privé` as a separate attributive adjective (`privé cloudopslag` → `cloudopslag in eigen beheer`).
- Adjective inflection after possessives: `Mijn persoonlijke dagboek`, `uw versleutelde dagboek`.
- Sentence case for headings, buttons and plan names; no `&` in running UI text (`Back-up en herstel`).

## 5. UI microcopy

- Buttons: infinitive, short (`Dicteren`, `Stoppen`, `Doorgaan`, `Niet nu`, `Camera openen om te scannen`).
- Errors: problem, then action. Full sentences, no elliptic English fragments.
- "How to X" headings: `Zo lost u het op:`, `Zo maakt u een app-wachtwoord aan:` (not `Hoe … te …`).
- Fronted adverbials take V2, no comma before the imperative: `Schakel voor betere beveiliging … in`,
  not `Voor betere beveiliging, schakel …`.
- Developer-facing strings are still Dutch (`Stel VITE_GOOGLE_CLIENT_ID in het .env-bestand in`).
  Literal tokens users must type (`DELETE`, `DELETE ALL`) and third-party UI names in English
  (`“Verify Email Address”`, `“End-to-End Encryption”`, `Allowed Origins`) stay as they are.
- Do not convert Markdown syntax hints (`- lijsten`, `- opsommingspunt`) into dashes.

## 6. Plurals (i18next, `Intl.PluralRules('nl')` = `one`, `other`)

- Every key that has `_one`/`_other` in en.json needs exactly `key_one` and `key_other`; no base key.
- `_one` must be a real singular with full agreement: `{{count}} item is …`, `om het te bekijken`,
  `{{count}} versleuteld item … dat … kan`, `{{count}} niet-herstelbaar item`, `{{count}} bestaand item`.
- "X of Y" partitives agree with the count: `_one` `{{count}} van {{total}} items kon niet …`,
  `_other` `… konden niet …`; `{{count}} van de laatste 10 bewerkingen is` / `zijn mislukt`.
- No hedges like `conflict(en)`, `veiligheidspauze(s)`.
- `auth.termsAgreement` is one `<Trans>` sentence: `Door verder te gaan, gaat u akkoord met onze
  <terms>Algemene voorwaarden</terms> en ons <privacy>Privacybeleid</privacy>.` – article agrees with each noun
  (`onze` voorwaarden, `ons` privacybeleid), articles outside the tags, final full stop.
- Chart tooltips: `{{delta}} (gem. {{emoji}} {{avg}}, {{count}} item/items)` – abbreviation `gem.` with no
  colon after it (no `gem.:`).

## 7. Pitfalls

- Register drift back to `je` when adding new strings (especially Help, subscription disclosures, legal).
- Calques: `laag` (tier), `Lijst uw …` (list), `Vind uw …` (find → `Zoek … op`), `Plus bevat 200 minuten`
  (→ `met Plus heeft u 200 minuten`), `woorden worden tekst` (→ `worden omgezet in`).
- Flemish drift (`ge`, `plezant`) – target is NL.

## Sources

- Microsoft Dutch localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- Taalunie / Woordenlijst (compounds, dashes, quotes): https://woordenlijst.org ; https://taaladvies.net
- AVG (NL text, EUR-Lex): https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32016R0679
- EDPB, Internationale doorgifte van persoonsgegevens (NL): https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_nl
- Uitvoeringsbesluit (EU) 2021/914 (standaardcontractbepalingen, NL): https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=nl
- Gboard spraakinvoer (NL): https://androidworld.nl/nieuws/nederlandse-leestekens-spraakgestuurd-typen/
- Apple dicteren (NL): https://transkriptor.com/nl/dicteer-iphone/
- Apple Account (NL): https://support.apple.com/nl-nl/HT6283 (“Apple Account-aankopen”);
  https://support.apple.com/nl-nl/guide/mac-mini/apd74518e330/2024/mac/15 (“Inloggen bij je Apple Account”)
- Log in met Apple (NL): https://support.apple.com/nl-nl/ht5394 (“'Log in met Apple' gebruiken voor apps en websites”);
  https://support.apple.com/nl-nl/102609
