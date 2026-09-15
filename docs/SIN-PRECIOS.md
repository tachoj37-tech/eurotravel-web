# R47 · Ningún precio para nadie

> **15-sep-2026 · Sprinter vuelve a cotizar en línea.** Decisión del dueño:
> la página cotiza **solo la Sprinter** con precio y se aparta pagando el
> anticipo con Stripe, **también el solo ida**. Camiones y Suburban siguen sin
> precio: los cotiza un asesor. Se encendieron los dos interruptores
> (`api/_tarifa.js` y `cotizacion.js`). Lo que mantiene fuera a los camiones no
> es el interruptor sino `cotizadorAutomatico` (solo la Sprinter) y
> `UNIDADES_QUE_COTIZAN`; `soloDelCriterio` sigue mandando a asesor los
> destinos que no están en el criterio. Las pruebas que exigían «apagado»
> cambiaron de lado con nota, y ahora exigen además que con el interruptor
> encendido los camiones no den precio ni se cobren. Textos de portada, meta y
> caja de contacto: la Sprinter «tiene precio en línea», lo demás «te lo
> cotiza un asesor». El resto de este documento es la historia de R47.

**12-sep-2026.** Lo dictó el dueño así:

> «Exacto, ningún precio para nadie. Lo que hace el bot es mandar el mensaje
> con el ticket de la cotización para que el vendedor vaya a esa misma
> conversación, dé precio y continúe la conversación. En estas conversaciones
> no hay IA de por medio, solo humanos.»

> «Cuando se usa el cotizador de la página y el cliente selecciona confirmar,
> se le manda un mensaje con el ticket como te mencioné. De momento no hay
> precio: se manda con el ticket que generan por WhatsApp, y ahí es donde la
> IA aprende de precios para que cada mes añada nuevos precios al cotizador.»

---

## Lo que había, y lo que cuesta apagarlo

De las once unidades del catálogo, **una sola cotizaba: la Sprinter**. Las
demás ya pasaban por un vendedor desde antes. Así que «ningún precio» es un
cambio más chico de lo que suena, pero toca lo único de la página que
comprometía dinero:

| | Antes | Ahora |
|---|---|---|
| Sprinter a 43 destinos | $19,000 en pantalla | «Solicitar cotización» |
| Botón de apartar | «Aparta con $4,000» | no aparece |
| `/api/pagar` | creaba la sesión de Stripe | 422 «requiere asesor» |
| Las otras diez unidades | ya iban con vendedor | igual |

---

## Cómo está hecho: un interruptor, no un borrado

```
api/_tarifa.js      const PAGINA_DA_PRECIOS = false;   ← el de verdad
cotizacion.js       var  PAGINA_DA_PRECIOS = false;    ← la copia del navegador
```

**El cálculo NO se tocó.** Todo lo de abajo de ese renglón sigue vivo y
probado —los 50 destinos del Excel, la fórmula por kilómetros, el dominical,
los movimientos—, porque lo necesitan tres cosas que no son la página:

- el bot de WhatsApp, para estimar
- la pantalla del dueño, donde revisa de dónde sale un costo
- el aprendizaje de precios, que compara lo que él cobró contra lo calculado

Lo que se apagó son **las dos puertas públicas**: `/api/cotizar` y
`/api/pagar`. Las dos, y no una: cerrar solo la primera dejaría que una
petición armada a mano apartara un viaje con folio, contrato y cobro. Es la
misma lección que dejó escrita R46, y está probada rompiéndola a propósito.

Y va como **argumento del servidor**, nunca como campo del cuerpo: el cuerpo
lo escribe el navegador, y el navegador es del cliente.

### Por qué hay dos copias del interruptor

La del navegador existe para que la pantalla no mande una petición cuya
respuesta ya conoce: sin ella, cada búsqueda diría «Calculando kilómetros…»
un segundo para acabar enseñando la misma caja. No es un candado —el candado
es el del servidor— y `pruebas/probar-sin-precio.cjs` exige que las dos digan
lo mismo, para que el día que se encienda no se quede una apagada.

---

## El mensaje por WhatsApp, y el único detalle que no se puede saltar

El dueño lo pidió así: *«el bot le manda mensaje por WhatsApp al cliente con
su ticket y confirmación»*.

**Hay un obstáculo que no es de código:** WhatsApp solo deja escribirle
primero a alguien con una **plantilla aprobada por Meta**, y las plantillas ya
se descartaron (`docs/SEGUIMIENTO.md`, 8-sep-2026). Un cliente que cotiza en
la página y deja su número **nunca ha escrito al WhatsApp**, así que no hay
conversación y el bot no puede abrirla.

Lo que sí se puede, y es lo que quedó hecho:

```
  1 · El cliente confirma en la página
        → la solicitud SALE YA, al vendedor. No depende de nada más.
  2 · En el acuse aparece un botón verde con su viaje YA ESCRITO
        «Hola, quiero cotizar este viaje:
         Guadalajara → Puerto Vallarta
         21 oct 2026, 08:00 → 23 oct 2026, 18:00
         Sprinter»
  3 · Él le da enviar  →  se abre la conversación y la ventana de 24 h
  4 · El bot arma el ticket
  5 · El vendedor contesta el precio EN ESA MISMA CONVERSACIÓN
  6 · De ahí se aprende el precio
```

Un solo toque de más, y a cambio: conversación abierta, ticket armado,
recordatorio de 22 horas funcionando y precio aprendido. **Y no se pierde
nada si no lo pica**, porque el paso 1 ya ocurrió: esto mejora la solicitud,
no la sostiene.

---

## Lo que quedó abierto

### 1 · El bot todavía cotiza la Sprinter

El dueño dijo «ningún precio para nadie» **incluyendo el bot**. La página ya
no cotiza; el bot sí, porque comparte el catálogo y su rama está en vuelo.

**Es un renglón**, en `unidades.js`:

```js
{ id: 'sprinter', cat: 'sprinter', cotizadorAutomatico: false, … }
```

Y el bot ya tiene el camino hecho para cuando eso pase: con
`cotizadorAutomatico` en falso *«se le entrega la solicitud armada; quien
conteste solo pone el precio»* (`bot.js`, línea 3855).

**No se hizo desde aquí a propósito.** Ese renglón mueve más de cien
aserciones de las pruebas del bot —`probar-venta`, `probar-whatsapp-precio`,
`probar-conversacion`— y reescribirlas desde este worktree es exactamente el
pisón que la regla del proyecto manda evitar. Le toca a la rama del bot, con
este documento en la mano.

### 2 · «Cada mes añada nuevos precios al cotizador»

Esta mitad **necesita una decisión del dueño antes de escribirse**, porque
choca de frente con lo de arriba:

> Cuando el sistema aprende el precio de un viaje, ¿la página empieza a
> enseñarlo sola —y entonces ese destino deja de ser «ningún precio»—, o cada
> precio necesita su «va» antes de salir en público?

Hoy todo lo demás funciona con lo segundo: la **compuerta del dueño** ya
existe y el bot no da un precio sin su visto bueno. Lo sensato es que esto
vaya igual, pero es su decisión y no se supone.

Y falta la pieza de abajo, que no depende de esta decisión: **el almacén no
existe en producción** (`docs/EL-CIRCULO-DE-APRENDER-PRECIOS.md`). Sin él,
«ir aprendiendo» no acumula nada entre un viaje y el siguiente.

### 3 · Los avisos que hablaban de un total

Tres textos de la pantalla prometían un total que ya no existe, y **ninguno
lo cazó una prueba**: se cazaron abriendo la página y caminando el cotizador
completo, porque viven dentro de plantillas armadas a pedazos.

- «el precio todavía se puede mover… la tarifa queda firme»
- «Cada día con movimientos se cobra aparte y se suma a tu total»
- «Ya está sumado al total de arriba» (dos veces)

Arreglados, y ahora los vigila `probar-sin-precio.cjs` por lo que **dicen** y
no por dónde están. La prueba está atada al interruptor: el día que se
encienda el cotizador, esas frases vuelven a ser ciertas y deja de exigir que
no estén — para que nadie tenga que borrar una prueba para encender algo.

---

## Cómo volver a encenderlo

Un renglón en cada archivo, y las pruebas dicen si se olvidó alguno:

```
api/_tarifa.js    PAGINA_DA_PRECIOS = true
cotizacion.js     PAGINA_DA_PRECIOS = true
```

Nada más. Ni las puertas ni el cálculo ni la pantalla necesitan otro cambio:
las dos puertas preguntan por el interruptor en vez de traer un `true`
escrito a mano, justamente para esto.

---

## Lo que lo vigila

`pruebas/probar-sin-precio.cjs` — 42 comprobaciones, vistas en rojo antes que
en verde. Cuida, en orden de gravedad:

1. Que por las dos puertas no salga número, ni para los del Excel
2. Que el cliente no lo pueda encender desde el cuerpo de la petición
3. Que el cálculo NO se haya roto —sin la opción, da lo mismo que siempre—
4. Cero llamadas de pago a Google por un precio que no se va a enseñar
5. Que los dos interruptores digan lo mismo
6. Que la pantalla no prometa un total
7. Que el acuse ofrezca WhatsApp, con el número del config y no a mano

`probar-cotiza-vs-cobra.cjs` **enciende el interruptor a propósito** para que
sus 25 viajes sigan comparando cuentas de verdad —con todo en cero
«coincidirían» aunque una estuviera rota— y lo vuelve a apagar al final para
exigir lo contrario. `probar-cotizacion.cjs` hace lo mismo con la regla del
kilómetro del navegador.
