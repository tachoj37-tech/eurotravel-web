# Cómo se arma un precio, de principio a fin

Un total sale de **cuatro sumandos**, siempre en este orden. Si un precio no
cuadra, casi siempre es que uno de los cuatro se calculó de más o se cobró dos
veces.

Todo esto vive en `api/_tarifa.js`, y es la **misma** función que usan
`/api/cotizar` y `/api/pagar`. Que sean la misma no es comodidad: es lo único
que garantiza que se cobre lo que se cotizó. Lo vigila
`pruebas/probar-cotiza-vs-cobra.cjs`.

---

## 1 · El traslado

De ida y vuelta.

**Si el destino está en la lista del Excel** → ese precio, cerrado. Los
kilómetros no lo mueven. Ver [[precio-de-lista]].

**Si no está** → fórmula:

```
$6,500 de base  +  $22 por kilómetro
```

Arriba de **1,400 km** el kilómetro sube a **$36**, y ahí ya
[[cuando-no-se-cotiza-solo|lo cotiza una persona]] (R16).

> La base y el precio por kilómetro **los calibré yo** contra sus 40 precios
> reales. No salieron del Excel. Está en [[lo-que-no-se]] y es de las cosas
> que más conviene que él confirme: esa fórmula cotiza todo destino que no esté
> en su lista, o sea la mayoría de lo que pide un cliente.

**Solo ida** se cobra al **65 %** del redondo.

---

## 2 · Las noches

Tres incluidas, y **$1,000** por cada una a partir de la cuarta. Ver
[[noches-y-estadia]].

---

## 3 · Los movimientos

**$3,000** el día, y sube con las horas. Pero hay tres formas de que no se
cobren, y confundirlas cuesta dinero. Ver [[movimientos]].

---

## 4 · El recargo por la salida

Si no salen de la zona de Guadalajara, puede sumar. **Solo si el destino no
les queda de camino.** Ver [[de-donde-salen]].

---

## Y encima de los cuatro

**El piso: $3,000 por día de servicio.** Existe para que una unidad apartada
muchos días no se cobre como un paseo.

Manda en **237 de 588 combinaciones** de destino y duración — más de un tercio
de la tabla. Chapala a 7 días sin piso serían $9,500; con piso son **$24,000**.

> Este número **tampoco salió del Excel**: lo puse yo. Está en [[lo-que-no-se]].

**El redondeo:** el total se corta a la centena de abajo.

**El anticipo:** 20 % para apartar la unidad.

**El IVA ya viene dentro** de todos los precios de lista. Por eso «no cobrar
IVA» nunca puede significar dividir entre 1.16 — eso sería cobrar 16 % menos.
Ver [[el-bot]].

---

## El orden importa

El recargo de salida se suma **al final**, después del piso. Así los días y los
movimientos se calculan igual salgan de donde salgan, y lo único que cambia es
el extra. Si se sumara antes, el piso lo absorbería y el recargo desaparecería
en los viajes largos.

```
total = traslado + noches + movimientos + recargo de salida
```

---

Relacionado: [[precio-de-lista]] · [[noches-y-estadia]] · [[movimientos]] ·
[[de-donde-salen]] · [[MAPA]]
