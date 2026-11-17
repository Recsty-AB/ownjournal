# French (fr) — OwnJournal UI and legal localization standard

Scope: app UI strings, Help, paywall and legal/privacy texts in `src/i18n/locales/fr.json`, plus the
website's product/legal strings (`ownjournal-website/src/i18n/locales/fr.json`). For long-form blog voice
see the website's `.claude/locale-standards/fr.md`. Target is France French (fr-FR), not fr-CA.

## Register and address form (house style)
- **vous** everywhere in product UI and legal text, in both repos (owner decision, Nov 2026). The last *tu*
  strings (app Help mood/activity texts, `moodCorrelations.*`; website `features.free.*`, FAQ answers,
  `security.encryption.keys`) were converted. Never use *tu* outside the website blog (blog rubric = *tu*).
- Imperative + vous for instructions (« Appuyez sur… », « Autorisez-le… »). « Veuillez » only in
  short requests/errors where it is already used (« Veuillez réessayer. »).

## Glossary (house terms win over generic guides)
| English | Use | Avoid / notes |
|---|---|---|
| tap / click | **appuyer sur** for in-app controls (house, both repos; Google/Android wording). « cliquer sur » only where English keeps *Click*: outside the app or on web/desktop-only surfaces (Nextcloud web UI, browser, e-mail links, Stripe billing portal and its « Gérer » button, Apple web sign-in pop-up) | « toucher/touchez » |
| microphone | **micro** (house, Android permission label "Micro") | « microphone » in UI copy; OK in legal text but « micro » is fine there too |
| Voice Entry (feature) | **Saisie vocale** (= Gboard's own name) | « Entrée vocale » (clashes with *entrée* = journal entry) |
| Dictate (button) | **Dicter** | « Dictée » is Apple's feature name, not a verb button |
| transcribe / transcription | **transcrire / transcription** | « retranscrire » |
| recording | **enregistrement** | « record » |
| entry | **entrée** (app + website product/legal) | « note » means the separate *Notes* feature (`notes.*`); never use it for a journal entry. Blog may say *note/page* |
| timeline | **chronologie** | « timeline » |
| journaling (habits/patterns) | « habitudes d'écriture », « écrire » (« Commencer à écrire ») | « journalisation », « journaliser » (= logging) |
| patterns (trend analysis) | « schémas récurrents », « tendances » | « modèles » |
| support (contact) | **assistance** (« Contacter l'assistance ») | « le support » |
| supports X (capability) | « prend en charge », « pris en charge » | « supporte », « supporté » |
| pop-up | « fenêtre contextuelle » | « popup » |
| retry (diagnostics) | « nouvelle tentative » | « réessai » |
| Welcome back | « Content de vous revoir ! » | « Bon retour ! » |
| Simple mode | **mode Simple** / « Mode Simple » (mode name, capital S) | « mode simple » |
| Photo memories | « Souvenirs photo » (both repos) | « Souvenirs photos » |
| moods | Excellent, Bien, Correct, Mauvais, Terrible (app labels; website FAQ uses the same) | Génial, Moyen |
| settings (device/browser) | **paramètres** (Android, Chrome, rest of file) | « réglages » only for an explicit iOS path (Réglages > …) |
| AI | **IA**: nouns take « d'IA » (fonctionnalités, service, modèles, fournisseur, outils d'IA); actions take « par IA » (analyse, suggestions de titres/tags, génération par IA); « traitement par l'IA » | « fonctionnalités IA », « analyse IA » (both repos converted); « alimenté par l'IA » (calque of *AI-powered*); « basé sur l'IA » is fine |
| Apple Account (ex-Apple ID) | **compte Apple** (Apple FR, lowercase *compte* in running text: « votre compte Apple », « ce compte Apple ») | « identifiant Apple » (pre-2024 name, removed Nov 2026) |
| Sign in with Apple (button/feature) | **Se connecter avec Apple** (Apple's official FR name); « Continuer avec Apple » for the continue variant | « Se connecter avec l'identifiant Apple » |
| Plus | **Plus** (invariable, product name), « abonnés Plus », « (Fonctionnalité Plus) » | |
| Activity Insights | **Analyses d'activités** (feature name, both repos, capital A when it names the feature) | « Analyse des activités », « Analyses par activité » |
| insights (generic) | **analyses**; Key Insights → « Points clés »; Focus Areas → « Axes de progression » | « insights » (anglicism, removed from both repos) |
| fair use | **utilisation équitable** (« limites d'utilisation équitable ») | « utilisation raisonnable » |
| AI inputs / outputs | « données transmises à l'IA » / « résultats qu'elle produit »; prompts → **requêtes**, outputs → **réponses** | « entrées/sorties » (ambiguous with journal *entrées*) |
| usage limit resets | « votre quota sera renouvelé » / « le compteur sera remis à zéro » | « la limite sera réinitialisée » (calque) |
| clean (text) | « un texte propre » (+ « et ponctué ») | « texte nettoyé » |
| your words | « ce que vous dites / avez dit » | « vos paroles » (sounds like song lyrics) |
| offline | **hors ligne**; internet connection → « connexion Internet » | |
| upload (to cloud) / image upload | « envoi », « en cours d'envoi », « envoyer vers »; images → « ajout d'images » | « téléchargement » (= download), « téléverser » only in legal text |
| Reset All Data (`storage.resetAllData`) | « Réinitialiser toutes les données »; Help/recovery texts must quote this exact label | « Tout supprimer », « SUPPRIMER toutes les données » |
| cancel a subscription | UI/FAQ: **annuler** (« annuler votre abonnement », « Annulez à tout moment », = Apple's « Annuler l'abonnement »); legal text: « résiliation » | mixing « résilier » into UI copy |

## GDPR / legal vocabulary (official FR text of Regulation (EU) 2016/679, CNIL)
- personal data → **données à caractère personnel** in the privacy policy and terms (both repos), never
  « informations personnelles ». Exception: the US-state section (`californiaRights`) keeps « informations
  personnelles », the translation of the CCPA's own defined term *personal information*.
- data subject rights (art. 15–21, 77): droit d'accès, de **rectification**, d'**effacement**, à la
  **limitation du traitement**, à la portabilité, d'opposition; « **introduire une réclamation** auprès
  d'une autorité de contrôle ». Avoid « corriger », « restreindre le traitement », « déposer une plainte ».
- "materially breach" → « manquer de manière substantielle à »; "material changes" → « modifications
  substantielles » (« matériellement » is a calque). "analytics" → « mesure d'audience ».
- processing → **traitement**; processor → **sous-traitant**; controller → **responsable du traitement**
  (not « responsable du traitement des données »); payment processor → « prestataire de paiement ».
- Section titles: « Base juridique du traitement », « Fonctionnalités d'IA et traitement », « Droit applicable »,
  sentence case. Documents are named « Politique de confidentialité » / « Conditions d'utilisation » (capital first word only).
- The website no longer carries legal texts (its `legal` block was deleted on purpose, Nov 2026); the app's
  privacy policy and terms are the only legal source. AI requests and voice recordings pass « via nos
  serveurs » only in transit (« ne fait que transiter par nos serveurs … et n'est pas conservé »).
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
- **No-break space before high punctuation** (applied to both whole files, Nov 2026): U+202F (narrow
  no-break) before `; ? !`, U+00A0 before `:`. Never a plain space. Not before a colon in code, URLs, times
  or HTTP headers (`https:`, `maintenance:mode`, `Access-Control-Allow-Origin: *`).
- Lowercase after a colon in running text (« Pour créer une sauvegarde : cliquez… »). Keep a capital in
  numbered headings (« Étape 1 : Activer… », « Option 2 : Désactiver… ») and for button labels/proper nouns.
- **Number + unit**: U+00A0 between them: `5 minutes`, `200 min`, `{{seconds}} s`, `19,99 $`.
- Guillemets « » with **U+202F inside** for quoted UI labels and terms (« Gérer », « DELETE »); no straight
  `"` or `'…'` quotes in copy. Apostrophe: straight `'` (house style; curly ’ was normalized).
- Ellipsis: always the single character `…` (all `...` converted in both files).
- Em dash `—` with spaces for an aside. Error/label separators use a colon, not a hyphen:
  « Session expirée : veuillez reconnecter… ». Markdown syntax (`- listes`, `# titres`) stays as is.
- Percent: U+00A0 before `%` (« 100 % », « {{rate}} % »). Abbreviated units: « {{minutes}} min »,
  « {{hours}} h », « {{days}} j », « 15 s », « {{ms}} ms ».
- Dates: lowercase month + year, same style for privacy and terms in both repos (« novembre 2026 »,
  « avril 2026 », « décembre 2024 »). `legal.lastUpdatedOn` = « Dernière mise à jour : {{date}} » (U+00A0).
- Sentence case for titles, labels and buttons (website title case « Voir les Tarifs » was fixed). Plan
  names keep their capital in running text (« le plan Gratuit », « Plus »).
- Decimal comma, space as thousands separator (U+202F/U+00A0): « 1 000 », « 1,67 $ ».

## UI microcopy conventions
- Buttons: infinitive verb, short (« Dicter », « Arrêter », « Continuer », « Pas maintenant »,
  « Annuler l'enregistrement »). Avoid « Cliquez ici ».
- Errors: state the problem, then the fix, in vous form: « L'accès au micro est bloqué. Autorisez-le
  dans les paramètres… ». No exclamation marks.
- Progress states: noun + `…` (« Transcription… »), or « … en cours » if space allows.
- **Plurals** (i18next 25, CLDR fr = `one`, `many`, `other`): every key split into `_one/_other` in en.json
  needs `_one`, `_many` and `_other` in fr.json, never a bare base key (a missing category falls back to
  English). `one` covers 0 and 1 (« 0 entrée synchronisée »). `many` (1 000 000, 1,5 M…) uses the same
  text as `other` because `{{count}}` is printed as digits (no « de »). Real agreement in each form, no
  « (s) » hedges. Prefer « {{count}} entrées sur {{total}} » to « {{count}} sur {{total}} entrées ».
- Website prices: never hard-code an amount or currency; use `{{price}}` / `{{monthly}}` (the code formats
  them for the visitor's currency in fr), e.g. « {{price}} par an (environ {{monthly}} par mois) ».
- `auth.termsAgreement` is one `<Trans>` sentence: « En continuant, vous acceptez nos <terms>Conditions
  d'utilisation</terms> et notre <privacy>Politique de confidentialité</privacy>. » (final period; exactly one
  `<terms>` and one `<privacy>` pair, no other tags). The old prefix/`and`/suffix keys are gone.
- Chart tooltip `moodCorrelations.tooltipDetail_*`: « {{delta}} (moy. : {{emoji}} {{avg}}, {{count}} entrée[s]) »
  with U+00A0 before the colon. `{{avg}}`/`{{delta}}` come from `toFixed(1)` (dot decimal), so the comma
  separator is unambiguous; switch to « ; » if the code ever formats them with a decimal comma.
- Other placeholders: French has no ICU plural here unless the code passes `count`. With `{{minutes}}` coming
  from `Math.floor` (0/1 possible), use constructions that work for any number: « Il reste {{minutes}} min… »,
  not « {{minutes}} min restantes ».
- Avoid English sentence mirroring: subordinate instead of stacking clauses, prefer an absolute
  participle construction (« la conservation de la requête par Google étant désactivée ») to a
  calque like « avec X désactivé chez Google ».

## Known pitfalls
- *entrée* (journal entry) vs AI *input*: never translate "input" as *entrée* in AI/legal text.
- « Insights » was removed from both repos (see glossary). Don't reintroduce it.
- « Bon retour », « Supporte », « journaliser », « Seul vous pouvez » (→ « Vous seul pouvez ») are calques.
- fr-CA differences (no space before `?`/`!`, « courriel ») do not apply. Use « e-mail » (house).
- "even if you switch languages along the way" → « même si vous changez de langue en cours de route »
  (both repos); « switcher » is not French.

## Sources
- Apple, Compte Apple (« anciennement identifiant Apple »): https://support.apple.com/fr-fr/apple-account
- Apple, « Comment utiliser le service Se connecter avec Apple »: https://support.apple.com/fr-afri/102379 (also https://support.apple.com/fr-fr/102379)
- GDPR, French text (EUR-Lex): https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679
- CNIL, RGPD chapitre 5 (transferts): https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre5
- Microsoft fr-FR localization style guide: https://download.microsoft.com/download/c/7/9/c7921dbd-4531-4a4e-8490-e4656d739f3d/fra-fra-StyleGuide.pdf
- Microsoft Globalization, punctuation separators: https://learn.microsoft.com/fr-fr/globalization/internationalization/punctuation-separators
- Apple iPhone User Guide FR, Dicter du texte: https://support.apple.com/fr-afri/guide/iphone/dictate-text-iph2c0651d2/13.0/ios
- Gboard « Saisie vocale » / Android « Micro » permission naming (Google help; third-party guides e.g.
  https://www.prodigemobile.com/tutoriel/dicter-texte-android/)
- Non-breaking spaces before French punctuation: https://wiki.openoffice.org/wiki/Non_Breaking_Spaces_Before_Punctuation_In_French_(espaces_insécables)
