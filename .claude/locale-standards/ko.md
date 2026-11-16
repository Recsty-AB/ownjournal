# Korean (ko) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/ko.json`) and the website's UI, FAQ and legal strings.
Blog prose follows the website's long-form standard
(`ownjournal_webpage/ownjournal-website/.claude/locale-standards/ko.md`). Its rules on avoiding
당신, calques and loanwords also apply here. Its advice to avoid "엔트리/항목" in essays does NOT
apply to the UI, where 항목 is the established term.

## 1. Register and address (house style)
- **합니다체** for statements (≈380 `-습니다` in the app, no 해요체 statements). Instructions use the
  polite imperative **-하세요** ("다시 시도하세요", "로그인하세요"). "-해 주세요" also appears, but
  less often. Do not mix in 해요체 (`-어요/-예요`).
- No 당신. In UI copy, drop the pronoun. In legal text, **귀하** (app) is the established form.
  The app's privacy policy uses **당사** for "we". The website's privacy policy is mostly
  subjectless and uses 당사 when a subject is needed. 저희 is fine in website FAQ answers but not in
  legal text.
- Status/progress lines are noun + "중": "텍스트로 변환 중…", "동기화 중...".
- Dialog titles that ask a question end in "-ㄹ까요?" ("Google을 통해 음성을 텍스트로 변환할까요?").

## 2. Glossary (term → use → avoid)
| English | Korean | Avoid / note |
|---|---|---|
| Voice entry (feature) | 음성 입력 | 보이스 엔트리, 음성 일기 |
| Dictate (button/aria) | 받아쓰기 (Apple iOS term: "텍스트 받아쓰게 하기") | 딕테이션 |
| Speak instead of typing | 타이핑 대신 말로 입력하세요 / 말하면 | bare "말하세요" (sounds like a command to talk) |
| Recording | 녹음; file-size context → 녹음 파일 | 레코딩 |
| Audio | 오디오 | – |
| Transcribe / transcription | 텍스트로 변환(하다) / 텍스트 변환 | 전사 (used in academia, odd in UI) |
| Transcript | 변환된 텍스트 | 트랜스크립트 |
| "to be transcribed" (purpose) | 텍스트 변환을 위해 | "텍스트로 변환되도록" (passive calque) |
| Microphone access | 마이크 접근 | – |
| Tap | 탭하다 (app help) / 누르다 (website FAQ, casual) | 터치하다 |
| Stop / Cancel / Discard | 중지 / 취소 / 삭제 (녹음 삭제) | 폐기 |
| Retry | 다시 시도 (button), 재시도 (short labels) | – |
| Continue / Not now | 계속 / 나중에 | – |
| Entry | 항목 (app UI); 일기 (website, running prose) | 엔트리 |
| Editor | 편집기 | 에디터 (one older occurrence exists) |
| Punctuation | 문장 부호 | 구두점 (acceptable but less common) |
| AI | AI | 인공지능 in UI labels |
| Plus | Plus, Plus 구독, Plus 구독자, (Plus 기능) | 플러스 |
| Plan / paid tier | 요금제; API paid tier → 유료 요금제 | 유료 등급 (calque of "tier") |
| Fair-use limit | 공정 사용 한도 (적용하다) | 공정 사용 제한 |
| Abuse monitoring | 악용 모니터링 | – |
| Exports | PDF/Word 내보내기 (app), PDF 및 Word 내보내기 (website) | keep each repo's form |
| per month / minutes | 매월 200분, 월 200분; "{{minutes}}분", "{{seconds}}초" | – |

Counters: Korean numbers + 분/초 have no plural problems. "{{seconds}}초 후 중지" and
"이번 달 {{minutes}}분 남음" work for any number.

## 3. Legal / privacy vocabulary
- Korean GDPR translation (KISA, gdpr-text.com/ko): Art. 46 "appropriate safeguards" →
  **적정한 안전조치**; adequacy decision → **적정성 결정**; data subject → **정보주체**;
  third country → **제3국**.
- House style already uses **적절한 보호 조치** and **표준 계약 조항(SCC)** (app
  internationalTransfers/aiProcessing). Keep these consistent within a file. If the policy is
  rewritten, consider switching to KISA terms throughout, never in one paragraph only.
- Korean PIPA terms: 개인정보 처리방침, 국외 이전, 개인정보 보호책임자.
- "maintains safeguards" → "보호 조치를 마련하고 있습니다". Avoid "유지합니다" (calque).
- Avoid nested parentheses ("(현재 Google(Gemini))") and periods inside parentheses. Split the
  sentence instead ("이 카운터에는 … 기록되며, 내용은 절대 포함되지 않습니다.").
- "in seconds" → "초 단위" / "길이(초)". Never "시간(초)": 변환된 시간 can read as "time of conversion".
- Facts must stay exact: 5 min per recording, 200 min per month, Plus only, audio goes to
  Google (Gemini), OwnJournal stores neither audio nor transcripts, only seconds are counted,
  paid tier = no training, Google may retain data for a limited time for abuse monitoring.

## 4. Punctuation and typography
- Halfwidth Western punctuation (. , ? !) with no space before. Korean does not use full-width CJK
  punctuation.
- Ellipsis: the app mostly uses "..." (≈99), with "…" in newer strings (≈6). Both are accepted.
  Do not mass-convert.
- Spaced em dash " — " in feature lists ("음성 입력 — 월 200분").
- Quotes in prose: '…' for cited words ('음', '어'), "…" for titles.
- Spacing: follow 국립국어원 rules. 종단 간 is standard, but the website uses 종단간 18 times, so
  keep the house form within that file. "문장 부호" is spaced. "한 번" (once) is spaced, and
  "한번" means "sometime".
- No serial comma: "A, B, C 및 D" or "A, B, C".

## 5. UI microcopy conventions
- Buttons: noun phrase ("녹음 취소", "변환 다시 시도", "계속"), not a full sentence.
- Errors: state the problem in 합니다체, then the fix with -하세요. Give the verb an explicit
  object when it is unclear ("…설정에서 마이크 접근을 허용하세요.").
- Keep website feature-card descriptions at about 30 characters or fewer, with no final period
  (house pattern).
- Prefer native verbs over 하다 + loan: 바뀝니다 / 정리됩니다 instead of 변환됩니다 in marketing copy.
  변환 is fine in UI status and legal text.

## Sources
- Microsoft Korean localization style guide: https://aka.ms/korean-styleguide
- Korean GDPR text (KISA translation), Art. 46: https://gdpr-text.com/ko/read/article-46/
- Apple iPhone guide (ko-kr), "iPhone에서 텍스트 받아쓰게 하기":
  https://support.apple.com/ko-kr/guide/iphone/iph2c0651d2/ios
- 국립국어원 한글 맞춤법 (띄어쓰기): https://korean.go.kr
- House usage counts from `src/i18n/locales/ko.json` (app) and the website `ko.json`.
