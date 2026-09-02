# El dominical

**Ida y vuelta el mismo domingo.** No es un descuento sobre el precio normal:
es un producto distinto, con su propio renglón en el Excel.

Sus filas **25 (`DOMINICAL SPRINTER`)** y **27 (`DOM SPR OCO`)**. Solo Sprinter
— la 24 es `DOMINICAL CENTURY`, otra unidad, y no se cotiza en línea.

---

## Se cobra cuando se cumplen las TRES

1. el viaje es de **un día**
2. cae en **domingo**
3. el destino **tiene celda** en esa fila

Si falta cualquiera, todo sigue como siempre.

---

## Los doce que tienen celda

| destino | normal | domingo | domingo · Ocotlán |
|---|---|---|---|
| Puerto Vallarta y alrededores | $19,000 | $16,000 | $22,000 |
| Mismaloya | $20,000 | $17,000 | $23,000 |
| Sayulita / San Pancho | $18,000 | $15,000 | $21,000 |
| Mazamitla | $14,500 | $14,500 | **$13,500** |
| Tapalpa | $14,500 | $14,500 | **$13,500** |
| Tequila / Guachimontones | $7,000 | $6,500 | $11,500 |
| Chacala | $16,500 | $14,000 | $21,000 |
| Punta Perula | $20,500 | $18,500 | $23,000 |
| Rincón de Guayabitos | $18,500 | $15,000 | $21,000 |
| Mazatlán | $28,000 | $23,500 | $30,000 |
| Tenacatita | $20,000 | $16,000 | $19,000 |
| Manzanillo | $18,500 | $15,000 | $20,000 |

---

## Lo vacío también es un dato

**CDMX, Puebla, la Huasteca, Barrancas y Cancún están en blanco**, y eso no es
una lista incompleta: **a esos no se va y se vuelve en un día**.

La regla se explica sola. Todo lo que tiene celda cabe en un día; todo lo que
no cabe está vacío.

> Costó llegar ahí. Mi lector del Excel tomaba las celdas vacías como si
> tuvieran el valor de la siguiente, y con ese dato falso le reporté al dueño
> que CDMX tenía $16,000 dominical. **Está vacía.** Y sobre ese error construí
> una teoría entera sobre que dominical no era un solo producto. Ver
> [[errores-que-ya-pague]].

---

## Lo de Ocotlán es un PRECIO, no un recargo

Su fila 27 vale completa: **no se le suma el recargo de salida encima**.

Se ve en que **Mazamitla y Tapalpa salen más baratos desde allá** —les quedan
más cerca—, y un recargo no puede restar nunca.

Sin esa guarda, Vallarta dominical desde Ocotlán daba $28,000 en vez de sus
$22,000.

---

## Y Mazatlán no es un error

Son ~500 km por lado, o sea **mil kilómetros en el día**. Se le señaló como el
único que no cuadraba y contestó: *«Mazatlán sí, por eso los precios están
caros en Maza»*.

Ahí está la explicación: **no es que su dominical sea barato, es que Mazatlán
es caro justamente porque es ese viaje.** $23,500 por un día es de los
renglones más caros de la fila; Vallarta, a la mitad de distancia, cuesta
$16,000.

---

## Cuidados al implementarlo

**La fecha se lee por partes**, nunca con `new Date(texto)`: eso es medianoche
UTC —el sábado aquí— y el viaje se cotizaría como normal, perdiendo la tarifa.

**Va en las DOS puertas**, `cotizar` y `pagar`. Si faltara en cualquiera, se
enseñaría un precio y se cobraría otro: hasta $12,000 en Vallarta.

---

Relacionado: [[precio-de-lista]] · [[de-donde-salen]] ·
[[como-se-arma-un-precio]] · [[MAPA]]

Texto completo: `docs/CRITERIO-DE-PRECIOS.md`, reglas R31, R43 y R44.
