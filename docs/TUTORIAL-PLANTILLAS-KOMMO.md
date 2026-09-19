# Tutorial: dar de alta las plantillas en Kommo, desde tu computadora

**18-sep-2026.** Paso a paso, en el navegador. Al final tienes cuatro plantillas
aprobadas por Meta y listas para que el sistema las mande solo.

Calcula **40 minutos** de trabajo tuyo. La aprobación de Meta tarda de un minuto
a 48 horas, y corre sola mientras haces otra cosa.

---

## Antes de empezar: qué es mejor, y por qué

Cuando marcas una variable, Kommo te deja llenarla de dos formas. **La correcta
para nosotros es ligarla a un campo de Kommo**, y hay una razón técnica que no
se puede esquivar:

> Para mandar un mensaje, nuestro código lanza un Salesbot. Y al lanzarlo solo
> se le puede decir **qué bot** y **a qué contacto** — no se le pueden pasar los
> datos del viaje. Así que el folio, los montos y la liga del contrato **tienen
> que estar ya guardados en la ficha del contacto** antes de lanzarlo.

O sea: primero se crean los campos, luego las plantillas apuntan a esos campos,
y nuestro código llena los campos justo antes de mandar. Por eso el Paso 1 es
crear los campos y no las plantillas.

---

## Paso 1 · Crear los campos en el contacto (15 min)

**Kommo → Ajustes (el engrane) → Campos personalizados → Contactos → Agregar campo**

Crea estos nueve. **Todos de tipo Texto**, ninguno numérico ni de fecha:

| Nombre del campo | Qué va a guardar | Ejemplo |
|---|---|---|
| `ET folio` | el número de contrato | 43773 |
| `ET destino` | a dónde va | Puerto Vallarta, Jalisco |
| `ET salida` | cuándo sale | 15 de noviembre de 2026, 08:00 |
| `ET total` | total del viaje | $12,300 |
| `ET pagado` | lo que acaba de pagar | $3,000 |
| `ET abonado` | lo que lleva abonado en total | $4,500 |
| `ET saldo` | lo que le falta | $9,300 |
| `ET contrato liga` | la liga a su contrato | https://eurosystem.site/… |
| `ET fecha pago` | cuándo pagó | 18 de septiembre de 2026 |

**Por qué todos de Texto y no numéricos:** los montos ya van formateados desde
nuestro lado (`$12,300`). Un campo numérico se los reformatea a su manera y el
mensaje saldría con otro formato, o con un error. Con texto, lo que escribimos
es exactamente lo que el cliente lee.

**El nombre del cliente no lleva campo nuevo:** se usa el **Nombre** que el
contacto ya tiene en Kommo.

---

## Paso 2 · Crear la primera plantilla (10 min)

**Kommo → Automatizaciones → Plantillas → Plantillas de chat → Crear plantilla**

1. **Canal:** WhatsApp Business (el de tu número).
2. **Nombre de la plantilla:** `contrato_listo`
3. **Categoría:** Utilidad. Si no te la pide aquí, Meta la clasifica sola;
   con estos textos cae en Utilidad.
4. **Idioma:** Español (México).
5. **Mensaje:** pega el texto de `PLANTILLAS-AL-CLIENTE.md`, con los datos de
   ejemplo puestos.

### Marcar las variables

Una por una: **selecciona el dato con el mouse** y pícale al botón de
**marcador de posición** (suele ser un icono de `{ }` o decir «Agregar
variable»).

Kommo te va a preguntar de dónde sale. Elige así:

| Lo que seleccionaste | De dónde sale |
|---|---|
| `Ana` | Contacto → **Nombre** |
| `43773` | Contacto → **ET folio** |
| `Puerto Vallarta, Jalisco` | Contacto → **ET destino** |
| `15 de noviembre de 2026, 08:00` | Contacto → **ET salida** |
| `$12,300` | Contacto → **ET total** |
| `$3,000` | Contacto → **ET pagado** |
| `$9,300` | Contacto → **ET saldo** |
| la liga completa | Contacto → **ET contrato liga** |

Si además te pide un **ejemplo** de cada variable, escribe el mismo valor que
acabas de reemplazar. Eso es lo que ve el revisor de Meta.

Si te deja poner **valor por defecto**, ponlo: para el nombre, `Hola`; para los
montos, `—`. Así, si algún dato faltara, el mensaje sale igual en vez de
rebotar.

6. **Guardar** y mandar a revisión.

---

## Paso 3 · Las otras tres (15 min)

Igual que la primera. Cambian el nombre, el texto y qué campos usan:

**`pago_recibido`** → Nombre · ET folio · ET pagado · ET fecha pago ·
ET abonado · ET total · ET saldo

**`pago_revertido`** → Nombre · ET pagado · ET folio · ET saldo

**`saldo_pendiente`** → Nombre · ET folio · ET salida · ET saldo

---

## Paso 4 · Esperar y revisar

En **Plantillas de chat** cada una muestra su estado:

- **En revisión** — Meta la está viendo. No se puede editar.
- **Aprobada** — lista para usarse.
- **Rechazada** — dice el motivo. Se corrige y se reenvía, sin castigo.

Los dos motivos más comunes:
1. **Falta el ejemplo de alguna variable.** Es el más frecuente.
2. **Quedó como Marketing.** Debe ser Utilidad.

---

## Paso 5 · Pasarme los datos

Cuando estén aprobadas, mándame:

1. Los **nombres exactos** de las cuatro plantillas (si les pusiste otros).
2. Los **nombres exactos** de los nueve campos (si les pusiste otros).
3. Confirmación de si el nombre del cliente salió del campo **Nombre** del
   contacto o de otro lado.

Y el **token de Kommo renovado**, directo en Vercel. Nunca en el chat.

---

## Lo que sigue, que ya es mío

Con eso yo armo los Salesbot que mandan cada plantilla y conecto el webhook:
cuando entra un pago, el código escribe los nueve campos en la ficha del
contacto y lanza el bot que corresponde. El cliente recibe su WhatsApp desde el
número de siempre.

---

## Recordatorios

- **El token de Kommo vence el 20 de septiembre.** Sin él no hay avisos.
- **No se prueba en el número real.** Las pruebas van por el canal
  «Eurotravel PRUEBAS» y solo al final se mueve al de ventas.
- El correo al cliente **sigue funcionando igual** todo este tiempo. El
  WhatsApp se suma, no sustituye.
