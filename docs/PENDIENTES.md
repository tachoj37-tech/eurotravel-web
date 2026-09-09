# Pendientes · 7-sep-2026

Lo que falta, de quién depende, y cómo se sabe que quedó. Se actualiza
cada vez que algo se cierra.

## Del dueño (nadie más puede hacerlo)

| # | Qué | Cómo | Cómo se comprueba |
|---|---|---|---|
| 20 | **Correr los tres bloques del 8-SEP de `docs/ALMACEN.sql`** (tabla `vistos`, tabla `turnos`, columna `fichas.fotos`) | Supabase → SQL Editor → pegar el archivo completo otra vez | Sin ellos: un reintento de Meta puede contestar dos veces; el registro por turno solo queda en Vercel; las fotos vistas solo viven en la plática |
| 21 | **Fundir la rama `fix/memoria-agente` a `main`** (reparación dirigida, 6 commits, sección H de la auditoría) | Decirme «fúndela» o hacerlo tú en GitHub | Se despliega solo; luego `npm run reparacion` y las 8 pruebas de humo |
| 23 | **Correr las cinco conversaciones con el modelo real** (`scripts/conversar.mjs`) | En PowerShell: `$env:ANTHROPIC_API_KEY="tu llave"; node scripts/conversar.mjs` (cuesta menos de $0.30) | Pegarme las transcripciones y marcar dónde todavía suena a guion |
| 22 | **`CUENTA` en Vercel** (el número de cuenta, solo dígitos, p. ej. el de la ficha) y `DATOS_BANCARIOS` = «BBVA Bancomer · a nombre de Turismo ET, S.A. de C.V.» | Environment Variables → Production → Redeploy | Con el precio llegan: el bloque de apartado, la CLABE pelona y la cuenta pelona, cada una en su mensaje |
| 3 | **Confirmar `CLABE`, `DATOS_BANCARIOS` y `SITIO_URL` en Vercel (Production)** | En la prueba del 8-sep, tras «te la aparto» no llegó ni la ficha ni la CLABE: `mandaFicha` exige `CLABE` + `SITIO_URL` | Al escribir «apártamela» con precio dado llegan la imagen de la ficha y la CLABE sola |
| 5 | **«Va» al plan del agente con memoria** | Leer `docs/AGENTE.md` y decir «va» | Arranca la fase 1 del agente |
| 6 | **La puerta de Dualhook** (auditoría B6) | Decidir: rotar el tramo cada mes, pedir a Dualhook sus IPs de salida, o pedirle un secreto por aviso | Se implementa lo que decida |
| 9 | **Cambio de fecha: ¿hay política?** | Hoy el bot te pasa al cliente sin explicar nada (dictado 5-sep) | Si dictas una, se escribe |
| 10 | **Probar de punta a punta desde el tercer teléfono** | Autobús: lista → escoger → «¿salen de la ZMG?» → espera con foto → ticket → tu número → precio al cliente; luego «tablero» desde tu personal | Lo veo en el registro |
| 11 | **Variables del número de prueba de Meta** | Quitar de Vercel las que ya no se usan (`WHATSAPP_APP_SECRET` y el token viejo) cuando Dualhook esté firme | Menos puertas abiertas |
| 12 | **Dominio eurotravel.com.mx** | Confirmar si ya está apuntado; `SITIO_URL` en Vercel debe decir el definitivo | Las fotos de la unidad salen con la liga buena |
| 13 | **EuroSystem: portal de suplantación H-2 y bitácora** | Decisión tuya (auditoría del 6-sep en EuroSystem) | — |
| 15 | **`GOOGLE_ROUTES_KEY` en Vercel** (destinos fuera de la lista) | Confirmar que existe (la página la usa; si el bot cotiza «Zacatecas» sin precio, falta) | El ticket de un destino raro trae «Calculado: $…» |
| 16 | **Perfil de WhatsApp Business** completo | Foto, nombre, descripción, dirección, horario, sitio | Se ve al abrir el chat |
| 17 | **El relevo: probarlo** (ya construido el 7-sep) | Desde tu personal, con los 10 dígitos pegados: **«3312345678 yo»** → el bot se calla con ese cliente y te reenvía lo que escriba; le contestas desde el teléfono del negocio o citando el reenvío; **«3312345678 bot»** lo devuelve a la IA. También sirve responder un ticket suyo con «yo»/«bot». El tablero marca con ✋ los chats que tienes | Un cliente de prueba: «yo», escribe, te llega; «bot», la IA vuelve |
| 19 | **Un mensaje desde el teléfono del negocio al tercer teléfono** | Solo escribirlo | Con el registro sabré si Dualhook avisa de lo que escribes desde el negocio; si sí, el relevo se vuelve automático (te calla el bot con solo escribir tú) |

## Para lanzar el bot · lista de verificación

Lo que tiene que estar en pie el día que se anuncie el número. Todo se
revisa en **Vercel → eurotravel-web → Settings → Environment Variables
(Production)** salvo donde diga otra cosa. Un ✅ es «ya está»; un ⬜ es
«falta o no está confirmado».

### Variables en Vercel

| Estado | Variable | Para qué | Cómo se comprueba |
|---|---|---|---|
| ✅ | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_API_BASE`, `WHATSAPP_RUTA_SECRETA` | La puerta de Dualhook y el envío | El bot contesta hoy; los avisos entran por el tramo |
| ✅ | `DUENO_WHATSAPP` | Tus tickets y tu «va» | Te llegan los tickets al personal |
| ✅ | `ANTHROPIC_API_KEY` | La IA | El registro trae `[ia] …` en cada mensaje |
| ✅ | `ALMACEN_URL`, `ALMACEN_CLAVE` | La memoria | `[almacen] conectado` en el registro |
| ✅ | `DISPONIBILIDAD_API_KEY`, `CONTRATOS_API_KEY`, `EUROSYSTEM_URL` | Calendario y contrato BORRADOR | Ticket con calendario; contrato con folio |
| ✅ | `CLABE`, `DATOS_BANCARIOS`, `SITIO_URL` | La ficha bancaria como imagen y la CLABE sola; las fotos de la unidad | El cliente recibe la foto y la ficha |
| ✅ | **`GROQ_API_KEY`** | El lector de notas de voz (puesta el 8-sep-2026) | Se confirma con la nota de voz de las pruebas de humo |
| ⬜ | **`GOOGLE_ROUTES_KEY`** | Los destinos que no están en la lista se cotizan por kilómetros con Google | Cotiza un destino raro (p. ej. «Zacatecas»); si el ticket llega sin precio calculado y el registro dice «no se pudo cotizar», falta |
| ✅ | **`CRON_SECRET`** | El seguimiento (puesta el 8-sep-2026; el cron corre desde las 04:45 con `{"revisadas":…}`) | `[seguimiento] {…}` cada 15 min |
| — | `WHATSAPP_PLANTILLA_TOQUE1/2/3` | **Ya no hacen falta** (8-sep-2026: «quitamos lo de Meta»). El toque de 22 h sale como texto libre; los de 3 y 7 días te llegan a ti en un resumen para que escribas desde tu teléfono | Opcional: si algún día las configuras, esos toques vuelven a salir solos |
| ⬜ | `ESPIAR` (opcional) | Que te llegue copia de lo que el bot le dice a cada cliente, en vivo, los primeros días | Ponla en `1` la primera semana y quítala después |

### Cuentas y datos

| Estado | Qué | Dónde |
|---|---|---|
| ✅ | El número real conectado por Dualhook (pagado, 12 €/mes) | Dualhook |
| ✅ | El SQL del almacén corrido | Supabase, proyecto del bot |
| — | Plantillas de Meta | Ya no hacen falta (8-sep-2026); la de 24 h que creaste queda sin uso, no estorba |
| ⬜ | Perfil de WhatsApp Business completo: foto, nombre, descripción, dirección, horario, sitio | WhatsApp Business → Perfil de empresa |
| ✅ | Teléfono de guardia: 33 1915 3931, su personal (8-sep-2026) | `datos-bot.json` |
| ✅ | Prueba social y seguridad en `datos-bot.json`: rutas Vallarta/Mazatlán/CDMX/Tequila, GPS real, permiso no se menciona, años solo de i6S (2023), i6 (2017) y G8 (2026), choferes «con experiencia» (8-sep-2026) | `datos-bot.json`, `_agente.js`, `_psicologia.js` |
| ⬜ | Dominio definitivo (eurotravel.com.mx) y `SITIO_URL` apuntando ahí | Vercel → Domains |
| ⬜ | Quitar las variables del número de prueba de Meta que ya no se usan | Vercel |

### Pruebas de humo, desde el tercer teléfono, el día del lanzamiento

1. **Sprinter completa:** «vamos a Tequila» → fecha → «¿ida y vuelta el mismo día?» → cuántos (debe decir «para N solo hay Sprinter») → «¿salen de la ZMG?» → espera con foto → te llega el ticket → «va» → el cliente recibe precio con anticipo → «ya quiero apartar» → ficha bancaria y CLABE → manda una foto de comprobante → te llega el aviso.
2. **Autobús:** «somos 45 a Vallarta» → lista de opciones → escoger → resto → ticket sin precio → contestas «52,000» → precio completo con 6 días y foto del camión escogido.
3. **Nota de voz:** un audio de 10 segundos con destino y fecha → debe entenderlo.
4. **Otro viaje:** con una cotización en el aire, «quiero cotizar otro viaje a Mazamitla» → arranca de cero y el de Vallarta sigue en pie; contestas cada ticket con su precio.
5. **Corrección:** «mejor a Chapala» y «somos 30» a media cotización → cambia sin repreguntar lo demás.
6. **RFC y persona:** «me pasas tu RFC» y «quiero hablar con una persona» → te llega el ticket, el cliente no recibe otro número.
7. **Tablero y ver:** desde tu personal, «tablero» y «ver 33…».
8. **Ya no:** el cliente escribe «ya no, gracias» → «Va, entendido 🙌 …» y no le llega ningún toque después.

Cuando las ocho pasen, se anuncia el número.

## Míos (arrancan con tu «va» o cuando cierres lo tuyo)

| # | Qué | Depende de |
|---|---|---|
| A | **Agente con memoria, fase 1** (herramientas, esquema `docs/AGENTE.sql`, ficha de 400 tokens, retención; pruebas a, c, g, h, i, j) | Tu «va» (5) y el teléfono de guardia (4) |
| B | **Fase 2: EuroSystem en vivo** (GET de reserva, avisos salientes, `consultar_reserva` con snapshot, `crear_link_pago`; pruebas b, c, d, e) | Fase 1 hecha; cambios de esquema en EuroSystem por `experto-migraciones` y tu confirmación |
| C | **Fase 3: acompañamiento** (recordatorios de saldo 30/15/5 d y de salida 15 d/72 h/24 h, post-viaje, aniversario, reconciliación diaria; prueba f) | Fase 2 y las plantillas de Meta de cada aviso |
| D | **Auditoría B15** (escapar valores en `pide`), deuda menor | Nada; se hace en cualquier hueco |
| E | **Verificar en el registro** cada cosa que cierres de arriba (1, 2, 3, 10) | Que las hagas |
| F | **Los 40 textos de seguimiento por texto libre** (`_recordatorios.js`) ya no se usan con toques a 24 h+; dejarlos como respaldo documentado o quitarlos | Decisión chica, sin prisa |

## Hecho el 8-sep-2026 (madrugada)

**«¿Cuál fiesta?»** (prueba de humo del dueño, 6 p.m.): a un «Vallarta» por
nota de voz el bot contestó «la fiesta empieza ahí; de regreso todos
duermen y nadie maneja». La psicología de ventas se reescribió de manual
de técnicas con frases hechas a principios de vendedor sin frases para
copiar (`_psicologia.js` = `docs/PSICOLOGIA-DE-VENTAS.md`); la ocasión sale
SOLO de las palabras del cliente, nunca del destino (`bot.js`, `_entender.js`,
`_agente.js`). El audio ya funciona: Groq transcribió la nota de voz.
Conversaciones de prueba borradas con `docs/LIMPIAR-PRUEBAS.sql` + redeploy.

**«Si quiere camiones, ofrécele opciones»** (6:22 p.m.): a «quiero un
camión» y «¿qué camiones tiene?» el bot contestaba «depende de cuántos
van» tres veces seguidas. Ahora, si pide autobuses y la IA no nombra
ninguno, sale la lista completa del catálogo (o los que le caben si ya se
sabe cuántos son) **sin pedir cuántos son** («mucha gente quiere organizar
un viaje solamente, no sabe cuántos ni cómo»): cierra ofreciendo fotos
(`mensajeDeTodosLosAutobuses`, candado `conLosAutobusesQuePidio`, prueba
R11). Se compara sin acentos y con dedazos: «camión» y «que camines tiene?»
se le escaparon a la primera versión. Y **con un autobús ya escogido,
cuántos son no es requisito** (6:46 p.m.: «lo que importa es la renta de
camión, no las personas; puedo rentar un i6 sin que responda cuántos
somos»): el motor ya no lo pide (`alSiguienteHueco`), la IA se regenera si
lo pregunta (`preguntaQueSobra`) y, si insiste, contesta el guion con lo
que sí falta. Con Sprinter o Suburban sí se pregunta: ahí la cuenta decide
la unidad. Prueba R12; la de fase 3 cambió de lado con su razón. Y si el
bot ofreció fotos («¿Te mando fotos de alguno?») y el cliente contesta con
el nombre de una unidad («i6»), eso es pedir sus fotos: van las fotos, la
unidad queda escogida y la descripción de la IA sale después como remate
(antes describía la unidad y no mandaba nada). Prueba R13. En la misma prueba dijo
«pasado mañana, 11 de septiembre» siendo día 8: «hoy» se calculaba en UTC
(Vercel); ahora `hoyISO` es hora de Guadalajara en todos los caminos.

**Seguimiento sin plantillas de Meta** («quitamos lo de Meta, es mucho»):
el primer toque baja a 22 h y sale como texto libre gratis; los de 3 y 7
días le llegan al dueño en un resumen para que escriba él desde su
teléfono. Costo mensual estimado con 500 conversaciones: de ~60 a ~35 USD.
Columna del relevo corrida; `CRON_SECRET` y `GROQ_API_KEY` en Vercel con
Redeploy (el cron ya corre); plantilla `seguimiento_24h` creada en Meta (las
otras dos mañana); las plantillas no ofrecen «stop»: el bot detecta el «ya
no» del cliente; teléfono de guardia, base de la cancelación (sobre el
total) y prueba social dictados y guardados. `DUENO_WHATSAPP` apuntando a su
personal. Primera prueba de humo real: el almacén se cayó por una llave mal
pegada (arreglado por él); «entre 20 cuánto sería» ahora lo contesta el
motor con el reparto por persona; con el precio ya no se repite la foto ni
lleva pie (sección F de la auditoría). Anuncios para Meta Ads en
`docs/ANUNCIOS.md` e `img/anuncios/` (Higgsfield sin créditos: quedan
pendientes las versiones generadas).

## Hecho el 7-sep-2026 (para no volver a preguntarlo)

Auditoría de 45 hallazgos con sus 4 fases cerradas (`docs/AUDITORIA-BOT-7SEP.md`);
seguimiento 24 h / 3 d / 7 d por cron con plantillas y textos investigados
(`docs/SEGUIMIENTO.md`); memoria de 7 días y de dos cotizaciones; «para 20
solo hay Sprinter»; destinos de un día; RFC y cancelación pasan por ti;
liquidación sin fecha límite; SQL corrido; plan del agente (`docs/AGENTE.md`).
