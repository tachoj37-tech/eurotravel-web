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

### Fase 3 · Que entienda y corrija como persona (conversación)

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

### Fase 4 · Que la memoria y el cron sean confiables

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
