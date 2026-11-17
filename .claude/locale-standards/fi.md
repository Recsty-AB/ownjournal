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
- Counts: avoid `{{count}}`/`{{minutes}}` directly before a partitive noun where 1 is
  possible; use a label form: `Aikaa jäljellä tässä kuussa: {{minutes}} min`,
  `Kirjattuja ristiriitoja: {{count}}`, `Vietyjä merkintöjä: {{count}} ({{format}})`,
  or genitive constructions (`{{count}} merkinnän lähetys on kesken`). Older strings with
  `{{count}} merkintää` remain where 1 is unlikely (bulk counts); fix when touching them.
- `per` is not Finnish: `merkintää kohden`, `/ 100 synk.`.
- Format placeholders compound with a hyphen: `{{format}}-tiedostoa ei voitu luoda`.
- Provider placeholders: never attach case endings (`{{provider}}:lla` breaks for
  "Google Drive"); use `palveluntarjoajalla {{provider}}`, `palveluun {{provider}}`.
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
| Advanced Data Protection | `Edistynyt tietosuoja` (Apple fi) | `edistyksellinen tietosuojaus` |
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
  `15 s`, `{{ms}} ms`. Currency after number: `19,99 $`, `noin 1,67 $/kk`.
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
the defined term in the Terms. Website `legal.privacy.aiProcessing.content` must be
identical to the app's. Keep the voice facts exact (Plus only; audio → Google Gemini;
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
- Apple Edistynyt tietosuoja (fi usage): https://proton.me/fi/blog/apple-icloud-privacy
- GDPR Finnish text (EUR-Lex): https://eur-lex.europa.eu/eli/reg/2016/679/oj/fin
- EDPB Recommendations 01/2020, Finnish: https://edpb.europa.eu/system/files/2022-04/edpb_recommendations_202001vo.2.0_supplementarymeasurestransferstools_fi.pdf
- Kielitoimiston ohjepankki (hyphen at identical vowels, abbreviation inflection, dashes,
  month names): https://www.kielitoimistonohjepankki.fi/
