# Cómo usa el bot todo esto

El chat de la página corre `bot.js` — **el mismo archivo** que va a correr el
webhook de WhatsApp cuando se dé de alta con Meta. No es una copia: cambiar una
respuesta la cambia en los dos lados.

---

## El bot NO calcula precios

Junta datos y se los pasa a `/api/cotizar`, que es la misma puerta del
cotizador de la página. **Aquí no vive ninguna tarifa.**

Si esa puerta falla, no improvisa: pasa la conversación con una persona. Si el
motor contesta `requiereAsesor`, tampoco enseña el total. Ver
[[cuando-no-se-cotiza-solo]].

Es [[quien-manda|R12]] aplicada, y hay una prueba que le tira 16 formas de
preguntar el precio exigiendo que no suelte ni una cifra.

---

## Qué pregunta, y por qué eso

En este orden: **a dónde · de dónde · salida · regreso · días de recorrido ·
horas al día**.

Cada una mueve el precio:

| pregunta | qué mueve |
|---|---|
| destino | [[precio-de-lista]] o la fórmula |
| origen | el [[de-donde-salen\|recargo de salida]] |
| salida y regreso | los días, y con ellos [[noches-y-estadia\|las noches]] |
| recorridos | [[movimientos]] |
| horas al día | la banda del movimiento |

**Si salida y regreso son el mismo día, ni pregunta los recorridos** — R22 dice
que no se cobran, y pedir un dato para después ignorarlo es hacerle perder el
tiempo al cliente.

---

## El IVA: se cobra, no se nombra

Dictado el 31-ago-2026: *«no quiero que no lo cobres, solo no lo menciones»*.

Los precios de lista **ya traen el IVA dentro** (`ivaIncluido: true` en
`_tarifa.js`). Por eso «no cobrar IVA» **nunca** puede significar dividir entre
1.16: eso sería cobrar 16 % menos. Chapala 3 días pasaría de $9,000 a $7,759 —
**$1,241 por viaje**.

Lo entendí al revés una vez. Ahora hay prueba con cinco montos que exige que el
precio del chat sea **idéntico** al de la página y que la palabra no aparezca.

---

## Para lo que no cotiza solo: la solicitud

Autobús y Suburban no dan precio en línea, pero el bot **pregunta todo igual** y
entrega esto:

```
📋 Solicitud de cotización
🚌 Unidad: Autobús      👥 Pasajeros: 45
📍 Guadalajara → Puerto Vallarta
📅 12 al 16 de diciembre de 2026  (5 días)
🚐 Recorridos: 2 días, todo el día
```

**Sin precio.** Ese lo pone la persona. El botón «Enviar por WhatsApp» la manda
ya escrita: el cliente contestó seis preguntas, no se las va a repetir
tecleando.

---

## Y un límite que manda el diseño

WhatsApp permite **3 botones de 20 caracteres, o una lista de 10 filas de 24**.
Toda pregunta del bot cabe ahí, y una prueba lo vigila — si no cupiera,
funcionaría en la página y **se rompería el día de conectar con Meta, sin
avisar**.

Otra prueba exige que el bot sepa leer **sus propios botones**: ya pasó que
ofrecía «Entre 11 y 20» y no lo entendía, o sea que el cliente tocaba y el bot
repetía la pregunta para siempre.

---

Relacionado: [[como-se-arma-un-precio]] · [[cuando-no-se-cotiza-solo]] ·
[[quien-manda]] · [[MAPA]]
