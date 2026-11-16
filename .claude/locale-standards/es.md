# Locale standard — es (Spanish, app UI + legal)

Scope: OwnJournal app (`src/i18n/locales/es.json`) and website (`ownjournal-website/src/i18n/locales/es.json`) UI, Help, paywall and privacy/legal strings. For long-form blog voice see the website repo's `.claude/locale-standards/es.md` (that one wins for blog prose; this one wins for UI and legal).

## Register and variety
- **tú**, always (house style in both files, and the norm for consumer wellness apps). Never *usted*, never *vosotros* in UI (address one user).
- Neutral Spanish leaning to Iberian standard, matching the house style: *Ajustes* for device/OS settings (iOS and Android in Spain), *Configuración* is also used in-app for app settings (house style, both accepted). Avoid strong Latin American regionalisms in new text (*monitoreo* → *supervisión*, *retener datos* → *conservar datos*).
- Preterite for one-off error states is house style: *No se encontró…*, *No se pudo…*, *No se detectó…* (keep; do not convert to perfect tense piecemeal).

## Glossary (house style + platform terms)
| English | Use | Avoid / note |
|---|---|---|
| entry (journal) | entrada | — reserved for journal entries; do not reuse "entrada" for other concepts |
| Voice entry (feature) | **Dictado por voz** | *Entrada por voz* (clashes with "entrada" = journal entry; reads as "a voice journal entry"). Matches website and Apple's *Dictado* |
| Dictate (button) | Dictar | — |
| Stop / Cancel recording / Discard recording | Detener / Cancelar grabación / Descartar grabación | Parar (too colloquial for a button) |
| Transcribing… | Transcribiendo… | — use the real ellipsis `…` |
| Retry | Reintentar | Volver a intentar (fine in sentences: *Inténtalo de nuevo*) |
| microphone | micrófono | mic |
| recording | grabación | audio (only for the raw audio: *el audio*) |
| transcript | transcripción | — |
| AI | IA | AI |
| Plus / subscription | Plus (invariable) / suscripción | — |
| PDF & Word export | Exportación a PDF y Word | *Exportación PDF* (missing preposition) |
| Activity Insights | Análisis de actividades | — capitalised when used as the feature name in Help |
| prompts and outputs (legal) | solicitudes y respuestas | *prompts y salidas*, *entradas y salidas* (ambiguous with journal entries) |
| AI inputs | datos enviados a la IA | *entradas de IA* |
| paid tier (Google API) | nivel de pago | *plan de pago* (= instalment plan in legal Spanish) |
| fair use / rate limiting | uso justo / aplicar los límites de uso justo | *limitar el uso razonable* (inverts the meaning) |
| offline | sin conexión / *No tienes conexión* | desconectado |
| sign in | iniciar sesión | loguearse |

## GDPR / legal vocabulary (official Spanish RGPD text)
- RGPD (not GDPR); EEE (Espacio Económico Europeo); *decisión de adecuación*.
- *garantías adecuadas* (art. 46) — not *salvaguardas apropiadas*.
- *Cláusulas Contractuales Tipo (CCT)* — the AEPD term; not *Cláusulas Contractuales Estándar*. (RGPD art. 46.2.c literally says *cláusulas tipo de protección de datos*.)
- *responsable del tratamiento*, *encargado del tratamiento*, *tratamiento de datos*, *conservar* (retain), *plazo/periodo de conservación*.
- *expresamente* for "explicitly" in legal text (house style; *explícitamente* acceptable on the website where it already appears).
- Never add or soften facts. Voice-feature invariants: 5 min per recording; 200 min/month; Plus only; audio goes to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted; paid tier does not train on data; Google may retain data for a limited time for abuse monitoring.

## Typography and orthography (RAE / Fundéu)
- Months are lowercase: *noviembre de 2026* (also after "Última actualización:"). Pre-existing capitalised dates (*Abril 2026*, *Diciembre 2024*) in untouched keys are known deviations.
- Opening `¿` and `¡` are mandatory.
- Ellipsis `…` (U+2026), no space before it.
- Quotes: straight double `" "` (house rule; no « »).
- Unit symbols: *5 min*, *10 s* with a space; no plural *s* on symbols (*min*, not *mins*).
- Dashes: em dash `—` spaced is already used in website feature lists (*Análisis de actividades — correlaciones de ánimo*); keep consistent within a list. In running prose prefer commas, colons or parentheses.
- No serial comma before *y*.
- *Internet* capitalised is house majority (RAE accepts both).

## UI microcopy conventions
- Buttons: infinitive (*Continuar*, *Dictar*, *Descartar grabación*), short; *Ahora no* for "Not now".
- Errors: state the problem, then the action in imperative tú (*Permítelo en los ajustes…*, *Inténtalo de nuevo.*). Avoid *Por favor* in short errors when it adds length (house style uses it elsewhere; not wrong).
- Placeholders without i18next plural forms must read correctly for 1 and 0: avoid verbs that agree with the number (*Quedan {{minutes}} min* breaks at 1). Use a label pattern: *Tiempo restante este mes: {{minutes}} min*.
- "Not supported" → *no es compatible con…* (Microsoft/Apple convention).
- Do not chain *y … y …* in one clause; Spanish prefers a relative clause or comma: *…en un texto limpio y bien puntuado, que se inserta donde tengas el cursor*.
- Avoid mid-list relative clauses with commas (*el dictado por voz, que convierte…, el análisis…*) — the enumeration becomes unreadable; use *para* + infinitive or parentheses.

## Known pitfalls
- Portuguese bleed (*ativar*, *atividade*) — see website standard.
- *consistencia* ≠ *constancia*; *realizar* creep; *insights* anglicism (pre-existing in some keys; prefer *análisis*/*información*).
- *Cuando te detengas, … se convierten* mixes subjunctive with habitual present; use *Al detener la grabación, …*.
- Keep the app and website feature names identical (*Dictado por voz*).

## Sources
- Microsoft Spanish (Spain) Style Guide: https://download.microsoft.com/download/9/a/1/9a19beca-597c-417b-a2c2-0f1ea5a1e6c3/spa-esp-StyleGuide.pdf
- Microsoft Spanish (Neutral) Style Guide: https://download.microsoft.com/download/4/3/1/431d9836-40dc-4f2b-aafc-def5c7b5d0f3/spa-neu-StyleGuide.pdf
- Apple, Manual del usuario del iPhone — Dictar texto ("Dictado", "Activar el dictado"): https://support.apple.com/es-lamr/guide/iphone/iph2c0651d2/ios
- Gboard Spanish usage ("dictado por voz", "escritura por voz"): https://www.xatakandroid.com/aplicaciones-android/google-reinventa-su-teclado-para-hacer-sencilla-escritura-voz-gboard-hemos-probado
- RGPD, Reglamento (UE) 2016/679, texto en español (EUR-Lex): https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679
- AEPD, transferencias internacionales: https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/transferencias-internacionales
- RAE, Diccionario panhispánico de dudas — mayúsculas (meses en minúscula): https://www.rae.es/dpd/may%C3%BAsculas
