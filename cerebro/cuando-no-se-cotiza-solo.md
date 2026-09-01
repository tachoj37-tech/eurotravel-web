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

## 2 · Arriba de 1,400 km (R16)

Pasando ese kilometraje la fórmula se vuelve menos fiable, y el kilómetro sube
de $22 a **$36**.

`requiereAsesor: true`, y **todos los montos vienen en cero**. Eso es a
propósito: si viniera un número, el cliente lo creería.

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
