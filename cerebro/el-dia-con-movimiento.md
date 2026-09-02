# El día que se cobra "con movimiento"

Hay cuatro destinos donde el día **no es una noche más un paseo aparte**: es un
precio por día que cambia según si la unidad sale o no.

Son los que en el Excel tienen su nota de «DIA EXTRA» en la fila 10.

---

## Los cuatro, y cuánto cobra cada uno

| destino | el día **sin** movimiento | **con** movimiento |
|---|---|---|
| **Ciudad de México** | $1,000 | **$4,000** |
| **Huasteca Potosina** | $1,000 | **$4,000** |
| **Puebla** | $1,000 | **$4,000** |
| **Puebla con Zacatlán** | $2,000 | $5,000 |

Los tres primeros son la misma forma. **Zacatlán va por su cuenta**: su nota
—celda Q10— dice «DIA EXTRA $4,000 BUS Y $2,000 SPR».

---

## Cómo se comprueba que está bien

Sus celdas tienen que salir exactas:

| | Excel | la página |
|---|---|---|
| CDMX 1 día | $26,000 | $26,000 |
| CDMX 2 días | $30,000 | $30,000 |
| CDMX 3 días | $34,000 | $34,000 |
| Huasteca 3 días | $38,500 | $38,500 |
| Huasteca 4 días | $42,500 | $42,500 |
| Puebla 2 días | $36,500 | $36,500 |
| **Puebla 4 días con movimiento** | — | **$44,500** ← su cuenta |

Cuatro mil de diferencia por día en CDMX, y ahí se ve solo: **el día 1 es más
barato que el día 2 por exactamente $4,000.**

---

## Los dos errores que costó llegar aquí

**El primero: copié la nota de la columna de al lado.** El catálogo traía
$2,000 de día extra para Puebla citando la celda **Q10**, que es de *Puebla con
Zacatlán*. La de Puebla es **P10** y dice «$ 4000 DIA EXTRA», sin distinguir
unidad.

Lo cachó él con la cuenta hecha: *«Puebla debería costar 44,500 a 4 días»*.

**El segundo: entendí a medias su corrección.** Dijo «esos días de Puebla ya
incluyen mov como en CDMX» y lo leí como que el día extra traía el movimiento
dentro y no se cobraba aparte. Daba sus $44,500, **pero cobraba igual se
movieran o no** — y eso no es «como en CDMX».

Tuvo que decirlo otra vez: *«Puebla pon mil sin movimiento y ya está»*.

> **La lección de los dos juntos:** cuando él dice «como en X», hay que ir a
> ver **cómo funciona X de verdad**, no quedarse con el número que cuadra. La
> primera versión daba el resultado correcto en el caso que él mencionó y
> estaba mal en todos los demás.

---

## Y no confundirlos con Chiapas

En Chiapas la columna **sí se acaba**: cubre ocho días, y del noveno en
adelante el día extra y el movimiento son **dos cobros distintos**.

Aquí no: el día ES con o sin movimiento, y ya.

---

Relacionado: [[movimientos]] · [[precio-de-lista]] · [[noches-y-estadia]] ·
[[errores-que-ya-pague]] · [[MAPA]]

Texto completo: `docs/CRITERIO-DE-PRECIOS.md`, reglas R3, R33, R47, R49 y R50.
