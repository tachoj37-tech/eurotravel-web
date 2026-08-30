# Lo que no tengo claro

Pedido por el dueño el 30-ago-2026: *«dame preguntas que tengas para mejorar
criterio, incluye cosas que no tengas tan claras»*.

Están ordenadas por **cuánto dinero mueven**, no por cuánto me inquietan. Cada
una trae lo que la página cobra hoy, para que se pueda contestar mirando un
número y no una abstracción.

Cuando una se conteste, se va de aquí y entra al criterio con su fecha.

---

## A · Números que están cobrando hoy y NO salieron de él

Éstos son los que más me pesan: no son dudas de interpretación, son cifras que
yo puse y que llevan semanas cobrándose.

### A1 · Las bandas de horas arriba de las ocho

Su Excel dice **«MOV SPR $3,000 X DIA»**, y con eso alcanza para un día normal.
Los otros cuatro escalones los inventé yo:

| el día dura | cobra | de quién es |
|---|---|---|
| hasta 8 horas | $3,000 | **suyo**, fila 10 |
| más de 8 y hasta 9 | $3,500 | mío |
| más de 9 y hasta 10 | $4,000 | mío |
| más de 10 y hasta 12 | $4,500 | mío |
| más de 12 | $5,000 | mío |

Vallarta 4 días con 2 movimientos, según cuánto duren: **$25,000 a ocho horas,
$29,000 a catorce**. Cuatro mil de diferencia salidos de mi cabeza.

**Pregunta:** ¿el día se cobra igual dure lo que dure, o sí sube con las horas?
Y si sube, ¿con qué números?

### A2 · El piso de $3,000 por día

Tampoco está en su Excel. Existe para que una unidad apartada muchos días no se
cobre como un paseo, y **manda en 237 de 588 combinaciones** de destino y
duración — o sea que decide más de un tercio de los precios de la tabla.

Chapala a 7 días: sin piso serían $9,500; con piso son **$24,000**.

**Pregunta:** ¿son $3,000 el día? ¿O es otro número, o depende de la unidad?

### A3 · La fórmula para lo que no está en su tabla

**$6,500 de base + $22 el kilómetro**, y arriba de 1,400 km el kilómetro sube a
$36. Los calibré yo contra sus 40 precios reales. Esta fórmula cotiza **todo
destino que no esté en su lista**, que en la práctica es la mayoría de lo que
pide un cliente:

| | | |
|---|---|---|
| Sahuayo | 2 días | $13,500 |
| Comala | 4 días | $17,200 |
| Querétaro | 3 días | $21,900 |
| Bernal | 3 días | $25,400 |

**Pregunta:** ¿estos cuatro están bien? Si alguno está lejos, la fórmula
completa está corrida y conviene saberlo antes del lanzamiento.

---

## B · Cosas que SU Excel dice y la página no cobra

### B1 · Los tres paseos con nombre propio

Su fila 10 les pone precio y la página los cobra como un movimiento normal de
$3,000:

| paseo | su Excel | la página | de menos |
|---|---|---|---|
| **Chalma** (CDMX 3 días) | +$8,000 | $3,000 | **−$5,000** |
| El Meco / El Naranjo (Huasteca 4 días) | +$3,000 | $3,000 | igual |
| Xochimilco (CDMX 1 día) | +$2,000 | $3,000 | +$1,000 |

**Pregunta:** ¿los cobro con su precio? Y si sí, ¿cómo sabe la página que ese
día es Chalma — lo escribe el cliente, o va como casilla aparte?

### B2 · Qué es «DOMINICAL»

Sus filas 25 y 27 se llaman `DOMINICAL SPRINTER` y `DOM SPR OCO`, con precios
mucho más bajos: **CDMX baja de $30,000 a $16,000** e Ixtapa de $29,500 a
$15,000.

Mi mejor lectura es **salida de domingo**: su propio Excel habla de domingos
(«no bus fin», «autobús no dom»), «Century» es un modelo de camión, y los
precios cuadran con la corrida a la Basílica. Pero es lectura mía.

**Pregunta:** ¿qué son esas filas? Y si son domingos, ¿la página debería cobrar
eso cuando el viaje cae en domingo, o es producto aparte que no se cotiza en
línea?

---

## C · Reglas recién puestas donde tomé una decisión

### C1 · Acapulco, ¿estancia o recorrido?

Guayabitos salió de `movimientosIncluidos` porque él lo corrigió: *«hasta 4 días
es ese precio, pero sin movimientos»*. **Acapulco es la misma forma** —«ACAPULCO
4 DIAS», playa, cuatro días— y hoy sí los lleva incluidos.

4 días con 2 movimientos cobra **$60,000**. Si fuera estancia como Guayabitos,
serían **$66,000**.

**Pregunta:** ¿Acapulco cobra sus movimientos aparte?

### C2 · Los cinco destinos que su fila de Ocotlán no menciona

Pagan precio de Guadalajara aunque salgan de Ocotlán:

| | desde Guadalajara | desde Ocotlán | su vecino de lista sube |
|---|---|---|---|
| San Juan Cosalá | $6,500 | $6,500 | Chapala +$4,500 |
| Magdalena | $7,500 | $7,500 | Tequila +$5,000 |
| Zirahuén | $25,000 | $25,000 | Pátzcuaro $0 |
| Tepic | $16,900 | $16,900 | — |
| León | $17,600 | $17,600 | — |

Los tres primeros nacieron anclados a un destino de su lista (R11), así que
podría tocarles el recargo de su vecino.

**Pregunta:** ¿les pongo el de su vecino, o cada uno lleva el suyo?

### C3 · Zacoalco a un día desde Ocotlán

Dijo *«mínimo 9,000»* mirando renglones de dos días. A **un** día da **$8,000**,
porque su precio de lista es $5,000 y el recargo son $3,000.

**Pregunta:** ¿los $9,000 son un piso —y entonces ese caso también sube— o el
recargo de $3,000 es lo que manda?

---

## D · Números de su Excel que huelen raro

Ninguno se implementó como está. Están señalados, no movidos (R12).

| | dice | y eso no cuadra porque |
|---|---|---|
| **Chiapas desde Yurécuaro** | $16,500 | desde Guadalajara son $85,000. **Se dejó fuera**: cobra los $85,000 |
| **Puebla desde Yurécuaro** | +$12,000 | desde Ocotlán no sube nada, y Yurécuaro queda MÁS de camino. Único renglón donde el patrón se invierte. **Sí se implementó** |
| **Huasteca desde Ocotlán** | +$4,000 a 3 días, +$2,000 a 4 | el recargo BAJA al crecer los días, al revés de todos. Y sus 3 días desde Ocotlán ($42,500) son exactamente sus 4 días desde Guadalajara |
| **Camécuaro desde Yurécuaro** | $14,500, igual que Guadalajara | estando a 30 km de Yurécuaro y a 157 de Guadalajara |

---

## E · Cuántos días incluye cada paquete

De cinco paquetes, **dos los confirmó y los dos venían mal**:

| | yo suponía | él dijo |
|---|---|---|
| Tolantongo | 4 | **3** |
| Barrancas | 4 | **7** |

Con Barrancas eran **$9,000 de sobrecobro** en un viaje de seis días. Los otros
tres siguen saliendo solo del nombre de su columna:

- **Cancún** 17 días
- **Chiapas** 8 días
- **Acapulco** 4 días

**Pregunta:** ¿esos tres duran lo que dice su nombre? Si alguno no, su día extra
empieza en el día equivocado y el error crece con cada día de más.

---

## Lo que ya NO es pregunta

Para no volver a abrirlas:

- **Tres noches y $1,000 la cuarta** — confirmado el 30-ago (R25). Antes era
  invento mío generalizado desde Vallarta; ahora es suyo.
- **El viaje de un día no paga movimiento** — R22.
- **Morelia y Mariposa planos hasta la 3ª noche** — se lo presenté como defecto
  y no lo era (R23).
- **Solo ida al 65%** — dictado el 26-ago.
- **El origen suma cuando no queda de camino** — R19 y R21.
