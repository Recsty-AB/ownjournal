# Traditional Chinese, Taiwan (zh-TW): UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/zh-TW.json`) and the website's UI, pricing, FAQ and legal strings
(`ownjournal_webpage/ownjournal-website/src/i18n/locales/zh-TW.json`). Blog and long-form prose follow the
website standard (`ownjournal_webpage/ownjournal-website/.claude/locale-standards/zh-TW.md`), but its
punctuation and Taiwan-versus-Mainland vocabulary rules apply here too.

## 1. Register (house rule, owner decision 2026-11)
- **您 everywhere**: app UI, errors, dialogs, Help, legal text, and the website's UI, pricing, FAQ and legal
  pages. The former 你 pockets (iCloud/Apple strings, store-renewal disclosures, mood/activity Help, the whole
  website) were converted. Never reintroduce 你 outside blog posts.
- Legal voice: 我們 / 您. Do not use 本公司 or 用戶.
- Buttons have no final punctuation. Error and status sentences end with 。.
- Progress lines: 「正在轉錄…」, 「同步中…」, always `…` (U+2026), never `...`.

## 2. Glossary (term → use → avoid)
| English | zh-TW | Avoid / note |
|---|---|---|
| Voice entry (feature) / Dictate (button) | 語音輸入 | 聽寫 (Apple's system dictation), 語音條目 |
| Transcribe / transcription | 轉錄 | 轉寫 (Mainland), 聽打 |
| Transcript | 逐字稿 | 轉寫內容, 文字稿 |
| Recording / audio | 錄音 (file: 錄音檔案) / 音訊 | 音頻 |
| Microphone access | 麥克風存取權 | 話筒 |
| Speak instead of typing | 開口說話，不必打字 | 「整潔、帶標點的文字」 (calque) → 加上標點、通順易讀的文字 |
| "even if you switch languages along the way" | 即使中途切換語言也沒問題 | – |
| Entry | App UI label: 條目 (count: 「{{count}} 個條目」, never 條條目); prose may say 篇日記; website: 日記 / 日記條目 | 項目 |
| Mood (tracking, calendar, stats, streaks) | 心情紀錄、心情月曆、心情統計、連續紀錄、心情追蹤 | 情緒記錄, 心情日曆, 情緒日曆 |
| Mood / sentiment analysis (AI) | 情緒分析 | – |
| Timeline | 時間軸 | 時間線 |
| Provider (cloud, AI, payment, auth) | 供應商 (付款服務供應商, AI 服務供應商, 雲端儲存供應商) | 提供者, 服務商 |
| Payment processor | 付款處理商 | 支付處理商 |
| Optional (feature) | 選用 (選用的 AI 功能) | 可選 |
| Fair use (limits) | 公平使用限制 | 合理使用 (copyright term) |
| Simple mode | 簡單模式 (UI and legal) | 簡易模式 |
| Account | 帳戶 | 帳號 (also in Apple contexts: 「這類帳戶」) |
| User / per-user | 使用者 / 每位使用者 | 用戶. Exception: 用戶端 (client, Microsoft zh-TW) is correct |
| Privacy Policy | 隱私權政策 | 隱私政策 |
| Identity / authentication | 身分 / 身分驗證 | 身份 |
| File / documentation | 檔案 / 說明文件 | 文件 = document (Word 文件, PDF 文件 are correct) |
| Get / obtain | 取得 | 獲取 |
| Add (config, header) | 加入 / 新增 | 添加 |
| Generate | 產生 | 生成 |
| Restart / run (server) / returns (HTTP) | 重新啟動 / 執行 / 傳回 | 重啟, 運行, 返回 (返回 is fine for Back buttons) |
| Local | 本機 (本機儲存, 本機資料); local currency: 當地貨幣 | 本地 |
| Scroll / spelling / site | 捲動 / 拼字 / 網站 | 滾動, 拼寫, 站點 |
| Level | 等級 (安全等級) | 級別 |
| Slide / donut chart / bar chart / distribution | 投影片 / 環圈圖 / 長條圖 / 分布 | 幻燈片, 環形圖, 柱狀圖, 分佈 |
| Self-host | 自架 | 自建 |
| Audit / build | 稽核 / 打造 | 審計, 構建 |
| Contact | 聯絡 | 聯繫 |
| Help (noun) | 協助 / 說明 | 幫助 (幫您 in casual Help prose is fine) |
| Send (email) / send (data) | 寄送 / 傳送 | 發送 |
| Reset | 重設 | 重置 |
| Email address | 電子郵件地址 | 郵箱 |
| Crash log | 當機記錄 | 崩潰日誌 |
| Monthly limit reached | 已達每月上限 | 已達月度限制 |
| Understand | 了解 | 瞭解 |
| Discard / Cancel / Continue / Not now | 捨棄 / 取消 / 繼續 / 暫不 | 丟棄 |
| Tap / click | 點選 / 點擊 (both established) | – |
| "X is a Plus feature" / quota | 「X 是 Plus 功能」 / 「Plus 每月提供 200 分鐘」, 額度 (UI), 上限 (legal) | 包含 for quotas, 配額 |
| Paid tier (API) | 付費方案 | 付費層級 |
| Timestamp / operate | 時間戳記 / 營運 | 時間戳, 運營 |
| Product names | Keep as in the source string: Google Drive and Google 雲端硬碟 both occur; do not rename either | – |

## 3. Legal / GDPR vocabulary (Taiwan PDPA + NDC GDPR usage)
- Collect → **蒐集** in all legal text and privacy commitments (PDPA verbs 蒐集 / 處理 / 利用 / 國際傳輸).
  Plain UI such as 「收集同步資料中…」 keeps 收集.
- Personal information/data → **個人資料**. Data controller → **資料控管者**. DPO → **資料保護長（DPO）**.
- Legal bases: **履行契約**, **正當利益**, **同意**. Contract → **契約** (契約成立之日), never 合約.
- Rights: 存取、匯出（資料可攜權）、更正、刪除（刪除權）、限制處理、**拒絕處理**, 向當地資料保護**監管機關**提出申訴.
  Supervisory authority → 監管機關. IMY → **瑞典隱私保護局（IMY）**.
- European Commission → **歐盟執委會**. Adequacy decision → **適足性認定**. Art. 46 safeguards →
  **適當保護措施** (not 保障措施). SCCs → **標準契約條款（SCC）**. EEA → 歐洲經濟區（EEA）.
- "As is / as available" → 依「現況」及「現有」基礎提供. Implied → 默示. Fraud → 詐欺.
  Reverse engineer → 還原工程. Forfeited (trial) → 失效. Current period → 目前訂閱期間.
- US states: 加州, 德州, 維吉尼亞州, 科羅拉多州, 康乃狄克州, 猶他州. Opt out → 選擇退出.
- Section references: 「AI 功能和處理」一節, 「聯絡我們」一節, 「可接受使用規範」一節.
- The website's privacy `aiProcessing.content` must be byte-identical to the app's.
- Keep these facts exact: a recording lasts at most 5 minutes; 200 minutes per month; Plus only; audio goes to
  Google's Gemini; OwnJournal never stores audio or transcripts; only seconds are counted; the paid tier means
  no training; Google may retain data for a limited time only for abuse monitoring (consent: 只會短暫保留以防止濫用).

## 4. Dates
- Legal dates: `2026 年 11 月`, `2024 年 12 月` (spaces around the number), same style in both repos.
- `legal.lastUpdatedOn`: `最後更新：{{date}}` (full-width colon, no space).

## 5. Typography
- Full-width 。，、；：？！（）「」 in Chinese running text; nested quotes 『』. No space inside or around full-width
  punctuation: 「（a）違反」, 「資料保護長（DPO）」, 「歐洲經濟區（EEA）」.
- Half-width parentheses are converted to full-width in every string that contains Chinese, including
  enumerations （a）…（g）, （1）…（3） and wrapped Latin such as （Access-Control-Allow-Origin: *）.
- Quoted UI words, commands and literals use 「」: 「Verify Email Address」, 「DELETE ALL」, 「always」.
- One half-width space between CJK and Latin letters or digits: 「Plus 會員」, 「至少 6 個字元」, 「步驟 2b」.
  No space next to a placeholder that is itself a Chinese word: 「{{activity}}與較好的心情相關」, 「切換至{{theme}}主題」.
- Dash: `——` (two U+2014, no surrounding spaces) in prose and in website list items
  (「語音輸入——每月 200 分鐘」). Short label/description pairs use 「：」 instead
  (「找不到：目標位置不存在」); short status+question pairs use 「，…嗎？」.
- Ranges in prose: 「24 到 48 小時」, 「30 到 60 秒」.
- Ellipsis: `…` only.

## 6. Microcopy conventions
- Error text: state, then action. 「麥克風存取權已被封鎖。請在裝置或瀏覽器的設定中允許存取，才能使用語音輸入。」
- Consent title: a real question with 要…嗎？ 「要透過 Google 將您的語音轉成文字嗎？」
- Help desc: two to four sentences, benefit first, then how-to.
- Website feature descriptions are fragments with no final 。.
- Pricing arrays (`pricing.free.features`, `pricing.plus.features`, FAQ pricing answers): reword freely but keep
  the same entitlement claims and array order. Prices: `$0`, `$19.99`, `約 $1.67/月` (no NT$).

## 7. Pitfalls
- Mainland vocabulary in traditional characters (see glossary "Avoid" column). Re-scan the whole file after
  any batch edit; machine-seeded strings tend to reintroduce 用戶, 獲取, 生成, 本地, 聯繫.
- Do not blanket-replace 支持: 「支持恐怖主義」 in the Apple terms is correct (support = endorse). Help tab is 支援.
- Do not blanket-replace 可選: 「可選擇」 (can choose) is correct.

## Sources
- Apple iPhone User Guide (zh-TW), 逐字稿/轉錄: https://support.apple.com/zh-tw/guide/iphone/iphbe11247b5/18.0/ios/18.0 ,
  https://support.apple.com/zh-tw/guide/iphone/iphdf551cfa2/18.0/ios/18.0
- Gboard 語音輸入 / 麥克風存取權 (zh-TW): https://uptogo.com.tw/科技/google語音無法辨識？/
- Android zh-TW design docs (語音輸入): https://developer.android.com/design/ui/cars/guides/components/voice-input?hl=zh-tw
- Taiwan Personal Data Protection Act (個人資料保護法, 蒐集/處理/利用): https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=I0050021
- NDC GDPR Chinese translation and Taiwan press (控管者, 資料保護長, 適足性認定, 標準契約條款):
  https://www.ndc.gov.tw/ , https://www.ithome.com.tw/news/134492 , https://technews.tw/2018/05/25/gdpr-taiwan/
- NCCU trade-law papers on GDPR transfers: https://tradelaw.nccu.edu.tw/epaper/no233/5.pdf
- Ministry of Education 重訂標點符號手冊: https://language.moe.gov.tw/001/upload/files/site_content/m0001/hau/haushou.htm
- Microsoft localization style guides index (zh-TW 用戶端, spacing): https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
