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

---

## Los tres del 1-sep-2026, todos de LEER MAL

Un día completo de correcciones, y **los tres los cazó él, no yo**. Su
reclamo, textual: *«de verdad revisa la tabla, me da inseguridad que salgas así
al mundo»*. Era justo.

### 6 · Mi lector del Excel mentía

Una celda vacía se guarda cerrada en sí misma —`<c r="M25"/>`— y mi expresión
se tragaba la diagonal, la tomaba como abierta, y le colgaba **el valor de la
siguiente celda que sí tuviera**.

Le reporté que CDMX tenía $16,000 dominical. **Está vacía.** Y encima construí
una teoría entera sobre eso y se la presenté como hallazgo.

> **Lección:** cuando un dato no encaja con lo que él sabe de su negocio, la
> primera sospecha va sobre **la herramienta**, no sobre el dato. Dijo dos
> veces «revisa la tabla» antes de que se me ocurriera revisar el lector.

### 7 · Casi le quito dos precios suyos

Tepic y León no están en su Excel y no había nota en el catálogo, así que los
di por míos y **se los quité** para que los cotizara la fórmula. Los habría
bajado $1,300 cada uno.

Su razón sí estaba escrita — pero en `probar-tarifa.cjs`: «Leon, los 17,600 que
corrigió el dueño». **La prueba los rescató.**

> **Lección:** el precio y su razón **viven juntos**. Y «no encuentro de dónde
> salió» no es lo mismo que «lo inventé yo».

### 8 · Copié la nota de la columna de al lado

Puebla traía $2,000 de día extra citando la celda **Q10**, que es de *Puebla
con Zacatlán*. La suya, **P10**, dice $4,000.

Salió al leer **las doce notas de la fila 10 completas** en vez de solo las
tres que él había mandado en una foto. En la misma pasada apareció otra que no
tenía: **Oaxaca con Huatulco, +$20,000**.

> **Lección:** cuando una fila del Excel resulta tener información de precio,
> se lee **entera**, no la celda que se andaba buscando.

---

Relacionado: [[quien-manda]] · [[noches-y-estadia]] · [[movimientos]] ·
[[el-dia-con-movimiento]] · [[el-dominical]] · [[MAPA]]
