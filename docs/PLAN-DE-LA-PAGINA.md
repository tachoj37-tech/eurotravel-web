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

### Fase 0 · La limpia (lo primero que pidió) — **HECHA el 12-sep-2026**

> El recorrido completo y lo que encontró está en
> **`docs/FASE-0-RECORRIDO.md`**. La batería que lo vigila es
> **`pruebas/probar-recorrido.cjs`** (31 comprobaciones).
>
> **Cuatro cosas rotas, arregladas:** dos unidades con la foto rota —el G8
> y el Century, y las fotos sí existían—; los tres «Cotizar esta unidad»
> del inicio que abrían el cotizador vacío; los dos «Entrar» que con los
> campos vacíos contestaban «Ese correo o esa contraseña no son»; y el
> código del correo que se mandaba a medias y gastaba uno de los cinco
> intentos.
>
> **Una decisión espera al dueño:** la banda de «Renta de autobuses» habla
> de cuatro modelos y hubo que escoger con cuál abre el cotizador. Va el
> **G8**. Si prefiere otro, es cambiar un atributo.
>
> **Lo que se dejó anotado a propósito:** el paso de *Tus datos* acepta un
> teléfono de dos dígitos y un correo sin arroba. Hoy no truena; en la
> fase 2 sí, porque ahí ese teléfono se vuelve el único hilo con el
> cliente. Se arregla allá, junto con el formato que haya que exigir.

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

### Fase 1 · El cotizador no inventa precios — **HECHA el 12-sep-2026**

> El detalle está en **`docs/FASE-1-SOLO-DEL-CRITERIO.md`**. La batería es
> **`pruebas/probar-solo-del-criterio.cjs`** (123 comprobaciones), con los
> 50 destinos de la lista congelados en cuatro duraciones cada uno.
>
> La regla se llama **R46** y vive en `api/_tarifa.js`. Las dos puertas
> públicas —`/api/cotizar` y `/api/pagar`— piden `soloDelCriterio`; el bot y
> la pantalla del dueño no, y ahí la fórmula sigue viva. La opción es un
> argumento del servidor, no un campo del cuerpo: el cliente no la puede
> apagar.
>
> **Lo que el dueño tiene que ver:** de los 79 destinos que ofrece el
> buscador, **43 siguen cotizando solos y 36 pasan a un vendedor**. Entre
> esos 36 están los traslados locales —aeropuerto, Expo, Akron, Auditorio
> Telmex, la zona metropolitana—, que son de los más pedidos. Ponerles
> renglón en el Excel los devuelve al cotizador sin tocar código.
>
> **De paso:** un destino de fuera ya no le cuesta dos llamadas de pago a
> Google, y sin la llave configurada deja de contestar 503.

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

### Fase 2 · Cuando no hay precio, se queda con el cliente — **HECHA el 12-sep-2026**

> Lo que se hizo está en **`docs/FASE-2-3-NO-SE-PIERDE.md`**, con la fase 3.
> Lo vigilan `pruebas/probar-solicitud.cjs` (66) y `pruebas/probar-captura.cjs` (37).
>
> **Salió mejor de lo planeado en una cosa:** la caja no sale solo cuando el
> destino está fuera del criterio, sino en **los tres caminos sin precio** —y
> el que faltaba era el más transitado de todos, el de los camiones, que ni
> siquiera enseñaba caja—.

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

### Fase 3 · El mensaje que le llega a él, y el que le llega al vendedor — **HECHA A MEDIAS el 12-sep-2026**

> **Lo que sí quedó:** los dos mensajes escritos, la ficha del vendedor armada
> con `_tickets.armaTicket` —el mismo del bot, con sus mismos botones— y los
> dos saliendo **por correo**.
>
> **Lo que falta, y por qué:** mandarlos por WhatsApp. La única puerta de
> salida a WhatsApp está en `api/whatsapp.mjs` y lleva tres candados que
> costaron caro —el filtro de salida, el freno de la CLABE ajena y la lista
> blanca del teléfono del dueño—. Abrir una segunda salida sin ellos sería un
> hueco, y copiarlos sería peor: dos copias son dos copias hasta que alguien
> toca una.
>
> **Le toca a la rama del bot**, que es donde vive esa puerta: llamar a
> `_solicitud.paraWhatsApp()` y mandar los dos mensajes. La ficha ya sale
> hecha. Son pocas líneas allá y cero riesgo aquí.
>
> Y la decisión de abajo —a qué número escribe la página— **quedó contestada
> sola**: la página no manda a ningún número, así que no tiene que saber si
> hoy es Dualhook o mañana Kommo. Quien lo sepa es el bot, como debe ser.

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

### Fase 4 · El botón de WhatsApp — **HECHA el 12-sep-2026**

> El flotante abre WhatsApp con el mensaje ya escrito, y si el cliente ya
> escogió viaje, el mensaje lleva su ruta, sus fechas y su unidad. Dictado del
> dueño: «va a abrir el whatsapp que estamos trabajando con kommo, ve
> ajustando la ruta».
>
> **Y salió un bug de dinero al empezarla.** Había OCHO `wa.me` en cuatro
> archivos con **dos números distintos**, y cuatro de ellos mandaban al número
> del TELÉFONO. Entre esos cuatro, el botón «Enviar por WhatsApp» del resumen
> de la cotización — el momento de mayor intención de compra de la página.
>
> Ahora el número vive en **un solo lugar** (`config.js`, y `WHATSAPP_PUBLICO`
> para el servidor): el día de la mudanza a Kommo es cambiar un renglón, no
> acertarle a ocho. Lo vigila `pruebas/probar-whatsapp-de-la-pagina.cjs`.
>
> **Lo que dejó abierto:** el chat de la página se quedó sin botón visible.
> Está anotado en `docs/PREGUNTAS-ABIERTAS.md` — le toca a la rama del bot.



Flotante, en todas las vistas, con el texto ya escrito para que el cliente
solo le dé enviar:

> «Hola, estoy viendo su página y quiero cotizar un viaje.»

Y si viene desde el cotizador, el mensaje ya trae la ficha del viaje.

**Detalle que se paga si se olvida:** el enlace `wa.me` abre la aplicación
en celular y WhatsApp Web en computadora. Hay que probarlo en los dos, y
hay que probar qué pasa con quien no tiene WhatsApp instalado.

### Fase 5 · El vendedor cierra — **ESPERA A LA RAMA DEL BOT**

Ya existe casi todo: el vendedor contesta el precio y el bot se lo pasa al
cliente, con los atajos de fotos, cuenta y contrato. Lo que falta es que un
viaje **que entró por la página** llegue a ese mismo tablero.

> **Y resultó ser lo mismo que faltaba en la fase 3**, lo cual es una buena
> noticia: las dos se cierran con un solo cambio, y no es de este lado.
>
> La ficha de la página ya se arma con `_tickets.armaTicket` —el MISMO ticket
> del bot— y `_solicitud.paraWhatsApp()` la entrega hecha. Lo que falta es
> mandarla por WhatsApp, y esa puerta vive en `api/whatsapp.mjs` con sus tres
> candados (ver la fase 3).
>
> **El día que se mande, se cierran tres cosas de un golpe:** el aviso al
> vendedor (fase 3), el viaje en su tablero (fase 5) y el aprendizaje de
> precios (`docs/EL-CIRCULO-DE-APRENDER-PRECIOS.md`) — porque el precio que
> él conteste a ese ticket entra al almacén como cualquier otro.

---

## Y encima de todo: R47, ningún precio para nadie

**12-sep-2026.** El dueño cortó por lo sano y dejó corta la fase 1: no es que
la página no dé un precio que no salió del criterio, es que **no da ninguno**.
Ni del criterio.

> «Exacto, ningún precio para nadie… cuando se usa el cotizador de la página y
> el cliente selecciona confirmar, se le manda un mensaje con el ticket… de
> momento no hay precio.»

De las once unidades solo cotizaba una —la Sprinter—, así que el cambio cabe
en un interruptor: `PAGINA_DA_PRECIOS`, en `api/_tarifa.js` y su copia en
`cotizacion.js`. El cálculo entero sigue vivo y probado, porque lo necesitan
el bot, la pantalla del dueño y el aprendizaje de precios.

**Y esto adelanta las fases 3 y 5 sin tocar el bot.** El acuse ahora le abre
WhatsApp al cliente con su viaje ya escrito. Cuando él le da enviar, la
conversación existe —que es lo único que Meta no deja abrir desde este lado— y
de ahí en adelante ocurre solo lo que faltaba: el ticket, el vendedor
contestando en esa misma conversación, el recordatorio de 22 horas y el precio
aprendido.

Lo que queda abierto —el bot, que todavía cotiza la Sprinter, y qué pasa
cuando un precio se aprende— está en **`docs/SIN-PRECIOS.md`**.

---

## Después de las fases: los abonos

**12-sep-2026.** Con las fases 0 a 4 cerradas se retomó el spec del
25-ago —`docs/superpowers/specs/2026-08-25-abonos-en-linea-design.md`— y se
hicieron sus **pasos 1 a 3**, que son los que no dependen de EuroSystem:

| | |
|---|---|
| `api/_saldo.js` | el saldo contado desde Stripe, sin guardar copia |
| la caja de abonar | en la pantalla del viaje, con el monto validado en el servidor |
| «recibido con éxito» | preguntándole a Stripe, no a la dirección de regreso |

**El cliente ya abona de verdad y su pantalla dice la verdad.** Lo que falta
es el paso 4 —registrar el abono en EuroSystem— y necesita las dos puertas de
allá, que no existen: `docs/QUE-FALTA-PARA-LOS-ABONOS.md`.

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
