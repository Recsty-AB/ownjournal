# Japanese (ja) – UI, Help and legal standard for OwnJournal

Scope: the app strings (`src/i18n/locales/ja.json`) and the website's UI, FAQ, pricing and legal
strings (`ownjournal-website/src/i18n/locales/ja.json`). Blog prose follows the website standard
(`ownjournal_webpage/ownjournal-website/.claude/locale-standards/ja.md`).
The rules below are owner-approved house rules (whole-file pass, Nov 2026). They apply to both repos.

## 1. Register
- です/ます throughout UI, Help, FAQ and legal text. No だ/である.
- The user: UI and FAQ use あなた sparingly or omit the pronoun; legal text uses お客様 (never あなた).
  Self-reference: legal = 当社 (not 私たち); UI = 運営者; FAQ answers use OwnJournal or 私たち, never 当社
  (「OwnJournalのサーバーを経由して」, 「OwnJournalが利用するAIプロバイダー」).
- Requests: 「〜してください」. Retry: 「もう一度お試しください。」
  Availability: 「Plusでご利用いただけます」. Avoid double honorifics (ご登録された → ご登録いただいた).
- Progress/status lines are 体言止め with 中 and end with 「…」: 「文字起こし中…」, 「同期を準備中…」.
- Error sentences are short and polite and end with 。. Button labels have no 。.

## 2. Glossary (one term per concept, both repos)
| English | Japanese | Avoid |
|---|---|---|
| Entry / journal (UI, sync, legal) | 日記 (count: {{count}}件の日記) | エントリ, エントリー, ジャーナル, 日記エントリ, 記録 (for an entry) |
| Journaling service/app (legal) | 日記サービス / 個人向け日記アプリケーション | ジャーナリング |
| Voice entry / Dictate | 音声入力 | ボイスエントリー, ディクテーション |
| Recording / Audio | 録音 / 音声 (legal: 音声録音) | レコーディング, オーディオ |
| Transcribe / transcript | 文字起こし(する) | トランスクリプト |
| Typing (vs. speaking) | 文字を打つ | bare 入力 |
| Decrypt / decryption | 復号(する) | 復号化 |
| Encryption key | 暗号化キー (technical "key length" stays 鍵長) | 暗号鍵, 暗号キー |
| Device | デバイス | 端末 |
| Editor / provider / user / server | エディター / プロバイダー / ユーザー / サーバー | エディタ, プロバイダ |
| Web (platform, browser, server) | Web (Webブラウザ, Webサーバー, Webサイト, Webアプリ) | ウェブ |
| Plus member (UI) | Plusメンバー | Plusユーザー, Plus メンバー |
| Plus subscriber (legal, both repos) | Plus加入者 | Plusサブスクリプション会員, サブスクライバー |
| Unlock (Plus/AI features) | 解放 (「AI機能を解放」) | アンロック, 解除 (解除 reads as "cancel") |
| Cancel a subscription | 解約 (Apple/Google JP term) | キャンセル for subscriptions. The 「キャンセル」 button stays. Do not quote Stripe portal labels: 「請求ポータルが開き、そこでプランを解約できます」 |
| Activity insights (feature) | アクティビティの分析 | アクティビティインサイト |
| Key insights | 主要インサイト | キーインサイト |
| Mood analysis | 気分分析 | ムード分析 |
| Zero knowledge | ゼロナレッジ / ゼロナレッジ設計 | ゼロ知識 |
| Simple mode | シンプルモード | Simpleモード |
| Model training (AI) | トレーニング (「AIモデルのトレーニングに使用」) | 学習 in product/legal text |
| Abuse (prevention/monitoring) | 不正利用 | 悪用 |
| Fair-use limit | 公正利用のための利用制限 / 月間上限 | 公正な利用のための制限 |
| Sign in | サインイン (Nextcloud's own UI keeps ログイン) | ログイン in OwnJournal flows |
| Continue with Google (button) | 「Googleで続ける」; quote the button exactly | 「Googleで続行」 |
| Continue / Not now (consent) | 続ける / 今はしない | – |
| AI | AI (Latin) | 人工知能 |
| Paid tier (API) | 有料プラン | 有料ティア |
| Counters | files, entries, conflicts: 件; tags/activities: 個; attempts/failures: 回 | mixing 個/件 for the same noun |
| Reset All Data (Danger Zone button) | 「すべてのデータをリセット」 in 危険ゾーン; Help text quotes this label exactly | 「すべて削除」, 「すべてのデータを削除」 |
| Tap / Click | follow English: Tap → タップ, Click → クリック (see §5) | – |
| Apple Account (ex-Apple ID) | Apple Account (Latin, as Apple Japan writes it: 「Apple Accountでサインイン」, 「お客様のApple Account」) | Apple ID, Appleアカウント |
| Sign in with Apple (button/feature) | Appleでサインイン (Apple's official JP name; 「Appleで続ける」 stays for the Continue button) | Apple IDでサインイン |
| Product names | OwnJournal, Plus, Google Drive, Dropbox, Nextcloud, iCloud, Gemini (Latin, unchanged) | Google ドライブ |

## 3. Legal / GDPR vocabulary (JETRO + PPC terminology)
- Personal information → 個人情報 (APPI term), used consistently through the policy.
- Processing → 処理; legal basis → 法的根拠; controller → データ管理者; supervisory authority → 監督機関.
- Transfer (of personal data) → **移転** everywhere in legal text (title 「国際的なデータ移転」).
  データ転送 is wrong in that sense. 転送 stays only for "in transit" (保存・転送中) and the in-app
  provider-to-provider data transfer feature.
- Adequacy decision → 十分性認定; appropriate safeguards (Art. 46) → 適切な保護措置;
  SCC → 標準契約条項（SCC）. "maintains safeguards" → 保護措置を講じています.
- Data-subject rights list: ご自身のデータへのアクセス、データのエクスポート（データポータビリティ）、
  不正確なデータの訂正、データの消去（忘れられる権利）、処理の制限、処理への異議申立て; plus
  データ保護当局に苦情を申し立てる権利. Same wording in app and website.
- Legal basis list: 「（1）契約の履行：…ため。（2）正当な利益：…ため。（3）同意：…ため。」
- IMY → スウェーデン・プライバシー保護庁（IMY）.
- abuse monitoring and policy enforcement → 不正利用の監視およびポリシーの執行; for a limited
  period → 一定期間.
- Legal text lives only in the app; the website has no `legal` block (deleted on purpose).
- AI requests pass through our servers only in transit: 「当社のサーバーを経由して…へ送信」;
  DPO wording 「…への転送中にのみ当社のサーバーを経由し、保存されることはありません」.
- Refund/withdrawal (EU/EEA consumers, website purchases) → 撤回(権); proportionate amount →
  利用分に応じた金額; App Store / Google Play refunds are handled by Apple or Google under their policies.
- Dates: 「2026年11月」 (年/月, no day, no spaces). Label: 「最終更新日：{{date}}」 (full-width colon).
- Facts to keep exact: max 5 min per recording; 200 min per month; Plus only; audio goes to Google
  (Gemini); OwnJournal stores neither audio nor transcripts; only seconds are counted; paid tier means
  no training; Google may retain data for a limited period for abuse monitoring.

## 4. Typography (whole file, both repos)
- Full-width punctuation after Japanese text: 。、？！：（）「」. A colon after Japanese is 「：」 with no
  space after it (「最終同期：{{time}}」, 「Plus：タグを提案」, 「例：cd /var/www」).
- Parentheses: full-width （） whenever they sit in Japanese text, including around Latin-only content
  (「Apple App Store（iOS）」, 「（a）」, 「（{{origin}}）」). No space before or after them.
  Avoid nested full-width parentheses: split into a second sentence instead.
- Legal enumerations: 「（a）…、（b）…、または（f）…。」 No semicolons; a sentence-ending 「;」 becomes 「。」.
- Ellipsis: always 「…」 (single U+2026). Never 「...」.
- Dashes: never a spaced hyphen or em dash (「 - 」, 「 — 」, 「 – 」) as a clause separator. Rewrite as:
  label + explanation → 「：」 (「暗号化エラー：…」); two clauses → 「。」 or 「、」; aside in a list
  label → （） (「音声入力（月200分）」). The Japanese dash 「――」 (two U+2015) is allowed sparingly
  in Help prose.
- Spaces: none between Japanese and Latin words, numbers or placeholders (「GoogleまたはAppleなど」,
  「AI機能」, 「{{activity}}のあと」, 「support@ownjournal.appまで」). Exceptions that keep a half-width
  space: numbered steps/titles 「1. 」; code, paths, file names and markup (「 encryption-key.json の」,
  「Documents/ に」, 「<VirtualHost *:443> ブロック」, 「# 見出し」, 「#タグ」); glyphs (⋯ ⋮ → •);
  price/counter labels before a number or placeholder (「年額 $19.99」, 「同期中 {{percent}}%」,
  「ステップ {{current}} / {{total}}」, 「+{{value}} 気分アップ」); and Google's official badge text
  「Google Play で手に入れよう」. Latin-Latin spaces stay (「Apache Webサーバー」).
- Literals the user must type go in 「」: 確認のため「DELETE ACCOUNT」と入力してください.
- Progress counters: 「日記を分析中（{{current}}/{{total}}）…」.
- 「© {{year}} OwnJournal. All rights reserved.」 stays in English (standard on Japanese sites).

## 5. Microcopy conventions
- Grammar: 「このデバイスは〜に対応していません」 (は, not では…に対応).
- 「録音のサイズが大きすぎます」, not 「録音が大きすぎます」.
- 「〜が含まれます」 for allowances is a calque; use 「〜までご利用いただけます」.
- "the rest of your entry" → 「日記のほかの部分」.
- Sentiment "Mixed" → 「混在」 (not 複雑).
- Help desc style: two or three short です/ます sentences, from benefit to how-to.
- Website feature descriptions and pricing bullets are noun-phrase fragments without 。.
- Website pricing bullets may be reworded but must keep the same Free/Plus entitlements and order.
- Website prices are never hard-coded: use {{price}} / {{monthly}} (the code formats the visitor's currency),
  with the price-label space: 「料金は年額 {{price}}（月額約 {{monthly}}）です。」, 「月額約 {{monthly}} • いつでも解約可能」.
- Website facts: sign-in is required (never 「アカウント不要」); encryption on the device only "with E2E
  turned on" (「エンドツーエンド暗号化をオンにしている場合」).
- Tap vs. click (mirrors the English house rule): English "Tap" (in-app controls on every platform, e.g.
  「セットアップヘルプ」, the + button, the profile icon, 「Googleで続ける」) → 「タップ」; 「クリック」 only where
  English keeps "Click" (Nextcloud web UI, browser address bar, e-mail links, the 「管理」 → billing portal
  step, the Apple web sign-in pop-up).
- Terms consent line (code: prefix + " " + 利用規約 + " " + と + " " + プライバシーポリシー + suffix):
  prefix 「続行すると、」, suffix 「に同意したものとみなされます。」 (Japanese puts the predicate after the links).

## 6. Plurals (i18next 25, Intl.PluralRules('ja') = [other])
- Every key that has _one/_other in en.json exists in ja.json only as `key_other`. No `_one`, no base key.
- Write the count with its counter inside the sentence (「{{count}}件の日記」, 「{{count}}個」, 「{{count}}回」);
  no 「(s)」-style hedges. Progress lines still end in 「中…」 (「{{count}}件の日記を分析中…」).

## 7. Dreams glossary (2026-11-19)
| Concept | Use | Avoid | Source |
|---|---|---|---|
| Dream journal (keep one) | 夢日記（をつける） | ドリームジャーナル | ja.wikipedia 夢日記 |
| Nightmare / lucid / recurring | 悪夢 / 夢とわかって見た夢 (chip; line under it: 夢を見ている最中に「これは夢だ」と気づいたときに選びます。) / 繰り返し見る夢 | 明晰夢 (lucid); 夢だと気づいた夢 (alone as a tag it can mean "realised on waking"); 反復夢 (too technical for a chip) | ja.wikipedia 夢・悪夢; NCNP 睡眠時随伴症; lucid: owner ruling 2026-11-21 (too technical for users) |
| Dream reflection (feature, AI output) | 夢の振り返り; button 「この夢を振り返る」 | 夢占い, 夢診断, 夢の解釈 | Apple ジャーナル App JP 「振り返りのプロンプト」 |
| Dream patterns | 夢のパターン; its output is レポート | – | judgment |
| Awe (feeling chip) | 畏敬の念 | bare 畏敬, 畏れ (reads as fear) | JP awe research (高野了太; 野村理朗 KAKEN) |
| Links to waking life | 最近の出来事とつながりそうなこと | 最近の日々とつながる | judgment |
| "Take what fits" (footer) | ピンときたところだけ参考にしてください | 〜だけ受け取ってください | ピンとくる: Zaim ご利用ガイド; phrase judgment |
| Jung / Hall, Domhoff, Hill | カール・グスタフ・ユング, then ユング / Latin names | invented katakana | ja.wikipedia; judgment for Hall/Domhoff/Hill |
| Tokens (legal counter) | AI処理で使用したトークン数 | トークン数で計測した使用量 | judgment |
| Crisis line | 相談窓口; health professional 医師などの専門家 | ホットライン | 厚労省「まもろうよ こころ」 |
| "How it works" | 仕組み (also in links: 仕組みを見る) | しくみ | the app's existing 「暗号化の仕組み」 and 「仕組み」 title; owner ruling 2026-11-20 |

## Sources
- Microsoft Japanese localization style guide (no space between DBCS/SBCS, punctuation):
  https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- iOS 音声入力: https://k-tai.watch.impress.co.jp/docs/review/iphonetips/1440302.html ,
  https://iphone-mania.jp/news-115677/
- 解約 for subscriptions: the wording of the app's own App Store / Google Play renewal disclosures
  (`subscription.renewalApple`, `subscription.renewalGoogle`, `subscription.nativeSubWarning*`).
- PPC GDPR materials (移転 / 十分性認定 / 適切な保護措置): https://www.ppc.go.jp/enforcement/infoprovision/EU/
- JETRO GDPR special (処理, data-subject rights): https://www.jetro.go.jp/world/europe/eu/gdpr/
- Apple Account / Appleでサインイン (Apple JP support): https://support.apple.com/ja-jp/HT5576 ,
  https://support.apple.com/ja-jp/guide/business/axmc55f52fac/web
- MIC GDPR provisional excerpt (Art. 45): https://www.soumu.go.jp/main_content/000661609.pdf
