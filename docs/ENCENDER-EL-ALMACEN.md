# Conectar el almacén

**13-sep-2026.** Lo que falta para que el bot guarde conversaciones y precios.

## Lo que ya está hecho

El proyecto **`eurotravel-almacen`** ya existe en tu Supabase, en la misma
organización que EJR:

| | |
|---|---|
| Dirección | `https://xivgvnaeigqmdocvqlvo.supabase.co` |
| Región | Virginia (junto a las funciones de la página) |
| Tablas | las 7, creadas: fichas, charlas, mensajes, tickets, precios, turnos, vistos |
| Candado | probado: con la llave pública no se lee ni se escribe nada |
| Costo | $10 USD al mes |

**No lo borres.** Es el almacén.

> **Lo que no sabemos:** en Vercel ya hay unas llaves del almacén puestas, y
> apuntan a algo que **no contesta**. No se sabe de dónde salieron. Con este
> paso se reemplazan y deja de importar.

## ⚠️ No es EJR

**EJR** es la base de EuroSystem, con los contratos. **No se toca.** Todo lo de
abajo es en **eurotravel-almacen**.

---

## Paso 1 · Copiar la llave secreta (2 min)

1. Entra a **supabase.com/dashboard**
2. Abre el proyecto **eurotravel-almacen** (no EJR)
3. Menú izquierdo, abajo: **Project Settings** (el engrane)
4. **API Keys**
5. En la sección **Secret keys**, copia la llave. Empieza con **`sb_secret_`**

   > Si en vez de eso ves una pestaña **Legacy**, la que sirve es
   > **service_role** (empieza con `eyJ`). **Nunca** la `anon` ni la
   > `publishable`: con esas el bot no puede escribir.

**Esa llave es la llave maestra del almacén.** No la mandes por el chat, ni por
WhatsApp, ni la guardes en un archivo. Solo va en Vercel.

## Paso 2 · Ponerla en Vercel (3 min)

1. Entra a **vercel.com** → equipo **EURO** → proyecto **eurotravel-web**
2. **Settings** → **Environment Variables**
3. Busca **`ALMACEN_URL`** y **`ALMACEN_CLAVE`**. **Ya existen** — no crees
   otras: dale **⋯ → Edit** a cada una

   | Variable | Nuevo valor |
   |---|---|
   | `ALMACEN_URL` | `https://xivgvnaeigqmdocvqlvo.supabase.co` |
   | `ALMACEN_CLAVE` | la llave que copiaste en el paso 1 |

   > La dirección va **exacta**, sin nada después de `.co`.

4. Guarda

   > **Antes de reemplazar `ALMACEN_URL`, anota su valor viejo** (no es
   > secreto) y pásamelo. Así sabremos de dónde salió lo que no contestaba.

## Paso 3 · Redesplegar (1 min)

1. **Deployments** → el de hasta arriba → **⋯** → **Redeploy**
2. Espera a que diga **Ready**

Sin redesplegar, la página no ve las llaves nuevas.

---

## Paso 4 · Avísame

Yo compruebo desde aquí, sin que tengas que hacer nada:

- que el recordatorio automático —corre cada 15 min— lea el almacén **sin
  tiempo agotado**
- que las tablas empiecen a llenarse cuando alguien escriba al bot
- y el primer ticket que contestes: tu precio y el del motor, **lado a lado**

## Si algo sale mal

| Lo que ves | Qué es |
|---|---|
| No encuentras eurotravel-almacen | Revisa que estés en la organización **tachoj37-tech's Org** |
| No aparecen las variables en Vercel | Revisa que estés en **eurotravel-web** y no en eurosystem |
| Algo da error | Mándame **el mensaje de error**, nunca la llave |
