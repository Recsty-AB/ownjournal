# Polish (pl) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/pl.json`) and the website's UI/pricing/FAQ/legal strings
(`ownjournal-website/src/i18n/locales/pl.json`). Long-form blog prose follows the website's
standard (`ownjournal-website/.claude/locale-standards/pl.md`), which shares the informal `ty`
register but not its blog-only rules (scene openers, citations, particles).

## 1. Register and address (house style, both repos)
- Informal **ty** everywhere, UI and legal; never `Pan/Pani/Państwo`, never impersonal
  `Proszę…`/`prosimy o…` (→ `Nie zamykaj aplikacji.`, `Skontaktuj się z nami.`).
- Pronouns addressing the user are **capitalised**: `Twój`, `Twoje`, `Twoim`, `Ci`, `Cię`, `Ciebie`.
- Imperatives in 2nd person singular: `Dotknij…`, `Zaloguj się…`, `Spróbuj ponownie.`
- No gendered past forms or adjectives about the user (`zapomniałeś`, `rejestrowałeś się`,
  `Zostałeś wylogowany`, `Gotowy?`, `jesteś odpowiedzialny`, `Będziesz musiał`). Use present
  tense, impersonal or passive: `Nie pamiętasz hasła?`, `Konto założone przez Google?`,
  `Wylogowanie przebiegło pomyślnie`, `Osiągnięto limit…`, `Odpowiadasz za…`,
  `trzeba będzie wprowadzić hasło`, `Chcesz zacząć pisać?`, `Zalogowano — kontynuuj`.
- Progress/status lines: verbal noun + `…` (`Ładowanie…`, `Synchronizowanie…`, `Transkrybowanie…`).

## 2. Glossary (term → use → avoid)
| English | Polish | Avoid / note |
|---|---|---|
| Terms of Service | **Warunki korzystania z usługi**; in body text the defined term **Warunki** | „Warunki usługi”, „Regulamin”, „Warunki świadczenia usług” (one term, both repos) |
| Privacy Policy | Polityka prywatności | – |
| Legal (section) | Informacje prawne | „Prawne”, „Prawne i Polityki” |
| Cloud storage | **magazyn w chmurze**; storage provider → dostawca magazynu | „pamięć w chmurze” (UI and legal use the same term) |
| Simple mode | **tryb prosty** (also in legal) | „tryb Simple” |
| End-to-end encryption | szyfrowanie end-to-end (lowercase), short E2E | „Szyfrowanie End-to-End” |
| Zero-knowledge | **zero-knowledge** (`Architektura zero-knowledge`, `zasada zero-knowledge`) | „zero wiedzy”, „Zero Knowledge” |
| Upgrade to Plus | **Przejdź na Plus** | „Uaktualnij do Plus” |
| Free plan | **plan Bezpłatny** (plan name capitalised) | „plan darmowy” |
| Free trial | bezpłatny okres próbny | „darmowy okres próbny” |
| Plus | indeclinable: `w planie Plus`, `subskrypcja Plus`, `funkcja Plus` | „dostępne w Plus” |
| Insights (AI) | spostrzeżenia | „wglądy” (calque) |
| AI-powered | oparty na AI | „napędzany przez AI” |
| Sentiment | wydźwięk emocjonalny | „sentyment” |
| Multi-device sync | synchronizacja między urządzeniami | „synchronizacja wielu urządzeń” |
| Activity tagging | etykiety aktywności | „tagowanie aktywności” |
| Activity Insights | analiza aktywności (lowercase mid-sentence) | „Wgląd w aktywności” |
| Photo memories | Wspomnienia w zdjęciach | – |
| Self-hosted | samodzielnie hostowany / samodzielny hosting | „self-hosted”, „self-hosting” |
| Checkout | płatność | „kasa” |
| Payment processor | operator płatności | „procesor płatności” |
| Logs | logi (`Pobierz logi`) | „dzienniki” (clashes with *journal*) |
| Camera (QR scan) | aparat | „kamera” |
| Desktop (platform) | komputer | „desktop” |
| Origin (CORS) | źródło; header name stays `Origin` | „origin” as a Polish noun |
| Voice entry | Wprowadzanie głosowe | Google: „Pisanie głosowe”, Apple: „Dyktowanie” |
| Dictate / Tap | Dyktuj / Dotknij + gen. (`Dotknij mikrofonu`); button label → `Dotknij przycisku „Połącz”` | „Stuknij”; follow English: *Tap* → „Dotknij”, *Click* → „Kliknij” |
| Reset All Data (Danger Zone) | `„Zresetuj wszystkie dane”` in sekcja `„Strefa niebezpieczeństwa”` (= `storage.resetAllData`, `storage.dangerZone`) | „Usuń wszystko” in Help text |
| Transcribe / transcript | transkrybować / transkrypcja; speech-to-text → zamiana mowy na tekst | „Transkrybować Twój głos” |
| Clean (punctuated) text | uporządkowany tekst ze znakami interpunkcyjnymi | „czysty tekst” |
| Filler words | przerywniki | „słowa wypełniacze” |
| Entry / tag | wpis / tag | „notatka” for entry |
| AI | AI | SI |
| Subscription | subskrypcja | abonament |
| Prompts (legal) | zapytania i odpowiedzi | „prompty” |
| Paid tier | płatny plan, płatne API | „płatny poziom” |
| Fair-use limits | limity uczciwego użytkowania | „ograniczanie uczciwego korzystania” |
| Abuse monitoring | monitorowanie nadużyć | – |
| Acceptable Use | Dopuszczalne korzystanie | „Akceptowalne użytkowanie” |
| Apple Account (ex-Apple ID) | **konto Apple**, lowercase *k* mid-sentence, inflected (`Twojego konta Apple`, `na koncie Apple`, `Zaloguj się na swoje konto Apple`) | „Apple ID”, „Konto Apple” mid-sentence (Apple PL capitalises only at sentence/bullet start) |
| Sign in with Apple (button/feature) | **Zaloguj się, używając konta Apple** (Apple's official PL button; also `Kontynuuj, używając konta Apple`, `Zarejestruj się, używając konta Apple`) | „Zaloguj się przez Apple ID”; existing `Kontynuuj z Apple` (auth screen + Help) is house style, change both together if ever |

## 3. Numbers, plurals and placeholders
- **i18next plural keys (app):** every key that has `_one/_other` in en.json must have exactly
  `_one`, `_few`, `_many`, `_other` in pl.json (`Intl.PluralRules('pl')`); no base key. A missing
  category falls back to English. Put the number in the sentence with the right form:
  one `1 wpis`, few (2–4, 22–24…) `3 wpisy`, many (0, 5–21, 25…) `5 wpisów`, other (fractions)
  `1,5 wpisu` (genitive sg., neuter sg. verb: `1,5 wpisu nie jest zaszyfrowane`).
  Agree verbs/adjectives: `1 wpis wymaga` / `3 wpisy wymagają` / `5 wpisów wymaga`;
  `nie powiodła się 1 próba` / `nie powiodły się 3 próby` / `nie powiodło się 5 prób`.
  Prefer impersonal `-no` verbs (`Zsynchronizowano 3 wpisy`) and accusative/nominative frames;
  avoid frames that force the genitive plural after 2–4 under negation (`nie zmigrowano 3 wpisów`
  reads like an error). `{{count}} z {{total}} wpisów` and `Aktywne alerty ({{count}})` work
  for every category and may repeat the same text.
- **Non-plural keys:** never put a variable directly before a noun; use a colon or parenthesis
  (`Liczba słów we wpisie: {{wordCount}}.`).
- Unit symbols after a space, no dot: `5 MB`, `{{seconds}} s`, `{{minutes}} min`, `{{ms}} ms`,
  `Auto (15 s)`; days ago: `{{days}} d temu`; hours: `{{hours}} godz. temu`.
- Fixed numbers in prose agree normally: `do 5 minut`, `200 minut miesięcznie`, `200 min/mies.`
- Decimal comma (`1,67`), currency after the number (`19,99 USD`, `99 USD rocznie`);
  approximate → `ok. 1,67 USD/mies.` (not `~`).
- Website prices: never hard-code amounts or currencies; the code formats `{{price}}` and
  `{{monthly}}` in the visitor's currency (`Kosztuje {{price}} rocznie (ok. {{monthly}}/mies.).`,
  `ok. {{monthly}}/mies. • Anuluj w dowolnym momencie`).
- Never alter `{{placeholders}}`, even where code does not pass them.
- `auth.termsAgreement` is one `<Trans>` sentence with exactly one `<terms>…</terms>` and one
  `<privacy>…</privacy>` pair, links in the instrumental, final full stop:
  `Kontynuując, zgadzasz się z naszymi <terms>Warunkami korzystania z usługi</terms> i
  <privacy>Polityką prywatności</privacy>.` (old prefix/suffix/`and` keys are gone).
- `moodCorrelations.tooltipDetail_*`: `{{delta}} (śr.: {{emoji}} {{avg}}; {{count}} wpisy)` —
  semicolon before the count, because a comma right after a decimal number reads as a decimal
  comma (`3,4, 5 wpisów`). Code currently passes `avg`/`delta` via `toFixed(1)` (dot).
- `company.country` is **`Szwecji`** (genitive = locative). It is only interpolated into legal
  sentences that need that case: `zarejestrowana w {{companyCountry}}`,
  `podlegają prawu {{companyCountry}}`, `W {{companyCountry}} jest to …`.

## 4. Punctuation and typography (whole files, both repos)
- Ellipsis: always the single character `…` (no `...` anywhere).
- Quotes: always `„…”` – button names, UI paths, legal terms (`„w stanie, w jakim się znajduje”`).
  No straight `"…"`/`'…'`. Apostrophe in inflected brand names: `iPhone’a`.
- Menu paths use ` → ` (`Ustawienia → Magazyn`, `przejdź do sekcji Aplikacje → Bezpieczeństwo`),
  never ` > `.
- Dashes: spaced em dash ` — ` for parenthetical/explanatory dashes (never ` - ` or ` – `);
  en dash without spaces for ranges (`24–48 godzin`, `30–60 sekund`). Markdown list hyphens
  (`- listy`) stay.
- Lowercase after a colon in running text (`Wskazówka: hasło możesz…`, `Plus: zasugeruj tagi`);
  numbered headings (`Krok 1: Znajdź…`) keep the capital.
- Comma before `zamiast` + infinitive (`Mów, zamiast pisać`) and before `gdy/kiedy/zanim/ile`.
- **Dates: month names lowercase** in all legal dates, privacy and terms, both repos:
  `Ostatnia aktualizacja: listopad 2026` (`legal.lastUpdatedOn` = `Ostatnia aktualizacja: {{date}}`).

## 5. UI microcopy conventions
- Dialog titles as infinitive questions: `Usunąć wpis?`, `Zamienić mowę na tekst za pomocą Google?`
- Error = what happened + what to do: `Transkrypcja nie powiodła się. Spróbuj ponownie.`
- Name UI targets with a noun: `przejdź do sekcji „Tryb AI”`, `użyj opcji „Zmień hasło”`.
- Details pointer: `Szczegóły znajdziesz w konsoli.` (not „Sprawdź … po szczegóły”).
- Buttons 1–2 words; status chips under ~30 characters.
- Badge pair in the sign-in screen: `Szyfrowanie` / `end-to-end` (title / subtitle).

## 6. Legal (RODO) vocabulary
Source: Polish text of Regulation (EU) 2016/679 (RODO) on EUR-Lex; EDPB Polish documents.
- GDPR → **RODO**; EEA → **EOG**; supervisory authority → **organ nadzorczy**.
- Rights: dostęp, **sprostowanie**, usunięcie („prawo do bycia zapomnianym”), ograniczenie
  przetwarzania, **przenoszenie danych**, sprzeciw, skarga do organu nadzorczego.
- Legal bases (lowercase in lists): wykonanie umowy, **prawnie uzasadnione interesy**, zgoda.
- DPO → **inspektor ochrony danych (IOD)**, lowercase.
- Transfers → **przekazywanie danych**; title `Międzynarodowe przekazywanie danych`;
  adequacy decision → `decyzja stwierdzająca odpowiedni stopień ochrony`;
  SCC → `standardowe klauzule umowne (SCC)`, lowercase; art. 46 → `odpowiednie zabezpieczenia`.
- Controller / processor → administrator / podmiot przetwarzający; consent → zgoda.
- Warranty disclaimers: „w stanie, w jakim się znajduje” (*as is*), „w miarę dostępności”
  (*as available*); negligence → niedbalstwo; statutory rights → prawa ustawowe.
- Consumer withdrawal → `prawo odstąpienia od umowy`; `Okres przechowywania danych` (retention)
  is distinct from `Przechowywanie danych` (storage).
- Section titles shared by both repos: `Wprowadzenie`, `Usługi zewnętrzne`,
  `Zmiany w tej polityce`, `Skontaktuj się z nami`, `Architektura zero-knowledge`.
- The website no longer has a `legal` block (its privacy/terms pages use the app's text); legal
  wording lives only in the app file.
- AI requests and voice recordings pass **through our servers only in transit**:
  `wysyłany za pośrednictwem naszych serwerów do …`, DPO text: `przechodzi przez nasze serwery
  wyłącznie w trakcie przesyłania do naszego dostawcy AI i nie jest przechowywane`.
- Refund FAQ (website) mirrors Terms §5: withdrawal within 14 days for EU/EEA-type consumers
  buying on the website, proportionate amount may be kept, App Store/Google Play refunds by
  Apple/Google; impersonal `jeśli z Plus już korzystano`, `subskrypcja Plus została kupiona`.
- Refer to Google as `firma Google` / `modele Google` (not `jej modeli`, not `przez ich API`).
- Facts to preserve exactly: 5 min per recording; 200 min per month; Plus only; audio sent to
  Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted;
  Google's paid tier does not train on the data; Google may retain data for a limited time
  for abuse monitoring.

## 7. Known pitfalls
- Calques seen in MT drafts: „czysty tekst”, „Transkrybować Twój głos”, „zdecydować się nie
  korzystać” (→ „zrezygnować z”), „Wnosisz własny magazyn” (→ „podłączasz własny magazyn”),
  „Gemini od Google” (→ „model Gemini firmy Google”), „logowanie społecznościowe”
  (→ „logowanie przez Google lub Apple”), „Kasa niedostępna”, „{{count}} konflikt(ów) zalogowanych”
  (*zalogowany* = signed in; use „zarejestrowane konflikty”).
- Case errors inside lists (`…, Analiza aktywności i …` → `analizę aktywności`).
- Perfective participle for a finished action: `przetranskrybowanego`.
- Agreement: `Obaj dostawcy`, `Niektórzy dostawcy hostingu`, `długi wpis` (masc.).
- Apple is neuter in this file (`Apple nie mogło`, `Apple … przyjęło`).
- `export.entryCount_*` and `moodCorrelations.entryCount_*` are full `{{count}} + noun` plural
  keys (the old concatenated `tooltipEntries`/`export.entries` are gone).
- `syncDiagnostics.reopens` receives `{{time}}` from date-fns `formatDistanceToNow` without a
  locale, so the time phrase renders in English (code-side).

## Sources
- Microsoft Polish localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- RODO art. 46, Polish text: https://gdpr-text.com/pl/read/article-46/ (mirrors EUR-Lex 2016/679)
- EDPB/EDPS joint opinion on SCCs (PL): https://edpb.europa.eu/system/files/2021-05/edpb_edps_jointopinion_202102_art46sccs_pl.pdf
- EDPB, Międzynarodowe przekazywanie danych: https://www.edpb.europa.eu/node/386_pl
- Apple PL, Siri i Dyktowanie: https://support.apple.com/pl-pl/127070
- Samsung community PL („Wprowadzanie głosowe Samsung” vs „pisanie głosowe Google”): https://eu.community.samsung.com/t5/aplikacje-i-us%C5%82ugi/klawiatura-i-wpisywanie-g%C5%82osowe-po-polsku/td-p/1051547/page/15
- Apple PL Personal Safety User Guide (Oct 2026; „konto Apple”, „Zaloguj się, używając konta Apple”, no „Apple ID”): https://help.apple.com/pdf/personal-safety/pl_PL/personal-safety-user-guide-pl_PL.pdf
- Apple PL, Funkcja Zaloguj się, używając konta Apple i prywatność: https://support.apple.com/pl-pl/HT210699
- Apple Sign in with Apple JS, Polish button strings: https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/pl_PL/appleid.auth.js
- Poradnia językowa PWN (comma with „zamiast” + bezokolicznik; lowercase after colon; month names): https://sjp.pwn.pl/poradnia

## 8. Dreams glossary (2026-11-19)
| English | Polish | Avoid / source |
|---|---|---|
| Dream / Dreams (chip, filter) | Sen / Sny; dream journal → dziennik snów | judgment |
| Dream reflection (feature) | **Refleksja nad snem**; countable: `30 refleksji`, `utworzyć refleksję` | „Analiza snu”, „Interpretacja snu” (implies a verdict) — judgment |
| Reflect on this dream (button) | **Utwórz refleksję**; again → **Utwórz nową refleksję** | „Przyjrzyj się snowi” (tells the user to look; clashes with `utworzyć refleksję` everywhere else) |
| Dream patterns | **Wzorce snów**; the report → raport „Wzorce snów” | judgment |
| Nightmare / lucid / recurring | Koszmar / Świadomy (świadomy sen) / Powracający, under heading „Rodzaj snu” | pl.wikipedia „Świadomy sen” |
| Anxiety / fear (feeling chips) | **Niepokój** / Strach | „Lęk” next to „Strach” (near-synonyms for lay readers); doz.pl pairs „strach i niepokój” |
| Awe / confusion | Zachwyt / Dezorientacja | „Podziw”, „Zagubienie” — judgment |
| Monthly remaining count | `Pozostało w tym miesiącu: {{remaining}} z {{limit}} refleksji` (mirrors `voice.minutesLeft`) | „Pozostałe refleksje: …” (reads as *the other reflections*) |
| Amount measured in tokens (legal) | ilość wykorzystanego przetwarzania przez AI mierzona w tokenach | „zakres” (= scope; RODO „zakres przetwarzania”) |
| Take what fits, leave the rest | Weź z niej to, co do Ciebie przemawia, a resztę zostaw. | „Zatrzymaj to, co…” (two parses: keep / stop) |
| Crisis line / emergency number | telefon zaufania / numer alarmowy | gov.pl zdrowie |
