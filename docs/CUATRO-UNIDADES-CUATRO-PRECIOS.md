# Los Centurys y los i6 son cuatro unidades, no dos

**12-sep-2026.** Dictado del dueño, palabra por palabra:

> «irizar century 47 es uno, irizar century de 49 es otro, lo mismo con el i6
> de 47 y 51, **son unidades con diferentes precios, no los pongas en una
> misma unidad**»

---

## Por qué tenía razón

No es un matiz de conteo de asientos. Son **precios distintos**, renglón por
renglón, en su propio Excel:

| destino | «BUS N C 47 PAX» | «BUS 48/49 PAX» | diferencia |
|---|---:|---:|---:|
| Tequila | $12,000 | $13,000 | $1,000 |
| Puerto Vallarta | $32,000 | $33,000 | $1,000 |
| Zacatecas | $38,000 | $39,000 | $1,000 |
| **Mazatlán** | **$38,000** | **$40,000** | **$2,000** |

Hasta hoy el catálogo tenía **un solo Century** —«47 a 49 pasajeros»—
colgando de las **dos** columnas. Cuál de los dos precios se enseñaba dependía
de cuál columna se leyera primero.

Los dos i6 ya estaban separados desde el 10-sep, y por la misma razón.

---

## Cómo quedó

**Cuatro unidades en el cotizador**, cada una con su columna:

| en el selector | capacidad | su columna del Excel |
|---|---|---|
| Irizar i6 | 47 | «PB/i6 47 pax» |
| Irizar i6 51 | 51 | «NEOBUS/i6 50/51 PAX» |
| Irizar Century | 47 | «BUS N C 47 PAX» |
| Irizar Century 49 | 49 | «BUS 48/49 PAX» |

**En la galería siguen siendo ocho tarjetas**, una por modelo de camión. Las
fotos y el equipamiento son los mismos, así que dos tarjetas idénticas solo
confundirían; la ficha del modelo anuncia la otra, diciendo que el precio es
otro:

> *Hay otro Century, de 49 pasajeros. Es una unidad distinta, con su propio
> precio; se elige en el cotizador.*

> **Si prefieres verlas también como tarjeta aparte en «Unidades»**, es
> quitarles una bandera (`soloCotizador`). Se dejó así porque tu instrucción
> anterior fue *«en la misma pestaña de la unidad ofrece el hecho de que hay
> otra alternativa de pasajeros»*.

### El margen de asientos sale solo

El `max` de compromiso ya no hace falta. Antes el Century era uno con tope 48
—para dejar un asiento libre, como pediste el 7-sep—. Ahora cada uno tiene su
capacidad real y el grupo cae donde le toca:

| el grupo es de | se le ofrece |
|---|---|
| 46 | los dos Centurys |
| 47 | los dos |
| 48 | **solo el de 49** (con un asiento libre) |
| 49 | solo el de 49, lleno |
| 50 | ninguno de los dos |

Queda una pregunta abierta en `docs/PREGUNTAS-ABIERTAS.md`: si un grupo de 49
debe poder pedir el de 49 lleno, o si ahí también quieres un asiento de sobra.

---

## Un bug que se cazó en el camino

Al partir el Century, lo primero que se intentó fue nombrarlos **«Irizar
Century 47»** e **«Irizar Century 49»**. Se rompió algo peor:

> **«el i6 de 47» pasaba a escoger un Century.**

El bot escoge camión por *«una palabra que sea SUYA y de nadie más»*. Al meter
el «47» en el nombre del Century, ese número se volvió palabra exclusiva suya,
y cualquier mensaje que lo trajera lo escogía. Un cliente pidiendo un i6 y
cotizándosele otro camión: **$34,000 contra $32,000** en Vallarta.

La salida es la que el proyecto ya había elegido para los i6: **el número va
solo en el nombre de la variante**. «Irizar Century» es el de 47 e «Irizar
Century 49» el otro, igual que «Irizar i6» e «Irizar i6 51». La capacidad se
ve igual, porque el selector enseña «nombre · capacidad».

Comprobado después del arreglo:

| se dice | escoge |
|---|---|
| «el i6 de 47» | Irizar i6 ✔ |
| «el i6 de 51» | Irizar i6 51 ✔ |
| «el century» | *pregunta cuál* ✔ |
| «el century de 49» | Irizar Century 49 ✔ |
| «el de 49» | Irizar Century 49 ✔ |

---

## Y esto también cambió el bot

`unidades.js` lo comparten la página y el bot. **No se tocó `bot.js`** —el
catálogo es uno solo y así debe ser— pero por WhatsApp ahora:

- Se ofrecen **nueve** unidades en vez de ocho.
- Un grupo de 48 o 49 encuentra el Century de 49.
- «el century» a secas ya no escoge: pregunta cuál, igual que «el i6».
- El ticket del vendedor enseña **una sola columna** del Excel por unidad, la
  que le toca. Antes el Century enseñaba dos y él tenía que escoger.

---

## Lo que lo vigila

| | |
|---|---|
| `pruebas/probar-capacidades.cjs` | 40 · las cuatro unidades, sus columnas y sus fotos prestadas |
| `pruebas/probar-precio-de-camion.cjs` | 137 · cada número contra su renglón del Excel |
| `pruebas/probar-i6-de-51.cjs` | 51 · que los nombres no se confundan entre ellos |

Lo que más importa de todo esto cabe en dos comprobaciones:

```
ok   el Century de 47 trae una sola columna
ok   el Century de 49 trae una sola columna
ok   ninguna unidad lee más de una columna
ok   «el i6 de 47» no nombra a ningún Century
```
