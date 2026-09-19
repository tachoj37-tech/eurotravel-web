# WhatsApp al cliente por Kommo (camino B)

**18-sep-2026.** El dueño eligió el camino B: **todo por el número de Kommo**, un
solo WhatsApp para el cliente. La cuenta de Meta ya está verificada.

Esto cambia dónde se dan de alta las plantillas y cómo salen los mensajes.
Sustituye a `META-COMO-APROBAR.md` en lo que se contradiga; ese documento queda
como referencia del camino A, por si algún día se separa.

---

## Cómo queda el circuito

```
Cliente paga en la página
        ↓
  webhook de Stripe  (ya existe, ya verifica que el pago esté de verdad)
        ↓
  contrato en EuroSystem + correo al cliente   ← ya funciona hoy
        ↓
  Kommo: buscar o crear el contacto por su teléfono
        ↓
  escribir folio, montos y liga del contrato en sus campos
        ↓
  lanzar el Salesbot que manda la plantilla aprobada
        ↓
  el cliente recibe el WhatsApp desde el número de siempre
```

---

## Lo que hace el dueño en Kommo

Las plantillas **NO se crean en Meta**, se crean dentro de Kommo y Kommo las
manda a aprobar:

**Kommo → Automatizaciones → Plantillas → Plantillas de chat → Crear**

Para cada una:
1. Elegir el canal de **WhatsApp Business**.
2. Escribir el texto (los cuatro textos están en `PLANTILLAS-AL-CLIENTE.md`).
3. Marcar los **marcadores de posición** (las variables) y **dar un ejemplo de
   cada uno**. Sin ejemplos, Meta la rechaza.
4. Guardar y mandar a revisión.

**Tiempo de aprobación: de un minuto a 48 horas.** Mientras está «En revisión»
no se puede editar.

### Los cuatro nombres

| Plantilla | Cuándo sale |
|---|---|
| `contrato_listo` | cuando aparta y se genera el contrato |
| `pago_recibido` | cada abono que entra |
| `pago_revertido` | cuando el banco regresa el dinero |
| `saldo_pendiente` | recordatorio antes del viaje (opcional) |

---

## Tres asperezas del camino B, dichas de frente

**1 · El contrato va como liga, no como archivo adjunto.**
Las plantillas de chat de Kommo permiten variables, pero no documentan un
adjunto de PDF. Así que el contrato viaja como **enlace** dentro del mensaje.
La página ya genera esa liga firmada, así que no es trabajo extra, pero el
cliente tiene que picarle en vez de recibir el archivo. Por correo sí le llega
el PDF, como hoy.

Por eso el texto de `contrato_listo` cambia: en lugar de «te dejo tu contrato
aquí arriba», dice «aquí está tu contrato: {{liga}}».

**2 · Un solo bot a la vez por contacto.**
Kommo no deja lanzar un Salesbot si ya hay otro corriendo para el mismo
contacto. Si el cliente está justo a media plática con EuroBot y en ese momento
entra su pago, el aviso **puede no salir**. El correo sí sale siempre, así que
no se pierde la noticia, pero hay que saberlo. Lo dejo registrado para que,
cuando pase, se vea en la bitácora y no parezca un misterio.

**3 · El token de Kommo vence el 20 de septiembre.**
Es pasado mañana. Hay que renovarlo, y de preferencia pasar a OAuth con
refresco automático para que no se caiga cada tanto. Sin token, no hay avisos
por WhatsApp.

---

## Lo que necesito yo para conectarlo

1. Los **nombres exactos** de las cuatro plantillas, ya aprobadas.
2. El **ID del Salesbot** que manda cada una (se ve en la dirección del
   navegador al abrir el bot, o en `data-id`).
3. Los **nombres de los campos personalizados** donde se van a escribir folio,
   montos y liga, o permiso para crearlos.
4. El **token de Kommo vigente** → va en Vercel, nunca en el chat:

```
KOMMO_SUBDOMINIO       el subdominio de la cuenta
KOMMO_TOKEN            el token vigente
KOMMO_BOT_CONTRATO     id del salesbot de contrato_listo
KOMMO_BOT_PAGO         id del salesbot de pago_recibido
KOMMO_BOT_REVERTIDO    id del salesbot de pago_revertido
```

Sin esas variables el código **no manda nada** y no se queja: todo sigue
saliendo por correo, como hoy.

---

## Lo técnico, para que quede asentado

- Lanzar un bot: `POST /api/v2/salesbot/run` con `bot_id`, `entity_id` y
  `entity_type` (1 contacto, 2 lead). Contesta 202. Tope de 100 bots a la vez.
- La **Chats API** de Kommo **no sirve** aquí: es para canales que uno mismo
  registra, no para el WhatsApp que Kommo administra. Ese fue el motivo de
  descartar mandar el mensaje «a mano» por API.
- El número real de Kommo tiene clientes de verdad. Nada de pruebas ahí: se
  prueba en el canal «Eurotravel PRUEBAS» y solo al final se mueve al real.

---

## Orden

| Paso | Quién | Cuánto |
|---|---|---|
| 1 · Renovar el token de Kommo | dueño | 10 min · **vence el 20-sep** |
| 2 · Crear las 4 plantillas en Kommo | dueño | 30 min + hasta 48 h de revisión |
| 3 · Crear los Salesbot que las mandan | dueño + Claude | 1 h |
| 4 · Pasarme nombres, ids y token (en Vercel) | dueño | 10 min |
| 5 · Conectar el webhook a Kommo | Claude | con pruebas |
| 6 · Probar en el canal de PRUEBAS | los dos | 30 min |
| 7 · Mover al número real | dueño | 5 min |
