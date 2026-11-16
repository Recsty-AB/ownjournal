# Indonesian (id) UI and legal localization standard

Scope: app strings (`src/i18n/locales/id.json`) and the website's UI/legal strings. For long-form blog voice, see the website's `.claude/locale-standards/id.md` (blog standard: always "kamu", warm "kind older sibling" register).

## Register and address form (house style)

| Surface | Address form | Evidence |
|---|---|---|
| App UI, toasts, errors, onboarding, Help, AI features, editor | **kamu** / suffix **-mu** (catatanmu, datamu, perangkatmu) | ~200 kamu/-mu occurrences outside `legal.*`; e.g. `sync.offlineCantSync` "Kamu sedang offline", AI limit toasts "Kamu sudah mencapai batas … Batas akan direset bulan depan." |
| App `legal.*` (privacy policy, terms) | **Anda** (capital A) | 175 occurrences in `legal.*`; formal legal register |
| Website, all sections incl. legal | **kamu** | website id.json uses kamu throughout |

- Known inconsistency (do not mass-rewrite without owner decision): app `notes.*`, `demo.*`, some `subscription.*` store/renewal strings and `providers.icloud.*` use "Anda". New UI strings must follow the majority (kamu).
- Never mix kamu and Anda inside one string or one dialog.
- Prefer the suffix -mu over "kamu" after nouns ("catatanmu", not "catatan kamu"); keep the existing "Periksa email kamu" style only where already present.

## Glossary (house + platform terms)

| English | Use | Avoid / notes |
|---|---|---|
| entry (journal) | catatan | "entri" only appears in old legal text; keep catatan in UI |
| journal | jurnal | |
| Plus / Plus feature | Plus / "(Fitur Plus)" | "Premium" |
| Voice entry (feature name) | Input suara (title case in feature lists/Help titles: "Input Suara") | "Entri suara", "Masukan suara" (Android legacy; less familiar) |
| Dictate (mic button tooltip) | Dikte / mendikte | Apple iOS id-ID names the feature "Dikte" (Pengaturan > Umum > Papan Ketik > Aktifkan Dikte) |
| transcribe / transcription | mentranskripsikan, ditranskripsikan / transkripsi | "mentranskripsi", "ditranskripsi" (KBBI verb is *mentranskripsikan*) |
| transcript | transkrip | |
| recording | rekaman; "merekam" (verb) | |
| microphone | mikrofon | "mic" |
| speech / your words | ucapan / ucapanmu | |
| punctuated | lengkap dengan tanda baca | "bertanda baca" (stiff calque) |
| clean text | teks rapi | |
| offline / online | offline / online (house) | daring/luring are official KBBI terms but the app uses offline everywhere |
| sign in | masuk; "Silakan masuk untuk …" | login (verb) |
| reset (limit, data) | direset / mereset (house) | "diatur ulang" (calque, not used elsewhere in the app) |
| subscription / subscriber | langganan / pelanggan | |
| paid tier | paket berbayar | "tingkat berbayar" (calque) |
| explicitly (legal) | secara eksplisit | "secara tegas" — "tindakan tegas" means *firm/drastic action* |
| Standard Contractual Clauses | Klausul Kontrak Standar (app) / Klausul Kontraktual Standar (website, pre-existing) | keep each file internally consistent |
| EEA | Wilayah Ekonomi Eropa (EEA) | |
| adequacy decision | keputusan kecukupan | |
| GDPR Article 46 | Pasal 46 GDPR | |
| fair use | penggunaan wajar / penggunaan yang adil | |
| abuse monitoring | pemantauan penyalahgunaan | |
| prompt / output | prompt / output (house, loanwords) | |
| Continue / Not now | Lanjutkan / Nanti saja | |
| Cancel / Stop / Retry | Batal (common) or "Batalkan …" with object / Berhenti (common.stop) / Coba lagi | |

## UI microcopy conventions

- Buttons: imperative verb + object, sentence case ("Batalkan rekaman", "Buang rekaman", "Coba transkripsi lagi"). Common standalone actions follow `common.*`.
- Progress labels end with the ellipsis character `…` ("Mentranskripsikan…"). Older strings use "...", do not mass-convert.
- Time remaining: "{{n}} detik lagi" / "Berhenti {{seconds}} dtk lagi" — not "dalam {{n}} detik" (calque of "in N seconds").
- Abbreviations: dtk (detik), mnt (menit). Indonesian nouns do not inflect for number, so `{{minutes}} menit` works for any number; never add plural reduplication after a numeral ("5 menit", not "5 menit-menit").
- Errors: state the problem, then the fix, two short sentences. "Silakan" only for polite requests ("Silakan masuk …", "Silakan coba lagi.").
- "alih-alih" (instead of) is standard KBBI but bookish; in short marketing/teaser lines prefer "Cukup bicara, tak perlu mengetik" or "bicara, bukan mengetik".
- Avoid "dengan Plus" for availability; use "tersedia di Plus" / "khusus Plus".
- Dash: house style uses the em dash with spaces " — " in app and website strings; keep it.
- Quotes: straight double quotes inside text are escaped in JSON; no guillemets.

## Legal text conventions

- Formal register, "Anda" (app) / "kamu" (website); "kami" for the controller.
- Indonesia is outside the EU; there is no official Indonesian GDPR text. Keep GDPR/EEA references as in English, with Indonesian gloss. Where Indonesian law vocabulary is needed, follow UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP): "Data Pribadi", "Pengendali Data Pribadi", "Prosesor Data Pribadi", "Subjek Data Pribadi", "persetujuan … secara eksplisit", "transfer Data Pribadi ke luar wilayah hukum Negara Republik Indonesia" (Pasal 56: equal-or-higher protection level, or "perlindungan yang memadai dan bersifat mengikat"). Note the law's title spells "Pelindungan", not "Perlindungan".
- Units in legal text: put the unit next to what it measures: "durasi (dalam detik) setiap rekaman", not "rekaman yang ditranskripsi dalam detik" (reads as *transcribed within seconds*).
- Preserve facts exactly (voice entry): 5 minutes per recording, 200 minutes per month, Plus only, audio sent to Google (Gemini), OwnJournal never stores audio or transcripts, only seconds counted, Google paid tier does not train on the data, Google may retain data for a limited time for abuse monitoring.

## Pitfalls seen

- Machine output defaulted to "Anda" for new UI strings — wrong for the app UI and Help.
- "tindakan tegas" for "explicit action" (wrong meaning).
- "fungsi jurnal inti" (word order changes meaning) → "fungsi inti jurnal".
- "seperti isi catatan Anda lainnya" for "like the rest of your entry" → "seperti bagian lain catatanmu".
- Verb forms without -kan for transkripsi.

## Sources

- Microsoft Indonesian localization style guide: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides (Indonesian; register, UI conventions)
- Apple Support (id-ID), Dikte: https://support.apple.com/id-id/guide/iphone/aside/iphb995ad7d3/12.0/ios
- Gboard voice typing (Indonesian article, "mengetik dengan suara"): https://tirto.id/tips-google-keyboard-cara-mengetik-dengan-suara-pakai-gboard-flvC
- KBBI (mirror) for transkripsi / mentranskripsikan: https://kbbi.web.id/transkripsi , https://typoonline.com/kbbi/transkripsi
- UU No. 27 Tahun 2022 (PDP), JDIH Kemenkeu: https://jdih.kemenkeu.go.id/download/46c17b53-4a45-411c-9b76-c6799e5769fc/UU_Nomor_27_Tahun_2022%20Perlindungan%20Data%20Pribadi.pdf
- Hukumonline on cross-border transfer (Pasal 56): https://www.hukumonline.com/berita/a/aturan-transfer-data-pribadi-yang-wajib-diketahui-perusahaan-dan-individu-lt684add070ddbb
- House style: existing `src/i18n/locales/id.json` (app) and website `src/i18n/locales/id.json`.
