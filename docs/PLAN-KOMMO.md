# El bot pasa a Kommo · plan por fases

Decidido el 13-sep-2026, después de dos pruebas del dueño desde su número
que fallaron en cosas «ya probadas». El bot de dos cerebros (guion de
reglas + IA) se deja de parchar. Se arma en **Kommo, con Salesbot**, que ya
está pagado (**plan Pro** desde el 15-sep-2026: WhatsApp ilimitados, así que
el número de prueba entra sin quitarle cupo a nada), y se prueba con frases
reales antes de declarar nada listo.

**Lo que hace el bot, sin cambios:** saluda, junta los datos del viaje y
manda el ticket. No da precio. Todo lo demás lo atiende una persona, en el
mismo chat.

**Regla de todo el plan:** ninguna fase se da por terminada sin su prueba.
Mientras no haya prueba, se dice «falta probar», no «listo».

---

## Fase 0 · Acceso y cómo está Kommo hoy

| Quién | Qué |
|---|---|
| Dueño | Llena `.env.kommo` con el subdominio y el token (los pasos vienen en el archivo). Abre Kommo en su Chrome con su sesión. |
| Claude | Lee Kommo por Chrome y por el token, **sin cambiar nada**: embudos, etapas, campos del lead, canales conectados, usuarios y si ya existe algún Salesbot. |

**Entregable:** un reporte corto de cómo está la cuenta y qué falta.
**Terminada cuando:** el token contesta y el reporte está revisado por el dueño.
**Costo:** $0.

### Resultado (13-sep-2026, solo lectura por token)

- Cuenta `direccioneurotravelcommx` · México · MXN · español. Token de prueba **vence el 20-sep-2026**.
- Usuarios: 2 — Ernesto Jimenez (admin) y Alma Martinez.
- Un embudo, «Embudo de ventas»: Incoming leads → Contacto inicial → COTIZACION → Logrado con éxito / Venta perdido.
- Campos del lead: **ninguno propio** (solo los de rastreo: utm, fbclid…). Los del ticket hay que crearlos (fase 3).
- Canales con chats: **WhatsApp oficial (waba) 17**, Facebook 2, WhatsApp por QR 1. Chats desde el 8-sep, el último el 13-sep. El widget de WhatsApp está activo. **Ya entran clientes reales.**
- Webhooks: ninguno. Etiquetas: ninguna.
- **El API no entrega el texto de los mensajes**, solo que hubo un mensaje. Para leer lo que escribió el cliente: Chrome o exportación. Para las pruebas se revisa lo que el Salesbot guarde en los campos del lead.
- Por token no se ve: qué número está conectado, ni si hay Salesbots. Se revisa en Chrome.

## Fase 1 · Aprender cómo escriben los clientes de verdad

| Quién | Qué |
|---|---|
| Dueño | Exporta 30–50 chats reales de WhatsApp Business (chat → ⋮ → Más → Exportar chat → **Sin archivos**) y los guarda en `eurotravel-web/chats-reales/` (no se sube a GitHub). |
| Claude | Exporta a CSV lo que ya guardó el almacén (tabla `mensajes`) y analiza todo junto. |

**Entregables:**
1. `docs/COMO-ESCRIBEN-LOS-CLIENTES.md`: las formas reales de decir fechas, cantidades, destinos y unidad; los destinos más pedidos; qué preguntan antes del precio.
2. **El banco de pruebas**: cada frase real con lo que debe quedar en el lead (ejemplo: «15 a 20 de sept» → salida 15-sep, regreso 20-sep).

**Terminada cuando:** el banco tiene al menos 100 frases y el dueño lo revisó.
**Cuidado:** son datos de clientes. Se quedan en Eurotravel.
**Costo:** $0.

## ⛔ El WhatsApp oficial que ya está en Kommo NO SE TOCA

Dictado del dueño, 13-sep-2026: «es el que se está usando ahorita, NO LO
TOQUES, ahí va a vivir el bot después de probarlo… no quiero que te
equivoques con un cliente real».

- Nada se activa, conecta, desconecta ni cambia en ese canal hasta la fase 8.
- Ningún Salesbot corre en el embudo donde entran sus clientes («Embudo de ventas»).
- Todas las pruebas van por el **número de prueba**, en un **embudo aparte**.
- En «Embudo de ventas» ya hay un **agente de IA de Kommo** («Eurotravel asistente de ventas», dos disparadores por mensaje recibido; uno con aviso rojo). El dueño no sabe quién lo configuró. **Se deja como está** hasta la fase 8, donde el bot probado lo reemplaza. Al conectar el número de prueba, revisar que ese agente **no** lo tenga entre sus canales.
- Claude solo lee. Cualquier cambio en Kommo se pregunta antes, uno por uno.

## 🔒 El número de prueba es SOLO para pruebas

Dictado del dueño, 15-sep-2026: «no me gustaría que dentro de ninguna
circunstancia algún cliente actual acceda a este número por algún error».
Es un WhatsApp Business nuevo, sin Meta y sin chats. Candados:

1. **No se publica en ningún lado:** ni la página (`bot.js`, `index.html`, `api/_correo.js`), ni el perfil de Google, ni anuncios de Meta, ni firmas de correo.
2. **Su nombre de perfil dice que es de prueba** («Eurotravel PRUEBAS · no atiende clientes»), por si alguien lo llegara a ver.
3. **Solo alimenta a «PRUEBAS BOT».** No se agrega como fuente de «Embudo de ventas».
4. **Nadie responde a un cliente real desde él:** en Kommo, el canal se restringe al usuario del dueño (si Kommo lo permite; si no, se le avisa al equipo), y en cada chat real se revisa que el remitente sea el número real.
5. **No entra a difusiones** (Broadcasting) ni a ningún Salesbot o agente fuera de «PRUEBAS BOT».
6. **El agente de IA viejo no lo tiene** entre sus canales.
7. **El «cliente» de prueba no es un contacto real:** antes de probar, se revisa por token que el WhatsApp que escribe como cliente no exista como contacto en «Embudo de ventas» (si existe, Kommo podría pegar la prueba a ese lead real).
8. **Al terminar las pruebas** (fase 8) se decide si se desconecta o se queda solo para pruebas futuras.

## Fase 2 · El número de prueba entra a Kommo, aislado

| Paso | Quién |
|---|---|
| 0. Verificar en Kommo, antes de todo, que la cuenta acepta un **segundo** número de WhatsApp y que cada número puede mandar sus leads a un embudo distinto. Si no se puede, parar y replantear (otra opción: una cuenta de Kommo de prueba aparte) | Claude, leyendo en Chrome y la documentación |
| 1. Crear el embudo **«PRUEBAS BOT»**, separado del de ventas | Dueño (o Claude con permiso) |
| 2. Desconectar el número de prueba en Dualhook | Dueño |
| 3. Conectar el número de prueba como canal **nuevo**, con sus leads al embudo «PRUEBAS BOT». Si Kommo ofrece conexión oficial y por QR, **parar y revisarlo juntos** | Dueño + Claude |
| 4. Confirmar que un mensaje al número de prueba cae en «PRUEBAS BOT» y **no** en «Embudo de ventas», y que el canal oficial sigue igual | Claude, en Kommo |

**Consecuencia sabida:** el bot actual deja de contestar en ese número. El
dueño dijo que ese número no importa.
**Terminada cuando:** un mensaje de prueba aparece como lead en Kommo.

## Fase 3 · El lead guarda el ticket

Los campos que el Salesbot va a llenar, para que el vendedor cotice leyendo
solo el lead:

- Destino · Origen (¿zona metropolitana de Guadalajara?) · Salida · Regreso
- Días · Personas · Unidad · Días de movimiento allá · Ocasión
- **Precio cotizado** (lo llena el vendedor; de aquí aprende el cerebro)

Y las etapas del embudo (se revisan contra lo que salga en la fase 0).

| Quién | Qué |
|---|---|
| Claude | Propone la lista final de campos y etapas. |
| Dueño | Aprueba. Los crea él con guía, o Claude en su Chrome **pidiendo permiso antes de guardar cada cosa**. |

**Terminada cuando:** los campos y las etapas existen y el token los lee.

### Resultado (15-sep-2026)

Creados por token, con el «va» del dueño. Son de toda la cuenta: también
aparecen vacíos en «Embudo de ventas», sin estorbar.

| id | Campo | Tipo | Quién lo llena |
|---|---|---|---|
| 964464 | Destino | texto | bot |
| 964466 | Origen | lista (ZMG / Otra ciudad) | bot |
| 964468 | Fecha de salida | fecha | bot |
| 964470 | Fecha de regreso | fecha | bot |
| 964472 | Personas | número | bot |
| 964474 | Unidad | lista (10 unidades) | bot |
| 964476 | Dias con movimientos alla | número | bot |
| 964478 | Ocasion | texto | bot, **solo si el cliente lo dice**: nunca se pregunta |
| 964480 | Precio cotizado | número | vendedor |
| 964482 | Anticipo | número | vendedor |

**Hora de salida y dirección de recolección NO se piden**: eso es del
contrato, ya con el depósito hecho (dictado del dueño, 15-sep-2026).

Y el recordatorio del mismo día: **el bot llega a la cotización y
desaparece**. Nada de apartados, comprobantes ni contratos por ahora.

## Fase 4 · El Salesbot en papel

Antes de tocar el editor, el flujo completo por escrito, con los textos
exactos:

1. «¿Qué necesitas?» → **Cotizar un viaje** · **Hablar con alguien**
2. Hablar con alguien → se asigna a un vendedor y el bot se detiene.
3. Cotizar → destino (botones con los más pedidos + «Otro, lo escribo»)
4. Fechas (decisión del dueño: escritas o guiadas paso a paso)
5. Personas → la unidad que les queda (Sprinter hasta 20; si no, autobuses)
6. ¿Salen de la zona metropolitana de Guadalajara? Sí / No
7. ¿Se mueven allá con la unidad? Sí (cuántos días) / No
8. **El ticket**: el resumen, «En un momento te paso tu precio» y «¿Todo bien?». Sin botones.
9. El bot se apaga cuando el cliente contesta al ticket o cuando un vendedor escribe.

**Decisiones que solo toma el dueño:** cómo se piden las fechas, qué destinos
van en botones y qué pasa si el cliente escribe algo que no es botón.
**Entregable:** el diagrama y los textos. **Terminada cuando:** el dueño lo aprueba.

## Fase 5 · Armar el Salesbot en Kommo

En el editor de Kommo, **sin código**. Lo arma Claude en el Chrome del dueño
(con permiso antes de guardar y publicar) o el dueño con guía paso a paso.
El Salesbot se activa **solo en el embudo «PRUEBAS BOT»**. En «Embudo de
ventas» no se activa nada hasta la fase 8.

## Fase 6 · Pruebas con el banco

Cada ronda:
1. Claude pasa la lista de frases del banco.
2. Alguien las manda desde **otro teléfono** al número de prueba (Claude no escribe por WhatsApp).
3. Claude revisa en Kommo, lead por lead, y reporta cuáles quedaron bien y cuáles no, con la frase exacta.
4. Se corrige el Salesbot y se repite.

**Terminada cuando:** el banco completo pasa: las fechas y las personas al
100 %; lo demás, sin errores que cambien el precio. Hasta entonces no se
dice que funciona.
**Costo:** $0 de IA.

## Fase 7 · IA solo para lo escrito (solo si la fase 6 lo pide)

Si en las pruebas las fechas o las cantidades **escritas** fallan y los
botones no alcanzan, se agrega Sonnet 5 únicamente para leer ese texto
libre, conectado desde Kommo. Aquí sí hay código, y se decide con los
resultados de la fase 6 en la mano.

**Costo estimado:** $15–25 USD al mes con 400 pláticas (todo con IA serían
≈ $48 USD).

## Fase 8 · Pasar a producción

1. El número real **ya está en Kommo**. Con el «va» del dueño, el Salesbot probado se copia al «Embudo de ventas». Primero en un horario de poco movimiento y con alguien viendo los chats.
2. Se apaga Dualhook en el orden de `docs/PASAR-EL-BOT-A-KOMMO.md` y se cancela el webhook.
3. Se apaga el bot de WhatsApp en Vercel. La página sigue igual.
4. El seguimiento de 22 h se revisa en Kommo, **sin plantillas pagadas de Meta**.
5. **La dirección del sitio va a cambiar** (hoy `eurotravel-web.vercel.app`; después el dominio propio). Al cambiarla, revisar en Kommo todo lo que la tenga escrita: la URL de redirección de la integración «Claude pruebas» (no afecta al token, pero se actualiza), y cualquier webhook o widget que apunte al sitio.

**Terminada cuando:** un cliente real llega al ticket y el vendedor lo cotiza desde Kommo.

## Fase 9 · Aprender de cada mes

- El «Precio cotizado» de los leads se pasa al cerebro de precios (exportación de Kommo o por token).
- Cada frase que falle con un cliente real entra al banco de pruebas.
- Una revisión al mes: qué falló, qué se agregó al banco, qué precios se aprendieron.

---

## Lo que queda en pausa mientras tanto

- **El bot actual en Vercel:** no se le agregan cambios. Solo se corrige si algo cobra o promete mal.
- **La página web:** sigue en su propia sesión, sin cambios por este plan.

---

## 15-sep · El bot ya vive como bloques (EuroBot, id 84506)

- Se arma con `arma-eurobot.mjs` (fuera del repo, en el scratchpad de la sesión) → `EuroBot.json` con `text` + `positions`, y se importa en Ajustes → Herramientas de comunicación → «Importar». Kommo lo pinta como bloques estándar (Mensaje, Pausa, Parar) que se editan a mano.
- Lección: un Mensaje sin botones NO espera respuesta; después de cada pregunta libre va una Pausa «Hasta recibir mensaje» (`{"source":"message_received"}`). WhatsApp: 3 botones por mensaje, 20 caracteres cada uno, una foto por mensaje.
- Flujo: saludo (Nueva cotización / Hablar con un agente) → destino → fechas → unidad (Autobús / Sprinter / Somos varios) → autobuses en páginas de 2 + «Ver más», cada uno con 3 fotos y «Éste me late / Ver otro» → origen (Guadalajara y ZMG / Otra ciudad) → movimientos → ticket sin precio → Parar.
- Disparador: «En un mensaje recibido desde WhatsApp Business (Eurotravel PRUEBAS), pausa de un día». Solo el número de prueba; el real sigue intocable.
- El editor visual no escribe campos del lead: el ticket va como texto y el vendedor lee el chat. Los campos de la fase 3 quedan para cuando se decida usar código otra vez o una Acción de Kommo.
- Relanzar en un lead para probar: `POST /api/v4/bots/run [{bot_id:84506, entity_id:<lead>, entity_type:'leads'}]`.
