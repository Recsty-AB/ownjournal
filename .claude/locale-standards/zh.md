# zh (Simplified Chinese, Mainland) — UI and legal localization standard

Scope: OwnJournal app (`src/i18n/locales/zh.json`) and website (`ownjournal-website/src/i18n/locales/zh.json`).
For blog and long-form brand voice, see the website repo's `.claude/locale-standards/zh.md`.

## Register and address form (house style first)
- **App: 您.** zh.json uses 您 about 550 times and 你 about 25 (stray ones are in help.features.*, notes.*, providers.icloud.*, subscription.renewal*). New app strings use 您.
  The Microsoft zh-CN guide prefers 你 and recommends leaving pronouns out where you can. Product consistency wins in the app.
  Leave pronouns out where the sentence stays clear (例如 "请登录后使用语音输入。").
- **Website: 你** (0 × 您). Keep 你 on the website.
- Neutral, friendly and concise. No 亲, no exclamation-mark marketing in UI or legal text.

## Glossary (term → use → avoid)
| English | Use | Avoid / note |
|---|---|---|
| Entry | 条目 (UI, legal), 日记 (casual or website) | 帖子, 记录项 |
| Voice entry (feature name) | 语音输入 | 语音条目, 声音录入 |
| Dictate (button) | 语音输入 | 口述. Apple's term is 听写, Gboard's is 语音输入; the feature name doubles as the button label |
| Transcribe / transcription / transcript | 转写 / 转写 / 转写文本、转写内容 | 转录 (used by MS Word; not used in this file), 抄写 |
| Recording | 录音 | 录制品 |
| Microphone | 麦克风 | 麥克風 (Traditional), 话筒 (old-fashioned) |
| Tap / click | 点击 (house style, 35×) | 点按 and 轻点 (Android and Apple use them, but the house uses 点击) |
| Settings | 设置 | 設定 (TW) |
| Account | 账户 | 帐户, 帳號 (TW) |
| Sign in | 登录 | 登入 (TW) |
| Offline / network | 离线 / 网络 | 離線, 網路 (TW) |
| User | 用户 | 使用者 (TW) |
| Software / app | 应用 (App names stay as they are) | 软件 in UI is acceptable but not used here; 程式, 應用程式 (TW) |
| File | 文件 | 檔案 (TW) |
| Plus subscriber | Plus 订阅用户 (app), Plus 订阅者 (website, existing) | — |
| Plus feature | Plus 功能 ("X 是 Plus 功能") | Plus 专属 is acceptable, not house style |
| Requires Plus subscription | 需要 Plus 订阅 | — |
| Quota / limit | 额度 (user-facing), 用量限制 / 上限 (legal) | 配额 in UI |
| Reset (monthly) | 重置 | 刷新 |
| Retry | 重试 / 请重试 | 再试一次 is acceptable |
| Not now | 暂不 (house, 3×) | 以后再说 |
| Discard recording | 放弃录音 | 丢弃 is acceptable |
| Paid tier (Google API) | 付费层级 | 付费方案 (that is a plan, not a tier) |
| Abuse monitoring | 滥用监控 (house, both repos) | 滥用监测 (avoid, for consistency) |
| EEA | 欧洲经济区（EEA） on first use, then 欧洲经济区 | — |
| Standard Contractual Clauses | 标准合同条款（SCC） | 标准合约条款 (TW) |
| Adequacy decision | 充分性决定 | 适足性认定 (TW) |
| Safeguards | 保障措施 | — |
| Personal information | 个人信息 (PIPL term) | 个人资料 (TW/HK) |
| Controller / processor | 个人信息处理者 / 受托人 (PIPL); use GDPR's 控制者 / 处理者 only when citing GDPR | — |
| End-to-end encryption | 端到端加密 | 端对端 (2× on the website; a known inconsistency) |

## Typography
- Use full-width CJK punctuation：，。；：？！“”（）. Use straight `""` only for JSON syntax.
- Nested parentheses: avoid （…（…）…）. Rephrase instead, for example "目前为 Google（Gemini）" outside the parentheses, or "录音秒数" instead of "时长（秒）".
- Put a half-width space between CJK and Latin letters or digits: "每段录音最长 5 分钟", "Plus 功能", "{{minutes}} 分钟". Put no space between CJK and full-width punctuation.
  Placeholders count as numbers: "{{seconds}} 秒后停止". Chinese has no plural agreement, so any number works.
- Dash: in running text, use the GB/T 15834 double dash ——. Microsoft advises against a single — in Chinese because it looks like 一.
  Exception: in existing website feature lists, "X — Y" with spaces is house style. Match it within that list.
- Ellipsis: progress states use `…` (U+2026) or `...`. The file mixes both (81 `...` vs 23 `…`); new strings use `…`.
- Dates: "2026 年 11 月" in the app, "2026年11月" on the website. Each repo keeps its own style.

## UI microcopy
- Buttons: 2–6 characters, verb-first: 停止, 继续, 重试转写, 取消录音. No trailing punctuation.
- Errors: state the fact, then the fix, as two clauses joined by ，or 。. Use 请… for instructions, for example "转写失败，请重试。"
- Hardware or detection failures: 未检测到… (microphone, speech). 未找到 is for searches and files.
- Permissions: "麦克风访问已被阻止。请在设备或浏览器设置中允许访问麦克风…" (Android zh-CN says 麦克风权限).
- Do not calque "speak instead of typing" as 用说的代替打字. That is colloquial and leans Taiwanese.
  Use 说话代替打字, 开口说话，无需打字, or 直接说话即可代替打字.
- Do not calque "in the language you speak" as 以你所说的语言. Use 无论您说哪种语言，都能…

## Legal text (privacy)
- Mainland readers know PIPL vocabulary (个人信息, 处理, 同意, 单独同意, 跨境提供). GDPR articles are cited as "GDPR 第 46 条".
- EUR-Lex has no official Chinese GDPR. Use the established Chinese GDPR terms (充分性决定, 标准合同条款, 适当保障措施).
- Use 我们 for the company and 您 for the user (app). Use 不会 / 绝不 for absolute commitments ("从不存储" is acceptable).
- Required facts for voice entry: Plus only; 5 minutes per recording; 200 minutes a month.
  Also: audio goes to Google (Gemini) for transcription; OwnJournal never stores the audio or the transcript; only seconds are counted.
  Also: Google's paid tier does not use the data for training; Google may retain data for a limited period for abuse monitoring.
- Purpose phrases: 用于实施合理使用限制 / 用于实施每月用量限制. Avoid "执行上限", which is a calque of "enforce the limit".

## Pitfalls (zh vs zh-TW drift)
- Watch for these Taiwan terms: 設定, 檔案, 帳號, 登入, 使用者, 軟體, 網路, 資料 (meaning "data") → 数据, 影片 → 视频, 訊息 → 消息, 支援 → 支持, 品質 → 质量.
- 用说的 / 用講的 constructions read as Taiwanese colloquial speech.
- Do not mirror English order ("以…的语言变成…"). Put the condition first in Chinese: 无论…都…

## Sources
- Microsoft Chinese (Simplified) Localization Style Guide: https://download.microsoft.com/download/1/5/9/159cb91c-b61b-4385-97ca-80ccc7ff1fa0/zho-chn-StyleGuide.pdf (pronouns §4.1.12, em dash, ellipsis, parentheses)
- Google Gemini API additional terms (zh-CN): https://ai.google.dev/gemini-api/terms?hl=zh-cn ; ZDR page: https://ai.google.dev/gemini-api/docs/zdr?hl=zh-cn
- Apple iPhone User Guide zh-CN (听写): https://support.apple.com/zh-cn/guide/iphone/
- GB/T 15834-2011 标点符号用法 (Chinese punctuation standard: ——, ……, full-width marks)
- 中华人民共和国个人信息保护法 (PIPL) for privacy vocabulary
- House usage counts are from zh.json in both repos (2026-11).
