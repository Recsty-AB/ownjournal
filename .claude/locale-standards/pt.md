# Locale standard: pt (European Portuguese, pt-PT, app UI + legal)

Scope: the OwnJournal app (`src/i18n/locales/pt.json`) and the website's UI, pricing, FAQ and legal strings (`ownjournal-website/src/i18n/locales/pt.json`). For long-form blog prose, the website repo's `.claude/locale-standards/pt.md` wins (informal *tu*). This file wins for UI, Help, paywall and privacy/legal text in both repos.

## Register and address form (owner decision, applied to both files)
- **Formal third person, with no pronoun.** Use the verb and *o seu / a sua*, and never write *você*: *Toque no microfone*, *Pode optar por…*, *Inicie sessão*, *Já utilizou…*. Microsoft's pt-PT rule: avoid "you", and *você* even more so; rephrase or use the passive.
- When a pronoun is unavoidable, use *si / consigo / lhe*: *Ninguém além de si pode ler o seu diário*, *as chaves estão só na sua posse*, *enviámos-lhe*. Never *o senhor / a senhora*; in UI avoid *o utilizador* for the reader (fine in legal text and neutral descriptions).
- **No *tu* in UI or legal text.** The former *tu* strings (`subscription.renewalApple/Google`, `help.features.moodTracking/activityTagging/moodCalendar/moodStats/activityInsights`) and all website *você* strings are now formal. Blog posts (website `src/data/**`) keep *tu*.
- **Legal text** uses formal third person and impersonal constructions where natural (*Os residentes na UE podem…*, *sob o controlo do utilizador*), as in Google's pt-PT privacy policy.

## Spelling and grammar
- Post-AO1990 pt-PT: *ação, atual, detetar, deteção, receção, ótimo*; keep pronounced consonants: *facto, contacto, secção*. *registar/registo*, never *registrar/registro*.
- Progressive: *estar a + infinitivo* (*A carregar…*, *está a ser sincronizado*); never the bare gerund (*Carregando*, *estão sendo*).
- Possessives take the article: *o seu*, *a sua*, *do seu*, *na sua* (a bare *Seu/Sua* at sentence start is pt-BR).
- Enclisis in affirmative main clauses (*Permita-o*, *contacte-nos*, *Registe-se*); proclisis after *não, que, se, já, só*.
- *precisar de* + infinitive/noun; *ter a certeza*; *num/numa* (not *em um*); *aceder a* (not *acessar*); *porque é que* (not *por que*).
- *Company country*: `{{companyCountry}}` is "Suécia" (feminine): write *registada na {{companyCountry}}*, *leis da {{companyCountry}}*, *Na {{companyCountry}}*.

## Glossary (one term per concept, both repos)
| English | Use | Avoid / note |
|---|---|---|
| Voice entry (feature) | **Ditado por voz** (masc.) | Introdução/Entrada por voz |
| Dictate / Stop / Transcribing… | Ditar / Parar / A transcrever… | Transcrevendo… |
| Stops in N s / N min left | *Termina em {{seconds}} s* / *Tempo restante este mês: {{minutes}} min* | *Para dentro de…*, *Restam…* |
| entry / tag / tags | entrada / tag / tags (also activity tagging: *tags de atividade*) | etiqueta(s), etiquetagem |
| mood | humor (*análise do humor*, *registo do humor*) | estado de espírito in feature names, rastreamento |
| insights | conclusões (*Principais conclusões*); feature "Activity Insights" = *Análise de atividades* | insights |
| features | funcionalidades (*Funcionalidade Plus*) | recursos |
| settings | Definições (capitalised as screen name) | configurações |
| subscription / subscriber | subscrição / subscritor | assinatura / assinante |
| upgrade | *Atualizar para o Plus* | Fazer upgrade |
| free trial | avaliação gratuita | teste grátis |
| checkout | pagamento | checkout |
| delete / reset (all data) | eliminar / *Eliminar todos os dados*; reset a setting/password = *repor* | excluir, deletar, redefinir |
| password / reset password | palavra-passe / *Repor palavra-passe* | senha |
| sign in / sign out / sign up | iniciar sessão / terminar sessão / registar-se | entrar, login, cadastrar |
| connect / disconnect / reconnect | ligar / desligar / voltar a ligar; *ligação* | conectar, conexão |
| cloud / cloud storage | nuvem / armazenamento em nuvem | cloud |
| backup | cópia de segurança | backup |
| browser / tab / dropdown | browser / separador / menu pendente | navegador / aba / dropdown |
| provider (storage) | fornecedor; *prestador de serviços* (payment, AI) in legal and FAQ | provedor, processador |
| file / screen / camera / user | ficheiro / ecrã (masc.) / câmara / utilizador | arquivo / tela / câmera / usuário |
| app (the product) | aplicação | aplicativo, app |
| download / upload (noun) | descarregar, transferência / envio | download, upload |
| logs | registos | logs |
| status | estado | status |
| self-hosted | auto-alojado, alojamento | auto-hospedado |
| encryption / E2E | encriptação / encriptação ponta a ponta | criptografia, de ponta a ponta |
| zero knowledge | conhecimento zero (*arquitetura de conhecimento zero*) | Zero-Conhecimento |
| display name | nome de exibição | — |
| fair use | utilização razoável | uso justo |
| OwnJournal / Google | *o OwnJournal* (masc.) / *a Google* (fem.) | — |
| Plus plan / Free plan | *o Plus* / *plano Grátis* (website) | — |

## GDPR / legal vocabulary (official pt RGPD, EUR-Lex / EDPB pt)
- RGPD (not GDPR); *artigo 46.º*; EEE; *em conformidade com o RGPD*.
- *tratamento / tratar*; *responsável pelo tratamento*; *subcontratante*; *encarregado da proteção de dados (EPD)*; *autoridade de controlo*.
- Rights: *acesso, retificação, apagamento, limitação do tratamento, portabilidade, oposição*, *apresentar reclamação*.
- *Fundamento jurídico do tratamento*: *execução de um contrato*, *interesses legítimos*, *consentimento*, *retirar o consentimento*.
- *decisão de adequação*, *garantias adequadas*, *cláusulas contratuais-tipo (CCT)* (lowercase), *medidas técnicas e organizativas*.
- *conservar / Conservação dos dados* (not *retenção*); *prestador de serviços de pagamento*; auth backend = *infraestrutura de autenticação (e de base de dados)*.
- Section titles are identical in both repos where the section exists (e.g. *Funcionalidades de IA e tratamento*, *Conservação dos dados*, *Encriptação ponta a ponta*). Website `legal.privacy.aiProcessing.content` = app text, verbatim.
- Never add facts. Voice invariants: 5 min/recording; 200 min/month; Plus only; audio sent to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted; paid tier does not train; Google may keep data briefly for abuse monitoring.
- Keep legal *salvo* (= except) and *excluir/excluída* (= exclude) – they are not BR *salvar/excluir*.

## Typography
- Sentence case for every title, button and label (*Exportar dados*, *Sugestões de título com IA*). Capitalise only proper nouns, product/mode names (*modo Simples*, *Plus*), screen names (*Definições*, *Zona de perigo*) and document titles (*Termos de Serviço*, *Política de Privacidade*).
- Dates: month lowercase, *abril de 2026*, *novembro de 2026*, same style for terms and privacy in both repos. Label: *Última atualização: {{date}}* (app `legal.lastUpdatedOn`; website `legal.lastUpdated` = *Última atualização*).
- Ellipsis `…` (one character, no space before). Straight double quotes `"…"` for UI labels and quoted buttons (no single quotes, except code like `'always'`).
- Dash: spaced en dash ` – ` for parentheticals and label separators in both UI and legal (*Ditado por voz – 200 minutos por mês*). Keep hyphens in code/markdown (`- listas`, `sudo …`).
- No serial comma before *e*; lowercase after a colon.
- Units and numbers: *5 MB*, *10 s*, *há {{minutes}} min*, *100 000*; currency on the website *US$ 19,99* / *US$ 0* (never R$).
- Abbreviation "e.g." = *p. ex.,*.

## UI microcopy
- Buttons: infinitive (*Continuar*, *Ditar*, *Agora não*, *Seguinte*, *Ignorar*).
- Errors: problem first, then formal imperative (*Permita-o nas definições…*, *Tente novamente.*). Failure titles: *A ligação falhou*, *Não foi possível eliminar*, *Falha ao guardar a entrada*.
- *Demasiado* (not *Muito*) for "too long/short/fast"; *Demasiados pedidos*.

## Known pitfalls
- pt-BR quick test: *você*, bare *Seu/Sua*, gerund progressives, *configurações, assinatura, senha, provedor, aplicativo, conectar, salvar, excluir, deletar, acessar, digite, habilitar, cadastro, navegador, aba, tela, arquivo, usuário, câmera, time, jornada, Ruim, Pular, Próximo*.
- The whole app and website UI/legal files were converted to pt-PT in Nov 2026; any new BR form is a regression.

## Sources
- Microsoft pt-PT Style Guide: https://download.microsoft.com/download/9/9/5/995a8ca6-383c-439d-9db0-cd457c9c2724/por-prt-StyleGuide.pdf
- Google Privacy Policy pt-PT: https://policies.google.com/privacy?hl=pt-PT
- Apple Support pt-PT, "Melhorar Siri e Ditado": https://support.apple.com/pt-pt/127070
- RGPD pt: https://gdpr-text.com/pt/read/article-46 , https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=pt
- Website long-form standard: `ownjournal-website/.claude/locale-standards/pt.md`
