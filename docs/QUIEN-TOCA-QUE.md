# Quién toca qué, mientras haya dos ramas vivas

Escrito el 12-sep-2026, cuando el trabajo se partió en dos sesiones:

| Rama | Qué se trabaja ahí |
|---|---|
| `main` | El bot de WhatsApp, Kommo, los precios aprendidos |
| `worktree-pagina-web` | La página: limpia, cotizador, botón de WhatsApp |

El dueño lo dijo así, y tenía razón a medias:

> «No creo que se pisen, porque la página es la página y el chatbot es el
> chatbot. Lo único que tienen en común son los criterios y esa conexión
> que hay entre el botón de WhatsApp y todo eso.»

Los criterios sí. Pero hay una tercera cosa compartida, y es más grande que
las otras dos.

---

## Lo compartido, medido (no supuesto)

### 1 · `bot.js` — el motor entero corre en los dos lados

Esto es lo que no estaba en la cuenta. `index.html` carga el archivo:

```html
<script src="bot.js"></script>
```

y el chat de la página lo usa tal cual (`bot-navegador.js`):

```js
r = window.BOT.respuestaA(texto, estado);
```

O sea: **el mismo archivo que es el cerebro del bot de WhatsApp también
corre en el navegador de cada cliente que abre la página.** Son 5,000
líneas y 78 baterías de pruebas colgando de él.

Tocarlo desde la rama de la página no rompe «el chat de la página»:
rompe el bot que está atendiendo clientes reales por WhatsApp.

### 2 · El criterio de precios

`api/_destinos.js` (los 50 destinos y sus precios), `api/_tarifa.js` (cómo
se arma el número) y `api/_cotiza-nucleo.js`, que lo dice en su propio
comentario:

```js
const nucleo = require('./_cotiza-nucleo'); // el calculo, compartido con el bot
```

Lo usan `api/cotizar.js` y `api/pagar.js` (la página) y `api/whatsapp.mjs`
(el bot). Un peso que cambie aquí cambia en los dos.

### 3 · El catálogo de unidades

`unidades.js` y `medios-unidades.js`: los nombres, las capacidades y las
fotos. Los lee la página para su selector y el bot para sus tickets.

---

## Lo que NO se comparte, y se puede tocar sin miedo

| Solo del bot | Solo de la página |
|---|---|
| `api/whatsapp.mjs` | `index.html`, `viaje.html` |
| `api/_agente.js`, `_entender.js` | `cotizacion.js`, `lugares.js` |
| `api/_almacen.js`, `_tickets.js` | `movimientos.js`, `config.js` |
| `api/_etapas.js`, `_seguimiento.js` | `bot-navegador.js` (solo la pantalla) |
| `api/_whatsapp-webhook.js` | `api/cuenta.js`, `pedir-codigo.js` |
| `api/_precios-aprendidos.js` | `api/verificar-codigo.js`, `places.js` |

Ahí no hay choque posible: cada rama manda en lo suyo.

---

## La regla, en una línea

> **Los tres archivos compartidos se tocan SOLO desde `main`.**

`bot.js`, el criterio de precios y el catálogo de unidades.

Si la página necesita un cambio en alguno —por ejemplo, que el cotizador
deje de dar precios por fórmula, que vive en `_tarifa.js`— **no se hace en
la rama de la página**: se anota y se hace en `main`. Después la rama de la
página trae el cambio con un `git merge main` y sigue.

Es más lento en un día y más rápido en la semana: un conflicto en
`_tarifa.js` es un conflicto en el archivo del que sale el dinero.

### Y el botón de WhatsApp

Es página pura, con una excepción: **a qué número escribe**. Ese dato no
debe quedarse escrito dentro de `index.html`, porque el día que el bot se
mude de Dualhook a Kommo habría que cambiarlo en dos sitios y uno se
olvidaría.

Va en `config.js` —que es de la página— leyendo la misma variable de
entorno que use el bot. Así la mudanza se hace en un lugar.

---

## Cómo se comprueba que no se pisaron

Antes de mezclar la rama de la página a `main`:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
git diff main...worktree-pagina-web --stat
```

Si en esa lista aparece `bot.js`, `api/_destinos.js`, `api/_tarifa.js`,
`api/_cotiza-nucleo.js`, `unidades.js` o `medios-unidades.js`, **hay que
mirar ese cambio archivo por archivo** antes de mezclar nada.

Y siempre, las dos baterías completas después de mezclar:

```bash
node pruebas/correr-todas.cjs      # 12-sep-2026: 4447 buenas, 0 malas
node pruebas/probar-despliegue.cjs # 21 buenas · 12 funciones de 12
```
