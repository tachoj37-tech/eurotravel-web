# El almacén: ya existía

**13-sep-2026.** Este documento decía cómo *crear* el almacén. **Estaba mal:
el almacén ya existe y está conectado en producción.** Queda corregido, con lo
que de verdad hay que hacer —que es una sola línea— y con el error escrito,
para que no se repita.

---

## Lo que hay de verdad

El **5-sep-2026** el dueño creó una organización **gratis y aparte** en
Supabase, **«EuroBot»**, a propósito:

- un proyecto más en la organización de pago cuesta **$10 al mes**
- y meterlo en **EJR** le daría al bot la llave maestra de EuroSystem

Ahí corrió `docs/ALMACEN.sql` y puso `ALMACEN_URL` y `ALMACEN_CLAVE` en Vercel.
El 8-sep ya estaba en uso: se cayó por una llave mal pegada y la repuso.

**Comprobado el 13-sep en los registros de Vercel:** a las 16:30 dice
`[almacen] no se pudo: timeout`. Esa línea **solo sale si las llaves están
puestas** —sin ellas, el código ni siquiera intenta llamar—. Y a las 16:45 y
17:00 el recordatorio automático leyó el almacén sin error.

La conexión de Supabase que uso **no ve la organización EuroBot**, solo la de
pago. Por eso no aparecía.

---

## Lo único que falta: una línea

La columna `calculado` —lo que el motor calculó, junto al precio del dueño—
se agregó el 13-sep. **El almacén de EuroBot no la tiene.**

En **supabase.com/dashboard** → organización **EuroBot** → su proyecto →
**SQL Editor** → **New query**, pega y corre:

```sql
alter table precios add column if not exists calculado integer;
```

Tiene que decir **«Success. No rows returned»**. Si lo corres dos veces no
pasa nada.

**Sin esa línea el bot sigue funcionando** —desde `5c8ad90`, si falta la
columna guarda el precio sin ella y lo grita en el registro—, pero **esos
precios nacen sin el número del motor**, y ese número no se reconstruye
después.

---

## ⚠️ Lo que NO se hace

**No se corre nada en EJR.** Es la base en producción de EuroSystem, con
contratos reales.

---

## El error, para que no se repita

Durante el 12 y 13 de sep le dije varias veces al dueño que **«el almacén no
existe»**. Lo deduje de dos indicios:

1. las llaves no están en `.env.local` — pero ese archivo es de **esta
   máquina**, no de Vercel
2. el volcado de precios nunca se había generado — pero ese script **se corre
   a mano**

Ninguno de los dos lo prueba, y **mi propia memoria decía lo contrario**. El
registro de Vercel lo desmintió en un minuto.

Por creerlo pasaron tres cosas:

- **Se creó un proyecto que sobra:** `eurotravel-almacen`
  (`xivgvnaeigqmdocvqlvo`), en la organización de pago, **$10 al mes** — justo
  lo que el dueño había evitado. Está vacío. **Hay que borrarlo**, desde el
  dashboard: Project Settings → General → Delete project.
- **Se subió una regresión:** el precio con la columna nueva se habría
  rechazado entero. No se perdió ninguno y quedó arreglado en `5c8ad90`.
- **Este documento dijo que había que crear lo que ya existía.**

La lección: **antes de afirmar que algo no existe en producción, se mira
producción.** Los registros de Vercel estaban a una consulta.
