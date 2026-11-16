# Thai (th) UI and legal standard for OwnJournal

The scope is the app's UI, Help, paywall and privacy/legal strings in `src/i18n/locales/th.json`, plus the website's product and legal strings. For long-form brand voice (blog, marketing), see the website repo's `.claude/locale-standards/th.md`. This file covers UI microcopy and legal text only.

## Sources
- Microsoft Thai Localization Style Guide: https://download.microsoft.com/download/3/f/2/3f236167-639e-46f2-8201-554c36bcbf31/tha-tha-StyleGuide.pdf (voice, punctuation, passive voice, "กำลัง…" progress strings, error-message samples)
- Apple iPhone User Guide (th-th), "ป้อนข้อความตามคำบอกบน iPhone": https://support.apple.com/th-th/guide/iphone/iph2c0651d2/ios
- Google Gboard / Android Thai UI: "การพิมพ์ด้วยเสียง" (voice typing), "การป้อนข้อมูลด้วยเสียง" (voice input)
- Thailand PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562), sections 28–29 on sending or transferring data abroad: https://www.bangkokbiznews.com/news/news-update/1115730
- Royal Institute (ราชบัณฑิตยสถาน) spacing rule for ๆ, via the website standard

## Register and address
- **App: address the user as คุณ** (house style; Microsoft does the same). Use no ครับ/ค่ะ particles in UI.
- **Website: เรา is the soft "you"** in marketing copy (house style there). Privacy text refers to "ผู้ใช้" in the third person.
- **Pitfall:** on the website, เรา also means OwnJournal ("เซิร์ฟเวอร์ของเรา"). Never use both senses in the same paragraph. When the user acts, write "สมาชิก Plus …" or leave out the subject. When the company acts, write "OwnJournal …".
- Polite requests use **กรุณา** (house style: about 120 uses against 15 for โปรด). Microsoft uses โปรด, and both are correct, but stay consistent with the file.
- Sign-in uses **เข้าสู่ระบบ** (house style, key `auth.signIn`). Avoid ลงชื่อเข้าใช้ in new strings.

## Glossary (term → preferred → avoid)
| English | Thai | Avoid / note |
|---|---|---|
| Voice entry (feature name) | การป้อนด้วยเสียง | Keep the name identical in the app and on the website. Short list items may drop การ: "ป้อนด้วยเสียง — …" |
| Dictate (mic button label) | พิมพ์ด้วยเสียง | "พูดเพื่อพิมพ์" invites a double เพื่อ ("…เพื่อพูดเพื่อพิมพ์") |
| Dictation (Apple) | ป้อนข้อความตามคำบอก | Reference only, since the feature is not Apple's |
| Microphone | ไมโครโฟน (Tap the mic: แตะไอคอนไมโครโฟน) | ไมค์ (too casual) |
| Recording (audio) | การบันทึกเสียง / เสียงที่บันทึก / ไฟล์บันทึกเสียง | Bare "การบันทึก" is ambiguous, because it also means saving and a journal entry |
| Transcribe / transcription | ถอดเสียง / การถอดเสียง | ถอดความ (it also means paraphrase) |
| Transcript | ข้อความที่ถอดเสียง(แล้ว) | ข้อความที่ถอด |
| Clean text | ข้อความที่เรียบร้อย | ข้อความที่สะอาด (calque) |
| Punctuated | (มี/พร้อม)เครื่องหมายวรรคตอน | |
| Filler words | คำติดปาก | คำฟุ่มเฟือย (that means verbose wording) |
| Editor | ตัวแก้ไข (app), หน้าแก้ไข (website) | |
| Entry | รายการ / รายการบันทึก | |
| Plus subscription / subscriber | การสมัครสมาชิก Plus / สมาชิก Plus | "ต้องมีสมาชิก Plus" (means "must have a Plus member") |
| Requires Plus | ต้องสมัครสมาชิก Plus จึงจะใช้ … ได้ | |
| Available with Plus | มีให้ใช้ใน Plus | |
| Discard (a recording) | ลบเสียงที่บันทึกไว้ | ทิ้งการบันทึก |
| Not now | ไว้ทีหลัง | ไม่ใช่ตอนนี้ (calque; key `notNow` still uses it, which is a known inconsistency) |
| Continue | ดำเนินการต่อ | |
| Offline | ออฟไลน์ | |
| Feature | ฟีเจอร์ (ฟีเจอร์ AI เสริม = optional AI features) | คุณสมบัติ AI ที่เป็นทางเลือก |
| AI | AI (Latin script) | ปัญญาประดิษฐ์ in UI |
| End-to-end encryption | การเข้ารหัสแบบ End-to-End (E2E) in the app; เข้ารหัสต้นทางถึงปลายทาง on the website | Do not mix the two forms within one file |
| Prompt / output | พรอมต์ / ผลลัพธ์ | |
| Paid tier | ระดับแบบชำระเงิน / API แบบชำระเงิน | แผน… (that means a subscription plan) |
| Abuse monitoring | ตรวจสอบการใช้งานในทางที่ผิด | |
| Fair-use rate limiting | จำกัดปริมาณการใช้งานตามหลักการใช้งานอย่างเป็นธรรม | |
| Standard Contractual Clauses | ข้อสัญญามาตรฐาน (SCC) | |
| EEA | เขตเศรษฐกิจยุโรป (EEA) | |
| Adequacy decision | house: การตัดสินใจเรื่องความเพียงพอ (internationalTransfers) | "การตัดสินใจ" is literal; "คำตัดสินเรื่องความเพียงพอ" would be more precise — owner decision, not changed |
| Personal data | ข้อมูลส่วนบุคคล (PDPA term) | |
| Cross-border transfer | การส่งหรือโอนข้อมูล(ส่วนบุคคล)ไปยังต่างประเทศ (PDPA) / การถ่ายโอนข้อมูลระหว่างประเทศ (house heading) | |
| Explicitly | อย่างชัดแจ้ง (legal) / อย่างชัดเจน | |

## Punctuation and typography
- Thai does not end sentences with a period. Separate sentences and clauses with a single space. Never add "." to the end of a Thai string. Keep "." only in abbreviations (ม.ค.).
- The question mark is house style for dialog titles and FAQ questions: "…หรือไม่?" and "…อะไรบ้าง?". Microsoft omits it, but keep the house form.
- Progress strings use กำลัง + verb + `…`, for example "กำลังถอดเสียง…". Use the ellipsis character `…` when English does.
- Put a space before and after ๆ: "ใด ๆ", "สั้น ๆ".
- Write numbers as Arabic digits. Put a space between a number or placeholder and its unit: "{{seconds}} วินาที", "{{minutes}} นาที". Thai has no plural, so placeholders work with any number.
- "In N seconds" is **ในอีก N วินาที**. "ใน N วินาที" reads as "within".
- Dates: the house style uses the Gregorian year with Thai month names ("พฤศจิกายน 2026"). Do not switch to the Buddhist Era (2569) on your own. That needs an owner decision across all legal dates.
- Brand and product names stay in Latin script: OwnJournal, Plus, Google, Gemini, Stripe.
- The em dash " — " (with spaces) is accepted in the house list items.

## UI microcopy
- Buttons are short verb phrases: หยุด, ดำเนินการต่อ, ลองถอดเสียงอีกครั้ง.
- Errors state what happened, then the action: "ถอดเสียงไม่สำเร็จ กรุณาลองอีกครั้ง".
- Microsoft advises avoiding passive ถูก where an active or subjectless form reads better. ถูก is acceptable in privacy text for data flows ("จะถูกส่งไปยัง…"), but do not stack several in one sentence.
- Avoid mirroring English "X with Google?". Name the agent instead: "ให้ Google ถอดเสียงของคุณเป็นข้อความหรือไม่?".
- Prefer ไม่จัดเก็บ…เลย for the policy statement "never stores". ไม่เคยเก็บ is tolerated in marketing copy.

## Legal text
- Keep facts in parity with English: Plus only; 5 minutes per recording; 200 minutes per month; audio goes to Google Gemini; OwnJournal never stores audio or transcripts; only seconds are counted; Google's paid tier does not train on the data; Google may keep data for a limited time for abuse monitoring.
- Classifiers: write "การบันทึกเสียงแต่ละครั้ง", not "แต่ละการบันทึกเสียง".
- Use PDPA vocabulary for Thai readers alongside the GDPR references the text already contains. "มาตรา 46 ของ GDPR" stays as written.
