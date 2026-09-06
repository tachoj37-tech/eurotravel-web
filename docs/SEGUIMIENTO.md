# El seguimiento al que no contestó

Dictado del dueño el 6-sep-2026:

> Una vez que se mandó la cotización, si el cliente no contestó: a las
> 4 horas, a las 24 y a las 72. Pero si el cliente contesta, ya no
> quiero mensajes automáticos.

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
   - **Le toca** (4, 24 o 72 h desde el precio, y no se ha mandado ese) → se manda.
   - **Es de noche** (9 p.m. a 9 a.m. de Guadalajara) → espera a la mañana.
   - **Pasaron 96 h** → se cierra aunque falte uno. Tres toques y silencio.
   - Si se saltaron dos (cron caído, una noche larga) se manda **solo** el que toca ahora.
4. Se marca la ficha **antes** de mandar: un envío que truene a medias
   no se repite cada 15 minutos.

Los textos son los de `api/_recordatorios.js`: el primero no vende
(«¿te llegó bien?»), el segundo abre una duda, el tercero usa la
aversión a la pérdida una sola vez. Nunca precio, nunca descuento.

## La ventana de 24 horas de Meta

Meta solo deja mandar **texto libre** dentro de las 24 horas siguientes
al **último mensaje del cliente**. Fuera de esa ventana solo pasan
**plantillas aprobadas** (Dualhook va por la API de Meta, así que la
regla es la misma).

Consecuencia: el toque de las 4 horas casi siempre sale como texto
libre; los de 24 y 72 casi siempre necesitan plantilla. Sin plantilla
configurada, ese toque **no se manda** y queda en el registro:
`[seguimiento] toque 2 a …1234: la ventana de 24 h de Meta ya cerró y no hay WHATSAPP_PLANTILLA_TOQUE2`.

### Las plantillas que hay que crear

En **WhatsApp Manager → Herramientas de la cuenta → Plantillas de
mensaje → Crear plantilla**. Categoría: *Marketing* (Meta clasifica los
seguimientos de cotización como marketing; si la aprueban como
*Utilidad* mejor, sale más barata). Idioma: **Español (MEX)**. Sin
variables, sin encabezado, sin botones. Texto tal cual:

**`seguimiento_4h`** (por si el dueño confirmó el precio mucho después
del último mensaje del cliente):

> Hola 🙌 Ya te pasé la cotización de tu viaje con Eurotravel. Si te quedó alguna duda, aquí ando.

**`seguimiento_24h`**:

> Hola 🙌 Ayer te pasé la cotización de tu viaje con Eurotravel. Si te quedó alguna duda o quieres ajustar algo (fecha, unidad, cuántos van), dime y lo vemos. Sin compromiso.

**`seguimiento_72h`**:

> Hola, te escribo por lo de tu viaje 🚌 Las fechas se van apartando con anticipo y no quisiera que la tuya se quede sin unidad. Si sigues con el plan, dime y te digo cómo apartar; si ya no, también dímelo y no te molesto más 🙌

Cuando Meta las apruebe (minutos a un día), en Vercel:

| Variable | Valor |
|---|---|
| `WHATSAPP_PLANTILLA_TOQUE1` | `seguimiento_4h` |
| `WHATSAPP_PLANTILLA_TOQUE2` | `seguimiento_24h` |
| `WHATSAPP_PLANTILLA_TOQUE3` | `seguimiento_72h` |
| `WHATSAPP_PLANTILLA_IDIOMA` | `es_MX` (es el valor por omisión; solo si Meta la registró con otro código) |

Costo aproximado de una plantilla de marketing en México: unos 4
centavos de dólar por mensaje. Con 400 cotizaciones al mes y dos
plantillas por cliente que no contesta, menos de 30 dólares al mes en
el peor caso.

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
3. **Las plantillas**, como arriba. Hasta que existan, solo sale el
   toque que caiga dentro de la ventana de 24 horas.

## Cómo saber que está corriendo

En los registros de Vercel (`get_runtime_logs`, query `seguimiento`) cada
15 minutos aparece una línea:

```
[seguimiento] {"revisadas":3,"mandados":1,"cerradas":1,"esperan":1,"sinPlantilla":0}
```

Si aparece `falta CRON_SECRET`, falta el paso 2. Si aparece
`la tabla fichas no tiene las columnas del seguimiento`, falta el paso 1.

## Pruebas

- `pruebas/probar-seguimiento.cjs`: la decisión, con reloj de mentiras.
- `pruebas/probar-seguimiento-puerta.mjs`: la puerta del cron y el
  envío de punta a punta, con base y WhatsApp de mentiras.
