# Traditional Chinese, Taiwan (zh-TW): UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/zh-TW.json`) and the website's UI, pricing, FAQ and legal strings.
For blog and long-form prose, follow the website standard
(`ownjournal_webpage/ownjournal-website/.claude/locale-standards/zh-TW.md`). Its punctuation and
Taiwan-versus-Mainland vocabulary rules apply here too.

## 1. Register (house style)
- **App: 您.** It is used 585 times. Use 您 in all UI, errors, dialogs, Help and legal text.
  Two pockets use 你: the iCloud/Apple and store-renewal strings, and the mood/activity Help
  entries. Leave them as they are. New strings use 您.
- **Website: 你.** It is used 125 times and 您 never appears. Keep 你 on the website, legal text included.
- Legal voice: 我們 / 您 (app) or 你 (website). Do not use 本公司 or 用戶.
- Buttons have no final punctuation. Error and status sentences end with 。.
- Progress lines: 「正在轉錄…」, 「正在…」 + `…` (U+2026). Match the English ellipsis.

## 2. Glossary (term → use → avoid)
| English | zh-TW | Avoid / note |
|---|---|---|
| Voice entry (feature) / Dictate (button) | 語音輸入 | 聽寫 is Apple's name for system dictation, so do not use it for our feature. Also avoid 語音條目 |
| Transcribe / transcription | 轉錄 (Apple zh-TW 備忘錄/錄音) | 轉寫 (Mainland 转写), 聽打 (too informal) |
| Transcript | 逐字稿 (Apple zh-TW); 轉錄文字 also acceptable | 轉寫內容, 文字稿 |
| Recording | 錄音; the file itself: 錄音檔案 | 錄製文件, 音頻 |
| Audio | 音訊 | 音頻 (Mainland) |
| Microphone / access | 麥克風 / 麥克風存取權 (Android zh-TW) | 話筒, 麥克風權限 is acceptable but not the platform term |
| Typing vs speaking | 開口說話，不必打字 / 說話取代打字 | 「整潔、帶標點的文字」 is a calque. Write 加上標點、通順易讀的文字 |
| Entry | App: 條目 (209 uses); website: 日記 | 項目 |
| User | 使用者 | 用戶 (Mainland) |
| File | 檔案 | 文件 means "document" in Taiwan. 「Word 文件」 is correct |
| Settings | 設定 | 設置 |
| Network / online | 網路 / 連線 | 網絡 |
| Sign in | 登入 | 登錄 |
| Retry / try again | 重試 (button: 「重試轉錄」, like 「重試分析」); sentence: 「請再試一次。」 or 「請重試。」 | – |
| Discard / Cancel / Continue / Not now | 捨棄 / 取消 / 繼續 / 暫不 (house style `notNow`) | 丟棄 |
| Tap / click | 點選 (Help); Apple-style prose: 點一下 | 點擊 is common in the file. Do not reflow it |
| "X is a Plus feature" | 「X 是 Plus 功能」 (house pattern, as in 趨勢分析是 Plus 功能) | – |
| "Plus includes N minutes" | 「Plus 每月提供 N 分鐘」 | 包含 for a quota is a calque |
| Quota / limit | 額度 (user-facing); 上限 (legal/technical) | 配額 |
| Paid tier (API) | 付費方案 | 付費層級, 付費等級 (calques) |
| Timestamp | 時間戳記 | 時間戳 (Mainland) |
| Operate (a service) | 營運 | 運營 (Mainland) |
| Prompts and outputs | 提示和輸出 (established in the legal text) | – |
| min / sec | {{minutes}} 分鐘, {{seconds}} 秒, 每月 200 分鐘, 最長 5 分鐘 | No plural agreement is needed |

## 3. Legal / GDPR vocabulary (Taiwan usage)
- European Commission → **歐盟執委會** (Taiwan press and NDC usage). Avoid 歐盟委員會 here.
- Adequacy decision → **適足性認定** (NDC). Avoid 充分性決定 or 充分性認定, which are Mainland usage.
- Appropriate safeguards (Art. 46) → **適當保護措施**. Use 保護措施 consistently. Do not use 保障措施 in the same policy.
- Standard Contractual Clauses → **標準契約條款（SCC）**. In Taiwan legal register, 契約 is preferred to 合約.
- EEA → 歐洲經濟區（EEA）. "Outside the EEA" → 歐洲經濟區以外.
- Taiwan PDPA verbs are 蒐集 / 處理 / 利用 / 國際傳輸. The app's legal titles use 收集, so keep 收集 for
  consistency unless the whole policy is revised.
- Abuse monitoring and policy enforcement → 濫用監控和政策執行. "For a limited period" → 在有限期間內.
- Do not nest full-width parentheses. Write 「Google 的 Gemini」, not 「（目前為 Google（Gemini））」.
- Keep these facts exact: a recording lasts at most 5 minutes; 200 minutes per month; Plus only; audio goes to
  Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted; the paid
  tier means no training; Google may retain data for a limited time for abuse monitoring.

## 4. Typography
- Use full-width 。，、；：？！（）「」 around Chinese text. Nested quotes take 『』.
- Use one half-width space between CJK and Latin text or numbers: 「Plus 每月提供 200 分鐘」, 「Google 的 Gemini」.
  The legal text has older half-width parentheses such as 「(EEA)」 and 「(SCC)」. Do not reflow them only for this.
- Use the Chinese dash `——` in prose. Website feature lists use ` — ` (for example 「活動洞察 — 情緒關聯分析」),
  so match the surrounding items.
- Ellipsis: use `…` in new strings. Some older strings have `...`, so leave those.

## 5. Microcopy conventions
- Error text: give the state, then the action. 「麥克風存取權已被封鎖。請在裝置或瀏覽器的設定中允許存取，才能使用語音輸入。」
- Consent title: ask a real question with 要…嗎？ 「要透過 Google 將您的語音轉成文字嗎？」
- Help desc: two to four sentences, starting with the benefit and then the how-to. Use 您 in the app.
- Website feature descriptions are fragments with no final 。, to match the neighbouring items.

## 6. Pitfalls (Mainland vocabulary written in traditional characters)
These are still in older, unchanged app strings. Fix them when a key is edited anyway:
- 用戶 → 使用者; 運營 → 營運; 時間戳 → 時間戳記; 轉寫 → 轉錄
- 文件 meaning a computer file → 檔案; 信息 → 資訊 or 訊息; 視頻 → 影片; 軟件 → 軟體;
  默認 → 預設; 質量 → 品質; 支持 (a feature) → 支援

## Sources
- Apple iPhone User Guide (zh-TW), 備忘錄/錄音 逐字稿 and 轉錄: https://support.apple.com/zh-tw/guide/iphone/iphbe11247b5/18.0/ios/18.0 ,
  https://support.apple.com/zh-tw/guide/iphone/iphdf551cfa2/18.0/ios/18.0
- Gboard 語音輸入 and 麥克風存取權 (zh-TW): https://uptogo.com.tw/科技/google語音無法辨識？/
- Android zh-TW design docs (語音輸入): https://developer.android.com/design/ui/cars/guides/components/voice-input?hl=zh-tw
- GDPR 適足性認定 and 標準契約條款 in Taiwan press: https://www.ithome.com.tw/news/134492 , https://technews.tw/2018/05/25/gdpr-taiwan/
- NCCU trade-law papers on GDPR transfers: https://tradelaw.nccu.edu.tw/epaper/no233/5.pdf
- Ministry of Education 重訂標點符號手冊: https://language.moe.gov.tw/001/upload/files/site_content/m0001/hau/haushou.htm
- Microsoft localization style guides index: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
