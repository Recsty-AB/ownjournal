# Finnish (fi) – OwnJournal UI, Help and legal standard

Scope: app UI strings, Help, paywall and privacy/legal text in `src/i18n/locales/fi.json`
(and the website's `fi.json`). For long-form blog/marketing prose see the website repo's
`.claude/locale-standards/fi.md` (brand voice); this file covers UI microcopy and legal text.

## Register and address

- Informal singular address (sinuttelu), never `Te/Teidän`. Pronouns `sinä/sinun` are mostly
  dropped; use the possessive suffix (`merkintäsi`, `tilauksesi`) or the verb ending
  (`käytät`). Microsoft Finnish style guide §4.1.12.
- The app/system does not speak as "we" in error messages: `Mikrofonia ei löytynyt.`, not
  `Emme löytäneet mikrofonia.` Passive or impersonal forms are normal in errors (MS §5.5.2).
- "We" (`me`, `-mme`) is fine in legal/privacy text, where the company is the actor.
- Companies take `se`, not `he/heidän`: `Google … sen rajapinnan kautta` (not `heidän API:nsa`).

## UI microcopy

- Buttons and commands: imperative, 2sg, short: `Sanele`, `Lopeta`, `Jatka`, `Peruuta`,
  `Hylkää tallenne`, `Yritä uudelleen`. Decline: `Ei nyt`.
- Progress states: passive present + ellipsis character: `Litteroidaan…`, `Ladataan…`.
- Errors: state the problem, then the fix. `X ei onnistunut. Yritä uudelleen.` House style
  also uses `epäonnistui` (≈70 occurrences) – both accepted; do not mass-convert.
- No calqued "please": English "Please sign in" → `Kirjaudu sisään …`.
- House pattern `Kirjaudu sisään käyttääksesi X:ää` is established across the file; keep it.
- Avoid dangling purpose phrases at sentence end (`Salli se asetuksista saneluun.`). Prefer
  `Jos haluat sanella, salli mikrofonin käyttö … asetuksissa.`
- "Resets next month" (quota): `Kiintiö uusiutuu ensi kuussa`, not `Raja nollautuu` (calque).

## Glossary (house style + platform terms)

| English | Finnish | Avoid / notes |
|---|---|---|
| Voice entry (feature name) | `Puhesyöte` (gen. `puhesyötteen`, part. `puhesyötettä`) | established across app + website; do not rename piecemeal |
| Dictate (button) | `Sanele` | Apple iOS/macOS Finnish uses `Sanelu` / `Salli sanelu` |
| Voice typing (Google) | `puhekirjoitus` | Gboard/Windows term; not used as our feature name |
| recording (the audio object) | `tallenne`, in legal text `äänitallenne` | |
| recording (the act) | `äänitys` (`Peruuta äänitys`, `äänityksen ajan`) | `tallennus` = also "saving" → ambiguous; avoid for audio |
| store (on servers) | `tallentaa`; "never stores the recording" → `ei koskaan säilytetä` | avoid `tallennetta ei tallenneta` |
| transcribe / transcription (act) | `litteroida` / `litterointi` | |
| transcript (result) | `litteraatti` | not `litterointi` |
| microphone button | `mikrofonipainike` | `napauta mikrofonia` = tap the hardware |
| cursor (text) | `kohdistin` | |
| editor | `editori` | house style |
| punctuated text | `teksti välimerkkeineen` | `välimerkein varustettu`, `välimerkitetty` (stiff) |
| entry | `merkintä` | |
| tag | `tunniste` (`tunniste-ehdotukset` in app; website `tunnisteehdotukset`) | |
| Plus / subscription | `Plus`, `Plus-tilaus`, `Plus-tilaaja` | |
| AI | UI: `AI-` prefix (`AI-analyysi`, `AI-ominaisuudet`); legal/privacy: `tekoäly-` | both are house style; keep per surface |
| offline | `offline-tilassa` | |
| sign in | `kirjaudu sisään` | |
| Activity Insights | `Aktiviteettinäkymät` (app) / `Aktiviteettioivallukset` (website) | existing divergence, owner decision |
| export | `vienti` (`PDF- ja Word-vienti`) | |

## Grammar checks

- Inflect unit abbreviations with a colon: `10 s:n kuluttua`, `5 km:n`. `kuluttua` takes the
  genitive (Kielitoimisto ohjepankki: lyhenteiden taivutus).
- Partitive after numbers > 1: `200 minuuttia`, `{{minutes}} minuuttia` – works for any count
  except 1 (UI edge case; acceptable).
- Duration verb: a recording `kestää enintään 5 minuuttia`, not `voi olla 5 minuuttia`.
- "even if" → `vaikka + conditional` (`vaikka vaihtaisit kieltä`), not `myös jos`.
- "choose not to use" → `voit jättää … käyttämättä`, not `voit valita, ettet käytä`.
- "the text is decrypted" → `tekstin salaus puretaan` (`teksti puretaan` = text is taken apart).
- Comma before every subordinate clause: `vain, kun …`; `sillä kielellä, jota puhut`.
- In lists, turn English relative clauses into participle attributes to avoid comma pile-ups:
  `puheesi tekstiksi muuttava puhesyöte`.
- `fair-use rate limiting` → `kohtuullisen käytön rajojen valvomiseksi` (never
  `kohtuullisen käytön rajoittamiseksi` = "to restrict fair use").

## Typography

- Parenthetical dash: spaced en dash ` – `. Never the em dash `—` (MS style guide §4.1.13:
  "In Finnish, the em dash should not be used"). Ranges: unspaced en dash `9–17`.
  Both repos still contain many em dashes in older strings – fix when touching a key,
  do not mass-convert without the owner.
- Ellipsis: single character `…`.
- Quotes: `”…”` (same-direction) or straight `"` in JSON-escaped text; never `„…“` or `«…»`.
- Space between number and unit/percent: `200 min`, `50 %`. Currency after number: `4,99 €`.
- Month names are lowercase in running text (`marraskuussa 2026`); standalone date labels
  (`lastUpdatedDate`) are capitalised as a label (`Marraskuu 2026`) – house style.

## Legal / privacy vocabulary (GDPR, Finnish official text)

| English | Finnish |
|---|---|
| personal data | `henkilötiedot` |
| controller / processor | `rekisterinpitäjä` / `henkilötietojen käsittelijä` |
| appropriate safeguards (Art. 46) | `asianmukaiset suojatoimet` |
| Standard Contractual Clauses | official: `tietosuojaa koskevat vakiolausekkeet`; EDPB fi + house: `vakiosopimuslausekkeet (SCC)` |
| adequacy decision (Art. 45) | `tietosuojan riittävyyttä koskeva päätös` |
| EEA | `Euroopan talousalue (ETA)`; `ETA-alueen ulkopuolella` is common usage (accepted) |
| abuse monitoring | `väärinkäytösten valvonta` |
| paid tier (API) | `maksullinen taso`, `maksullinen rajapinta` |
| train or improve models | `mallien kouluttaminen tai parantaminen` |

Legal-text rules: precise, no added or dropped facts; keep "we" as the actor; keep the
voice-entry facts exact (Plus only; audio → Google Gemini; OwnJournal never stores audio or
transcripts; only transcribed seconds are counted; 5 min per recording, 200 min/month;
paid tier not used for training; Google may retain data for a limited time for abuse
monitoring).

## Known pitfalls

- `tallennus` (save vs. record) ambiguity – see glossary.
- English sentence-initial `It works …` → `Se toimii …` reads translated; name the subject
  (`Puhesyöte toimii …`) or restructure.
- `muukin merkintäsi` ("your other entry too") ≠ "the rest of your entry" →
  `samalla tavalla kuin muu merkintäsi`.

## Sources

- Microsoft Finnish Localization Style Guide (PDF):
  https://download.microsoft.com/download/c/7/3/c7371dae-ae9d-4f9b-aa10-a131d432930f/fin-fin-StyleGuide.pdf
- Apple Support Finnish (Sanelu): https://support.apple.com/fi-fi/guide/iphone/iphadba31424/ios
- GDPR Finnish text (EUR-Lex): https://eur-lex.europa.eu/eli/reg/2016/679/oj/fin
- EDPB Recommendations 01/2020, Finnish: https://edpb.europa.eu/system/files/2022-04/edpb_recommendations_202001vo.2.0_supplementarymeasurestransferstools_fi.pdf
- Kielitoimiston ohjepankki (abbreviation inflection, dashes): https://www.kielitoimistonohjepankki.fi/
