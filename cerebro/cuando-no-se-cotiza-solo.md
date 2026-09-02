# Cuando el precio lo tiene que dar una persona

Hay tres casos. Ninguno es una falla: son los límites de lo que se puede
cobrar sin que alguien mire.

---

## 1 · La unidad no es Sprinter

**Solo la Sprinter tiene `cotizadorAutomatico: true`** en `unidades.js`.

Autobuses y Suburban: el precio lo da una persona. No es capricho — el precio
de un autobús depende de cosas que el catálogo no tiene.

Pero eso **no** significa despachar al cliente. El bot le pregunta todo igual y
entrega una solicitud armada. Ver [[el-bot]].

---

## 2 · Arriba de 1,400 km · **R45, la regla que manda**

> «Si no sabes un precio al 100 %, no se lo compartas al cliente: le dices que
> un vendedor lo va a contactar.» — 1-sep-2026

Pasando los 1,400 km, un destino que **no esté en su lista** ya no se cotiza.
No es que la fórmula no dé un número: es que ese número no se sabe.

La propia R16 lo dejó escrito: **$9,800 de error promedio** contra $1,534 del
tramo corto. Y la razón: sus precios largos no son función del kilómetro
—Oaxaca $75,000 a 1,988 km y Barrancas los mismos $75,000 a 2,882—.

> **Antes de R45 esto era código muerto.** `requiereAsesor` no lo ponía nadie:
> un viaje de 20,000 km cotizaba **$709,900**. Números inventados con cara de
> precio.

`requiereAsesor: true`, y **todos los montos vienen en cero**. El cero importa
tanto como el aviso: la pantalla sabe leer un cero y decir lo correcto; un
número a medias lo cobraría.

**Los de su lista siguen cotizando**, por lejos que estén: Cancún a 4,282 km,
Barrancas a 2,882, Chiapas a 2,848. Ésos son precios suyos, no estimaciones.

Y el camino de vuelta está abierto: **el día que le ponga precio a un destino
lejano, entra al catálogo y se cotiza solo.** Monterrey fue el primero en
recorrerlo (R46).

> `requiereAsesor` es de los pocos campos que `_publico.js` deja salir. Se
> agregó a sabiendas: sin él la pantalla enseñaba **«$0»** y el cliente creía
> que el viaje era gratis.

---

## 3 · No se pudo medir la ruta

Si el destino **no está en la lista** hay que medirlo con Google, y si eso
falla no hay fórmula que aplicar. Se avisa; no se inventa.

Si **sí está en la lista**, no importa: su precio es cerrado y no necesita
kilómetros.

---

## Lo que el cliente NUNCA debe ver

Ni el kilometraje, ni la tarifa por kilómetro, ni la tarifa por noche, ni de
qué renglón del Excel salió el precio.

Con el total y los kilómetros juntos **se despeja el precio por kilómetro**, y
eso es entregarle la lista de precios a la competencia.

Lo cuida `api/_publico.js` con una lista blanca de campos. Agregar un renglón
ahí es una decisión, no un descuido: la pregunta antes de hacerlo es *¿con esto
y el total en la mano, se puede deducir una tarifa?*

Hay dos pruebas dedicadas: *«nunca se filtra el kilometraje ni ninguna tarifa»*
y *«ni de qué renglón de la lista salió»*.

---

Relacionado: [[como-se-arma-un-precio]] · [[el-bot]] · [[quien-manda]] ·
[[MAPA]]
