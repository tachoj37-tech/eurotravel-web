# Meta paso a paso: dar de alta las plantillas y que las aprueben

**18-sep-2026.** Todo lo que hay que hacer en Meta, en orden, para que el bot
pueda mandarle al cliente su contrato, su PDF y el aviso de cada pago. Los
textos de las plantillas están en `PLANTILLAS-AL-CLIENTE.md`; aquí está **cómo**
se dan de alta y **por qué las rechazan**.

---

## Paso 0 · La decisión que va antes de todo: ¿desde qué número salen?

Esto hay que resolverlo primero, porque cambia todo lo demás.

El número de ventas (33 1616 8587) está conectado a **Kommo**. Kommo es el
dueño técnico de ese número ante Meta, y por eso **Meta no da un token propio
para él**: los mensajes de ese número salen por Kommo, no por nuestro código.

Dos caminos:

**A · Un número nuevo, solo para avisos automáticos** (recomendado)
- Se crea en Meta Cloud API, aparte de Kommo. Kommo no se toca.
- De ahí salen: contrato con PDF, pago recibido, pago revertido.
- El cliente ve dos números: uno para platicar (ventas) y otro que le manda sus
  comprobantes. Es lo normal: igual que un banco, que te atiende por un lado y
  te manda avisos por otro.
- Necesita un chip o número virtual **sin WhatsApp instalado**.

**B · Todo por el número de Kommo**
- Un solo número para el cliente, que es más limpio.
- Pero los avisos tendrían que salir **por la API de Kommo**, no por la de Meta,
  y hay que confirmar que el plan Pro deja mandar plantillas por API a un
  contacto. Además el cliente que compra en la página sin haber escrito por
  WhatsApp no existe como contacto en Kommo: habría que crearlo.

**Mi recomendación: A.** Es el camino que no toca el canal con clientes reales
y el que no depende de lo que permita Kommo. Si prefieres B, dime y lo reviso
con la API de Kommo antes de escribir nada.

---

## Paso 1 · Que la cuenta esté lista (una sola vez)

En **business.facebook.com** → **Configuración del negocio**:

1. **Verificación del negocio.** Si la cuenta no está verificada, Meta limita a
   250 mensajes al día y puede rechazar plantillas de utilidad. Se sube acta
   constitutiva o constancia de situación fiscal. Tarda de 1 a 5 días.
2. **Método de pago** en la cuenta de WhatsApp Business. Sin él, las plantillas
   se aprueban pero los mensajes no salen.
3. **Nombre para mostrar**: que diga **Eurotravel**. Meta lo revisa y rechaza
   nombres que no coincidan con el negocio.

---

## Paso 2 · Agregar el número (camino A)

**WhatsApp Manager** → tu cuenta de WhatsApp Business → **Números de teléfono**
→ **Agregar número de teléfono**.

- El número **no debe tener WhatsApp instalado**. Si lo tiene, primero se borra
  la cuenta desde la app (Ajustes → Cuenta → Eliminar mi cuenta) y se esperan
  unos minutos.
- Verificación por **SMS** o llamada.
- Al terminar, anota el **Phone number ID** (un número largo, no el teléfono).
  Ese es el que va en Vercel.

---

## Paso 3 · Crear cada plantilla

**WhatsApp Manager** → **Plantillas de mensajes** → **Crear plantilla**.

Para las cuatro:

| Campo | Qué poner |
|---|---|
| **Categoría** | **Utilidad** (Utility) |
| **Nombre** | `contrato_listo`, `pago_recibido`, `pago_revertido`, `saldo_pendiente` |
| **Idioma** | Español (MEX) → `es_MX` |

Copia el cuerpo de `PLANTILLAS-AL-CLIENTE.md` tal cual.

### Lo que casi todos olvidan: los ejemplos

Meta **exige un ejemplo para cada variable**. Si no los pones, la plantilla se
rechaza sin más explicación. En la misma pantalla, abajo, hay un apartado
«Ejemplos» o «Muestras de contenido». Llénalo con los valores de las tablas del
otro documento:

```
{{1}} → Ana
{{2}} → 43773
{{3}} → Puerto Vallarta, Jalisco
...
```

### Para `contrato_listo`, que lleva PDF

- **Encabezado** → tipo **Documento**.
- Meta pide un **archivo de ejemplo**: sube cualquier PDF (un contrato viejo
  sirve, o una hoja en blanco). Solo es para que el revisor vea el formato; no
  es el que se manda después.

---

## Paso 4 · El token que necesita el código

**Configuración del negocio** → **Usuarios** → **Usuarios del sistema** →
**Agregar**.

1. Nombre: `eurotravel-avisos`. Rol: **Administrador**.
2. **Agregar activos** → tu cuenta de WhatsApp Business → permiso **Control
   total**.
3. **Generar token** → selecciona la app → permisos
   `whatsapp_business_messaging` y `whatsapp_business_management` →
   **caducidad: Nunca**.
4. Cópialo. **Se enseña una sola vez.**

⚠️ Ese token puede mandar mensajes a nombre de tu negocio. **Va directo a
Vercel, nunca al chat, nunca en un archivo del proyecto.**

---

## Por qué las rechazan (y cómo evitarlo)

Casi todos los rechazos de una plantilla de **Utilidad** son por lo mismo:

| Motivo | Cómo se evita |
|---|---|
| Faltan los ejemplos de las variables | Llenar «Ejemplos» siempre, con datos que se vean reales |
| Parece publicidad | Nada de «aprovecha», «oferta», «te invitamos». Estas cuatro solo informan de algo que el cliente ya hizo |
| Variable al principio o al final del texto | Siempre que haya texto antes y después: `Folio: {{2}}` está bien, `{{2}}` solo no |
| Dos variables pegadas | `{{1}} {{2}}` mal · `{{1}}, folio {{2}}` bien |
| Categoría equivocada | Si la mandas como Marketing, Meta la recategoriza o la rechaza. Va en **Utilidad** |
| Texto con errores o sin sentido | El revisor es una persona. Que se lea bien en español |
| Enlace acortado (bit.ly y similares) | Usar la dirección completa |

**Cuánto tarda:** normalmente minutos; el límite es 24 h.

**Si la rechazan:** en la misma pantalla sale el motivo. Se corrige y se vuelve
a enviar; no hay castigo por reintentar. Si crees que se equivocaron, hay un
botón de **apelar**.

**Si la aprueban pero luego la degradan:** Meta revisa las plantillas en uso.
Si muchos clientes bloquean o reportan, baja la «calidad» del número y puede
pausarla. Con avisos de compras reales eso no pasa.

---

## Qué me pasas cuando esté listo

1. Los **nombres exactos** de las cuatro plantillas.
2. El **Phone number ID** del número.
3. El **token** del usuario del sistema → en Vercel, con estos nombres:

```
WA_CLIENTE_TOKEN      el token del usuario del sistema
WA_CLIENTE_PHONE_ID   el Phone number ID
WA_PLANTILLA_CONTRATO contrato_listo
WA_PLANTILLA_PAGO     pago_recibido
WA_PLANTILLA_REVERTIDO pago_revertido
WA_PLANTILLA_SALDO    saldo_pendiente
WA_IDIOMA             es_MX
```

Mientras esas variables no estén, el código **no manda nada** y no se queja:
sigue saliendo todo por correo, como hoy.

---

## Orden y tiempos

| Paso | Quién | Cuánto |
|---|---|---|
| 0 · Decidir el número (A o B) | dueño | 5 min |
| 1 · Verificar el negocio y el método de pago | dueño | 1 a 5 días si no está |
| 2 · Agregar el número | dueño | 15 min |
| 3 · Crear las 4 plantillas | dueño | 30 min + hasta 24 h de revisión |
| 4 · Usuario del sistema y token | dueño | 10 min |
| 5 · Variables en Vercel | dueño | 5 min |
| 6 · Conectar y probar con un contrato real | Claude + dueño | 1 h |
