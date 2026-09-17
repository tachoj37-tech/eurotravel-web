# Un número, cuatro funciones — especificación (16-sep-2026)

Dictado del dueño en la sesión del 16-sep-2026, planeado antes de escribir
código. Esta es la referencia: lo que no está aquí, no se construye en esta
ronda.

## 1. El problema

El número real de Eurotravel (+52 33 1616 8587) vive en Kommo y ya está
verificado por Meta. Sacar otro número tardaría semanas y el dueño no
quiere partir su operación. Por ese único número tienen que pasar cuatro
cosas sin que se mezclen:

| # | Función | Dirección | Quién la dispara | IA |
|---|---|---|---|---|
| 1 | Cotización nueva | entra | cliente escribe | sí (el cerebro de hoy) |
| 2 | Mi cotización anterior | entra | cliente que ya cotizó y vuelve días o meses después | no |
| 3 | «Tu comprobante fue recibido con éxito» | sale | EuroSystem al aprobar el abono | no |
| 4 | Comprobante de abono (foto o PDF) | entra | cliente o agencia | no |

Solo las de entrada (1, 2, 4) pueden confundirse entre sí. La 3 sale de
EuroSystem por la API de Kommo: no es un mensaje del cliente y el Salesbot
no la ve.

Decisiones firmes del dueño:

- **Un solo número.** Ni segundo número, ni segundo bot, ni etiquetas a
  mano.
- **IA solo en la cotización nueva.** Las demás funciones son mensajes
  fijos y el bot se apaga.
- **Sin plantillas de Meta** por ahora (ver §7).
- **Que sea fácil hablar con una persona** (§5).
- **Funcional primero, mejoras después** (§8).

## 2. Orden en Kommo: el cerebro decide antes del saludo

Hoy el Salesbot abre con el saludo y sus botones, y el cerebro entra
después. Cambia el orden: **cada conversación nueva pasa primero por el
cerebro, callado**, que mira el mensaje y decide una salida; el saludo con
botones es una de esas salidas, no el arranque.

```
conversación nueva
  └─ cerebro (silencioso) decide:
       · foto/PDF (sin texto)          → acuse de comprobante (§4.4) y parar
       · «te mando el comprobante…»    → «Va, mándamelo por aquí 🙌», esperar la foto (§4.4)
       · solo un agradecimiento         → «De nada, quedo a tus órdenes…» y parar (§4.3)
       · cualquier otra cosa            → saludo con tres botones (§3)
```

Kommo solo pasa texto al cerebro; una foto llega con el mensaje vacío. Lo
primero del plan es una prueba de media hora con el número de pruebas para
saber si Kommo distingue foto de audio (ver §9). Si no distingue, el acuse
es neutro: «Recibido 🙌 Si es tu comprobante, en un momento lo revisamos y
te confirmamos por aquí. Si es otra cosa, escríbemela por texto.»

## 3. El saludo: tres botones, cada 24 horas

```
¡Qué tal! Estás con *Eurotravel* 🚐
Renta de autobuses y Sprinter para tu grupo.
¿Qué necesitas?
[Nueva cotización] [Mi cotización anterior] [Hablar con un agente]
```

Tres es el tope de botones de WhatsApp. El saludo sale cuando Kommo abre
una **conversación nueva**; para que un cliente que escribe al día
siguiente lo vuelva a ver, Kommo cierra sola la conversación a las **24 h**
sin respuesta (ajuste de Kommo en «Herramientas de comunicación», hoy en
«Nunca auto-cerrar»). Dentro de esas 24 h la plática sigue donde iba, sin
saludo repetido. El dueño puede cambiar el plazo desde Kommo sin código.

## 4. Las cuatro funciones

### 4.1 Nueva cotización (sin cambios)

El cerebro de hoy: EuroBot con Haiku, guion, ticket al llegar a la
cotización, nota «🤖 EuroBot · precio sugerido» en el lead, fotos por el
widget. Nada de esto cambia.

### 4.2 Mi cotización anterior (sin IA)

```
[Mi cotización anterior]
  → «Va 🙌 ¿La quieres con la misma fecha o con una fecha nueva?»
     [Misma fecha] [Fecha nueva]
       · Misma fecha → «Perfecto. Un agente se comunica contigo por aquí para
                        revisar tu cotización anterior y seguir con el pago 🙌»
                        → parar
       · Fecha nueva → «¿Para qué fecha sería?» (texto libre, una sola pregunta)
                       → «Anotado: {fecha}. Un agente se comunica contigo por
                          aquí para revisar tu cotización y seguir con el
                          pago 🙌» → parar
```

El bot no busca la cotización vieja ni revisa disponibilidad: eso lo hace
el vendedor, que tiene el chat y las notas del lead. Lo que el cliente
escoja queda como nota en el lead («cotización anterior · fecha nueva:
{fecha}») para que el vendedor no tenga que leer todo el chat.

### 4.3 El «gracias» después del aviso de pago (opción A)

Cuando EuroSystem (hoy el sistema viejo) manda «tu comprobante fue recibido
con éxito» y el cliente contesta, para Kommo es una conversación nueva.
Regla: si el mensaje es **solo un agradecimiento** («gracias», «ok»,
«listo», «perfecto», «va», 👍, 🙏 y parecidos, con o sin «muchas»), el
cerebro contesta:

> De nada 🙌 Quedo a tus órdenes para cualquier duda.

y se apaga. No dice que un agente se va a comunicar; el chat queda ahí para
el vendedor. Si el mensaje es otra cosa (una pregunta), sale el saludo con
botones y «Hablar con un agente» resuelve.

Esta regla vale **solo al abrir conversación**. A media cotización un
«gracias» lo sigue atendiendo la IA como hoy (ahí sí hay contexto). Antes
de dar por buena la regla se revisan todas las pláticas guardadas que
terminan en agradecimiento, para que la lista de palabras salga de cómo
escribe la gente y no de mi cabeza.

Cuando EuroSystem tome el envío del aviso, se agrega la **opción B**: en la
misma llamada a Kommo que manda el aviso, EuroSystem escribe en el lead un
campo «pago avisado el {fecha}»; el cerebro lo lee antes del saludo y, si
tiene menos de 48 h, contesta la frase fija a lo que sea que escriba el
cliente (gracias o pregunta). Queda como siguiente paso, no en esta ronda.

### 4.4 Comprobantes (sin IA)

- **Foto o PDF sin texto** → «Recibido 🙌 En un momento lo revisamos y te
  confirmamos tu pago por aquí.» → nota en el lead «comprobante recibido
  {fecha}» → parar. Sea quien sea: no se le pregunta a EuroSystem quién es
  (primera versión, la más simple y con menos error). Un cliente nuevo que
  mande foto para cotizar es rarísimo y el vendedor lo ve en el chat.
- **Texto que anuncia un pago** («te mando el comprobante», «ahí va la
  ficha», «ya hice la transferencia», «adjunto el depósito», «le mando el
  pago») → «Va, mándamelo por aquí 🙌» → esperar → la foto recibe el acuse
  de arriba → parar. Una pregunta («¿cómo hago el pago?») **no** entra
  aquí: pregunta, no manda; sigue al saludo.
- El vendedor registra el abono a mano en EuroSystem, como hoy. Otro lo
  aprueba. Al aprobar, sale la función 3.

### 4.5 El aviso de pago aprobado (función 3)

Hoy lo manda el sistema viejo. Cuando EuroSystem lo tome, sale por la API
de Kommo al chat del lead, con texto fijo:

> Tu comprobante fue recibido con éxito ✅ Abono de ${monto} al contrato
> {folio}. Saldo: ${saldo}.

Regla de WhatsApp que no se puede brincar: **sin plantilla aprobada, un
mensaje solo sale si el cliente escribió en las últimas 24 h.** Si el
comprobante llegó el viernes y se aprueba el lunes, el aviso no sale.
EuroSystem lo dirá en pantalla al aprobar: «No se pudo avisar por WhatsApp:
pasaron más de 24 h. Escríbele tú.» La plantilla de Meta queda pendiente
(§7) para cuando el dueño quiera.

## 5. Hablar con una persona, fácil

Dictado: «la primera respuesta que no entiendas o notes que el cliente está
siendo grosero porque está enojado, ofrécele hablar con alguien de verdad y
apágate».

- El botón «Hablar con un agente» está en el saludo y sigue como hoy:
  mensaje fijo y parar.
- En la cotización nueva, **a la primera** de estas dos señales el cerebro
  ofrece la salida:
  · no entendió el mensaje (la IA no supo qué contestar o repitió la misma
    pregunta), o
  · el cliente está molesto o es grosero (insultos, mayúsculas de enojo,
    «no me entiendes», «pásame con alguien», «esto es un bot»).
  Texto: «Perdón, no te estoy entendiendo bien 🙏 ¿Quieres que te atienda
  una persona? [Sí, con una persona] [Seguir por aquí]». «Sí» → «Va, en un
  momento te atiende alguien del equipo 🙌» → parar. «Seguir» → sigue la
  cotización.
- Sin segunda oportunidad: si vuelve a pasar, se pasa a persona sin
  preguntar.

## 6. Aprender cada semana, sin mezclar precios

- **Reporte semanal de precios**, no por WhatsApp: cada lunes, al abrir
  sesión, presento la lista de la semana (cada precio anotado con su
  viaje: zona de salida, destino, fechas, unidad, pasajeros, quién lo dio:
  motor o vendedor). El dueño contesta «sí» o el número bueno; lo que
  corrija se guarda como criterio en `docs/CRITERIO-DE-PRECIOS.md` y en el
  cerebro de precios. Un script (`npm run precios:semana`) arma la lista
  desde el almacén.
- **Sin mezclar.** Un precio solo se sugiere para el mismo viaje: misma
  zona de salida, mismo destino, misma unidad, mismos días (es la llave de
  `precios-aprendidos`, y ya funciona así). Los $10,000 de un Vallarta
  nunca aparecen en un Mazatlán. El reporte semanal lo enseña para que se
  compruebe.
- Los precios que el vendedor pone en la «Venta» del lead ya se aprenden
  (16-sep-2026); el reporte los incluye con la marca «vendedor».

## 7. Pendientes que NO entran en esta ronda

1. Plantilla de Meta para el aviso de pago fuera de 24 h (el dueño dijo que
   no, por ahora).
2. Opción B del «gracias» (campo «pago avisado» en el lead) — cuando
   EuroSystem tome el envío.
3. Que el bot registre el abono solo y pregunte de qué contrato es.
4. Aviso «tu contrato quedó aprobado» (misma tubería que la función 3).
5. Que el cerebro le pregunte a EuroSystem «¿quién es este teléfono?» para
   distinguir agencia / con contrato / nuevo.

## 8. Cómo se hace «flawless»

- Cada función lleva su prueba automática, comprobada en rojo (falla sin
  el cambio) y en verde.
- Cada función se prueba en vivo con el teléfono de prueba en el embudo
  PRUEBAS BOT antes de tocar el número real; el número real no se toca
  hasta que las cuatro pasen y el dueño diga «va».
- Nada de lo que hoy funciona en la cotización nueva se mueve (la batería
  completa sigue en 0 malas).
- Todo mensaje fijo sale de un solo archivo de textos, para que el dueño
  los cambie sin tocar la lógica.

## 9. Fases (cada una se aprueba antes de empezar la siguiente)

0. **Prueba de media hora en Kommo** con el número de pruebas: qué recibe
   el widget cuando llega una foto, un PDF y un audio; y confirmar que una
   conversación cerrada que revive dispara el Salesbot. Sin código.
1. **El cerebro decide antes del saludo** (§2) + saludo con tres botones
   (§3) + cierre automático a 24 h en Kommo.
2. **Mi cotización anterior** (§4.2).
3. **Comprobantes** (§4.4) y el «gracias» (§4.3), con la revisión de
   pláticas reales.
4. **Hablar con una persona, fácil** (§5).
5. **Reporte semanal** (§6).
6. **Función 3 en EuroSystem** (§4.5), cuando el dueño lo pida: envío por la
   API de Kommo, aviso en pantalla si pasaron 24 h.
