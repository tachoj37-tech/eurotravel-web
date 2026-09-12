# La página: limpia y cotizador que no inventa

Escrito el 11-sep-2026, en el worktree `pagina-web` (rama
`worktree-pagina-web`), para no mezclarlo con el trabajo del bot.

---

## Lo que el dueño pidió, en sus palabras

> «Vamos a hacer una limpia en la que vas a ver que todo el cotizador
> funcione correctamente. Vas a ver que todos los botones funcionen
> perfectamente: los inicios de sesión, las contraseñas y el resend.»

> «No me gustaría que el cotizador pueda cotizar si el cotizador **no**
> tiene el precio desde el criterio de precios. Si no, le mando un mensaje
> por WhatsApp diciéndole que se le va a mandar una cotización.»

> «Preferiblemente que ponga el número de teléfono o correo… para que aquí
> el número de teléfono sea el que le vaya a mandar mensaje a él. Le va a
> mandar justamente la ficha de su viaje… y ahí es donde el vendedor va a
> ver ese mensaje y le va a lanzar la cotización con el botón de fotos de
> unidad.»

---

## Lo que se encontró al abrirla (verificado, no supuesto)

La página levanta limpia:

| | |
|---|---|
| Errores de consola | **0** |
| Peticiones fallidas | **0** — las 30 en 200 |
| Vistas | inicio, unidades, cotizaciones, sobre nosotros, contacto |

Y el cotizador está **mejor de lo que parecía**. Se probó llamando a
`/api/cotizar` de verdad:

| Lo que se pide | Lo que contesta hoy |
|---|---|
| Camión (Irizar i6S) a Vallarta | **422 · «unidad no cotizable»** + «escríbenos» |
| Sprinter a Vallarta | 200 · $19,000 — **del criterio** |
| Sprinter a Tepic | 200 · $16,900 — **del criterio** |
| Sprinter a un lugar inventado | por fórmula de kilómetros |

Y el catálogo está completo por el lado de la Sprinter:

```
destinos en el catálogo:  50
  con precio de Sprinter: 50   ← todos
  con precio de camión:   41
  sin ningún precio:       0
```

### O sea que el hueco es UNO, y es chico

**El camión ya está frenado.** Ese trabajo está hecho.

Lo que queda abierto es el **destino que no está en los 50**: hoy se calcula
con la fórmula por kilómetros y sale un número que **no salió del Excel de
nadie**. Ése es exactamente el que el dueño no quiere que se dé.

Y lo segundo: cuando el cotizador dice que no, hoy dice «escríbenos» y ahí
se acaba. **No captura nada.** El cliente que no escribe, se pierde sin
dejar rastro.

---

## Las fases

### Fase 0 · La limpia (lo primero que pidió)

Recorrer la página entera con el navegador y dejarlo escrito como batería,
para que no haya que volver a recorrerla a mano:

- Las cinco pestañas y que cada una enseñe lo suyo
- Todos los botones: los de cotizar, los de «cotizar esta unidad», el
  carrusel de destinos, el chat
- Las fotos: que ninguna quede rota (hoy cargan las 30, y así debe seguir)
- **Iniciar sesión**: el código por correo, las casillas del código, el
  reenvío, y qué pasa con un código equivocado o vencido
- El calendario: fechas, ida y vuelta, sencillo
- En celular, no solo en computadora

**Entregable:** un reporte de lo que esté roto y la batería que lo vigila.
Nada se arregla en esta fase salvo lo que esté roto de verdad.

### Fase 1 · El cotizador no inventa precios

La regla, dicha como la dijo el dueño: **si el precio no sale del criterio,
no se da precio.**

- Destino dentro de los 50 **y** unidad cotizable → cotiza, como hoy
- Cualquier otra cosa → **no da número**, y pasa al camino de la fase 2

Se apaga el camino de la fórmula por kilómetros para el público. No se
borra —sirve para que el bot y el dueño estimen— pero deja de darle precios
a un cliente.

> Esto toca dinero, así que va con su batería: los 50 destinos siguen dando
> exactamente el mismo número que hoy, uno por uno. Si alguno cambia un
> peso, la prueba lo caza.

### Fase 2 · Cuando no hay precio, se queda con el cliente

Hoy se pierde. Lo que va en su lugar:

```
  «Para este viaje te paso el precio a la medida.
   ¿A qué número te lo mando?»

   [ tu WhatsApp ]   o   [ tu correo ]
```

- **Uno de los dos basta**, no los dos: cada campo de más es gente que se va
- Con lo que ya llenó en el cotizador se arma **la ficha del viaje**:
  a dónde, cuándo, cuántos, qué unidad
- Al mandar: **acuse en la misma pantalla**, no un mensaje que quizá no llega

### Fase 3 · El mensaje que le llega a él, y el que le llega al vendedor

**Al cliente**, por WhatsApp (o correo, según lo que haya dejado):

> Recibimos tu solicitud 🚐
> Guadalajara → San Miguel de Allende
> 20 al 23 de diciembre · 40 personas · autobús
> Te mandamos tu cotización en breve.

**Al vendedor**, la misma ficha, para que conteste con el precio. Es el
mismo camino que ya usa el bot para los tickets, así que el vendedor no
tiene que aprender nada nuevo: le llega igual que los de WhatsApp, y con los
mismos botones —incluido el de **mandar fotos de la unidad**.

> **Lo que hay que decidir antes de escribir esto:** a qué número escribe la
> página. Hoy el bot vive en Dualhook y va a mudarse a Kommo. Si la página
> manda por Dualhook, el día de la mudanza hay que cambiarlo también. Lo
> sensato es que la página no sepa a dónde manda: que se lo pregunte a una
> sola variable, la misma que use el bot.

### Fase 4 · El botón de WhatsApp

Flotante, en todas las vistas, con el texto ya escrito para que el cliente
solo le dé enviar:

> «Hola, estoy viendo su página y quiero cotizar un viaje.»

Y si viene desde el cotizador, el mensaje ya trae la ficha del viaje.

**Detalle que se paga si se olvida:** el enlace `wa.me` abre la aplicación
en celular y WhatsApp Web en computadora. Hay que probarlo en los dos, y
hay que probar qué pasa con quien no tiene WhatsApp instalado.

### Fase 5 · El vendedor cierra

Ya existe casi todo: el vendedor contesta el precio y el bot se lo pasa al
cliente, con los atajos de fotos, cuenta y contrato. Lo que falta es que un
viaje **que entró por la página** llegue a ese mismo tablero.

---

## El orden, y por qué

Primero la **fase 0**, porque arreglar sobre algo roto es trabajar dos
veces. Después la **1**, que es la que evita dar un precio equivocado —lo
único de esta lista que cuesta dinero de verdad—. Las fases 2 y 3 van
juntas o no sirve ninguna: capturar un contacto al que nadie escribe es
peor que no capturarlo.

La 4 se puede adelantar en cualquier momento: no depende de las otras y es
la más rápida de todas.

---

## Lo que NO se toca en este worktree

El bot de WhatsApp, su motor (`bot.js`) y sus pruebas. Van por su rama. Si
algo de la página necesita un cambio en el motor, se anota aquí y se hace
allá — un cambio en `bot.js` desde aquí se pisaría con el otro trabajo.
