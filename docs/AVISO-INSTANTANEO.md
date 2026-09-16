# El aviso al instante cuando entra dinero

*15-sep-2026 · pedido del dueño*

> «necesito una notificación a un número cuando se genere un contrato, tiene
> que llegar a 2 números de whatsapp… necesito que sea instantáneo…
> justamente cuando Stripe genera el pago, el contrato, registrar el abono en
> el EuroSystem y manda mensaje.»

---

## Qué lo dispara

Dos momentos, y los dos son dinero que acaba de entrar:

| Cuándo | Qué dice el aviso |
|---|---|
| **Una venta de la página.** Stripe cobra, EuroSystem registra el contrato y anota el anticipo como abono. | «💰 VENTA NUEVA en la página», con el anticipo que entró. |
| **Un abono posterior.** Un cliente que ya tiene contrato abona desde «Abona a tu viaje» y EuroSystem lo registra. | «💰 ABONO de un cliente», con el monto abonado. |

El aviso sale **en la misma cadena del cobro** —eso es lo que lo hace
instantáneo— y **siempre después** de que EuroSystem registró lo que tenía
que registrar. Antes de eso la operación todavía puede terminar en reintento,
y avisar de una venta que no quedó es peor que no avisar.

Vive en `api/_aviso.js` y se llama desde `api/_webhook-logica.js`, en los dos
lugares. El correo a la oficina que ya existía **no se tocó**: esto se suma.

### Lo que no puede pasar

El aviso **nunca rompe un cobro**. El dinero ya entró cuando esto corre, así
que un token vencido, un número mal escrito o un Meta que no contesta valen un
renglón del registro y nada más: no cambian ni un carácter de lo que se le
contesta a Stripe. Cada envío tiene tope de 4 segundos y los envíos van en
paralelo, así que un número malo no se lleva al otro.

En el registro de Vercel se escriben los **últimos cuatro dígitos** de cada
destinatario y jamás el token ni el número completo. Se busca por `[aviso]`.

---

## Canal 1 · WhatsApp

Un mensaje que **abre** la conversación —nadie le escribió al bot primero—
Meta solo lo deja pasar como **plantilla aprobada**. En texto libre contesta
el error 131047 y el aviso no llega.

### El texto que hay que dar de alta en Meta

En **business.facebook.com → Administrador de WhatsApp → Plantillas de
mensajes → Crear plantilla**:

- **Nombre:** `venta_en_la_pagina` (el que se ponga aquí va en `AVISO_WA_PLANTILLA`)
- **Categoría:** `Utilidad`
- **Idioma:** `Español (MEX)` → código `es_MX` (el que va en `AVISO_WA_IDIOMA`)
- **Encabezado:** ninguno
- **Pie:** ninguno
- **Botones:** ninguno

**Cuerpo**, tal cual, con las siete variables:

```
Entro dinero en la pagina de Eurotravel.

Folio: {{1}}
Cliente: {{2}}
Destino: {{3}}
Salida: {{4}}
Unidad: {{5}}
Total: {{6}}
Recibido: {{7}}
```

**Ejemplos** que pide Meta para aprobar (se escriben en la misma pantalla, en
«Agregar ejemplo»), en este orden:

| Variable | Ejemplo | Qué es |
|---|---|---|
| `{{1}}` | `ET-K3M9-4Q2 · contrato 52001` | folio de la página y número de contrato |
| `{{2}}` | `Juana Perez Lopez` | cliente |
| `{{3}}` | `Puerto Vallarta, Jalisco` | destino |
| `{{4}}` | `03/09/2026 08:00` | fecha de salida |
| `{{5}}` | `Sprinter` | unidad |
| `{{6}}` | `$21,700` | total del viaje |
| `{{7}}` | `Anticipo $4,340` | lo que acaba de entrar |

**El orden es el trato.** `_aviso.js` manda los siete parámetros en ese orden
exacto (`variables()`). Si un día se cambia la plantilla en Meta, hay que
cambiar el orden en el código el mismo día, o el dueño recibirá el destino
donde esperaba el nombre.

La séptima es la que dice cuál de los dos casos es: `Anticipo $4,340` en una
venta, `Abono $5,000` en un abono de cliente.

> **Lo que Meta rechaza sin avisar.** Una variable no puede traer saltos de
> línea, tabuladores ni cuatro espacios seguidos, ni puede ir vacía: el
> mensaje entero se cae con un error de la familia 132000 y el dueño
> simplemente no se entera de la venta. `_aviso.js` limpia cada parámetro
> —espacios colapsados, recortado a 60 caracteres, y raya (`—`) si no hay
> dato— justamente por eso. No hace falta hacer nada en Meta al respecto.

La aprobación suele tardar entre unos minutos y 24 horas. Mientras tanto,
Telegram (abajo) tapa el hueco.

### De dónde sale `AVISO_WA_PHONE_ID`

Es un número largo, **no el teléfono**. Si se pone el teléfono, Meta contesta
400 a todo.

1. Entrar a `developers.facebook.com` → la app de Eurotravel.
2. Menú de la izquierda → **WhatsApp → API Setup** (Configuración de la API).
3. En «From» / «Desde» aparece el número y **debajo, en chiquito, su
   `Phone number ID`**. Ése es el valor.

Si el número ya está en Dualhook, el Phone Number ID es el que Dualhook enseña
al terminar el alta, y entonces `AVISO_WA_TOKEN` tiene que ser la llave
`dh_live_…` (o se pone `AVISO_WA_API_BASE=https://graph.facebook.com/v21.0`
para que el aviso salga por Meta directo con un token de Meta).

### Las variables

```
AVISO_WA_TOKEN=EAAG…              el token con permiso de mandar mensajes
AVISO_WA_PHONE_ID=123456789012345 el id del número desde el que sale
AVISO_WA_A=5213312345678,5213319876543   los dos teléfonos que reciben
AVISO_WA_PLANTILLA=venta_en_la_pagina    el nombre de la plantilla aprobada
AVISO_WA_IDIOMA=es_MX             opcional; es_MX si no se pone
AVISO_WA_API_BASE=                opcional; solo si el aviso sale por otro camino que el bot
```

Los teléfonos van con lada de país y **solo dígitos**. El `521…` de México se
normaliza solo a `52…`, igual que en el bot.

**Faltando una sola de las cuatro primeras, el canal se apaga entero.** Es a
propósito: un canal a medias no puede mandar nada, y hacer el intento sería un
error en el registro por cada cobro.

---

## Canal 2 · Telegram, en tres pasos

Gratis, instantáneo y sin que nadie apruebe nada. Sirve de puente mientras
Meta aprueba la plantilla, y de red de respaldo después.

1. **Crear el bot.** En Telegram, buscar **@BotFather**, mandarle
   `/newbot` y seguir las dos preguntas (nombre y usuario, que tiene que
   terminar en `bot`). Contesta con un token del estilo
   `7654321:AAH8s-…`. Ése es `AVISO_TELEGRAM_TOKEN`.

2. **Escribirle al bot.** Cada persona que vaya a recibir avisos —los dos
   teléfonos— tiene que abrir el bot recién creado y mandarle cualquier cosa
   (un «hola» basta). Telegram no deja que un bot escriba primero.

3. **Sacar el chat id.** Abrir en el navegador:

   ```
   https://api.telegram.org/bot<EL_TOKEN>/getUpdates
   ```

   Sale un JSON con `"chat":{"id":123456789,…}` por cada quien le escribió.
   Esos números, separados por coma, son `AVISO_TELEGRAM_CHAT`.

```
AVISO_TELEGRAM_TOKEN=7654321:AAH8s-…
AVISO_TELEGRAM_CHAT=123456789,987654321
```

Igual que en WhatsApp: sin token o sin chats, el canal se apaga entero.

---

## Cómo se comprueba

- **Sin ninguna variable**, el módulo no manda nada y lo dice **una sola vez**
  en el registro. Es el estado normal en local y en las pruebas.
- Las pruebas viven en `pruebas/probar-aviso.cjs` (los dos canales, el saneado
  de parámetros, el número que falla, el envío colgado) y en
  `pruebas/probar-webhook.cjs` (que el aviso salga **después** del abono en
  las dos ramas, y que un aviso roto o colgado no cambie lo que se le contesta
  a Stripe). Se corren con `npm run probar aviso` y `npm run probar webhook`.
- En producción, buscar `[aviso]` en los registros de Vercel: dice cuántos
  salieron, cuántos fallaron y —cuando falla— qué contestó Meta o Telegram.
