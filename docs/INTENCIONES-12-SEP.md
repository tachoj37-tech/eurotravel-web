# Intenciones del dueño · 12-sep-2026, para trabajar mañana

Dictadas de una vez, a propósito: *«prefiero decirte las intenciones de una vez…
Seguimos [trabajando] después, pero quiero ir pasando INTENCIONES»*.

**Nada de esto está hecho.** Este archivo es la libreta, no el plan. El plan se
escribe cuando estén contestadas las preguntas del final.

---

## 1 · Que la página deje de dar precio

> «quiero que el asesor no cotice automáticamente»

Hoy la Sprinter a un destino del criterio **sí** enseña su precio en pantalla:
Guadalajara → Puerto Vallarta, 4 días, sale **$19,000** y el cliente puede
apartar con $4,000 sin hablar con nadie.

Lo que él quiere es que eso deje de pasar y que **todo** pase por un asesor.

**CONTESTADO el 12-sep-2026**, y no deja lugar a dudas:

> «**ningún costo**, cuando el asesor escriba el costo en el whatsapp tú irás
> aprendiendo de él o confirmando tu precio»

O sea: **la página no enseña ninguna cifra a nadie**. Ni la Sprinter a
Vallarta, que hoy sale con sus $19,000 y su botón de apartar.

Y la segunda mitad de la frase es la que vale oro, porque dice cómo se cierra
el círculo del punto 4:

| el sistema | el asesor | qué pasa |
|---|---|---|
| no tenía precio para ese viaje | lo escribe en WhatsApp | **lo aprende** |
| sí tenía uno calculado | escribe el mismo | **se confirma** — el sistema se va calificando |
| sí tenía uno calculado | escribe otro | aprende el suyo, y queda constancia de en cuánto falló |

Eso último —«**o confirmando tu precio**»— es nuevo y es la llave: el sistema
sigue calculando por dentro, callado, y **se compara contra lo que el dueño
cobra de verdad**. Cuando acierte lo suficiente, ahí sí puede volver a cotizar
solo. Sin eso, «ir aprendiendo» no tendría manera de saber si va bien.

> **Ojo con el tamaño de esto.** La fase 1 cerró el camino de los precios
> inventados; esto cierra también el de los precios buenos. Es un cambio de
> cómo vende la página, no un ajuste. Y arrastra una consecuencia: **hoy se
> puede apartar un viaje en línea con tarjeta, y sin precio en pantalla no hay
> nada que apartar.** El botón de «Aparta con $4,000» y el cobro con Stripe se
> quedan sin entrada — está en las preguntas de abajo.

> **Y una cosa que ya quedó lista sin saberlo.** El asesor escribe el precio
> «en el whatsapp» contestando su ticket, que es como el bot ya aprende desde
> el 5-sep. La ficha que manda la página se arma con `_tickets.armaTicket` —el
> MISMO ticket del bot— precisamente para que él no tuviera que aprender otro
> formato. Habría que comprobar que, por ser el mismo ticket, el precio que
> conteste también entre al almacén de precios aprendidos: si entra, el
> círculo de la página ya está cerrado del lado del bot y solo falta el
> almacén en producción.

## 2 · El número, y luego confirmar

> «quiero hacer que el cliente, después de que cotice, ponga su número y,
> cuando la ponga, continúe a confirmar»

La caja de captura de la fase 2 ya hace la primera mitad —pide UN dato,
WhatsApp o correo— pero **solo cuando no hay precio**. Lo que él pide es que
sea el camino de todos, y que después del número venga **una pantalla de
confirmar**, no el acuse y ya.

Hoy: cotizar → (si no hay precio) caja → acuse en la misma pantalla.
Él quiere: cotizar → número → **confirmar** → se manda el mensaje.

## 3 · El mensaje que se manda solo

Lo dictó casi entero:

> «Hola, su cotización de tal tal, de Vallarta a Vallarta, en Sprinter tal,
> **con movimiento los días 1 y 2**, se cotizará en un momento. Un asesor se
> contactará para darle precio y seguimiento.»

Contra lo que ya existe, le falta una cosa al acuse de la fase 3: **los días
con movimiento, enumerados**. Hoy el acuse dice ruta, fechas, personas y
unidad, pero no los movimientos. Y los movimientos ya se capturan —el paso de
datos los pide— así que es dato que se está tirando.

> «El mensaje es como un formulario para mandar ese mensaje por ahí.»
>
> **Esto no lo entendí** y está en las preguntas de abajo.

> «Siga la venta de momento.» — el flujo de venta no se corta: después del
> mensaje el cliente sigue su camino.

## 4 · La visión: aprender precios hasta no necesitar el mensaje

> «Después me gustaría que tú vayas aprendiendo de precios y que el consumidor
> pueda funcionar sin necesidad de que haya este mensaje. Mientras, me gustaría,
> para mí, que vayas aprendiendo. Quiero, de verdad, que vayas aprendiendo de
> los criterios de precio para esto.»

**Esto ya tiene motor, y es suyo.** El 5-sep dictó: *«yo te pongo el precio y
te aprendes el viaje; si alguien va a hacer el mismo viaje me vas a recomendar
ese precio; irás generando un criterio de los precios que te vaya diciendo»*. De
ahí salió `api/_precios-aprendidos.js`, que ya define «el mismo viaje» —misma
zona de salida, mismo destino, misma unidad, mismos días— y `npm run
precios:cerebro`, que vuelca lo aprendido a `docs/PRECIOS-QUE-HE-DADO.md`.

Lo que falta para cerrar su círculo:

1. Que los precios que da por **la página** (no solo por WhatsApp) entren al
   mismo almacén.
2. Que cuando un viaje ya tenga precio aprendido, la página lo pueda dar sola
   — que es literalmente «el consumidor pueda funcionar sin necesidad de que
   haya este mensaje».

> **Pero el almacén todavía no existe en producción.** Está la lógica y está el
> volcado; lo que no hay es dónde guardar. Sin eso, «ir aprendiendo» no
> acumula nada entre un viaje y el siguiente.

## 5 · El portal de abonos por folio (NUEVO, 12-sep-2026)

Sale de preguntarle qué hacer con el cobro en línea al quitarle el precio a la
página. Contestó dos cosas: apagar lo de hoy y **poner otra cosa en su lugar**.

> «no, apágala de momento, vas a agregar una nueva que es que el cliente va a
> poder poner su contrato, su folio […] el vendedor pone su folio, el sistema
> le confirma el folio para que el cliente pueda ver que sí es el suyo, el
> sistema le dice "eso es un viaje de tal a tal que costó tanto y del cual ya
> se abonó tanto", y en esa pantalla el cliente va a poder abonar más. Entonces
> el vendedor va a poder dar ese link y que vaya abonando […] estos abonos se
> irán al sistema y se marcarán como abonos confirmados porque Stripe no puede
> devolver el dinero. Entonces ese dinero entró, entonces desde esa página sí
> entra el abono en el viaje en el sistema, confirmado.»

Traducido a pasos:

1. El vendedor genera el contrato y su folio, como hoy.
2. Le pasa al cliente **una liga**.
3. El cliente **teclea su folio** y el sistema se lo confirma: «Guadalajara →
   Vallarta, costó $X, ya abonaste $Y».
4. Ahí mismo **abona lo que quiera**, las veces que quiera.
5. Cada abono entra al sistema **como confirmado**.

**Apagar el apartado de hoy es el punto 1 de su respuesta y va primero:** sin
precio en pantalla, el botón de «Aparta con $4,000» no tiene qué apartar. El
código de Stripe se queda dormido, no se borra.

### DOS COSAS QUE HAY QUE DECIRLE ANTES DE ESCRIBIR ESTO

Las dos están fundadas en su propio código, no en una opinión mía.

**1 · Un folio tecleado no puede ser la única llave.** Los folios son
consecutivos: quien teclee el suyo y luego los de al lado ve los viajes de
otros clientes —a dónde van, cuándo, cuánto pagaron y su nombre—. Y esta
lección ya está escrita en `api/viaje.js`, que es la pantalla del viaje que ya
existe:

> «Si se preguntara primero, una liga inventada nos haría consultar sesiones
> ajenas —una por intento— y eso ya es una fuga: **quien prueba identificadores
> se entera de cuáles existen**, aunque nunca le contestemos con los datos.»

Por eso esa pantalla se abre con **liga firmada** y no con un número tecleado.
Salidas, todas baratas:

- El folio se teclea, pero además **un segundo dato que solo él tiene** — los
  últimos cuatro de su teléfono, o su correo.
- O la liga que le manda el vendedor **ya va firmada** y el folio solo sirve
  para que el cliente confirme que es la suya (que es literalmente lo que él
  pidió: «para que el cliente pueda ver que sí es el suyo»).

La segunda es la que menos le cambia la idea y la que ya tiene motor —
`_ligas.js` firma ligas desde hace semanas—.

**2 · «Stripe no puede devolver el dinero» no es exacto, y el proyecto ya se
quemó con eso.** Un reembolso o un contracargo sí saca el dinero de la cuenta.
Está escrito en `api/_reversas.js`, con su cicatriz:

> «LO QUE HABÍA ANTES: NADA. Se comprobó mandándole un `charge.refunded` al
> webhook: contestaba "200 · ignorado". Stripe lo daba por entregado y NUNCA
> reintentaba. **Nadie se enteraba nunca.**»

Que el abono entre «confirmado» está bien —el dinero entró de verdad— pero el
sistema tiene que poder **descontarlo si se revierte**, o un contracargo deja
un viaje pagado que nadie pagó. El módulo ya existe; lo que hay que cuidar es
que los abonos nuevos pasen por ahí como pasan los anticipos.

### Lo que falta saber

- **¿Por dónde entra el abono a EuroSystem?** La única puerta documentada
  entre la página y el sistema es `POST /api/contratos/externo`
  (`../EUROSYSTEM/CONTRATOS-API.md`). Hay que ver si acepta abonos sobre un
  contrato que ya existe, o si hace falta abrirle una.
- **¿De dónde sale «ya se abonó tanto»?** Hoy la pantalla del viaje le
  pregunta a Stripe. Los abonos que el vendedor cobre por fuera —transferencia,
  efectivo— no los conoce Stripe, y si no se cuentan, el saldo que ve el
  cliente estará mal. Probablemente el saldo tenga que venir de EuroSystem.
- **El plan Hobby publica doce funciones y hay doce.** Esto necesita puerta
  propia: va como acción dentro de una que ya existe —`viaje.js` es la
  candidata natural— igual que se hizo con la solicitud dentro de `cotizar.js`.

---

## Un malentendido, aclarado

> «Cuando estés, como me dices, siempre el margen del 10%, propósito, no sé de
> qué hablas.»

**Tiene razón en no saber de qué hablo: nunca hubo ningún 10%, ni ningún margen
de ganancia.** Fue una palabra mía mal escogida.

Cuando escribí «margen» hablaba de **un asiento libre**, no de dinero. Venía de
su propio dictado del 7-sep sobre el Century: *«Si son 48, lo ofreces. Si son
49, no lo ofreces»* — o sea, al Century de 49 nunca se le metían 49 personas,
siempre quedaba **un lugar de sobra** por si aparecía alguien más el día del
viaje. A eso le dije «margen», y se entendió como margen comercial.

De aquí en adelante, en este proyecto, **«margen» es dinero y nada más**. Un
asiento de sobra se dice «asiento libre».

Y su respuesta a lo que sí preguntaba —*«Sí, cuestan distinto 47 y 49»*—
confirma lo que ya quedó hecho hoy: los dos Centurys y los dos i6 son cuatro
unidades separadas, cada una leyendo su columna del Excel.

---

## Lo que no entendí, y no voy a suponer

1. ~~¿deja de haber precio en pantalla para todos?~~ **CONTESTADA:** ningún
   costo, para nadie. Ver arriba.

2. **«El mensaje es como un formulario para mandar ese mensaje por ahí»** —
   ¿quiere decir que la pantalla de confirmar se vea como un formulario con el
   mensaje ya escrito, para revisarlo antes de que salga? ¿O que el mensaje se
   mande por WhatsApp abriendo la app, como el botón de «Enviar por WhatsApp»
   que ya existe?

3. **¿A quién le llega ese mensaje?** Su dictado dice «su cotización», o sea
   al cliente. ¿Y al vendedor le sigue llegando su ficha aparte, como quedó en
   la fase 3?

4. ~~¿qué pasa con apartar en línea?~~ **CONTESTADA:** se apaga, y en su lugar
   va el portal de abonos por folio del punto 5.

5. **Del portal de abonos: ¿cómo se abre?** Un folio tecleado a secas deja ver
   los viajes ajenos. Ver las dos salidas en el punto 5.

---

## Dónde encaja con el plan por fases

| | |
|---|---|
| Fase 0 · la limpia | hecha |
| Fase 1 · no inventar precios | hecha |
| Fase 2 · capturar al que no tiene precio | hecha |
| Fase 3 · los dos mensajes | hecha a medias (por correo; WhatsApp le toca al bot) |
| **Esto, parte A** | **ningún precio en pantalla, número + confirmar + mensaje** |
| **Esto, parte B** | **el portal de abonos por folio** |
| **Esto, parte C** | **el círculo: el asesor da precio → se aprende o se confirma** |
| Fase 4 · botón flotante de WhatsApp | sin empezar |
| Fase 5 · el vendedor cierra | sin empezar |

La parte A se monta encima de la 2 y la 3 —que son justamente la caja de
captura y el mensaje— y es la más chica de las tres. La B es una pantalla
nueva con dinero de por medio. La C es la que él más quiere y la que menos
depende de la página: su motor vive en el bot y le falta el almacén.

**Orden sugerido, por si sirve:** A primero, porque es corta y quita el riesgo
de dar un precio; luego C, porque cada día que pasa sin aprender es un precio
que se perdió; la B al final, porque toca dinero y necesita las respuestas de
arriba.
