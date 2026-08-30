# El criterio de precios

Este documento es el cerebro de precios de la página. Acumula lo aprendido:
cada corrección del dueño queda escrita aquí con fecha, y el código se ajusta
para obedecerla. **Se lee antes de tocar cualquier cálculo de dinero.**

## El mandamiento

**El Excel «LISTA DE PRECIOS 2027» manda.** Todo precio que dé la página tiene
que poderse reconstruir desde un renglón de ese Excel. Si un cálculo da algo
que no está ahí, el cálculo está mal, no el Excel.

De ahí se siguen tres reglas de conducta:

1. **No inventar modelos.** El error más caro hasta hoy no fue un número mal
   copiado: fue una regla inventada (ver el error nº 1).
2. **Calibrar contra TODOS los datos, no contra los que cuadran.** Si el Excel
   trae nueve destinos con varias duraciones, el modelo se prueba contra los
   nueve. Elegir dos y ajustar perillas hasta que cuadren es autoengaño.
3. **Yo no propongo precios** (R12). Enseño qué cobraría la página y señalo lo
   que huela raro; el número lo dicta el dueño.

---

## De un vistazo

| | regla | en una línea |
|---|---|---|
| **R1** | precio por destino y duración | el Excel puede traer varios precios del mismo destino |
| **R2** | los paquetes incluyen sus días | dentro de esa duración no se suma una noche |
| **R3** | CDMX y Huasteca, por día | su precio es un traslado de un día, no un paquete |
| **R4** | Talpa Burrita es otro producto | es la peregrinación, no «Talpa 4 días» |
| **R5** | el Excel puede traer el precio CON movimientos | esa columna manda sobre cualquier suma |
| **R6** | el paso entre escalones NO es el día extra | un día extra deducido se propone, no se aplica |
| **R7** | Guayabitos | hasta 4 días su precio; +$1,000 la noche extra |
| **R8** | Puebla y Zacatlán | día extra $2,000 |
| **R9** | Mariposa/Azufres/Pátzcuaro | recorrido propio, $29,000 |
| **R11** | el vecino se ancla a la lista | la fórmula es solo para destinos sin ancla |
| **R12** | **yo no propongo precios** | el número lo dicta el dueño, siempre |
| **R13** | estadía y movimiento se SUMAN | $1,000 la noche de más + $3,000 el día movido |
| **R14** | el día de un paquete corre en los dos sentidos | Cancún baja $4,000 por día menos |
| **R15** | la medición depende de la salida | las tandas salen del centro de Guadalajara |
| **R16** | arriba de 1,400 km ya se cotiza solo | $36 el km, y menos fiable — saberlo |
| **R17** | hay destinos donde moverse no cuesta | Barrancas: $3,000 el día, se mueva o no |
| **R18** | abajo de $15,000 el día no es gratis | $500 la noche destapada; de la 4ª, los mil de siempre |
| **R19** | el origen suma cuando NO queda de camino | Ocotlán, fila 11; y por carretera, no por mapa |
| **R20** | si no sé un precio, lo saco del Excel | cinco pasos, y siempre digo de qué celda salió |
| **R21** | Yurécuaro entra como origen | fila 22; Chiapas queda fuera por imposible |
| **R22** | el viaje de un día no paga movimiento | salvo CDMX y Huasteca, que lo traen en su base |
| **R23** | Morelia y Mariposa van planas hasta la 3ª noche | y $1,000 de la cuarta; NO es defecto, lo confirmó |
| **R10** | ~~pendiente~~ *resuelta por R19 el 28-ago-2026* | ya no cobra precio de Guadalajara salga de donde salga |

---

## Los errores cometidos, y su lección

### 1. Inventé «3 noches gratis + $1,000 por noche» (detectado 26-ago-2026)

Vi que Vallarta de jueves a domingo costaba $19,000 sin cargo por noche y lo
convertí en regla universal. Consecuencias, todas reales:

- **Cobraba de menos** en viajes cortos de varios días: Guanajuato 3 días daba
  $19,000 en vez de $24,500 (−$5,500); El Manto 3 días, −$5,000; Tlalpujahua
  2 días, −$3,000; Talpa 2 días, −$1,500.
- **Cobraba de más** en paquetes largos: a Cancún 17 días le sumaba $13,000
  de «noches» encima de un precio que ya incluía los 17 días; a Chiapas,
  +$4,000.

**Lección:** la lista no es «traslado + noches». Es **precio por destino y
duración**. Cada columna del Excel con días en el nombre es un precio
completo de ese viaje a esa duración.

### 2. Calibré con 2 casos teniendo 9 (detectado 26-ago-2026)

CDMX y Huasteca no cuadraban con mi modelo de noches, y en vez de tirar el
modelo le agregué los movimientos como segunda perilla hasta que esos dos
dieron exacto. Los otros siete destinos con duración (Talpa, Tlalpujahua,
El Manto, Guanajuato, Tolantongo, Mariposa, Puebla) nunca los verifiqué:
cualquiera habría tumbado el modelo al primer intento.

**Lección:** un modelo que necesitó una perilla nueva para cuadrar es un
modelo bajo sospecha. Verificar contra los casos que NO se usaron para
calibrar.

### 3. Di por hecho lo que no podía probar (26-ago-2026)

Escribí en el código «el Excel traía 1,300,000» cuando no tenía el Excel a la
mano para probarlo. Resultó cierto, pero fue suerte: era una suposición
escrita como hecho.

**Lección:** lo que no se puede probar se escribe como suposición, con el
nombre de quien la hizo.

---

## Las reglas aprendidas (confirmadas por el dueño)

### R1 · Precio por destino y duración (26-ago-2026)

Un destino puede tener varios precios según los días. Van en `porDias` en el
catálogo, copiados del Excel tal cual:

| destino | del Excel | día extra |
|---|---|---|
| Talpa | 1 día $15,000 · 2 días $16,500 | **$1,500** (fila 10) |
| Tlalpujahua | 1 día $23,500 · 2 días $26,500 | **$1,500** (dictado) |
| El Manto | 1 día $14,000 · 3 días $19,000 | **$1,500** (dictado) |
| Guanajuato | mismo día $19,000 · 3 días sin mov $24,500 | **$1,500** (dictado) |
| Puebla | 2 días $36,500 | **$2,000** (dictado) |
| Puebla con Zacatlán | 2 días $39,500 | **$2,000** (dictado) |
| Cancún | 17 días $145,000 | **$4,000** (dictado, y baja — R14) |

Entre duraciones o más allá de la última, se avanza con el `diaExtra` propio
del destino. **Ese número lo dicta el dueño o sale de la fila 10 del Excel —
NUNCA se deduce del paso entre escalones**, que fue el error de R6.

### R2 · Los paquetes incluyen sus días (26-ago-2026)

Una columna con la duración en el nombre —CANCUN 17 DIAS $145,000, CHIAPAS 8
DIAS $85,000— es un paquete completo. **Dentro de esa duración no se suma ni
una noche.** Van con `diasIncluidos` en el catálogo.

### R3 · CDMX y la Huasteca se cobran por día (confirmada 26-ago-2026)

Palabras del dueño: *«son cuatro mil por día extra, pero con movimientos. Si
no tiene movimientos, nomás vas a cobrar mil.»*

- Con movimientos: base + $1,000 por día de estadía + $3,000 por día movido
  (= $4,000 el día completo). Así se reconstruyen al peso CDMX 1/2/3 días y
  Huasteca 3/4 días del Excel.
- **Sin movimientos: base + $1,000 por día.** (Antes las noches salían gratis
  hasta 3 — eso era el modelo inventado.)

> **PUEBLA NO ENTRA AQUÍ**, aunque el dueño la nombró junto a las otras dos.
> Su renglón del Excel guarda el precio completo de 2 días ($36,500), no una
> base a la que se le suman días; su día extra son $2,000 y va por R8.
> Comprobado: Puebla 2 días cotiza $36,500 exactos, y en el código solo CDMX
> y la Huasteca llevan `estadiaPorDia`.
>
> El título de esta regla decía «y Puebla» y se corrigió el 26-ago-2026 al
> releer el documento: contradecía a R8 y al código. **Lección: dos reglas
> que se contradicen en el cerebro son un error esperando salir; este
> documento se relee entero cada tanto, no solo se le agrega al final.**

### R4 · Talpa Burrita es OTRO producto (26-ago-2026)

No es «Talpa 4 días». Es la peregrinación: la gente se va caminando a Talpa y
el camión los va esperando en puntos del camino. Por eso vale $26,500 cuando
Talpa 2 días vale $16,500. Tiene su propio renglón y solo se entra a él si el
texto dice «burrita».

### R5 · Un destino puede traer su precio CON movimientos en el Excel (26-ago-2026)

Tolantongo tiene DOS columnas: «SIN MOV $29,500» y «con mov $34,500». La
segunda **ya lo incluye todo**: ni bandas de horas ni estadía aparte. Antes se
sumaba banda por banda y daba $41,500; el dueño corrigió: *«sí, estás mal,
dalo de acuerdo al Excel»*. Va como `conMovimientos` en el catálogo.

Lección detrás: si el Excel trae una columna para un caso, esa columna manda
sobre cualquier suma de reglas.

**Pero ese precio cubre EL PAQUETE, no cualquier duración** (dictado el
26-ago-2026: *«Tolantongo $1,000 sin movimientos, +$3,000 si hay
movimientos»*). Antes era plano —$34,500 dijeran lo que dijeran los días— y
el día de más no sumaba nada. Pasado el paquete manda R13:

**Y son TRES días, no cuatro.** El día extra empieza en el **cuarto** — lo
dictó el dueño con un «4» el 26-ago-2026, corrigiéndome: yo lo había puesto
con el paquete por omisión de R13 (4 días / 3 noches) y el día cuatro salía
gratis.

| días | sin movimientos | con movimiento cada día |
|---|---|---|
| 3 (el paquete) | $29,500 | $34,500 |
| **4** | **$30,500** | **$38,500** |
| 5 | $31,500 | $42,500 |

Para poder expresarlo hubo que quitar un piso escondido en el código: las
noches incluidas iban con `Math.max(3, …)`, así que **ningún paquete podía
durar menos de 4 días**. Quitarlo no movió a nadie más — Talpa Burrita
incluye 4 días, Chiapas 8, Cancún 17.

### R6 · El paso entre escalones NO es la tarifa del día extra (26-ago-2026)

Deduje el día extra de Guanajuato del paso entre sus escalones —(24,500 −
19,000) / 2 = $2,750— y el dueño lo tumbó el mismo día: *«Guanajuato sí queda
muy caro. Ponlo en mil quinientos el día extra.»*

**Lección:** el salto de una duración del Excel a otra trae adentro más que
días (movimientos previstos, el peso del fin de semana, lo que sea). Sirve
para ubicar los precios ESCRITOS, no para extrapolar. La tarifa del día
extra se le pregunta al dueño siempre que no esté en la fila 10 — un número
deducido se presenta como propuesta, nunca se da por bueno.

Días extra dictados por él hasta hoy: Talpa $1,500 (fila 10), Puebla y
Zacatlán $2,000, Guanajuato $1,500, El Manto $1,500, Tlalpujahua $1,500
(«déjalos en 1500», 26-ago-2026). El patrón que va saliendo: **$1,500 el día
extra de Sprinter casi siempre; $2,000 en los viajes largos tipo Puebla.**
Y los movimientos suman sus $3,000 por día encima, como siempre.

### R7 · Guayabitos, confirmado (26-ago-2026)

«Hasta 4 días» = sus $18,500; cada noche de más suma $1,000. Es el único caso
donde el dueño ha confirmado la tarifa de $1,000 por noche extra.

### R8 · Puebla: día extra de $2,000 (26-ago-2026)

*«Puebla tres días: trae dos días 36,500, y el día tres súbele dos mil.»*
Cuadra con la fila 10 del Excel («$4,000 bus y $2,000 SPR»). Aplica igual a
Puebla con Zacatlán. Nota: Puebla NO lleva la estadía por día de CDMX aunque
el dueño los nombró juntos — su renglón guarda el precio del Excel completo,
no una base.

### R9 · Mariposa/Azufres/Pátzcuaro existe (26-ago-2026)

El dueño mandó crearlo («créalo»): $29,000 Sprinter, $45,000 autobús NC47.
Antes ese texto caía en Mariposa ($23,000) o Pátzcuaro ($25,000).

### R11 · El vecino de un destino de lista se ancla a la lista (26-ago-2026)

De la primera tanda de 20 viajes fuera de catálogo, el dueño corrigió
exactamente los tres que estaban pegados a un destino suyo, y en los tres lo
ancló a su vecino:

| corregido | la fórmula daba | él dijo | su vecino de lista |
|---|---|---|---|
| San Juan Cosalá | $9,400 | **$6,500** | Chapala $6,500 (mismo camino, antes) |
| Magdalena | $9,800 | **$7,500** | Tequila $7,000 (+$500 por seguir de largo) |
| Zirahuén | $18,500 | **$23,000** | Pátzcuaro $25,000 (−$2,000) |

Y confirmó lo contrario: **Villa Corona a $8,800 «está bien»** — no tiene
vecino de lista en su camino, y ahí la fórmula manda. Igual que Tepatitlán,
Ameca, Sayula, Lagos, Aguascalientes, Colima, Autlán, Mascota, La Manzanilla,
Dolores Hidalgo, SLP y Bernal: «de ahí en más, todo bien».

**La regla:** la fórmula es para destinos sin ancla. Si el destino está en el
camino (o pegado) a uno de la lista, el precio sale del de la lista — hacia
arriba Y hacia abajo. Cada corrección entra al catálogo como renglón propio,
como entraron León y Tepic.

**Cómo detectarlo:** al presentar una lista de viajes, señalar todo destino
pegado a uno del catálogo — señalarlo, NO proponerle precio (ver R12).

### R12 · YO NO PROPONGO PRECIOS (26-ago-2026)

Propuse cuatro precios anclados y el dueño me paró en seco: *«para empezar
tú no propongas precios, la tabla se edita con los años, esos precios están
ya por algo, solo quiero ajustar tu criterio».*

**La regla:** mi trabajo es enseñar QUÉ COBRARÍA la página y señalar lo que
huela raro (vecino más barato que la lista, medición absurda). El número lo
dicta él, siempre. Cada precio dictado entra al catálogo tal cual.

Y la prueba de que la tabla no se puede modelar: el mismo día dictó
Zacoalco $5,000 (136 km medidos) y Tequila vale $7,000 a los mismos 136 km.
El precio no es función del kilómetro ni ahí: cada ruta tiene su historia
(cuota, competencia, años de ajustes). Por eso no se extrapola.

### R15 · La medición depende de la SALIDA, no solo del destino (26-ago-2026)

Con origen «Guadalajara, Jalisco, México» a secas, Google resolvía mal la
pareja y salían mediciones absurdas: Tecolotlán a 1,000 km, Colotlán a 4,
Cihuatlán (pegado a Melaque) en $9,000, Querétaro «sin ruta». El dueño dio
la corrección: *«ajusta las salidas desde el centro de Guadalajara para
conseguir los kilometrajes»* — y con «Centro Histórico, Guadalajara» los
cuatro midieron bien al primer intento (Tecolotlán $11,400, Colotlán
$15,600, Cihuatlán $21,000, Querétaro $22,100).

**Regla para evaluar precios:** las tandas de prueba SIEMPRE salen del
centro de Guadalajara. En la página real el cliente elige del autocompletado
(lugar exacto), así que el riesgo vive en el texto tecleado sin elegir
sugerencia con un origen igual de vago. Defensa pendiente: desconfiar de una
medición absurdamente corta o larga para un texto desconocido.

### R13 · Estadía y movimiento se SUMAN; no se excluyen (26-ago-2026)

*«La playa es sencillo: cada noche que supere las 3 noches por defecto son
1000, y si tiene movimientos son 3000 por día — o sea que un día extra con
movimientos son 4000.»*

Yo lo tenía como dos modos que se excluían: en cuanto había **un** movimiento,
las 3 noches incluidas desaparecían y se cobraban $1,000 por **todos** los
días. Vallarta 4 días con 2 movimientos salía en $29,000 en vez de $25,000.

Son dos cobros independientes:

```
noches que pasan de 3  →  $1,000 cada una
días con movimiento    →  $3,000 cada uno
un día extra CON movimiento = 1,000 + 3,000 = $4,000
```

Y ahí está de dónde salen los $4,000 por día de CDMX y la Huasteca: no es una
tarifa aparte, es la suma de las dos. La diferencia es que su precio del Excel
es un **traslado de un día**, no un paquete, así que la estadía se les cobra
desde el primer día y no tienen noches incluidas.

También confirmó la lectura de «hasta 4 días»: *«sí son días, pero son 3
noches»*. Cuatro días = tres noches. El paquete por omisión es ése.

### R14 · La tarifa de día de un paquete corre en los DOS sentidos (26-ago-2026)

*«Cancún, el día está en 4000»* — y en el mismo aliento: *«si el cliente
quiere 15 días solamente serían 8,000 menos del precio que está en la tabla».*

Así que el precio del Excel es un **punto de referencia, no un piso**:

```
Cancún  = $145,000 + (días − 17) × $4,000
   15 días → $137,000     18 días → $149,000

Chiapas =  $85,000 + (días −  8) × $4,000     («Chiapas igual que Cancún»)
    7 días →  $81,000      9 días →  $89,000

Acapulco = $60,000 + (días −  4) × $2,000     («Acapulco 2000 el día»)
    3 días →  $58,000      5 días →  $62,000

Barrancas = $75,000 + (días − 7) × $3,000     («3000 día CON O SIN mov»)
    6 días →  $72,000      8 días →  $78,000
```

Antes el día extra sumaba $1,000 y pedir menos días no descontaba nada.

**Talpa Burrita se queda como está** — el dueño lo revisó y dijo «ok»:
$26,500 por sus 4 días, la noche de más a $1,000 y los movimientos por
banda. Es el único paquete que no descuenta al pedir menos días.

### R17 · Hay destinos donde moverse NO cuesta aparte (26-ago-2026)

*«Barrancas del Cobre, 3,000 el día, con o sin movimientos.»*

Es el primero así: allá el viaje **es** el recorrido, no un traslado con
paseos sueltos, y su banda de horas va apagada. Un día de 13 horas cuesta lo
mismo que uno parado.

Se expresa con `movimientoPorDia: 0` en la tabla de destinos con regla — la
misma donde viven CDMX y la Huasteca. Y ahí salió un defecto latente: el
código leía la tarifa fija con `fijo || banda`, así que **un cero se caía a
la banda por ser falso** y la regla no habría servido de nada. Ahora se lee
con `typeof`.

**Lección: una tarifa de cero es un valor válido, no un valor ausente.** El
`||` no distingue entre «no hay tarifa» y «la tarifa es cero».

**Lección:** cuando el dueño da una tarifa de día, preguntar SIEMPRE si baja
además de subir. La mitad hacia abajo no se deduce sola.

**Sin piso, y a sabiendas.** Le señalé que así, Cancún a 1 día cotiza $81,000
para un viaje de 4,282 km. Su respuesta: *«no pasa nada, nadie va a Cancún un
día, así déjalo»*. Queda como decisión suya, no como descuido: el descuento
corre sin tope hacia abajo.

Y de ahí una lección sobre el trabajo, no sobre precios: **un caso absurdo que
nadie va a pedir no merece código.** Yo iba a inventar un piso; el dueño
prefirió no cargar la regla con una defensa para un cliente que no existe.

### R16 · Arriba de 1,400 km ya se cotiza solo (26-ago-2026)

*«Que no haya asesor, anímate a cotizar tú.»* Antes, un destino más lejos que
1,400 km no daba precio: se contestaba «lo cotiza un asesor».

Ahora hay un segundo tramo de la fórmula, **$36 el kilómetro** contra los $22
del corto, anclado en lo que vale el tramo corto justo en los 1,400 km
($37,300) para que no haya escalón — 1,400 km da $37,300 y 1,401 da $37,336.

**Este tramo es mucho menos fiable que el corto, y hay que saberlo:** error
promedio de $9,800 contra los $1,534 del corto. No está mal ajustado; es que
los precios largos del dueño no son función del kilómetro — **Oaxaca son
$75,000 a 1,988 km y Barrancas los mismos $75,000 a 2,882 km**. Los cinco
destinos que sirvieron de guía están todos EN la lista, así que la fórmula
nunca los cotiza: el día que el dueño le ponga precio a uno lejano, entra al
catálogo y deja de estimarse.

---



### R18 · Abajo de $15,000, el día no es gratis

**Dictado por el dueño el 28-ago-2026**, en dos tiempos, mirando la lista de
los 50 casos que la página cotiza sola:

> «súbeles 500, el día, a los 4 de abajo»
> «a Bernal 1000 el día»
> «esos 500 exclusivamente a destinos **abajo de 15,000 en precio normal**»

Venía de que tres y cuatro días costaban **exactamente lo mismo** que dos: las
tres noches de `NOCHES_INCLUIDAS` se los comían enteros.

#### El corte lo hace el PRECIO, no la distancia ni estar en la tabla

«Precio normal» es lo que cuesta el viaje de dos días — el de la tabla si el
destino está, el de la fórmula si no. Así que la regla alcanza también a los
renglones baratos de la tabla, y son 12: Chapala, Tala, Tequila, Zacoalco,
Cocula, Magdalena, San Juan Cosalá, Tapalpa, Mazamitla, San Juan de los Lagos,
Camécuaro y El Manto.

**Comala ($16,200), Autlán ($15,800) y Bernal ($24,400) están arriba del tope**
pero el dueño los nombró uno por uno, así que llevan la suya: $500 los dos
primeros, $1,000 Bernal.

#### Se cobran las noches que salían gratis, no todas

El viaje de dos días **no se movió**, y no podía: él no pidió subirlo. Un
viaje de dos días trae una noche y ésa sigue incluida.

Y **de la cuarta noche en adelante manda la de siempre, $1,000**. Ésa es la
parte que me costó dos intentos:

| | primer intento | y luego |
|---|---|---|
| Chapala 7 días | $24,000 → **$23,500** | Comala 10 días $36,000 → **$34,000** |

Cobrando los $500 en *todas* las noches, los viajes largos salían **más
baratos** que antes, porque las noches que ya se cobraban a mil bajaban a
quinientos. El dueño pidió cobrar los días que salían gratis, **no descontar
los que ya se cobraban**.

Las dos veces lo cazó medir el cambio contra el código anterior, no razonarlo.
Hoy `probar-dia-no-gratis.cjs` compara **570 combinaciones** de destino y días
contra los precios congelados de antes de la regla: si una sola baja, se pone
roja. Al reabrir el defecto, se ponen rojas 56.

#### Lo que la regla NO tocó

A los 31 destinos caros de la tabla **no les movió ni un peso**, y eso también
se comprueba contra los precios congelados. Varios de ellos ya cobraban el día
antes de esto —CDMX y la Huasteca por su `estadiaPorDia`, otros por el
`diaExtra` de su propio renglón—, y eso no es cosa de esta regla.

#### Lo que queda pendiente

Comala y Autlán están **$800 y $1,200 arriba del tope** y llevan el $500 por
haberlos nombrado. Si el tope es la regla buena, quizá deberían llevar $1,000
como Bernal; si son excepciones a propósito, están bien. **No se movieron
porque el dueño los dictó, y su palabra manda sobre mi simetría.**

---
## Lo pendiente

### R10 · El precio depende del origen — ignorar por ahora

El Excel tiene una fila «SPRINTER OCOTLAN» con precios más altos saliendo de
Ocotlán: Vallarta $25,000 contra $19,000 desde Guadalajara, Chapala $11,000
contra $6,500. El dueño pidió ignorarla de momento (26-ago-2026). La página
hoy cobra precio de Guadalajara salga de donde salga, así que **un cliente
que salga de Ocotlán paga entre $3,500 y $6,000 de menos. Retomar antes del
lanzamiento.**

### Preguntas abiertas (lanzarlas al dueño en la siguiente ronda)

- Un paquete con movimientos (Cancún moviéndose allá): hoy suma las bandas
  encima del paquete. ¿O el paquete ya lo trae todo, como Tolantongo?
- **Cuántos días incluye cada paquete.** Confirmados por el dueño:
  **Barrancas 7**, Tolantongo 3, Guayabitos 4 («hasta 4 días») y Talpa
  Burrita 4 (revisado y «ok»). Los demás salen del nombre de su columna —
  Cancún 17, Chiapas 8, Acapulco 4—. Si alguno no dura lo que dice el
  nombre, su día extra empieza en el día equivocado.

  **Los dos que ya se preguntaron dieron dos números distintos de los que
  yo había supuesto**: Tolantongo (yo 4, él 3) y Barrancas (yo 4, él 7). Con
  Barrancas eran $9,000 de sobrecobro en un viaje de 6 días. Vale la pena
  preguntar los tres que faltan.

---

### R19 · El origen suma cuando NO queda de camino (28-ago-2026)

Dictado por el dueño al pasarme el Excel y señalarme su fila 11:

> «estudia el incremento que hay entre salir de Ocotlán e implementalo […]
> lo añades como extra, para que se puedan calcular movimientos normalmente,
> hay viajes que se mantienen igual, porque muchas veces Ocotlán queda de
> pasada para llegar a un destino […] si un viaje sale de Tequila, tú
> pensarías que cuesta más, pero no, porque Tequila está de camino a
> Vallarta, entonces es el mismo precio.»

Esto cierra **R10**, que llevaba dos días abierta.

#### Lo que dice su fila 11, medido

De 49 columnas: **19 no suben**, **29 suben** entre $2,000 y $6,000 en
escalones de $500, y **Morelia baja $500** — el único que baja.

Los 19 que no suben son todos al este y sureste: CDMX, Puebla, Tlalpujahua,
Tolantongo, Zamora, Pátzcuaro, Morelia, Mariposa, Valle de Bravo, Ixtapa,
Acapulco, Oaxaca, Chiapas y Cancún.

#### El criterio se mide POR CARRETERA, no en el mapa

Se probó su regla contra sus propios números —¿está Ocotlán más cerca del
destino que Guadalajara?— y **acierta en 38 de 49**. Los dos extremos salen
perfectos: los 18 destinos que quedan más lejos suben **los 18, sin una sola
excepción**, y los del este lejano no suben ninguno.

Los 11 que fallan son todos del mismo tipo: **Guanajuato, San Juan de los
Lagos, Real de Catorce, Zacatecas y la Huasteca**. En línea recta Ocotlán se
ve más cerca, pero a esos se llega por Lagos de Moreno, al noreste, y Ocotlán
está al sureste. Es desvío aunque parezca atajo.

Por eso el respaldo usa los kilómetros que mide Google y no las coordenadas.

#### Cómo quedó

**Manda lo que él dictó.** Los 49 números viven en `api/_origenes.js`, tal
cual, sin modelo: sus importes van en escalones de $500 y no salen de ninguna
curva —el mismo motivo por el que la tabla de destinos no es una fórmula—.

**Y solo eso: no hay respaldo.** Si el origen no está dictado, o está pero su
fila no dice nada de ese destino, se cobra precio de Guadalajara.

> **Hubo un respaldo y duró unas horas.** Para un origen desconocido comparaba
> el viaje medido contra el mismo viaje desde Guadalajara y cobraba los
> kilómetros de más, perdonando 60 —el ancho del área metropolitana—. El dueño
> lo acotó el mismo día: *«de momento solo vamos a usar el radio de Ocotlán,
> ahí te vas a basar para actualizar todos los destinos de la fila 11»*.
>
> Tenía razón de fondo, y es R12 otra vez: a Monterrey–Vallarta le sumaba
> $15,800 **salidos de una cuenta mía, no de su Excel**. Yo lo había puesto
> como «lo recomendado» y él lo apretó. Que quede escrito: cuando dudé entre
> calcular un número o no cobrarlo, la respuesta buena era no cobrarlo.
>
> Para retomarlo, la cuenta era `medido − km del catálogo − 60`, a $22 el km,
> redondeado abajo a la centena.

Su regla de «queda de pasada» no necesita geometría: **ya viene resuelta a
mano dentro de su propia fila**. Los 19 destinos que escribió iguales SON los
que quedan de camino. Y saliendo de Tequila —que no es origen dictado— no se
suma nada, que es justo lo que él dijo que tenía que pasar.

**Solo aplica a destinos de LISTA.** Uno de fórmula ya cobró por los
kilómetros que midió Google; sumarle recargo sería cobrarlo dos veces.

**Va al final, después del piso por día.** Si se sumara antes, Chapala a diez
días desde Ocotlán costaría lo mismo que desde Guadalajara: el piso de
$30,000 se comería los $4,500 sin dejar rastro. La prueba lo clava.

#### El radio, que es lo único que decide hoy

**25 km alrededor de Ocotlán**, lo que alcanza Poncitlán, Jamay, La Barca y
Atotonilco: mismo rumbo y misma distancia, así que el desvío es prácticamente
el mismo. Confirmado por el dueño el 28-ago-2026 —*«de momento solo vamos a
usar el radio de Ocotlán»*—, y desde que se quitó el respaldo es **la única
puerta** por la que entra un recargo.

Las coordenadas mandan sobre el texto: hay otro Ocotlán en Oaxaca.

#### Lo que decidí yo, y hay que confirmarle

1. **Tequila desde Ocotlán quedó en $12,000, no en los $13,500 del Excel.**
   Aquel número se apoya en los $8,500 que él bajó a $7,000 el 26-ago. Lo que
   se hereda es el **recargo** de $5,000, no el precio viejo: el desvío no
   cambió porque le bajara a Tequila.
2. **Los tres destinos donde el recargo cambia con los días.** Su Excel les da
   dos columnas y dos importes distintos:

   | | | |
   |---|---|---|
   | Huasteca | 3 días +$4,000 | 4 días +$2,000 |
   | Talpa | 1 día +$4,500 | 2 días +$4,000 |
   | Guanajuato | 1 día +$3,000 | 3 días +$3,500 |

   Para los días que él no escribió se usa el dictado más cercano. Es lo que
   menos inventa, pero es elección mía.

#### Y un número que huele raro

**La Huasteca desde Ocotlán a 3 días cuesta $42,500, que es exactamente lo
que cuestan 4 días desde Guadalajara.** Además su recargo baja al crecer los
días (+$4,000 a tres, +$2,000 a cuatro), al revés de todos los demás.
Señalado, no cambiado (R12).

#### Tala, Zacoalco y Cocula, dictados aparte (28-ago-2026)

Mirando la hoja de 50 viajes desde su zona, el dueño marcó dos renglones:

> «estos dos muy caros, deben ser mínimo 9,000» — Tala y Zacoalco, los dos
> en $6,000 a dos días.
>
> Y enseguida: «sube el 3000 también», que mete a Cocula, el renglón de
> abajo, al mismo rumbo.

Los tres quedan **al poniente** de Guadalajara, así que desde Ocotlán son
desvío igual que Tequila o Chapala. Con los $3,000, los dos que marcó dan
exactamente los $9,000 que pidió; Cocula da $9,500 porque su precio propio es
$6,500.

> **Lo que NO se hizo, y por qué.** «Sube el 3000» también podía leerse como
> el **piso por día** —$3,000, y los $6,000 de esos dos renglones son
> justamente 2 × 3,000—. Se midió antes de tocarlo: subirlo a $4,500 mueve
> **40 de los 49 destinos**, hasta $18,000 en un viaje de doce días. Chapala
> a 7 días pasaría de $24,000 a $34,500.
>
> Eso es muchísimo más de lo que él marcó, así que se hizo lo chico y se le
> reportó lo grande. Si de verdad quería el piso, lo dice y se cambia.

**Pendiente:** Zacoalco a UN día desde Ocotlán da $8,000, no $9,000, porque su
precio de lista es $5,000. Él dijo «mínimo 9,000» mirando renglones de dos
días. Si los nueve mil son un piso de verdad y no un recargo, ese caso falta.

#### Los 5 destinos que Ocotlán todavía no cubre

Al quitar el respaldo quedó un hueco que antes tapaba una cuenta: hay destinos
del catálogo que **NO vienen en el Excel**, así que su fila 11 no dice nada de
ellos. Desde Ocotlán pagan precio de Guadalajara. Eran ocho; el dueño ya dictó
tres el 28-ago (arriba), y quedan **cinco**:

| destino | de dónde salió | su ancla en la lista | lo que Ocotlán le suma al ancla |
|---|---|---|---|
| San Juan Cosalá | dictado (R11) | Chapala | +$4,500 |
| Magdalena | dictado (R11) | Tequila | +$5,000 |
| Zirahuén | dictado (R11) | Pátzcuaro | $0 — queda de camino |
| Tepic | dictado, corregido a mano | — | — |
| León | dictado, corregido a mano | — | — |

Los tres primeros nacieron anclados a un destino de la lista (R11), así que
**podría tocarles el recargo de su ancla**. Tepic y León no tienen ancla.

**No se movió ninguno**: proponer esos números sería R12 otra vez. Está aquí
para preguntárselo con la lista enfrente — así fue como salieron los tres de
arriba, enseñándole la hoja.

El caso que mejor enseña el hueco: desde Poncitlán, **Chapala a dos días con
un movimiento cuesta $14,000 y San Juan Cosalá $9,500**, estando a ocho
kilómetros uno del otro y valiendo lo mismo desde Guadalajara.

#### Lo que falta del mismo Excel

**Yurécuaro** (fila 22) y **Dominical** (fila 25) tienen sus propias filas y
sus propios camiones. El dueño dijo que irá pasando más orígenes con precios;
`_origenes.js` está hecho para que cada uno sea un renglón más.

---

### R20 · Cuando no sepa un precio, la respuesta sale del Excel (29-ago-2026)

Regla fija pedida por el dueño:

> «en caso de no saber un precio vas a evaluar el Excel y tú evaluar la opción
> que más se adecúe»

**Esto NO contradice a R12, la refuerza.** R12 prohíbe que yo *invente* un
número. R20 dice de dónde sale el número cuando no lo sé: de su archivo, no de
mi cabeza. La diferencia entre proponer e inferir es la celda que lo respalda.

#### El orden de búsqueda, y siempre en este orden

1. **El renglón exacto.** Ese destino, esa duración, ese origen.
2. **El mismo destino a otra duración.** Su Excel trae varias columnas del
   mismo lugar («CDMX 1 día / 2 días / 3 días»); de dos de ellas sale el día
   extra, y con eso se llega a cualquier duración (así se despejaron las bases
   de CDMX y la Huasteca, y cuadran al peso).
3. **El mismo destino desde otro origen.** Las cinco filas Sprinter son el
   mismo viaje visto desde cinco salidas; comparándolas sale el patrón.
4. **El vecino de camino.** Si el destino está pegado a uno de la lista o de
   paso hacia él, se ancla a ése (R11).
5. **La fórmula**, y solo si no hubo ancla (R11).

#### Lo que hay que decir SIEMPRE al contestar

De qué celda salió. «Fila 11, columna 6» es una respuesta; «yo creo que unos
once mil» no lo es. Si el paso 1 falla y hay que bajar al 2 o al 3, se dice
**cuál** se usó y **qué se supuso**, porque cada paso hacia abajo es un supuesto
más.

Y si después de los cinco pasos el número sigue sin salir del Excel, la
respuesta correcta es **«esto no está en tu archivo, dímelo tú»**. Ésa es la
frontera de R12 y no se cruza.

#### Esto es trabajo mío, no de la página

La página **no lee el Excel** —el archivo vive en la computadora del dueño— y
no consulta ninguna inteligencia artificial: sus precios son aritmética con los
números ya copiados a `_destinos.js` y `_origenes.js`. R20 se aplica cuando él
me pregunta, y su resultado es un cambio de código con su regla escrita aquí.
Ver la sección de costos en `LA-SPRINTER-SEGUN-EL-EXCEL.md`.

---

### R21 · Yurécuaro entra como origen (29-ago-2026)

Dictado por el dueño: *«contempla salidas de Yurécuaro en el cotizador, de
Sprinter, escanea toda esa fila y adáptate»*. Es la fila 22 del Excel,
`YUCUARO SPRINTER`, y entra igual que entró Ocotlán con R19.

**33 de sus 49 columnas traen número; 31 de esas 33 se reconstruyen al peso.**
Las dos que no, a propósito: Tequila hereda el recargo sobre el precio ya
corregido, y Chiapas queda fuera (abajo).

#### Yurécuaro confirma el criterio por segunda vez

Está **más al oriente que Ocotlán**, y sus números lo reflejan sin que nadie se
los acomodara:

| destino | desde Ocotlán | desde Yurécuaro | por qué |
|---|---|---|---|
| Chapala | +$4,500 | **+$10,000** | más lejos al poniente |
| Vallarta | +$6,000 | **+$9,000** | igual |
| Tolantongo | $0 | **−$6,500** | le queda de camino |
| Ixtapa | $0 | **−$3,000** | igual |

Que un origen más oriental cobre más al poniente y **menos** al oriente es
exactamente lo que él describió el 28-ago. No hubo que ajustar ninguna regla:
la máquina de R19 lo aceptó tal cual.

#### El radio: 22 km, y por qué no 25

Ocotlán y Yurécuaro están a **51.2 km**. Con 25 km cada uno, sus círculos
quedarían a **1.2 km de tocarse** — demasiado apretado para dejarlo al azar.
Con 22 hay 4.2 km de aire.

Y se arregló de raíz: **`buscaOrigen` ahora se queda con el origen MÁS
CERCANO**, no con el primero del arreglo. Antes el precio dependía del orden en
que estuvieran escritos, que es arbitrario; con un solo origen no se notaba.
Comprobado encimando los radios a la fuerza: cada punto cae con quien le queda
cerca.

Dentro quedan **Yurécuaro, Tanhuato, Degollado (Jalisco), Vista Hermosa e
Ixtlán de los Hervores**. La Piedad se queda fuera por 1.4 km.

#### CHIAPAS NO ENTRA — y esto es lo importante de esta regla

Su celda dice **$16,500** cuando desde Guadalajara son **$85,000**: un recargo
de **menos $68,500** en un viaje de ocho días. Está sola entre celdas vacías y
tiene toda la pinta de un número que cayó en la columna equivocada.

**Se dejó fuera.** Ese viaje cobra los $85,000 de Guadalajara hasta que él lo
confirme. Meterla le costaría $68,500 en el primer cliente de Yurécuaro que
pidiera Chiapas, y una prueba se pone roja si alguien la agrega «porque está en
el Excel».

Ésta es la frontera entre obedecer el Excel y obedecer un error de dedo. El
Excel manda, pero un número imposible no es un dato: es una celda corrida.

#### Lo demás que hay que preguntarle

1. **Puebla, +$12,000** — el recargo más alto de la fila y el **único renglón
   donde el patrón se invierte**: desde Ocotlán Puebla dice «MISMO COSTO GDL», y
   Yurécuaro queda todavía más de camino. Debería costar igual o menos. Se
   implementó porque su magnitud es creíble, pero huele.
2. **Tolantongo** — su única celda es la de CON movimientos ($28,000). El
   descuento se aplica al destino, así que también alcanza al viaje sin
   movimientos. Eso es inferencia mía.
3. **Los 16 destinos que su fila deja en blanco** pagan precio de Guadalajara:
   Cancún, Oaxaca, Acapulco, Morelia, San Juan de los Lagos, Manzanillo,
   Tenacatita, Valle de Bravo, Pátzcuaro, Mariposa y los demás. Morelia llama la
   atención: desde Ocotlán baja $500 y Yurécuaro está aún más cerca.

---

### R22 · El viaje de un día no paga movimiento (30-ago-2026)

Dictado por el dueño al revisar la hoja de los 50 viajes reales, señalando
Tequila:

> «sólo fue el problema de Tequila, debería estar en 7000. Los viajes de un
> solo día no cobres movimientos, éstos normalmente siempre tienen, no lo
> cobres.»

Tiene toda la razón y **su propio Excel lo respalda**: un paseo de un día ES
el movimiento. Cobrarlo aparte sacaba a esos viajes de su propia lista.

#### Dos celdas suyas que ANTES no cuadraban y ahora sí

| | su Excel | la página antes | ahora |
|---|---|---|---|
| GUANAJUATO MISMO DIA | $19,000 | $22,000 | **$19,000** |
| MORELIA 1 DIA | $19,000 | $22,000 | **$19,000** |
| Tequila 1 día | $7,000 | $10,000 | **$7,000** |

Que la regla haga cuadrar dos celdas que nadie estaba mirando es la mejor
señal de que es correcta.

#### La excepción: CDMX y la Huasteca

A los destinos con `estadiaPorDia` **no se les aplica**, y no es capricho. Su
precio del Excel está definido como base más días **con** movimientos —palabras
suyas en R3: *«son cuatro mil por día extra, pero con movimientos»*—.
Perdonarles el del primer día tira su propia celda: **CDMX 1 día caería a
$23,000 cuando su Excel dice $26,000.**

Lo decide su mandamiento, no mi gusto: *«si un cálculo da algo que no está en
el Excel, el cálculo está mal, no el Excel»*.

La diferencia de fondo es la misma que ya separa R1 de R3. «GUANAJUATO MISMO
DIA $19,000» es el precio **completo** de ese día; «CDMX 1 DIA $26,000» es una
**base** a la que se le suma el día. Al primero el movimiento ya le venía
dentro; al segundo se le suma aparte.

Tolantongo queda igual por R5: su columna «con mov» es un precio completo del
Excel, no un recargo por día.

#### El movimiento no se borra, se pone en cero

El operador necesita la hora aunque no cueste, y el contrato la imprime. Se
sigue contando el día con movimiento; lo que vale cero es su importe.

#### El hueco que dejó pasar esto

**Ninguna prueba cubría «un día CON movimiento».** Se probaba un día sin ellos,
y varios días con ellos — nunca la esquina donde se cruzan. Por eso Tequila
salió en $10,000 y nadie se enteró hasta que el dueño lo vio en el PDF.

Ya hay 17 aserciones para esa esquina, comprobadas apagando la regla: se ponen
rojas y reproducen exactamente el $10,000 que él cazó.

**Lección:** al probar dos reglas que se pueden combinar, probar también la
combinación. Las dos por separado estaban bien.

---

### R23 · Morelia y Mariposa: tres noches incluidas y $1,000 de la cuarta (30-ago-2026)

> **Esto nació como «pendiente» y el dueño lo cerró el mismo día.** Se lo
> presenté como un defecto —cuatro días cuestan lo mismo que uno— y contestó:
> *«ah, está bien; entonces cuando supere su tercera noche, o sea su 4ta,
> auméntale 1000 por noche»*. Que es exactamente lo que la página ya hacía.
>
> **No era defecto: era su modelo.** Queda escrito como regla y no como
> pendiente, para que nadie lo vuelva a «arreglar».

Salió al comprobar que Guanajuato y Morelia sí usan precio de tabla —el dueño
lo confirmó: *«Guanajuato mismo día y Morelia usa precios de tabla»*—. Usarlos,
los usan. Pero **su columna dice «1 DIA» y no hay segunda columna**, así que
del día dos en adelante mandan las tres noches incluidas.

Su Excel tiene ocho columnas que dicen «1 día». Seis suben bien; dos no:

| columna del Excel | 1 día | 4 días | |
|---|---|---|---|
| CDMX 1 DIA | $23,000 | $26,000 | sube |
| TALPA 1 DIA DIRECTO | $15,000 | $19,500 | sube |
| TLALPUJAHUA 1 DIA | $23,500 | $29,500 | sube |
| CAMÉCUARO/ZAMORA 1 DIA | $14,500 | $15,500 | sube |
| EL MANTO 1 DIA | $14,000 | $20,500 | sube |
| GUANAJUATO MISMO DIA | $19,000 | $26,000 | sube |
| **MARIPOSA 1 DIA** | $23,000 | **$23,000** | plano hasta la 3ª noche |
| **MORELIA 1 DIA** | $19,000 | **$19,000** | plano hasta la 3ª noche |

Las seis que suben tienen un segundo dato: o su `porDias` con otra duración, o
un `diaExtra` dictado, o —Camécuaro— caen abajo de los $15,000 y R18 las
alcanza. Morelia y Mariposa no tienen ninguno de los tres, así que les toca la
regla general: **tres noches incluidas, y $1,000 de la cuarta en adelante.**

| | 1–4 días | 5º día | 6º día |
|---|---|---|---|
| Morelia | $19,000 | $20,000 | $21,000 |
| Mariposa | $23,000 | $24,000 | $25,000 |

#### Y a partir de cierto punto manda el piso, no las noches

El piso de **$3,000 por día** le gana al precio de tabla cuando el viaje se
alarga, y de ahí en adelante el escalón deja de ser $1,000:

| | el piso alcanza al precio | qué pasa |
|---|---|---|
| Morelia ($19,000) | al **7º día** ($21,000) | el día 7 sube $3,000, no $1,000 |
| Mariposa ($23,000) | al **8º día** ($24,000) | igual |

No es contradicción: el piso es su propia regla y existe justo para eso —una
unidad apartada muchos días no puede cobrarse como un paseo—. Queda anotado
porque el escalón deja de ser parejo y conviene saber dónde.
