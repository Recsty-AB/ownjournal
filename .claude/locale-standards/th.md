# Thai (th) UI and legal standard for OwnJournal

The scope is the app's UI, Help, paywall and privacy/legal strings in `src/i18n/locales/th.json`, plus the website's product and legal strings (`ownjournal-website/src/i18n/locales/th.json`). For long-form brand voice (blog), see the website repo's `.claude/locale-standards/th.md`. This file covers UI microcopy and legal text only, and it applies to both repos.

## Sources
- Microsoft Thai Localization Style Guide: https://download.microsoft.com/download/3/f/2/3f236167-639e-46f2-8201-554c36bcbf31/tha-tha-StyleGuide.pdf (voice, punctuation, passive voice, "กำลัง…" progress strings, error-message samples)
- Apple iPhone User Guide (th-th), "ป้อนข้อความตามคำบอกบน iPhone": https://support.apple.com/th-th/guide/iphone/iph2c0651d2/ios
- Google Gboard / Android Thai UI: "การพิมพ์ด้วยเสียง" (voice typing), "การป้อนข้อมูลด้วยเสียง" (voice input)
- Thailand PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562): ss. 19 (ถอนความยินยอม), 24 (ฐานทางกฎหมาย, ประโยชน์โดยชอบด้วยกฎหมาย), 28–29 (ส่งหรือโอนข้อมูลไปต่างประเทศ, มาตรฐานการคุ้มครองที่เพียงพอ, มาตรการคุ้มครองที่เหมาะสม), 30–36 (data-subject rights): https://www.bangkokbiznews.com/news/news-update/1115730
- Royal Institute (ราชบัณฑิตยสถาน) spacing rule for ๆ and the spelling สิทธิ

## Register and address (owner decision, both repos)
- **One address form everywhere: the user is คุณ** in app UI, website product pages and all legal text. Questions written in the user's voice (FAQ) stay neutral, without ฉัน: "ข้อมูลบันทึกเก็บไว้ที่ไหน?".
- **เรา always means OwnJournal/the company**, never the user. The old website habit of เรา as a soft "you" is retired; do not reintroduce it.
- No ครับ/ค่ะ particles in UI.
- Polite requests use **กรุณา**, never โปรด.
- Sign-in is **เข้าสู่ระบบ** everywhere, including "เข้าสู่ระบบด้วยบัญชี Google". Never ลงชื่อเข้าใช้.

## Glossary (term → preferred → avoid); one term per concept in both repos
| English | Thai | Avoid / note |
|---|---|---|
| Journal (the product/notebook) | สมุดบันทึก | ไดอารี่, ไดอารี |
| Entry | รายการ / รายการบันทึก | |
| Title (suggestions) | ชื่อเรื่อง | หัวข้อ (that is a Markdown heading/topic) |
| Storage / cloud storage | พื้นที่จัดเก็บ / พื้นที่จัดเก็บคลาวด์ | สตอเรจ, คลาวด์สตอเรจ, ที่เก็บข้อมูล, bare ที่จัดเก็บ as a noun |
| Local storage | พื้นที่จัดเก็บในเครื่อง / ภายในอุปกรณ์ | Latin "local storage" in prose (the API name localStorage may stay) |
| End-to-end encryption (full) | การเข้ารหัสแบบต้นทางถึงปลายทาง (adj.: เข้ารหัสแบบต้นทางถึงปลายทาง) | เข้ารหัสต้นทางถึงปลายทาง (no แบบ), Latin End-to-End/end-to-end, ครบวงจร |
| E2E (short form) | การเข้ารหัส E2E, โหมด E2E | การเข้ารหัสแบบ E2E. Headings and mode labels use the full Thai form. Nextcloud's own app name "End-to-End Encryption" stays in quotes |
| Simple mode | โหมดง่าย | โหมดธรรมดา, โหมด Simple |
| Zero-knowledge | Zero-Knowledge (always hyphenated), สถาปัตยกรรม Zero-Knowledge | Zero Knowledge, zero-knowledge, สถาปัตยกรรมแบบ Zero-Knowledge |
| Key / master key | คีย์ / มาสเตอร์คีย์ | กุญแจ, คีย์หลัก |
| Token | โทเคน | โทเค็น |
| App | แอป (แอปพลิเคชัน in legal) | Latin "app" in Thai prose (URLs, e-mail addresses and bundle IDs stay) |
| Plan | แพลน (แพลนฟรี, แพลน Plus) | แผน (แผนที่ความร้อน = heatmap is a different word) |
| Subscription / subscriber | การสมัครสมาชิก / สมาชิก Plus | bare สมาชิก for "subscription" (it means "member"), ผู้สมัคร Plus |
| Requires Plus | ต้องสมัครสมาชิก Plus จึงจะใช้ … ได้ | "ต้องมีสมาชิก Plus" (means "must have a Plus member") |
| Available with Plus | มีให้ใช้ใน Plus | |
| Not now | ไว้ทีหลัง | ไม่ใช่ตอนนี้ (calque) |
| Voice entry (feature name) | การป้อนด้วยเสียง | Short list items may drop การ: "ป้อนด้วยเสียง — …" |
| Dictate (mic button label) | พิมพ์ด้วยเสียง | "พูดเพื่อพิมพ์" |
| Microphone | ไมโครโฟน (Tap the mic: แตะไอคอนไมโครโฟน) | ไมค์ |
| Recording (audio) | การบันทึกเสียง / เสียงที่บันทึก / ไฟล์บันทึกเสียง | bare การบันทึก (also means saving or an entry) |
| Transcribe / transcript | ถอดเสียง / ข้อความที่ถอดเสียง(แล้ว) | ถอดความ (also means paraphrase) |
| Switch languages along the way | สลับภาษาไปมาระหว่างที่พูด | กลางประโยค, กลางคัน |
| Clean text / punctuated | ข้อความที่เรียบร้อย / พร้อมเครื่องหมายวรรคตอน | ข้อความที่สะอาด |
| Filler words | คำติดปาก | คำฟุ่มเฟือย |
| Editor | ตัวแก้ไข (app), หน้าแก้ไข (website) | |
| Activities (names) | ออกกำลังกาย, สังคม, ทำสมาธิ, อ่านหนังสือ … (as in `activities.*`) | นั่งสมาธิ, สังสรรค์ on the website |
| Moods | ดีมาก, ดี, เฉย ๆ, ไม่ดี, แย่มาก (as in `journalEntry.moods.*`) | ปกติ, ไม่ค่อยดี, แย่ |
| Feature | ฟีเจอร์ (ฟีเจอร์ AI เสริม = optional AI features) | คุณสมบัติ |
| AI | AI (Latin script) | ปัญญาประดิษฐ์ in UI |
| Paid tier | ระดับแบบชำระเงิน / API แบบชำระเงิน | แผนแบบชำระเงิน |
| Abuse (monitoring) | การใช้งานในทางที่ผิด (ตรวจสอบ/ตรวจจับ…) | การละเมิด, การใช้งานผิดปกติ |
| Fair use | การใช้งานอย่างเป็นธรรม | การใช้งานที่เป็นธรรม |
| Danger Zone | โซนอันตราย | Latin "Danger Zone" |
| Company country | สวีเดน (`company.country`) | "Sweden" |

## Legal vocabulary (PDPA/GDPR; both repos, whole policy)
| English | Thai |
|---|---|
| Personal data | ข้อมูลส่วนบุคคล |
| Data controller | ผู้ควบคุมข้อมูลส่วนบุคคล |
| Data Protection Officer | เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO) |
| Legal basis | ฐานทางกฎหมายในการประมวลผล |
| Contract performance / legitimate interests / consent | การปฏิบัติตามสัญญา / ประโยชน์โดยชอบด้วยกฎหมาย / ความยินยอม |
| Withdraw consent | ถอนความยินยอม (not เพิกถอน) |
| Rights | สิทธิ (legal text; UI permissions keep สิทธิ์) ; heading "สิทธิของคุณ" |
| Access / portability / rectification / erasure / restriction / objection | สิทธิในการเข้าถึง / สิทธิในการโอนย้ายข้อมูล / สิทธิในการขอให้แก้ไข / สิทธิในการขอให้ลบ / สิทธิในการขอให้ระงับการประมวลผล / สิทธิในการคัดค้าน |
| Lodge a complaint / supervisory authority | ร้องเรียนต่อหน่วยงานคุ้มครองข้อมูลส่วนบุคคล / หน่วยงานกำกับดูแล |
| International transfers (heading) | การโอนข้อมูลส่วนบุคคลไปยังต่างประเทศ; verb โอน |
| Adequacy decision | ประเทศที่คณะกรรมาธิการยุโรปยังไม่ได้มีคำวินิจฉัยว่ามีมาตรฐานการคุ้มครองข้อมูลส่วนบุคคลที่เพียงพอ (not การตัดสินใจเรื่องความเพียงพอ) |
| Appropriate safeguards | มาตรการคุ้มครองที่เหมาะสม |
| Standard Contractual Clauses | ข้อสัญญามาตรฐาน (SCC) |
| EEA | เขตเศรษฐกิจยุโรป (EEA) |
| Collect | เก็บรวบรวม |
| Explicitly | อย่างชัดแจ้ง |
| Negligence / gross negligence / wilful misconduct | ความประมาทเลินเล่อ / ความประมาทเลินเล่ออย่างร้ายแรง / การกระทำโดยจงใจ |
| As is | “ตามสภาพ” |
| Non-exclusive licence | สิทธิการใช้งานแบบไม่ผูกขาด (never ไม่จำกัด) |
| Decompile | ดีคอมไพล์ (never ถอดรหัส, which means decrypt) |
| Right of withdrawal (EU consumers) | สิทธิในการถอนตัวจากสัญญา |
| Severability | การแยกส่วนของข้อกำหนด |
| Termination | การยุติ |
| Mandatory consumer rights | สิทธิคุ้มครองผู้บริโภคที่เป็นบทบังคับ |
- Section titles shared by the app and the website use the same Thai wording (e.g. "การใช้ข้อมูล", "บริการของบุคคลที่สาม", "คำอธิบายบริการ", "การจำกัดความรับผิด").
- Website `legal.privacy.aiProcessing.content` is a byte-for-byte copy of the app's value. Change both together.
- Keep facts in parity with English: Plus only; 5 minutes per recording; 200 minutes per month; audio goes to Google Gemini; OwnJournal never stores audio or transcripts; only seconds are counted; Google's paid tier does not train on the data; Google may keep data for a limited time only for abuse monitoring.

## Dates (owner decision)
- Legal dates use the **Buddhist Era** with the Thai month name and no prefix: "พฤศจิกายน 2569", "เมษายน 2569", "ธันวาคม 2567". Same style for privacy and terms in both repos. Convert by adding 543 to the Gregorian year.
- Label: `legal.lastUpdatedOn` = "อัปเดตล่าสุด: {{date}}" (Thai label colon, no space before it); the website label `legal.lastUpdated` = "อัปเดตล่าสุด".

## Punctuation and typography
- Thai does not end sentences with a period. Separate sentences and clauses with a single space. Keep "." only in abbreviations (ม.ค.) and in numbered steps ("1. …"). No period after "© {{year}} OwnJournal".
- No semicolons in Thai prose, including legal lists: "(a) … (b) …" separated by a space.
- Ellipsis is always the single character `…` (never "..."), e.g. "กำลังโหลด…".
- Dash: the em dash with spaces " — " for asides and "label — explanation" pairs. Never a spaced hyphen " - ". Markdown syntax examples ("- รายการ") are not dashes and stay.
- Quotation marks: curly double quotes “…” for UI labels, quoted terms and typed confirmations (พิมพ์ “DELETE” เพื่อยืนยัน). No straight or single quotes. Apostrophes inside product names (Let's Encrypt) stay.
- Put a space before and after ๆ: "ใด ๆ", "สั้น ๆ", "ต่าง ๆ".
- One space between Thai and Latin script or numbers; no space between Thai words inside a phrase ("แอปมือถือ", "รหัสผ่านแอป", "ในประเทศ{{companyCountry}}").
- The question mark is house style for dialog titles and FAQ questions ("…หรือไม่?", "…ได้ไหม?").
- Numbers as Arabic digits with a space before the unit: "{{seconds}} วินาที". Thai has no plural. "In N seconds" is ในอีก N วินาที.
- Brand and product names stay in Latin script: OwnJournal, Plus, Google, Gemini, Stripe, Google Drive, Dropbox, Nextcloud, iCloud. Third-party UI labels the user must find in English-only screens may be quoted after the Thai: กดยกเลิกแพลน (“Cancel plan”).

## UI microcopy
- Buttons are short verb phrases: หยุด, ดำเนินการต่อ, ลองถอดเสียงอีกครั้ง, ไว้ทีหลัง.
- Errors state what happened, then the action: "ถอดเสียงไม่สำเร็จ กรุณาลองอีกครั้ง".
- Avoid stacked passive ถูก; acceptable once for data flows in privacy text ("จะถูกส่งไปยัง…").
- Avoid mirroring English "X with Google?". Name the agent: "ให้ Google ถอดเสียงของคุณเป็นข้อความหรือไม่?".
- Use "ไม่จัดเก็บ…เลย" for the policy statement "never stores".
- Prefer "มีเพียงคุณเท่านั้นที่…" over "มีเพียงเจ้าของเท่านั้นที่…" for "only you".
- Classifiers: "การบันทึกเสียงแต่ละครั้ง", not "แต่ละการบันทึกเสียง".
