# Fases 2 y 3 · El viaje sin precio ya no se pierde

Hecho el **12-sep-2026**, en el worktree `pagina-web`.

Las dos fases van juntas porque el plan lo dijo así: *«capturar un contacto al
que nadie escribe es peor que no capturarlo»*.

---

## Lo que pasaba antes

Desde la fase 1, hay tres caminos por los que un viaje **no lleva precio**:

| | cuándo | qué tan seguido |
|---|---|---|
| **La unidad** no cotiza en línea | todo lo que no es la Sprinter | el más transitado de los tres |
| **El destino** no salió del criterio | 36 de los 79 del buscador | seguido |
| La medición **falló** | Google no contesta, servidor caído | raro |

En los tres, la pantalla decía «te cotiza un vendedor» y **ahí se acababa**. El
cliente que no escribía por su cuenta se iba sin que nadie supiera que había
estado.

Y el más transitado de los tres —el de los camiones— ni siquiera enseñaba caja
de precio: se quedaba mudo.

---

## Lo que va en su lugar

En los **tres** caminos aparece ahora una caja debajo del aviso:

> **Para este viaje te paso el precio a la medida.**
> Guadalajara → Puerto Vallarta · 20 sep 2026, 08:00 → 23 sep 2026, 18:00 · Irizar i6S
>
> ¿A qué número te lo mando?
> `[ 33 1234 5678 ]` **[ Mándamelo ]**
> _Mejor mándamelo por correo_

### Un campo, no dos

WhatsApp **o** correo. El plan lo dijo con todas sus letras —«cada campo de más
es gente que se va»— y por eso el botón de abajo cambia de canal en vez de
agregar otro renglón.

Y **no se le pide nada más**. El formulario largo —nombre, teléfono, punto
exacto de salida— sigue existiendo para quien quiera apartar, pero para
mandarle un precio no hace falta ninguno de esos datos.

### La ficha se arma sola

Con lo que ya escogió arriba: a dónde, cuándo, cuántos días, qué unidad. Se le
enseña en la misma caja para que vea que lo que se va a mandar es su viaje y
no otro.

**Los días los cuenta el servidor**, con el mismo contador del cotizador y del
cobro. La pantalla no los manda: un segundo contador en el navegador es una
segunda cuenta que se puede separar de la primera, y el vendedor cotiza con
ese número.

### El acuse está en la pantalla

> ✓ **Ya quedó: tu solicitud está con un vendedor.**
> Te escribimos por WhatsApp con tu precio, el mismo día hábil.

En la misma pantalla, no en un mensaje que quizá no llega. Es lo que el plan
pidió textualmente.

Al mandar, el campo se esconde: un formulario que sigue ahí invita a mandarlo
dos veces. Pero si el cliente **cambia una fecha** después y vuelve a cotizar,
la caja se rearma entera —con su campo y su botón— y **no se le borra lo que
ya escribió**. Sin eso quedaba un callejón sin salida, y se comprobó en el
navegador.

---

## Lo que le llega al vendedor

La ficha se arma con **`_tickets.armaTicket`, el mismo del bot**. No es un
detalle de cortesía: el vendedor lleva meses leyendo ese formato y sus botones
—incluido el de **mandar fotos de la unidad**— cuelgan de ese ticket. Si la
página inventara otro, tendría que aprender uno nuevo.

```
🎫 Viaje para cotizar

📍 Guadalajara → Querétaro
📅 20 de septiembre al 23 de septiembre
🗓️ 4 días
🚐 Irizar i6S
🔁 Sin movimientos

Contéstame este mensaje con el precio y yo se lo paso.
_cliente: 3324002285_

🌐 Entró por la página, no por WhatsApp.
🕗 Sale 20 sep 2026, 08:00 · regresa 23 sep 2026, 18:00
🙋 Prueba de la Fase Dos
📱 WhatsApp: 3324002285

Escríbele tú: este cliente todavía no tiene conversación abierta.
```

Lo de abajo es lo único que se le agrega, y es lo que hace distinto a un viaje
de la página: **aquí el vendedor escribe primero**. En WhatsApp el cliente ya
abrió la conversación; aquí no.

Si dejó correo y no WhatsApp, esa última línea cambia sola a «Contéstale por
correo».

---

## Por qué el aviso sale por correo y no por WhatsApp

**Esta es la decisión más importante de la fase 3, y es una que conviene
revisar.**

El plan quería que la ficha le llegara al vendedor por WhatsApp, por el mismo
camino que los tickets del bot. No se hizo, y la razón es de seguridad:

La única puerta de salida a WhatsApp está en `api/whatsapp.mjs` y lleva encima
**tres candados que costaron caro**:

1. **El filtro de salida** (reparación del 8-sep-2026): nada con forma de
   código, JSON o error le llega a un cliente.
2. **El freno de la CLABE ajena**: cualquier número de 18 dígitos que no sea
   la nuestra se frena como incidente crítico.
3. **La lista blanca del teléfono del dueño**: solo le llegan las cinco cosas
   que él pidió.

Abrir una segunda salida sin esos candados sería un hueco. Y copiarlos sería
peor a la larga: dos copias son dos copias hasta que alguien toca una.

Así que **el correo es el canal de hoy**: funciona, no depende del bot, y le
llega igual. La ficha ya sale armada y lista para WhatsApp —`paraWhatsApp()`
la entrega hecha—; lo único que falta es que alguien la mande desde donde vive
esa puerta.

> **Pendiente para la rama del bot**, anotado también en el plan: que
> `api/whatsapp.mjs` llame a `_solicitud.paraWhatsApp()` y mande los dos
> mensajes. Son pocas líneas allá y cero riesgo aquí.
>
> **Y ojo:** hoy `DUENO_WHATSAPP` está vacía a propósito en producción, así
> que aunque se hiciera, el ticket por WhatsApp tampoco saldría todavía.

---

## Dónde vive la puerta, y por qué ahí

`POST /api/cotizar` con `{ accion: 'solicitud' }`.

**No es un archivo nuevo en `api/`, y no es comodidad.** El plan Hobby de
Vercel publica **doce funciones** y hay doce exactas: un archivo más tumba el
despliegue entero. Ya pasó el 26-ago-2026 y lo caza
`pruebas/probar-despliegue.cjs`. Es la misma salida que tomó `api/cuenta.js`
con sus acciones.

Y es la puerta que le toca: la solicitud nace del cotizador, con los mismos
datos del viaje y el mismo origen permitido.

### Su freno es suyo, y más apretado

| | por minuto | por día |
|---|---|---|
| Cotizar | 30 | 500 |
| **Solicitud** | **5** | **200** |

Cotizar es una cuenta: sale cara en llamadas a Google y nada más. Mandar una
solicitud **saca correos de nuestro dominio**, y eso se abusa distinto: con el
freno de cotizar, una IP podría disparar treinta correos por minuto a la
oficina y quemarnos la reputación del remitente.

### Una solicitud recibida se contesta 200 aunque el aviso falle

Si Resend está caído o falta la llave, la solicitud **se recibió igual**. Lo
que no puede pasar es que alguien deje sus datos y vea un error por algo que
no es suyo. El fallo queda gritado en el registro, con el contacto y la ruta,
para que no se pierda en silencio.

---

## Lo que lo vigila

| | |
|---|---|
| `pruebas/probar-solicitud.cjs` | 66 · el motor: qué se acepta, qué se manda |
| `pruebas/probar-captura.cjs` | 37 · la puerta y la pantalla |

Las dos se vieron **en rojo antes que en verde**, rompiendo el código a
propósito:

- Quitar la cuenta de diez dígitos del teléfono → **8 en rojo**
- Exigir los dos contactos en vez de uno → **6 en rojo**
- Hacer caso a los días que manda el navegador → **4 en rojo**
- Quitar la caja del camino de los camiones → **2 en rojo**

Y algo que salió de ahí: la prueba reventaba en la primera falla en vez de
enseñar las ocho que cazaba. Se enderezó — un rojo sirve para leerlo entero.
