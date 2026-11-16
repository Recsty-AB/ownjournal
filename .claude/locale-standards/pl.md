# Polish (pl) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/pl.json`) and the website's UI/pricing/FAQ/legal strings
(`ownjournal-website/src/i18n/locales/pl.json`). Long-form blog prose follows the website's
standard (`ownjournal-website/.claude/locale-standards/pl.md`), which shares the informal `ty`
register but not its blog-only rules (scene openers, citations, particles).

## 1. Register and address (house style)
- Informal **ty** everywhere; never `Pan/Pani/Państwo`.
- Pronouns addressing the user are **capitalised** in UI and legal text: `Twój`, `Twoje`,
  `Twoich`, `Ci`, `Ciebie`, `Ty` (app: 0 lowercase occurrences; website UI same). Keep it.
- Imperatives in 2nd person singular: `Dotknij…`, `Zaloguj się…`, `Zezwól…`, `Spróbuj ponownie.`
- Avoid forced gendered past forms (`wybrałeś/wybrałaś`); prefer present/future or impersonal
  (`Wykorzystano…`, `Nie znaleziono…`). Legal text uses the generic `subskrybent`, `użytkownik`.
- Progress/status lines use a verbal noun + `…`: `Ładowanie…`, `Synchronizowanie…`,
  `Transkrybowanie…` (Microsoft Polish style guide convention). New strings: use the single
  character `…` (older strings still have `...`; do not mass-convert).

## 2. Glossary (term → use → avoid)
| English | Polish | Avoid / note |
|---|---|---|
| Voice entry (feature) | Wprowadzanie głosowe | Samsung's name for the same feature; Google: „Pisanie głosowe”, Apple: „Dyktowanie” |
| Dictate (button) | Dyktuj | – |
| Recording / audio | nagranie / dźwięk, nagranie audio | „audio” as a bare noun |
| Transcribe / transcript | transkrybować (perf. przetranskrybować) / transkrypcja | „Transkrybować Twój głos” (calque) – say „zamienić mowę na tekst” |
| Speech-to-text | zamiana mowy na tekst | – |
| Clean (punctuated) text | uporządkowany tekst ze znakami interpunkcyjnymi | „czysty tekst” (reads as *plain text*) |
| Filler words | przerywniki („yyy”, „eee”) | „słowa wypełniacze” |
| Tap | Dotknij + gen. (`Dotknij mikrofonu`) | „Stuknij mikrofon” (Apple uses „stuknij w”, but app house style is „Dotknij”); „Kliknij” only for web/desktop |
| Microphone access | dostęp do mikrofonu | – |
| Stop / Cancel / Discard / Retry | Zatrzymaj / Anuluj / Odrzuć / Ponów, Spróbuj ponownie | – |
| Continue / Not now | Kontynuuj / Nie teraz | – |
| Entry | wpis | notatka (in UI) |
| AI | AI (house style, 80+ uses) | SI (correct Polish but not used in this product) |
| Plus | Plus (indeclinable): `w planie Plus`, `subskrypcja Plus`, `funkcja Plus`, `Przejdź na Plus` | „dostępne w Plus” (no case marking – add `planie`) |
| Subscription | subskrypcja | abonament |
| Activity Insights | analiza aktywności (lowercase mid-sentence) | – |
| PDF & Word export | eksport PDF i Word / eksport do PDF i Word | – |
| Prompts (legal, app) | zapytania i odpowiedzi | website legacy text says „prompty” – leave unless rewriting |
| Paid tier | płatny plan, płatne API | „płatny poziom” (calque) |
| Fair-use limit | limity uczciwego użytkowania; „w celu egzekwowania limitów uczciwego użytkowania” | „ograniczanie uczciwego korzystania” (inverts meaning) |
| Abuse monitoring | monitorowanie nadużyć | – |
| per month / minutes | miesięcznie; `200 min/mies.` in tables; unit symbol `min`, `s` (no dot) | – |

## 3. Numbers, plurals and placeholders
- Polish has three plural forms (1 minuta, 2–4 minuty, 5+ minut, 22 minuty). Never put a
  variable number before a full noun unless i18next plural keys exist. Use unit symbols
  (`{{seconds}} s`, `{{minutes}} min`) or a colon/parenthesis construction:
  `Pozostało w tym miesiącu: {{minutes}} min`, `…limit wprowadzania głosowego ({{minutes}} min)`.
- Fixed numbers in prose are fine as words agree: `do 5 minut`, `200 minut miesięcznie`.
- Decimal comma (`1,67`), currency after the number (`19,99 USD`, `49,99 zł`).

## 4. Punctuation and typography
- Quotes: `„…”` (website/app legal already use „…”). Straight `'…'` around button names in old
  FAQ strings is legacy; use `„…”` in new text.
- Dashes: both files use the spaced em dash (pauza) ` — ` as the dominant convention (app 23×,
  website 24×). Use ` — ` in new strings; en dash only for ranges (`30–60 sekund`).
- Comma before `zamiast` + infinitive (`Mów, zamiast pisać`) – treated as an equivalent of a
  subordinate clause (Poradnia PWN). Close the insertion with a comma if the sentence continues.
- Month names are lowercase in running text. `lastUpdatedDate` values are capitalised
  (`Listopad 2026`) consistently across privacy/terms in both repos; keep consistent, see §7.

## 5. UI microcopy conventions
- Dialog titles as infinitive questions: `Usunąć wpis?`, `Zamienić mowę na tekst za pomocą Google?`
- Error = what happened + what to do: `Transkrypcja nie powiodła się. Spróbuj ponownie.`
- Keep buttons to 1–2 words; status chips under ~30 characters.
- `mówić w języku` / `w języku, w którym mówisz` (not `językiem, którym mówisz` in this sense).

## 6. Legal (RODO) vocabulary
Source: Polish text of Regulation (EU) 2016/679 (RODO) on EUR-Lex; EDPB Polish documents.
- GDPR → **RODO**; EEA → **EOG** (Europejski Obszar Gospodarczy).
- appropriate safeguards (art. 46) → **odpowiednie zabezpieczenia**.
- adequacy decision (art. 45) → statute: „decyzja stwierdzająca odpowiedni stopień ochrony”;
  „decyzja o adekwatności” is widely used and is the file's existing form – acceptable.
- Standard Contractual Clauses → **standardowe klauzule umowne (SCC/SKU)** – lowercase common
  noun (RODO text: „standardowe klauzule ochrony danych”).
- transfer of data → **przekazywanie danych** (do państwa trzeciego).
- controller / processor → administrator / podmiot przetwarzający; consent → zgoda.
- Possessive referring to Google after a feminine noun: write `modeli Google`, not `jej modeli`.
- Facts to preserve exactly: 5 min per recording; 200 min per month; Plus only; audio sent to
  Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted;
  Google's paid tier does not train on the data; Google may retain data for a limited time
  for abuse monitoring.

## 7. Known pitfalls and open owner decisions
- Calques seen in MT drafts: „czysty tekst”, „Transkrybować Twój głos”, „zdecydować się nie
  korzystać” (→ „zrezygnować z”), „zgodnie ze swoimi zasadami” right after „egzekwowania
  zasad” (→ „zgodnie ze swoją aktualną polityką”), „Gemini od Google” (→ „model Gemini firmy
  Google”).
- Case errors inside lists (`…, Analiza aktywności i …` → accusative `analizę aktywności`).
- Imperfective participle for a finished action: `przetranskrybowanego`, not `transkrybowanego`.
- Open: `lastUpdatedDate` values are capitalised after a colon („Ostatnia aktualizacja:
  Listopad 2026”); orthographically `listopad 2026` is correct. Change all of them together or
  none.

## Sources
- Microsoft Polish localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- RODO art. 46, Polish text: https://gdpr-text.com/pl/read/article-46/ (mirrors EUR-Lex 2016/679)
- EDPB/EDPS joint opinion on SCCs (PL): https://edpb.europa.eu/system/files/2021-05/edpb_edps_jointopinion_202102_art46sccs_pl.pdf
- EDPB, Międzynarodowe przekazywanie danych: https://www.edpb.europa.eu/node/386_pl
- Apple PL, Siri i Dyktowanie: https://support.apple.com/pl-pl/127070
- Samsung community PL („Wprowadzanie głosowe Samsung” vs „pisanie głosowe Google”): https://eu.community.samsung.com/t5/aplikacje-i-us%C5%82ugi/klawiatura-i-wpisywanie-g%C5%82osowe-po-polsku/td-p/1051547/page/15
- Poradnia językowa PWN (comma with „zamiast” + bezokolicznik): https://sjp.pwn.pl/poradnia
