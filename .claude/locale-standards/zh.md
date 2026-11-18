# zh (Simplified Chinese, Mainland): UI and legal localization standard

Scope: OwnJournal app (`src/i18n/locales/zh.json`) and website (`ownjournal-website/src/i18n/locales/zh.json`).
For blog and long-form brand voice, see the website repo's `.claude/locale-standards/zh.md`. Blog posts (`src/data/**`) are out of scope here.

## Register and address form (owner decision, 2026-11)
- **您 everywhere in product UI and legal text, in both repos.** The app was about 550 × 您 to 25 × 你; the stray 你 strings and the whole website UI/legal file were converted. Do not add new 你.
  The Microsoft zh-CN guide prefers 你, but product consistency wins.
- Leave pronouns out where the sentence stays clear (例如 "请登录后使用语音输入。").
- Neutral, friendly and concise. No 亲, no exclamation-mark marketing in UI or legal text.

## Glossary (term → use → avoid). One term per concept across both repos.
| English | Use | Avoid / note |
|---|---|---|
| Entry | 条目 (UI, legal), 日记 (casual or website) | 帖子, 记录项 |
| Mood (the emoji the user records) | 心情: 心情记录, 心情日历(热力图), 心情统计, 表情符号心情记录 | 情绪 for user-recorded mood |
| Mood analysis / emotions (AI output) | 情绪分析, 情绪模式, 情感倾向 (also subscription.description) | 心情分析 |
| Voice entry (feature name) and Dictate button | 语音输入 | 语音条目, 口述 (Apple says 听写; Gboard says 语音输入) |
| Transcribe / transcription / transcript | 转写 / 转写 / 转写文本、转写内容 | 转录, 抄写 |
| Recording / Microphone | 录音 / 麦克风 | 录制品, 话筒, 麥克風 |
| Tap / click | 点击 (both English verbs; English now says Tap in most UI strings, zh stays 点击) | 点按, 轻点 |
| Sign out | 退出登录 | 登出 |
| Settings / Account / Sign in | 设置 / 账户 / 登录 | 設定, 帐户, 帳號, 登入 |
| Provider (cloud) | 提供商 | 提供程序 |
| Google Drive | Google Drive (product name kept as is) | Google 云端硬盘 |
| Simple mode | 简单模式 | 简易模式 |
| End-to-end encryption | 端到端加密; E2E mode → 端到端模式 | 端对端, "E2E 加密". Legal text may add the abbreviation once: 端到端加密（E2E） |
| Reset All Data (Danger Zone) | 重置所有数据; Danger Zone → 危险区域 | 全部删除, 删除所有数据 for this button |
| Plus subscriber | Plus 订阅用户 (both repos) | Plus 订阅者 |
| Plus feature | Plus 功能 ("X 是 Plus 功能") | Plus 专属 is acceptable, not house style |
| Requires Plus subscription | 需要 Plus 订阅 | — |
| Quota / limit | 额度 (user-facing), 用量限制 / 上限 (legal) | 配额 in UI |
| Active (subscription badge) | 生效中 | 活跃 for subscriptions |
| Not now / Retry | 暂不 / 重试、请重试 | 以后再说 |
| Discard recording | 放弃录音 | — |
| Paid tier (Google API) | 付费层级 | 付费方案 (that is a plan) |
| Abuse monitoring | 滥用监控 | 滥用监测 |
| Apple Account (formerly Apple ID) | Apple 账户 (Apple's official zh-CN name since 2024) | Apple ID, Apple 帐户, Apple 账号 |
| Sign in with Apple (button/feature) | 通过 Apple 登录 (Apple's official zh-CN label) | 使用 Apple ID 登录, 用 Apple 登录 |

## Legal vocabulary (GDPR in Chinese; PIPL wording where it fits)
- EUR-Lex has no official Chinese GDPR. Use the established Chinese GDPR terms consistently through both policies:
  数据控制者 (controller), 监管机构 / 数据保护监管机构 (supervisory authority), 法律依据 (legal basis), 履行合同, 合法利益, 同意,
  数据可携带权 (portability), 删除权 (erasure), 限制处理, 反对处理, 充分性决定, 标准合同条款（SCC）, 适当的保障措施 (never 保护措施), 数据保护官（DPO）.
- Personal information → 个人信息 (PIPL term; not 个人资料). GDPR articles are cited as "GDPR 第 46 条".
- EEA → 欧洲经济区（EEA） on first use, then 欧洲经济区.
- IMY → 瑞典隐私保护局（IMY）.
- "as is" and "as available" → 按“现状”和“现有”基础提供. Forfeited (free trial) → 作废.
- Enumerations in legal text use full-width parentheses: （a）（b）, （1）（2）. Introduce each item with ：, not a dash.
- Use 我们 for the company and 您 for the user. Use 不会 / 绝不 for absolute commitments.
- Voice entry facts: Plus only; 5 minutes per recording; 200 minutes a month.
  Audio goes to Google (Gemini) for transcription. OwnJournal never stores audio or transcripts and only counts seconds (录音秒数, not 时长（秒）).
  Google's paid tier does not train on the data; Google may keep it for a limited period, only for abuse monitoring.
- Fair use → 公平使用 (all legal sections: 公平使用限制, 用于实施公平使用限制; 合理使用 is the copyright term). 用于实施每月用量限制. Avoid "执行上限".
- AI requests and voice recordings pass via our servers only in transit: 经由我们的服务器 / 仅在传输…的过程中经过我们的服务器，不会被保留. Do not write that OwnJournal does not "process" journal content.
- The website no longer has a `legal` block (removed on purpose, round 3). Legal text lives only in the app file. Do not re-add website legal or price keys.
- Legal dates: "2026 年 11 月" (half-width spaces around the digits).
  `legal.lastUpdatedOn` = "最后更新：{{date}}" (full-width colon, no space).

## Typography (both whole files)
- Use full-width CJK punctuation：，。；：？！、（）. Use half-width parentheses only in strings with no Chinese (code, language names such as "Português (PT)").
- **Quotes: “” only.** Do not use 「」 or straight "" in Chinese text. Code literals stay ASCII (e.g. 'always' in an nginx hint).
  UI labels and typed confirmations are quoted with “”: 请输入“DELETE”以确认.
- **Ellipsis: a single `…` (U+2026)** in every progress state and placeholder. Never `...`.
- **Dash:** in running text, use the GB/T 15834 double dash `——` with no spaces around it. Never use a lone `—` or a spaced ` - `.
  In status/error pairs ("X - Y") use ：. For a list item with a qualifier (website pricing lists) use （）: "语音输入（每月 200 分钟）".
  For a button use ，: "我已登录，继续".
- **Ranges:** "24 至 48 小时", "30 至 60 秒". Do not use a hyphen.
- **Spacing:** put a half-width space between CJK and Latin letters or digits: "Plus 功能", "至少 6 个字符", "5 MB", "{{minutes}} 分钟".
  Put no space next to full-width punctuation or “”.
  Placeholders that hold numbers or Latin names get spaces ("通过 {{store}} 购买"). Placeholders that hold Chinese text do not ({{activity}}, {{theme}}, {{time}}).
- `{{time}}` in `syncStatus.syncedTimeAgo` already ends in 前 (e.g. "5 分钟前"), so the string is "{{time}}已同步". Never write "{{time}}前…".
- Prices: never hard-code an amount or currency on the website. Use the placeholders the code formats in the visitor's currency: `pricing.plus.monthlyNote` = "约 {{monthly}}/月 • 随时取消"; FAQ "价格为每年 {{price}}（约每月 {{monthly}}）". In fixed app text (Apple developer fee) write a USD amount as "99 美元".
- Website refund FAQ mirrors the app Terms (撤回权 for EU/EEA/equivalent consumers buying on the website, proportionate amount kept after use, App Store/Google Play refunds by Apple/Google). No "全额退款，无需解释".
- Website: encryption claims are conditional (开启端到端加密后…). Sign-in is required: never write 无需注册账户 outside the demo (demo.subtitle "无需注册" is correct).
- Copyright line: "© {{year}} OwnJournal 保留所有权利。"

## UI microcopy
- Plurals: zh has only the `other` category (Intl.PluralRules('zh')). Every English `_one/_other` key gets exactly `key_other` in zh; no `_one`, no bare base key.
- Entry counts: "{{count}} 个条目" (never "条条目", never a bare "{{count}} 条" or "条记录"). With a modifier in between, 条 is fine: "{{count}} 条无法解密的条目".
- Menu paths: quote each item and join with → and no spaces: “设置”→“[您的姓名]”→“iCloud”. Never >.
- `auth.termsAgreement` is one <Trans> sentence: "继续即表示您同意我们的<terms>服务条款</terms>和<privacy>隐私政策</privacy>。" (ends on the links, closing 。 outside the tags).
- Chart tooltip `moodCorrelations.tooltipDetail_other` = "{{delta}}（平均：{{emoji}} {{avg}}，{{count}} 个条目）": full-width （）：，, everyday 平均 (not 均值).
- `storage.syncedDesc_other` = "已连接到 {{provider}}，并加载了 {{count}} 个条目"; `storage.syncFailedDesc` = "无法与 {{provider}} 同步".
- Subscription cancel FAQ does not quote Stripe's button label: "点击“管理”打开计费门户，即可在其中取消订阅".
- Buttons: 2–6 characters, verb-first: 停止, 继续, 重试转写, 取消录音. No trailing punctuation.
- Errors: state the fact, then the fix, as two clauses joined by ，, 。 or ：. Use 请… for instructions, for example "转写失败，请重试。"
- Hardware or detection failures: 未检测到… (microphone, speech). 未找到 is for searches and files.
- Questions in confirmation titles: "迁移完成，要断开来源吗？" (要…吗).
- Do not calque "speak instead of typing" as 用说的代替打字. Use 说话代替打字, 开口说话，无需打字 or 直接说话即可代替打字.
- Do not calque "in the language you speak" as 以你所说的语言. Use 无论您说哪种语言，都能…
  "Switch languages along the way" → 中途切换语言.
- Do not calque "to use X" as 以使用. Use 请登录后使用….

## Pitfalls (zh vs zh-TW drift)
- Watch for Taiwan terms: 設定, 檔案, 帳號, 登入, 使用者, 軟體, 網路, 資料 (data → 数据), 影片 → 视频, 訊息 → 消息, 支援 → 支持, 品質 → 质量, 标准合约条款, 适足性认定.
- 用说的 / 用講的 constructions read as Taiwanese colloquial speech.
- Do not mirror English order ("以…的语言变成…"). Put the condition first in Chinese: 无论…都…

## Sources
- Microsoft Chinese (Simplified) Localization Style Guide: https://download.microsoft.com/download/1/5/9/159cb91c-b61b-4385-97ca-80ccc7ff1fa0/zho-chn-StyleGuide.pdf (pronouns, em dash, ellipsis, parentheses)
- GB/T 15834-2011 标点符号用法 (——, “”, full-width marks, ranges)
- Google Gemini API additional terms (zh-CN): https://ai.google.dev/gemini-api/terms?hl=zh-cn ; ZDR page: https://ai.google.dev/gemini-api/docs/zdr?hl=zh-cn
- Apple iPhone User Guide zh-CN (听写): https://support.apple.com/zh-cn/guide/iphone/
- Apple 账户 (formerly Apple ID): https://support.apple.com/zh-cn/apple-account ; 通过 Apple 登录: https://support.apple.com/zh-cn/102609
- 中华人民共和国个人信息保护法 (PIPL) for privacy vocabulary; established Chinese GDPR translations for GDPR terms
- House decisions: owner review of both zh.json files (2026-11); round 3 fixes (2026-11-17).
