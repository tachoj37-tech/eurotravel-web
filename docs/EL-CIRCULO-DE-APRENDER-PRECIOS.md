# El círculo de aprender precios: qué falta para que cierre

**12-sep-2026.** Salió de comprobar lo que el dueño pidió:

> «Después me gustaría que tú vayas aprendiendo de precios y que el consumidor
> pueda funcionar sin necesidad de que haya este mensaje… **cuando el asesor
> escriba el costo en el whatsapp tú irás aprendiendo de él o confirmando tu
> precio**.»

La pregunta era concreta: **un viaje que entró por la página, ¿entra al mismo
almacén de precios aprendidos que uno de WhatsApp?**

---

## Cómo funciona hoy, por WhatsApp

1. El cliente escribe, el bot junta el viaje y le manda el ticket al dueño.
2. El dueño contesta con el precio.
3. `api/whatsapp.mjs` lo guarda:
   `almacen.guardaPrecio(aprendidos.renglonDe(resumen, unidad, precio, …))`.
4. La próxima vez que alguien pida **el mismo viaje**, se le sugiere ese precio.

«El mismo viaje» es una llave de cuatro partes
(`api/_precios-aprendidos.js`):

```
zona de salida | destino | unidad | días de servicio
```

---

## Lo que se encontró

La solicitud que arma la página trae **exactamente esos cuatro datos**. Así que
el círculo estaba más cerca de cerrar de lo que parecía… salvo por una cosa,
que se vio armando las dos llaves y comparándolas:

```
por la página  →  zmg|puerto vallarta|irizar i6s|1
por WhatsApp   →  zmg|puerto vallarta|irizar i6s|4
```

**El mismo viaje, dos llaves distintas.** El precio puesto por un lado no se
le sugeriría por el otro.

### La causa, y era más ancha que la página

`diasEntre` armaba la fecha pegándole `'T12:00:00Z'` a lo que le dieran. Con
una fecha pelada —`2026-11-20`— sale bien. Con una que traiga hora, queda
`2026-11-20T08:00T12:00:00Z`, que no es una fecha: `Date.parse` da `NaN` y la
cuenta devuelve **1 día, siempre**.

No se notaba porque el bot manda las fechas peladas. La página las manda **con
hora**, porque el cliente escoge hora de salida y de regreso.

Es exactamente lo que ya había pasado con el origen —*«el aprendizaje casi no
acumulaba»*, porque «Guadalajara», «gdl» y «Zapopan» eran tres viajes— y esa
lección se paga una sola vez. **Arreglado**, en `diasEntre`, que es donde se
hace la cuenta y no en cada quien que la llama. Las dos llaves ya empatan.

---

## Lo que falta para que el círculo cierre

Con la llave arreglada, quedan **dos piezas**, y ninguna es de este lado:

### 1 · El almacén, que todavía no existe en producción

`_precios-aprendidos.js` decide **qué** se guarda y **cómo** se le enseña al
dueño. Guardarlo y leerlo vive en `_almacen.js`, y el propio código lo dice:
sin almacén encendido, `guardaPrecio` no se llama —`almacen.hayAlmacen()`— y
el bot avisa en el ticket que *«este precio no se va a guardar»*.

Mientras no exista, «ir aprendiendo» no acumula nada entre un viaje y el
siguiente, venga de donde venga.

### 2 · El enganche: hoy la página no pasa por ahí

El precio de un viaje de WhatsApp se guarda porque el dueño **contesta el
ticket dentro del bot**, y el bot tiene el viaje en la mano.

La ficha de la página le llega **por correo** (ver
`docs/FASE-2-3-NO-SE-PIERDE.md`), así que cuando el dueño le pone precio a ese
viaje, lo hace fuera del bot: le escribe al cliente por WhatsApp él mismo. Ese
precio **no pasa por `guardaPrecio`**.

> **Lo que haría falta**, y le toca a la rama del bot: que la ficha de la
> página entre por el mismo camino de tickets que las de WhatsApp. La ficha ya
> se arma con `_tickets.armaTicket` —el mismo del bot, precisamente para
> esto— y `_solicitud.paraWhatsApp()` la entrega hecha. Lo que falta es
> mandarla, que es el pendiente que ya estaba anotado de la fase 3.

**Las dos piezas son la misma que ya estaba anotada**: el día que la ficha de
la página se mande por WhatsApp como ticket, el aprendizaje entra solo — sin
escribir nada más.

---

## Y lo segundo que pidió: «o confirmando tu precio»

Esa mitad **todavía no existe en ningún lado**, ni para WhatsApp.

Hoy el sistema guarda el precio que el dueño da. Lo que no hace es **comparar
lo que él cobró contra lo que el sistema habría cobrado**, que es lo que le
permitiría saber cuándo ya puede cotizar solo:

| el sistema | el asesor | hoy |
|---|---|---|
| no tenía precio | lo escribe | **se aprende** ✓ |
| sí tenía uno calculado | escribe el mismo | no se anota que acertó |
| sí tenía uno calculado | escribe otro | no se anota en cuánto falló |

Sin esa comparación, «ir aprendiendo» no tiene manera de decir si va bien. Es
una pieza chica —guardar el precio propio junto al del dueño y restar— pero no
está, y conviene que él lo sepa antes de esperar que el cotizador «se suelte»
solo algún día.
