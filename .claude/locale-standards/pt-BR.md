# pt-BR (Brazilian Portuguese) — UI, Help and legal standard for OwnJournal

Scope: app UI strings, Help, paywall/Plus texts and privacy/legal text in
`src/i18n/locales/pt-BR.json` (app) and the website's `pt-BR.json`. For blog/long-form
voice see the website repo's `.claude/locale-standards/pt-BR.md` (brand voice, calques).

## Register and address
- Always **você** (3rd-person verb forms), never "tu" or "o senhor". Possessives without
  article in UI ("sua entrada", "seu dispositivo"); "o seu" is also fine in running text.
- Imperatives in the você form: "Toque", "Fale", "Tente novamente", "Faça login".
- Proclisis in neutral text ("se você trocar", "não o usa"); avoid pt-PT enclisis drift
  in casual microcopy ("Ajuda-te", "diga-me").
- Progressive = gerund ("Transcrevendo…", "você está gravando"). Never "estar a + infinitivo".

## pt-BR vs pt-PT pitfalls (reject in review)
| Concept | pt-BR (use) | pt-PT (avoid) |
|---|---|---|
| file | arquivo | ficheiro |
| screen | tela | ecrã |
| user | usuário | utilizador |
| to register / record (verb) | registrar | registar |
| record (noun) | registro | registo |
| settings | configurações | definições |
| to sign in | fazer login / entrar | iniciar sessão |
| team | equipe | equipa |
| fact / contact | fato / contato | facto / contacto |
| cell phone | celular | telemóvel |
| progressive | está gravando | está a gravar |

## House style (both repos; owner decision 2026-11: one term per concept, app wins)
- Journal entry = **entrada** in the app AND the website UI/legal (website "registro" for
  entries was replaced; blog content is out of scope). "registro" stays only for "record/log"
  ("registro do provedor", "registro de transações").
- Plus is a proper name, used with article: "o Plus", "no Plus", "Fazer upgrade para o Plus".
- Free plan = **plano Gratuito** (card/column label "Gratuito"); "Grátis" only as a badge or
  adverb ("Começar grátis", "Grátis para sempre").
- AI = **IA**. "Recursos de IA", "análise com IA", "processamento por IA".
- Activity Insights = **análise de atividades** (title "Análise de atividades"), never
  "Insights de Atividades". Mood tracking = **acompanhamento de humor**; activity tagging =
  **marcação de atividades** ("tags" stays "tags", so no "etiquetas").
- Simple / E2E modes = **modo Simples** / **modo E2E** (never "modo Simple", "Modo
  Criptografado E2E"). Zero-knowledge = **conhecimento zero** ("arquitetura de conhecimento zero").
- End-to-end = **de ponta a ponta** ("criptografia de ponta a ponta", "criptografados de ponta a ponta").
- Demo = **demonstração** ("Ver demonstração", "Modo de demonstração"); never "o demo".
- Sign in = **Faça login** (error/CTA) / "Entrar" (button). Settings screen = "Configurações"
  (capitalized as a screen name; tab names too: "aba Armazenamento", "Configurações → Armazenamento").
- **Sentence case everywhere** (titles, buttons, tabs, legal headings): "Exportar dados",
  "Zona de perigo", "Informações que coletamos". Capitalize only proper names, the screen
  "Configurações", tab/section names in running text, document names ("Política de Privacidade",
  "Termos de Serviço"). Quoted UI labels keep the label's own casing ("Ajuda de configuração").
- Other UI terms: dropdown = menu suspenso; popup = pop-up; wildcard = curinga; container =
  contêiner; Apple Developer account = conta Apple Developer; snapshot = panorama (not "instantâneo");
  multiple = vários/várias (not "múltiplos"); supports = é compatível com / aceita (not "suporta").
- Avoid "Por favor" in UI (Microsoft pt-BR guide); plain imperative: "Tente novamente".
- Plurals (i18next 25, CLDR): every key that has `_one/_other` in en.json must have exactly
  `_one`, `_many`, `_other` here, no base key. CLDR pt maps **0 and 1** (and 1.5) to `one`, so
  `_one` is singular ("{{count}} entrada sincronizada"; "0 entrada" is accepted, cf. "zero
  quilômetro"); `many` (1000000, 2000000) = same text as `_other` (digits, no "de"). No "(s)".
  Agree verbs/participles too ("{{count}} das últimas 10 operações falhou/falharam").
  Other number placeholders without plural keys stay number-agnostic ("Dias restantes no seu
  teste gratuito: {{days}}", "Arquivos transferidos antes do cancelamento: {{transferred}}").
- Activity names are feminine/masculine at random, so avoid adjectives that agree with
  {{activity}} ("{{activity}} se associa a…"). `{{provider}}` values (Google Drive, Dropbox,
  Nextcloud, iCloud) are all masculine: "Conectado ao {{provider}}"; "com {{provider}}" without article.
- Tap vs. click (house rule, mirrors English): in-app controls → "Toque em…/Toque no…/Tente
  tocar no…"; "Clique/clicar" only where English keeps "click" (Nextcloud web UI, browser
  address bar, e-mail links, Apple web sign-in popup, the billing-portal FAQ: clique em
  "Gerenciar"). Lowercase after a colon ("Para criar um backup: toque no…", "Google: toque em…").
  Menu paths use `→` ("Ajustes → seu nome → iCloud", "Aplicativos → Segurança"), never `>`.
- Quoted UI labels must match this file's actual label: "Redefinir todos os dados"
  (`storage.resetAllData`) in the "Zona de perigo" (`storage.dangerZone`).
- Missing articles before subjects are calques: "A transferência foi cancelada", "A
  autorização foi cancelada", "As credenciais são criptografadas localmente".

## Voice/dictation glossary
| English | pt-BR | Notes |
|---|---|---|
| Voice entry (feature) | Entrada por voz | product feature name |
| Dictate (button) | Ditar | Apple calls the iOS feature "Ditado" |
| Dictation | ditado | |
| Microphone | microfone | |
| Recording | gravação | "gravar" for the verb |
| Transcribe / transcription | transcrever / transcrição | |
| Transcript | transcrição | |
| Filler words | vícios de linguagem / palavras de preenchimento | |
| Speech | fala | |
| Clean, punctuated text | texto limpo e pontuado | |
| (not) supported | (não) é compatível | avoid "suportado" (calque) |
| Allow (permission) | permitir o acesso | always give the object |
| Offline | offline | naturalized |

## Microcopy conventions
- Buttons: infinitive ("Ditar", "Parar", "Continuar", "Cancelar gravação"); "Agora não" for decline.
- Errors: plain statement + action ("A transcrição falhou. Tente novamente.").
- Units: number + space + symbol: "10 s", "200 min", "5 MB", "{{ms}} ms"; ranges with "a":
  "24 a 48 horas". Money in fixed text: "US$ 99"; website prices are
  never hard-coded: use `{{price}}`/`{{monthly}}` (code formats the visitor's currency). "100+" = "mais de 100". Example = "ex.:".
- Relative time: "há {{minutes}} min", "há {{hours}} h", "há {{days}} d"; justNow = "agora"
  (reads "Sincronizado há 5 min" / "Sincronizado agora").
- Count placeholders without plural variants must be number-agnostic: avoid
  "Restam {{n}} min" (wrong with 1); use a label form ("Tempo restante no mês: {{n}} min").
- Avoid "Para em…" for "Stops in…": since the 1990 Agreement "para" (verb) and "para"
  (preposition) are homographs; use "Encerra em…".
- Ellipsis character `…` (never "..."); em dash `—` with spaces, lowercase after it unless a
  proper name; hyphen only inside words and in Markdown syntax ("- listas"). Straight double
  quotes "…" for UI labels and quotations (no single quotes); no Oxford comma. "e-mail" with
  hyphen (not in addresses such as seu@email.com).
- Months are lowercase with "de": "novembro de 2026" (VOLP/Acordo Ortográfico 1990). Same
  style for privacy and terms dates in both repos ("abril de 2026", "dezembro de 2024").
- Last-updated label: app `legal.lastUpdatedOn` = "Última atualização: {{date}}" (sentence case).
- `auth.termsAgreement` is one `<Trans>` sentence: "Ao continuar, você concorda com nossos
  <terms>Termos de Serviço</terms> e nossa <privacy>Política de Privacidade</privacy>." —
  possessive agrees with each noun (nossos/nossa), final period, exactly one tag pair each.
- Chart tooltip `moodCorrelations.tooltipDetail_*`: "{{delta}} (média: {{emoji}} {{avg}},
  {{count}} entrada/entradas)" — ASCII parentheses/colon/comma; `_one`/`_many`/`_other`.
- Apple names (Apple pt-BR, since 2024): **Conta Apple** (capital C, feminine: "na sua Conta
  Apple", "esta Conta Apple", "cobrado na sua Conta Apple"); never "Apple ID"/"ID Apple".
  "Sign in with Apple" button = **Iniciar sessão com a Apple** (Apple's official feature name;
  the only allowed "iniciar sessão" — generic sign-in stays "Entrar"/"fazer login").
  "Continue with Apple" = "Continuar com Apple". Generic "conta Apple Developer" stays lowercase.

## Legal / privacy conventions
- Brazilian readers, EU controller: use LGPD/RGPD Portuguese vocabulary consistently in the
  whole policy, both repos. Abbreviation **RGPD** (never "GDPR"), incl. badges "Conforme o RGPD"
  / "Conforme a CCPA".
- processing (legal sense) = **tratamento** ("Base legal para o tratamento", "limitação do
  tratamento", "opor-se ao tratamento", "atividades de tratamento"; verb "tratar").
  "processamento por IA" is kept only for the technical AI computation (house style).
- controller = **controlador** ("Controlador dos dados"); processor (GDPR role) = operador;
  payment processor (commercial) = processador de pagamentos; DPO = "encarregado de proteção de
  dados (DPO)"; erasure = eliminação; supervisory authority = autoridade de controle; data
  subject = titular; personal data = dados pessoais. "nos termos do artigo 37 do RGPD".
- `{{companyCountry}}` is "Suécia" in this locale, so write "na {{companyCountry}}", "leis da
  {{companyCountry}}" (never "em/de {{companyCountry}}").
- Standard Contractual Clauses = "Cláusulas Contratuais Padrão (SCCs)" (house style);
  ANPD's own instrument is "cláusulas-padrão contratuais" (Resolução CD/ANPD nº 19/2024).
- EEA = EEE (Espaço Econômico Europeu); adequacy decision = decisão de adequação.
- Prompts/outputs (AI) = solicitações e respostas; "AI inputs" = "dados enviados à IA"
  ("entrada" is the journal entry). Avoid ambiguous "seus/suas" for Google's things: "os
  modelos do Google", "conforme as próprias políticas vigentes", "a API paga desse provedor".
- The legal texts live only in the app (website `legal` block removed). AI text and
  recordings pass "por meio dos nossos servidores", "apenas em trânsito", and "não é retido".
- Stripe is feminine, as Stripe Brasil writes it: "pela Stripe", "a Stripe, nossa processadora
  de pagamentos"; generic term stays "processador de pagamentos (Stripe)".
- Refund/withdrawal (EU consumer right) = "direito de arrependimento" (website FAQ mirrors the Terms).
- "Rate limiting for fair use" = "aplicar os limites de uso justo".
- Paid tier = plano pago (not "nível pago"); free trial = período de teste gratuito (not
  "avaliação"); current period = período atual (not "em curso").
- Liability terms: willful misconduct = conduta dolosa; personal injury = lesões corporais;
  consequential = consequenciais; disputes = litígios; mandatory rights = direitos imperativos.
- Contact section title = "Fale conosco" (cross-references use the same words). Contact by
  mail = "entre em contato conosco pelo e-mail support@…"; avoid "através de".
- Use "apenas/somente" rather than colloquial "só" in legal text; "Isso" not "Isto".
- Keep singular/plural parity with English for providers ("o provedor de IA (Google)").

## Sources
- Microsoft Portuguese (Brazil) Style Guide: https://learn.microsoft.com/globalization/reference/microsoft-style-guides (pt-BR PDF)
- Apple Suporte (BR), "Dite um texto no iPhone" / Ditado: https://support.apple.com/pt-br/guide/iphone/
- Resolução CD/ANPD nº 19/2024 (transferência internacional, cláusulas-padrão contratuais): https://www.gov.br/anpd/pt-br
- LGPD, Lei nº 13.709/2018: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- RGPD in Portuguese (EUR-Lex): https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:32016R0679
- Academia Brasileira de Letras, VOLP / Acordo Ortográfico 1990: https://www.academia.org.br/nossa-lingua/busca-no-vocabulario
- Apple Suporte (BR), "Conta Apple, anteriormente ID Apple": https://support.apple.com/pt-br/apple-account
- Apple Developer (BR), "Sobre o recurso Iniciar sessão com a Apple": https://developer.apple.com/br/help/account/capabilities/about-sign-in-with-apple/

## Dreams glossary (2026-11)
| English | pt-BR | Avoid / note |
|---|---|---|
| dream journal | diário de sonhos | attested (Personare) |
| nightmare / lucid dream / recurring | pesadelo / sonho lúcido / recorrente | attested (Personare, Correio Braziliense) |
| awe (feeling chip) | Deslumbramento | "Encanto" (too weak), "Assombro" (evokes assombração); UFRJ, Psic.: Teoria e Pesquisa |
| Dream reflection (feature) | reflexão de sonhos (lowercase in prose, like "entrada por voz") | judgment |
| Dream patterns (card/report) | "Padrões dos sonhos", quoted in prose: relatório "Padrões dos sonhos" | judgment (unquoted lowercase reads as generic) |
| reflected dreams (count) | reflexões ("Reflexões feitas", "novas reflexões") | "sonho refletido" (= mirrored) |
| Clara Hill's model | o modelo de Clara Hill para o trabalho com sonhos | "trabalho com sonhos de Clara Hill" (garden path) |
| crisis line | linha de apoio emocional | CVV wording "apoio emocional" (cvv.org.br) |
| mark an entry as a dream | marcar como sonho | "guardar como sonho" |
