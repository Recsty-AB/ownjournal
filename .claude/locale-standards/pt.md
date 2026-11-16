# Locale standard: pt (European Portuguese, pt-PT, app UI + legal)

Scope: the OwnJournal app (`src/i18n/locales/pt.json`) and the website's UI, pricing, FAQ and legal strings (`ownjournal-website/src/i18n/locales/pt.json`). For long-form blog prose, the website repo's `.claude/locale-standards/pt.md` wins (informal *tu*). This file wins for UI, Help, paywall and privacy/legal text.

## Register and address form
- **Formal third person, with no pronoun.** Use the verb and *o seu / a sua*, and never write *você*: *Toque no microfone*, *Pode optar por…*, *Inicie sessão*, *Já utilizou…*. This is the app's house style (about 156 formal imperatives against 4 *tu* imperatives) and Microsoft's pt-PT rule: "you" should be avoided, and *você* even more so. Rephrase the sentence or use the passive voice instead.
- **Legal text** also uses formal third person and impersonal constructions where they read naturally (*Os residentes na UE podem…*, *sob o controlo do utilizador*). Portuguese privacy policies, Google's pt-PT one included ("ajudá-lo", "as suas informações", "pode"), never use *tu*.
- **Known conflict:** the website blog standard prescribes *tu*. The app has a few *tu* strings (`subscription.renewalApple/Google`, `help.features.moodTracking/activityTagging/moodCalendar/moodStats/activityInsights`). The owner must decide whether UI moves to *tu*. Until then, new UI strings follow the dominant formal style, and the file must not be mixed further.
- **Spelling is post-AO1990 pt-PT.** Use *ação, atual, detetar, receção, ótimo*, but keep the forms where the consonant is pronounced: *facto, contacto, secção*. Write *registar/registo*, not *registrar/registro*.

## Glossary (house style + platform terms)
| English | Use | Avoid / note |
|---|---|---|
| Voice entry (feature) | **Ditado por voz** (masc.: *o ditado por voz*) | *Introdução por voz* reads as "voice introduction"; *Entrada por voz* clashes with *entrada* = journal entry. Apple pt-PT calls it *Ditado* |
| Dictate (button) | Ditar | — |
| Stop / Cancel / Discard recording | Parar / Cancelar gravação / Descartar gravação | — |
| Stops in N s | *Termina em {{seconds}} s* | *Para dentro de…*: post-AO *para* (verb) is a homograph of the preposition *para* |
| N min left | *Tempo restante este mês: {{minutes}} min* | *Restam {{minutes}} min* breaks at 1 (no plural forms in code) |
| Transcribing… | A transcrever… | *Transcrevendo…* (pt-BR gerund) |
| entry | entrada | — |
| user | utilizador | usuário |
| settings | definições | configurações (pt-BR leak, still common in the app) |
| file / screen | ficheiro / ecrã | arquivo / tela |
| delete | eliminar | excluir, deletar |
| app (the product) | aplicação | aplicativo |
| subscription / subscriber | subscrição / subscritor | assinatura / assinante |
| provider (cloud, AI) | fornecedor; *prestador de serviços* in legal text | provedor |
| payment processor | prestador de serviços de pagamento | processador de pagamentos |
| password | palavra-passe | senha |
| e-mail | e-mail (hyphenated) | email |
| sign in | iniciar sessão | fazer login, logar |
| offline | *Está offline* (house style) / *sem ligação* | desconectado |
| internet connection | ligação à Internet | conexão |
| encryption / E2E | encriptação / de ponta a ponta (house; Apple/WhatsApp pt-PT also say *ponto a ponto*) | criptografia (pt-BR) |
| cloud | cloud (app house) / nuvem (website house); both are valid pt-PT | — |
| features (product) | funcionalidades | recursos (pt-BR) |
| AI | IA | AI |
| tags | tags (app house); *etiquetas* on the website | — |
| filler words | bordões de linguagem | palavras de enchimento |
| display name | nome de exibição (house, legal); Microsoft pt-PT says *nome a apresentar* | — |
| OwnJournal | masculine: *o OwnJournal* | *a OwnJournal* |
| Google (company) | feminine: *a Google* | — |
| paid tier (Gemini API) | nível pago | plano pago |
| prompts and outputs | pedidos e respostas | entradas e saídas (ambiguous with journal entries) |
| fair-use rate limiting | aplicar os limites de utilização razoável | *limitar a utilização razoável* (inverts the meaning) |

## GDPR / legal vocabulary (official pt RGPD, EUR-Lex / EDPB pt)
- Use RGPD, not GDPR, and write *artigo 46.º* with the ordinal sign. EEE = Espaço Económico Europeu.
- *tratamento / tratar* (data processing). Avoid *processamento*, except in fixed product contexts.
- *responsável pelo tratamento*, *subcontratante*, *titular dos dados*, *encarregado da proteção de dados (EPD)*, *autoridade de controlo* (in Portugal, the CNPD).
- Rights: *acesso, retificação, apagamento, limitação do tratamento, portabilidade, oposição*, *apresentar reclamação*.
- Legal bases: *execução de um contrato*, *interesses legítimos*, *consentimento*, *retirar o consentimento*. The heading is *Fundamento jurídico do tratamento*.
- Transfers: *decisão de adequação*, *garantias adequadas*, *cláusulas contratuais-tipo (CCT)*, *medidas técnicas e organizativas* (not *organizacionais*).
- Retention: *conservar / prazo de conservação*. Avoid *reter* and *retenção*.
- Never add facts, for example naming the CNPD where English does not. The voice-feature invariants are: 5 min per recording; 200 min/month; Plus only; audio is sent to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted; the paid tier does not train on the data; Google may keep data for a limited period for abuse monitoring.

## Typography
- Months are lowercase, as in *novembro de 2026*. The terms pages (*Abril 2026*, *Dezembro 2024*) are known deviations.
- Use the ellipsis character `…` with no space before it. Quotes are straight double `"…"` (Microsoft pt-PT); « » is acceptable but is not house style.
- Dashes: in UI lists, keep the em dash `—` where it is already used (*Análise de Atividades — correlações de humor*, 17 em dashes in the app). In rewritten legal prose, use a spaced en dash ` – `, as the website standard says.
- Use no serial comma before *e*. Use lowercase after a colon (Microsoft pt-PT).
- Unit symbols: *5 min*, *10 s*, with no plural *s*. Currency format is *19,99 $* or *US$ 19,99* (website house style is mixed).

## UI microcopy
- Buttons use the infinitive: *Continuar*, *Ditar*, *Agora não*.
- Errors state the problem first, then the action in the formal imperative: *Permita-o nas definições…*, *Tente novamente.*
- *não é suportado* is acceptable in pt-PT; *não é compatível* is the alternative.
- Use the European progressive *estar a + infinitivo* and enclitic pronouns (*Permita-o*, *contacte-nos*). Pronouns go before the verb after *não, que, se, já*.
- Avoid relative clauses in the middle of an enumeration. Use parentheses instead: *ditado por voz (que converte a fala em texto)*.
- Feature lists in `subscription.features` are Title Case (house style). Help titles and the website use sentence case.

## Known pitfalls: pt-BR drift (both files)
- The app has about 86 strings with *você* and BR vocabulary (*assinatura*, *configurações*, *excluir*, *detecção*, *contato*, *salvar*, *registrar*, *Conecte-se*) mixed into a mostly pt-PT file.
- On the website, about 75 of the 379 strings outside legal.privacy have BR markers: *criptografia*, *você*, *senha*, *provedor*, *aplicativo*, *Tudo que*, *acessar*, *contato*, and a possessive with no article (*Sua privacidade*).
- Quick test: a bare *seu/sua* at sentence start, *de fato*, *equipe*, *tela*, *arquivo* or *usuário* means a pt-BR leak.

## Sources
- Microsoft pt-PT Style Guide (pronouns §4.1.12, punctuation): https://download.microsoft.com/download/9/9/5/995a8ca6-383c-439d-9db0-cd457c9c2724/por-prt-StyleGuide.pdf
- Google Privacy Policy pt-PT (register and legal vocabulary): https://policies.google.com/privacy?hl=pt-PT
- Apple Support pt-PT, "Melhorar Siri e Ditado": https://support.apple.com/pt-pt/127070
- RGPD art. 46 pt and EDPB pt documents on SCCs: https://gdpr-text.com/pt/read/article-46 , https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=pt , https://www.edpb.europa.eu/system/files/documents/2021-05/edpb_edps_jointopinion_202102_art46sccs_pt.pdf
- Website long-form standard: `ownjournal-website/.claude/locale-standards/pt.md`
