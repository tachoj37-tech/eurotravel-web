# Arranque para el siguiente chat · Bot de WhatsApp en Kommo (16-sep-2026)

Este archivo es el punto de partida del nuevo chat. Léelo completo antes de tocar nada.
Dueño: Ernesto Jiménez (Eurotravel, renta de autobuses y Sprinter con chofer, Guadalajara).
Todo en español. Él ve el Chrome ("de aquí te veo"): trabajar con clics reales, avisar antes de guardar.

---

## 1. Qué quiere el dueño (dicho por él, en este orden de importancia)

1. **Un bot que solo recolecte el viaje y termine en un ticket, sin precio.** El precio lo pasa una persona después. El bot se calla en cuanto manda el ticket.
2. **Bloques visuales en Kommo, no código.** Él quiere ver y editar cada bloque en el editor de Salesbot. Nada de «Paso personalizado (código)».
3. **El bot vive SOLO en el canal de pruebas** hasta que él diga. «Esa es la intención del canal de pruebas: probarlo y luego lanzarlo en el otro.» Cualquier mensaje que salga por el número real es un fallo grave.
4. **Fotos de las unidades** dentro del chat: 8 autobuses, cada uno con 3 fotos (primero la unidad completa, luego el interior, al final los detalles) y su video. Las unidades sin fotos propias usan las de su hermana y el bot lo dice (i6 51 → fotos del i6 47; Century 49 → fotos del Century 47).
5. **Audios**: que se transcriban con la IA de Kommo (plan Pro). Si no se entiende, pasa a persona.
6. **Agente de IA solo cuando el bot no entiende** (híbrido). Aún no está armado; ver §6.
7. **El vendedor debe tener a la mano** (plantillas de Kommo): las fotos de cada unidad, los datos de depósito, y el mensaje que pide los datos del contrato. Aún no hechas.

### El flujo que dictó
- Saludo con dos botones: **«Nueva cotización»** y **«Hablar con un agente»**. Texto: «¡Qué tal! Estás con *Eurotravel* 🚐 / Renta de autobuses y Sprinter para tu grupo. / ¿Qué necesitas? / Si ya cotizaste, quieres abonar o tienes otra duda, pícale al segundo botón.»
- **Destino**: texto libre, se guarda tal cual (nunca recortar «Bocas de Iguanas»).
- **Fechas**: texto libre, como las diga.
- **Unidad**: botones **[Autobús] [Sprinter] [Somos varios]**. Si escoge Sprinter (o cualquier unidad) NO se pregunta cuántos son. Si dice un número, se recomienda unidad (hasta 20 → Sprinter; 36+ → autobús; no hay nada de 21 a 35).
- **Autobuses**: no mostrar los 8 de un jalón; páginas con «Ver más». Cada uno: 3 fotos + video, y «Éste me late / Ver otro» (se puede ver otro las veces que quiera).
- **Origen**: **[Zona metropolitana de Guadalajara] [Otro → escribe la ciudad]**.
- **Movimientos**: **[Solo llevar y traer] [1 día] [2 días o más]**.
- **Ticket** sin precio y sin botones: «Perfecto, ya tengo todo tu viaje 📋 … En un momento te paso tu precio y la disponibilidad 🙌 ¿Todo bien?». Ahí el bot se para.
- **Nunca preguntar** ocasión, hora ni dirección: eso se pide al hacer el contrato, después del depósito.
- «Hablar con un agente» → «Va 🙌 Ahorita te contesta una persona por aquí mismo.» y se para.

---

## 2. Candados (no se negocian)

- **WhatsApp real** (+52 1 33 1616 8587, fuente `60430`, waba 1325977977265993): **NO TOCAR**. Ni canal, ni bots, ni el embudo «Embudo de ventas» (11114059), ni el agente de IA «Eurotravel asistente de ventas».
- **Canal de pruebas**: WhatsApp «Eurotravel PRUEBAS» +52 1 344 102 9307, fuente `60452`, embudo «PRUEBAS BOT» (14471195). Solo para pruebas; jamás se publica ese número.
- Lead de prueba del dueño: `26818280` (contacto «Tacho» 34531020).
- Token de Kommo en `eurotravel-web/.env.kommo` (KOMMO_SUBDOMINIO, KOMMO_TOKEN). **Nunca pegarlo en el chat.** Vence 2026-09-20.
- Preguntar antes de guardar/borrar en Kommo. Él borra sus leads; yo no toco sus datos.
- No mezclar con Nava ni Casa Franco. No abrir archivos de Euro en la ventana de VS Code de Nava.

---

## 3. Estado real hoy (16-sep-2026)

- Existe **EuroBot id 84528** (creado por mí hoy; el dueño nunca ha creado ningún «EuroBot»). Bots ajenos: «Bot de bienvenida» 83976 (sin disparador) y «NPS Bot» 83980 (suyo).
- Disparador del EuroBot: **«En un mensaje recibido desde WhatsApp Business (Eurotravel PRUEBAS) (pausa de un día)»**, verificado reabriéndolo. Solo ese canal.
- Los 41 mensajes del bot llevan `send_to_all_chat_sources: false` y `chat_sources: [{id: 60452}]`. En el editor, el bloque 1 dice «Canales: Eurotravel PRUEBAS» con solo esa casilla marcada. Los bloques 2–41 no muestran selector (Kommo solo lo pinta en el primero); el editor conserva los parámetros importados, pero **no lo he leído del servidor**. Pendiente: exportar el bot (lista → palomita → «exportar bot» → baja `EuroBot.json` a Descargas; **pedir permiso** para esa descarga) y contar 41/41.
- **Fallas que él reportó anoche con la versión anterior** (bot 84506, ya borrado): (a) le contestó también por el número real — causa: `send_to_all_chat_sources: true` copiado de los bots exportados; corregido en 84528. (b) **el ticket final no se mandó** — causa NO encontrada todavía; falta leer su conversación en Kommo (Chats o el lead 26818280) y ver en qué bloque se quedó. Hipótesis a revisar: el `goto` al bloque Parar (`type: 'finish'`), o que el bot se interrumpió.
- Fotos: 57 subidas al drive de Kommo, uuids en `docs/kommo-fotos.json`. Videos: no hay archivos (solo un Century de 25 MB en Descargas; YouTube «not available»); el dueño aceptó mandar liga.
- El bot de Vercel (eurotravel-web, Dualhook) está congelado en f55aba4; el número de prueba ya vive en Kommo.

---

## 4. Cómo se arma el bot (lo que sí funciona)

- Generador: `docs/arma-eurobot.mjs` (copia del que armó el 84528; no es el bot, es la herramienta que produce el archivo de importación). Se corre con `EVENTO_MENSAJE='{"source":"message_received"}' node docs/arma-eurobot.mjs <salida.json>`. Produce `EuroBot.json` con la forma `{type_functionality:0, model:{text, name:'EuroBot', positions, type:2}}`. Formato copiado de los bots exportados (`C:/Users/tacho/Downloads/Bot de bienvenida.json`).
- Se importa en Ajustes → Herramientas de comunicación → «Crear o **importar** un nuevo bot» (input oculto `.js-import-bot-input`, acepta .json). Kommo lo pinta como bloques editables.
- Reglas del modelo:
  - Un **Mensaje sin botones NO espera respuesta**. Después de cada pregunta libre va una **Pausa «Hasta recibir mensaje»**: texto `{"handler":"waits","params":{"logic":"or","conditions":[{"event":{"source":"message_received"},"action":{"step":N,"type":"question"}}]}}`; posiciones `handler:"wait"`, `params:{event:{source:"message_received"}}`, `links:[{block:id}]`.
  - Mensaje con botones espera solo; `answer.buttons` con `else` (Otra respuesta). WhatsApp: **máximo 3 botones**, **20 caracteres** cada uno, **una foto por mensaje**.
  - Parar: bloque `type:'finish'`, handler `_stop`; el `goto` que apunta a él lleva `type:'finish'`.
  - Canal: `send_to_all_chat_sources:false` + `chat_sources:[{id:60452}]` en cada `send_message`.
- Relanzar el bot en un lead para probar: `POST /api/v4/bots/run` `[{bot_id:84528, entity_id:26818280, entity_type:'leads'}]` → 202.
- Lo que NO funciona: armarlo a clics en el editor. El clic en «Agrega el siguiente paso» de una rama de botón siempre crea una Pausa (no abre la paleta). Los embriones de «Otra respuesta»/Condición sí la abren. La API no borra ni lee bots. El editor visual no escribe campos del lead (los campos 964464… existen pero el bot no los llena; el ticket va como texto).
- Automatizar Kommo: Claude in Chrome. Clics por `ref` de `find` son fiables; clics por coordenadas no. Diálogos de confirmación: botón «Si» es un `<span class="button-input-inner__text">` dentro de un `button-input`. La sesión de Kommo caduca: si sale «Autorización», que él inicie sesión (yo no meto contraseñas). Ojo: al marcar filas con checkbox por script, no tocar la fila «WhatsApp Business» de «Rastrear clics en links» (ya la desmarqué una vez por error).

---

## 5. Lo que sigue, en orden

1. **Que él pruebe** desde su celular con el número de PRUEBAS y diga qué llegó y por dónde.
2. **Exportar el bot** (con su permiso) y confirmar 41/41 con canal PRUEBAS.
3. **Leer su conversación** en Kommo y encontrar por qué no sale el ticket; corregir en el generador, reimportar (borrar el bot viejo primero, volver a poner el disparador solo PRUEBAS, verificar reabriéndolo).
4. Plantillas del vendedor: fotos por unidad, datos de depósito, mensaje de datos del contrato.
5. Audios y agente de IA (ver §6).
6. Solo cuando él diga «va»: pasar el bot al número real (cambiar `chat_sources` a 60430 y el disparador al canal real).

---

## 6. Agente de IA y audios (investigado, no armado)

- Ajustes → Kommo IA solo tiene Copilot, Respuesta sugerida y Sugerencias de tareas. **No hay botón de transcripción**: los audios los transcribe el **Agente de IA** (Pro, gasta créditos; tiene 7,250, usados 22). El Salesbot de bloques no entiende audios.
- El agente se activa por **canal + etapa de embudo** y solo responde a mensajes entrantes. Kommo no documenta cómo convive con un Salesbot en el mismo chat; «IA solo cuando el bot no entiende» no existe como bloque.
- Propuesta pendiente de su «va»: agente nuevo solo para el canal PRUEBAS y la etapa «Contacto inicial» del embudo PRUEBAS BOT; el EuroBot mueve el lead a esa etapa (bloque Acción → Cambiar etapa) al final del ticket y en «Hablar con un agente». No tocar el agente existente del número real.

---

## 7. Cómo hablarle

Directo y corto. Sin promesas sin evidencia («verificado» solo si lo leí). Cuando algo falla, decir la causa y el arreglo, no disculpas. Al cerrar una tarea, volver a listar los pendientes. Él se enoja cuando repito un error o cuando digo que probé algo que no probé en su número.

---

## 8. El widget EuroBot (paso del Salesbot que habla con el cerebro) · 16-sep, tarde

El dueño rechazó el bot de bloques (84528) y eligió **«A»**: el cerebro original de Vercel
(`api/whatsapp.mjs`, `BOT_HASTA_COTIZACION=1`) conectado dentro de Kommo por el paso
`widget_request` de un widget propio. Servidor listo y desplegado (commit f95ac30, ruta
`/api/whatsapp/kommo`, prueba `pruebas/probar-kommo-cerebro.cjs`, 24 buenas).

### El paquete
- Carpeta `pendiente/kommo-widget/` (manifest.json, script.js, i18n/es|en.json, images/).
- Se empaqueta con `node pendiente/zip-widget.mjs pendiente/kommo-widget pendiente/eurobot-widget.zip`
  (escritor de zip propio: Compress-Archive de PowerShell mete `\` en las rutas y Kommo lo rechaza;
  `tar -a` produce un zip inválido).
- **Lo que Kommo exige y no dice:** `tour.is_tour` tiene que ser `true`, con `tour_images`
  (una por idioma) y `tour_description` en i18n. Con `is_tour:false` la subida contesta
  `400 {"error":"Something went wrong"}` sin más pista. Con `settings:{}` contesta
  `"settings" field is required`. Probado con 14 variantes el 16-sep.
- Subida: integración privada «Claude Pruebas» (client id `a403066a-9dcc-4235-82da-d239e6a28ff1`,
  código de widget `gvyosimdwjwonyyexwyk5oyylewztfo8merzwskb`). La forma «Editar integración» manda
  `POST /ajax/widgets/<clientId>/widget/upload/?fileapi<ts>` con FormData `widget` (archivo) y
  `_widget` (nombre). Respuesta buena: `{"response":true,"langs":{…}}`. Ya subido el definitivo.

### Dónde quedó
- La tarjeta «Claude Pruebas» en Ajustes → Integración ya dice **«Instalar»** y muestra
  «El cerebro del bot de Eurotravel». Falta **instalarlo** (casilla «Acepto las políticas de
  privacidad de Claude Pruebas y otorgo acceso a la cuenta de Kommo» + botón Instalar): eso
  solo con el sí del dueño.
- Después: crear el Salesbot v3 en el editor: saludo con «Nueva cotización» / «Hablar con un
  agente» → paso **EuroBot (cerebro)** (url `https://eurotravel-web.vercel.app/api/whatsapp/kommo`)
  → salida success → Pausa «hasta recibir mensaje» → de vuelta al paso EuroBot; salida fail → Parar.
  Disparador solo «Eurotravel PRUEBAS» (60452). Borrar o apagar el 84528 (preguntarle).
- En Vercel faltan **KOMMO_TOKEN** y **KOMMO_SECRETO** (los pone él; yo no tecleo secretos).
  Sin KOMMO_TOKEN la ruta `/api/whatsapp/kommo` contesta 404.
- Por verificar en vivo: fotos por `send_message` con adjunto del drive dentro de
  `execute_handlers` (si no, cae a liga en texto), audios (llega sin texto → pide que lo escriba),
  y que el ticket cierre con `status: fin`.

---

## 9. Cómo quedó de verdad: Salesbot «EuroBot cerebro» (id 84562) · 16-sep, mediodía

El bloque de widget NO sirvió en el diseñador: Kommo pinta el bloque pero nunca
carga el script del widget en la página de bots (`AMOCRM.widgets.list` no lo
trae; el bloque sale vacío y truena `reading 'id'`). Probé `salesbotDesignerSettings`,
`init_once:true`, abrirlo desde el embudo: nada. Así que el cerebro va en un
**Paso personalizado (código)** con el mismo `widget_request`, que Kommo sí
acepta (se guarda como handler `widget_request` en el paso 3).

Flujo guardado (pasos del bot):
- 0 · Mensaje de saludo (solo canal Eurotravel PRUEBAS) con botones «Nueva
  cotización» y «Hablar con un agente». Botón agente → paso 2; cualquier otra
  cosa (incluido «Nueva cotización» y texto libre) → paso 3.
- 2 · Mensaje «Va 🙌 Ahorita te contesta una persona por aquí mismo.» → pausa de
  1 min (paso 5) y termina. (No dejó ponerle «Parar»: el menú de esa salida
  siempre auto-creaba una Pausa; funcionalmente es lo mismo.)
- 3 · Código: `{"handler":"widget_request","params":{"url":".../api/whatsapp/kommo",
  "data":{"from":"kommo","message":"{{message_text}}","lead_id":"{{lead.id}}",
  "contact_name":"{{contact.name}}","contact_phone":"{{contact.phone}}",
  "talk_id":"{{talk.id}}"}}}` → paso 4.
- 4 · Pausa «Hasta recibir mensaje» → de vuelta al paso 3.
- Disparador: «En un mensaje recibido desde Eurotravel PRUEBAS (con una pausa
  de un día)». La pausa de un día significa que, terminada una plática, el
  mismo lead no relanza el bot hasta el día siguiente (o hasta que se cierre la
  conversación). Para probar varias veces seguidas, bajar esa pausa.

Lo que hace el servidor con eso (`trabajoDeKommo`):
- Desde un paso de código el aviso llega SIN token: se acepta con el tramo
  interno y el `return_url` de la cuenta como candados (commit 02f8034).
- Cuando el cerebro termina (ticket o persona) manda `{"handler":"stop"}` en
  `execute_handlers` para que el bot pare ahí; si Kommo lo ignora, la pausa
  sigue esperando y el cerebro contesta callado (ficha en manos del dueño).

Falta del lado del dueño: `KOMMO_TOKEN` en Vercel (sin él, la ruta contesta 404
y el bot se queda mudo), y borrar el EuroBot de bloques (84528) para que no
contesten dos bots en PRUEBAS. `KOMMO_SECRETO` ya no es obligatorio.


### Corrección del paso 2 (16-sep, tarde)
- 2 · Mensaje «Va 🙌 Ahorita te contesta una persona por aquí mismo.» (solo canal
  PRUEBAS) + `stop`. El diseñador no dejó poner «Parar» (el menú de esa salida
  auto-creaba una Pausa) y además guardaba un `wait_answer` de vuelta al
  cerebro y `send_to_all_chat_sources:true`; se corrigió guardando el bot por
  `PUT /ajax/v2/salesbot/84562` con el mismo cuerpo que manda el diseñador
  (`{salesbot:{text, positions, …}}`), cambiando solo el paso 2. OJO: si se
  vuelve a guardar desde el diseñador, revisar que el paso 2 siga con `stop`.
  El «Sin respuesta» del saludo va a una pausa de 1 min (paso 5) y termina.

## 10. Cómo quedó de verdad (16-sep, noche): bloque de widget, no paso de código

Lo de §8–§9 quedó superado. Hallazgos, en orden:

1. **El paso de código (`widget_request` en «Paso personalizado») NUNCA llama
   al servidor.** Kommo lo guarda, lo cuenta como ejecutado (1/100 %) y no sale
   ninguna petición a Vercel. Camino muerto.
2. **El bloque de widget sí carga, pero solo después de guardar una vez los
   ajustes del widget** (Ajustes → Integraciones → «Claude Pruebas» → Guardar,
   aunque no se cambie nada: `POST /ajax/widgets/edit`). Antes de eso
   `AMOCRM.widgets.list` no lo trae y el bloque sale vacío (`reading 'id'`).
   Con eso, Widgets → + Agregar → «EuroBot (cerebro)» pinta sus dos salidas.
3. **Al guardar el bot, el diseñador manda dos cosas**: `POST
   /private/ajax/v2/json/salesbot/widgets/` con el `widget_source` que devuelve
   `onSalesbotDesignerSave` (widget_request + goto + conditions sobre
   `{{json.status}}` → exits success/fail), y luego `PUT /ajax/v2/salesbot/84562`
   con `text`/`positions`. El paso queda como `{"handler":"widget", params:{
   widget_id, widget_source_code, params:{url}, widget_instance_id, exits}}`.
4. **El `continue` de Kommo solo admite `show` (≤80 letras) y `goto`** en
   `execute_handlers`. Lo que dice el cerebro va en `data.texto` y `data.status`
   ('sigue'/'fin'); el bot lo pinta con un bloque Mensaje «{{json.texto}}»
   (commit 5e7af3f).
5. **El aviso del widget llegó a producción como formulario, no como JSON**
   («cuerpo ilegible» a las 21:13 UTC). `leeAvisoDeWidget` ahora acepta
   `application/x-www-form-urlencoded` con llaves `data[message]` o con `data`
   en JSON, y la primera puerta apunta content-type y tamaño (commit 1ddce9d).
6. **Guardar el bot por `fetch` con el cuerpo del diseñador** (replay del PUT)
   funcionó una vez, pero el clasificador de permisos lo bloquea; el diseñador
   con clics sí deja: clic en el círculo de una salida ya enlazada la
   desenlaza; «Ir a otro paso» lista los bloques por id; «Parar Salesbot» se
   guarda como `goto {type:'finish'}`.
7. **Relanzar el bot para probar**: `POST /api/v2/salesbot/run` con
   `[{"bot_id":84562,"entity_id":<lead>,"entity_type":2}]` (202). El de v4 no
   existe. La conversación de prueba es un «lead entrante» (unsorted) del
   embudo PRUEBAS BOT; su lead es el 26818280 (contacto 34531020).

Flujo guardado (pasos del bot 84562):
- 0 · Saludo (canal PRUEBAS) con botones. «Nueva cotización» → 6; «Hablar con
  un agente» → 2; cualquier otra cosa → 6.
- 2 · «Va 🙌 Ahorita te contesta una persona…» y termina (sin continuación).
- 6 · Widget EuroBot (cerebro), url `https://eurotravel-web.vercel.app/api/whatsapp/kommo`.
  Salida «sigue platicando» → 9; salida «terminó» → 7.
- 9 · Mensaje «{{json.texto}}» → 4.  ·  4 · Pausa «hasta recibir mensaje» → 6.
- 7 · Mensaje «{{json.texto}}» → Parar Salesbot.
- 5 · Pausa 20: huérfana, sin uso.
- Los Mensajes 7 y 9 van con `send_to_all_chat_sources:true` (el diseñador no
  ofrece el canal); como el disparador y el lanzamiento solo ocurren en
  PRUEBAS, no llegan a otro canal.

Pendiente de comprobar en vivo: que `{{json.texto}}` se pinte en el Mensaje
después del widget (Kommo documenta `{{json.*}}` para los pasos siguientes).

### §10 bis · lo que se aprendió después (16-sep, noche)

8. **El botón del saludo NO arranca el bloque de widget.** Estadísticas del
   diseñador: 4 saludos, «Nueva cotización» 100 %, widget 1 lanzamiento (el
   de la sesión que venía de la Pausa). Lo que sí lo arranca es la Pausa
   «hasta recibir mensaje». Por eso el flujo real es: botón/«otra respuesta»
   → Mensaje puente 32 («Va 🚐 Cuéntame: ¿a dónde van, para cuándo y
   cuántas personas?») → Pausa 12 → widget.
9. **La primera puerta reenvía como `text/plain`** (commit f1836d2): con
   `application/json` Vercel intentaba parsear el formulario y la segunda
   puerta recibía vacío.
10. **El `continue` exige ≥1 handler**: va `goto {question, step 1}`, el
    paso siguiente del propio widget (commit 40213d2).
11. **Fotos reales**: `data.fotos` (carpeta del drive) + `data.pie`; el
    widget 1.0.5+ trae un `send_message` con adjunto por carpeta detrás de
    `{{json.fotos}} = carpeta` (commit c51d3b1, tabla generada con
    `pendiente/kommo-widget/generar-fotos.mjs`). Tras subir un widget nuevo
    hay que VOLVER A GUARDAR el bot en el diseñador (con un cambio real; un
    arrastre no cuenta) para que se registre el `widget_source`.
12. **La Pausa traía un temporizador de 1 min sin salida**: al minuto sin
    respuesta el bot moría en silencio (sesiones activas 0 después de cada
    plática). Borrado (··· → Borrar en la fila del temporizador).
13. **Después del ticket el bot sigue vivo** (commit 46e35b9): el ticket
    lleva `pasaAPersona` pero eso ya no cuenta como «terminó»; así una
    corrección («14 al 17 de octubre») produce el ticket corregido. Si el
    cerebro no tiene nada que decir (`data.callado = si`) el widget 1.0.6
    sale por «silencio» → Parar, sin mensaje vacío.
14. **En el chat el i6 es «47 y 51» y el Century «47 y 49»** (bot.js,
    `unidadesParaElChat`); el catálogo del sitio no cambia.
15. Para relanzar en la conversación de prueba: detener la sesión desde la
    ficha del lead (Bots: 1 → ⏹) y `POST /api/v2/salesbot/run`. Leads de
    prueba: 26818280 (Ernesto) y 26838770 («Papá»).
16. «Rastrear clics en links» (ajuste global de la cuenta) acorta las ligas
    a kommo.cc, incluido el video de YouTube. No se tocó: decisión del dueño.

### §10 ter · fotos al elegir y orden de fotos (16-sep, tarde-noche)

17. **Al quedar una unidad en la plática salen sus 3 fotos + video, una
    vez** (`fotosDeLaUnidadRecienElegida` en whatsapp.mjs; commit 26119c5).
    Si ya las pidió o ya se mandaron, no se repiten (`fotosVistas` /
    `ficha.fotos`). Con el precio ya no va foto (ya las vio).
18. **Orden de las fotos**: `orden` en medios-unidades.js, revisadas una
    por una (exterior primero). Lo usan bot.js y el widget (1.0.7, tabla
    generada con generar-fotos.mjs). Al cambiar `orden` hay que regenerar
    la tabla, subir el widget y volver a guardar el bot (o registrar el
    `widget_source` con el POST a /private/ajax/v2/json/salesbot/widgets/).
19. **Subir el zip cuando el pegado en base64 falla**: el zip se sube al
    repo y el navegador lo trae de raw.githubusercontent.com (manda CORS);
    127.0.0.1 no se puede desde la página de Kommo.
20. **Lo que se anota para aprender**: en el almacén (Supabase) cada
    mensaje, cada ficha del viaje, cada turno de la IA y cada ticket. Lo
    que NO se anota en Kommo: el precio que el vendedor escribe en el chat
    de Kommo (el cerebro no lo ve); los precios aprendidos solo entran
    cuando el dueño contesta el ticket por WhatsApp con el «va».
21. **Persona ↔ bot desde Kommo**: en la ficha del lead, «Bots: 1» → ⏹
    detiene el bot y el chat queda con la persona; para volver a lanzarlo,
    en la caja del chat escribir «/» y elegir «EuroBot cerebro» (o el
    disparador con una conversación nueva).

### §10 quater · el debug de la noche (16-sep, con el «dale» del dueño)

Corrida con el modelo real por la puerta de Kommo (escenarios u, i, s, p de
`scripts/conversar-kommo.mjs`, $0.06 USD) + registro de Vercel de 12 h +
almacén. Lo que salió y lo que se arregló:

22. **Lista de autobuses con los asientos viejos.** A «somos 45» el modelo
    copió un ejemplo del prompt («Irizar i6 — 47 asientos»). Se corrigió el
    ejemplo y el guardia de la lista ahora también compara los asientos de
    cada renglón con el catálogo (commit 51f51c7).
23. **«4» contestando «¿cuántos van?» quedaba también como fecha** (salida 4
    de octubre) y **un rango escrito («14 al 17 de octubre») no movía la
    salida** porque el modelo veía «YA SE SABE: salida=…». Plática real del
    teléfono de «Papá»: el ticket salió «del 4 al 17 · 14 días». Ahora un
    número suelto tras «¿cuántos?» es gente, y un rango explícito del
    cliente manda sobre el estado.
24. **Lo que dice el bot por Kommo no se anotaba en `mensajes`** (solo lo
    del cliente). Ya se anota igual que por Meta.
25. **El almacén vence el tope (4 s) de vez en cuando**: cinco veces entre
    el 8 y el 16 de septiembre, y el caso visto de cerca fue el primer
    acceso de una instancia recién levantada (arranque en frío de la
    conexión, no la consulta). Ahora se reintenta una vez.
28. **Sin causa raíz, con paliativo documentado:** por qué Kommo no arranca
    el bloque de widget cuando se llega desde el botón del saludo (4
    saludos, botón 100 %, widget 1 lanzamiento) y sí desde la Pausa. Está
    dentro de Kommo y no se puede observar; el puente «Mensaje → Pausa →
    widget» es el rodeo. Si Kommo lo corrige algún día, se puede quitar el
    puente.
29. **Por Kommo no hay «va»: el ticket del precio va como nota del lead**
    (dictado del dueño, 16-sep-2026, «va, con cuidado»). El bot manda el
    resumen (con «Incluye:») y se para; el vendedor escribe el precio en
    el chat. El ticket con el calculado / la columna del Excel / el
    calendario, que iba al WhatsApp del dueño y por Kommo no llegaba a
    nadie, ahora se pega como nota interna en la tarjeta del lead
    (`POST /leads/{id}/notes`, `kommo.anotaEnLead`), sin el «contéstame
    con va» ni el número del cliente (`kommo.notaDeTicket`). Se arma
    aunque `DUENO_WHATSAPP` esté vacía (`destinoDelTicketEnKommo`). Solo
    los tickets de precio; el cliente no ve la nota. Si Kommo rechaza la
    nota, queda en el registro `[kommo-trabajo] nota del ticket … NO se
    pegó` y el bot sigue. **Pendiente de ver en vivo** con el teléfono de
    prueba: que el token de la integración tenga permiso de escribir
    notas (en pruebas se simuló Kommo).
30. **La nota es corta y trae TODOS los precios de Sprinter** («recuerda
    recomendar todos los precios de sprinter, esos ya los sabes»; «quiero
    que salgan en la recomendación de la nota»). Formato: encabezado «🤖
    EuroBot · precio sugerido», el viaje en un renglón, el precio y solo
    las advertencias que cambian el número (`kommo.notaDeTicket`). Para
    Sprinter a más de 1,400 km el motor sigue sin dar precio al cliente
    (R45), pero el ticket y la nota traen «Aprox. por la fórmula larga
    (±$9,800): $X» calculado con la bandera `estimaLargo` (R16, $36/km),
    que solo pone el ticket: las puertas públicas no la conocen y el
    candado del criterio manda sobre ella (`probar-precio-al-vendedor`).
31. **Los precios que el vendedor pone en Kommo se aprenden** («los
    precios futuros anótalos»). El bot no ve lo que el vendedor escribe
    en el chat; lo que sí lee es la tarjeta del lead. El cron del
    seguimiento (cada 15 min) pide los leads tocados en las últimas 24 h
    (`kommo.leadsConVentaReciente`, solo lectura); si un lead trae
    **«Venta»** (`price`) —o el campo «Precio cotizado» si
    `KOMMO_CAMPO_PRECIO` está puesto— y el teléfono de su contacto tiene
    ficha del bot con viaje, el precio se guarda en el almacén como
    fijado por una persona, con el calculado del motor al lado
    (`api/_kommo-aprende.js`). Sin repetir (mismo total ya fijado para
    ese viaje no se vuelve a guardar; un total distinto sí, es
    corrección), y nunca frena al seguimiento. **Para que aprenda, el
    vendedor pone la Venta en el lead al cotizar.** Se ve en el registro
    como `[kommo-aprende] lead … · $…`.
32. **EuroBot v2 (id 84646) es el bot vivo en PRUEBAS desde el 17-sep-2026**
    (spec `docs/ESPEC-UN-NUMERO-CUATRO-FUNCIONES.md`). El viejo 84562
    quedó sin disparador. Widget 1.0.8 con siete salidas: las tres de
    siempre más saludo / comprobante / espera / denada, que el widget
    toma por `{{json.modo}}` (solo las contesta la puerta,
    `…/kommo-puerta`). El bot se genera con
    `scripts/arma-bot-kommo-v2.mjs` (24 bloques: puerta → saludo de tres
    botones / comprobante / espera / de nada; cotización nueva con el
    cerebro; «Cotización anterior» con misma fecha / fecha nueva sin IA)
    y se importa por `.js-import-bot-input`; al guardar, Kommo cambia los
    `widget_instance_id`, así que hay que exportar el bot guardado
    (botón export, capturando el blob) y registrar los `widget_source`
    con esos ids (POST `/private/ajax/v2/json/salesbot/widgets/`; con
    otros ids contesta «Widget not found»). Disparador: «En un mensaje
    recibido desde Eurotravel PRUEBAS (con una pausa de un día)», que es
    el saludo cada 24 h. Verificado: `POST /api/v2/salesbot/run` con
    bot 84646 → `[kommo-puerta] lead 26818280 · saludo` en Vercel y el
    saludo «Entregado» en el chat del lead. Con el modelo real
    (`scripts/conversar-kommo.mjs q m b`): puerta, enojo y cotización sin
    fallas ($0.033 USD).
33. **Simulación de 30 clientes con el modelo real (17-sep, «simula,
    simula, simula», presupuesto $1 USD, gastado ≈ $0.90).** Escenarios
    x1–x20 y y1–y10 de `scripts/conversar-kommo.mjs`: faltas de
    ortografía, abreviaturas, agencias, cambios a media plática, enojo,
    comprobantes, dos Sprinters, cancelación, inglés, «cotización
    anterior» a mano. Lo que se corrigió, cada uno con prueba automática
    (probar-agente / probar-puerta-kommo / probar-kommo-cerebro):
    disponibilidad afirmada por la IA → «te la confirmo con el equipo»;
    número suelto con la fecha sabida = gente; «somos 15» tras el
    resumen = ticket corregido (la unidad se queda si caben); con los
    seis datos se cotiza aunque la IA charle; «¿tienen baño?» se contesta
    sin listar la flota; «ya deposité, ahí les mando el comprobante» →
    «mándamelo» y el bot sigue vivo; enojo → persona y el bot se apaga;
    «solo ida» en resumen y ticket; dos o más unidades y «retomar mi
    cotización» → persona; cancelación → el bot se apaga; factura y
    descuentos no se afirman. Cada conversación nueva (saludo de la
    puerta) empieza de cero: el viaje anterior se archiva en `viajes` y
    queda una marca en `mensajes` para la memoria de la IA.
    **Lo que sigue sin poder probarse sin el teléfono:** que Kommo lance
    el bot cuando llega una foto el mismo día (disparador «con una pausa
    de un día»); si no, cambiar a «cuando se inicia un chat por mensaje
    entrante».
26. Aviso que sigue: `KOMMO_SECRETO` no está en Vercel, así que el token
    del widget no se comprueba (el candado es el tramo interno + el
    return_url de la cuenta). Si el dueño quiere, se pone la llave secreta
    de la integración «Claude Pruebas» en Vercel.
27. `charlas` en 0 no es falla: la plática se borra al salir el ticket.
