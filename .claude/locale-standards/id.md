# Indonesian (id) UI and legal localization standard

Scope: app strings (`src/i18n/locales/id.json`) and the website's UI strings (`ownjournal-website/src/i18n/locales/id.json`). The website no longer has its own `legal` block; the Terms and Privacy Policy live only in the app file. For long-form blog voice, see the website's `.claude/locale-standards/id.md` (blog standard: always "kamu", warm "kind older sibling" register). Blog posts are out of scope here.

## Register and address form (owner decision, applied file-wide)

| Surface | Address form |
|---|---|
| Product UI in both repos: app UI, toasts, errors, onboarding, Help, AI, editor, notes/memo, demo, subscription and store strings, providers.*; website marketing, pricing, FAQ | **kamu** / suffix **-mu**; FAQ questions in first person use **aku/-ku** ("Bisakah aku…", "dataku") |
| Legal text in both repos (`legal.terms.*`, `legal.privacy.*` content and titles) | **Anda** (capital A), "kami" for the controller |

- Why legal stays formal: Indonesian ToS/privacy policies are written in "Anda" even by casual consumer brands; the rule is one form per surface. Website FAQ answers that summarize a policy (refunds, AI processing) stay in kamu but must use the same terms as the app policy ("hak penarikan", "pengembalian dana", "melalui server kami").
- Never mix kamu and Anda inside one string, dialog or policy. No "kamu"/-mu anywhere under `legal.*`; no "Anda"/"saya" anywhere outside it.
- Possessive: use the suffix, not "noun + kamu": catatanmu, datamu, kredensialmu, emailmu, koneksimu, kata sandimu, jurnalmu. After product names, abbreviations or loanwords ending oddly, hyphenate: Nextcloud-mu, Dropbox-mu, iCloud-mu, Akun Apple-mu, Plus-mu, cloud-mu, timeline-mu. "kamu" stays as subject ("yang kamu pilih", "Dari sana kamu bisa…").

## Glossary (one term per concept, both repos)

| English | Use | Avoid / notes |
|---|---|---|
| entry (journal) | catatan (UI and legal) | "entri" |
| journaling | menulis jurnal; "fitur inti jurnal" | "journaling", "journaling-mu" |
| note (notes tab) | memo | |
| Plus / Plus feature | Plus / "(Fitur Plus)"; "tersedia untuk pelanggan Plus" | "Premium", "tersedia dengan Plus" |
| Simple mode | mode Sederhana | "mode Simple" |
| end-to-end encryption | enkripsi ujung-ke-ujung (hyphenated); E2E | "ujung ke ujung", "end-to-end" in running text |
| zero-knowledge | zero-knowledge (titles: Zero-Knowledge; "Arsitektur zero-knowledge") | "tanpa pengetahuan" (literal calque) |
| timeline | timeline | "linimasa" (not used in the app) |
| mood levels | Luar Biasa, Baik, Biasa, Kurang, Buruk | "Hebat", "Sangat Buruk" |
| mood streak | rangkaian (suasana hati) | "catatan beruntun", "streak" |
| moving average | rata-rata bergerak | "rata-rata bergulir" |
| Social (activity) / Gaming | Sosial / Bermain Gim | "Bersosialisasi", "Gaming" |
| sidebar / clipboard | bilah sisi / papan klip | "sidebar", "clipboard" |
| sign in / sign-in (noun) | masuk / proses masuk | "login" |
| username | nama pengguna | "username" |
| password manager | pengelola kata sandi | "password manager" |
| tap / click | ketuk (mobile-first, where English says Tap) / klik (only where English says Click) | |
| test connection | uji koneksi | "tes koneksi" |
| Reset All Data (button) | Reset Semua Data | "HAPUS Semua Data", "Hapus Semua" in references to it |
| Voice entry | Input suara (titles: Input Suara) | "Entri suara", "Masukan suara" |
| Dictate | Dikte / mendikte (Apple id-ID) | |
| transcribe / transcription / transcript | mentranskripsikan, ditranskripsikan / transkripsi / transkrip | "mentranskripsi" |
| recording / microphone / speech | rekaman / mikrofon / ucapan | "mic" |
| punctuated | lengkap dengan tanda baca | "bertanda baca" |
| offline / online | offline / online (house) | daring/luring |
| reset (limit, data) | direset / mereset | "diatur ulang" |
| subscription / subscriber / paid tier | langganan / pelanggan / paket berbayar | "tingkat berbayar" |
| explicitly | secara eksplisit | "secara tegas" (= firmly/drastically) |
| abuse monitoring | pemantauan penyalahgunaan | |
| Continue / Not now / Cancel / Stop / Retry | Lanjutkan / Nanti saja / Batal / Berhenti / Coba lagi | `voice.stop` = `common.stop` = "Berhenti" (house; not "Hentikan") |
| via our servers / only in transit | melalui server kami / hanya transit melalui server kami … dan tidak disimpan | |
| right of withdrawal / refund | hak penarikan / pengembalian dana | "refund", "uang kembali" |
| Apple Account (formerly Apple ID) | Akun Apple (capital A, Apple id-ID); kamu-possessive "Akun Apple-mu", legal "Akun Apple Anda" | "Apple ID", "ID Apple", "akun Apple" for the product name |
| Sign in with Apple (button/feature) | Masuk dengan Apple (Apple id-ID) | "Masuk dengan Apple ID", "Login dengan Apple" |
| sign in (website CTA copy) | Masuk | never claim "Tidak perlu akun": sign-in is required |

## Legal vocabulary (both repos)

| English | Use | Avoid |
|---|---|---|
| data protection (DPO, authority, questions) | **Pelindungan** Data (UU No. 27/2022 spelling): Petugas Pelindungan Data (DPO), otoritas pelindungan data | "Perlindungan Data" in this sense |
| consumer protection | perlindungan konsumen (UU No. 8/1999 spelling) | |
| Advanced Data Protection (Apple feature) | Perlindungan Data Lanjutan (product name, unchanged) | |
| supervisory authority | otoritas pengawas | "otoritas pengawasan" |
| controller | pengendali data | |
| Standard Contractual Clauses | Klausul Kontrak Standar (SCC) | "Klausul Kontraktual Standar" |
| fair use | penggunaan wajar | "penggunaan yang adil" |
| legitimate interests | Kepentingan yang sah | "Kepentingan sah" |
| Governing Law | Hukum yang Berlaku | "Hukum yang Mengatur" |
| Termination | Pengakhiran; "mengakhiri akun" | "Penghentian" |
| Data Retention | Retensi Data (distinct from "Penyimpanan Data" = Data Storage) | |
| identifier | pengenal | "identifikasi" |
| as is | "apa adanya" | "sebagaimana adanya" |
| gross negligence | kelalaian berat | "kelalaian besar" |
| notify | memberi tahu (KBBI) | "memberitahu" |
| EEA / adequacy decision / Article 46 | Wilayah Ekonomi Eropa (EEA) / keputusan kecukupan / Pasal 46 GDPR | |
| Google (one provider) | singular: "kebijakannya", "API berbayarnya" | plural "mereka" for Google |

- Indonesia is outside the EU: keep GDPR/EEA references as in English with Indonesian gloss. Where Indonesian law vocabulary is needed, follow UU PDP: "Data Pribadi", "Pengendali/Prosesor/Subjek Data Pribadi", "persetujuan … secara eksplisit", Pasal 56 for cross-border transfer.
- Units sit next to what they measure: "durasi (dalam detik) setiap rekaman", not "rekaman yang ditranskripsi dalam detik".
- Preserve facts exactly (voice entry): 5 minutes per recording, 200 minutes per month, Plus only, audio sent to Google (Gemini), OwnJournal never stores audio or transcripts, only seconds counted, Google's paid tier does not train on the data, Google may retain data for a limited time only for abuse monitoring.

## Typography (both whole files)

- Ellipsis: always the single character `…` ("Memuat…", "Tulis memomu…"). Never "...".
- Dash: spaced em dash ` — ` for breaks in a sentence; never a spaced hyphen ` - ` or an unspaced `—`. The word after the dash continues in lowercase ("Tidak ditemukan — lokasi tujuan tidak ada"). Markdown list syntax (`- daftar`) is not a dash.
- Numeric ranges: en dash without spaces ("24–48 jam", "30–60 detik").
- Quotes: straight double quotes (escaped in JSON) around UI labels and titles ("Lanjutkan dengan Google", "Reset Semua Data"); no single quotes, no guillemets. Code tokens may keep their own quoting ('always').
- Menu paths: arrow `→` with spaces ("Pengaturan → namamu → iCloud → iCloud.com"); no `>`.
- Units: space before units ("5 MB", "20 MB", "{{ms}} md"); abbreviations dtk (detik), mnt (menit).
- Numbers: decimal comma, thousands dot ("100.000").
- Prices: never hard-code an OwnJournal price or currency. Use the placeholders the code fills with the visitor's currency in id formatting: "Harganya {{price}} per tahun (sekitar {{monthly}} per bulan)", "~{{monthly}}/bulan". Only fixed third-party USD fees stay literal, written "US$99/tahun" (Apple Developer).
- Nouns do not inflect for number: "{{minutes}} menit" works for any number; no reduplication after numerals.
- Plurals: CLDR `id` has only the `other` category. For every key that English splits into `_one`/`_other`, define ONLY `key_other` (no `_one`, no unsuffixed base key); one sentence serves all counts ("{{count}} catatan diekspor"). Use the number + noun directly, never "(s)"-style hedges.
- Sentences with links (`<Trans>`): `auth.termsAgreement` is one full sentence, "Dengan melanjutkan, kamu menyetujui <terms>Ketentuan Layanan</terms> dan <privacy>Kebijakan Privasi</privacy> kami." — "kami" after the second link restores English "our", and the sentence ends with a period. Keep exactly one pair of each tag, link text inside.
- Chart tooltips: `moodCorrelations.tooltipDetail_other` = "{{delta}} (rata-rata: {{emoji}} {{avg}}, {{count}} catatan)"; only `_other`, colon right after "rata-rata".

## Dates in legal texts

- Format "Bulan YYYY" with Indonesian month names, capitalized: Januari, Februari, Maret, April, Mei, Juni, Juli, Agustus, September, Oktober, November, Desember ("November 2026", "Desember 2024"); with a day: "17 November 2026". Same style for privacy and terms.
- Label: sentence case "Terakhir diperbarui: {{date}}" (app `legal.lastUpdatedOn`); colon directly after the word, no space before it. References to the label inside legal text use the same casing.

## UI microcopy conventions

- Buttons: imperative verb + object, sentence case ("Batalkan rekaman", "Buang rekaman", "Coba transkripsi lagi"). Common standalone actions follow `common.*`.
- Progress labels end with `…` ("Mentranskripsikan…", "Memproses upgrade…").
- Time remaining: "{{n}} detik lagi" / "Berhenti {{seconds}} dtk lagi" — not "dalam {{n}} detik".
- Errors: state the problem, then the fix. "Silakan" only for polite requests ("Silakan masuk …", "Silakan coba lagi.").
- "alih-alih" is standard but bookish; in short marketing lines prefer "Cukup bicara, tak perlu mengetik" / "bicara, bukan mengetik".
- "berfungsi" for software working ("berfungsi sepenuhnya offline"), not "bekerja".

## Pitfalls seen

- Machine output defaulting to "Anda" in UI strings, and to "kamu" in legal sections added later (syncIdentifier, diagnostics, encryption).
- "tindakan tegas" for "explicit action" (wrong meaning); "fungsi jurnal inti" → "fungsi inti jurnal".
- "seperti isi catatan Anda lainnya" for "like the rest of your entry" → "seperti bagian lain catatanmu".
- English leftovers: "journaling", "/month", "login", "username", "password manager", "Gaming".
- Two different section titles both rendered "Penyimpanan Data" (storage vs retention).
- Toasts that dropped placeholders English added later (`storage.syncedDesc_other` needs {{provider}} and {{count}}; `storage.syncFailedDesc` needs {{provider}}).
- English seeds left untranslated in new keys (check for whole English sentences after each round).
- Quoting a third-party button label (Stripe's "Cancel plan") that can change; describe the action instead ("Di sana kamu bisa membatalkan paketmu").

## Sources

- Microsoft Indonesian localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- Apple Support (id-ID), Dikte: https://support.apple.com/id-id/guide/iphone/aside/iphb995ad7d3/12.0/ios
- Gboard voice typing (Indonesian): https://tirto.id/tips-google-keyboard-cara-mengetik-dengan-suara-pakai-gboard-flvC
- KBBI (mirror) for transkripsi / mentranskripsikan, gim, memberi tahu: https://kbbi.web.id/transkripsi
- PUEBI (Pedoman Umum Ejaan Bahasa Indonesia), punctuation: https://ejaan.kemdikbud.go.id/
- UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (JDIH Kemenkeu): https://jdih.kemenkeu.go.id/download/46c17b53-4a45-411c-9b76-c6799e5769fc/UU_Nomor_27_Tahun_2022%20Perlindungan%20Data%20Pribadi.pdf
- Hukumonline on Pasal 56 cross-border transfer: https://www.hukumonline.com/berita/a/aturan-transfer-data-pribadi-yang-wajib-diketahui-perusahaan-dan-individu-lt684add070ddbb
- Apple Support (id-ID), Akun Apple ("Akun Apple (sebelumnya ID Apple)"): https://support.apple.com/id-id/apple-account
- Apple Legal (id), "Masuk dengan Apple & Privasi": https://www.apple.com/legal/privacy/data/id/sign-in-with-apple/
- House style: existing app and website `id.json`.

## Dreams glossary (dream journal and reflection)

| English | Use | Avoid / source |
|---|---|---|
| dream / dream journal / nightmare | Mimpi / jurnal mimpi / mimpi buruk | attested (Alodokter, Kemenkes Keslan) |
| lucid dream | Lucid dream (loan, also in chips) | "mimpi sadar", "mimpi jernih" (gloss only); Alodokter, Halodoc, Gramedia use the loan |
| recurring (dream) | Berulang / mimpi berulang | attested (Kemenkes "terjadi berulang", Merahputih) |
| flags heading (Recurring / Nightmare / Lucid) | Jenis mimpi | "Ciri mimpi ini" (nightmare and lucid dream are kinds, not traits); judgment |
| Dream reflection / Reflect on this dream | Refleksi mimpi (titles: Refleksi Mimpi) / Refleksikan mimpi ini | "Renungkan mimpi ini" (tells the user to ponder); judgment |
| Dream patterns (report) | Pola mimpi; "laporan pola mimpi" in prose | judgment |
| possible themes / possible links | Kemungkinan tema / Kemungkinan kaitan | "Tema yang mungkin" (calque); pattern of Alodokter "kemungkinan penyebab" |
| crisis line | hotline kesehatan jiwa | "layanan krisis" (unattested); Kemenkes "Layanan Hotline Healing119.id" |
| health professional | tenaga kesehatan | attested (Kemenkes Healing119 FAQ) |
| amount of AI processing, measured in tokens (legal) | jumlah pemrosesan AI yang digunakan dalam satuan token | judgment; unit after the measure, as "dalam detik" |
