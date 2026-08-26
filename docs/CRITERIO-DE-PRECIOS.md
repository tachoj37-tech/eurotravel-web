# El criterio de precios

Este documento es el cerebro de precios de la página. Acumula lo aprendido:
cada corrección del dueño queda escrita aquí con fecha, y el código se ajusta
para obedecerla. **Se lee antes de tocar cualquier cálculo de dinero.**

## El mandamiento

**El Excel «LISTA DE PRECIOS 2027» manda.** Todo precio que dé la página tiene
que poderse reconstruir desde un renglón de ese Excel. Si un cálculo da algo
que no está ahí, el cálculo está mal, no el Excel.

De ahí se siguen dos reglas de conducta:

1. **No inventar modelos.** El error más caro hasta hoy no fue un número mal
   copiado: fue una regla inventada (ver el error nº 1).
2. **Calibrar contra TODOS los datos, no contra los que cuadran.** Si el Excel
   trae nueve destinos con varias duraciones, el modelo se prueba contra los
   nueve. Elegir dos y ajustar perillas hasta que cuadren es autoengaño.

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

| destino | del Excel |
|---|---|
| Talpa | 1 día $15,000 · 2 días $16,500 · día extra $1,500 (fila 10) |
| Tlalpujahua | 1 día $23,500 · 2 días $26,500 |
| El Manto | 1 día $14,000 · 3 días $19,000 |
| Guanajuato | mismo día $19,000 · 3 días sin mov $24,500 |

Entre duraciones o más allá de la última, se avanza con el `diaExtra` propio
del destino (el de la fila 10 si existe; si no, el que se deduce de sus
propios escalones).

### R2 · Los paquetes incluyen sus días (26-ago-2026)

Una columna con la duración en el nombre —CANCUN 17 DIAS $145,000, CHIAPAS 8
DIAS $85,000— es un paquete completo. **Dentro de esa duración no se suma ni
una noche.** Van con `diasIncluidos` en el catálogo.

### R3 · CDMX, Huasteca y Puebla se cobran por día (confirmada 26-ago-2026)

Palabras del dueño: *«son cuatro mil por día extra, pero con movimientos. Si
no tiene movimientos, nomás vas a cobrar mil.»*

- Con movimientos: base + $1,000 por día de estadía + $3,000 por día movido
  (= $4,000 el día completo). Así se reconstruyen al peso CDMX 1/2/3 días y
  Huasteca 3/4 días del Excel.
- **Sin movimientos: base + $1,000 por día.** (Antes las noches salían gratis
  hasta 3 — eso era el modelo inventado.)

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

### R10 · El precio depende del origen — PENDIENTE, ignorar por ahora

El Excel tiene una fila «SPRINTER OCOTLAN» con precios más altos saliendo de
Ocotlán. El dueño pidió ignorarla de momento (26-ago-2026). La página hoy
cobra precio de Guadalajara salga de donde salga. **Retomar antes del
lanzamiento.**

---

## Preguntas abiertas (lanzarlas al dueño en la siguiente ronda)

- Un paquete pedido a MÁS días de los incluidos (Cancún 18 días): hoy se
  cobra +$1,000 por noche. ¿Correcto, o el día extra de un paquete vale más?
- Un paquete con movimientos (Cancún moviéndose allá): hoy suma las bandas
  encima del paquete. ¿O el paquete ya lo trae todo, como Tolantongo?
- Los destinos de playa sin días en el nombre (Vallarta, Mazatlán…): 3 noches
  incluidas y $1,000 la extra. Guayabitos lo confirmó (R7) — ¿aplica igual a
  todas las playas?
- Tolantongo con movimientos a MÁS de 3 días: ¿34,500 más cuánto?
