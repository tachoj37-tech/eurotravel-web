# Pasar el bot a Kommo

Escrito el 10-sep-2026, a petición del dueño: «me entregues los pasos para
subirlo a Kommo».

Esto es la **guía de la mudanza**, no el manual de Kommo. Lo que trae de más
—y lo que no vas a encontrar en la documentación de ellos— son las tres cosas
de *este* montaje que pueden tumbar el bot si se hacen en mal orden.

---

## Antes de nada: las tres trampas

### 1 · Vercel publica DOCE funciones y ya hay doce

El plan Hobby tiene ese tope, y hoy está justo en el límite:

```
cerrar-sesion · confirmar · cotizar · cuenta · entender · pagar
pedir-codigo · places · verificar-codigo · viaje · webhook-stripe · whatsapp
```

Crear `api/kommo.js` sería la trece y **el despliegue entero deja de subir** —
no es que falle la función nueva, es que Vercel rechaza el proyecto completo.
Hay una prueba que lo caza antes de subir (`pruebas/probar-despliegue.cjs`).

Esto ya se resolvió una vez, con Dualhook: la puerta secreta no es una función
aparte, es un *rewrite* en `vercel.json` hacia la que ya existe. Lo mismo se
hará con Kommo. **No crees un archivo nuevo en `api/`.**

### 2 · Mover el número a Kommo apaga Dualhook

Dualhook (12 €/mes) es la puerta por la que el bot vive hoy: Meta le manda los
avisos directo al servidor y el bot contesta por `api.dualhook.com`. Kommo
quiere ser esa misma puerta.

**No pueden ser las dos al mismo tiempo.** El día del cambio, el bot deja de
recibir por un lado y empieza por el otro, y entre uno y otro hay un hueco. Si
ese hueco cae en martes a mediodía, son clientes escribiendo a nadie.

Por eso el paso 6 de abajo va en domingo temprano y con el número personal a la
mano.

### 3 · La ventana de 24 horas sigue existiendo

Kommo no la quita: es de Meta. Todo lo que ya sabes se mantiene — texto libre
solo dentro de las 24 h del último mensaje del cliente, y lo mismo para los
avisos que te llegan a ti.

---

## Lo que hace falta de tu lado

Dos datos, y sin ellos no se puede escribir ni una línea de código:

| Qué | Dónde sale |
|---|---|
| **Subdominio** | El `loquesea` de `loquesea.kommo.com`, el que ves en la barra |
| **Token de integración privada** | Kommo → Ajustes → Integraciones → crear una privada |

Cuando los tengas, van a `.env.local` (que no sube al repositorio) y a Vercel:

```
KOMMO_SUBDOMINIO=loquesea
KOMMO_TOKEN=...
```

> **El token no se pega en el chat.** Igual que la llave de Anthropic: se
> escribe directo en `.env.local` y en Vercel, y de ahí nadie lo saca.

---

## Los pasos, en orden

### Paso 1 · Dar de alta la cuenta

Kommo, plan que incluya el canal de WhatsApp. Crea los usuarios de los
vendedores desde el principio: cada uno con el suyo, no uno compartido — el
embudo pierde todo el sentido si no se sabe quién movió qué.

### Paso 2 · Armar el embudo

Las etapas que el bot ya maneja, para que Kommo y el bot hablen de lo mismo.
Están en `api/_etapas.js`:

```
nuevo → con_precio → va_a_apartar → mando_comprobante
      → datos_del_contrato → contrato_listo
```

Ponlas con esos nombres. Si les cambias el nombre en Kommo, hay que cambiarlo
también en el código, y es de las cosas que se olvidan.

### Paso 3 · Sacar el token

Ajustes → Integraciones → Crear integración privada. Marca los permisos de
leads, contactos y chats. Guarda el token: **se enseña una sola vez**, igual
que la llave de Dualhook.

### Paso 4 · Meter las variables en Vercel

`KOMMO_SUBDOMINIO` y `KOMMO_TOKEN`, en el proyecto `eurotravel-web`.

**Y acuérdate del Redeploy.** Cambiar una variable en Vercel no la aplica sola;
ya se te olvidó varias veces con las de WhatsApp.

### Paso 5 · Conectar el código (esto lo hago yo)

Con las variables puestas:

- `api/_kommo.js` — el cliente, apagado si faltan las variables, igual que
  `_almacen.js`. Si Kommo se cae, el bot sigue contestando.
- El *rewrite* en `vercel.json` para la entrada de Kommo, sin función nueva.
- Los botones del vendedor: cuenta, contrato, recibido y las fotos de la
  unidad, con su copy-paste.
- `pruebas/probar-kommo.mjs`, con una puerta de mentiras — como se prueban
  Meta y EuroSystem hoy.

### Paso 6 · El cambio de número — el día delicado

**En domingo temprano**, con el celular a la mano:

1. Avisa a los vendedores que durante una hora contesten desde el WhatsApp
   Business del teléfono.
2. En Kommo, conecta el número. Kommo pide el Webhook Override en Meta, que es
   exactamente lo que hoy apunta a Dualhook.
3. Manda un mensaje de prueba desde tu número personal y comprueba que llega
   al servidor: en Vercel → Logs tiene que aparecer la línea del webhook.
4. Contesta desde el bot y comprueba que le llega al cliente.
5. **Solo cuando los dos sentidos funcionen**, cancela Dualhook. Ni un minuto
   antes: mientras no lo canceles, la vuelta atrás es de dos clics.

### Paso 7 · La primera semana

Deja `DUENO_WHATSAPP` puesta. Los cinco avisos te siguen llegando a tu número
personal aunque el bot ya viva en Kommo, y ésa es tu red mientras compruebas
que el embudo se mueve solo.

Cuando lleves una semana viendo todo en Kommo, se apagan.

---

## Cómo volver atrás

Mientras Dualhook siga contratado:

1. En Meta, regresa el Webhook Override a la URL de Dualhook.
2. En Vercel, `WHATSAPP_API_BASE=https://api.dualhook.com/v25.0` y el token
   `dh_live_…` de vuelta.
3. Redeploy.

Son cinco minutos. Por eso Dualhook no se cancela el mismo día.

---

## Lo que NO cambia

- **El bot sigue llegando solo hasta la cotización.** Kommo no lo hace hablar
  de más; el precio lo sigues poniendo tú.
- **El criterio de precios.** Vive en `docs/CRITERIO-DE-PRECIOS.md` y en
  `cerebro/`, y no sabe nada de CRMs.
- **Los contratos** siguen yendo a EuroSystem por `POST /api/contratos/externo`.
- **Los precios aprendidos** siguen guardándose en Supabase y volcándose al
  cerebro con `npm run precios:cerebro`.

---

## Lo que hay que comprobar contra Kommo antes de escribir el código

Escrito aquí para no olvidarlo, y porque **no está verificado**: la parte de
mandar mensajes desde el bot pasa por la API de chats de Kommo
(`amojo.kommo.com`), que pide una identidad de bot aparte y firma cada
petición. Es la pieza que no se puede escribir a ciegas.

Los pasos 1 a 4 no dependen de eso: se pueden hacer hoy.
