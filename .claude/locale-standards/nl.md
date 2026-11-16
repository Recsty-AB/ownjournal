# Dutch (nl) — UI, Help and legal standard for OwnJournal

Target variety: Netherlands Dutch. For long-form/blog voice see the website repo's
`.claude/locale-standards/nl.md`; this file covers app UI, Help, paywall and privacy/legal strings.

## 1. Register (house style, measured in `src/i18n/locales/nl.json`)

| Surface | Address form | Notes |
|---|---|---|
| App UI, toasts, errors, Help, onboarding, `voice.*` | formal `u` / `uw`, verb `u heeft` | Dominant (hundreds of strings). Keep `u heeft`, not `u hebt` (both correct; house uses `heeft`). |
| `legal.privacy.*`, `legal.terms.*` | informal `je` / `jij` / `jouw` | ~95 `je` vs few `u` in privacy; terms is all `je`. New/rewritten legal paragraphs must use `je`. |
| Website (`ownjournal-website`) | informal `je` everywhere | Per website standard. |

Known conflict (owner decision, not to be silently "fixed"): the app mixes `u` (UI) and `je` (legal), and a few
legacy privacy paragraphs (`encryption`, `syncIdentifier`, `diagnostics`) still use `u`. Microsoft's current
Dutch style guide prefers `je`; a full migration of the app to `je` would be a separate, whole-file change.

## 2. Glossary

| English | Use | Avoid / notes |
|---|---|---|
| entry (app) | `item`, `dagboekitem` | App house term; website uses `notitie`. Legal uses both `item` and `vermelding` (legacy). |
| journal | `dagboek` | |
| Plus feature | `Plus-functie`, `Plus-abonnee`, `Plus-abonnement` | hyphenate brand + noun |
| AI | `AI` (`AI-functies`, `AI-analyse`) | Dutch uses AI, not KI |
| voice entry (feature name) | `Spraakinvoer` | Gboard/Samsung settings also say "Spraakinvoer"/"Spraaktypen" |
| dictate (mic button) | `Dicteren` | Apple's Dutch term ("Dicteren", "Schakel dicteren in") |
| microphone | `microfoon` | |
| recording | `opname` (pl. `opnamen`/`opnames`, both correct) | |
| transcribe / transcription | `transcriberen`, `transcriptie`; plain-language `omzetten in tekst` | |
| punctuation | `leestekens` | |
| filler words | `stopwoordjes` | not "vulwoorden" |
| cursor | `cursor` | |
| reset (limit) | `wordt gereset` | House style; matches existing AI limit messages |
| retry | `Opnieuw proberen` / `Opnieuw <werkwoord>` | not "X opnieuw proberen" stacks |
| subscription | `abonnement` | |
| sign in | `aanmelden` (`Meld u aan`) | |
| paid tier (API) | `betaalde versie` / `betaald abonnement` | not "betaalde laag" (calque of "tier") |
| fair use | `redelijk gebruik`, `limieten voor redelijk gebruik` | not "redelijk gebruik begrenzen" |

## 3. Legal / GDPR vocabulary (AVG)

- GDPR = `AVG` (Algemene verordening gegevensbescherming). EEA = `EER`.
- Transfer to third countries = `doorgifte` (AVG hoofdstuk V); `gegevensoverdracht` exists in legacy
  titles, acceptable, but prefer `doorgifte van gegevens` in new text.
- SCCs = `standaardcontractbepalingen (SCC's)` — lower case common noun, one word (Uitvoeringsbesluit (EU)
  2021/914, NL version). Avoid `Standaard Contractbepalingen`, `Modelcontractbepalingen` (pre-2021 term).
- Appropriate safeguards = `passende waarborgen`; adequacy decision = `adequaatheidsbesluit`.
- Controller = `verwerkingsverantwoordelijke`; processor = `verwerker`; data subject = `betrokkene`.
- Explicit(ly) = `uitdrukkelijk` in legal text (AVG wording), `expliciet` acceptable in UI.
- Keep facts exact: audio goes to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds
  are counted; Google's paid tier does not train on the data; Google may retain data for a limited time for
  abuse monitoring; 5 min per recording; 200 min per month; Plus only. Singular "AI provider" = `AI-provider`
  / `AI-dienstverlener` (only Google remains).

## 4. Typography

- Ellipsis: single character `…` (`Bezig met transcriberen…`).
- Dashes: the app file uses spaced em dash ` — ` (24×) more than en dash ` – ` (9×); follow the
  surrounding list. Website standard prefers spaced en dash; website file itself mostly uses em dash
  (conflict noted, leave existing).
- Units: `5 minuten`, `200 min/maand`, seconds `{{seconds}} s` (SI) or `sec.`; space between number and unit.
- Currency: `€ 19,99` (space, decimal comma).
- Compounds: closed or hyphenated, never open: `spraakinvoer`, `Plus-functie`, `PDF- en Word-export`
  (hyphen for suspended compound), `end-to-end-versleuteling`, `e-mail`.
- Sentence case for headings and buttons; title case is a translation tell.

## 5. UI microcopy

- Buttons: infinitive verb, short (`Dicteren`, `Stoppen`, `Doorgaan`, `Niet nu`, `Opname verwijderen`).
- Errors: state the problem, then the action (`Toegang tot de microfoon is geblokkeerd. Sta deze toe in …`).
  Avoid elliptic English-shaped fragments (`Probeer een kortere.` → `Probeer een kortere opname.`).
- V2 word order in main clauses; verb-final in subordinate clauses.
- Prefer `met Plus heeft u …` over a calque of "Plus includes …" when the subject is minutes/allowance.
- Placeholders: `{{minutes}}`/`{{seconds}}` always take plural noun after numbers >1; Dutch `minuut/minuten`
  is fine with `min` abbreviation for space-constrained labels.

## 6. Pitfalls

- Mixing `u` and `je` inside one paragraph or one surface (see §1).
- Calques: `laag` (tier), `Uw woorden worden nette tekst` (become) → `worden omgezet in`.
- Flemish drift (`ge`, `plezant`) — target is NL.

## Sources

- Microsoft Dutch localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- EDPB, Internationale doorgifte van persoonsgegevens (NL): https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_nl
- Uitvoeringsbesluit (EU) 2021/914 (standaardcontractbepalingen, NL): https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=nl
- AVG (NL text, EUR-Lex): https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32016R0679
- Gboard spraakinvoer (NL): https://www.yaps.ai/nl/blog/zo-dicteer-je-op-android ; https://androidworld.nl/nieuws/nederlandse-leestekens-spraakgestuurd-typen/
- Apple dicteren (NL): https://transkriptor.com/nl/dicteer-iphone/
