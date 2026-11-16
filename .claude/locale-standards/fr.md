# French (fr) — OwnJournal UI and legal localization standard

Scope: app UI strings, Help, paywall and legal/privacy texts in `src/i18n/locales/fr.json`, plus the
website's product/legal strings (`ownjournal-website/src/i18n/locales/fr.json`). For long-form blog voice
see the website's `.claude/locale-standards/fr.md`. Target is France French (fr-FR), not fr-CA.

## Register and address form (house style)
- App: **vous** throughout (about 815 vous/votre/vos against a handful of stray *tu*). Never use *tu* in the app.
- Website product pages: **vous** dominates (about 244 vs 20). A few `features.free.*` descriptions and
  FAQ answers use *tu* (« Organise tes notes », « Découvre… »). That is legacy drift, so write new website
  UI strings with **vous**. (The website blog rubric uses *tu*. That rule is for blog posts only.)
- Imperative + vous for instructions (« Appuyez sur… », « Autorisez-le… »). « Veuillez » only in
  short requests/errors where it is already used (« Veuillez réessayer. »).

## Glossary (house terms win over generic guides)
| English | Use | Avoid / notes |
|---|---|---|
| tap | **appuyer sur** (app house style, 7 uses; Google/Android wording) | « toucher » (Apple iOS wording, but a minority in this file); the website FAQ currently has « touchez » |
| microphone | **micro** (house, Android permission label "Micro") | « microphone » in UI copy; OK in legal text but « micro » is fine there too |
| Voice Entry (feature) | **Saisie vocale** (= Gboard's own name) | « Entrée vocale » (clashes with *entrée* = journal entry) |
| Dictate (button) | **Dicter** | « Dictée » is Apple's feature name, not a verb button |
| transcribe / transcription | **transcrire / transcription** | « retranscrire » |
| recording | **enregistrement** | « record » |
| entry | **entrée** (house, app + website) | blog rubric prefers *note/page*; do not change UI strings |
| settings (device/browser) | **paramètres** (Android, Chrome, rest of file) | « réglages » only for an explicit iOS path (Réglages > …) |
| AI | **IA** (« l'analyse par IA », « fonctionnalités d'IA ») | « AI »; « alimenté par l'IA » (calque of *AI-powered*), « basé sur l'IA » is fine |
| Plus | **Plus** (invariable, product name), « abonnés Plus », « (Fonctionnalité Plus) » | |
| Activity Insights | **Analyses d'activités** (app) / « Analyse des activités » (website) | keep each repo's own form |
| fair use | **utilisation équitable** (« limites d'utilisation équitable ») | « utilisation raisonnable » |
| AI inputs / outputs | « données transmises à l'IA » / « résultats qu'elle produit »; prompts → **requêtes**, outputs → **réponses** | « entrées/sorties » (ambiguous with journal *entrées*) |
| usage limit resets | « votre quota sera renouvelé » / « le compteur sera remis à zéro » | « la limite sera réinitialisée » (calque) |
| clean (text) | « un texte propre » (+ « et ponctué ») | « texte nettoyé » |
| your words | « ce que vous dites / avez dit » | « vos paroles » (sounds like song lyrics) |
| offline | **hors ligne**; internet connection → « connexion Internet » | |

## GDPR / legal vocabulary (official FR text of Regulation (EU) 2016/679, CNIL)
- personal data → **données à caractère personnel** (legal) / « données personnelles » (UI).
- processing → **traitement**; processor → **sous-traitant**; controller → **responsable du traitement**.
- adequacy decision → **décision d'adéquation** (art. 45); EEA → **Espace économique européen (EEE)**.
- appropriate safeguards → **garanties appropriées** (art. 46); « met en œuvre / prévoit des garanties
  appropriées », not « maintient des garanties ».
- SCCs → **clauses contractuelles types (CCT)** (Commission/CNIL usage; art. 46(2)(c) says « clauses types de
  protection des données »). Lowercase in running text.
- technical and organisational measures → **mesures techniques et organisationnelles**.
- "explicitly use" → « utilisez expressément »; "per its current policies" → « conformément à ses politiques en vigueur ».
- Never add or drop a fact in legal text. Voice-entry invariants: 5 min per recording; 200 min/month;
  Plus only; audio goes to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds
  are counted; Google's paid tier does not train on the data; Google may retain data for a limited
  period for abuse monitoring.

## Typography (Imprimerie nationale rules; Microsoft fr-FR style guide)
- **No-break space before high punctuation**: U+202F (narrow no-break) before `; ? !`, U+00A0 before `:`.
  Never a plain space (it lets « ? » wrap onto its own line on phones). The existing files still use
  plain spaces almost everywhere. New and edited strings get the correct spaces; a whole-file pass is an owner decision.
- **Number + unit**: U+00A0 between them: `5 minutes`, `200 min`, `{{seconds}} s`, `19,99 $`.
- Guillemets « » with U+00A0 (or U+202F) inside; no straight double quotes in copy.
- Ellipsis: the single character `…` for UI states (« Transcription… »). The file has legacy `...`; do not mass-fix.
- Em dash `—` with spaces for an aside; no en-dash ranges in prose (« de 5 à 10 »).
- Month names lowercase: « novembre 2026 » (the app renders it after « Dernière mise à jour: »).
- Sentence case for labels and buttons. The title-case drift on the website (« Voir les Tarifs ») is
  legacy; do not copy it into new strings.
- Decimal comma, space as thousands separator (U+202F/U+00A0): « 1 000 », « 1,67 $ ».

## UI microcopy conventions
- Buttons: infinitive verb, short (« Dicter », « Arrêter », « Continuer », « Pas maintenant »,
  « Annuler l'enregistrement »). Avoid « Cliquez ici ».
- Errors: state the problem, then the fix, in vous form: « L'accès au micro est bloqué. Autorisez-le
  dans les paramètres… ». No exclamation marks.
- Progress states: noun + `…` (« Transcription… »), or « … en cours » if space allows.
- Placeholders: French has no ICU plural here unless the code passes `count`. With `{{minutes}}` coming
  from `Math.floor` (0/1 possible), use constructions that work for any number: « Il reste {{minutes}} min… »,
  not « {{minutes}} min restantes ».
- Avoid English sentence mirroring: subordinate instead of stacking clauses, prefer an absolute
  participle construction (« la conservation de la requête par Google étant désactivée ») to a
  calque like « avec X désactivé chez Google ».

## Known pitfalls
- *entrée* (journal entry) vs AI *input*: never translate "input" as *entrée* in AI/legal text.
- « Insights » is an anglicism already entrenched in the app (« Insights d'humeur »). Keep it in
  existing feature names, but don't spread it into new prose.
- fr-CA differences (no space before `?`/`!`, « courriel ») do not apply. Use « e-mail » (house).
- « en cours de phrase », « passer d'une langue à l'autre » are natural; « switcher » is not.

## Sources
- GDPR, French text (EUR-Lex): https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679
- CNIL, RGPD chapitre 5 (transferts): https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre5
- Microsoft fr-FR localization style guide: https://download.microsoft.com/download/c/7/9/c7921dbd-4531-4a4e-8490-e4656d739f3d/fra-fra-StyleGuide.pdf
- Microsoft Globalization, punctuation separators: https://learn.microsoft.com/fr-fr/globalization/internationalization/punctuation-separators
- Apple iPhone User Guide FR, Dicter du texte: https://support.apple.com/fr-afri/guide/iphone/dictate-text-iph2c0651d2/13.0/ios
- Gboard « Saisie vocale » / Android « Micro » permission naming (Google help; third-party guides e.g.
  https://www.prodigemobile.com/tutoriel/dicter-texte-android/)
- Non-breaking spaces before French punctuation: https://wiki.openoffice.org/wiki/Non_Breaking_Spaces_Before_Punctuation_In_French_(espaces_insécables)
