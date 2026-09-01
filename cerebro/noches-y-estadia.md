# Las noches

**Tres incluidas. De la cuarta en adelante, $1,000 cada una.**

Para todos los destinos. Confirmado por el dueño el 30-ago-2026 (**R25**).

`api/_tarifa.js` → `NOCHES_INCLUIDAS = 3`, `EXTRA_POR_NOCHE = 1000`.

---

## Esto costó dos correcciones

Es la regla que más veces se ha movido, y las dos veces por lo mismo: **yo
generalicé desde pocos casos**.

**Primero la inventé.** «Tres noches gratis y $1,000 por noche» salió de mirar
Vallarta y nada más. No era suya. Ver [[errores-que-ya-pague]].

**Después inventé una excepción.** R18 decía que abajo de $15,000 el día no era
gratis. **Vivió dos días** y él la revocó el 30-ago con R25: tres noches para
todos, sin corte.

Cuando se revocó se comprobó que los precios volvieran **exactamente** a como
estaban antes de R18 —570 precios congelados en un archivo—, no solo que la
prueba pasara. Eso es `pruebas/probar-dia-no-gratis.cjs`.

> La lección: una regla de precio que sale de dos o tres casos no es una regla,
> es una corazonada con números.

---

## Las que van planas más tiempo

**Morelia y Mariposa** no suben hasta pasada la tercera noche (**R23**). Se lo
presenté como defecto y **no lo era** — él lo confirmó. Su precio ya trae esas
noches dentro.

**Guayabitos**: hasta 4 días es ese precio, y +$1,000 la noche extra (**R7**).
Pero **sí cobra sus movimientos aparte** — eso lo corrigió él, y es la
diferencia entre esta y las de [[movimientos|movimientos incluidos]].

**Puebla y Zacatlán**: el día extra son **$2,000**, no $1,000 (**R8**).

---

## Lo que NO se puede deducir

**R6.** Si el Excel trae «Talpa 3 días $X» y «Talpa 4 días $Y», la diferencia
`Y − X` **no** es la tarifa del día extra. Es lo que cuesta ese paquete de
cuatro días, que puede traer otras cosas dentro.

Un día extra deducido así **se propone al dueño, no se aplica**.

---

## Y esto se SUMA, no se excluye

**R13.** La noche de más y el día movido son cosas distintas y se cobran las
dos. Una unidad parada de noche cuesta aunque no se mueva; una unidad que sale
a pasear cuesta aunque duerma ahí.

---

Relacionado: [[movimientos]] · [[precio-de-lista]] · [[errores-que-ya-pague]] ·
[[MAPA]]

Texto completo: `docs/CRITERIO-DE-PRECIOS.md`, reglas R6, R7, R8, R13, R23, R25.
