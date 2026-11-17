# Indonesian (id) UI and legal localization standard

Scope: app strings (`src/i18n/locales/id.json`) and the website's UI/legal strings (`ownjournal-website/src/i18n/locales/id.json`). For long-form blog voice, see the website's `.claude/locale-standards/id.md` (blog standard: always "kamu", warm "kind older sibling" register). Blog posts are out of scope here.

## Register and address form (owner decision, applied file-wide)

| Surface | Address form |
|---|---|
| Product UI in both repos: app UI, toasts, errors, onboarding, Help, AI, editor, notes/memo, demo, subscription and store strings, providers.*; website marketing, pricing, FAQ | **kamu** / suffix **-mu**; FAQ questions in first person use **aku/-ku** ("Bisakah aku…", "dataku") |
| Legal text in both repos (`legal.terms.*`, `legal.privacy.*` content and titles) | **Anda** (capital A), "kami" for the controller |

- Why legal stays formal: Indonesian ToS/privacy policies are written in "Anda" even by casual consumer brands; the rule is one form per surface, identical in both repos. A website policy section copied from the app (e.g. `legal.privacy.aiProcessing.content`, `encryption`, `dpo`, `changes`) must be byte-identical to the app.
- Never mix kamu and Anda inside one string, dialog or policy. No "kamu"/-mu anywhere under `legal.*`; no "Anda"/"saya" anywhere outside it.
- Possessive: use the suffix, not "noun + kamu": catatanmu, datamu, kredensialmu, emailmu, koneksimu, kata sandimu, jurnalmu. After product names, abbreviations or loanwords ending oddly, hyphenate: Nextcloud-mu, Dropbox-mu, iCloud-mu, Apple ID-mu, Plus-mu, cloud-mu, timeline-mu. "kamu" stays as subject ("yang kamu pilih", "Dari sana kamu bisa…").

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
| Continue / Not now / Cancel / Stop / Retry | Lanjutkan / Nanti saja / Batal / Berhenti / Coba lagi | |

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
- Numbers and money: decimal comma, thousands dot ("100.000"); prices "US$19,99", "~US$1,67/bulan", "US$0".
- Nouns do not inflect for number: "{{minutes}} menit" works for any number; no reduplication after numerals.

## Dates in legal texts

- Format "Bulan YYYY" with Indonesian month names, capitalized: Januari, Februari, Maret, April, Mei, Juni, Juli, Agustus, September, Oktober, November, Desember ("November 2026", "Desember 2024"); with a day: "17 November 2026". Same style for privacy and terms in both repos.
- Label: sentence case "Terakhir diperbarui" (website `legal.lastUpdated`), "Terakhir diperbarui: {{date}}" (app `legal.lastUpdatedOn`); colon directly after the word, no space before it. References to the label inside legal text use the same casing.

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

## Sources

- Microsoft Indonesian localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- Apple Support (id-ID), Dikte: https://support.apple.com/id-id/guide/iphone/aside/iphb995ad7d3/12.0/ios
- Gboard voice typing (Indonesian): https://tirto.id/tips-google-keyboard-cara-mengetik-dengan-suara-pakai-gboard-flvC
- KBBI (mirror) for transkripsi / mentranskripsikan, gim, memberi tahu: https://kbbi.web.id/transkripsi
- PUEBI (Pedoman Umum Ejaan Bahasa Indonesia), punctuation: https://ejaan.kemdikbud.go.id/
- UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (JDIH Kemenkeu): https://jdih.kemenkeu.go.id/download/46c17b53-4a45-411c-9b76-c6799e5769fc/UU_Nomor_27_Tahun_2022%20Perlindungan%20Data%20Pribadi.pdf
- Hukumonline on Pasal 56 cross-border transfer: https://www.hukumonline.com/berita/a/aturan-transfer-data-pribadi-yang-wajib-diketahui-perusahaan-dan-individu-lt684add070ddbb
- House style: existing app and website `id.json`.
