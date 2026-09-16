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
- Saludo con dos botones: **«Nueva cotización»** y **«Hablar con un agente»**. Texto: «¡Qué tal! Estás con *Eurotravel* 🚐 / Camionetas y autobuses con chofer para tu grupo. / ¿Qué necesitas? / Si ya cotizaste, quieres abonar o tienes otra duda, pícale al segundo botón.»
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
