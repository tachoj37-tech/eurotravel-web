# Fase 1 · El cotizador no inventa precios

Hecha el **12-sep-2026**, en el worktree `pagina-web`.

> «No me gustaría que el cotizador pueda cotizar si el cotizador **no**
> tiene el precio desde el criterio de precios. Si no, le mando un mensaje
> por WhatsApp diciéndole que se le va a mandar una cotización.»

---

## Qué cambió, en una línea

Si el destino no tiene renglón en el criterio, **la página ya no da número**:
dice que lo cotiza un vendedor. La fórmula por kilómetros sigue existiendo,
pero deja de tener acceso al público.

## Cómo se hizo

La regla se llama **R46** y vive donde viven las demás reglas del dinero,
en `api/_tarifa.js`. El cálculo del traslado tenía tres respuestas y ahora
tiene una más, en este orden:

| | |
|---|---|
| Precio dominical | sale del Excel → **se da** |
| Precio de lista | sale del Excel → **se da** |
| **`soloDelCriterio`** | **no salió del Excel → lo cotiza un vendedor** ← nuevo |
| Más lejos que el tope | ya pasaba a un vendedor (R45) |
| Fórmula por kilómetros | sigue viva para quien no pide la opción |

**`soloDelCriterio` es un argumento del servidor, no un campo del cuerpo de
la petición.** Es lo que impide que se pueda apagar desde fuera: el cuerpo
lo escribe el navegador, y el navegador es del cliente. Mandar
`soloDelCriterio: false` en el JSON no revive la fórmula, y hay una prueba
que lo intenta.

### Las dos puertas públicas lo piden

- **`/api/cotizar`** — la que enseña el precio.
- **`/api/pagar`** — la que lo cobra.

La segunda importa tanto como la primera. Sin ella, cerrar el cotizador no
habría servido de nada: una petición armada a mano podía apartar un viaje al
precio de la fórmula, con folio y contrato de por medio, aunque la pantalla
nunca hubiera enseñado ese número. No hizo falta un freno nuevo — el que ya
estaba para los viajes largos (`requiereAsesor`) lo para solo.

### Dónde sigue viva la fórmula

- **El bot de WhatsApp** (`api/whatsapp.mjs`), que la usa para estimar.
- **La pantalla del dueño** (`pendiente/prueba-cotizador-api.js`), donde se
  revisa de dónde sale un costo.

Ninguno de los dos pide la opción, y hay una prueba que se pone roja si
alguien se las pone «por consistencia».

## Lo que se ve en la pantalla

No hubo que inventar nada: la página ya sabía qué decir cuando el servidor
no da precio, porque ese camino existía para los viajes muy largos.

> **TARIFA** · Te la enviamos hoy mismo
>
> Este viaje lo cotiza un vendedor: te contacta hoy mismo con tu precio.
> Continúa con tus datos y te respondemos el mismo día hábil con la tarifa
> cerrada.

Y el resumen final dice «Revisa y **envía tu solicitud**» en vez de «aparta
tu viaje»: no ofrece pagar un anticipo de un precio que no existe.

**Un detalle que sí hubo que arreglar:** la tarjeta del resultado traía una
línea verde —«Cotización en línea disponible para esta unidad»— que habla de
la *unidad* y se pinta antes de preguntarle al servidor. Con el destino
fuera del criterio quedaba justo encima de «Te la enviamos hoy mismo»: dos
cosas contrarias en la misma tarjeta. Ahora se corrige a «Este destino se
cotiza a la medida».

---

## Lo que el dueño tiene que saber: cuántos destinos se quedan sin precio

El buscador de la página ofrece **79 destinos**. Con la regla nueva:

| | |
|---|---|
| Siguen cotizando solos | **43** |
| Pasan a un vendedor | **36** |

Los 36 no son todos lugares lejanos. Los más pedidos son de aquí mismo:

**En la zona de Guadalajara** — Guadalajara, Zapopan, San Pedro Tlaquepaque,
Tonalá, Tlajomulco, El Salto, **Aeropuerto (GDL)**, **Central de Autobuses
Nueva**, **Expo Guadalajara**, **Estadio Akron**, **Auditorio Telmex**.

**En Jalisco** — San Sebastián del Oeste, Lagos de Moreno, Ciudad Guzmán,
Autlán de Navarro.

**Fuera** — Colima, Comala, Aguascalientes, Dolores Hidalgo, Querétaro,
Tequisquiapan, Bernal, Teotihuacán, San Luis Potosí, Saltillo, Torreón,
Durango, Chihuahua, Veracruz, Puerto Escondido, Huatulco, Taxco, Cuernavaca,
Tepoztlán, Mérida, Chichén Itzá.

> **Los traslados locales · RESUELTO el 12-sep-2026.** Se le preguntó si el
> aeropuerto, la central, la Expo, el Akron y la zona metropolitana debían
> entrar al cotizador con renglón propio en el Excel, o quedarse con un
> vendedor. Contestó:
>
> > *«los servicios locales mándalos con vendedor»*
>
> Así que se quedan como están, y **a propósito**. Ya no es un hueco que
> alguien deba cerrar: es una decisión suya, con fecha. El día que quiera
> cambiarla, basta con ponerles renglón en el Excel — entran solos al
> cotizador, sin tocar una línea de código.

Y no se pierden: caen en la caja de captura de la **fase 2**, que les pide su
WhatsApp o su correo y le manda la ficha del viaje al vendedor.

## De paso: la página deja de pagarle a Google

Antes, cotizar un destino fuera de la lista costaba **dos llamadas de pago a
la Routes API** —ida y vuelta— para calcular un número que ahora no se va a
dar. Con la regla nueva ya no se mide: si no va a haber precio, no hay nada
que medir.

Y un efecto que se vio al probarlo: antes, sin `GOOGLE_ROUTES_KEY`
configurada, esos destinos contestaban **503 «Cotizador en línea no
configurado»** y el cliente veía un error del servidor. Ahora ve lo que tiene
que ver.

---

## Las pruebas

**`pruebas/probar-solo-del-criterio.cjs`** — 123 comprobaciones, nueva.

Lo más importante que trae es una **foto de los 50 destinos de la lista,
tomada antes de tocar nada**: cada uno en cuatro duraciones —1, 2, 4 y 8
días—, 200 números congelados. Si la regla nueva moviera un peso de un
precio que sí sale del criterio, se cae ahí.

También cuida que la fórmula siga viva para el bot, que las dos puertas
públicas pidan la opción de verdad —se lee el código, no se supone—, que el
cliente no la pueda apagar desde el cuerpo, y que ni el dominical ni el
rechazo de camiones se hayan roto de paso.

**`pruebas/probar-cotiza-vs-cobra.cjs`** — ocho comprobaciones cambiaron de
lado, y cada una lleva escrito al lado por qué. Eran las que probaban que un
destino fuera de la lista **sí** se medía y **sí** se cotizaba por fórmula:
justo lo que el dueño pidió que dejara de pasar. La aritmética de la fórmula
no se quedó sin quien la cuide —sigue probada en `probar-tarifa.cjs`, que
llama al cálculo directo—, y el caso del desglose con movimientos se rehízo
sobre un destino que sí está en la lista.

Batería completa: **4384 buenas, 0 malas, 74 archivos**. Y
`probar-despliegue.cjs` en 21/21 — no se agregó ningún archivo a `api/`, que
es lo que rompería el despliegue de Vercel.

## Probado en la página, no solo en las pruebas

| Viaje | Antes | Ahora |
|---|---|---|
| Guadalajara → Puerto Vallarta, 4 días | $19,000 | **$19,000** |
| Guadalajara → Tequila, 2 días | $7,000 | **$7,000** |
| Guadalajara → Querétaro | precio por fórmula | **«lo cotiza un vendedor»** |
| Guadalajara → Colima | precio por fórmula | **«lo cotiza un vendedor»** |

Con 0 errores de consola, y el resumen final de los dos últimos sin ofrecer
apartar.
