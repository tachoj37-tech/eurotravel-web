# El precio de lista

Si el destino está en el Excel, **ese precio manda y los kilómetros no lo
mueven**. La fórmula es solo para lo que no está en la lista.

Vive en `api/_destinos.js`. La matriz completa —49 destinos × 5 renglones— está
en `docs/LA-SPRINTER-SEGUN-EL-EXCEL.md`.

---

## Un destino puede tener varios precios (R1)

«Talpa 3 días» y «Talpa 4 días» son **dos renglones distintos**, no un precio
con un día sumado. Cada uno es lo que cuesta ese paquete.

Y dentro de esa duración **no se suma una noche** (R2): ya van incluidas.

---

## El día del paquete corre en los dos sentidos (R14)

Si Cancún son 17 días y el cliente quiere 16, **baja $4,000**. No es solo que
suba al agregar días: también baja al quitarlos.

---

## El vecino se ancla a la lista (R11)

Un destino que no está en el Excel pero está pegado a uno que sí —San Juan
Cosalá junto a Chapala, Magdalena pasando Tequila— **toma el precio de su
vecino**, no el de la fórmula.

La fórmula es para lo que no tiene ancla.

> Ojo: esos anclados **no heredan el recargo de salida** de su vecino. Está
> abierto en [[lo-que-no-se]].

---

## Nombres que engañan

**Talpa Burrita NO es «Talpa 4 días»** (R4). Es la peregrinación: otro
producto, otro precio.

**Mariposa / Azufres / Pátzcuaro** es un recorrido propio de **$29,000** (R9),
no la suma de tres destinos.

> La lección de las dos: el nombre de una columna del Excel **no siempre
> describe lo que uno cree**. Cuando el nombre y el precio no cuadran, el que
> tiene razón es el precio.

---

## Y una advertencia sobre precios viejos

Un precio de lista puede quedarse corto sin que nadie lo note: es cerrado, así
que **no se mueve aunque el viaje sí**. Por eso la herramienta interna
`prueba-cotizador.html` pone al lado lo que la fórmula diría con los kilómetros
reales — para ver de un golpe si un precio de lista ya se quedó atrás.

---

Relacionado: [[como-se-arma-un-precio]] · [[de-donde-salen]] ·
[[noches-y-estadia]] · [[MAPA]]

Texto completo: `docs/CRITERIO-DE-PRECIOS.md`, reglas R1, R2, R4, R9, R11, R14.
