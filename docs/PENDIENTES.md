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
