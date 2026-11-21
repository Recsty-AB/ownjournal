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
| Entry | App UI label: 條目 (count: 「{{count}} 個條目」, never 條條目 or a bare 「{{count}} 條目」); prose may say 篇日記; website: 日記 / 日記條目 (house rule: marketing copy reads unnaturally with 條目) | 項目, 筆紀錄 |
| Mood (tracking, calendar, stats, streaks) | 心情紀錄、心情月曆、心情統計、連續紀錄、心情追蹤 | 情緒記錄, 心情日曆, 情緒日曆 |
| Mood / sentiment analysis (AI) | 情緒分析 | – |
| Timeline | 時間軸 | 時間線 |
| Provider (cloud, AI, payment, auth) | 供應商 (付款服務供應商, AI 服務供應商, 雲端儲存供應商) | 提供者, 服務商 |
| Payment processor | 付款處理商 | 支付處理商 |
| Optional (feature) | 選用 (選用的 AI 功能) | 可選 |
| Fair use (limits) | 公平使用限制 | 合理使用 (copyright term) |
| Simple mode | 簡單模式 (UI and legal) | 簡易模式 |
| Account | 帳戶 (generic, own account, App Store / Google Play 帳戶) | 帳號. Exception: Apple's product name is **Apple 帳號** (formerly Apple ID, renamed 2024; never write Apple ID), and a back-reference to it is 「這類帳號」 |
| Sign in with Apple (button/feature) | **使用 Apple 登入** (Apple Taiwan official); our own auth button stays 「使用 Apple 繼續」 | 使用 Apple ID 登入, 透過 Apple 登入 |
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
| Tap / click (house rule, mirrors English) | Tap (in-app controls, all platforms) → **點選**; Click (web-only/external: Nextcloud web UI, browser address bar, email links, Stripe portal and its 「管理」 entry, Apple web popup) → **點擊**; Select (list/menu) → 選擇 | 輕點, 按一下 |
| "X is a Plus feature" / quota | 「X 是 Plus 功能」 / 「Plus 每月提供 200 分鐘」, 額度 (UI), 上限 (legal) | 包含 for quotas, 配額 |
| Paid tier (API) | 付費方案 | 付費層級 |
| Timestamp / operate | 時間戳記 / 營運 | 時間戳, 運營 |
| Product names | Official Taiwan names in both repos: **Google 雲端硬碟** (owner decision 2026-11; also the provider label), **iCloud 雲碟** (Apple Taiwan); Dropbox, Nextcloud, Gemini, App Store, Google Play stay Latin | Google Drive, iCloud Drive |
| Reset All Data (Danger Zone) | 「危險區域」中的「重設所有資料」 (the real `storage.resetAllData` label) | 全部刪除, 刪除所有資料 |
| Settings tab names in Help | 「儲存」分頁, 「帳戶」分頁 | 標籤頁 |

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
- The website no longer has its own legal block; the app's legal text is the only one.
- AI requests and recordings pass **經由我們的伺服器** to Google only in transit and are not kept (aiProcessing, dpo).
- Website refund FAQ mirrors the app Terms `withdrawal`: 14-day 撤回 for EU/EEA/equivalent consumers on web
  purchases, 我們得保留與您使用程度相當的金額, store purchases refunded by Apple or Google.
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
- `auth.termsAgreement` is one `<Trans>` sentence: 「繼續即表示您同意我們的<terms>服務條款</terms>和<privacy>隱私權政策</privacy>。」 — no spaces around the tags (CJK), ends with 。.
- Chart tooltip `moodCorrelations.tooltipDetail_other`: 「{{delta}}（平均：{{emoji}} {{avg}}，{{count}} 個條目）」 — full-width （：，）, not 、 (the items are not a parallel list).
- Pricing arrays (`pricing.free.features`, `pricing.plus.features`, FAQ pricing answers): reword freely but keep
  the same entitlement claims and array order. Never hard-code a price or currency: the code
  formats the visitor's currency. Use 「約 {{monthly}}/月」 and 「每年 {{price}}（約每月 {{monthly}}）」.

## 6b. Plurals
- zh-TW has one CLDR category (`other`). Every `{{count}}` key is `key_other` only; no `_one`, no base key.
- Count + classifier: 「{{count}} 個條目」, 「{{count}} 個檔案」, 「{{count}} 次失敗」, 「{{count}} 項安全暫停機制」.

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
- Apple 帳號 (「Apple 帳號」（原名為 Apple ID）): https://support.apple.com/zh-tw/apple-account ; 使用 Apple 登入: https://support.apple.com/zh-tw/guide/iphone/iph238921d37/ios
- Google 雲端硬碟 說明 (official zh-TW product name): https://support.google.com/drive/?hl=zh-TW ; Apple iCloud 雲碟: https://support.apple.com/zh-tw/icloud
- Microsoft localization style guides index (zh-TW 用戶端, spacing): https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides

## 8. Dreams glossary (2026-11)
| English | zh-TW | Avoid / status |
|---|---|---|
| Dream (chip, badge, filter) / dream journal | 夢境 / 夢境日記 | judgment |
| Dream reflection (feature) / Reflect on this dream (button) | 夢境解讀 / 解讀這個夢 | 解夢 (fortune-telling register), 反思 (self-criticism). 解讀 attested for dreams (元氣網, psychiatrist) |
| Dream patterns (report) | 夢境脈絡 (mirrors house 情緒脈絡) | 夢境模式 (reads as "dream mode"), 夢境趨勢 (clashes with trend analysis); judgment |
| Nightmare / lucid dream / recurring dream | 惡夢 / 清醒夢 / 反覆出現的夢 | 噩夢 (less common in TW health media); 清醒夢 attested (helloyishi.com.tw, cw.com.tw) |
| Dream image / dream work (Hill) | 意象 / 夢工作模式 | 圖像 |
| Jung, Hall, Domhoff, Hill | 榮格（Carl Jung）; others in Latin | – |
| Flags lead-in above chips | 「這是什麼樣的夢？」 (question, parallels the feelings question) | open fragment 「這個夢是」 |
| Short labels (sent for patterns) | 簡短關鍵字 | 標籤 (= tags), 關鍵詞 |
| Health professional | 醫師、心理師等專業人員 | 心理諮詢師 |
| Crisis line (generic) | 自殺防治專線 (TW lines are all 「…專線」: 安心專線 1925, 張老師專線; MOHW also writes 自殺防治熱線) | no phone numbers |
| Tokens (legal) | 以詞元數計量的 AI 處理用量 (Google Cloud zh-TW: 詞元) | 權杖, 令牌 |
