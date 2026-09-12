# Meter el bot a Kommo

Reescrito el 11-sep-2026, cuando el dueño dijo dos cosas que cambian todo:

> «Ya hay un número registrado en Kommo» — y es **otro**, no el del bot.
> «Que empiece desde que lo vamos probando. Lo vamos a probar hoy un rato
> y ya después lo subimos.»

---

## ANTES DE NADA: el plan tiene que ser Advanced

Verificado en la documentación de Kommo el 11-sep-2026, y es lo primero
que hay que mirar porque **si el plan es Base, nada de este documento
funciona**:

| Lo que el bot necesita | Desde qué plan |
|---|---|
| **Salesbot** (el que contesta) | Advanced |
| **Widget propio** (por donde el bot habla con nuestro servidor) | Advanced |
| **Webhooks** (avisos de Kommo hacia nosotros) | Advanced, Pro, Enterprise |
| API v4 y exportar a CSV | todos |

> «You need at least **Advanced** plan to use WebSDK and upload custom
> widgets to your Kommo account»
> — developers.kommo.com/docs/private-chatbot-integration

Precios de septiembre de 2026: Base $25, Advanced $35, Pro $45 por
usuario al mes. Subieron el 1-sep-2026 (antes eran $15 y $25).

**Paso cero: entra a tu cuenta y mira qué plan tienes.** Si es Base, la
decisión —subir a Advanced o no— es de negocio, no técnica, y hay que
tomarla antes de seguir.

---

## Dos cosas más que salieron de leer la documentación

**1 · El bot necesita un WIDGET, no sólo un paso de «petición HTTP».**

El Salesbot no trae un paso genérico para llamar a un servidor. Lo que hay
es `widget_request`, y sólo funciona desde un **widget propio** subido a la
cuenta. O sea que la integración privada del paso 1 no es opcional: es la
pieza por donde el bot habla.

**2 · Hay dos segundos para contestar, y sí alcanzan.**

Kommo exige un `200` en **2 segundos**. La IA tarda más que eso, así que a
primera vista parecía un problema serio. No lo es: el webhook trae un
`return_url`. Se contesta el `200` de inmediato, se piensa la respuesta con
calma, y después se llama al `return_url` para seguir la conversación.

Es exactamente lo que el bot ya hace hoy con WhatsApp —contestarle rápido a
Meta y mandar el mensaje aparte—, así que el código para esto ya existe y
está probado.

---

## La buena noticia: hoy no hay mudanza

El número que ya está en Kommo es **nuevo**, así que se convierte en el
número de pruebas. Eso quiere decir:

- **Dualhook no se toca.** El bot sigue atendiendo clientes de verdad en el
  número de siempre, sin enterarse de nada.
- **Nadie de verdad ve las pruebas.** Si el bot contesta una tontería en
  Kommo, se la contesta a ti.
- **No hay vuelta atrás que planear**, porque no se rompe nada.

El día del cambio de verdad —mover el número bueno— viene después, y va
al final de este documento.

---

## Cómo va a funcionar

```
  Cliente por WhatsApp
          │
          ▼
      K O M M O          ← el número vive aquí, y aquí ves la conversación
          │
          │  Salesbot: «llegó un mensaje» → pregunta a nuestro servidor
          ▼
   /api/whatsapp/<ruta secreta>      ← el bot de siempre, en Vercel
          │
          │  contesta el texto
          ▼
      K O M M O          ← Kommo se lo manda al cliente y queda en el chat
```

Lo importante de este dibujo: **Kommo manda y recibe los mensajes**, y
nuestro servidor solo piensa. Por eso no hace falta pelearse con la API de
chats de Kommo, que firma cada petición — el Salesbot hace ese trabajo.

Y de regalo, resuelve lo que no se podía en WhatsApp: como todos los
mensajes pasan por Kommo, **el precio que escribe el vendedor en la
conversación también se puede leer y aprender**. Eso era imposible con
Dualhook.

---

## Lo que haces tú

### 1 · Saca el token

**Ajustes → Integraciones → Crear integración → privada.**

Marca los permisos de **leads, contactos y chats**.

⚠️ El token **se enseña una sola vez**. Cópialo en ese momento.

> Si los nombres de los menús no coinciden con esto, mándame una captura y
> te digo dónde. Kommo cambia la interfaz seguido y prefiero que me la
> enseñes a que andes adivinando.

### 2 · Guárdalo donde va

En Vercel, proyecto `eurotravel-web` → Settings → Environment Variables:

```
KOMMO_SUBDOMINIO   el "loquesea" de loquesea.kommo.com
KOMMO_TOKEN        el del paso 1
```

**Y dale Redeploy.** Una variable nueva no se aplica sola.

**El token no me lo pegues en el chat.** Escríbelo directo en Vercel.

### 3 · Arma el embudo con estos nombres exactos

```
nuevo
con_precio
va_a_apartar
mando_comprobante
datos_del_contrato
contrato_listo
```

Tal cual, con guion bajo y sin acentos. Son los que el bot ya usa por
dentro desde hace semanas. Si les cambias el nombre hay que cambiarlo
también en el código, y es de las cosas que se olvidan.

### 4 · Dime que ya

Con el subdominio y el token puestos, yo escribo la parte del servidor:
la puerta que entiende lo que manda Kommo y le contesta lo que el bot
diga. Te aviso cuando esté arriba.

### 5 · Crea el Salesbot

Éste es el que conecta las dos cosas, y lo armamos juntos porque necesito
ver qué pasos te ofrece tu cuenta.

La forma que va a tener:

1. **Arranque:** cuando llega un mensaje nuevo al chat.
2. **Paso de petición HTTP:** a la dirección que yo te dé, mandando el
   texto del cliente y su número.
3. **Paso de mensaje:** contesta con lo que el servidor devolvió.

Cuando llegues aquí, **mándame una captura de la lista de pasos** que te
ofrece el Salesbot. Con eso te digo exactamente cuáles poner y en qué
orden — las opciones cambian según el plan.

### 6 · Pruébalo

Escríbele al número de Kommo desde tu celular, como si fueras un cliente:

```
hola, quiero cotizar un viaje a vallarta
somos 45
20 de noviembre
22 de noviembre
el marcopolo
guadalajara
solo nos llevan y traen
sí
```

Lo que tiene que pasar, en orden:

- El bot te va preguntando lo que falta, una cosa a la vez.
- Al final te deja el resumen del viaje completo en un solo mensaje.
- **Y ahí se calla.** El bot llega hasta la cotización y no más.
- En Kommo te queda el lead en la etapa `con_precio`, esperando precio.

Si algo de eso no pasa, mándame la captura de la conversación.

---

## Los precios: de Kommo al cerebro

Esto es lo que faltaba en toda la cadena, y Kommo lo resuelve mejor que
cualquier otra cosa que se haya considerado.

### El problema, dicho claro

Hoy los precios que el dueño confirma **no se guardan en ningún lado**:

- La tabla `precios` de Supabase **no existe** (comprobado el 11-sep-2026:
  el único proyecto de la cuenta es el de EuroSystem, y no tiene ninguna
  de las siete tablas del bot).
- `guardaPrecio` termina en `.catch()` y quien lo llama pone otro, así que
  un fallo no lo ve nadie.
- Y aunque se guardaran, **no había puente** entre lo guardado y
  `api/_destinos.js`, que es de donde el cotizador saca los precios.

### Por qué Kommo es el mejor lugar

Porque el precio ya va a vivir ahí sin que nadie haga nada extra. Kommo es
un CRM: cada lead conserva su chat, sus notas y sus campos. Cuando el
vendedor escribe el precio, **Kommo ya lo guardó**.

Y leerlo después es más seguro que escucharlo en vivo: si un vendedor
contesta a mano sin pasar por el bot, el bot no se entera —pero Kommo sí lo
tiene. Leyendo la cuenta no se pierde ninguno.

### Cómo queda la cadena

```
  el vendedor pone el precio en Kommo
        ↓  (ya quedó guardado: no hay que hacer nada)
  npm run precios:cerebro      ← leyendo Kommo, no Supabase
        ↓
  cerebro/precios-que-he-dado.md      el resumen
  docs/PRECIOS-QUE-HE-DADO.md         el histórico
  precios-aprendidos.json             el que puede leer el cotizador
        ↓
  el dueño revisa el diff y lo sube
        ↓
  el cotizador ya tiene ese precio
```

El script ya existe (`scripts/precios-al-cerebro.mjs`); lo único que cambia
es de dónde lee.

### La red de seguridad, que no cuesta nada

Kommo **exporta a CSV o Excel con todos los campos personalizados**, y
admite filtros. Así que si el script falla, si se cae la API o si un mes se
olvida correrlo, los precios **no se pierden**: se bajan en un archivo y se
vuelcan igual.

Ésa es la ventaja grande frente a montar una base propia: el respaldo ya
viene incluido y lo puede sacar el dueño solo, sin programar.

### Por qué NO se hace automático (todavía)

Se podría: con un webhook de «cambió la etapa del lead» pegándole a Vercel,
y Vercel escribiendo en el repositorio por la API de GitHub. Funcionaría.

Pero eso significa darle a un servidor permiso de escritura sobre el
repositorio, y que un precio entre al catálogo sin que nadie lo vea. Para
dinero, la regla de la casa es al revés: **se revisa antes de cobrarse.**
Correr un comando cada quincena y mirar el diff cuesta dos minutos y evita
que un precio mal capturado se cobre solo.

Si con el tiempo correr el comando estorba, se automatiza — pero se empieza
por lo revisable.

---

## Los atajos, una vez que esté

Los mismos que ya funcionan por WhatsApp. Escribe **`atajos`** y el bot te
enseña la lista completa:

| Escribes | Hace |
|---|---|
| `cuenta` | le manda la ficha, la CLABE y el número |
| `contrato` | le pide sus datos para el contrato |
| `recibido` | le confirma que su pago entró |
| `fotos` | le manda fotos de su unidad |
| `fotos i6s` | o de la que le digas |
| un número | ése es el precio, y se lo manda cotizado |
| `total 52,000` | corrige el total sin volver a cotizar |
| `yo` / `bot` | tomas el chat, o se lo regresas |
| `pendientes` | en qué va cada cliente |
| `atajos` | la lista |

En Kommo estos pueden dejar de ser palabras tecleadas y volverse **botones
de verdad**. Eso se hace después de que lo básico funcione: primero que
conteste, luego que se vea bonito.

---

## Lo que Kommo arregla solo

Dos cosas que hoy no tienen dónde vivir:

- **El renglón del Excel** (`💵 Del Excel: $13,000, columna «NEOBUS/i6
  50/51 PAX»`) y **el aviso de recargo** (`⚠️ Ese calculado NO trae el
  recargo de Ocotlán`). Hoy van en un mensaje aparte a tu número personal,
  porque en WhatsApp no existen las notas privadas dentro de un chat. En
  Kommo se vuelven **notas internas del lead**: las ves al abrir la
  conversación y el cliente nunca las ve.

- **Capturar el precio que escribe el vendedor.** Con Dualhook el bot no
  puede ver lo que tú tecleas desde el teléfono. En Kommo sí, y de ahí se
  aprende solo.

---

## El día de mover el número bueno

Cuando las pruebas estén y quieras pasar el número real:

1. **En domingo temprano**, y avisa a los vendedores que esa hora
   contesten desde el teléfono.
2. Conecta el número bueno en Kommo.
3. Manda un mensaje de prueba desde tu número personal. Tiene que llegarte
   al servidor: en Vercel → Logs aparece la línea del webhook.
4. Contesta desde el bot y comprueba que le llega al cliente.
5. **Solo cuando los dos sentidos funcionen**, cancela Dualhook. Ni un
   minuto antes: mientras siga contratado, la vuelta atrás son cinco
   minutos.

### Cómo volver atrás, mientras Dualhook siga vivo

1. En Meta, regresa el Webhook Override a la URL de Dualhook.
2. En Vercel, `WHATSAPP_API_BASE=https://api.dualhook.com/v25.0` y el
   token `dh_live_…` de vuelta.
3. Redeploy.

---

## Un detalle técnico, para que no te agarre de sorpresa

El plan Hobby de Vercel publica **doce funciones** y hoy hay doce exactas.
Crear un archivo nuevo en `api/` sería la trece y **el despliegue entero
dejaría de subir** — no falla la función nueva, Vercel rechaza el proyecto
completo. Hay una prueba que lo caza antes (`pruebas/probar-despliegue.cjs`).

Así que la puerta de Kommo va a colgar de la función que ya existe, con un
rewrite en `vercel.json`. Es el mismo truco con el que se resolvió Dualhook.
No es algo que tengas que hacer tú; va aquí para que si un día ves un
despliegue rechazado, sepas por dónde empezar a buscar.
