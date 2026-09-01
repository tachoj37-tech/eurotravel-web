# Quién manda

## R12 · Yo no propongo precios

**El número lo dicta el dueño. Siempre.**

Lo que sí hago: enseñar qué cobraría la página hoy, y señalar lo que huela
raro. Lo que no: elegir por él.

Esta es la regla que más veces evita un error caro, porque el error caro casi
nunca es un número mal copiado — es un número **inventado con confianza**.

---

## Cómo se ve en el código

El bot **no calcula precios**. Junta datos y se los pasa a `/api/cotizar`, que
es el único que cobra. Si esa puerta falla, el bot **no improvisa una cifra**:
pasa la conversación con una persona.

Hay una prueba que le tira **16 formas distintas de preguntar el precio** y
exige que no suelte ni una cifra. Se verificó que muerde: al meterle un precio
a propósito, lo caza en 7 de las 16.

Para autobús y Suburban —que no cotizan solos— el bot arma una **solicitud** con
todo, **sin precio**. Ver [[el-bot]].

---

## R20 · Cuando no sé un precio

No se inventa: **sale del Excel, en cinco pasos**, y siempre se dice **de qué
celda salió**.

Decir «creo que unos doce mil» no es ayudar. Decir «la fila 11, columna
Vallarta, dice $12,000» sí, porque él puede comprobarlo en un segundo.

---

## Lo que se señala, no se cambia

Números del Excel que huelen raro. **Ninguno se implementó como está.** Están
señalados, no movidos:

| | dice | por qué no cuadra |
|---|---|---|
| **Chiapas desde Yurécuaro** | $16,500 | desde Guadalajara son $85,000. Se dejó fuera |
| **Puebla desde Yurécuaro** | +$12,000 | desde Ocotlán no sube nada, y Yurécuaro queda MÁS de camino. Único renglón donde el patrón se invierte. **Sí se implementó** |
| **Huasteca desde Ocotlán** | +$4,000 a 3 días, +$2,000 a 4 | el recargo BAJA al crecer los días, al revés de todos |
| **Camécuaro desde Yurécuaro** | $14,500, igual que Guadalajara | estando a 30 km de Yurécuaro y a 157 de Guadalajara |

---

## Y los paquetes que confirmó venían mal

De cinco paquetes, **dos los confirmó y los dos estaban mal**:

| | yo suponía | él dijo |
|---|---|---|
| Tolantongo | 4 días | **3** |
| Barrancas | 4 días | **7** |

Con Barrancas eran **$9,000 de sobrecobro** en un viaje de seis días.

Quedan tres saliendo solo del nombre de su columna, sin confirmar: **Cancún 17,
Chiapas 8, Acapulco 4**. Están en [[lo-que-no-se]].

---

Relacionado: [[lo-que-no-se]] · [[errores-que-ya-pague]] · [[de-donde-salen]] ·
[[MAPA]]
