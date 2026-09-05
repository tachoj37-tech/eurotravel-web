# La unidad que falta dar de alta

**Dictado del dueño el 4-sep-2026. NO está en `unidades.js` todavía, y
es a propósito.**

---

## Lo que se sabe

| | |
|---|---|
| Nombre dicho | **«el G8»** — dictado, sin confirmar cómo se escribe |
| Pasajeros | **51** |
| Modelo | **2026** — es la más nueva del parque |
| Fotos | **no hay.** El dueño las va a conseguir |

---

## Por qué no está dada de alta

Dos razones, y las dos son de las que cuestan caro si se ignoran.

**El nombre no está confirmado.** El dueño dijo «G8» dictando. Todo el
resto de la flota es Irizar —i6, i6S, PB, Century— y el fabricante tiene
un modelo **i8**, así que lo más probable es que sea el *Irizar i8* y que
«G8» sea del dictado. Pero *probable* no alcanza: el bot **le enseña el
nombre de la unidad al cliente y le manda su foto**. Nombrar mal la
unidad estrella es de las cosas que se ven a la primera y no se pueden
desdecir.

Ya pasó una vez en esta misma conversación: el dueño la llamó «Grisar
I6CC» y resultó ser el i6S.

**No hay fotos.** Y hay una prueba —en `pruebas/probar-conversacion.cjs`—
que exige que toda unidad del catálogo tenga su carpeta en
`img/unidades/`. No es burocracia: el bot ofrece la unidad y enseguida
manda su foto. Una unidad sin fotos es una que el bot ofrece y luego no
puede enseñar, justo en el momento en que el cliente está decidiendo.

---

## Qué hacer cuando lleguen las fotos

1. Confirmar el nombre con el dueño: **¿Irizar i8, o de verdad G8?**
2. Poner las fotos en `img/unidades/<id>/`, nombradas
   `<id>-01.jpg`, `<id>-02.jpg`, … como las demás.
3. Registrarlas en `medios-unidades.js` con su cantidad y su video.
4. Darla de alta en `unidades.js` con `max: 51` y `modelo: 2026`.
5. Correr `node pruebas/correr-todas.cjs`.

Con `modelo: 2026` el bot la va a nombrar sola al ofrecer las unidades —
como ya hace con el i6S de 2023—. Una unidad nueva se dice, no se calla.

---

## Y de paso, el estado de la flota al 4-sep-2026

| Unidad | Pax | Escalón | Modelo |
|---|---|---|---|
| **Irizar Century** | 47 | Clásico — presupuesto corto | — |
| **Irizar PB** | 47 | Turismo — «Century mejorado» | — |
| **Neobus** | 50 | Turismo — a la par del PB | — |
| **Irizar i6** | 47 | Premium | — |
| **Irizar i6S** | 51 | Premium | 2023 |
| **el G8** | 51 | el más nuevo | **2026** |

Dos apuntes que no se ven en la tabla:

- **Hay dos Centurys de 49**, y aun así el catálogo dice 47. El número
  que el bot promete es el que aguantan todos: si dijera 49 y llegara
  uno de 47, dos personas se quedan paradas.
- **No hay nada entre 21 y 46 pasajeros.** Se brinca de la Sprinter (20)
  al autobús (47). El bot lo dice de frente cuando el grupo cae en ese
  hueco, en vez de subirlos a un camión de 47 sin avisar.
