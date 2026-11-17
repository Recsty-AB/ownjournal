# Vietnamese (vi) UI and legal localization standard

Scope: app strings (`src/i18n/locales/vi.json`) and the website's UI/legal strings (`ownjournal-website/src/i18n/locales/vi.json`). For long-form blog voice see the website's `.claude/locale-standards/vi.md` (bạn-register, warm-informative, avoid stiff Hán Việt and English calques). Blog content is out of scope here.

## Register and address form (house style, owner decision 2026-11)

| Surface | User | Company ("we") |
|---|---|---|
| App UI, toasts, errors, Help, paywall, `legal.*` | **bạn** | **chúng tôi** |
| Website UI and legal | **bạn** | **chúng tôi** |

- One form in both repos. The website used inclusive "chúng ta" (≈37×, "máy chủ của chúng ta" = "our, yours and mine, servers"); it was converted to exclusive "chúng tôi" everywhere the company speaks to customers. Never reintroduce "chúng ta" for the company.
- "của mình" / "OwnJournal" are fine to avoid repeating "chúng tôi" in one sentence.
- Never use "quý khách"/"người dùng" as address in UI; neutral, polite "bạn". No gendered particles.
- Polite requests: "Vui lòng …" (sign in, try again); suggestions/next steps: "Hãy …".

## Glossary (house + platform terms; one term per concept across both repos)

| English | Use | Avoid / notes |
|---|---|---|
| entry (journal) | bài viết | "mục nhập", "mục nhật ký", "entry" (also in legal text) |
| journal / journaling | nhật ký / viết nhật ký | "journaling" |
| Plus / Plus feature | Plus / gói Plus / "(Tính năng Plus)" | "Premium", "Pro" |
| Free plan | gói Miễn phí | |
| Voice entry (feature) | Nhập bằng giọng nói | "Nhập giọng nói", "Mục nhập giọng nói" (Gboard/Android wording) |
| Dictate (mic tooltip) | Đọc chính tả | Apple vi-VN name for Dictation |
| microphone | micrô; "biểu tượng micrô" for the button | "mic", "micro" |
| tap / click | Nhấn | "Chạm", "Bấm", "Nhấp" |
| recording / record | bản ghi âm / ghi âm | "bản thu" |
| transcribe / transcript | chuyển (giọng nói) thành văn bản / bản chép lời | "phiên âm" |
| server | máy chủ ("máy chủ web", "phía máy chủ", "URL máy chủ") | "server" — except the Nginx `server` block ("khối server") and `ServerName` |
| file | tệp | "file" |
| desktop (platform) | máy tính / máy tính để bàn | "Desktop" |
| emoji | biểu tượng cảm xúc | "emoji" |
| sync | đồng bộ | "đồng bộ hóa" |
| offline | ngoại tuyến | "offline" |
| sign in | đăng nhập | "login" |
| reset (limit / data) | đặt lại; "Đặt lại toàn bộ dữ liệu" = Reset All Data | "reset" |
| Not now | Để sau | "Không phải bây giờ" |
| subscription / subscriber | gói đăng ký, đăng ký / người đăng ký | |
| paid tier | gói trả phí | "tầng/bậc trả phí" |
| train (a model) | huấn luyện | "đào tạo" |
| prompt / output | lời nhắc / kết quả (both repos; legal AI paragraph is shared) | |
| explicitly (use / action) | chủ động | "rõ ràng" (= clearly); "expressly" in legal may stay "rõ ràng" |
| fair use (rate limiting) | (áp dụng giới hạn) sử dụng hợp lý | "sử dụng công bằng", "giới hạn mức sử dụng hợp lý" |
| abuse monitoring | giám sát lạm dụng | |
| zero-knowledge | zero-knowledge, "Kiến trúc zero-knowledge" | "Zero Knowledge", "Zero-Knowledge" |
| Privacy Policy / Terms of Service | Chính sách bảo mật / Điều khoản dịch vụ | "Chính sách quyền riêng tư", "Chính sách Bảo mật" |
| Simple mode / E2E mode | chế độ Đơn giản (in prose) / mã hóa đầu cuối (E2E) | "chế độ Simple" |
| distribution (stats) / moving average / donut chart | phân bố / trung bình trượt / biểu đồ tròn | "phân bổ" (= allocation), "trung bình động", "donut" |
| moods | Tuyệt vời, Tốt, Bình thường, Không tốt, Rất tệ | "Kém", "Tệ" |
| activity "Social" | Giao lưu | "Giao tiếp (xã hội)" |
| spam folder / popup | thư mục thư rác / cửa sổ bật lên | "spam", "popup" |
| Continue / Cancel / Stop / Retry / Discard | Tiếp tục / Hủy / Dừng / Thử lại / Bỏ bản ghi âm | "Thử chuyển lại" |

Technical loanwords kept on purpose: token, client ID, API, CORS, origin, header, module, terminal, console, hosting, tab, banner, Markdown, demo (website), brute-force.

## Grammar and placeholders

- Nouns do not inflect for number: `{{minutes}} phút`, `{{seconds}} giây`, `{{count}} bài viết`. No "các/những" after a numeral.
- Drop plural "các" when English is singular ("nhà cung cấp AI (Google)").
- Sentence errors: "Không thể …" / "… không … được" ("{{count}} bài viết không di chuyển được"). Short status titles "Đồng bộ thất bại", "Kết nối thất bại" are acceptable (common in vi UI).
- Active voice for user actions: "Bạn đã dừng quá trình di chuyển", not "đã bị dừng bởi người dùng".
- Avoid "phần còn lại của …" → "các nội dung khác trong bài viết".
- Avoid "nó" for objects; repeat the noun or use "này/đó" ("mã này", "dữ liệu đó", "ứng dụng này").
- No Oxford comma before "và" in lists. Two independent clauses: "…, … cũng không …" or a semicolon.
- No doubled qualifiers ("tạm thời hiện không khả dụng", "tạm bị tạm dừng").

## Typography and microcopy

- Ellipsis: always the single character `…` (whole file converted 2026-11; never "...").
- Dash: spaced em dash " — "; the word after it is lowercase ("Không tìm thấy — vị trí đích không tồn tại"). Never " - " as a dash. Markdown list syntax ("- danh sách") is not a dash.
- Ranges: en dash without spaces ("24–48 giờ", "30–60 giây").
- Units: space before units ("5 MB", "{{ms}} ms"); seconds spelled out in UI ("Tự động (15 giây)").
- Quotes: straight double quotes for UI labels and references ("Tiếp tục với Google", "Quản lý"); no single quotes. Apostrophes in product names stay (Let's Encrypt) and code tokens stay as is ('always').
- Menu paths: "Cài đặt → tên của bạn → iCloud" (arrow, not ">").
- Sentence case everywhere, including legal section titles ("8. Lưu trữ dữ liệu và quyền riêng tư", "Chuyển dữ liệu quốc tế", "Cookie và lưu trữ cục bộ"). Use "và" instead of "&" in titles; "&" is acceptable only in compact feature lists. Parenthetical labels lowercase: "(khuyến nghị)", "(khuyên dùng)", "(riêng tư)", "(không mật khẩu)". UI mode/feature names referenced in prose may keep their capital ("chế độ Đơn giản", "Phân tích hoạt động").
- Numbers: decimal comma, thousands dot ("$19,99", "~$1,67/tháng", "100.000"). Units: "200 phút mỗi tháng" in prose, "200 phút/tháng" in compact lists.
- Dates (legal, both repos): lowercase month, "tháng 11 năm 2026" (rendered after "Cập nhật lần cuối: {{date}}"). Same style for privacy and terms dates in both repos; never "Tháng 11, 2026".
- Buttons: verb (+ object), 1–4 words. Errors: problem sentence, then fix sentence.

## Legal text conventions

- No official Vietnamese GDPR text. Keep "GDPR", "EEA", "Điều 46 GDPR" with glosses: Khu vực Kinh tế Châu Âu (EEA), Ủy ban Châu Âu, Điều khoản Hợp đồng Tiêu chuẩn (SCC) (named instrument, keeps capitals).
- Vocabulary (aligned with Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 and Nghị định 356/2025/NĐ-CP): bên kiểm soát dữ liệu (data controller, title and body), bên xử lý dữ liệu, dữ liệu cá nhân / thông tin cá nhân (follow the English: "personal data" / "personal information"), sự đồng ý, lợi ích hợp pháp (legitimate interests), hạn chế xử lý (restriction), quyền được lãng quên, bổ nhiệm Nhân viên bảo vệ dữ liệu (DPO), cơ quan giám sát, quyết định công nhận mức độ bảo vệ đầy đủ (adequacy decision; not "quyết định đầy đủ").
- Consumer terms: quyền rút khỏi hợp đồng / thời hạn rút khỏi hợp đồng (right of withdrawal; not "quyền rút lui"); "6. Sử dụng được chấp nhận" (Acceptable Use; not "Sử dụng hợp lệ" = valid use); "các Điều khoản này" keeps the capital as a defined term; "quốc gia thành viên EU" lowercase.
- `legal.privacy.aiProcessing.content` must be byte-identical in the app and the website. Edit the app first, then copy.
- Units next to what they measure: "độ dài bản ghi âm tính bằng giây".
- AI/voice facts to preserve: 5 minutes per recording; 200 minutes per month; Plus only; audio sent to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted; Google's paid tier does not train on the data; Google may retain data only for a limited time for abuse monitoring ("chỉ có thể lưu giữ trong thời gian ngắn để ngăn chặn lạm dụng").

## Website pricing lists

- `pricing.free.features`, `pricing.plus.features`, `pricing.faq.items[0..1]`, `faq.categories.pricingBilling.items[0..1]`: reword freely but keep the same Free/Plus entitlement claims and array order.

## Pitfalls seen

- "Thử chuyển lại" → "Thử lại".
- "để giới hạn mức sử dụng hợp lý" (wrong meaning) → "để áp dụng giới hạn sử dụng hợp lý".
- "với tính năng lưu yêu cầu phía Google được tắt" (dangling English "with X turned off") → its own clause.
- English Title Case carried over ("Chuyển Dữ liệu Quốc tế", "Tổng quan Tâm trạng").
- "cùng … cùng …" in one list; "chính sách … theo chính sách" repetition.
- Mixing "server"/"máy chủ", "emoji"/"biểu tượng cảm xúc", "file"/"tệp" between the repos.

## Sources

- Microsoft Vietnamese localization style guide (via Microsoft style guides index): https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- Apple Support vi-VN, Dictation ("đọc chính tả"): https://support.apple.com/vi-vn/guide/iphone/aside/iphb995ad7d3/12.0/ios
- Gboard App Store listing (vi), voice typing: https://apps.apple.com/us/app/gboard-the-google-keyboard/id1091700242?l=vi
- Luật Bảo vệ dữ liệu cá nhân 2025 (91/2025/QH15), full text: https://luatvietnam.vn/dan-su/tai-toan-van-luat-bao-ve-du-lieu-ca-nhan-2025-pdf-word-568-103646-article.html ; SBV introduction: https://sbv.gov.vn/documents/20117/1445080/
- House style: existing app and website `vi.json`; owner decisions of 2026-11 (one address form, chúng tôi on the website, app term wins).
