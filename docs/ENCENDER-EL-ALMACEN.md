# Encender el almacén

**13-sep-2026.** Pendiente #3 de `docs/PENDIENTES-DE-LA-PAGINA.md`. Mientras
esto no exista, **no se guarda ni una conversación ni un precio**.

Son tres partes. Tardan unos 15 minutos.

---

## ⚠️ Antes de empezar: NO es el proyecto EJR

En tu Supabase hay **un solo proyecto, EJR**. **Esa es la base en producción
de EuroSystem**, con contratos reales (lo dice `EUROSYSTEM/CLAUDE.md`).

**El SQL del almacén NO se corre ahí.** Tú lo pediste el 2-sep: *«me gustaría
que esa base de datos sea independiente, no me gustaría que luego se esté
mezclando información»*.

Y no es solo orden: si las dos cosas vivieran en la misma base, compartirían
la misma llave maestra. Una fuga de esa llave expondría **a la vez** los
contratos y las conversaciones de los clientes.

**Cuesta $10 USD al mes.** Es lo que Supabase cobra por un proyecto más en tu
organización, y es el precio de que no se mezclen.

---

## Parte 1 · Crear el proyecto (5 min)

1. Entra a **supabase.com/dashboard**
2. Organización **tachoj37-tech's Org** → botón **New project**
3. Llénalo así:

   | Campo | Qué poner |
   |---|---|
   | Name | **`eurotravel-almacen`** — que se note que no es EJR |
   | Database password | Genera una y **guárdala** en tu gestor de contraseñas. La página no la usa, pero sin ella no se recupera la base |
   | Region | **East US (North Virginia)** |

   > Virginia y no Ohio (donde está EJR) porque ahí mismo corren las funciones
   > de la página en Vercel. El bot le da **4 segundos** al almacén para
   > contestar; entre más cerca, menos riesgo de que se le acabe el tiempo.

4. Te va a enseñar el cargo de **$10 al mes** → **Create new project**
5. Espera a que diga **Healthy** (uno o dos minutos)

---

## Parte 2 · Crear las tablas (3 min)

1. Menú de la izquierda → **SQL Editor** → **New query**
2. Abre **`eurotravel-web/docs/ALMACEN.sql`**, copia **todo** —de la primera a
   la última línea— y pégalo
3. **Run**
4. Tiene que decir **«Success. No rows returned»**

**Cómo se comprueba:** menú **Table Editor**. Tienen que aparecer **siete
tablas**:

```
charlas   fichas   mensajes   precios   tickets   turnos   vistos
```

Y cada una con el candado de **RLS enabled**. Si una dice «RLS disabled», no
sigas y avísame: sin ese candado, cualquiera con la llave pública podría leer
las conversaciones.

> Si ya lo corriste y no estás seguro de si salió completo, **córrelo otra
> vez**: todo el archivo usa `if not exists`, así que repetirlo no rompe nada.

---

## Parte 3 · Darle las llaves a la página (5 min)

### 3a · Copiar las dos cosas de Supabase

En el proyecto **eurotravel-almacen** → **Project Settings** → **API**
(en algunas versiones se llama **Data API** o **API Keys**):

| Qué | Dónde está | Cómo se ve |
|---|---|---|
| **Project URL** | arriba | `https://xxxxxxxx.supabase.co` |
| **service_role** | en «Project API keys», marcada como **secret** | un texto larguísimo que empieza con `eyJ` |

> **Ojo, que ya pasó dos veces:** una vez se pegó una llave donde iba la
> dirección, y otra la dirección con `/rest/v1` de más. La dirección va
> **exacta**, solo `https://xxxxxxxx.supabase.co`.
>
> Y es la **service_role**, no la **anon** ni la **publishable**. La anon no
> puede escribir —las tablas nacen cerradas a propósito— y el bot fallaría en
> silencio.

**La service_role es la llave maestra de esa base.** No la pegues en el chat,
ni en WhatsApp, ni en ningún archivo. Solo va en Vercel.

### 3b · Ponerlas en Vercel

1. **vercel.com** → equipo **EURO** → proyecto **eurotravel-web**
2. **Settings** → **Environment Variables**
3. Agrega dos, marcando **solo Production**:

   | Key | Value |
   |---|---|
   | `ALMACEN_URL` | la Project URL |
   | `ALMACEN_CLAVE` | la service_role |

4. **Deployments** → el de arriba → menú **⋯** → **Redeploy**

   > Sin redesplegar, la página no ve las variables nuevas.

---

## Parte 4 · Avísame

Con eso lo compruebo yo desde aquí:

- que las siete tablas existan con su candado
- que el despliegue nuevo esté **READY**
- que el bot conteste sin errores al leer el almacén
- y el primer renglón real: el primer ticket que contestes **después** de
  esto tiene que quedar con **tu precio y el del motor, lado a lado**

---

## Si algo sale mal

| Lo que ves | Qué es |
|---|---|
| El SQL da un error rojo | Mándame **el mensaje de error**, no la llave |
| Faltan tablas | El pegado quedó incompleto: vuelve a copiar el archivo entero y corre otra vez |
| Todo bien pero el bot no guarda | Casi siempre es la anon en vez de la service_role, o la dirección con algo de más |
