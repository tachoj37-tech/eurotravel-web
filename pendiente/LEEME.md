# Lo que está listo pero todavía no se publica

Esta carpeta **no se despliega**. Vercel solo publica como función lo que vive
en `api/`, así que aquí un archivo puede estar terminado y probado sin salir al
aire.

---

## `whatsapp.mjs` — el bot de WhatsApp

Está escrito, probado y en verde (`npm run probar` incluye
`pruebas/probar-whatsapp.cjs`, 33 comprobaciones). **No está publicado por una
razón concreta:**

### El plan Hobby de Vercel publica 12 funciones, y ya van 12

Meter este archivo en `api/` deja 13, y entonces **el despliegue falla y se cae
la página**. No es que el bot no sirva: es que no cabe.

Lo cazó `pruebas/probar-despliegue.cjs` antes de subirlo.

### Para activarlo hacen falta DOS cosas

**1 · Un lugar libre.** Cualquiera de estas tres:

| | qué implica |
|---|---|
| Borrar `api/prueba-cotizador.js` y `prueba-cotizador.html` | Es TEMPORAL por diseño —lo dice su propio comentario— y se borra cuando el dueño termine de revisar los costos. Es lo más limpio si ya no lo usa |
| Juntar `cerrar-sesion.js` dentro de `cuenta.js` | `cuenta.js` ya recibe una `accion`; cerrar sesión sería una más. Es un cambio real y hay que probarlo |
| Pasar a Vercel Pro | Sube el tope y ya no hay que elegir. Estaba pendiente desde antes |

**2 · El trámite con Meta**, que no lo puede hacer el código:

- Cuenta de WhatsApp Business API y verificación del negocio
- Un número **dedicado**: el que entra a la API sale de la app normal de
  WhatsApp y ya no se puede contestar a mano desde el teléfono
- Estas cuatro variables en Vercel (las pone el dueño, **nunca viajan por
  chat**):

  | variable | para qué |
  |---|---|
  | `WHATSAPP_VERIFY_TOKEN` | lo que Meta pregunta al dar de alta el webhook |
  | `WHATSAPP_APP_SECRET` | con esto se comprueba que el aviso venga de Meta |
  | `WHATSAPP_TOKEN` | permiso para contestar |
  | `WHATSAPP_PHONE_ID` | de qué número sale la respuesta (por omisión usa el que recibió) |

  Sin las dos primeras, el webhook **falla cerrado**: no contesta nada. Es a
  propósito.

### Al moverlo

Cambiar la primera línea de `import '../api/_whatsapp-webhook.js'` a
`'./_whatsapp-webhook.js'`, y dar de alta en Meta la dirección
`https://<el-dominio>/api/whatsapp`.

---

## Mientras tanto, sí se puede ver

`prueba-whatsapp.html` corre **el mismo `bot.js`** que usará el servidor, dentro
del navegador. No gasta ninguna función y no necesita Meta ni despliegue.
