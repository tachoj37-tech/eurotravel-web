# Errores que ya se pagaron

Están escritos con fecha a propósito. Un error que no se anota se repite, y
en precios repetirlo cuesta dinero de verdad.

---

## 1 · Inventé una regla (26-ago-2026)

«Tres noches gratis y $1,000 por noche» salió de mirar **Vallarta y nada más**,
y lo apliqué a todo el catálogo como si fuera suyo.

**Fue el error más caro hasta hoy** — y no fue un número mal copiado, fue una
regla inventada con confianza.

Terminó bien por casualidad: él confirmó las tres noches el 30-ago (**R25**).
Pero durante cuatro días la página cobró con una regla que nadie había dictado.

> **Lección:** no inventar modelos. Si el Excel no lo dice, no existe hasta que
> él lo diga.

---

## 2 · Calibré con 2 casos teniendo 9 (26-ago-2026)

Ajusté las perillas hasta que cuadraran dos destinos, teniendo nueve con varias
duraciones enfrente.

Eso no es calibrar: es **elegir los datos que me daban la razón**.

> **Lección:** se prueba contra todos, no contra los que cuadran.

---

## 3 · Di por hecho lo que no podía probar (26-ago-2026)

Supuse duraciones de paquete leyendo el nombre de la columna. Dos de los cinco
estaban mal, y **Barrancas eran $9,000 de sobrecobro** en un viaje de seis días.

Tres siguen sin confirmar. Ver [[lo-que-no-se]].

---

## 4 · R18 vivió dos días (28 al 30-ago-2026)

Inventé una excepción —«abajo de $15,000 el día no es gratis»— que él revocó
dos días después con **R25**.

Lo rescatable fue cómo se deshizo: se habían **congelado 570 precios** antes del
cambio, así que al revocarla se comprobó que volvieran **exactamente** a como
estaban, no solo que las pruebas pasaran.

> **Lección:** antes de cambiar una regla de dinero, congelar lo que cobra hoy.
> Es la única forma de saber que se deshizo bien.

---

## 5 · Un campo sin efecto, y sin avisar

`movimientosIncluidos` se agregó al catálogo y **no hacía nada**:
`precioDeLista()` arma un objeto nuevo y el campo llegaba `undefined`. **Nada
tronó.** Chiapas estuvo **$24,000 arriba** de su propia celda del Excel.

Se cazó **volviendo a medir los precios**, no leyendo el código.

> **Lección:** un cambio de precio no está hecho hasta que se vuelve a medir lo
> que cobra. Que compile no prueba nada.

---

Relacionado: [[quien-manda]] · [[noches-y-estadia]] · [[movimientos]] · [[MAPA]]
