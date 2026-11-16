# Hindi (hi) – UI, Help and legal standard for OwnJournal

Scope: app strings (`src/i18n/locales/hi.json`) and the website's UI/FAQ/legal strings
(`ownjournal-website/src/i18n/locales/hi.json`). Blog prose follows the website's long-form
standard (`ownjournal-website/.claude/locale-standards/hi.md`). Its तुम register is only for
blog posts. It does NOT apply to the app or to website UI/FAQ/legal pages, which use आप.

## 1. Register and address (house style)
- **आप** everywhere: app (no तुम in the UI), website UI/FAQ/legal (≈200 आप, about 10 तुम in
  marketing copy only). Possessives आपका/आपकी/आपके. Never mix in तुम forms.
- Imperatives in **-ें** form: करें, चुनें, हटाएं, आज़माएं, अनुमति दें (≈530 "करें" in the
  app, zero "कीजिए"). This also matches Microsoft's Hindi UI guidance. Do not switch the UI
  to -इए; -इए is for blog prose only.
- Spelling of the plural imperative in the app: anusvara (हटाएं, करवाएं), not chandrabindu
  (हटाएँ). The website mixes both (पाएँ/जाएँगे). Leave either as found.
- Errors: state the problem, then the fix. Polite "कृपया" is established ("कृपया पुनः प्रयास करें।"
  appears more than 50 times). Dialog titles that ask a question end with "?" and drop "क्या"
  when the sentence reads fine without it.
- Status lines are impersonal: "ट्रांसक्राइब हो रहा है…", "सिंक हो रहा है…".

## 2. Glossary (term → use → avoid)
| English | App (hi.json) | Website | Avoid / note |
|---|---|---|---|
| Voice entry (feature name) | वॉइस एंट्री | वॉइस एंट्री | Keep it as a fixed feature name even in the app |
| Entry (journal entry, generic) | प्रविष्टि (≈250×) | एंट्री (≈50×) | Never mix the two within one repo |
| Dictate (button) | बोलकर लिखें | – | डिक्टेट करें, श्रुतलेख |
| Microphone | माइक्रोफ़ोन | माइक्रोफ़ोन | माइक |
| Recording | रिकॉर्डिंग (f.) | रिकॉर्डिंग | – |
| Transcribe / transcription | ट्रांसक्राइब करना / ट्रांसक्रिप्शन; plain-language gloss "टेक्स्ट में बदलना" | same | "आपकी आवाज़ ट्रांसक्राइब करें" (calque); use रिकॉर्डिंग as the object |
| Speech → text | बोली गई बात / आपके शब्द → टेक्स्ट | same | पाठ (reads as "lesson") |
| Punctuated | विराम-चिह्नों के साथ | same | – |
| Filler words | भराव शब्द ('अं', 'उम्म' जैसे) | same | फिलर वर्ड्स |
| Plus | Plus (Latin) | प्लस (Devanagari) | Keep each repo's form |
| Plus feature | (Plus फीचर) | प्लस फीचर | – |
| Subscription | UI: सदस्यता or सब्सक्रिप्शन ("Plus सब्सक्रिप्शन आवश्यक है"); legal: सदस्यता | सब्सक्रिप्शन (f.) | – |
| Subscriber (legal) | ग्राहक ("Plus ग्राहकों") | सब्सक्राइबर | सब्सक्राइबर्स in app legal text |
| AI | AI | AI | कृत्रिम बुद्धिमत्ता in UI |
| Feature | UI: फीचर; legal: सुविधा | फीचर | – |
| Retry | पुनः प्रयास करें; a specific action: "फिर से ट्रांसक्राइब करें" | – | "फिर से आज़माएं" with a noun object |
| Continue / Not now | जारी रखें / अभी नहीं | – | – |
| Cancel / Discard | रद्द करें / हटाएं | – | – |
| Offline | ऑफलाइन (app, no nukta, 8×) | ऑफ़लाइन (website) | – |
| Format | फॉर्मेट (app, 10×) | – | फ़ॉर्मैट |
| Settings | सेटिंग्स | सेटिंग्स | – |
| Store / save | UI: सेव / स्टोर; legal: संग्रहीत | स्टोर / सेव | – |
| Required | आवश्यक (UI), ज़रूरी (informal) | – | – |

## 3. Legal / privacy vocabulary
India has no Hindi GDPR text. The EU publishes the GDPR only in EU languages. Use the
vocabulary of the official Hindi DPDP Act 2023 (डिजिटल वैयक्तिक डेटा संरक्षण अधिनियम) and
standard Rajbhasha terms. App legal pages are written in formal, Sanskritized Hindi. Keep
that register:
- processing → **प्रसंस्करण** (m.: "प्रसंस्करण होता है"); verb संसाधित करना. Avoid प्रोसेसिंग in app legal text.
- data transfer → **डेटा हस्तांतरण** / स्थानांतरण (title: "अंतर्राष्ट्रीय डेटा स्थानांतरण")
- Standard Contractual Clauses → मानक संविदात्मक खंड (SCC); adequacy decision → पर्याप्तता निर्णय
- safeguards → सुरक्षा उपाय; consent → सहमति; personal data → व्यक्तिगत (DPDP: वैयक्तिक) डेटा
- third-party → तृतीय-पक्ष; provider → प्रदाता; paid tier/API → सशुल्क स्तर / सशुल्क API
  ("भुगतान API" is wrong: it means a payments API)
- abuse monitoring → दुरुपयोग की निगरानी; policy enforcement → नीति प्रवर्तन
- fair-use rate limiting → उचित-उपयोग सीमाएं लागू करना
- The website's legal page is Hinglish (प्रोसेसिंग, ट्रांसफर, पेड टियर). That is house style there.
  Do not Sanskritize it.
- Keep the direction of "X such as Y": "मानक संविदात्मक खंड **जैसे** उचित … सुरक्षा उपाय"
  (safeguards such as SCCs). Reversing it changes the legal meaning.
- Required facts for voice entry: 5 minutes per recording; 200 minutes per month; Plus only;
  audio goes to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds
  are counted; Google's paid tier does not train on the data; Google may keep data for a
  limited time for abuse monitoring.

## 4. Punctuation and typography
- Sentence end: **पूर्ण विराम "।"** (house style in both repos). Microsoft's guide prefers an
  English full stop; the repo's convention wins. Use "?" and "!" as in English.
- Ellipsis: the single character "…". Em dash "—" is fine in marketing/teaser lines; avoid
  chains of dashes. Microsoft advises commas where a dash feels foreign.
- Do not put commas between a noun and its postposition ("हमारे AI प्रदाता, वर्तमान में
  Google, को" ✗). Restructure with a relative clause ("…प्रदाता को, जो वर्तमान में Google है").
- Nukta: the app mostly uses it (ब्राउज़र, ज़रूरी, तेज़, आज़माएं). Follow established
  exceptions (ऑफलाइन, फॉर्मेट, फाइल, साफ). Never respell well-established words file-wide.
- Numbers stay Western Arabic digits; units are written out: "5 मिनट", "{{seconds}} सेकंड",
  "200 मिनट/माह" (compact tables only).

## 5. Grammar pitfalls (seen in machine output)
- Verb agreement in perfective transitive sentences goes with the object: "सभी {{minutes}} मिनट
  इस्तेमाल कर **लिए हैं**" (मिनट, m. pl.), not "कर ली है". Do not let the verb agree with a
  nearby feminine noun (वॉइस एंट्री).
- Gender: रिकॉर्डिंग, एंट्री, प्रविष्टि, सदस्यता, सुविधा are f.; फीचर, टेक्स्ट, प्रसंस्करण, डेटा are m.
- "When you stop (recording)" → "रिकॉर्डिंग रोकते ही", not "जब आप रुकते हैं" (that reads as
  "when you pause").
- Correlative clauses read naturally when the relative clause comes first: "आप जिस भी भाषा
  में बोलें, आपके शब्द उसी भाषा में…".
- "with Plus" → "Plus में" or "Plus के साथ"; both appear in the app already.
- "Transcribe your voice with Google?" → "अपनी रिकॉर्डिंग Google से ट्रांसक्राइब करवाएं?"
  The causative fits because Google does the work.

## 6. Length / fit
Button labels: 1–3 words ("बोलकर लिखें", "रोकें", "जारी रखें", "अभी नहीं"). Hindi runs about
20–30% longer than English. Keep countdown and quota chips short: "{{seconds}} सेकंड में रुकेगा",
"इस महीने {{minutes}} मिनट बाकी".

## Sources
- Microsoft Hindi Localization Style Guide (PDF, 2024): https://download.microsoft.com/download/2/b/5/2b543b85-0ed4-49a7-8b3a-98ffa7addcfb/hin-ind-StyleGuide.pdf
  (voice, -ें imperatives, simple words over Sanskritized ones in UI, punctuation and dash guidance)
- Microsoft style guides index: https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- DPDP Act 2023 / DPDP Rules 2025 Hindi gazette (डेटा न्यासी, सहमति, प्रसंस्करण): https://egazette.gov.in/WriteReadData/2025/259889.pdf
- Google India blog on voice typing in Indian languages: https://india.googleblog.com/2017/08/type-less-talk-more-in-eight-indian.html
- Gboard dictation help (Gemini "Rambler" voice input): https://support.google.com/gboard/answer/17468539
- House style: counts taken from the repo's hi.json files (Nov 2026).
