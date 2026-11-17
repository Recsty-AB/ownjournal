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
| Dictate / Tap | Dyktuj / Dotknij + gen. (`Dotknij mikrofonu`) | „Stuknij”; „Kliknij” only web/desktop |
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

## 3. Numbers, plurals and placeholders
- Polish has three plural forms; the app has no i18next plural keys. Never put `{{count}}`
  (or any variable) directly before a noun. Use a colon or a parenthesis:
  `Zsynchronizowano wpisy ({{count}}).`, `Przeanalizowane wpisy: {{count}}`,
  `Liczba słów we wpisie: {{wordCount}}.` Constructions `{{count}} z {{total}} wpisów` are fine.
- Unit symbols after a space, no dot: `5 MB`, `{{seconds}} s`, `{{minutes}} min`, `{{ms}} ms`,
  `Auto (15 s)`; days ago: `{{days}} d temu`; hours: `{{hours}} godz. temu`.
- Fixed numbers in prose agree normally: `do 5 minut`, `200 minut miesięcznie`, `200 min/mies.`
- Decimal comma (`1,67`), currency after the number (`19,99 USD`, `99 USD rocznie`);
  approximate → `ok. 1,67 USD/mies.` (not `~`).
- Never alter `{{placeholders}}`, even where code does not pass them.
- `company.country` is **`Szwecji`** (genitive = locative). It is only interpolated into legal
  sentences that need that case: `zarejestrowana w {{companyCountry}}`,
  `podlegają prawu {{companyCountry}}`, `W {{companyCountry}} jest to …`.

## 4. Punctuation and typography (whole files, both repos)
- Ellipsis: always the single character `…` (no `...` anywhere).
- Quotes: always `„…”` – button names, UI paths, legal terms (`„w stanie, w jakim się znajduje”`).
  No straight `"…"`/`'…'`. Apostrophe in inflected brand names: `iPhone’a`.
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

## 6. Legal (RODO) vocabulary – same wording in app and website
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
- `legal.privacy.aiProcessing.content` must be byte-identical in app and website.
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
- Code-side limits (cannot be fixed in JSON): `moodCorrelations.tooltipEntries` and
  `export.entries` are concatenated after a bare number (`5 wpisów`, `3 wpisy`); a correct form
  for every number needs plural keys or a code change.

## Sources
- Microsoft Polish localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- RODO art. 46, Polish text: https://gdpr-text.com/pl/read/article-46/ (mirrors EUR-Lex 2016/679)
- EDPB/EDPS joint opinion on SCCs (PL): https://edpb.europa.eu/system/files/2021-05/edpb_edps_jointopinion_202102_art46sccs_pl.pdf
- EDPB, Międzynarodowe przekazywanie danych: https://www.edpb.europa.eu/node/386_pl
- Apple PL, Siri i Dyktowanie: https://support.apple.com/pl-pl/127070
- Samsung community PL („Wprowadzanie głosowe Samsung” vs „pisanie głosowe Google”): https://eu.community.samsung.com/t5/aplikacje-i-us%C5%82ugi/klawiatura-i-wpisywanie-g%C5%82osowe-po-polsku/td-p/1051547/page/15
- Poradnia językowa PWN (comma with „zamiast” + bezokolicznik; lowercase after colon; month names): https://sjp.pwn.pl/poradnia
