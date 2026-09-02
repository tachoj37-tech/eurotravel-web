# Mapa del criterio de precios

Esto **no** es una copia de [[../docs/CRITERIO-DE-PRECIOS|CRITERIO-DE-PRECIOS.md]].
Es el mapa: dice dónde vive cada regla y qué archivo la obedece, para poder
llegar a lo que se busca sin leer 992 renglones de corrido.

> **Por qué mapa y no copia.** Dos copias de una regla de precio se separan
> tarde o temprano, y cuando se separan una de las dos empieza a cobrar mal.
> El texto completo de cada regla vive en un solo lugar. Aquí solo está la
> pregunta que te trajo, y a dónde ir.

---

## El mandamiento

**El Excel «LISTA DE PRECIOS 2027» manda.** Todo precio que dé la página tiene
que poderse reconstruir desde un renglón de ese Excel. Si un cálculo da algo
que no está ahí, **el cálculo está mal, no el Excel**.

Y encima de todo: [[quien-manda|los precios los dicta el dueño]] (R12).

---

## ¿Qué andas buscando?

| Si preguntas… | Abre |
|---|---|
| ¿Cómo se arma un precio, de principio a fin? | [[como-se-arma-un-precio]] |
| ¿De dónde sale el precio base? | [[precio-de-lista]] |
| ¿Cuánto suma dormir allá? | [[noches-y-estadia]] |
| ¿Cuánto suma pasear estando allá? | [[movimientos]] |
| ¿Y si no salen de Guadalajara? | [[de-donde-salen]] |
| ¿Y si van y vuelven en domingo? | [[el-dominical]] |
| ¿Por qué CDMX cobra por día? | [[el-dia-con-movimiento]] |
| ¿Por qué este viaje no da precio en línea? | [[cuando-no-se-cotiza-solo]] |
| ¿Quién decide un precio nuevo? | [[quien-manda]] |
| ¿Qué NO sabemos todavía? | [[lo-que-no-se]] |
| ¿Qué ya salió caro aprender? | [[errores-que-ya-pague]] |
| ¿Cómo usa todo esto el bot? | [[el-bot]] |

---

## Las veinticinco del 1-sep-2026

En un solo día se cerraron **veintiséis preguntas abiertas** y salieron
veinticinco reglas. Van primero porque son las más frescas y las que más
dinero movieron.

| | dice | dónde |
|---|---|---|
| **R45** | **si no se sabe al 100 %, no se da precio** | [[cuando-no-se-cotiza-solo]] |
| **R46** | Monterrey entra al catálogo con $49,200 | [[precio-de-lista]] |
| **R47** | Puebla: el día extra son $4,000, no $2,000 | [[el-dia-con-movimiento]] |
| **R48** | Oaxaca: con Huatulco o playas, **+$20,000** | [[movimientos]] |
| **R49/R50** | Puebla distingue: $1,000 sin movimiento | [[el-dia-con-movimiento]] |
| **R26** | 4 días y 3 noches por defecto | [[precio-de-lista]] |
| **R27** | la casilla vacía de un origen **es un dato**: le queda de camino | [[de-donde-salen]] |
| **R28** | San Juan Cosalá hereda el recargo de Chapala | [[de-donde-salen]] |
| **R29** | bandas de horas confirmadas · +80 km = $5,500 | [[movimientos]] |
| **R30** | Taxco $15,000 · Chalma $8,000 · Xochimilco $2,000 | [[movimientos]] |
| **R31** | DOMINICAL es ida y vuelta el mismo domingo | [[el-dominical]] |
| **R32** | Camécuaro desde Yurécuaro +$2,000 | [[de-donde-salen]] |
| **R33** | Puebla y Zacatlán: día extra $2,000 | [[noches-y-estadia]] |
| **R34** | **el piso NO le gana a un precio de lista** | [[como-se-arma-un-precio]] |
| **R35** | Acapulco y Cancún: día extra $4,000, movimientos aparte | [[precio-de-lista]] |
| **R36** | tres de los cuatro números raros del Excel eran correctos | [[quien-manda]] |
| **R37** | la fórmula $6,500 + $22/km queda confirmada | [[como-se-arma-un-precio]] |
| **R38** | Zacoalco se iguala a Tala; ninguno está en el Excel | [[precio-de-lista]] |
| **R39** | El Meco suma $3,000 encima | [[movimientos]] |
| **R40** | cómo se PIDEN los paseos y los 80 km | [[el-bot]] |
| **R41** | el redondeo va a la centena más cercana | [[como-se-arma-un-precio]] |
| **R42** | los paseos **se suman**, nunca sustituyen | [[movimientos]] |
| **R43** | **DOMINICAL**, doce destinos y sus dos orígenes | [[el-dominical]] |
| **R44** | Mazatlán dominical es correcto: por eso es caro | [[el-dominical]] |

---

## Las 25 primeras, en una línea cada una

Las revocadas y resueltas se dejan escritas a propósito: saber que algo se
intentó y no funcionó vale tanto como saber qué sí funciona.

| | dice | dónde se explica |
|---|---|---|
| **R1** | el Excel puede traer varios precios del mismo destino | [[precio-de-lista]] |
| **R2** | los paquetes incluyen sus días | [[precio-de-lista]] |
| **R3** | CDMX y Huasteca se cobran por día, no como paquete | [[movimientos]] |
| **R4** | Talpa Burrita es otro producto, no «Talpa 4 días» | [[precio-de-lista]] |
| **R5** | una columna puede traer el precio CON movimientos | [[movimientos]] |
| **R6** | el paso entre escalones NO es la tarifa del día extra | [[noches-y-estadia]] |
| **R7** | Guayabitos: hasta 4 días su precio, +$1,000 la noche extra | [[noches-y-estadia]] |
| **R8** | Puebla y Zacatlán: día extra $2,000 | [[noches-y-estadia]] |
| **R9** | Mariposa/Azufres/Pátzcuaro es recorrido propio, $29,000 | [[precio-de-lista]] |
| **R10** | ~~el precio depende del origen~~ · resuelta por R19 | [[de-donde-salen]] |
| **R11** | el vecino de un destino de lista se ancla a la lista | [[precio-de-lista]] |
| **R12** | **yo no propongo precios** | [[quien-manda]] |
| **R13** | estadía y movimiento se SUMAN, no se excluyen | [[noches-y-estadia]] |
| **R14** | el día de un paquete corre en los dos sentidos | [[precio-de-lista]] |
| **R15** | la medición depende de la salida, no solo del destino | [[de-donde-salen]] |
| **R16** | arriba de 1,400 km ya lo cotiza una persona | [[cuando-no-se-cotiza-solo]] |
| **R17** | hay destinos donde moverse no cuesta aparte | [[movimientos]] |
| **R18** | ~~abajo de $15,000 el día no es gratis~~ · **REVOCADA**, vivió dos días | [[errores-que-ya-pague]] |
| **R19** | el origen suma cuando NO queda de camino | [[de-donde-salen]] |
| **R20** | si no sé un precio, sale del Excel en cinco pasos | [[quien-manda]] |
| **R21** | Yurécuaro entra como origen | [[de-donde-salen]] |
| **R22** | el viaje de un día no paga movimiento | [[movimientos]] |
| **R23** | Morelia y Mariposa van planas hasta la 3ª noche | [[noches-y-estadia]] |
| **R24** | lo que la columna ya trae no se cobra dos veces | [[movimientos]] |
| **R25** | tres noches para todos · REVOCA R18 | [[noches-y-estadia]] |

---

## Dónde vive el código

Ninguna regla sirve si no se sabe qué archivo la obedece.

| Archivo | Qué manda ahí |
|---|---|
| `api/_tarifa.js` | **la única calculadora**. Cotizar y cobrar usan esta misma |
| `api/_destinos.js` | los precios de lista del Excel |
| `api/_origenes.js` | los recargos por salir de Ocotlán o Yurécuaro |
| `api/_publico.js` | qué se le deja ver al cliente — y qué nunca |
| `bot.js` | lo que contesta el chat. **No calcula precios** |
| `docs/CRITERIO-DE-PRECIOS.md` | el texto completo de las 25 reglas |
| `docs/LA-SPRINTER-SEGUN-EL-EXCEL.md` | la matriz de 49 destinos × 5 renglones |

---

## Cómo se comprueba

```bash
npm run probar
```

Las que tocan dinero: `probar-tarifa`, `probar-destinos`, `probar-sumas`,
`probar-cotiza-vs-cobra`, `probar-origenes`, `probar-dia-no-gratis`.

**`auditar-tarifa.cjs` lleva rato en rojo** con 3 fallas — espera que un viaje
de un día cobre movimiento, que es justo lo que R22 prohibió. Está pendiente de
actualizar, y mientras tanto corta la batería: lo que va después no se corre
solo. Ver [[lo-que-no-se]].
