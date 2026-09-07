# Pendientes · 7-sep-2026

Lo que falta, de quién depende, y cómo se sabe que quedó. Se actualiza
cada vez que algo se cierra.

## Del dueño (nadie más puede hacerlo)

| # | Qué | Cómo | Cómo se comprueba |
|---|---|---|---|
| 1 | **`CRON_SECRET` en Vercel** | Inventar 32 caracteres (PowerShell: `-join ((48..57 + 97..122) \| Get-Random -Count 32 \| ForEach-Object { [char]$_ })`), Vercel → eurotravel-web → Settings → Environment Variables → Production → Redeploy | En 15 min el registro dice `[seguimiento] {"revisadas":…}` en vez de «falta CRON_SECRET» |
| 2 | **Tres plantillas en Meta** | WhatsApp Manager → Plantillas → Crear: `seguimiento_24h`, `seguimiento_3d`, `seguimiento_7d`, Marketing, Español (MEX), una variable `{{1}}` con muestra «tu viaje a Puerto Vallarta». Textos exactos en `docs/SEGUIMIENTO.md`. Al aprobarse: `WHATSAPP_PLANTILLA_TOQUE1/2/3` en Vercel + Redeploy | El registro deja de decir «no hay WHATSAPP_PLANTILLA_TOQUEn» y `mandados` sube |
| 3 | **Un mensaje de prueba al bot** desde el tercer teléfono | Cualquier texto | En el registro ya no sale «no tiene la columna» (el SQL del 7-sep quedó) |
| 4 | **Teléfono de guardia** (pregunta 5 del plan) | Decirlo; «el mismo» si es el personal | Va a `datos-bot.json` y al plan |
| 5 | **«Va» al plan del agente con memoria** | Leer `docs/AGENTE.md` y decir «va» | Arranca la fase 1 del agente |
| 6 | **La puerta de Dualhook** (auditoría B6) | Decidir: rotar el tramo cada mes, pedir a Dualhook sus IPs de salida, o pedirle un secreto por aviso | Se implementa lo que decida |
| 7 | **Prueba social y seguridad de la empresa** (`datos-bot.json`) | Rutas frecuentes, tipos de cliente, una o dos frases verificables; confirmar GPS 24/7, permiso vigente, año de las unidades, experiencia de choferes | Deja de haber «PENDIENTE» en esas llaves y el agente puede afirmarlo |
| 8 | **Cancelación: confirmar el supuesto** | ¿El 20/40/100 % es sobre el total del viaje o sobre lo abonado? | Se ajusta el texto del agente |
| 9 | **Cambio de fecha: ¿hay política?** | Hoy el bot te pasa al cliente sin explicar nada (dictado 5-sep) | Si dictas una, se escribe |
| 10 | **Probar de punta a punta desde el tercer teléfono** | Autobús: lista → escoger → «¿salen de la ZMG?» → espera con foto → ticket → tu número → precio al cliente; luego «tablero» desde tu personal | Lo veo en el registro |
| 11 | **Variables del número de prueba de Meta** | Quitar de Vercel las que ya no se usan (`WHATSAPP_APP_SECRET` y el token viejo) cuando Dualhook esté firme | Menos puertas abiertas |
| 12 | **Dominio eurotravel.com.mx** | Confirmar si ya está apuntado; `SITIO_URL` en Vercel debe decir el definitivo | Las fotos de la unidad salen con la liga buena |
| 13 | **EuroSystem: portal de suplantación H-2 y bitácora** | Decisión tuya (auditoría del 6-sep en EuroSystem) | — |
| 14 | **`GROQ_API_KEY` en Vercel** (el lector de notas de voz) | console.groq.com → API Keys → crear → pegar en Vercel → Redeploy | Una nota de voz al bot: la entiende; el registro deja de decir «falta GROQ_API_KEY» |
| 15 | **`GOOGLE_ROUTES_KEY` en Vercel** (destinos fuera de la lista) | Confirmar que existe (la página la usa; si el bot cotiza «Zacatecas» sin precio, falta) | El ticket de un destino raro trae «Calculado: $…» |
| 16 | **Perfil de WhatsApp Business** completo | Foto, nombre, descripción, dirección, horario, sitio | Se ve al abrir el chat |
| 17 | **El relevo: probarlo** (ya construido el 7-sep) | Desde tu personal: responde cualquier mensaje de un cliente (ticket, reenvío o el «ver 33…») con **«yo»** → el bot se calla y te reenvía lo que escriba; le contestas citando el reenvío; con **«bot»** lo devuelves. También «33 1234 5678 yo» y «33 1234 5678 bot». El tablero marca con ✋ los chats que tienes | Un cliente de prueba: «yo», escribe, te llega; «bot», la IA vuelve |
| 18 | **Correr el bloque «EL RELEVO» de `docs/ALMACEN.sql`** (una columna) | SQL Editor, pegar el archivo completo otra vez | El registro no dice «no tiene la columna en_manos_de» |

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
| ⬜ | **`GROQ_API_KEY`** | **El lector de notas de voz.** Sin ella, cada audio termina en «¿me lo pones en un mensaje?». Se saca gratis en console.groq.com → API Keys | Manda una nota de voz al bot: debe entenderla. Si falta, el registro dice `[audio] falta GROQ_API_KEY` |
| ⬜ | **`GOOGLE_ROUTES_KEY`** | Los destinos que no están en la lista se cotizan por kilómetros con Google | Cotiza un destino raro (p. ej. «Zacatecas»); si el ticket llega sin precio calculado y el registro dice «no se pudo cotizar», falta |
| ⬜ | **`CRON_SECRET`** | El seguimiento | `[seguimiento] {…}` cada 15 min |
| ⬜ | **`WHATSAPP_PLANTILLA_TOQUE1/2/3`** | Los tres avisos | Cuando Meta apruebe las plantillas |
| ⬜ | `ESPIAR` (opcional) | Que te llegue copia de lo que el bot le dice a cada cliente, en vivo, los primeros días | Ponla en `1` la primera semana y quítala después |

### Cuentas y datos

| Estado | Qué | Dónde |
|---|---|---|
| ✅ | El número real conectado por Dualhook (pagado, 12 €/mes) | Dualhook |
| ✅ | El SQL del almacén corrido | Supabase, proyecto del bot |
| ⬜ | Las tres plantillas aprobadas por Meta | WhatsApp Manager → Plantillas |
| ⬜ | Perfil de WhatsApp Business completo: foto, nombre, descripción, dirección, horario, sitio | WhatsApp Business → Perfil de empresa |
| ⬜ | Teléfono de guardia | Tú me lo dices |
| ⬜ | Prueba social y seguridad en `datos-bot.json` (rutas frecuentes, tipos de cliente, GPS, permiso, año de unidades) | Tú me los dictas |
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
8. **Stop:** el cliente escribe «stop» → «no te vuelvo a escribir por mi cuenta».

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

## Hecho hoy (para no volver a preguntarlo)

Auditoría de 45 hallazgos con sus 4 fases cerradas (`docs/AUDITORIA-BOT-7SEP.md`);
seguimiento 24 h / 3 d / 7 d por cron con plantillas y textos investigados
(`docs/SEGUIMIENTO.md`); memoria de 7 días y de dos cotizaciones; «para 20
solo hay Sprinter»; destinos de un día; RFC y cancelación pasan por ti;
liquidación sin fecha límite; SQL corrido; plan del agente (`docs/AGENTE.md`).
