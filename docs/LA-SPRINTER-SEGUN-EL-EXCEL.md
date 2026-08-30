# La Sprinter según el Excel — el mapa completo

Leído celda por celda de `LISTA DE PRECIOS 2027.xlsx` el 28-ago-2026, con el
dueño autorizando la lectura. Este documento es **el inventario**: todo lo que
el Excel dice de la Sprinter, qué parte ya cobra la página, qué parte está
guardada esperando orden, y qué huele raro.

Sus hermanos: `CRITERIO-DE-PRECIOS.md` guarda **las reglas** (cómo se cobra);
`LO-QUE-TENGO-GUARDADO.md` guarda las tablas de camiones; el código que
obedece todo esto vive en `api/_destinos.js`, `api/_tarifa.js` y
`api/_origenes.js`.

---

## 1. Dónde vive la Sprinter en el Excel

El archivo está **transpuesto**: los destinos van en 49 columnas y cada
renglón es una unidad saliendo de un lugar. De los 26 renglones con datos, la
Sprinter aparece en **cinco**:

| fila | rótulo tal cual | qué es | en la página |
|---|---|---|---|
| 9 | `SPRINTER` | desde Guadalajara | **COBRÁNDOSE** — es la tabla de `_destinos.js` |
| 11 | `SPRINTER OCOTLAN` | desde la zona de Ocotlán | **COBRÁNDOSE** — R19, `_origenes.js` |
| 22 | `YUCUARO SPRINTER` | desde Yurécuaro | guardada aquí, **no implementada** |
| 25 | `DOMINICAL SPRINTER` | ver la pregunta 1 | **no implementada** |
| 27 | `DOM SPR OCO` | la dominical, desde Ocotlán | **no implementada** |

Los otros 21 renglones son camiones (filas 3–8 desde Guadalajara, 12–16 desde
Ocotlán, 17–21 desde Yurécuaro, y 24/26 `DOMINICAL CENTURY` / `DOM OCO`).
Guardados, **no se cotizan en línea**: `UNIDADES_QUE_COTIZAN` solo trae
`sprinter`, y hay prueba de que cualquier otra unidad se rechaza.

**Los días van en el NOMBRE de la columna** («CDMX 3 días», «CHIAPAS 8 DIAS»,
«GUAYABITOS hasta 4 días»). Ésa fue la lección más cara del proyecto (errores
1 y 2 del criterio): cada columna es un precio completo de *ese* viaje a *esa*
duración, no un traslado al que se le suman noches.

---

## 2. La matriz completa

Entre paréntesis, la diferencia contra Guadalajara. `= GDL` es la celda
literal «MISMO COSTO GDL»; `—` es que su fila no llega a esa columna; `?` es
celda vacía.

| # | columna del Excel | GDL (f9) | Ocotlán (f11) | Yurécuaro (f22) | Dominical (f25) | Dom. Ocotlán (f27) |
|---|---|---|---|---|---|---|
| 1 | VALLARTA BUCERIAS/MITA/SAN BLAS | $19,000 | $25,000 (+6,000) | $28,000 (+9,000) | $16,000 (−3,000) | $22,000 (+3,000) |
| 2 | PTO VALLARTA/MISMALOYA (después malecón) | $20,000 | $26,000 (+6,000) | $29,000 (+9,000) | $17,000 (−3,000) | $23,000 (+3,000) |
| 3 | SAYULITA/SAN PANCHO | $18,000 | $24,000 (+6,000) | $26,000 (+8,000) | $15,000 (−3,000) | $21,000 (+3,000) |
| 4 | MAZAMITLA *(no bus fin)* | $14,500 | $18,000 (+3,500) | $21,500 (+7,000) | $14,500 (=) | $13,500 (−1,000) |
| 5 | TAPALPA *(no bus fin)* | $14,500 | $18,000 (+3,500) | $21,500 (+7,000) | $14,500 (=) | $13,500 (−1,000) |
| 6 | CHAPALA | $6,500 | $11,000 (+4,500) | $16,500 (+10,000) | $6,500 (=) | $11,500 (+5,000) |
| 7 | TEQUILA/CHAPALA/GUACHIMO… *(autobús no dom)* | $8,500¹ | $13,500 (+5,000) | $18,500 (+10,000) | ? | ? |
| 8 | CHACALA | $16,500 | $22,000 (+5,500) | $22,500 (+6,000) | $14,000 (−2,500) | $21,000 (+4,500) |
| 9 | PUNTA PERULA | $20,500 | $25,000 (+4,500) | $26,500 (+6,000) | $18,500 (−2,000) | $23,000 (+2,500) |
| 10 | GUAYABITOS hasta 4 días | $18,500 | $23,000 (+4,500) | $26,000 (+7,500) | $15,000 (−3,500) | $21,000 (+2,500) |
| 11 | MAZATLÁN | $28,000 | $34,000 (+6,000) | $32,000 (+4,000) | $23,500 (−4,500) | $30,000 (+2,000) |
| 12 | CDMX X 2 DÍAS | $30,000 | $30,000 (=) | $30,000 (=) | $16,000 (−14,000) | $19,000 (−11,000) |
| 13 | CDMX 3 DÍAS | $34,000 | $34,000 (=) | $34,000 (=) | ? | ? |
| 14 | CDMX 1 DÍA | $26,000 | $26,000 (=) | $26,000 (=) | ? | ? |
| 15 | PUEBLA 2 DÍAS | $36,500 | = GDL | $48,500 (+12,000) | ? | ? |
| 16 | PUEBLA 2 DÍAS CHIGNAHUAPAN ZACATLÁN | $39,500 | = GDL | ? | ? | ? |
| 17 | HUASTECA 4 DÍAS | $42,500 | $44,500 (+2,000) | ? | ? | ? |
| 18 | HUASTECA 3 DÍAS | $38,500 | $42,500 (+4,000) | $46,500 (+8,000) | ? | ? |
| 19 | REAL DE 14 SIN MOV | $34,500 | $38,500 (+4,000) | $45,000 (+10,500) | ? | ? |
| 20 | BARRANCAS CHIHUAHUA | $75,000 | $80,000 (+5,000) | $85,000 (+10,000) | ? | ? |
| 21 | TALPA 1 DÍA DIRECTO | $15,000 | $19,500 (+4,500) | $25,000 (+10,000) | ? | ? |
| 22 | TLALPUJAHUA 1 DÍA | $23,500 | $23,500 (=) | $27,500 (+4,000) | ? | ? |
| 23 | TLALPUJAHUA 2 DÍAS | $26,500 | $26,500 (=) | ? | ? | ? |
| 24 | TALPA 2 DÍAS DIRECTO | $16,500 | $20,500 (+4,000) | ? | ? | ? |
| 25 | TALPA BURRITA 4 DÍAS | $26,500 | $30,000 (+3,500) | $35,000 (+8,500) | ? | ? |
| 26 | TOLANTONGO con mov pac/pri | $34,500 | $34,500 (=) | $28,000 (−6,500) | ? | ? |
| 27 | TOLANTONGO SIN MOV | $29,500 | $29,500 (=) | ? | ? | ? |
| 28 | TENACATITA BOCA DE IGUANAS | $20,000 | $24,000 (+4,000) | ? | ? | ? |
| 29 | IXTAPA | $29,500 | $29,500 (=) | $26,500 (−3,000) | $15,000 (−14,500) | $20,000 (−9,500) |
| 30 | MANZANILLO | $18,500 | $23,500 (+5,000) | ? | ? | ? |
| 31 | MELAQUE/BARRA/CUASTECOMATES | $20,500 | $26,500 (+6,000) | $25,000 (+4,500) | ? | ? |
| 32 | CHIAPAS 8 DÍAS | $85,000 | = GDL | **$16,500** ⚠ | — | — |
| 33 | OAXACA | $75,000 | = GDL | ? | — | — |
| 34 | CANCÚN 17 DÍAS | $145,000 | = GDL | ? | — | — |
| 35 | SAN JUAN DE LOS LAGOS/STO TORIBIO | $14,000 | $16,000 (+2,000) | ? | — | — |
| 36 | CAMÉCUARO/ZAMORA 1 DÍA | $14,500 | $14,500 (=) | $14,500 (=) | — | — |
| 37 | EL MANTO 1 DÍA | $14,000 | $17,000 (+3,000) | $18,000 (+4,000) | — | — |
| 38 | EL MANTO 3 DÍAS | $19,000 | $22,000 (+3,000) | $23,000 (+4,000) | — | — |
| 39 | GUANAJUATO MISMO DÍA | $19,000 | $22,000 (+3,000) | $25,000 (+6,000) | — | — |
| 40 | GUANAJUATO 3 DÍAS SIN MOV | $24,500 | $28,000 (+3,500) | $26,500 (+2,000) | — | — |
| 41 | GUANAJUATO/SAN MIGUEL DE ALLENDE | $26,500 | $28,500 (+2,000) | $29,000 (+2,500) | — | — |
| 42 | ZACATECAS | $25,000 | $29,000 (+4,000) | $28,500 (+3,500) | — | — |
| 43 | MAYTO | $26,500 | $30,000 (+3,500) | $32,000 (+5,500) | — | — |
| 44 | ACAPULCO 4 DÍAS | $60,000 | = GDL | — | — | — |
| 45 | NEVADO TOLUCA/VALLE BRAVO | $32,000 | = GDL | — | — | — |
| 46 | MICHOACÁN… PÁTZCUARO/URUAPAN | $25,000 | = GDL | — | — | — |
| 47 | MARIPOSA 1 DÍA | $23,000 | = GDL | — | — | — |
| 48 | MARIPOSA/AZUFRES/PÁTZCUARO | $29,000 | = GDL | — | — | — |
| 49 | MORELIA 1 DÍA | $19,000 | $18,500 (−500) | — | — | — |

¹ El archivo aún trae los $8,500 de Tequila que el dueño bajó a **$7,000** el
26-ago; la página cobra $7,000, y desde Ocotlán hereda el **recargo** de
+$5,000 ($12,000), no el precio viejo. Igual sigue ahí el $1,300,000 de
Barrancas en Marcopolo que ya se confirmó como error de dedo.

---

## 3. La fila de notas (10), descifrada

Cada nota está pegada a UNA columna, y eso importa: Chalma no es de cualquier
CDMX, es del de 3 días.

| columna | nota tal cual | qué significa | ¿la página lo hace? |
|---|---|---|---|
| 2 (Vallarta) | `MOV SPR $ 3,000 X DIA` | el movimiento de Sprinter vale $3,000 el día | **Sí** — es la primera banda: hasta 8h $3,000, 9h $3,500, 10h $4,000, 12h $4,500, más $5,000 |
| 13 (CDMX 3 días) | `CON CHALMA $ 8000 EXTRAS` | el paseo a Chalma se vende aparte | **No** — hoy cobraría la banda normal de $3,000 |
| 14 (CDMX 1 día) | `CON XOCHIMILCO $ 2000 EXTRAS` | el paseo a Xochimilco se vende aparte | **No** |
| 15 (Puebla) | `$ 4000 DIA EXTRA` | día extra de Puebla **en camión** | ver la siguiente |
| 16 (Puebla Zacatlán) | `DIA EXTRA $ 4,000 BUS Y $ 2,000 SPR` | $4,000 es de camión; **la Sprinter son $2,000** | **Sí** — R8, dictado el 26-ago. La celda 16 confirma que su dictado y su Excel dicen LO MISMO: el $4,000 suelto de la celda 15 era del camión |
| 17 (Huasteca 4d) | `EL MECO EL NARANJO $ 3000 EXTRAS` | el paseo a esas cascadas se vende aparte | **No** |
| 18 (Huasteca 3d) | `$ 4000 DIA EXTRA` | día extra de Huasteca | **Sí** — R3: $1,000 de estadía + $3,000 de movimiento = $4,000 |

Sueltos por la fila hay números sin unidad («60», «62», «63», «70», «71») y
en las filas dominicales unas celdas «mas 1021»…«mas 1024»: **basura de
Excel** — restos de referencias, no precios. No significan nada y no se
implementa nada con ellos.

También hay avisos de servicio metidos en los NOMBRES de columna: Mazamitla y
Tapalpa dicen «**no bus fin**» (no hay camión en fin de semana) y Tequila dice
«**autobús no dom**» (no hay camión los domingos). Son restricciones de
CAMIÓN, no de Sprinter — pero son la pista de que el Excel sí distingue los
domingos, y por eso la pregunta 1 de abajo.

---

## 4. Qué cobra la página hoy, contra este mapa

| pieza del Excel | estado | comprobado |
|---|---|---|
| Fila 9 (GDL) completa | **cobrándose** | 38/41 idénticos al Excel; los 3 distintos son la corrección de Tequila y las bases despejadas de CDMX/Huasteca, que reconstruyen sus renglones al peso |
| Fila 11 (Ocotlán) completa | **cobrándose** | 37/38 columnas al peso contra su fila; radio de 25 km con 6 pueblos, cada uno verificado contra el radio |
| Tala/Zacoalco/Cocula +$3,000 | **cobrándose** | dictados el 28-ago fuera del Excel; $3,000 exactos en 18 formas de viaje |
| Fila 22 (Yurécuaro) | **guardada aquí, sin implementar** | esperando la orden y dos aclaraciones (preguntas 2–4) |
| Filas 25/27 (Dominical) | **guardadas aquí, sin implementar** | primero hay que saber qué son (pregunta 1) |
| Paseos Chalma / Xochimilco / El Meco | **sin implementar** | pregunta 5 |
| Camiones (21 renglones) | guardados, no se cotizan en línea | por diseño: solo la Sprinter cotiza |

---

## 5. Lo que huele raro (señalado, no movido — R12)

1. **Chiapas desde Yurécuaro dice $16,500** contra $85,000 desde Guadalajara.
   Está sola entre celdas vacías y parece una celda corrida de columna.
2. **Puebla desde Yurécuaro cuesta +$12,000** cuando desde Ocotlán es «MISMO
   COSTO GDL» — y Yurécuaro queda **más** de camino a Puebla que Ocotlán. Es
   el único renglón donde el patrón geográfico se invierte.
3. **Camécuaro desde Yurécuaro cuesta $14,500, igual que desde Guadalajara**,
   estando Yurécuaro a ~30 km de Camécuaro y Guadalajara a 157. Puede ser el
   precio mínimo del negocio, pero llama la atención.
4. **Huasteca desde Ocotlán: el recargo BAJA con más días** (+$4,000 a 3 días,
   +$2,000 a 4), al revés de todo lo demás. Ya señalado en R19.
5. En cambio, dos que PARECEN raros y no lo son: **Tolantongo (−$6,500) e
   Ixtapa (−$3,000) desde Yurécuaro salen más baratos que desde Guadalajara**
   — y es correcto por carretera: Yurécuaro queda al oriente, de camino a los
   dos. Son la confirmación del criterio del dueño, igual que el −$500 de
   Morelia desde Ocotlán.

---

## 6. Las preguntas abiertas de este mapa

1. **¿Qué es «DOMINICAL»?** Mi mejor lectura: **salida de domingo** — el
   propio Excel habla de domingos («no bus fin», «autobús no dom»), «Century»
   es un modelo de camión, y los precios cuadran con excursión: CDMX baja a
   $16,000 (la corrida clásica a la Basílica: sale sábado en la noche,
   domingo allá, regresa en la noche) e Ixtapa a $15,000. Pero es lectura
   mía, no dato. Y de la respuesta depende TODO el bloque: si es eso, ¿la
   página debería cobrar esos precios cuando el viaje cae en domingo, o es un
   producto aparte que no se cotiza en línea?
2. **¿Meto la fila de Yurécuaro como metí la de Ocotlán?** La estructura ya
   está hecha: es un renglón más en `_origenes.js`. Falta su radio (¿La
   Piedad entra?, ¿Vista Hermosa?) y las dos aclaraciones de abajo.
3. **Chiapas desde Yurécuaro $16,500** — ¿celda corrida?
4. **Puebla desde Yurécuaro $48,500** — ¿así es, o también está corrida?
5. **Los tres paseos con nombre**: Chalma +$8,000, Xochimilco +$2,000, El
   Meco/El Naranjo +$3,000. ¿Los cobra la página? Hoy un cliente que pide
   CDMX 3 días con movimientos paga la banda normal, no los $8,000 de Chalma
   — el que más duele.

---

## 7. Qué cuesta cada cotización (y qué NO cuesta)

Pregunta del dueño el 29-ago-2026: *«¿estás haciendo un código, o cada que
coticen van a gastar API de Anthropic?»*

**Es código. Ninguna cotización consulta una inteligencia artificial.**
Comprobado con una búsqueda en todo el proyecto: cero menciones de Anthropic,
OpenAI, Claude, GPT o Gemini. Los tres archivos que deciden el precio
—`_tarifa.js`, `_destinos.js` y `_origenes.js`— **no hacen ni una sola llamada
a ningún servidor**: son aritmética con los números ya copiados del Excel.

### Lo que sí se paga, por cotización

| destino | ¿mide con Google? | llamadas |
|---|---|---|
| **De la lista** (los 49 del Excel) | **no** | **0** |
| De fórmula (Sahuayo, Bernal, Comala…) | sí, ida y vuelta | 2 |

Los destinos de lista no gastan **nada**: su precio es cerrado, así que
`necesitaMedirse` corta antes de llamar a Google. Los de fórmula miden dos
tramos, y el resultado se guarda **24 horas por par de puntos**: si dos
clientes piden el mismo viaje el mismo día, Google se paga una vez.

A eso se suman las sugerencias de direcciones mientras el cliente escribe
(Places), y en el cobro, Stripe. Nada más.

### Por qué la página no puede leer el Excel

Vive en la computadora del dueño, no en el servidor. Por eso sus números se
copian al código —y por eso existe R20: cuando él pregunta por un precio que
no está, **yo** abro el Excel, saco la respuesta de una celda suya y el
resultado es un cambio de código con su regla escrita. El trabajo de leer el
Excel se hace una vez, no en cada cotización.
