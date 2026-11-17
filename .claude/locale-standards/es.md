# Locale standard — es (Spanish, app UI + legal)

Scope: OwnJournal app (`src/i18n/locales/es.json`) and website (`ownjournal-website/src/i18n/locales/es.json`) UI, Help, paywall and privacy/legal strings. For long-form blog voice see the website repo's `.claude/locale-standards/es.md` (that one wins for blog prose; this one wins for UI and legal).

## Register and variety
- **tú**, always (house style in both files, and the norm for consumer wellness apps). Never *usted*, never *vosotros* in UI (address one user).
- Neutral Spanish leaning to Iberian standard, matching the house style: *Ajustes* for device/OS settings (iOS and Android in Spain), *Configuración* is also used in-app for app settings (house style, both accepted). Avoid strong Latin American regionalisms in new text (*monitoreo* → *supervisión*, *retener datos* → *conservar datos*).
- Preterite for one-off error states is house style: *No se encontró…*, *No se pudo…*, *No se detectó…* (keep; do not convert to perfect tense piecemeal).
- Iberian verbs win over LatAm ones everywhere (decided 2026-11, whole-file pass): *introducir* (not *ingresar*), *añadir* (not *agregar*, except *datos agregados* = aggregate), *caducado/caducar* (not *vencido*), *ordenador* (not *computadora*), *fallos* (not *fallas*), *supervisar/supervisión* (not *monitorear/monitoreo*), *en curso* (not *en progreso*), *correctamente* (not *exitosamente*), *de nuevo* (not *nuevamente*), *contactar con* (not *contactar a*), *pulsar* (not *presionar*), *¿Quieres…?* (not *¿Deseas…?*).
- Address form: tú in every product UI and legal string of both repos. Usted forms (*espere, inténtelo, verifique, considere, su conexión*) are bugs.

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
| backup | copia de seguridad | respaldo |
| timeline | cronología | línea de tiempo, línea temporal |
| insights (analysis results) | conclusiones / información / análisis | perspectivas, insights |
| average | media | promedio |
| mood levels | Excelente, Bueno, Normal, Malo, Pésimo (app values) | Genial, Bien, Terrible |
| activity "Social" | Vida social | Social |
| supports X | compatible con X / admite X | soporta |
| check (imperative) | Comprueba | Verifica (keep *verificar* only for real verification) |
| done (state) | completada/completado (*Sincronización completada*) | completa (= whole) |
| re-analyze | volver a analizar | re-analizar |
| Welcome | Te damos la bienvenida / ¡Hola de nuevo! | ¡Bienvenido! (gendered) |
| no-compromise | sin concesiones | sin compromisos |
| period | periodo | período (both RAE; house picks one) |
| app settings (in-app) | Configuración | Ajustes (reserve for device/OS settings) |
| Apple Account (formerly Apple ID) | **Cuenta de Apple** (capital C, as on support.apple.com/es-es): *tu Cuenta de Apple*, *esta Cuenta de Apple* (feminine), *cargar en tu Cuenta de Apple* | *Apple ID*, *ID de Apple* (renamed 2024), *cuenta Apple* |
| Sign in with Apple (feature/button) | **Iniciar sesión con Apple** (Apple's official es name) | *Iniciar sesión con Apple ID*, *Acceder con Apple* |

## GDPR / legal vocabulary (official Spanish RGPD text)
- RGPD (not GDPR); EEE (Espacio Económico Europeo); *decisión de adecuación*.
- *garantías adecuadas* (art. 46) — not *salvaguardas apropiadas*.
- *Cláusulas Contractuales Tipo (CCT)* — the AEPD term; not *Cláusulas Contractuales Estándar*. (RGPD art. 46.2.c literally says *cláusulas tipo de protección de datos*.)
- *responsable del tratamiento*, *encargado del tratamiento*, *tratamiento de datos*, *conservar* (retain), *plazo/periodo de conservación*.
- *expresamente* for "explicitly" in legal text.
- Data processing (GDPR) = *tratamiento/tratar*, never *procesamiento/procesar* (that stays only for payments, *procesador de pagos*, and the AI service "processing a request"). Section titles: *Funciones de IA y tratamiento de datos*, *Base jurídica del tratamiento*, *Conservación de datos* (not *Retención*), *Delegado de protección de datos (DPD)* (not DPO).
- Rights list: *rectificar* (not corregir), *supresión*, *limitación del tratamiento* (not restringir), *presentar una reclamación*, *dirigirse a la autoridad de control*. Lawful bases in lowercase after the colon: *(1) ejecución de un contrato, …; (2) intereses legítimos, …; (3) consentimiento, …*.
- Contract vocabulary: *incumplimiento sustancial / cambios sustanciales* (not *materialmente*), *infracciones* (not violaciones), *dejar de prestar el servicio* (not discontinuar), *no afecta a* (with *a*), *protección del consumidor*, *en virtud de las leyes*, *por tu cuenta y riesgo*, *conducta dolosa*, *a sabiendas*.
- Document names in sentence case everywhere: *Términos de servicio*, *Política de privacidad*. The defined term *estos Términos* keeps its capital.
- The website no longer has its own `legal` block (removed 2026-11; the site links to the app texts), so legal text lives only in the app file. AI requests and voice recordings pass **via our servers only in transit** to Google (*a través de nuestros servidores*, *solo pasa por nuestros servidores en tránsito… y no se conserva*); never claim the servers are not involved.
- Never add or soften facts. Voice-feature invariants: 5 min per recording; 200 min/month; Plus only; audio goes to Google (Gemini); OwnJournal never stores audio or transcripts; only seconds are counted; paid tier does not train on data; Google may retain data for a limited time for abuse monitoring.

## Typography and orthography (RAE / Fundéu)
- Dates: month lowercase with *de*: *noviembre de 2026*, *abril de 2026*. Label `legal.lastUpdatedOn` = *Última actualización: {{date}}* (sentence case, no space before the colon).
- Opening `¿` and `¡` are mandatory.
- Ellipsis `…` (U+2026), no space before it.
- Quotes: straight double `" "` (house rule; no « »).
- Unit symbols: *5 min*, *10 s*, *5 MB*, *{{ms}} ms* with a space; no plural *s* on symbols. Percent with a space: *{{percent}} %*, *100 %*. Relative time: *hace {{minutes}} min*, *hace {{hours}} h*, *hace {{days}} d*.
- Numbers: thousands with a point (*100.000*), decimals with a comma. Website prices are NEVER hard-coded: use `{{price}}` / `{{monthly}}` (the code formats the visitor's currency in es, e.g. *19,99 €*): *Cuesta {{price}} al año (unos {{monthly}} al mes)*, *Unos {{monthly}} al mes • Cancela cuando quieras*. Website refund FAQ mirrors the app Terms (withdrawal 14 days for EU/EEA/equivalent consumers buying on the website; proportional amount if already used; App Store/Google Play refunds by Apple/Google), never "sin preguntas".
- Abbreviation *p. ej.,* (not *ej.*, *ej:*, *p.ej.*). *mín.* with a point.
- Quotes for UI labels referenced in text: straight double quotes, never single quotes ('Gestionar' → "Gestionar").
- Dashes: spaced em dash `—` only as a separator in website feature-list items (*Dictado por voz — 200 minutos al mes*) and the store disclosure title. In prose replace English-style ` — ` / ` - ` with a colon, comma or parentheses (*Sesión caducada: vuelve a conectar…*); a true Spanish inciso uses closed rayas (*—incluido su código fuente—*). Error pattern "X - Y" → *X: y…* (lowercase after the colon).
- No serial comma before *y*.
- *Internet* capitalised is house majority (RAE accepts both).

## UI microcopy conventions
- Buttons: infinitive (*Continuar*, *Dictar*, *Descartar grabación*), short; *Ahora no* for "Not now".
- Errors: state the problem, then the action in imperative tú (*Permítelo en los ajustes…*, *Inténtalo de nuevo.*). Avoid *Por favor* in short errors when it adds length (house style uses it elsewhere; not wrong).
- Plurals (i18next 25, CLDR `es` = **one / many / other**; all three are required, a missing one falls back to English). Every key that has `_one/_other` in en.json gets `_one`, `_many`, `_other` and no bare base key. Write real sentences with the number (*Se han importado {{count}} entradas*), not the old label workaround. `_one` agrees in the singular (*Se ha añadido {{count}} etiqueta*). `_many` (1.000.000, 2.000.000…) is the "millón de" form: put *de* between the number and the noun (*{{count}} de entradas*, *Se han migrado {{count}} de archivos*); where the number is not directly followed by its noun (*Alertas activas ({{count}})*, *{{count}} de las últimas 10 operaciones*, *{{count}} de {{total}} entradas*), `_many` = `_other`. Partitive "X of Y failed": *No se pudo descifrar {{count}} de {{total}} entradas* (one) / *No se pudieron…* (other). Never write *(s)* plurals.
- Placeholders WITHOUT plural forms (no `_one/_other` in English) must still read correctly for 1 and 0: use a label pattern (*Tiempo restante este mes: {{minutes}} min*) or a parenthesis.
- Success toasts: perfect *Se ha(n) + participio* (*Se han recuperado…*); keep preterite where the sentence already uses it (*…se resolvieron automáticamente. Se registraron {{count}} conflictos.*).
- Tap vs click (house rule, mirrors English): *Toca* for in-app controls that exist on mobile; *Haz clic* only on web/desktop-only surfaces (Nextcloud web UI, browser address bar, email links, the Stripe billing portal and its "Gestionar" button, the Apple web sign-in popup). *Pulsa* only for physical keys (*pulsa Enter*). After a colon the imperative is lowercase (*Para crear una copia de seguridad: toca tu icono de perfil → Exportar datos*). Menu paths use `→` (*Ajustes → tu nombre → iCloud*), not `>`.
- UI labels named in Help must match the real label: the reset action is *"Restablecer todos los datos"* in the *Zona de peligro* (not *Eliminar todo*).
- `auth.termsAgreement` is one `<Trans>` sentence: *Al continuar, aceptas nuestros <terms>Términos de servicio</terms> y nuestra <privacy>Política de privacidad</privacy>.* Repeat the possessive for each noun (gender differs) and end with a period. Exactly one `<terms>` and one `<privacy>` pair, no other tags.
- Chart tooltips with two numbers: never separate them with a bare comma (*3,4, 5 entradas* is ambiguous with decimal commas). Use *en*: *{{delta}} (media: {{emoji}} {{avg}} en {{count}} entradas)*.
- Drop *Por favor* in UI messages (*Inténtalo de nuevo.*, *Introduce tu contraseña.*); retry = *Inténtalo de nuevo* / *antes de volver a intentarlo*.
- Sentence case for every title, button and label (*Ver conflictos*, *Aplicar todo*, *Ahora no*); Title Case is an English carry-over.
- Prefer active/impersonal *se* over *ha sido + participio* (*Se ha eliminado tu cuenta*). *múltiples* → *varios* in UI.
- Log/diagnostic lines are *registros*, never *entradas* (reserved for journal entries); mood-correlation counts are *entradas*, not *textos*.
- "Not supported" → *no es compatible con…* (Microsoft/Apple convention).
- Do not chain *y … y …* in one clause; Spanish prefers a relative clause or comma: *…en un texto limpio y bien puntuado, que se inserta donde tengas el cursor*.
- Avoid mid-list relative clauses with commas (*el dictado por voz, que convierte…, el análisis…*) — the enumeration becomes unreadable; use *para* + infinitive or parentheses.

## Known pitfalls
- Portuguese bleed (*ativar*, *atividade*) — see website standard.
- *consistencia* ≠ *constancia*; *realizar* creep; *insights* anglicism ("insights de ánimo" etc.): use *análisis del ánimo*, *información*, *conclusiones*; none remain in either file as of 2026-11-17.
- *Cuando te detengas, … se convierten* mixes subjunctive with habitual present; use *Al detener la grabación, …*.
- Keep the app and website feature names identical (*Dictado por voz*).
- "privacy-first journal" → *un diario que antepone la privacidad*, not *diario con privacidad primero*. "No credit card required" → *Sin necesidad de tarjeta de crédito*. "Everything in Free" → *Todo lo del plan Gratis*. "where your data lives" → *dónde se guardan tus datos*.
- Stale/condensed translations exist (Help, onboarding tour): when touching a key, check meaning parity against en.json, not only grammar.

## Sources
- Microsoft Spanish (Spain) Style Guide: https://download.microsoft.com/download/9/a/1/9a19beca-597c-417b-a2c2-0f1ea5a1e6c3/spa-esp-StyleGuide.pdf
- Microsoft Spanish (Neutral) Style Guide: https://download.microsoft.com/download/4/3/1/431d9836-40dc-4f2b-aafc-def5c7b5d0f3/spa-neu-StyleGuide.pdf
- Apple, Manual del usuario del iPhone — Dictar texto ("Dictado", "Activar el dictado"): https://support.apple.com/es-lamr/guide/iphone/iph2c0651d2/ios
- Gboard Spanish usage ("dictado por voz", "escritura por voz"): https://www.xatakandroid.com/aplicaciones-android/google-reinventa-su-teclado-para-hacer-sencilla-escritura-voz-gboard-hemos-probado
- RGPD, Reglamento (UE) 2016/679, texto en español (EUR-Lex): https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679
- AEPD, transferencias internacionales: https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/transferencias-internacionales
- Apple, Cuenta de Apple (es-ES; "Tu Cuenta de Apple, que antes llamábamos ID de Apple"): https://support.apple.com/es-es/apple-account
- Apple, ¿Qué es Iniciar sesión con Apple?: https://support.apple.com/es-lamr/HT210318 (es-ES Apple Business guide uses the same name: https://support.apple.com/es-es/guide/business/axmc55f52fac/web)
- RAE, Diccionario panhispánico de dudas — mayúsculas (meses en minúscula): https://www.rae.es/dpd/may%C3%BAsculas
