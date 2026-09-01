# De dónde salen

Los precios del Excel se armaron **saliendo de Guadalajara**. Salir de otro
lado puede costar más — o puede no costar nada.

---

## La regla que lo explica todo (R19)

**El origen suma solo cuando el destino NO le queda de camino.**

Él lo dijo así: *«si un viaje sale de Tequila, tú pensarías que cuesta más,
pero no, porque Tequila está de camino a Vallarta, entonces es el mismo
precio»*.

Y ojo: **de camino por carretera, no por mapa**. Dos pueblos pueden verse
cerca y estar del lado contrario de la ruta.

---

## Los dos orígenes que existen

Viven en `api/_origenes.js`.

| origen | del Excel | radio | pueblos |
|---|---|---|---|
| **Ocotlán** | fila 11 | 25 km | Ocotlán, Jamay, Poncitlán, Zapotlán del Rey, Tototlán, La Barca |
| **Yurécuaro** | fila 22 | 22 km | 5 pueblos, y exige que el estado sea Michoacán o Jalisco |

El radio de Yurécuaro es **22 y no 25 a propósito**: los dos orígenes están a
51.2 km, y con 25 cada uno los radios casi se tocaban. Cuando ambos alcanzan,
**gana el más cercano** — sin eso, el precio dependía del orden de una lista.

---

## Dos trampas que ya se pagaron

**El mismo cliente, dos precios.** La lista de pueblos y el radio no coincidían:
Atotonilco entraba por nombre estando a 35 km, y Zapotlán del Rey quedaba fuera
del radio estando en la lista. O sea que el precio cambiaba según si el
navegador mandó coordenadas o no. Ahora los pueblos traen sus coordenadas y una
prueba compara las dos puertas.

**«Ocotlán, Jalisco» en Google.** Su segunda sugerencia es **una calle en
Tonalá**. Sin candado, un cliente de Guadalajara podía llevarse hasta $6,000 de
recargo por elegir mal en el autocompletado. Por eso hay una guarda que rechaza
los municipios de la zona metropolitana.

---

## Chiapas desde Yurécuaro: dejado fuera a propósito

Su Excel dice **$16,500**. Desde Guadalajara son **$85,000**.

No se implementó. Si esa celda fuera un error de dedo, obedecerla costaba
**$68,500 en un viaje**. Cobra los $85,000 y está señalado en [[lo-que-no-se]].

Es la aplicación directa de [[quien-manda|R12]]: no invento el precio, pero
tampoco obedezco a ciegas un número que no puede ser. Lo señalo.

---

## Lo que ya no es pregunta

**R10** —«el precio depende del origen, ignorar por ahora»— **quedó resuelta**
por R19 el 28-ago-2026. Antes la página cobraba precio de Guadalajara salieran
de donde salieran.

**R15**: las tandas de medición salen del centro de Guadalajara. La distancia
depende de la salida, no solo del destino.

---

Relacionado: [[precio-de-lista]] · [[lo-que-no-se]] · [[quien-manda]] · [[MAPA]]

Texto completo: `docs/CRITERIO-DE-PRECIOS.md`, reglas R10, R15, R19, R21.
