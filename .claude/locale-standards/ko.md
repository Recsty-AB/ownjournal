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
| Plan / paid tier | 요금제; API paid tier → 유료 요금제; "cancel your plan" → 요금제를 취소 | 플랜, 유료 등급 (no Stripe button label is quoted any more) |
| Free trial | 무료 체험 / 체험 기간 | 평가판 |
| Abuse (monitoring/prevention) | 악용 | 남용 |
| Model training | 모델 학습 | 모델 훈련 |
| Device | 기기 | 디바이스, 장치 |
| Storage | 저장소 | 스토리지 |
| Terms of Service | 이용약관 | 이용 약관 |
| Privacy Policy | 개인정보 처리방침 (PIPC spelling) | 개인정보처리방침 |
| Last updated (legal) | 최종 업데이트: {{date}} (both repos) | 마지막 업데이트 |
| Exports | PDF/Word 내보내기 (app), PDF 및 Word 내보내기 (website) | keep each repo's form |
| Apple ID / Apple Account | **Apple 계정** (Apple renamed it in 2024; ko-kr pages say "Apple 계정(이전의 Apple ID)") | Apple ID |
| Sign in with Apple (button/feature) | **Apple로 로그인** (Apple's official Korean name); generic "Apple 로그인 창" is fine | Apple ID로 로그인 |
| Google Drive | **Google 드라이브** (Google's official Korean name) everywhere: app UI, Help, legal, website | Google Drive, 구글 드라이브 |
| iCloud Drive, Dropbox, Nextcloud | unchanged (Apple's Korean UI also says "iCloud Drive") | – |
| via our servers (in transit) | 당사 서버를 거쳐 (legal) / "전송되는 과정에서만 당사 서버를 거치며 보관되지 않습니다" | – |

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
- `legal.privacy.aiProcessing.content` lives only in the app (the website legal block was removed
  2026-11); it states that text and recordings go to Google (Gemini) via our servers, not stored.
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
  **{{companyEmail}}(으)로**,
  을(를), 이(가). Prefer rephrasing when possible ("{{format}} 형식으로", "{{format}} 파일을").
  Particle after a typed literal follows its pronunciation ("DELETE ALL"을, "DELETE"를,
  "support@ownjournal.app으로" — .app is read 앱). Prefer invariant particles: "{{provider}}에 연결".
- Relative-time placeholders already contain "전" ("5분 전"), so write "{{time}} 동기화됨".
- "words" limits → 단어 (not 자, which means characters).
- Spacing per 국립국어원: 종단 간, 문장 부호, 한 번 (once) vs 한번 (sometime), 새로고침 (UI form).
- No serial comma: "A, B, C 및 D".

## 5. UI microcopy conventions
- **Plurals**: Korean has one CLDR category (`other`). Every English `_one/_other` key gets ONLY
  `key_other` in ko.json (no `_one`, no bare key). Write the number with a counter: "{{count}}개 항목",
  "항목 {{count}}개", "{{count}}회", "{{count}}건". Never "{{count}} 항목" or "편" for entries.
- Link sentences are ONE `<Trans>` string with the verb after the links (SOV), e.g.
  `auth.termsAgreement` = "계속하면 <terms>이용약관</terms> 및 <privacy>개인정보 처리방침</privacy>에
  동의하는 것으로 간주됩니다." Particles go outside the closing tag; no "저희/OwnJournal의" for "our".
- Chart tooltips: halfwidth "(평균: {{emoji}} {{avg}}, 항목 {{count}}개)" with a space after the
  number before "("; entry counts use 항목 …개 (old "편" removed 2026-11).
- Website prices are never hard-coded: "연 {{price}}", "월 약 {{monthly}}" (code formats the currency).
- Buttons: noun phrase ("녹음 취소", "변환 다시 시도", "계속"), not a full sentence.
- Errors: problem in 합니다체, then the fix with -하세요; give the verb an object.
- Step lists in Help end every step with -하세요 (no bare nouns like "…로 이동").
- Website feature-card descriptions ≈30 characters, no final period.
- Website pricing lists: may be reworded but keep the exact Free/Plus entitlements and order.
- Prefer native verbs (바뀝니다, 정리됩니다) in marketing; 변환 is fine in UI status and legal.

## 6. Deliberate exceptions (house rules)
- `auth.accountCreatedDesc` quotes 'Verify Email Address' in English: the verification email itself
  is sent in English, so the button the user must find is English.
- Website `footer.copyright` keeps "All rights reserved." (standard boilerplate on Korean sites).
- Tap → 탭하다 everywhere English says Tap (incl. Share button, profile icon); keep 클릭 where English
  still says click (billing-portal 'Manage').

## 7. Dreams glossary (term → use → avoid; source)
| English | Korean | Avoid / source |
|---|---|---|
| Dream journal | 꿈 일기 | 드림 저널; ko.wikipedia 「자각몽」 |
| Dream reflection (feature, button) | 꿈 돌아보기 / '이 꿈 돌아보기'; the result = 돌아본 내용·돌아본 결과 | 꿈 해석, 해몽, 꿈 성찰, 회고; judgment (§9 website: 돌아보다 > 회고하다) |
| Dream patterns (report) | 꿈 패턴 (보고서) | 드림 패턴; judgment, 패턴 is house usage |
| Nightmare / lucid / recurring | 악몽 / 자각몽 / 반복되는 꿈 | 루시드 드림; ko.wikipedia 「자각몽」, 약학정보원 「반복적인 악몽」 |
| Possible themes | 엿보이는 주제 | 있을 법한 주제 (reads "commonplace"); judgment |
| Early themes (badge) | 초기 단계 | 초기 주제 (초기 = "initial/default" in UI); judgment |
| Short labels (sent for patterns) | 짧은 키워드 | 레이블, 라벨; judgment |
| Health professional (care text) | 의사 또는 상담 전문가 | 의료 전문가 (calque); judgment, Korean 109 boilerplate "전문가의 상담" |
| Jung / Hall / Domhoff / Hill | 카를 융 / 캘빈 홀 / G. 윌리엄 돔호프 / 클라라 힐 | 칼 융 (secondary); ko.wikipedia 「카를 융」, Kyobo 『융 심리학 입문』 (캘빈 S. 홀); others 외래어 표기법 |
| Measured in tokens (legal) | 토큰 단위로 측정한 AI 처리 사용량 | pattern of house 「초 단위」; judgment |
| "N of M" progress toward a goal | "꿈 M개를 돌아보면 … 지금까지 N개" | "M개 중 N개" (reads as N out of a set of M) |

## Sources
- Microsoft Korean localization style guide: https://aka.ms/korean-styleguide
- Korean GDPR text (KISA translation), Art. 4, 37, 46: https://gdpr-text.com/ko/read/article-46/
- PIPC 개인정보 처리방침 작성지침: https://www.pipc.go.kr
- Apple iPhone guide (ko-kr), "iPhone에서 텍스트 받아쓰게 하기":
  https://support.apple.com/ko-kr/guide/iphone/iph2c0651d2/ios
- Apple 계정 (ko-kr): https://support.apple.com/ko-kr/apple-account
- Apple로 로그인: https://www.apple.com/kr/legal/privacy/data/ko/sign-in-with-apple/ and
  https://developer.apple.com/kr/design/human-interface-guidelines/sign-in-with-apple
- 국립국어원 한글 맞춤법 (띄어쓰기, 문장 부호): https://korean.go.kr

