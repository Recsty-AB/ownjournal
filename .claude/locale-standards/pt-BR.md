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

## House style (established in the app file)
- Journal entry (app) = **entrada**; website uses **registro** for entries. Keep each repo
  consistent with itself.
- Plus is a proper name, used with article: "o Plus", "no Plus", "assinatura Plus".
- AI = **IA**. "Recursos de IA", "análise com IA".
- Sign in = **Faça login** (error/CTA) / "Entrar" (button).
- Activity Insights = "Análise de atividades" (app feature title); website uses "Insights de Atividades".
- Simple / E2E mode names stay in English ("modo Simple", "E2E").
- Titles: older keys use Title Case, newer ones sentence case. Prefer sentence case for
  new keys (Portuguese norm); do not mass-convert existing titles.

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
- Units: number + space + symbol: "10 s", "200 min". Month: "min/mês".
- Count placeholders without plural variants must be number-agnostic: avoid
  "Restam {{n}} min" (wrong with 1); use a label form ("Tempo restante no mês: {{n}} min").
- Avoid "Para em…" for "Stops in…": since the 1990 Agreement "para" (verb) and "para"
  (preposition) are homographs; use "Encerra em…".
- Ellipsis character `…`; em dash `—` with spaces; straight double quotes; no Oxford comma.
- Months are lowercase with "de": "novembro de 2026" (VOLP/Acordo Ortográfico 1990).

## Legal / privacy conventions
- Data subject = titular; processing = tratamento (LGPD) or processamento (in this
  product's existing text "processamento" is house style for AI processing; keep).
- Personal data = dados pessoais; controller = controlador; processor = operador (LGPD).
- GDPR: existing text says "GDPR"; the EU's official Portuguese is "RGPD". Brazilian
  readers know both — do not change piecemeal (owner decision).
- Standard Contractual Clauses = "Cláusulas Contratuais Padrão (SCCs)" (house style);
  ANPD's own instrument is "cláusulas-padrão contratuais" (Resolução CD/ANPD nº 19/2024).
- EEA = EEE (Espaço Econômico Europeu); adequacy decision = decisão de adequação.
- Prompts/outputs (AI) = solicitações e respostas. Do not translate "AI inputs" as
  "entradas de IA" in this app — "entrada" is the journal entry; use "dados enviados à IA".
- "Rate limiting for fair use" = "aplicar os limites de uso justo" (never "limitar o uso justo").
- Paid tier = plano pago (not "nível pago").
- Use "apenas/somente" rather than colloquial "só" in legal text.
- Keep singular/plural parity with English for providers ("o provedor de IA (Google)").

## Sources
- Microsoft Portuguese (Brazil) Style Guide: https://learn.microsoft.com/globalization/reference/microsoft-style-guides (pt-BR PDF)
- Apple Suporte (BR), "Dite um texto no iPhone" / Ditado: https://support.apple.com/pt-br/guide/iphone/
- Resolução CD/ANPD nº 19/2024 (transferência internacional, cláusulas-padrão contratuais): https://www.gov.br/anpd/pt-br
- LGPD, Lei nº 13.709/2018: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- RGPD in Portuguese (EUR-Lex): https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:32016R0679
- Academia Brasileira de Letras, VOLP / Acordo Ortográfico 1990: https://www.academia.org.br/nossa-lingua/busca-no-vocabulario
