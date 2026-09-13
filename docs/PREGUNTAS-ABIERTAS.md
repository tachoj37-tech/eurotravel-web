# Lo que no tengo claro

**Quedan cuatro: tres son decisión suya y una es un pendiente de la rama del
bot.** Las dos últimas salieron del trabajo de la página del 12-sep-2026
—fases 0, 1, 2 y 3, y las capacidades nuevas—; las dos primeras venían de
antes.

Ese mismo día se cerraron dos más, y las dos las contestó él:

| | qué preguntaba | qué contestó |
|---|---|---|
| **Los servicios locales** | si el aeropuerto, la central, la Expo, el Akron y la zona metropolitana debían entrar al cotizador | *«los servicios locales mándalos con vendedor»* — se quedan con el vendedor, como ya los dejó la fase 1 |
| **Cómo se lee el Century** | si un renglón «47 a 49» bastaba | *«irizar century 47 es uno, irizar century de 49 es otro… son unidades con diferentes precios, no los pongas en una misma unidad»* — se partieron en dos, y lo mismo los i6 |

Es el estado más limpio desde que existe este archivo. El 1-sep-2026 se
cerraron **veintiséis preguntas** en una sola sesión —las 17 de la primera
ronda y 9 de la segunda— y todas viven en el criterio como R26 a R44, con su
fecha y su frase textual.

---

## 1 · La Suburban no tiene precios

Se buscó en su Excel y **no aparece**. Sus 48 columnas van de la B a la AX y
ninguna es Suburban.

Hoy el bot la ofrece como la opción premium para grupos de seis o menos
—interiores en piel, servicio ejecutivo— y **pasa la conversación con una
persona** para el precio.

Él dijo el 1-sep: *«ahorita no lo pongas»*.

> **Queda así hasta que él lo pida.** No es un pendiente que se me olvidó: es
> una decisión suya, tomada y con fecha.

---

## 2 · «Solo ida» a un destino con paquete

La página cobra el solo ida al **65 %** del viaje redondo. Eso tiene sentido en
un destino normal, y no lo tiene en uno cuyo precio cubre un paquete de varios
días:

| | días del paquete | redondo | solo ida al 65 % |
|---|---|---|---|
| **Cancún** | 17 | $145,000 | **$94,250** |
| **Chiapas** | 8 | $85,000 | $55,250 |
| **Barrancas** | 7 | $75,000 | $48,750 |

Nadie renta una Sprinter diecisiete días de ida. Pero hoy la página lo deja
pedir y le pone precio.

> **La pregunta:** ¿un destino con paquete se puede pedir solo ida? Si no, la
> pantalla debería no ofrecer esa opción cuando el destino trae días
> incluidos.

Él pidió que se le recordara el 2-sep-2026. **El recordatorio está puesto.**

---

## 3 · El asiento de margen del Century (12-sep-2026)

El 7-sep dictó: *«Si son 48, lo ofreces. Si son 49, no lo ofreces»*. Era un
lugar de margen para que nadie se quedara parado el día del viaje.

Al separar los dos Centurys, ese margen **sale solo para los grupos de 48**
—no caben en el de 47 y sí en el de 49, con un asiento libre—, pero **no para
los de 49**: ésos van llenos.

> **La pregunta:** ¿un grupo de 49 debe poder pedir el Century de 49, o
> prefiere que también ahí quede un asiento de sobra? Es cambiar un número.

## 4 · El chat se quedó sin puerta, y su número sigue escrito a mano (12-sep-2026)

Al regresar el botón flotante a WhatsApp —«va a abrir el whatsapp que estamos
trabajando con kommo»— el **chat de la página se quedó sin botón visible**. Su
código sigue entero y funcionando; lo que ya no tiene es por dónde abrirlo.

No se borró nada, y el botón viejo se quedó escondido en el DOM a propósito:
`bot-navegador.js` lo busca al cargar y **no comprueba que exista**, así que
quitarlo tumbaría el chat con un error.

> **Dos cosas le tocan a la rama del bot, no a ésta:**
>
> 1. Decidir qué pasa con el chat: se quita del todo, o se le da otra puerta.
> 2. Que `bot-navegador.js` saque el número de `config.js` como todos los
>    demás. Hoy lo tiene escrito a mano dos veces — con el número **bueno**,
>    eso sí, y hay una prueba que se pone roja si alguna vez deja de serlo.

## 5 · El acuse por WhatsApp lo tiene que mandar el bot (12-sep-2026)

La fase 3 quedó a medias a propósito. Los dos mensajes están escritos y la
ficha del vendedor se arma con el mismo ticket del bot, pero **salen por
correo**, no por WhatsApp.

La razón es de seguridad y está explicada en `docs/FASE-2-3-NO-SE-PIERDE.md`:
la única puerta de salida a WhatsApp lleva tres candados —el filtro de salida,
el freno de la CLABE ajena y la lista blanca de su teléfono— y abrir una
segunda sin ellos sería un hueco.

> **No es una pregunta para el dueño, es un pendiente para la rama del bot:**
> que `api/whatsapp.mjs` llame a `_solicitud.paraWhatsApp()` y mande los dos
> mensajes. La ficha ya sale hecha.
>
> **Y ojo:** hoy `DUENO_WHATSAPP` está vacía a propósito en producción, así
> que aunque se hiciera, el ticket tampoco saldría todavía.

> **Se destrabó por otro lado el 12-sep-2026 (R47).** No hacía falta que el
> bot escribiera primero —Meta no lo deja sin plantillas—: ahora el acuse de
> la página le abre WhatsApp al cliente con su viaje ya escrito, y cuando él
> le da enviar la conversación existe. De ahí el ticket sale solo, por el
> camino de siempre. Ver `docs/SIN-PRECIOS.md`.

---

## 6 · Cuando la IA aprende un precio, ¿sale solo al cotizador? (12-sep-2026)

**Es para el dueño, y hay que preguntárselo antes de escribir nada.**

Él pidió las dos cosas en el mismo mensaje: *«ningún precio para nadie»* y
*«ahí es donde la IA aprende de precios para que cada mes añada nuevos precios
al cotizador»*. Chocan, y la manera de resolverlo cambia el diseño entero:

- **Si sale solo:** ese destino deja de ser «ningún precio» en cuanto se
  aprende, y el cotizador se va soltando mes con mes sin que nadie lo apruebe.
- **Si necesita su «va»:** es como funciona hoy todo lo demás —la compuerta
  del dueño— y él revisa una tanda al mes antes de que salga en público.

Lo sensato es lo segundo, pero es su decisión y no se supone. Y de todos
modos falta la pieza de abajo: **el almacén no existe en producción**
(`docs/EL-CIRCULO-DE-APRENDER-PRECIOS.md`), así que hoy no se acumula nada.

---

## 7 · El bot todavía cotiza la Sprinter (12-sep-2026)

**No es una pregunta, es un pendiente para la rama del bot.** El dueño dijo
«ningún precio para nadie» incluyendo el bot. La página ya no cotiza; el bot
sí, porque comparten el catálogo.

Es un renglón —`cotizadorAutomatico: false` en la Sprinter, `unidades.js`— y
el bot ya tiene hecho el camino para cuando pase. No se tocó desde el worktree
de la página porque mueve más de cien aserciones de las pruebas del bot. El
detalle, en `docs/SIN-PRECIOS.md`.

---

# Lo que se cerró el 1-sep-2026

Diecinueve reglas nuevas en un día. Las más caras primero:

| | qué cambió | lo que costaba no tenerlo |
|---|---|---|
| **R34** | el piso NO le gana a un precio de lista | Chapala 4 días cobraba $12,000 valiendo $6,500 |
| **R42** | los paseos SE SUMAN, no sustituyen | Taxco iba $3,000 abajo |
| **R30** | Taxco $15,000 · Chalma $8,000 · Xochimilco $2,000 | Taxco se cobraba a $3,000: **$12,000 de menos** |
| **R43** | DOMINICAL, doce destinos | no se cobraba |
| **R35** | Acapulco: día extra $4,000 y movimientos aparte | día extra a la mitad |
| **R29** | recorrido de +80 km = $5,500 | no se cobraba nunca |
| **R39** | El Meco suma $3,000 | no se cobraba |
| **R26** | 4 días / 3 noches por defecto | — |
| **R41** | redondeo a la centena más cercana | hasta $49 por viaje |
| **R27** | la casilla vacía de un origen **es un dato** | — |
| **R28** | San Juan Cosalá hereda el recargo de Chapala | recargo en $0 |
| **R38** | Zacoalco se iguala a Tala | $1,000 abajo |
| **R32** | Camécuaro desde Yurécuaro +$2,000 | — |
| **R31** | DOMINICAL es el mismo domingo | — |
| **R33** | Puebla, día extra $2,000 | — |
| **R36** | tres de los cuatro números raros eran correctos | — |
| **R37** | la fórmula $6,500 + $22/km, confirmada | — |
| **R40** | cómo se piden los paseos y los 80 km | lo anterior **no se podía pedir** |
| **R44** | Mazatlán dominical es correcto | — |

Y **dos errores míos**, escritos con su lección porque valen más que las
reglas:

- **Casi le quito dos precios suyos** (Tepic y León). Su razón estaba escrita
  en la prueba, no en el catálogo. *El precio y su razón viven juntos.*
- **Mi lector del Excel mentía**: las celdas vacías se robaban el valor de la
  siguiente. Le reporté precios que no existen, dos veces. *Cuando un dato no
  encaja con lo que él sabe de su negocio, la primera sospecha va sobre la
  herramienta.*
