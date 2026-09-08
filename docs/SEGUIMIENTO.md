# El seguimiento al que no contestó

Dictado del dueño el 6-sep-2026, en dos vueltas. La que vale:

> Una vez que se mandó la cotización, si el cliente no contestó: a las
> 24 horas, a los 3 días y a los 7 días. Pero si el cliente contesta, ya
> no quiero mensajes automáticos.

(La primera vuelta decía 4 / 24 / 72 h; esa misma tarde, con el mandato
del agente, lo dejó en 24 h / 3 d / 7 d.)

Antes de ese día los tres textos existían (`api/_recordatorios.js`, con
diez variantes cada uno) pero **nadie los mandaba**: no había cron ni
nada que los llamara. Ahora sí.

## Cómo funciona

1. Cuando el cliente **recibe** el precio (después del «va» o del número
   del dueño), la ficha guarda `precio_en` y `toques = 0`.
2. Cada mensaje del cliente guarda `cliente_en`.
3. Cada 15 minutos Vercel llama `GET /api/whatsapp/seguimiento` (el cron
   de `vercel.json`). El bot lee las fichas con precio y toques
   pendientes y, para cada una, `api/_seguimiento.js` decide:
   - **Contestó después del precio** → se cierra, no se le escribe.
   - **Avanzó** (dijo que sí, mandó comprobante, ya tiene contrato) → se cierra.
   - **Le toca** (22 h, 3 d o 7 d desde el precio, y no se ha mandado ese) → se manda.
     Desde el 8-sep-2026 («quitamos lo de Meta, es mucho»): el de 22 h cae
     dentro de la ventana de 24 h del último mensaje del cliente y sale como
     **texto libre, sin plantilla ni costo**. Los de 3 y 7 días, fuera de la
     ventana, **no se le mandan al cliente**: el dueño recibe un resumen
     («📋 Seguimiento: escríbeles tú») con número, viaje y día, y les escribe
     desde su teléfono, que no paga ventana. Solo si algún día se configuran
     `WHATSAPP_PLANTILLA_TOQUE2/3`, esos toques vuelven a salir solos.
   - **Es de noche** (9 p.m. a 9 a.m. de Guadalajara) → espera a la mañana.
   - **Pasaron 8 días** → se cierra aunque falte uno. Tres toques y silencio.
   - Si se saltaron dos (cron caído) se manda **solo** el que toca ahora.
4. Se marca la ficha **antes** de mandar: un envío que truene a medias
   no se repite cada 15 minutos.

Los textos son los de `api/_recordatorios.js`: el primero no vende
(«¿te llegó bien?»), el segundo abre una duda, el tercero usa la
aversión a la pérdida una sola vez. Nunca precio, nunca descuento.

## La ventana de 24 horas de Meta: el primero cabe, los otros dos van al dueño

Meta solo deja mandar **texto libre** dentro de las 24 horas siguientes
al **último mensaje del cliente**. Fuera de esa ventana solo pasan
**plantillas aprobadas**, que cuestan unos 4 centavos de dólar cada una
(Dualhook va por la API de Meta, así que la regla es la misma).

Decisión del dueño, 8-sep-2026: **«quitamos lo de Meta, es mucho»** (las
plantillas eran la mitad del costo mensual del bot). Por eso:

- El **primer toque es a las 22 h** del precio, no a las 24: el cliente
  casi siempre escribió poco antes de recibir el precio, así que la
  ventana sigue abierta y el toque sale como **texto libre, gratis**.
- Los de **3 y 7 días** caen fuera de la ventana. Sin plantilla, el bot
  **no le escribe al cliente**: marca el toque (para no repetirlo) y le
  manda al dueño **un solo resumen** por corrida del cron, con número,
  viaje, gente, total y a qué día va cada uno, más dos ideas de texto. El
  dueño les escribe desde su teléfono, que no paga ventana. En el registro
  se cuenta como `alDueno`.
- Si algún día se configuran `WHATSAPP_PLANTILLA_TOQUE2/3`, esos toques
  vuelven a salir solos como plantilla. `WHATSAPP_PLANTILLA_TOQUE1` no
  hace falta salvo que el cliente lleve más de un día sin escribir cuando
  le toque el primero (raro: el precio llega en la misma plática).

Si no hay `DUENO_WHATSAPP`, los toques que le tocaban al dueño quedan
marcados y se avisa en el registro: `[seguimiento] N toque(s) le tocan al
dueño pero falta DUENO_WHATSAPP`.

### Lo que dice la investigación (7-sep-2026)

Se buscó lo publicado sobre seguimiento de cotizaciones por WhatsApp y
las reglas de Meta para plantillas. Lo que cambia los textos:

- **Una secuencia de tres en una semana no es acoso** si cada mensaje
  trae algo nuevo y **ninguno repite el precio**: día 1 comprobar que
  llegó, día 3 un dato que destrabe, día 7 cerrar o pedir permiso de
  archivar. Un solo seguimiento recupera entre 20 y 30 % de las
  cotizaciones que se quedaron calladas; las secuencias de 4 a 7 toques
  triplican la respuesta de las de 1 a 3
  ([CommuniQate](https://www.communiqate.nl/en/hub/offerte-opvolgen-via-whatsapp),
  [Leo Transforma](https://www.leotransforma.co/blog/seguimiento-cotizacion-whatsapp),
  [Cirrus Insight](https://www.cirrusinsight.com/blog/sales-follow-up-statistics)).
- **La pregunta más contestada es la que se responde con una palabra**:
  «¿sigue en pie o lo dejamos?» supera por mucho a «¿qué decidiste?».
  Ofrecer una salida digna en el último mensaje **sube** la respuesta, no
  la baja ([Wassenger](https://wassenger.com/blog/en/how-to-follow-up-on-whatsapp),
  [EveryCatch](https://everycatch.com/learn/articles/how-to-use-whatsapp-for-business-follow-up-without-overstepping)).
- **En México, el seguimiento a las 24 h bien armado responde arriba del
  50 %**, y conviene mandar entre media mañana y primeras horas de la
  tarde, nunca de noche ni en fin de semana
  ([ITPago](https://itpago.com/blog/7-mensajes-de-seguimiento-a-clientes-por-whatsapp-en-mexico)).
  El cron ya respeta las 9 a.m. a 9 p.m.
- **Meta, en 2026, rechaza más plantillas de marketing que no ofrecen
  salida** («responde STOP») y las vagas («Recordatorio: {{1}}»). Reglas
  de variables: no empezar ni terminar el cuerpo con una, no ponerlas
  juntas, un valor de muestra por variable, sin `#`, `$` ni `%`
  ([Spur](https://www.spurnow.com/en/blogs/why-are-my-whatsapp-templates-getting-rejected),
  [Jesty](https://jestycrm.com/blog/whatsapp-message-template-guidelines-how-to-avoid-meta-rejection)).
- **Personalizar sube la respuesta**: por eso cada plantilla lleva UNA
  variable, `{{1}}`, que el bot llena con «tu viaje a Puerto Vallarta»
  (o «tu viaje» si no sabe el destino).

Lo que ya estaba y se confirma: nunca precio ni descuento en el
seguimiento, escasez solo real (las fechas sí se llenan), tres toques y
silencio.

### Las plantillas (opcionales desde el 8-sep-2026)

Ya no hacen falta para que el seguimiento funcione. Quedan documentadas
por si el dueño algún día prefiere pagarlas para que los toques de 3 y 7
días salgan solos. La de 24 h que ya creó queda sin uso y no estorba.

En **WhatsApp Manager → Herramientas de la cuenta → Plantillas de
mensaje → Crear plantilla**. Categoría: **Marketing**. Idioma: **Español
(MEX)**. Sin encabezado, sin pie, sin botones. **Una variable, `{{1}}`**;
cuando Meta pida el valor de muestra, escribe `tu viaje a Puerto
Vallarta`. Texto tal cual:

**`seguimiento_24h`** (comprobar que llegó, fácil de contestar, con salida):

> Hola 🙌 Ayer te pasé la cotización de {{1}}. ¿Sí te llegó bien? Si algo cambió (la fecha, cuántos van o la unidad), dime y te la ajusto en un momento, sin compromiso.

(Dictado del dueño, 8-sep-2026: **sin ofrecer «stop»**, porque espanta al
cliente. La investigación decía que Meta rechaza más plantillas de
marketing sin salida; se acepta ese riesgo. El bot detecta el «ya no» en
las palabras del cliente y se despide, ver abajo.)

**`seguimiento_3d`** (un dato que destraba: casi siempre están juntando al grupo):

> Hola 🙌 ¿Cómo va lo de {{1}}? Si todavía están juntando al grupo, te mando un resumen para que se los reenvíes. ¿Lo vemos esta semana o lo dejamos para más adelante?

**`seguimiento_7d`** (cerrar con salida digna; la escasez es real):

> Hola, te escribo por última vez por lo de {{1}} 🚌 Las fechas se van apartando y no quisiera que la tuya se quede sin unidad. Si sigue en pie, dime y te digo cómo apartar; si ya no, también dímelo y aquí lo dejo, sin problema 🙌

Si el cliente contesta que **ya no** («ya no», «no gracias», «ya no
vamos a ir», «ya contratamos otro», «se canceló», «déjalo así»… y también
«stop»), el bot se despide con «Va, entendido 🙌 Cualquier cosa que se te
ofrezca más adelante, aquí ando» y el seguimiento se cierra solo. Un «ya
no» con datos («ya no, mejor a Chapala») no es un adiós: sigue a la IA.

Cuando Meta las apruebe (minutos a un día), en Vercel:

| Variable | Valor |
|---|---|
| `WHATSAPP_PLANTILLA_TOQUE1` | `seguimiento_24h` |
| `WHATSAPP_PLANTILLA_TOQUE2` | `seguimiento_3d` |
| `WHATSAPP_PLANTILLA_TOQUE3` | `seguimiento_7d` |
| `WHATSAPP_PLANTILLA_IDIOMA` | `es_MX` (es el valor por omisión; solo si Meta la registró con otro código) |

Costo aproximado de una plantilla de marketing en México: unos 4
centavos de dólar por mensaje. Con 500 conversaciones al mes salían unos
25 dólares mensuales solo de plantillas; sin ellas el seguimiento cuesta
cero y el bot queda en la IA y Dualhook.

## Lo que el dueño tiene que hacer (una vez)

1. **La base.** En Supabase → proyecto del bot → SQL Editor, correr el
   bloque «6-SEP-2026 · EL SEGUIMIENTO» de `docs/ALMACEN.sql` (o el
   archivo completo: todo es `if not exists`). Sin esto el bot sigue
   funcionando, avisa en el registro y no hay seguimiento.
2. **La llave del cron.** En Vercel → eurotravel-web → Settings →
   Environment Variables: `CRON_SECRET`, de 16 caracteres o más. Vercel
   la manda solo en cada llamada del cron. Para inventarla:

   ```powershell
   -join ((48..57 + 97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
   ```
3. **Contestar el resumen.** Cuando le llegue «📋 Seguimiento: escríbeles
   tú», escribirles desde su teléfono. Las plantillas son opcionales.

## Cómo saber que está corriendo

En los registros de Vercel (`get_runtime_logs`, query `seguimiento`) cada
15 minutos aparece una línea:

```
[seguimiento] {"revisadas":3,"mandados":1,"cerradas":1,"esperan":1,"sinPlantilla":0,"alDueno":1}
```

Si aparece `falta CRON_SECRET`, falta el paso 2. Si aparece
`la tabla fichas no tiene las columnas del seguimiento`, falta el paso 1.
`alDueno` son los toques que le llegaron al dueño en el resumen para que
escriba él; `sinPlantilla` ya solo sube si no hay texto para ese toque.

## Pruebas

- `pruebas/probar-seguimiento.cjs`: la decisión, con reloj de mentiras.
- `pruebas/probar-seguimiento-puerta.mjs`: la puerta del cron y el
  envío de punta a punta, con base y WhatsApp de mentiras.
