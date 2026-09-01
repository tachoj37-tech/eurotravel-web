# Los movimientos

Un **movimiento** es un día en que la unidad sale a pasear estando ya en el
destino. **$3,000 el día**, y sube con las horas.

| el día dura | cobra | de quién es |
|---|---|---|
| hasta 8 horas | $3,000 | **suyo**, fila 10 del Excel |
| más de 8 y hasta 9 | $3,500 | mío |
| más de 9 y hasta 10 | $4,000 | mío |
| más de 10 y hasta 12 | $4,500 | mío |
| más de 12 | $5,000 | mío |

> **Solo el primer escalón es suyo.** Los otros cuatro los inventé. Vallarta 4
> días con 2 movimientos cuesta **$25,000 a ocho horas y $29,000 a catorce** —
> cuatro mil pesos de diferencia salidos de mi cabeza. Ver [[lo-que-no-se]].

---

## Tres formas de que NO se cobren

Aquí es donde más fácil se cobra de más. Las tres son distintas y hay que
saber cuál aplica.

### 1 · El viaje de un día (R22)

**No paga movimiento.** Un viaje de ida y vuelta el mismo día casi siempre trae
un recorrido, y ese ya va en su precio.

Excepción: **CDMX y la Huasteca**, que se cobran por día y lo traen en su base
(**R3**).

El bot ni siquiera lo pregunta cuando salida y regreso son el mismo día — sería
pedir un dato para después ignorarlo. Ver [[el-bot]].

### 2 · La columna ya los trae (R24, R5)

Cuando el Excel dice «Ciudad de México 3 días», ese precio **ya incluye** tres
días de movimientos. Cobrarlos otra vez es cobrar dos veces.

En `api/_destinos.js` eso es el campo `movimientosIncluidos`.

**Excepciones que él dictó:** **Cancún** no los trae. **Guayabitos** tampoco —
«hasta 4 días es ese precio, pero sin movimientos».

> Este campo estuvo **sin efecto y sin avisar**: `precioDeLista()` arma un objeto
> nuevo y el campo llegaba `undefined`. Nada tronó. Se cazó volviendo a medir
> los precios, no leyendo el código. Chiapas estaba **$24,000 arriba** de su
> propia celda.

### 3 · Ahí moverse no cuesta (R17)

Hay destinos donde el día vale $3,000 se mueva la unidad o no —Barrancas es el
caso—. No es que el movimiento sea gratis: es que el día ya se cobra.

---

## Los tres paseos con nombre propio

Su fila 10 les pone precio y **la página no los cobra así**:

| paseo | su Excel | la página | de menos |
|---|---|---|---|
| **Chalma** (CDMX 3 días) | +$8,000 | $3,000 | **−$5,000** |
| El Meco / El Naranjo (Huasteca 4 días) | +$3,000 | $3,000 | igual |
| Xochimilco (CDMX 1 día) | +$2,000 | $3,000 | +$1,000 |

Chalma sola son cinco mil pesos por viaje. Está en [[lo-que-no-se]].

---

Relacionado: [[noches-y-estadia]] · [[como-se-arma-un-precio]] ·
[[lo-que-no-se]] · [[MAPA]]

Texto completo: `docs/CRITERIO-DE-PRECIOS.md`, reglas R3, R5, R17, R22, R24.
