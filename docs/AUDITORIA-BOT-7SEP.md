# Auditoría del bot · 7-sep-2026

Tres revisores en paralelo (flujo de conversación; dinero y compuerta;
almacén, cron y seguridad), solo lectura. Cada hallazgo dice si lo
**comprobé yo** con un script o si es **lectura** del revisor. Al final,
las fases para arreglarlos, en orden.

**Resumen:** 45 hallazgos, de los cuales 10 críticos (varios repetidos
entre revisores: A2=C4, B2=C1, B3=C5, B4=C10, B9=C13). Los que más
duelen: el «va» del dueño no deja rastro en la base (B2/C1); cualquier
ticket confirma precio (C2); el filtro de cifras deja pasar precios
(A2/C4); las escrituras al almacén ocurren antes de validar la firma
(B1); el cliente no puede corregir un dato (A3); «quiero apartar» suelta
la CLABE sin precio (A7).

Gravedad: **CRÍTICO** = pierde al cliente, dinero equivocado, precio sin
permiso o fuga; **ALTO** = comportamiento equivocado visible; **MEDIO** =
raro pero posible; **BAJO** = pulido.

---

## A · Flujo de conversación

| # | Grav. | Dónde | Qué pasa | Estado |
|---|---|---|---|---|
| A1 | CRÍTICO | `whatsapp.mjs` `loQueDiceElAgente` (rama final) | «¿cuánto sale?» antes de tener todos los datos: la IA contesta `respuesta: null, accion: cotizar`; el motor degrada a «seguir» porque falta un dato y manda un texto vacío. Meta lo rechaza, el bot cree que contestó y **el cliente no recibe nada**. | Comprobado por el revisor con script |
| A2 | CRÍTICO | `_agente.js` `sanea()` / `DINERO` | El filtro de cifras solo caza `$` pegado a dígitos o «pesos/mxn/mil/k». «Sale en 18,500 todo incluido», «te queda en 18500» y «aproximadamente veinte mil» **pasan**. Y tira respuestas buenas: «van desde 2 días» y «Perdón, ¿me repites el día?». | **Comprobado por mí** |
| A3 | CRÍTICO | `bot.js` `pegaDatos` | Una vez puesto un dato, el cliente **no puede corregirlo**: «mejor a Mazamitla» se ignora y cotiza Vallarta; «somos 30» se ignora y quedan 15 en una Sprinter. | **Comprobado por mí** |
| A4 | CRÍTICO | `_whatsapp-webhook.js` (freno antes de `esDelDueno`) | El freno de 12 mensajes/minuto también aplica al dueño: de la respuesta 13 en adelante sus «va» se pierden, y como `yaContestado` marca el id antes del freno, el reintento de Meta también se descarta. | **Comprobado por mí** (orden de líneas) |
| A5 | ALTO | `bot.js` `alSiguienteHueco`, `elegirBus`, `pegaDatos` | Si el cliente nombra la unidad antes de decir cuántos son, se acepta un autobús sin saber la gente y la capacidad ya no se revuelve a revisar: 60 en un i6 de 47. Con Sprinter llega a cotizar sin preguntar cuántos. | Comprobado por el revisor |
| A6 | ALTO | `whatsapp.mjs` acción «persona» → `bot.js` | «Quiero hablar con una persona» contesta **«Márcame o escríbeme al 33 2400 2285»**: manda al cliente a otro número, lo que el dueño prohibió el 6-sep. | **Comprobado por mí** |
| A7 | ALTO | `whatsapp.mjs` acción «apartar» → webhook | «Quiero apartar» con la plática limpia iza `pideDatosBancarios` sin viaje ni precio: **el cliente recibe la ficha bancaria y la CLABE** sin que el dueño haya dado precio. | **Comprobado por mí** |
| A8 | ALTO | `_whatsapp-webhook.js` (`estadoAntes` en el bucle) | Cuando Meta agrupa dos mensajes en un aviso, el segundo arranca del estado que entendió el **guion** del primero, no del que leyó la IA. La gente escribe a ráfagas. | Comprobado por el revisor |
| A9 | ALTO | `_whatsapp-webhook.js` (tipo genérico) | Una reacción 👍, un sticker, una ubicación o un contacto reciben «Lo recibí 👍 Cuéntame: ¿a dónde van, qué día y cuántos son?» y le mandan al dueño «te están escribiendo». Un 👍 al precio reinicia el interrogatorio. | Comprobado por el revisor |
| A10 | ALTO | `_agente.js` `limpiaDatos.fecha` | Solo se valida la forma `AAAA-MM-DD`: `2026-13-45` o una fecha pasada llegan al motor, al ticket y al calendario de EuroSystem. | Comprobado por el revisor |
| A11 | ALTO | `whatsapp.mjs` `precioDe` (compuerta) | Con la compuerta encendida y `DUENO_WHATSAPP` vacía, el cliente recibe «en breve te paso tu cotización» y **nadie recibe el ticket**: callejón sin salida y encima le llegarían los toques del seguimiento. | Lectura (hoy la variable sí está puesta) |
| A12 | MEDIO | `whatsapp.mjs` (`seguir`→`cotizar`) | Si el cliente da el último dato y pregunta otra cosa en el mismo mensaje («…de Guadalajara, ¿traen aire?»), la respuesta de la IA se tira y solo sale la espera. | Lectura |
| A13 | MEDIO | `_whatsapp-webhook.js` (respuesta del dueño) | Si el dueño contesta un ticket con una foto o nota de voz (sin texto), recibe «No supe para quién es» y al cliente no le llega. | Lectura |
| A14 | MEDIO | `whatsapp.mjs` `atiendeInterno` | Ninguna excepción dentro de `reparte` está atrapada: un tropiezo tumba el webhook (500), Meta reintenta, `yaContestado` ya marcó el id y el mensaje se pierde. | **Comprobado por mí** (no hay try/catch) |
| A15 | BAJO | `_agente.js` `ALIAS_UNIDAD` | «Camioneta ejecutiva» devuelve la Sprinter (el alias de Sprinter atrapa «camioneta» primero). | **Comprobado por mí** |

Bien hecho (no tocar): la compuerta con `carga` por ticket y `consumido`;
el cierre de la plática al cotizar; la separación síncrono/asíncrono de
`procesa`.

---

## B · Almacén, cron y seguridad

| # | Grav. | Dónde | Qué pasa | Estado |
|---|---|---|---|---|
| B1 | CRÍTICO | `whatsapp.mjs` `atiendeInterno` | `cargaLoQueSeSabe` (que **escribe** los mensajes en el almacén y baja audios con nuestro token) corre **antes** de validar firma o tramo, y `guardaLoQueQuedo` corre después aunque la respuesta haya sido 401/403. `POST /api/whatsapp` sin llave es público: cualquiera mete renglones falsos al historial de un cliente. | **Comprobado por mí** (orden de líneas) |
| B2 | CRÍTICO | `whatsapp.mjs` `cargaLoQueSeSabe` | Cuando el dueño contesta un ticket que la instancia ya tiene en memoria, el cliente no entra a `numeros` y **su ficha nunca se guarda**: lo que `precioDe` anotó (`con_precio`, `precioEn`, `viajeDatos`, `porConfirmar: null`) muere con la instancia. El seguimiento no ve a nadie y un «va» posterior contesta «no tengo las fechas». | **Comprobado por mí** (línea del `continue`) |
| B3 | ALTO | `_almacen.js` `guardaFicha` | `por_confirmar` (y las demás columnas condicionales) solo se mandan cuando tienen valor; con el upsert `merge-duplicates` **nunca se borran** en la base. Instancia fría → precio pendiente viejo → un «va» por número escrito manda el precio otra vez. | **Comprobado por mí** (código) |
| B4 | ALTO | `whatsapp.mjs` `mandaSeguimientos` | Sin plantillas configuradas (hoy), el cron **marca los tres toques sin mandar nada**: cuando el dueño configure las plantillas, esos clientes ya quedaron «completos». | Comprobado por el revisor |
| B5 | ALTO | `_tickets.js` `siembraFicha` | «Lo que ya está en memoria gana»: una instancia con la ficha vieja pisa en la base lo que otra instancia avanzó (la etapa retrocede). | Lectura |
| B6 | ALTO | Puerta Dualhook | El tramo secreto en la URL es el único candado: quien lo tenga puede mandar como el negocio, leer el tablero suplantando el `from` del dueño y crear contratos. El tramo queda en registros de acceso y no rota. | Lectura (limitación conocida del 5-sep) |
| B7 | ALTO | `_almacen.js`, `manda`, `_agente.js` | Los `fetch` al almacén, a Dualhook y a Anthropic **no tienen tope de tiempo**. Meta reintenta a los 30 s y `yaContestado` vive en RAM: el reintento cae en otra instancia y el cliente recibe todo dos veces. | Lectura |
| B8 | MEDIO | `_almacen.js` `tiraLoViejo` | No lo llama nadie: la retención de 45 días no se aplica; `mensajes`, `charlas` y `tickets` crecen sin límite. | **Comprobado por mí** (grep) |
| B9 | MEDIO | `mandaSeguimientos` | Dos corridas del cron a la vez mandan el mismo toque dos veces (la marca no es condicional). | Lectura |
| B10 | MEDIO | `guardaLoQueQuedo` + `guardaCharla` | Si falla la LECTURA del almacén y el mensaje no dejó estado en memoria, se guarda `null` y eso **borra** la charla buena de la base. | Lectura |
| B11 | MEDIO | webhook y `whatsapp.mjs` | `AHORA_DE_PRUEBA` se lee también en producción: si quedara puesta congela freno, vencimientos y seguimiento sin aviso. | Lectura |
| B12 | MEDIO | `_almacen.js` `columnaFaltante` | La marca de «columna que falta» no caduca ni distingue tabla: tras correr el SQL, la instancia sigue sin mandar la columna hasta reciclarse. | Lectura |
| B13 | MEDIO | `atiendeSeguimiento` | Sin `CRON_SECRET` contesta 503 «Sin configurar»; cualquier otro tramo contesta 404. Un extraño aprende que existe el seguimiento. | Lectura |
| B14 | BAJO | `avisoEsNuestro` | Un `entry` sin `changes` pasa solo con el WABA. | Lectura |
| B15 | BAJO | `_almacen.js` filtros | Filtros de PostgREST por concatenación; hoy seguro porque todo pasa por `llave()`, pero es deuda. | Lectura |

Bien hecho (no tocar): RLS en todas las tablas y llave secreta solo en el
servidor; comparaciones de secretos en tiempo constante; `_seguimiento.js`
puro y correcto (el problema está en quien lo llama).

---

## C · Dinero y compuerta

| # | Grav. | Dónde | Qué pasa | Estado |
|---|---|---|---|---|
| C1 | CRÍTICO | `whatsapp.mjs` `guardaLoQueQuedo` | Es el mismo B2 visto desde el dinero: tras el «va» del dueño, la ficha del cliente (`con_precio`, `total`, `viajeDatos`, `precioEn`, `porConfirmar: null`) **no se guarda**. El tablero dice «falta darle precio», el seguimiento no lo ve y el contrato contesta «no tengo las fechas». | Comprobado por el revisor y por mí |
| C2 | CRÍTICO | `_whatsapp-webhook.js` (fallback a `ficha.porConfirmar`) | **Cualquier ticket funciona como compuerta**: si el dueño contesta «va» o un número a OTRO ticket (el «ver», «te están escribiendo», el del comprobante, la ficha del contrato, la pregunta de RFC), el bot lo toma como confirmación de precio. Caso real: el cliente manda comprobante, el dueño contesta «15000» para anotar el depósito, y el cliente recibe una cotización nueva de $15,000. | **Comprobado por mí** (código) |
| C3 | CRÍTICO | `whatsapp.mjs` `conTotalFijado` + `bot.js` `textoDeCotizacion` | Cuando el dueño fija un número en un viaje sin cotizador (autobús, Suburban), el precio no trae `dias` y el cliente recibe «🗓️ **undefined** días de servicio» arriba del total. Es el caso normal de los autobuses. | Comprobado por el revisor |
| C4 | CRÍTICO | `_agente.js` `sanea()` | Igual que A2: «te lo dejo en 18,500», «con 3,000 te bloqueo la fecha» pasan. Y la IA tiene las cifras a la mano porque el contexto le mete los últimos mensajes del bot con el «*Total: $…*». | **Comprobado por mí** |
| C5 | ALTO | `_almacen.js` `guardaFicha` | Igual que B3: `por_confirmar` nunca se borra en la base; semanas después un «va» a cualquier ticket de ese cliente revive un precio viejo. | **Comprobado por mí** |
| C6 | ALTO | `_whatsapp-webhook.js` camino `solicitud` (guion) | Cuando el agente NO contesta (sin clave, sin cupo, la IA falla), el guion de autobús/Suburban sigue mandando «Mándale esto por WhatsApp al 33 2400 2285», y su ticket no tiene compuerta: al contestar «52,000», al cliente le llega «52,000» pelón, sin anticipo ni viaje, y no se aprende. | Comprobado por el revisor |
| C7 | ALTO | `_confirmacion.js` `interpreta` | «52 000», «$52,000.00» y «va 52000» se leen como texto y llegan crudos al cliente; el precio pendiente se queda colgado y el bot se calla 2 h. Y «2026» se lee como precio de $2,026. | **Comprobado por mí** |
| C8 | ALTO | `whatsapp.mjs` `armaContrato` | La referencia `WA-<cliente>-<salida>` usa el número tal como llegó: por cita es `5213312345678`, por número escrito es `3312345678`. Si EuroSystem tarda más de 8 s y el dueño reintenta escribiendo el número, sale un **contrato gemelo con folio nuevo**. | **Comprobado por mí** (código) |
| C9 | ALTO | `whatsapp.mjs` `precioDe` | La etapa `con_precio` y el precio aprendido se escriben **antes** de que Meta acepte el mensaje. Si Meta lo rechaza (ventana de 24 h, token), la ficha dice «ya tiene precio» y el seguimiento le preguntará «¿te llegó?» a quien nunca lo recibió. | Lectura |
| C10 | ALTO | `mandaSeguimientos` | Igual que B4: el toque se consume aunque no haya plantilla. | Comprobado por el revisor |
| C11 | MEDIO | `_precios-aprendidos.js` | Los precios aprendidos no distinguen agencia (5 % abajo) de particular: un neto de agencia se sugiere para un particular y al revés. | Lectura |
| C12 | MEDIO | `whatsapp.mjs` (clave del precio aprendido) | Se busca con `unidad || 'sprinter'` y se guarda con `unidad || ''` → «sin unidad»: lo aprendido queda en una clave que nadie consulta. | Lectura |
| C13 | MEDIO | `mandaSeguimientos` | Igual que B9, y además la marca reescribe `cliente_en`/`etapa` desde su foto vieja: un mensaje del cliente llegado entre la lectura y la escritura se pierde. | Lectura |
| C14 | MEDIO | `armaContrato` | Si el dueño renegocia por texto libre («te lo dejo en 48,000»), la ficha sigue con el total anterior y el BORRADOR sale con el monto viejo. | Lectura |
| C15 | BAJO | `conTotalFijado`, `textoDeCotizacion` | El múltiplo de $500 está repetido a mano en vez de usar el de `_tarifa`; y con «autobus» sin modelo el texto del precio promete «Irizar i6S · hasta 51» que nadie escogió. | Lectura |

Bien hecho (no tocar): la compuerta en sí (`precioDe` no manda cifras sin
`confirmado`; ticket con `carga` y `consumido`); el motor de dinero
(`_tarifa`, `_cotiza-nucleo`): sin NaN, anticipo al medio millar sin mover
el total, saldo exacto; `_datos-contrato` que tira cualquier cifra que la
IA quiera meter en un dato del contrato.

---

## D · Encontrado en producción después de la auditoría

| # | Grav. | Dónde | Qué pasó | Estado |
|---|---|---|---|---|
| D1 | CRÍTICO | `whatsapp.mjs` rama «fotos» del agente | El remate después de las fotos se armaba con `loQueFalta`, que es texto de instrucciones para la IA: a un cliente le llegó «Pregunta EXACTAMENTE eso… datos.origen = "Guadalajara"». Los tres revisores no lo vieron porque el texto de `origen` en `loQueFalta` se volvió una instrucción larga el 6-sep. | **Resuelto el 7-sep**: el remate usa la pregunta del guion; `manda` frena cualquier texto con marcas internas hacia un cliente (`[fuga]` en el registro); `sanea()` igual. Pruebas en `probar-agente.mjs` y `probar-fase1.mjs`. |

## E · Segunda auditoría de fugas (7-sep-2026, tarde), después de D1

Un agente revisor (Opus) buscó cualquier camino por el que texto interno o
un «márcame a otro número» pudiera llegarle a un cliente. Cada hallazgo se
comprobó con script, no por lectura. Estado al cierre del día:

| # | Grav. | Qué encontró | Estado |
|---|---|---|---|
| E1 | CRÍTICO | El candado de D1 estaba ajustado a las **cadenas exactas del incidente**, no a la clase de texto: de 242 renglones del prompt, 205 pasaban `sanea()` y `esTextoInterno()` a la vez, incluida la misma regla que se fugó (el prompt dice `datos.origen es` y el candado buscaba `datos.origen =`). | **Resuelto.** El candado se saca del prompt en vivo (`_agente.js`: `FRAGMENTOS_DEL_PROMPT`, cada oración de cada regla, sin los ejemplos entre comillas) y vive en un solo lugar para `sanea` y `manda`. Prueba: de los renglones del prompt pasan ≤ 40 y todos son frases de ejemplo entre comillas. |
| E2 | CRÍTICO | La IA de respaldo (`loQueLaIAEntendido` → `aplicaEntendido`) contestaba «Márcame o escríbeme al 33 2400 2285» cuando el agente no respondía y el cliente pedía persona; `sinMandarAOtroNumero` vivía en un solo llamador. | **Resuelto.** El candado de «otro número» está en `manda`, la única puerta de salida: el cliente recibe «en breve te contestan por aquí mismo» y el dueño un ticket «quiere hablar contigo». |
| E3 | ALTO | El precio con `requiereAsesor` (viajes de más de 1,400 km) o sin respuesta del motor salía con «márcame al 33 2400 2285», incluso **después** del «va» del dueño. | **Resuelto** por E2 (mismo candado en `manda`). |
| E4 | ALTO | `FRASES_PARA_LA_IA` cubría el paso «regreso» de destino de un día solo con Tequila (el destino va interpolado); con Chapala o Tapalpa la frase pasaba. | **Resuelto.** Marcas por forma: `pregunta EXACTAMENTE` sin distinguir mayúsculas y `lo más común para`. |
| E5 | ALTO | La marca `[plantilla …]` de los toques se guardaba en el almacén como mensaje del bot y de ahí se sembraba en el historial del agente como turno suyo. | **Resuelto.** Al almacén va el texto libre del mismo toque (`textoParaLaMemoria`); la marca es texto interno y `manda` la frena si va como texto (la plantilla real sí sale). |
| E6 | MEDIO | Un dedazo del dueño en «5213322220001 quedamos en 52,000» mandaba el viaje y el precio a un desconocido. | **Resuelto.** A un número sin ficha ni charla no se le manda nada; al dueño le llega «No conozco el número…». Y `cargaLoQueSeSabe` ahora carga la ficha del número tecleado (antes, en instancia fría, tampoco veía su precio por confirmar). |
| E7 | MEDIO | `esDelDueno` comparaba solo los últimos 10 dígitos: un número extranjero terminado igual entraba por la rama del dueño («tablero» = la cartera entera). | **Resuelto.** Autoriza el número completo con lada (52/521 son el mismo); los últimos 10 solo agrupan. |
| E8 | MEDIO | `ESPIAR=1` copia cada mensaje al número configurado y cada copia ocupa un lugar de los 300 tickets. | **Pendiente, decisión del dueño**: el espejo se apaga al lanzar (`ESPIAR` fuera de Vercel). |
| E9 | MEDIO | «total 48000» y «3312345678 yo» se anotaban en la plática del cliente como si el dueño se lo hubiera dicho. | **Resuelto.** `esComandoDelDueno` los reconoce (con el número al frente o sin él). |
| E10 | BAJO | `[fecha]` sin llenar en los textos con calendario (hoy inalcanzables). | **Cubierto**: `\[fecha\]` es marca interna. |
| E11 | BAJO | `para: dueno || numeroDeOrigen` con `DUENO_WHATSAPP` vacía (hoy inalcanzable). | Sin cambio; queda anotado. |

Limpio según el revisor: ningún `esTicket` va a un cliente (16 puntos
comprobados), el remate de fotos, `sacaJSON`, `reinyectaAlGuion`, los
textos de `_seguimiento.js` y `_recordatorios.js`.

## F · Prueba de humo del dueño (8-sep-2026, madrugada)

Primera cotización real desde el tercer teléfono, con el número personal
del dueño recibiendo tickets.

| # | Grav. | Qué vio | Causa | Estado |
|---|---|---|---|---|
| F1 | CRÍTICO | Después de pedir fotos, el bot volvió a preguntar «¿a dónde van?» y todos los datos; y el ticket no le llegó al personal. | El Redeploy de las 05:24 dejó `ALMACEN_CLAVE` inválida (401 en cada llamada): sin almacén, cada mensaje cae en una instancia sin memoria. El ticket se fue al `DUENO_WHATSAPP` viejo. | **Corregido por el dueño** (llave nueva `sb_secret_` y su número). No es código. |
| F2 | ALTO | Con el precio dado, «entre 20 cuánto sería?» → «Va, te la aparto». | La IA leyó la pregunta como «apartar»; y aunque hubiera contestado, no puede decir cifras (`DINERO`). | **Resuelto**: el reparto por persona lo hace el motor antes de la IA (`repartoPorPersona` en whatsapp.mjs), con el mismo total; si el grupo ya no cabe en la unidad, ofrece otra cotización con el viaje ya sabido. Una fecha («para el 20 de octubre») no cuenta como gente. |
| F3 | MEDIO | Con el precio llegó otra vez la foto de la Sprinter, con «Ésta es la que les tocaría», aunque ya había pedido fotos. | El precio no sabía qué fotos ya se mandaron. | **Resuelto**: la plática recuerda `fotosVistas`; con el precio (y con la espera) no se repite la foto de esa unidad, y la foto va sin pie. |
| F4 | BAJO | «¿Te la aparto, Peueba?» | Es el nombre del perfil de WhatsApp del teléfono de prueba; el filtro deja pasar cualquier palabra de letras. | Sin cambio: con un cliente real es su nombre. Si el dueño prefiere no usar el nombre del perfil, se quita en una línea. |
| F5 | CRÍTICO | «cuál es la cuenta para depositar?» → «te paso los datos en un momento. Primero: ¿a qué hora salen?»; «apártamela» → «¿A qué nombre la pongo?» y luego «¿Qué día salen?». Nunca llegó la cuenta. | La IA contestaba sola la pregunta de la cuenta (acción «seguir») y pedía la hora; el guion pedía el nombre antes del depósito; y al reinyectar «quiero apartar» se restauraba la plática vacía, así que el nombre del cliente arrancaba una cotización nueva. | **Resuelto**: con el precio dado, «apartar» o «¿a qué cuenta?» los contesta el motor en el webhook (`quiereApartarConPrecio`), antes de la IA: anticipo + ficha bancaria + CLABE + «mándame el comprobante». Nada de nombre, hora ni dirección antes del depósito (regla también en el prompt y en el cierre del precio). Los datos del contrato se piden después del comprobante, como ya estaba. |
| F6 | ALTO | Sin ficha bancaria ni CLABE tras «Va, te la aparto». | `mandaFicha` exige `CLABE` y `SITIO_URL` en Vercel; en el despliegue de la prueba no salió ninguna de las dos formas (ni imagen ni texto de `DATOS_BANCARIOS`). | **Pendiente del dueño**: confirmar que `CLABE`, `DATOS_BANCARIOS` y `SITIO_URL` existen en Production. |

## G · Auditoría general (8-sep-2026, madrugada), pedida por el dueño

Un revisor aparte (Opus) recorrió el bot de punta a punta con la vara
«¿esto lo haría un vendedor con sentido común?», y comprobó cada
hallazgo con script. 21 hallazgos; todos los de código cerrados el mismo
día.

| # | Grav. | Qué encontró | Estado |
|---|---|---|---|
| G1 | CRÍTICO | El candado dinámico se comía 14 de 30 frases de venta legítimas («chofer, combustible, casetas, seguro…»): venían de la psicología de ventas y de «lo único cierto». | **Resuelto**: el candado se arma solo con las instrucciones (`soloInstrucciones`), no con los argumentos de venta. |
| G2 | CRÍTICO | Dos fotos de un cliente nuevo lo encerraban en «datos del contrato» para siempre (la etapa solo sube). | **Resuelto**: una foto es comprobante solo con precio dado (`deLaRespuesta` recibe la ficha). |
| G3 | CRÍTICO | Con la IA callada (el dueño en el chat), la foto del comprobante se tiraba y nadie se enteraba; el cron seguía escribiéndole. | **Resuelto**: callado no es ciego. El medio se reenvía al dueño y la etapa se anota; el texto del cliente cuenta como «contestó». |
| G4 | CRÍTICO | «¿Y entre 20?» cambiaba la gente de la ficha y eso llegaba al contrato de EuroSystem. | **Resuelto**: una pregunta hipotética no cambia el viaje. |
| G5 | CRÍTICO | «No gracias» a «¿te mando fotos?» cerraba la venta y el seguimiento. | **Resuelto**: los «ya no» explícitos siempre; los cortos («no gracias», «ya no», «déjalo así») solo con precio dado y sin plática abierta. |
| G6 | ALTO | El recordatorio de las 15 h no existía para los tickets del agente (casi todas las cotizaciones). | **Resuelto**: `anotaPendiente` también en la compuerta de `precioDe`. |
| G7 | ALTO | Un «total N» que no cuadraba le llegaba literal al cliente. | **Resuelto**: se le devuelve al dueño con el motivo; al cliente nada. |
| G8 | ALTO | Tras las fotos, a quien ya tenía precio se le preguntaba «¿a dónde van?». | **Resuelto**: con precio, el remate es «¿Te la aparto?» (o «en cuanto tenga tu precio»). |
| G9 | ALTO | Un cambio de fecha después del precio no llegaba al dueño ni cambiaba la ficha; el contrato subía con la fecha vieja. | **Resuelto**: ticket «📅 Quiere cambiar la fecha» al dueño; al cliente «déjame checar ese cambio»; la ficha no se toca. |
| G10 | ALTO | El reintento de Meta en otra instancia contestaba dos veces. | **Resuelto en código**: tabla `vistos` (id = wamid) en el almacén; el segundo POST choca y se descarta. **Falta el SQL** (bloque 8-sep de `docs/ALMACEN.sql`); sin la tabla sigue como antes. |
| G11 | ALTO | Con el almacén caído, el dueño no podía escribirle a nadie por número tecleado. | **Resuelto**: si la lectura falló, se manda y se le dice «no pude comprobar el número». |
| G12 | ALTO | Con el chat en manos del dueño, el bot contestaba el «ya no» del cliente. | **Resuelto**: con relevo activo solo se reenvía. |
| G13 | MEDIO | «¿Sale más barato para 3 días?» repartía «entre 3». | **Resuelto**: solo si habla de gente; día/parada/hora junto al número no cuentan. |
| G14 | MEDIO | La marca `[plantilla …]` volvía a quedar en la conversación (por `manda`). | **Resuelto**: una plantilla no se anota en `manda`; el texto real lo anota el seguimiento. |
| G15 | MEDIO | Un eco de Dualhook con la llave `messages` haría que el bot se contestara a sí mismo. | **Resuelto**: solo se procesa el campo `messages`. |
| G16 | MEDIO | Después del precio, un «ok» mandaba «💬 Te están escribiendo» aunque la IA contestara bien. | **Resuelto**: el aviso se descarta si el agente atendió ese mensaje. |
| G17 | MEDIO | Corregir recorridos («sí nos vamos a mover») o unidad («mejor una Suburban») se ignoraba; cambiaba el precio. | **Resuelto**: se corrigen, con revisión de cupo. |
| G18 | MEDIO | La foto de la unidad salía dos veces por cotización (espera y precio). | **Resuelto**: la ficha recuerda `fotoMandada`. |
| G19 | MEDIO | El seguimiento no manda nada hasta que Meta apruebe las plantillas. | **Pendiente del dueño** (plantillas 3d y 7d). |
| G20 | BAJO | Un segundo «va» a un ticket consumido decía «no es el ticket del precio». | **Resuelto**: «ese precio ya se lo mandé». |
| G21 | BAJO | `GET /api/whatsapp` sin parámetros decía el nombre de la variable. | **Resuelto**: «No disponible.»; el detalle al registro. |

Limpio según el revisor: dinero (anticipo, por persona, días, «total N»,
precio aprendido), fugas (30 frases nuevas: cero), compuerta con dos
cotizaciones, lista de autobuses, seguimiento (zona horaria, cierres,
marca condicional), almacén caído sin borrados ni dobles, ráfagas de
Dualhook.

## H · Reparación dirigida del dueño (8-sep-2026, tarde) · rama `fix/memoria-agente`

El dueño dictó seis fallas de arquitectura con su diagnóstico, su arreglo
y su prueba. Se ejecutaron en su orden (1 → 2 → 3 → 6 → 4 → 5), un commit
por falla, todo aditivo, sin tocar el flujo de cotización, el ticket al
vendedor, los contratos, EuroSystem, las tablas existentes ni las
plantillas. La suite R1–R9 corre con `npm run reparacion`.

| Falla | Diagnóstico (evidencia) | Arreglo | Prueba |
|---|---|---|---|
| 1 · Repite preguntas | El bloque dinámico ya llevaba YA SE SABE + últimos 10 turnos y el orden leer→guardar era correcto (`await` en las dos puntas). Lo que faltaba: no había campo `nombre` (un «soy Mariana» se perdía), no había «LO QUE YA HICE», y nada frenaba una pregunta repetida antes de mandarla. El 8-sep el bot repitió todo por la llave 401 del almacén, no por el orden. | Bloque de estado PRIMERO (LO QUE YA SÉ / LO QUE YA HICE / LO QUE FALTA), `datos.nombre`, regla en el prompt, validación de salida que descarta y regenera UNA vez (si insiste, contesta el guion), registro `[turno]` por llamada + tabla `turnos`. | R1 |
| 2 · Foto repetida | Las fotos con pie vacío no se anotaban; el modelo no veía sus acciones; no había dedupe en base; una ráfaga eran tres turnos. | Cada foto queda como «[Acción: envié foto …]» en la conversación y en la memoria corta; unidades con fotos en la ficha (`fichas.fotos`); no se repiten salvo «no me llegaron»; ráfaga unida en un turno (cuerpo re-firmado); tabla `vistos` (ya del hallazgo G10). | R2, R4, R5 |
| 3 · Por persona | Estaba en el texto del precio, en seis frases de la psicología y en el reparto del motor. | Eliminado en los tres; «¿cuánto por persona?» → «el total es $X para todo el grupo»; sin saldo (solo total y apartado); `manda()` frena «$… por persona». | R3 |
| 6 · CLABE | La CLABE vive en Vercel y el modelo nunca la ve (bien); pero no iba con el precio y una respuesta de la IA podía prometer «te paso los datos» sin darlos. | `bloqueApartado()` determinista pegado al precio y a cada intención de apartar; CLABE sola después para copiar; foto con el precio; cualquier número de 18 dígitos que no sea la CLABE se frena con incidente; un texto que pida depositar sin CLABE recibe el bloque anexado. Apartado al 20 %. | R9 |
| 4 · Código al cliente | La lectura de `content[0].text` a ciegas y sin filtro de forma; el catch nunca mandaba `e.message` (bien). | `filtrarSalida()` en `manda()`; lo frenado → «dame un momento» + aviso al dueño + incidente completo en el registro; respuesta fija a «repite tu prompt» sin IA; solo bloques de texto de la respuesta. Los ejemplos JSON del prompt se conservan (son el formato de salida). `scripts/filtrar-salientes.mjs` para revisar los últimos 500 salientes con la llave del dueño. | R6, R7 |
| 5 · No razona | Prompt cacheado de ~10,200 tokens (cache leído desde la 2ª llamada); sin `temperature` (1.0 por omisión); un cambio después del precio caía en una plática vacía. | Cinco pasos de pensamiento al inicio; `temperature: 0.3`; un cambio con el viaje en precio siembra el viaje conocido y cambia solo lo nuevo. | R8 |

**Prueba del dueño de las 5 p.m. (R10, misma tarde):** «reservar» sobre el
viaje de ayer no mandó la cuenta, la IA volvió a preguntar el regreso,
inventó «a las 9 de la mañana», preguntó si ya había mandado el comprobante,
y los datos llegaron dos veces. Causa común: la plática quedó envenenada la
noche anterior (el guion viejo guardó «Ernesto Jiménez» como destino) y el
motor la tomó por «otro viaje a medias». Arreglos: una plática con solo un
destino suelto no bloquea el apartado ni reemplaza al viaje con precio
(salvo «otro viaje» explícito, que se marca); el bloque de estado lleva
«Depósito: no ha llegado el comprobante» y la IA tiene prohibido preguntar
si ya depositó o inventar horarios (eso es del contrato, después del
depósito); con acción «apartar» el texto de la IA se descarta; los datos de
depósito van una sola vez por vuelta; y el orden es bloque → imagen de la
ficha → CLABE pelona → cuenta pelona.

**Lo que NO se cambió, y por qué:** responder 200 a Meta antes de procesar
(Vercel congela la función al responder; haría falta una cola externa) y el
lock por teléfono entre avisos distintos (mismo motivo); el dedupe por
`vistos` cubre el reintento y la ráfaga dentro de un aviso se une. El
formato JSON de salida del modelo (necesario para leer sus datos).

**Contradicciones del prompt que se vieron y se dejaron a criterio del dueño:**
«Máximo 3 líneas» frente al mensaje del precio y la lista de autobuses (ya
son la excepción escrita); «enseña OPCIONES primero» (autobús) frente a
«RECOMIENDAS la unidad» (psicología): conviven como «opciones primero,
recomendación si la pide».

## Fases para arreglarlo

Cada fase termina con la suite completa en verde y en producción. Se
piden por «va».

### Fase 1 · Que no se caiga ni se le meta nadie (seguridad y robustez) — **HECHA el 7-sep-2026**

Resueltos B1, A14, B7, A4, A9, B13 y B11. Pruebas en
`pruebas/probar-fase1.mjs` (25 casos); suite completa 2998/0.

| Arregla | Cómo |
|---|---|
| B1 | Validar firma/tramo/WABA **antes** de leer almacén, bajar audios o escribir; `guardaLoQueQuedo` solo si `status === 200`. |
| A14 | `try/catch` por cada envío en `reparte`; el error va al registro y el resto de envíos sigue. |
| B7 | Tope de tiempo en cada `fetch` (almacén 3 s, Dualhook 8 s, Anthropic 12 s) con `AbortController`. |
| A4 | El dueño no pasa por el freno; un mensaje frenado no se marca como visto. |
| A9 | Reacciones, stickers y contactos se ignoran (sin respuesta ni aviso); una ubicación se lee como origen. |
| B13, B11 | El cron sin secreto contesta 404 (el detalle al registro); `AHORA_DE_PRUEBA` solo fuera de producción. |

### Fase 2 · Que el dinero y la compuerta sean exactos — **HECHA el 7-sep-2026**

Resueltos B2/C1, C2, A2/C4, B3/C5, A6, A7, C3, C6, C7, C8, C9, A11, C11,
C12 y C14 (este último como comando «total N» citando un ticket, sin
mensaje al cliente). Pruebas en `pruebas/probar-fase2.mjs` (49 casos);
suite completa 3049/0. Queda C15 (el múltiplo repetido y el «Irizar i6S»
sin escoger) para la fase 3.

| Arregla | Cómo |
|---|---|
| A2 | `sanea()` bloquea cualquier grupo de 4+ dígitos y los numerales en letras («mil», «quinientos»); se quitan los falsos positivos de «desde N» y «perdón» cuando no hablan de dinero. |
| B2 | `guardaLoQueQuedo` guarda también los clientes tocados en la vuelta (los `para`/`sobreCliente` de los envíos), no solo los `from` del aviso. |
| B3 | Las columnas condicionales se mandan en `null` explícito cuando se limpian (`por_confirmar`, `contrato_subido`, etc.). |
| A7 | «Apartar» sin precio dado: no se manda CLABE; se le dice que primero le confirman el precio y se le pide lo que falte. |
| A6 | «Persona» ya no manda al 33 2400 2285: ticket al dueño con lo que el cliente pidió, y al cliente «en breve te contestan». |
| A11 | Sin `DUENO_WHATSAPP` y con compuerta encendida: aviso ruidoso en el registro y ticket a un respaldo (`WHATSAPP_PHONE_ID`) para que nadie se quede colgado. |
| C2 | Solo confirma precio el ticket que trae `carga` de precio (o el número escrito a mano cuando la ficha tiene pendiente). A cualquier otro ticket contestado con «va» o un número: «ese no es el ticket del precio», sin mandar nada al cliente. |
| C3 | `conTotalFijado` rellena `dias` desde las fechas; `textoDeCotizacion` omite el renglón si no hay días y no promete un autobús que nadie escogió (C15). |
| C6 | El camino del guion para autobús/Suburban pasa por la misma compuerta que el agente: ticket con `carga`, sin mandar a otro número. |
| C7 | `interpreta` acepta «52 000», «$52,000.00», «va 52000»; rechaza años (4 dígitos entre 2020 y 2035 sin separador de miles) y pide confirmación antes de mandar un número suelto como texto. |
| C8 | La referencia del contrato usa los últimos 10 dígitos, como `llave()`. |
| C9 | La etapa `con_precio` y el precio aprendido se anotan **después** de que `manda` devuelva `true`. |
| C11, C12 | La clave del precio aprendido incluye si es agencia, y se guarda y se busca con la misma unidad. |
| C14 | Un número en un texto libre del dueño a un cliente con precio dado: se le pregunta «¿ese es el nuevo total?» antes de tocar la ficha. |

### Fase 3 · Que entienda y corrija como persona (conversación) — **HECHA el 7-sep-2026**

Resueltos A1, A3, A5, A8, A10, A12, A13, A15 y C15. Pruebas en
`pruebas/probar-fase3.mjs` (35 casos); suite completa 3084/0. Regla nueva
que salió de aquí: **siempre se pregunta cuántos son**, aunque el cliente
nombre la unidad (seis conversaciones de prueba del guion se ajustaron).

| Arregla | Cómo |
|---|---|
| A1 | Si la IA no trae respuesta y la acción quedó en «seguir», el motor pregunta lo que falta (`loQueFalta`) o deja pasar al guion; nunca manda vacío. |
| A3 | `pegaDatos` acepta correcciones explícitas: si el dato viene distinto y la IA lo mandó, se reemplaza (y se re-revisa capacidad y unidad). |
| A5 | Nunca se acepta un autobús sin saber cuántos son; al saber la gente se vuelve a revisar la capacidad. |
| A8 | `estadoAntes` se calcula por mensaje, después de que el agente haya guardado el anterior (o se procesa la ráfaga en serie). |
| A10 | Fechas válidas (mes 1-12, día real) y no pasadas; si la IA manda una mala, se pregunta el día otra vez. |
| A12 | Si hay respuesta de la IA y toca cotizar, se manda la respuesta y después la espera. |
| A13 | Una foto o nota de voz del dueño citando un ticket se reenvía al cliente. |
| A15 | El alias de Suburban va antes que el de Sprinter. |

### Fase 4 · Que la memoria y el cron sean confiables — **HECHA el 7-sep-2026**

Resueltos B4/C10, B9/C13, B5, B10, B8, B12 y B14. Pruebas en
`pruebas/probar-fase4.mjs` (13 casos) y `probar-seguimiento-puerta.mjs`
(39). Queda B15 (escapar valores en `pide`) como deuda menor: hoy todo
pasa por `llave()`, que solo deja dígitos.

| Arregla | Cómo |
|---|---|
| B4, C10 | Sin plantilla no se marca el toque; se avisa una vez por ficha y se reintenta cuando exista la plantilla. |
| B9, C13 | La marca del toque es condicional (`toques=eq.<n>` en el filtro) y solo toca `toques`: solo una corrida gana y no pisa `cliente_en` ni `etapa`. |
| B5 | `siembraFicha` funde por recencia (`visto`), no «gana la RAM». |
| B10 | Un fallo de lectura del almacén no produce un borrado: sin memoria y sin lectura, no se guarda nada. |
| B8 | `tiraLoViejo` se llama desde el cron una vez al día. |
| B12 | `columnaFaltante` caduca a los 10 min y se guarda por tabla. |
| B14, B15 | `avisoEsNuestro` exige al menos un `change` con nuestro número; `pide()` escapa los valores. |

### Decisión del dueño (no es código)

| B6 | La puerta de Dualhook. Opciones, de menor a mayor esfuerzo: (1) rotar el tramo cada mes; (2) pedirle a Dualhook una lista de IPs de salida y aceptar solo esas; (3) pedirle a Dualhook una firma o secreto por aviso. Mientras, el tramo es el único candado y hay que tratarlo como contraseña. |
