# El corte, cada quince días

**12-sep-2026.** Lo pidió el dueño así:

> «Lo que quiero es que cada mes se suba toda la info que se generó a lo largo
> de conversaciones, cotizaciones, etc.»

> «Quiero que la IA aprenda de todas las conversaciones entre vendedores y
> clientes, que se vaya curtiendo y mejorando criterio.»

Y al enterarse de que el almacén purga a los 45 días, apretó la cadencia:

> **«Entonces cada 15 días almacenamos todo.»**

Por eso esto se llama **corte** y no cierre del mes.

Y antes había dejado dicha la regla que manda sobre todo esto: cuando el
sistema aprende un precio, **no sale solo a la página**. Entra a una tanda que
él revisa, como la compuerta del dueño. La página no da precios (R47,
`docs/SIN-PRECIOS.md`) y lo que se aprende son propuestas, no precios vivos.

---

## El almacén

> **Corregido el 13-sep-2026.** El almacén es el proyecto **eurotravel-almacen**
> de Supabase, ya con sus tablas. Falta conectarlo en Vercel: ver
> `docs/ENCENDER-EL-ALMACEN.md`.

Para correr el corte desde esta máquina hacen falta **las mismas dos llaves
que van en Vercel**, puestas en `.env.local` (que no sube a Git):

```
ALMACEN_URL=https://xxxxxxxx.supabase.co
ALMACEN_CLAVE=la llave secreta de eurotravel-almacen
```

La `service_role` se salta RLS a propósito: la usa el servidor, nunca el
navegador. No se pega en el chat ni en ningún archivo que suba.

---

## Por qué quince días y no treinta

**El almacén tira las conversaciones a los 45 días** (`VIDA_DIAS` en
`api/_almacen.js`). Con cortes mensuales el margen era de quince días: se
saltaba uno y ese mes desaparecía. Con quince, se pueden saltar **dos cortes**
y todavía no se pierde nada.

Los **precios no se purgan**, así que ésos no se pierden aunque pase el tiempo.

El script lo vigila solo: mira la fecha del corte pasado —los archivos de
`conversaciones/` se llaman por el día en que se hicieron, así que la carpeta
es la bitácora— y avisa antes de leer nada:

- **más de 20 días**: «vas tarde», pero todavía no se pierde nada
- **más de 45**: `⚠ SE PERDIÓ INFORMACIÓN`, con la fecha del corte pasado

Y cuando se pasó un corte, **pide lo que de verdad falta** —desde el corte
pasado hasta hoy— en vez de los dieciséis de siempre.

> Si aun así quiere más holgura, se sube `VIDA_DIAS`. Cuesta almacenamiento y
> nada más, y el script lo sigue solo: hay una prueba que exige que los dos
> números digan lo mismo.

---

## El ritual, cuando el almacén ya exista

Dos comandos, cada quince días:

```bash
npm run corte
```

```bash
npm run precios:cerebro
```

### Qué deja cada uno

| Archivo | Qué trae | ¿Sube a Git? |
|---|---|---|
| `cerebro/el-corte.md` | las cuentas de la quincena | **sí** |
| `conversaciones/AAAA-MM-DD.md` | las conversaciones enteras | **no** |
| `cerebro/precios-que-he-dado.md` | el resumen de precios | **sí** |
| `docs/PRECIOS-QUE-HE-DADO.md` | la tabla completa | **sí** |

**El nombre del archivo lleva el día, y eso no es cosmético.** La primera
versión lo nombraba `AAAA-MM.md`, cuando el corte iba a ser mensual: con
quince días, el segundo corte del mes le pasaba encima al primero y se perdía
la quincena entera. En silencio, y del archivo que no está en Git — o sea sin
manera de recuperarlo.

La ventana por omisión son **dieciséis** días y no quince: el día de más es
traslape a propósito, para que un corte hecho un día tarde no deje hueco.
Repetir unas cuantas conversaciones en dos archivos no le hace daño a nadie.

---

## Por qué las conversaciones NO entran al repositorio

Ésta es la única decisión de diseño que vale la pena discutir, así que queda
escrita:

Las conversaciones traen lo que la gente escribió — **su nombre, su domicilio,
su teléfono, a veces de qué es la fiesta**. En Git eso se queda **para
siempre**: aunque se borre el archivo después, sigue en el historial, y lo ve
todo el que clone el repositorio.

Y no hace falta que estén ahí para lo que él quiere. Lo que quiere es que **la
IA se vaya curtiendo**, y para eso se leen las conversaciones y se escribe **la
lección** en `cerebro/`, con palabras propias. *La lección sube; la
conversación no.* El criterio de venta no necesita el teléfono de nadie.

El resumen en números —cuántas conversaciones, cuántas llegaron a precio,
cuántas se quedaron esperando— **sí** sube, porque no lleva un dato de nadie.

> **Si el dueño prefiere versionarlas también**, es quitar el renglón
> `conversaciones/` del `.gitignore`. Pero que sea decisión suya, no de un
> script que lo hizo sin preguntar.

---

## Qué mirar del resumen

De las cuentas que saca, la que más dice es **«se quedaron con el cliente
hablando al último»**: cada una es alguien que preguntó y no volvió a saber de
nosotros. Es venta parada, y es el número que conviene ver bajar corte a corte.

Después, **«lo que más pidieron»**: un destino que se repite y no tiene renglón
en el Excel es justo el que vale la pena agregarle. Ahí es donde el cotizador
se va soltando, un destino a la vez y con su «va».

---

## Lo que lo vigila

`pruebas/probar-corte.mjs` — 55 comprobaciones, sin tocar la red.

Buena parte cuidan **una sola cosa, que es la irreversible**: que el archivo
que sube a Git no lleve un teléfono, ni un nombre, ni un domicilio, ni una sola
frase de nadie. Se comprueban **todos** los mensajes de la quincena de prueba,
uno por uno.

> Eso salió de romperlo a propósito. La primera versión miraba dos frases
> escogidas a dedo: al meterle el primer mensaje de cada conversación al
> resumen, **el teléfono sí se cazó y la frase no**. Una fuga que la prueba
> deja pasar es peor que no tener prueba, porque se firma el commit creyendo
> que está revisado.

Y hay un candado que no es una prueba sino la forma del código:
`laPaginaDelMes()` —la que escribe el archivo que sube a Git— **recibe las
cuentas, no las conversaciones**. No puede filtrar lo que no ve.
