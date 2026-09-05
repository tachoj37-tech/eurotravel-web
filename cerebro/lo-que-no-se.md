# Lo que no se sabe

Ordenado por **cuánto dinero mueve**, no por cuánto inquieta.

El texto largo de cada una está en `docs/PREGUNTAS-ABIERTAS.md`.

---

## Lo que más pesa: números míos que llevan semanas cobrándose

No son dudas de interpretación. Son cifras que **yo puse** y que la página ya
está cobrando.

### Las bandas de horas arriba de las ocho

Su Excel dice «MOV SPR $3,000 X DIA», y con eso alcanza para un día normal.
**Los otros cuatro escalones los inventé.**

Vallarta 4 días con 2 movimientos: **$25,000 a ocho horas, $29,000 a catorce**.
Cuatro mil de diferencia salidos de mi cabeza.

### El piso de $3,000 por día

Tampoco está en su Excel. **Manda en 237 de 588 combinaciones** — más de un
tercio de la tabla. Chapala a 7 días: sin piso $9,500, con piso **$24,000**.

### La fórmula: $6,500 + $22 el kilómetro

La calibré yo contra sus 40 precios reales. **Cotiza todo destino que no esté
en su lista**, que en la práctica es la mayoría de lo que pide un cliente.

| | | |
|---|---|---|
| Sahuayo | 2 días | $13,500 |
| Comala | 4 días | $17,200 |
| Querétaro | 3 días | $21,900 |
| Bernal | 3 días | $25,400 |

Si alguno de esos cuatro está lejos, la fórmula completa está corrida.

---

## Cosas que SU Excel dice y la página no cobra

**Los tres paseos con nombre.** Chalma vale +$8,000 en su fila 10 y la página
cobra $3,000: **cinco mil de menos** cada vez. Ver [[movimientos]].

**Qué es «DOMINICAL».** Sus filas 25 y 27 traen precios mucho más bajos —CDMX de
$30,000 a $16,000—. Mi mejor lectura es **salida de domingo**, pero es lectura
mía.

---

## Decisiones recién tomadas que él no ha visto

**Acapulco:** misma forma que Guayabitos —playa, cuatro días— pero hoy sí lleva
los movimientos incluidos. 4 días con 2 movimientos cobra **$60,000**; si fuera
estancia como Guayabitos serían **$66,000**.

**Los cinco huérfanos de Ocotlán:** San Juan Cosalá, Magdalena, Zirahuén, Tepic
y León pagan precio de Guadalajara aunque salgan de Ocotlán, porque su fila 11
no los menciona. Sus vecinos de lista sí suben.

**Zacoalco a un día desde Ocotlán:** dijo «mínimo 9,000» mirando renglones de
dos días. A **un** día da **$8,000**.

**Duraciones sin confirmar:** Cancún 17, Chiapas 8, Acapulco 4 — salen del
nombre de su columna. De cinco paquetes, los dos que confirmó **venían mal**.

---

## ~~La auditoría en rojo~~ · RESUELTO el 2-sep-2026

Queda escrito porque la lección vale más que el arreglo.

`auditar-tarifa.cjs` llevaba semanas en rojo esperando reglas que el dueño ya
había cambiado. Eso se sabía. **Lo que no se sabía es lo que tapaba:** la
batería encadenaba los 37 archivos con `&&` y esa auditoría era la octava, así
que **las 29 pruebas siguientes no se corrían.** Quien veía el rojo creía estar
viendo 37 archivos y estaba viendo 8.

Se descubrió el mismo día, y por accidente: un cambio de dinero (R51) rompió
tres pruebas y **la batería no las delató** — estaban del otro lado del corte.

Y detrás de eso apareció otra: **`probar-origenes.cjs` ni siquiera estaba en la
lista.** 236 comprobaciones de los recargos de Ocotlán y Yurécuaro, dinero,
que nunca habían corrido.

> **La lección:** una prueba que lleva tiempo en rojo no es solo una prueba
> rota. Es una **venda**. Y una lista escrita a mano se olvida — por eso ahora
> los archivos se descubren solos.

---

Relacionado: [[quien-manda]] · [[movimientos]] · [[como-se-arma-un-precio]] ·
[[MAPA]]
