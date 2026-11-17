# Korean (ko) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/ko.json`) and the website's UI, FAQ and legal strings.
Blog prose follows the website's long-form standard
(`ownjournal_webpage/ownjournal-website/.claude/locale-standards/ko.md`). Its rules on avoiding
당신, calques and loanwords also apply here. Its advice to avoid "엔트리/항목" in essays does NOT
apply to the UI, where 항목 is the established term.

## 1. Register and address (house rule, both repos)
- **합니다체** for statements. Instructions use **-하세요** everywhere in the app (UI, Help, errors):
  "다시 시도하세요", "탭하세요". Do not use "-해 주세요" for 하다 verbs in the app (normalized
  2026-11). "-어 주세요" with other verbs ("기다려 주세요") is fine. Never 해요체 (`-어요/-예요`).
- Legal text (both repos): 합니다체 + **-하십시오 / -해 주십시오**, "we" = **당사**, "you" = **귀하**.
  Never 저희, 우리 or "사용자" for "you" in legal text ("사용자별", "다른 사용자" are fine).
- UI and marketing: no pronoun for "you"; where one is needed use **나/내** ("내 생각을 위한 안전한
  공간", "키는 오직 나만 가지고 있습니다") or **본인**. Never 당신. "we" = **저희** in UI, Help and
  website FAQ/marketing; never 우리.
- Status/progress lines are noun + "중": "텍스트로 변환 중…", "동기화 중…".
- Dialog titles that ask a question end in "-ㄹ까요?" or "-하시겠습니까?".

## 2. Glossary (term → use → avoid)
| English | Korean | Avoid / note |
|---|---|---|
| Voice entry | 음성 입력 | 보이스 엔트리 |
| Dictate | 받아쓰기 | 딕테이션 |
| Recording / file size | 녹음 / 녹음 파일 | 레코딩 |
| Transcribe / transcript | 텍스트로 변환(하다) / 변환된 텍스트 | 전사, 트랜스크립트 |
| Tap / Click | follow English: Tap → 탭하다, Click → 클릭하다 | 터치하다; website FAQ may use 누르다 |
| Entry | 항목 (app UI); 일기 (website, running prose) | 엔트리 |
| Journal (the whole app/data) | 일기장 | 저널 (except blog "저널링") |
| Editor | 편집기 | 에디터 |
| Provider (storage/AI/payment) | 제공업체 | 공급자 (removed 2026-11) |
| Access (noun/verb) | 접근(하다) | 액세스 — except fixed terms "액세스 토큰", CloudKit "API 액세스" |
| Source / target (transfer) | 원본 / 대상 | 소스 |
| Reset all data / reset limits | 초기화 ("모든 데이터 초기화", "다음 달에 초기화됩니다") | – |
| Reset password / encryption setup | 재설정 | – |
| Cannot be undone | 이 작업은 되돌릴 수 없습니다 | 취소할 수 없습니다 |
| Danger Zone | 위험 구역 | 위험 영역 |
| End-to-end encryption | 종단 간 암호화 (spaced, both repos) | 종단간, 엔드투엔드 |
| Zero-knowledge architecture | 영지식 아키텍처 | 제로 지식, 제로 지식 설계 |
| Simple mode | 단순 모드 | Simple 모드, 심플 모드 |
| Private AI (on-device) | 비공개 AI; label suffix "(비공개)" | 개인 AI |
| Mood | 기분 (both repos: 기분 기록, 기분 달력, 기분 통계) | 감정 for "mood" (감정 = emotion) |
| Mood levels | 최고, 좋음, 보통, 나쁨, 최악 | – |
| Theme(s) (AI analysis) | 주제 | 테마 |
| Suggestions | 제안 | 추천 |
| Activity Insights | 활동 분석 | 활동 인사이트 |
| Social (activity) | 만남 | 사교 활동 |
| Photo Memories | 사진 추억 | 포토 메모리 |
| Multi-device sync | 다중 기기 동기화 | 멀티 기기 |
| Self-hosted | 자체 호스팅 | 셀프 호스팅 |
| Plus | Plus, Plus 구독, **Plus 구독자** | Plus 사용자, 플러스 |
| Plan / paid tier | 요금제; API paid tier → 유료 요금제 | 플랜 (only when quoting Stripe's '플랜 취소' button), 유료 등급 |
| Free trial | 무료 체험 / 체험 기간 | 평가판 |
| Abuse (monitoring/prevention) | 악용 | 남용 |
| Model training | 모델 학습 | 모델 훈련 |
| Device | 기기 | 디바이스, 장치 |
| Storage | 저장소 | 스토리지 |
| Terms of Service | 이용약관 | 이용 약관 |
| Privacy Policy | 개인정보 처리방침 (PIPC spelling) | 개인정보처리방침 |
| Last updated (legal) | 최종 업데이트: {{date}} (both repos) | 마지막 업데이트 |
| Exports | PDF/Word 내보내기 (app), PDF 및 Word 내보내기 (website) | keep each repo's form |

Product names are never altered: Google Drive is "Google 드라이브" in app UI (Google's Korean
brand) and "Google Drive" in legal text and on the website — pre-existing split, see section 6.

## 3. Legal / privacy vocabulary (KISA GDPR translation + PIPA, both repos)
- appropriate safeguards → **적정한 안전조치**; SCCs → **표준계약조항(SCC)**; adequacy decision →
  **적정성 결정**; European Commission → **유럽연합 집행위원회**; EEA → **유럽경제지역(EEA)**;
  technical and organisational measures → **기술적·관리적 조치**.
- International transfers → **개인정보의 국외 이전**. Controller → **개인정보 컨트롤러**.
  DPO → **개인정보 보호책임자(DPO)**, designate → 지정. Supervisory authority → **감독기관**.
- Rights: 열람, 이동권, 정정, 삭제(삭제권), 처리 제한, 처리 반대, 감독기관에 민원 제기.
- Third-party → **제3자** (제3자 서비스, 제3자 쿠키). Legitimate interests → 정당한 이익.
- Retention → **보관** (데이터 보관). Age → "만 13세". Termination → 종료.
- "maintains safeguards" → "마련하고 있습니다". "under your control" → "통제하에" (attached).
- Avoid nested parentheses and periods inside parentheses; split the sentence instead.
- "in seconds" → "초 단위". Never "시간(초)".
- `legal.privacy.aiProcessing.content` must be byte-identical in app and website.
- Facts must stay exact: 5 min per recording, 200 min per month, Plus only, audio goes to Google
  (Gemini), OwnJournal stores neither audio nor transcripts, only seconds are counted, paid tier =
  no training, Google may retain data for a limited time only for abuse monitoring.
- Dates: "2026년 11월" style in both repos.

## 4. Punctuation and typography
- Halfwidth Western punctuation (. , ? !), no space before. No full-width （）, no 「」 corner
  brackets (Japanese drift; removed 2026-11).
- Ellipsis: always **…** (U+2026). "..." was normalized file-wide in 2026-11.
- Dash: spaced em dash **" — "** wherever English has a dash; never " - " or " – ".
- Ranges: **~** ("24~48시간", "30~60초").
- No space between a Hangul word and "(": "다국어(100개 이상 언어)", "새로 시작(권장)". Keep the
  space before list markers "(a)", "(1)" in legal text.
- Quotes: **'…'** for UI labels and cited words ('설정 도움말', '연결', '음'); **"…"** for text the
  user must type ("DELETE ALL"), entry titles ("{{title}}") and quoted terms in legal text.
- Particles after placeholders whose value varies: **{{target}}(으)로**, **{{provider}}와(과)**,
  을(를), 이(가). Prefer rephrasing when possible ("{{format}} 형식으로", "{{format}} 파일을").
  Particle after a typed literal follows its pronunciation ("DELETE ALL"을, "DELETE"를).
- Relative-time placeholders already contain "전" ("5분 전"), so write "{{time}} 동기화됨".
- "words" limits → 단어 (not 자, which means characters).
- Spacing per 국립국어원: 종단 간, 문장 부호, 한 번 (once) vs 한번 (sometime), 새로고침 (UI form).
- No serial comma: "A, B, C 및 D".

## 5. UI microcopy conventions
- Buttons: noun phrase ("녹음 취소", "변환 다시 시도", "계속"), not a full sentence.
- Errors: problem in 합니다체, then the fix with -하세요; give the verb an object.
- Step lists in Help end every step with -하세요 (no bare nouns like "…로 이동").
- Website feature-card descriptions ≈30 characters, no final period.
- Website pricing lists: may be reworded but keep the exact Free/Plus entitlements and order.
- Prefer native verbs (바뀝니다, 정리됩니다) in marketing; 변환 is fine in UI status and legal.

## 6. Known open items (owner decision)
- Google Drive: app UI "Google 드라이브" (≈28×) vs legal/website "Google Drive" (≈15×). Not
  unified because product names must not be altered.
- Email + particle: "support@ownjournal.app로" kept as is (common usage).

## Sources
- Microsoft Korean localization style guide: https://aka.ms/korean-styleguide
- Korean GDPR text (KISA translation), Art. 4, 37, 46: https://gdpr-text.com/ko/read/article-46/
- PIPC 개인정보 처리방침 작성지침: https://www.pipc.go.kr
- Apple iPhone guide (ko-kr), "iPhone에서 텍스트 받아쓰게 하기":
  https://support.apple.com/ko-kr/guide/iphone/iph2c0651d2/ios
- 국립국어원 한글 맞춤법 (띄어쓰기, 문장 부호): https://korean.go.kr
