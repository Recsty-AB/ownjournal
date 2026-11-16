# Japanese (ja) – UI, Help and legal standard for OwnJournal

Scope: the app strings (`src/i18n/locales/ja.json`) and the website's UI, FAQ and legal strings.
Blog and long-form prose follow the website standard
(`ownjournal_webpage/ownjournal-website/.claude/locale-standards/ja.md`). Its banned-katakana list
(ジャーナル/エントリー → 日記, プロンプト → お題) is for prose. The app's legal texts use the
established terms listed below.

## 1. Register (house style)
- です/ます throughout the UI, Help, FAQ and legal text. No だ/である.
- Requests: 「〜してください」 (over 200 uses). Retry: 「もう一度お試しください。」 (32 uses).
  Where it helps, use honorific availability phrasing: 「Plusでご利用いただけます」.
- Legal voice: 当社 / お客様. Do not use あなた.
- Progress/status lines are 体言止め with 中: 「文字起こし中…」, 「同期を準備中...」.
- Error sentences are short and polite and end with 。. Button labels have no 。.

## 2. Glossary (term → use → avoid)
| English | Japanese | Avoid / note |
|---|---|---|
| Voice entry (feature) / Dictate (button) | 音声入力 | ボイスエントリー, ディクテーション. This is the iOS and Gboard name for dictation |
| Recording (noun) | 録音 | レコーディング |
| Audio | 音声 (legal: 音声録音 / 録音データ) | オーディオ |
| Transcribe / transcript | 文字起こし(する) / 文字起こし（テキスト） | トランスクリプト |
| Speech (detected) | 音声 (「音声が検出されませんでした」) | スピーチ |
| Microphone access | マイクへのアクセス | マイクロフォン |
| Typing (vs. speaking) | 文字を打つ / キーボードで入力 | bare 入力. Voice is also 入力, so 「入力する代わりに話す」 is self-contradictory |
| Clean, punctuated text | 句読点の入った整った文章 | きれいなテキスト (calque of "clean text") |
| Stop / Cancel / Discard / Retry | 停止 / キャンセル / 破棄 / 再試行 | – |
| Continue / Not now (consent) | 続ける / 今はしない (iOS "Not Now") | The file also has 続行, 後で in other dialogs |
| Entry | UI: 日記 (279 uses); legal and sync: エントリ (no ー) | エントリー |
| Plus subscriber (legal) | Plus加入者 (app terms); website: Plusサブスクリプション会員 | サブスクライバー |
| Subscription | サブスクリプション | – |
| AI | AI (kept in Latin letters, 85 uses) | 人工知能 |
| Paid tier (API) | 有料プラン | 有料ティア |
| Prompts and outputs (legal) | プロンプトと出力 (an established AI term in the legal text) | – |
| Fair-use limit | 公正利用のための利用制限 / 月間上限 | 公正な利用のための制限を目的として (an awkward calque) |
| Export | エクスポート; 「PDF/Wordエクスポート」 (app), 「PDF・Wordエクスポート」 (website) | Keep each repo's separator |
| Sign in | サインイン (37) | ログイン in new strings |
| min / sec with numbers | {{minutes}}分, {{seconds}}秒, 月200分, 最長5分 | min, sec. Japanese counters need no plural agreement |

## 3. Legal / APPI-GDPR vocabulary
Source: the PPC's provisional Japanese GDPR translation, plus JETRO and MIC summaries.
- Transfer (of personal data) → **移転** (GDPR term: 十分性認定に基づく移転). The app's legal text
  also uses データ転送 (title 「国際的なデータ転送」). Use 移転 in new legal sentences, and do not
  rewrite older text just for this.
- Adequacy decision → **十分性認定**; appropriate safeguards (Art. 46) → **適切な保護措置**;
  SCC → house style **標準契約条項（SCC）**. The PPC uses 標準データ保護条項; both are correct.
- EEA → 欧州経済領域（EEA）; outside the EEA → EEA外 / EEA域外.
- abuse monitoring and policy enforcement → 不正利用の監視およびポリシーの執行.
- for a limited period → 一定期間 (the usual phrase in Japanese privacy notices).
- "maintains safeguards" → 保護措置を講じています (not 維持しています).
- Avoid nested full-width parentheses. Write 「GoogleのGemini」, not 「Google（Gemini）」 inside another （）.
- Keep these facts exact: max 5 min per recording; 200 min per month; Plus only; audio goes to Google
  (Gemini); OwnJournal stores neither audio nor transcripts; only seconds are counted; the paid tier
  means no training; Google may retain data for a limited period for abuse monitoring.

## 4. Typography
- Full-width punctuation: 。、？！：（）「」. Use no space between Japanese and Latin words or numbers
  in new strings (「Plusでは毎月200分」). The legal text mixes in spaces (「Google Drive、Dropbox」 is
  fine). Do not reflow old text just for spacing.
- Ellipsis: both 「…」 and 「...」 appear in the file. Match the English source string.
- Dashes: 「—」 is acceptable in the website's feature lists (「音声入力 — 月200分」), matching the
  existing 「アクティビティインサイト — …」. In app prose, prefer a full sentence break or 、.
- Colon in a short UI label: 「今月の残り：{{minutes}}分」 is acceptable; the full-width ： is house style.

## 5. Microcopy conventions
- Grammar: 「このデバイスは〜に対応していません」 (は, not では…に対応).
- 「録音が大きすぎます」 reads as physical size, so write 「録音のサイズが大きすぎます」.
- 「〜が含まれます」 for minutes is a calque of "includes". Use 「〜までご利用いただけます」.
- 「他の日記の内容と同様に」 reads as "like other diaries". For "the rest of your entry",
  write 「日記のほかの部分と同じように」.
- Help desc style: two or three short です/ます sentences, from benefit to how-to.
- Website feature descriptions are noun-phrase fragments without 。 (match their neighbours).

## Sources
- Microsoft Japanese localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- iOS 音声入力 (Settings > 一般 > キーボード > 音声入力): https://k-tai.watch.impress.co.jp/docs/review/iphonetips/1440302.html ,
  https://iphone-mania.jp/news-115677/
- PPC GDPR materials (translation of 移転 / 十分性認定 / 適切な保護措置): https://www.ppc.go.jp/enforcement/infoprovision/EU/
- JETRO GDPR special: https://www.jetro.go.jp/world/europe/eu/gdpr/
- MIC GDPR provisional excerpt (Art. 45): https://www.soumu.go.jp/main_content/000661609.pdf
