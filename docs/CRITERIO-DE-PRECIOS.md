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

### R5 · El precio depende del origen — PENDIENTE, ignorar por ahora

El Excel tiene una fila «SPRINTER OCOTLAN» con precios más altos saliendo de
Ocotlán. El dueño pidió ignorarla de momento (26-ago-2026). La página hoy
cobra precio de Guadalajara salga de donde salga. **Retomar antes del
lanzamiento.**

---

## Preguntas abiertas (lanzarlas al dueño en la siguiente ronda)

- `MARIPOSA/AZUFRES/PATZCUARO $29,000`: ¿recorrido propio? Hoy no existe y un
  texto así caería en Mariposa ($23,000) o Pátzcuaro ($25,000).
- Un paquete pedido a MÁS días de los incluidos (Cancún 18 días): ¿día extra
  de cuánto?
- Un paquete con movimientos (Cancún moviéndose allá): ¿los movimientos van
  aparte o el paquete ya lo trae todo?
- Los destinos de playa sin días en el nombre (Vallarta, Mazatlán…): hoy traen
  3 noches incluidas y $1,000 la extra. Cuadra con «Vallarta jueves a domingo
  $19,000», pero la tarifa de $1,000 no está escrita en el Excel. ¿Es correcta?
- `GUAYABITOS hasta 4 días $18,500`: ¿el día 5 en cuánto?
