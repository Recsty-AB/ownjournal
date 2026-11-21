# Hindi (hi) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/hi.json`) and the website's UI/FAQ strings
(`ownjournal-website/src/i18n/locales/hi.json`). Blog prose follows the website's long-form
standard (`ownjournal-website/.claude/locale-standards/hi.md`). Its तुम register is only for
blog posts. It does NOT apply to the app or to website UI/FAQ/legal pages, which use आप.
Owner decision (Nov 2026): one register, one term per concept and one typography for both repos.
The app's term wins unless it is wrong.

## 1. Register and address (house style)
- **आप** everywhere in both repos (UI, Help, FAQ, legal). No तुम/तुम्हारा, no -ओ imperatives
  (चुनो, बनाओ, जोड़ो, लागू करो); they were removed from Help and the website FAQ.
- Imperatives in **-ें** form: करें, चुनें, हटाएं, आज़माएं, अनुमति दें. Never -इए in UI.
- Chandrabindu → **anusvara** in both repos (हटाएं, जाएंगे, पाएं, प्रविष्टियां, गतिविधियां,
  यहां, कहां, पहुंच, जांचें, हां, हूं, आंकड़े). No ँ anywhere in either file.
- FAQ questions are gender-neutral: use the passive ("क्या OwnJournal को ऑफलाइन इस्तेमाल किया जा
  सकता है?") instead of "क्या मैं … कर सकता हूं?" or "सकता/सकती".
- Errors: state the problem, then the fix. Retry is always **"कृपया पुनः प्रयास करें।"**
  (not फिर से प्रयास/कोशिश करें, दोबारा कोशिश करें).
- Status lines are impersonal and use "का/की … हो रहा/रही है": "प्रविष्टियों का विश्लेषण हो रहा
  है…", "प्रमाणीकरण की जांच हो रही है…". Never "प्रविष्टियां विश्लेषण हो रही हैं" / "जांच रहा है".
- Transitive button labels take the genitive: "प्रविष्टि का विश्लेषण करें", "ट्रेंड का विश्लेषण करें".
- Limits: "सीमा पूरी हो गई" (not "सीमा पहुंच गई"); "अधिकतम {{limit}} …".
- "Tap" → **टैप करें**, "Click" → **क्लिक करें**; a quoted button takes पर: "“कनेक्ट करें” पर टैप करें".

## 2. Glossary (term → use in BOTH repos → avoid)
| English | Use | Avoid |
|---|---|---|
| Entry (journal entry) | प्रविष्टि / प्रविष्टियां (obl. प्रविष्टियों) | एंट्री, एंट्रीज़ (except the feature name) |
| Voice entry (feature name) | वॉइस एंट्री | – |
| Journal | जर्नल (f.: "आपकी जर्नल", "अपनी जर्नल"); "जर्नल डेटा/पासवर्ड" is m. by the head noun | डायरी, पत्रिका |
| Plus | Plus (Latin script) | प्लस |
| Plus feature / Plus member | Plus फीचर / Plus सदस्य | Plus सुविधा in UI |
| Subscription | सदस्यता (f.: "आपकी सदस्यता सक्रिय है") | सब्सक्रिप्शन |
| Subscriber (legal) | ग्राहक ("Plus ग्राहकों") | सब्सक्राइबर्स |
| Plan / Free plan | प्लान / फ्री प्लान; "Everything in Free" → "फ्री प्लान की हर सुविधा" | योजना |
| Free (price) / free trial | मुफ्त / निःशुल्क परीक्षण ("14 दिन का मुफ्त परीक्षण") | ट्रायल |
| Cancel / Delete | रद्द करें / हटाएं | कैंसल, डिलीट |
| Account | खाता (obl. खाते) | अकाउंट |
| Privacy / private | गोपनीयता / निजी | प्राइवेसी, प्राइवेट |
| Analysis / insights | विश्लेषण / अंतर्दृष्टि | एनालिसिस, इनसाइट्स |
| Activity Insights | गतिविधि अंतर्दृष्टि | गतिविधि विश्लेषण |
| Mood Statistics / streaks | मूड सांख्यिकी / मूड श्रृंखला | मन की स्थिति के आंकड़े, स्ट्रीक्स |
| Mood tracking | मूड ट्रैकिंग | मन की स्थिति दर्ज करो |
| Photo memories | फोटो यादें | फोटो मेमोरीज़ |
| Title / tags / themes | शीर्षक / टैग / विषय | टाइटल, टैग्स, थीम्स |
| AI-powered | AI-संचालित | AI-पावर्ड |
| Encryption key(s) | एन्क्रिप्शन कुंजी / कुंजियां (f.) | "एन्क्रिप्शन की" (reads as a genitive), कीज़, चाबियां |
| Provider | प्रदाता | प्रोवाइडर |
| Devices | डिवाइस / डिवाइसों | डिवाइसेस, उपकरण |
| Credentials | क्रेडेंशियल (no -्स) | क्रेडेंशियल्स |
| Simple mode | सिंपल मोड (also in legal text) | सरल मोड |
| Zero knowledge | ज़ीरो नॉलेज / ज़ीरो-नॉलेज आर्किटेक्चर (m.) | शून्य-ज्ञान as a term |
| Conflict (sync) | विरोध | संघर्ष |
| Export / import | एक्सपोर्ट / इम्पोर्ट (legal "निर्यात (पोर्टेबिलिटी)" in the GDPR rights list only) | निर्यात/आयात in UI |
| Format | फॉर्मेट | प्रारूप, फ़ॉर्मैट |
| Dictate (button) | बोलकर लिखें | डिक्टेट करें |
| Microphone / recording | माइक्रोफ़ोन / रिकॉर्डिंग (f.) | माइक |
| Transcribe | ट्रांसक्राइब करना / ट्रांसक्रिप्शन | – |
| Filler words | भराव शब्द (“अं”, “उम्म” जैसे) | फिलर वर्ड्स |
| Feature (UI) / feature (legal) | फीचर, फीचर्स / सुविधा, सुविधाएं | – |
| Store / save | UI: सेव / स्टोर; legal: संग्रहीत | – |
| Tour (onboarding) | गाइड | – |
| Apple Account (ex-Apple ID) / Sign in with Apple | Apple खाता (m., obl. "आपके Apple खाते में/से/पर"; Apple: "अपने Apple खाते में साइन इन करें") / button "Apple से साइन इन करें" | Apple ID, "आपकी Apple ID", Apple अकाउंट |
| Danger Zone / Reset All Data | डेंजर ज़ोन / “सभी डेटा रीसेट करें” (quote `storage.resetAllData` exactly in Help) | “DELETE All Data”, सभी डेटा हटाएं |

## 3. Legal / privacy vocabulary (app legal pages; website FAQ answers that touch privacy)
Formal legal Hindi. No Hinglish (प्रोसेसिंग, ट्रांसफर,
पेड टियर, यूज़र, अकाउंट, डिलीट) in either policy. India has no Hindi GDPR text; use the
vocabulary of the Hindi DPDP Act 2023 and standard Rajbhasha terms:
- processing → **प्रसंस्करण** (m.); verb संसाधित करना. Title: "प्रसंस्करण का कानूनी आधार".
- AI section title: "AI सुविधाएं और प्रसंस्करण" (cross-references must quote it exactly).
- data transfer → डेटा हस्तांतरण / स्थानांतरण; SCCs → मानक संविदात्मक खंड; adequacy → पर्याप्तता निर्णय
- safeguards → सुरक्षा उपाय; consent → सहमति; DPO → डेटा संरक्षण अधिकारी; erasure → विलोपन
- paid tier / paid subscription / paid service → **सशुल्क** स्तर / सदस्यता / सेवा
  ("भुगतान स्तर/सदस्यता" is wrong: it reads as "payment tier")
- materially breach / material changes → सारभूत रूप से उल्लंघन / सारभूत परिवर्तन ("भौतिक" = physical ✗)
- contract concluded → अनुबंध संपन्न होना (not समाप्त, which means ended);
  immediate performance → तत्काल निष्पादन; "as is" / "as available" → “जैसा है” / “जैसा उपलब्ध है”
- abuse monitoring → दुरुपयोग की निगरानी; fair-use rate limiting → उचित-उपयोग सीमाएं लागू करना
- The website has no `legal` block any more (removed Nov 2026); legal text lives only in the app.
- "via our servers" (AI requests) → "हमारे सर्वर से होते हुए"; "passes through our servers only in
  transit … and is not kept" → "… तक पहुंचने के रास्ते में ही हमारे सर्वर से होकर गुज़रती है और रखी नहीं जाती".
- Right of withdrawal → वापसी का अधिकार; "withdraw from a subscription" → "सदस्यता से हटना"
  (not "सदस्यता से वापस लेना", which lacks an object). Refund (FAQ) → रिफंड; legal → धनवापसी.
- Keep the direction of "X such as Y": "मानक संविदात्मक खंड जैसे उचित … सुरक्षा उपाय".
- Dates: month name + year, "नवंबर 2026", "अप्रैल 2026", same style for privacy and terms.
  Label: "अंतिम अपडेट: {{date}}" (`legal.lastUpdatedOn`).
- Required voice-entry facts: 5 minutes per recording; 200 minutes per month; Plus only; audio goes
  to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted;
  Google's paid tier does not train on the data; Google may keep data only briefly / for a limited
  time for abuse monitoring.

## 4. Punctuation and typography (both files)
- Sentence end: पूर्ण विराम "।". "?" and "!" as in English.
- Ellipsis: always the single character "…" (never "...").
- Dash: spaced em dash " — " for breaks and label–explanation pairs ("नहीं मिला — लक्ष्य स्थान …").
  Never " - " or "–" as a dash. En dash only in numeric ranges without spaces ("24–48", "30–60").
  Markdown list syntax ("- सूचियां") is code, leave it.
- Quotation marks: curly double “ ” for quoted UI labels, typed words and examples
  (“सेटअप सहायता”, “DELETE ALL”, “अं”). No straight " or ' quotes; the only ' left is the
  apostrophe in "Let's Encrypt". No full-width （） brackets.
- Menu paths use "→" (सेटिंग्स → आपका नाम → iCloud), not ">".
- Do not put commas between a noun and its postposition; restructure with a relative clause.
- Nukta: per word, the app's dominant spelling wins in both repos. Without nukta: फाइल, फोल्डर,
  फीचर, फोटो, ऑफलाइन, मुफ्त, साफ, सिर्फ, जिम्मेदार, मजबूत, कमजोर, अंग्रेजी, यूजरनेम, फॉर्मेट.
  With nukta: प्रोफ़ाइल, ज़ीरो, ज़रूरी, ज़रूरत, ज़्यादा, तेज़, डिफ़ॉल्ट, फ़िल्टर, ब्राउज़र, कॉन्फ़िग,
  दस्तावेज़, माइक्रोफ़ोन, आज़माएं, हक़दार. Use decomposed nukta (letter + U+093C) as the files do.
- Numbers: Western digits; units spaced "5 MB", "20 MB", "{{ms}} ms", "5 मिनट"; "/माह", "/वर्ष".
- Website prices: never hard-code an amount or currency; use "{{price}}/वर्ष", "~{{monthly}}/माह"
  (the code formats the visitor's currency).

## 5. Grammar pitfalls (seen in machine output)
- Perfective transitive verbs agree with the object: "सभी {{minutes}} मिनट इस्तेमाल कर लिए हैं".
- Gender: रिकॉर्डिंग, प्रविष्टि, सदस्यता, सुविधा, जर्नल, कुंजी, स्क्रीन are f.; फीचर, टेक्स्ट,
  प्रसंस्करण, डेटा, आर्किटेक्चर, प्लान are m. ("Nextcloud की ऐप पासवर्ड स्क्रीन").
- Placeholders that already carry "पहले" (time-ago strings) must not get another: syncedTimeAgo is
  "{{time}} सिंक हुआ". `{{activity}}` can be m. or f.: use "{{activity}} का संबंध … से है".
- Labels followed by code/URL in the UI end with ":" ("सिंक हो रहा है:", "… जिसके नाम के अंत में यह हो:").
- Sign-up legal line is one `<Trans>` key `auth.termsAgreement`: "जारी रखकर आप हमारी
  <terms>सेवा की शर्तें</terms> और <privacy>गोपनीयता नीति</privacy> स्वीकार करते हैं।"
  स्वीकार करना takes a direct object, so the link labels stay in the nominative ("… से सहमत"
  would need the oblique शर्तों, which the fixed link label cannot give).
- Plurals: CLDR hi = one / other only. `_one` covers 0 AND 1 (i = 0 or n = 1), so write a
  singular that reads with both: "{{count}} प्रविष्टि सिंक हुई", "{{count}} फाइल … हुई",
  "{{count}} टैग जोड़ा गया", "{{count}} विफलता". Singular oblique stays प्रविष्टि ("{{count}} प्रविष्टि
  का विश्लेषण"); `_other` uses प्रविष्टियां / obl. प्रविष्टियों and plural verbs. Never a base key.
- Chart tooltip `moodCorrelations.tooltipDetail_*`: "{{delta}} (औसत: {{emoji}} {{avg}}, {{count}} प्रविष्टि/प्रविष्टियां)"
  — ASCII parentheses and comma, label "औसत:" (no full stop inside a tooltip).
- "When you stop (recording)" → "रिकॉर्डिंग रोकते ही". "mid-sentence / along the way" → "बोलते-बोलते".
- Possibility: "हो सकता है कि … हो" / "शायद …", not "… गया हो सकता है".
- "Transcribe your voice with Google?" → "अपनी रिकॉर्डिंग Google से ट्रांसक्राइब करवाएं?".
- "available with Plus" → "Plus में उपलब्ध है".

## 6. Length / fit
Button labels: 1–3 words ("बोलकर लिखें", "रोकें", "जारी रखें", "अभी नहीं"). Hindi runs about
20–30% longer than English. Keep chips short: "{{seconds}} सेकंड में रुकेगा", "चरण {{current}}/{{total}}".

## Sources
- Microsoft Hindi Localization Style Guide (PDF, 2024): https://download.microsoft.com/download/2/b/5/2b543b85-0ed4-49a7-8b3a-98ffa7addcfb/hin-ind-StyleGuide.pdf
  (voice, -ें imperatives, simple words over Sanskritized ones in UI, punctuation and dash guidance;
  it prefers an English full stop, but the repos' "।" convention wins)
- Microsoft style guides index: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- DPDP Act 2023 / DPDP Rules 2025 Hindi gazette (डेटा न्यासी, सहमति, प्रसंस्करण): https://egazette.gov.in/WriteReadData/2025/259889.pdf
- Google India blog on voice typing in Indian languages: https://india.googleblog.com/2017/08/type-less-talk-more-in-eight-indian.html
- Apple Hindi naming: https://support.apple.com/hi-in/guide/iphone/iph76e54c61e/ios ("अपने Apple खाते में साइन इन करें");
  https://www.apple.com/legal/privacy/data/hi/sign-in-with-apple/ ("Apple से साइन इन करें")
- Gboard dictation help (Gemini "Rambler" voice input): https://support.google.com/gboard/answer/17468539
- House style: term counts from both hi.json files (Nov 2026); owner decisions of Nov 2026.

## 7. Dreams glossary (Nov 2026)
| English | Use | Avoid | Basis |
|---|---|---|---|
| Dream / Dreams (chip, filter) | सपना / सपने | स्वप्न in UI | everyday word; judgment |
| Dream journal | सपनों की जर्नल (f.) | सपनों की डायरी | house term जर्नल |
| Dream reflection (feature; countable result) | सपने पर चिंतन; count with invariant m. चिंतन ("30 चिंतन", "{{remaining}} चिंतन बाकी"); result "तैयार होना" | "चिंतन बनना", रिफ्लेक्शन | judgment; matches `समापन चिंतन` |
| Dream patterns (report) | सपनों के पैटर्न / “सपनों के पैटर्न” रिपोर्ट | ड्रीम पैटर्न | house term पैटर्न |
| Nightmare / recurring / lucid dream | बुरा सपना / बार-बार आने वाला / ल्यूसिड ड्रीम (with a यानी gloss) | दुःस्वप्न in chips; coinages like सचेत सपना | hi.wikipedia title "दुःस्वप्न (बुरे सपने)"; no Hindi article or term for lucid dream (Wikipedia langlinks) |
| Jung / Hall / Domhoff / Clara Hill | कार्ल युंग / कैल्विन हॉल / जी. विलियम डॉमहॉफ / क्लारा हिल | जंग, यूंग | hi.wikipedia "कार्ल युंग"; others judgment |
| Hill's dream-work model | सपनों पर काम करने का क्लारा हिल का मॉडल | ड्रीम वर्क मॉडल (echoes Freud's dream-work) | judgment |
| Health professional / crisis line | डॉक्टर या काउंसलर / मानसिक स्वास्थ्य हेल्पलाइन; "आपातकालीन नंबर पर कॉल करें" | अथवा in warm UI text; specific numbers | Tele-MANAS Hindi coverage: "प्रशिक्षित काउंसलर", "हेल्पलाइन नंबर" |
