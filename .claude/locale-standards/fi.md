# Finnish (fi) – OwnJournal UI, Help and legal standard

Scope: app UI strings, Help, paywall and privacy/legal text in `src/i18n/locales/fi.json`
and the website's `src/i18n/locales/fi.json` (product UI, pricing, FAQ, legal). For long-form
blog/marketing prose see the website repo's `.claude/locale-standards/fi.md` (brand voice).
One term per concept across BOTH repos; the app's term wins unless it is wrong.

## Register and address

- Informal singular address (sinuttelu) everywhere, product UI and legal, both repos. Never
  `Te/Teidän`. Pronouns `sinä/sinun` are mostly dropped; use the possessive suffix
  (`merkintäsi`) or the verb ending (`käytät`). Microsoft Finnish style guide §4.1.12.
- The app does not speak as "we" in error messages: `Mikrofonia ei löytynyt.` Passive or
  impersonal forms are normal in errors (MS §5.5.2). "We" is fine in legal/privacy/FAQ text.
- Companies take `se`, not `he/heidän`: `Google … omien käytäntöjensä mukaisesti`,
  `maksupalveluntarjoajat … omien käytäntöjensä`. "Ask them (the admin)" → `pyydä ylläpitäjää`.

## UI microcopy

- Buttons: imperative 2sg, short: `Sanele`, `Lopeta`, `Jatka`, `Peruuta`, `Yritä uudelleen`,
  `Käytä kaikkia` (partitive!). Decline: `Ei nyt`.
- Progress states: passive present + ellipsis character: `Litteroidaan…`, `Ladataan…`.
- Errors: problem, then fix. `X ei onnistunut. Yritä uudelleen.` (`epäonnistui` also OK).
- Status titles need a verb: `Apple-kirjautuminen ei ole käytettävissä`,
  `Pilvitallennustilaa ei ole yhdistetty` – not `… ei saatavilla`, `Ei … yhdistettynä`.
- No calqued "please"; no `Uusi X:ssä?` ("New to X?") → `Onko X sinulle uusi?`.
- Prefer result-first phrasing over a sentence-initial purpose infinitive with a comma
  (`Käyttääksesi X, tee Y` is ungrammatical): `Jos haluat vaihtaa mallia, avaa …`,
  `Aloita synkronointi asettamalla se ensisijaiseksi.` The short pattern
  `Kirjaudu sisään käyttääksesi X:ää` (no comma) is still accepted.
- "Resets next month" (quota): `Kiintiö uusiutuu ensi kuussa` – never `nollautuu`.
- Plurals: Finnish CLDR categories are `one` and `other` only. Every English `_one/_other`
  key needs both, no bare base key. `_one` = nominative singular (`{{count}} merkintä`,
  `{{count}} virhe`), `_other` = partitive singular (`{{count}} merkintää`, `{{count}} virhettä`),
  verb in the singular in both (`{{count}} merkintää on salaamatta`). Object case for `_one`:
  genitive after an active verb (`poistaa {{count}} merkinnän`), nominative in passive or
  imperative (`Tuotiin {{count}} merkintä`, `Palautettiin {{count}} merkintä`). Genitive
  constructions may be identical in both forms (`{{count}} merkinnän lähetys on kesken`,
  `{{count}} / {{total}} merkinnän salausta …`).
- Counts in keys WITHOUT plural forms: avoid `{{x}}` directly before a partitive noun where 1
  is possible; use a label form: `Aikaa jäljellä tässä kuussa: {{minutes}} min`,
  `Ennen peruutusta siirrettyjä tiedostoja: {{transferred}}`.
- `per` is not Finnish: `merkintää kohden`, `/ 100 synk.`.
- Format placeholders compound with a hyphen: `{{format}}-tiedostoa ei voitu luoda`.
- Provider placeholders: never attach case endings (`{{provider}}:lla` breaks for
  "Google Drive"); use `palveluntarjoajalla {{provider}}`, `palveluun {{provider}}`,
  `palvelun {{provider}} kanssa` ("with {{provider}}").
- Sign-up legal line is one `<Trans>` sentence (`auth.termsAgreement`):
  `Jatkamalla hyväksyt <terms>Käyttöehdot</terms> ja <privacy>Tietosuojakäytännön</privacy>.`
  (total object: plural nom. `Käyttöehdot`, singular gen. `Tietosuojakäytännön`; final period).
  The old prefix/suffix/`and` keys are gone.
- Chart tooltip (`moodCorrelations.tooltipDetail_one/_other`):
  `{{delta}} (keskiarvo {{emoji}} {{avg}}, {{count}} merkintä/merkintää)` – no `keskim.:`
  (abbreviation period + colon is clumsy).
- Tap vs click (follows English): English "Tap" (in-app controls) → `napauta`; "Click" only
  where English keeps it (email links, Nextcloud web UI, address bar, Stripe portal
  ”Hallinnoi”, Apple web sign-in popup) → `napsauta`.
- Refer to the reset button by its label: `”Nollaa kaikki tiedot” -toiminto` (storage.resetAllData),
  in `Asetusten Vaaravyöhykkeellä`. Never `”Poista kaikki”`.
- Menu paths use `→` (`Asetukset → oma nimesi → iCloud`), as in the rest of the file.
  Exception kept: `{{companyName}}:n` (Recsty AB:n), `{{companyCountry}}n` (Ruotsin).

## Glossary (house style + platform terms)

| English | Finnish | Avoid / notes |
|---|---|---|
| Voice entry (feature) | `Sanelu` (gen. `sanelun`, part. `sanelua`); lowercase in running text | `Puhesyöte` (retired 2026-11; matches Apple fi "Sanelu" and the `Sanele` button) |
| voice minutes quota | `sanelukiintiö` | |
| Dictate (button) | `Sanele` | |
| recording (audio object) | `tallenne`, legal `äänitallenne` | |
| recording (the act) | `äänitys` (`Peruuta äänitys`, `Äänitystä ei tueta`) | `tallennus` = also "saving" |
| transcribe / transcript | `litteroida`, `litterointi` / `litteraatti` | |
| AI | `tekoäly` everywhere (UI, help, website, legal): `tekoälyanalyysi`, `tekoälyominaisuudet`, `tekoälymallit`, `Tekoälyn otsikkoehdotukset`, `tekoälyn luoma` | `AI-` prefix (retired; CLAUDE.md: Finnish uses "tekoäly") |
| AI features (legal) | `tekoälyominaisuudet` | `tekoälytoiminnot` |
| tag suggestions | `tunniste-ehdotukset` (hyphen: e+e vowel boundary, Kielitoimisto) | `tunnisteehdotukset` |
| Activity Insights | `Aktiviteettinäkymät` (both repos, incl. Help title) | `Aktiviteettioivallukset`, `Aktiviteettien vaikutukset` |
| insights (generic) | `oivallukset` | |
| Mood Statistics | `Mielialan tilastot` | `Mielialastatistiikka` |
| streaks | `sarjat`, `mielialasarja` | `putket` |
| mood levels | `Loistava, Hyvä, Ihan ok, Huono, Kauhea` | `Okei`, `Kamala` |
| Photo Memories | `Kuvamuistot` | `Kuvien lataus` |
| zero knowledge | `zero knowledge -arkkitehtuuri` (title: `Zero knowledge -arkkitehtuuri`), badge `Zero knowledge` | `Nollatietämys`, `Zero-knowledge-…` |
| end-to-end encrypted | `päästä päähän -salattu` | `päästä päähän salattu` |
| Simple mode | `yksinkertainen tila` (also in legal) | `Simple-tila` |
| self-hosted | `itse ylläpidetty` | `itse isännöity`, `itsehostattu` |
| upload / download | `lähetys`, `lähettää` / `lataus`, `ladata` | same word for both |
| cloud storage (place) | `pilvitallennustila` | `pilvitallennus` for the place, `pilvidatat` |
| entry / tag / editor | `merkintä` / `tunniste` / `editori` | |
| Plus / subscriber | `Plus`, `Plus-tilaus`, `Plus-tilaaja`; partitive `Plussaa`, illative `Plussaan` | `Plus-tila`(an), `Plus-käyttäjä`, `Plus:lle` |
| Free plan | `Ilmainen`, `Ilmainen-paketti`, `Kaikki Ilmainen-paketin ominaisuudet` | `Kaikki Ilmaisessa` |
| click / tap | `napsauta` / `napauta` | `klikkaa` |
| Apple Account (ex-Apple ID) | `Apple-tili` (Apple fi; `Apple-tililläsi`, `Apple-tililtäsi`, `Apple-tilisi kautta`, `tällä Apple-tilillä`) | `Apple ID`, `Apple-tunnus` (retired 2026-11) |
| Sign in with Apple (button/feature) | `Kirjaudu sisään Applella` (Apple fi); feature in running text `Kirjaudu sisään Applella -toiminto` | `Kirjaudu Apple ID:llä` |
| Advanced Data Protection | `kehittynyt tietosuojaus` (Apple fi, lowercase in running text; part. `kehittynyttä tietosuojausta`, gen. `kehittyneen tietosuojauksen`) | `Edistynyt tietosuoja` (retired 2026-11), `edistyksellinen tietosuojaus` |
| Reset All Data | `Nollaa kaikki tiedot` | `Poista kaikki` |
| Get it on Google Play | `Hanki Google Playsta` (`Google Playssa`, back vowels) | `Playstä` |
| home page | `etusivu` | `kotisivu` |
| supervisory authority (Sweden) | `Integritetsskyddsmyndigheten (IMY)`, `imy.se` | not the Finnish DPA: the company is Swedish |

## Grammar checks

- Inflect unit abbreviations with a colon: `10 s:n kuluttua`. `kuluttua` takes the genitive.
- "even if you switch languages along the way" → `vaikka vaihtaisit välillä kieltä`.
- "the text is decrypted" → `tekstin salaus puretaan` (`teksti puretaan` = taken apart).
- Comma before every subordinate clause (`, kun`, `, että`, `, mitkä`, `, jota`) and before
  `eikä` joining clauses: `Tietosi salataan, eikä niitä …`.
- Negative + object → partitive: `ei rajoita vastuutamme`.
- `Aloita kirjoittaminen` / `Ala kirjoittaa` – never `Aloita kirjoittamaan`.

## Typography

- Dash: spaced en dash ` – ` for asides, also replacing ` - ` and `—`. Never the em dash
  (MS style guide §4.1.13). Ranges: unspaced en dash `24–48`, `30–60`.
- Ellipsis: single character `…` everywhere (no `...`).
- Quotes: `”…”` (U+201D both sides) around UI labels and typed confirmations
  (`Kirjoita ”DELETE” vahvistaaksesi`). No straight `"`, no `'…'`, never `„…“`/`«…»`.
  Code literals keep their own quotes (`'always'`).
- Compound with a quoted label: `”Yhdistä”-painike`, `”Jatka Googlella” -vaihtoehto`
  (space before the hyphen when the label contains a space). `+-painike`,
  `AES-256-GCM-standardi`, `brute force -hyökkäys`, `Documents-kansio`.
- Percent: no-break space before `%`: `{{percent}} %`, `100 %`, `< 10 %`. Time units:
  `15 s`, `{{ms}} ms`.
- Website prices: never hard-code an amount or currency; the code formats `{{price}}` and
  `{{monthly}}` in the visitor's currency (`1,67 €`). Use `noin {{monthly}}/kk`,
  `Plus maksaa {{price}} vuodessa (noin {{monthly}} kuukaudessa)`.
- Kept on purpose: `providers.icloud.requiresDevAccount` says `99 €/vuosi` (Apple's
  eurozone developer price) where English says `$99/year`.
- `Huom.` (abbreviation with a period), not `Huom:`.

## Dates (legal)

- Month names are always lowercase, also after a colon: `Viimeksi päivitetty: marraskuu 2026`
  (`legal.lastUpdatedOn` = `Viimeksi päivitetty: {{date}}`; `lastUpdatedDate` values
  `marraskuu 2026`, `huhtikuu 2026`, website `joulukuu 2024`). Same style for privacy and
  terms in both repos.

## Legal / privacy vocabulary (GDPR, Finnish official text)

| English | Finnish |
|---|---|
| GDPR (first mention) | `EU:n yleinen tietosuoja-asetus (GDPR)`; later `GDPR:n` |
| Article 37 | `GDPR:n 37 artikla` (number before `artikla`) |
| personal data / controller | `henkilötiedot` / `rekisterinpitäjä` |
| legal basis | `käsittelyn oikeusperuste` |
| contract performance / legitimate interest / consent | `sopimuksen täytäntöönpano` / `oikeutettu etu` / `suostumus` |
| access, portability, rectification, erasure | `oikeus saada pääsy tietoihin`, `oikeus siirtää tiedot järjestelmästä toiseen`, `oikaista`, `oikeus tietojen poistamiseen` |
| appropriate safeguards (Art. 46) | `asianmukaiset suojatoimet` |
| Standard Contractual Clauses | `vakiosopimuslausekkeet (SCC)` (EDPB fi; official: `tietosuojaa koskevat vakiolausekkeet`) |
| adequacy decision | `tietosuojan riittävyyttä koskeva päätös` |
| EEA | `Euroopan talousalue (ETA)`; `ETA-alueen ulkopuolella` accepted |
| abuse monitoring | `väärinkäytösten valvonta` (FAQ: `väärinkäytösten havaitseminen`) |
| fair-use rate limiting | `kohtuullisen käytön rajojen valvominen` (never `reilun käytön`, `rajoittaminen`) |
| paid tier / API | `maksullinen taso`, `maksullinen rajapinta` |
| right of withdrawal | `peruuttamisoikeus`, `peruuttamisaika` |
| severability | `Ehtojen osittainen pätemättömyys`; contract clause = `määräys` |

Legal rules: precise, no facts added or dropped; "we" as the actor; `Ehdot` capitalised as
the defined term in the Terms. The website no longer has its own legal block (it links to
the app's policy). AI text and recordings pass "via our servers" only in transit:
`lähetetään palvelimiemme kautta`, DPO: `kulkee palvelimiemme kautta ainoastaan
välitettäväksi tekoälypalveluntarjoajallemme, eikä sitä säilytetä`. With OwnJournal as the
subject use `palvelimilleen`, with "we" `palvelimillemme`. Website refund FAQ mirrors Terms §5
(`peruuttaa ostoksen 14 päivän kuluessa`, `käyttöösi suhteutetun osuuden maksusta`). Keep
the voice facts exact (Plus only; audio → Google Gemini;
OwnJournal never stores audio or transcripts; only transcribed seconds are counted; 5 min
per recording, 200 min/month; paid tier not used for training; Google may retain data for
a limited time for abuse monitoring).

## Known pitfalls

- `tallennus` (save vs. record) ambiguity; `lataus` used for both upload and download.
- Calques: `Se toimii …` (name the subject), `Ei luottokorttia tarvita` → `Luottokorttia ei
  tarvita`, `Valmis omistamaan …`, `Yksityisyyden ensisijaiseksi asettava` → `Yksityisyys edellä
  suunniteltu`, `Integroimme … kanssa` → `Käytämme … palveluja`.
- `kuten muukin merkintäsi` ≠ "like the rest of your entry" → `samalla tavalla kuin muu merkintäsi`.
- Swedish drift: `versionshistoria` → `versiohistoria`.

## Sources

- Microsoft Finnish Localization Style Guide:
  https://download.microsoft.com/download/c/7/3/c7371dae-ae9d-4f9b-aa10-a131d432930f/fin-fin-StyleGuide.pdf
- Apple Support Finnish (Sanelu): https://support.apple.com/fi-fi/guide/iphone/iphadba31424/ios
- Apple fi, Kirjaudu sisään Applella: https://support.apple.com/fi-fi/guide/iphone/iph238921d37/ios
  and https://www.apple.com/fi/legal/privacy/data/fi/sign-in-with-apple/
- Apple fi, Apple-tili: https://support.apple.com/fi-fi/guide/iphone/iph76e54c61e/ios
  (”Apple-tilille kirjautuminen ja tilin hallitseminen iPhonella”)
- Apple fi, Kehittynyt tietosuojaus (official): https://www.apple.com/legal/privacy/data/fi/advanced-data-protection/
- GDPR Finnish text (EUR-Lex): https://eur-lex.europa.eu/eli/reg/2016/679/oj/fin
- EDPB Recommendations 01/2020, Finnish: https://edpb.europa.eu/system/files/2022-04/edpb_recommendations_202001vo.2.0_supplementarymeasurestransferstools_fi.pdf
- Kielitoimiston ohjepankki (hyphen at identical vowels, abbreviation inflection, dashes,
  month names): https://www.kielitoimistonohjepankki.fi/
