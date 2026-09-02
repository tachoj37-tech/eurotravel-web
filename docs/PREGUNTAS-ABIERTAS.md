# Lo que no tengo claro

Segunda ronda, 1-sep-2026. Las 17 anteriores están contestadas y viven en el
criterio como R26 a R38.

**Van numeradas para contestarse de corrido**: «1: sí», «2: son 15,000», etc.
Ordenadas por cuánto dinero mueven.

---

# BLOQUE A · Seis destinos con precio MIO

El descubrimiento de hoy: se leyó tu Excel y **seis destinos que la página
cobra no están ahí**. Sus 48 columnas van de la B a la AX, y ninguna es
éstas. Sus precios los puse yo.

| | km | cobra hoy (4 días) | la fórmula diría |
|---|---|---|---|
| **Tala** | 91 | $6,000 | $8,502 |
| **Zacoalco de Torres** | 136 | $6,000 | $9,492 |
| **Cocula** | 145 | $6,500 | $9,690 |
| **Tepic** | 414 | $16,900 | $15,608 |
| **León** | 444 | $17,600 | $16,268 |
| **Zirahuén** | 656 | $25,000 | $20,932 |

Los tres primeros salieron de la hoja de 50 viajes, donde dijiste «estos dos
muy caros, deben ser mínimo 9,000» —y de ahí quedaron—. Los tres últimos los
anclé a un vecino de tu lista (R11).

> **1.** ¿Los seis están bien como están?
> **2.** Si alguno está mal, ¿cuál es su precio? Van los seis a cuatro días,
> saliendo de Guadalajara.

---

# BLOQUE B · Cosas que ya cobran bien, pero nadie puede pedir

Estas tres están **implementadas y probadas**, y no sirven de nada todavía
porque no hay por dónde pedirlas.

## 3 · Los tres paseos de CDMX

Taxco $15,000, Chalma $8,000, Xochimilco $2,000. El motor ya los cobra —
sustituyen al movimiento de $3,000 y no se perdonan aunque la columna traiga
movimientos incluidos.

Falta **cómo los pide el cliente**. Que lo escriba libre es frágil.

> **3.** ¿Casillas al cotizar CDMX —«¿van a Taxco? ¿a Chalma? ¿a
> Xochimilco?»— y botones en el bot? ¿O prefieres que solo los ofrezca una
> persona?

## 4 · El recorrido de más de 80 km

Ya cobra los $5,500. Pero el movimiento tiene que traer **cuántos kilómetros**,
y hoy la página **nunca manda ese dato** — así que en la práctica nunca se
cobra.

> **4.** ¿Cómo se lo preguntamos al cliente? Se me ocurre un botón: «¿el
> recorrido es dentro de la ciudad o se van lejos (más de 80 km)?». ¿Va así,
> o prefieres que ese caso lo cotice una persona?

## 5 · DOMINICAL

Ya sé qué es —ida y vuelta el mismo domingo— pero **no está en el código**.
Tus filas 25 y 27 bajan CDMX de $30,000 a $16,000 e Ixtapa de $29,500 a
$15,000.

> **5.** ¿La página lo cotiza sola cuando el cliente pide un viaje de un día
> que cae en domingo? ¿O es producto aparte que solo se vende por teléfono?
>
> Si lo cotiza sola: hay **dos filas** (25 y 27). ¿La 27 —`DOM SPR OCO`— es la
> misma pero saliendo de Ocotlán?

---

# BLOQUE C · Huecos que no había visto

## 6 · La Suburban no tiene precios

Se buscó en tu Excel y **no aparece**. Hoy el bot la ofrece como la premium y
manda con una persona.

> **6.** ¿Se queda así, o le vas a poner precios?

## 7 · El Meco / El Naranjo

Es el paseo de la **Huasteca**, no de CDMX —eso ya quedó claro—. Tu fila 10 le
pone $3,000, que es lo mismo que un movimiento normal.

> **7.** ¿Se queda cobrando como movimiento normal, o es paseo con nombre como
> los tres de CDMX? Con los $3,000 da igual hoy, pero si algún día suben las
> bandas de horas, ya no.

## 8 · Los paseos de CDMX en autobús

Dijiste «aplican para Sprinter en CDMX». Hoy están puestos **solo para
Sprinter**, tal cual.

> **8.** Si un grupo va en autobús a CDMX y quiere ir a Taxco, ¿cuánto cuesta?
> ¿O eso ya lo cotiza una persona?

## 9 · Solo ida a un destino con paquete

El «solo ida» cobra el 65 %. Pero **Cancún son 17 días** y Chiapas 8: un solo
ida a Cancún al 65 % da $94,250, y no está claro que eso signifique algo.

> **9.** ¿Un destino con paquete se puede pedir solo ida? Si no, la página
> debería no ofrecerlo ahí.

---

# Lo que ya NO es pregunta

Contestado el 1-sep-2026, todo en el criterio con su fecha:

| | |
|---|---|
| **R26** | 4 días / 3 noches por defecto |
| **R27** | la casilla vacía de un origen **es un dato**: le queda de camino |
| **R28** | San Juan Cosalá hereda el recargo de Chapala |
| **R29** | bandas de horas confirmadas · sin Huasteca ni CDMX · +80 km = $5,500 |
| **R30** | Taxco $15,000 · Chalma $8,000 · Xochimilco $2,000, **sustituyen** |
| **R31** | DOMINICAL es ida y vuelta el mismo domingo |
| **R32** | Camécuaro desde Yurécuaro +$2,000 |
| **R33** | Puebla y Zacatlán, día extra $2,000 |
| **R34** | **el piso NO le gana a un precio de lista** |
| **R35** | Acapulco y Cancún: día extra $4,000, movimientos aparte |
| **R36** | tres de los cuatro números raros del bloque D eran correctos |
| **R37** | la fórmula $6,500 + $22/km queda confirmada |
| **R38** | Zacoalco se iguala a Tala; ninguno está en el Excel |

Y de antes: tres noches y $1,000 la cuarta (R25) · el viaje de un día no paga
movimiento (R22) · solo ida al 65 % · el origen suma cuando no queda de camino
(R19, R21) · el IVA se cobra pero no se menciona en el chat.
