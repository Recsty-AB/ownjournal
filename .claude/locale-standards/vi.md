# Vietnamese (vi) UI and legal localization standard

Scope: app strings (`src/i18n/locales/vi.json`) and the website's UI/legal strings (`ownjournal-website/src/i18n/locales/vi.json`). For long-form blog voice see the website's `.claude/locale-standards/vi.md` (bạn-register, warm-informative, avoid stiff Hán Việt and English calques).

## Register and address form (house style)

| Surface | User | Company ("we") | Evidence |
|---|---|---|---|
| App UI, toasts, errors, Help, paywall | **bạn** | chúng tôi | e.g. `sync.offlineCantSync` "Bạn đang ngoại tuyến"; AI limit toasts "Bạn đã đạt giới hạn … Giới hạn sẽ được đặt lại vào tháng sau." |
| App `legal.*` | **bạn** | **chúng tôi** | privacy/terms consistently "chúng tôi" |
| Website (all, incl. legal) | **bạn** | **chúng ta** (75 occurrences, house) | see conflict below |

- Never use "quý khách"/"người dùng" as address in UI; neutral, polite "bạn". No gendered particles.
- Polite requests: "Vui lòng …" (sign in, try again); suggestions/next steps: "Hãy …".
- **Known conflict (owner decision):** the website uses inclusive "chúng ta" for the company. Standard Vietnamese uses exclusive "chúng tôi" for a company speaking to a customer; "máy chủ của chúng ta" literally means "our (yours and mine) servers". Do not mass-rewrite without owner approval. In new website strings avoid the pronoun ("OwnJournal …", "máy chủ của mình", "máy chủ của OwnJournal") so neither form is mixed into one string.

## Glossary (house + platform terms)

| English | Use | Avoid / notes |
|---|---|---|
| entry (journal) | bài viết (UI, 195×) | "mục nhập" (only in old legal text), "entry" |
| journal / journaling | nhật ký / viết nhật ký | "journaling" |
| Plus / Plus feature | Plus / gói Plus / "(Tính năng Plus)" | "Premium", "Pro" |
| Voice entry (feature) | Nhập bằng giọng nói | "Nhập giọng nói", "Mục nhập giọng nói". Matches Gboard/Android "Nhập bằng giọng nói" |
| Dictate (mic tooltip) | Đọc chính tả | Apple vi-VN name for Dictation |
| microphone | micrô (Apple vi spelling) | "mic", "micro" in UI |
| tap | Nhấn (house: 34×) | "Chạm" (only 1× in app; website FAQ uses chạm, acceptable) |
| recording (noun) / record | bản ghi âm / ghi âm | "bản thu" |
| transcribe | chuyển (giọng nói) thành văn bản | "phiên âm" (means phonetic transcription) |
| transcript | bản chép lời | |
| punctuated | có dấu câu | |
| clean text | văn bản gọn gàng | |
| offline | ngoại tuyến (house) | "offline" in UI |
| sign in | đăng nhập | "login" |
| reset (limit) | đặt lại | "reset" |
| subscription / subscriber | gói đăng ký, đăng ký / người đăng ký | |
| paid tier | gói trả phí | "tầng trả phí" (calque) |
| train (a model) | huấn luyện | "đào tạo" (means educating people) |
| prompt / output | lời nhắc / kết quả (app); yêu cầu / kết quả (website, house) | keep each file consistent |
| explicitly (use / action) | chủ động | "rõ ràng" (= clearly/obviously) |
| fair use rate limiting | áp dụng giới hạn sử dụng hợp lý | "giới hạn mức sử dụng hợp lý" (= limit the reasonable use) |
| abuse monitoring | giám sát lạm dụng | |
| Continue / Not now / Cancel / Stop / Retry | Tiếp tục / Để sau / Hủy / Dừng / Thử lại | |
| Discard (recording) | Bỏ bản ghi âm | |

## Grammar and placeholders

- Vietnamese nouns do not inflect for number: `{{minutes}} phút`, `{{seconds}} giây` work for any number. Do not add "các/những" after a numeral.
- Drop the plural marker "các" when English is singular or the list has one item ("nhà cung cấp AI (Google)", not "các nhà cung cấp AI (Google)").
- "X thất bại" is a calque of "X failed"; for errors prefer "Không thể …" / "Không … được" + what failed.
- Avoid "phần còn lại của …" for "the rest of your entry"; use "các nội dung khác trong bài viết".
- Avoid "nó" for objects in polished text; repeat the noun or use "này".
- No comma before "và" in simple lists (no Oxford comma). In two independent clauses prefer "…, … cũng không …" over ", và".
- Limit chains of passive "được … được"; reorder so the result is the subject.

## Typography and microcopy

- Progress labels end with the single ellipsis `…` ("Đang chuyển thành văn bản…"). Older strings use "..."; do not mass-convert.
- Dash: spaced em dash " — " (house, app and website).
- Sentence case for buttons and titles ("Nhập bằng giọng nói"); Vietnamese does not title-case each word. Pre-existing Title Case headings (e.g. "Chuyển Dữ liệu Quốc tế") are an English carry-over; fix only when touching that key's title.
- Numbers: decimal comma, thousands dot ("$19,99"). Units: "200 phút mỗi tháng" in prose, "200 phút/tháng" in compact lists.
- Dates: app "Tháng 11 năm 2026"; website house "Tháng 11, 2026". Keep each file consistent.
- Buttons: verb (+ object), 1–4 words. Errors: problem sentence, then fix sentence.

## Legal text conventions

- There is no official Vietnamese GDPR text. Keep "GDPR", "EEA", "Điều 46 GDPR" with Vietnamese glosses: Khu vực Kinh tế Châu Âu (EEA), Ủy ban Châu Âu, Điều khoản Hợp đồng Tiêu chuẩn (SCC).
- "adequacy decision" → "quyết định công nhận mức độ bảo vệ đầy đủ" (not "quyết định đầy đủ", which reads as "a complete decision").
- Vietnamese law vocabulary (Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, effective 1/1/2026; Nghị định 356/2025/NĐ-CP): dữ liệu cá nhân, chủ thể dữ liệu cá nhân, bên kiểm soát dữ liệu cá nhân, bên xử lý dữ liệu cá nhân, sự đồng ý, chuyển dữ liệu cá nhân xuyên biên giới.
- Units next to what they measure: "độ dài bản ghi âm tính bằng giây".
- Voice-entry facts to preserve: 5 minutes per recording; 200 minutes per month; Plus only; audio sent to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted; Google's paid tier does not train on the data; Google may retain data for a limited time for abuse monitoring.

## Pitfalls seen

- "Thử chuyển lại" (reads as "try moving/transferring again") → "Thử lại".
- "Chạm vào micrô" in the app, where the house verb is "Nhấn" → "Nhấn vào biểu tượng micrô".
- "để giới hạn mức sử dụng hợp lý" (wrong meaning) → "để áp dụng giới hạn sử dụng hợp lý".
- New website strings mixing "chúng tôi" into "chúng ta" text.
- "với tính năng lưu yêu cầu phía Google được tắt" (dangling English "with X turned off") → its own clause.

## Sources

- Microsoft Vietnamese localization style guide (via Microsoft style guides index): https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- Apple Support vi-VN, Dictation ("đọc chính tả"): https://support.apple.com/vi-vn/guide/iphone/aside/iphb995ad7d3/12.0/ios
- Gboard App Store listing (vi), voice typing: https://apps.apple.com/us/app/gboard-the-google-keyboard/id1091700242?l=vi
- Luật Bảo vệ dữ liệu cá nhân 2025 (91/2025/QH15), full text: https://luatvietnam.vn/dan-su/tai-toan-van-luat-bao-ve-du-lieu-ca-nhan-2025-pdf-word-568-103646-article.html ; SBV introduction: https://sbv.gov.vn/documents/20117/1445080/
- House style: existing app and website `vi.json`.
