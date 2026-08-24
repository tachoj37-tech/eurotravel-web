# Eurotravel — sitio web

Sitio de una sola página con pestañas para **Eurotravel**, renta de autobuses, Sprinters y
Suburbans en Tlaquepaque, Jalisco.

## Contenido

- `index.html` — todo el sitio (HTML, CSS y JS en un solo archivo, sin dependencias ni build)
- `img/` — logo, ícono, fotos de la flota y mapas de asientos

## Secciones

Inicio · Unidades · Cotizaciones · Sobre nosotros · Contacto (navegación por pestañas, cada una
con su propia dirección: `#/unidades`, `#/cotizar`, etc.)

## Funciones

- Animación de entrada con el autobús (una vez por sesión, con botón para saltar)
- Buscador de cotizaciones tipo aerolínea: tipo de unidad, viaje redondo o solo ida, fechas y
  pasajeros; recomienda unidad según el tamaño del grupo
- Selector de ubicación con catálogo de destinos, dirección exacta, GPS del dispositivo y
  lectura de coordenadas desde un link de Google Maps
- Solicitud en 3 pasos que genera un resumen listo para enviar por WhatsApp o correo
- Fichas de unidades con fotos reales, equipamiento y mapas de asientos

## Publicación

Cada push a `main` publica automáticamente en Vercel.

## Pendientes

- Confirmar capacidades exactas de Irizar i6 y PB (hoy dicen "47 a 51")
- Revisar las preguntas frecuentes sobre anticipos, tiempos de reserva y facturación
- Para autocompletado real de direcciones haría falta una API key de Google Maps Platform

## Seguridad de las claves

**Ninguna clave vive en este repositorio ni llega al navegador.**

El autocompletado de direcciones no llama a Google desde el cliente: pide a
`/api/places`, una función serverless que corre en Vercel y es la única que
conoce la clave. `/api/cotizar` hace lo mismo con el cálculo de kilómetros.

### Variables de entorno

Se configuran en Vercel → Settings → Environment Variables. Ver `.env.example`.

| Variable | Para qué | Restricción en Google Cloud |
|---|---|---|
| `GOOGLE_PLACES_KEY` | Autocompletado de direcciones | Places API (New), sin restricción de sitio |
| `GOOGLE_ROUTES_KEY` | Cálculo de kilómetros | Routes API, sin restricción de sitio |
| `STRIPE_SECRET_KEY` | Cobro del anticipo | — |
| `STRIPE_WEBHOOK_SECRET` | Firma de los avisos de Stripe | — |
| `CONTRATOS_API_KEY` | Registrar el contrato en EuroSystem | — |
| `EUROSYSTEM_URL` | A dónde se manda el contrato. Opcional | — |

**Vercel solo aplica las variables a los despliegues nuevos.** Después de
agregar o cambiar una hay que volver a desplegar, o el sitio sigue corriendo
con las de antes.

Las de Google se restringen **por API**, no por sitio web: las llama el
servidor, que no envía cabecera `Referer`.

`CONTRATOS_API_KEY` es de servidor a servidor y la genera quien administra
EuroSystem. Nunca va en código que llegue al navegador: quien la vea puede
registrar contratos a nombre de la empresa.

### Dar de alta el webhook de Stripe

El webhook es lo que hace que un pago se entere **aunque el cliente cierre la
pestaña** — y es indispensable con OXXO, donde el cliente paga días después en
la tienda.

1. En Stripe → Developers → Webhooks → **Add endpoint**
   (prueba: `dashboard.stripe.com/test/webhooks`).
2. URL: `https://eurotravel-web.vercel.app/api/webhook-stripe`
3. Eventos:
   - `checkout.session.completed` — tarjeta, paga al momento
   - `checkout.session.async_payment_succeeded` — OXXO, paga después
4. Stripe da un **signing secret** (`whsec_…`). Va en Vercel como
   `STRIPE_WEBHOOK_SECRET`.
5. **Volver a desplegar.** Vercel solo aplica las variables a los despliegues
   nuevos: sin este paso el sitio sigue corriendo sin el secreto y parece que
   la variable no sirvió.
6. En Stripe, **Send test webhook** con `checkout.session.completed`. Tiene que
   contestar `200`.

Sin ese secreto el endpoint **rechaza todo**, y hace bien: la firma es lo único
que distingue a Stripe de cualquiera que quiera inventar un «ya pagó».

**Este orden y no otro.** Antes decía aquí «primero la variable en Vercel, luego
el alta en Stripe», y eso no se puede hacer: el `whsec_` lo genera Stripe **al
crear el endpoint**, así que antes no existe. Y no pasa nada por hacerlo en este
orden: mientras falte el secreto, el endpoint contesta 500, y un 500 es
justamente lo que Stripe reintenta —hasta tres días—. El pago no se pierde.

Lo que sí conviene tener listo **antes** es `CONTRATOS_API_KEY`, en los dos
proyectos y con el mismo valor: en `eurosystem`, para que su puerta abra, y en
`eurotravel-web`, para poder tocarla. Si falta de un lado, EuroSystem contesta
`503` y el contrato no se registra.

### Defensas del proxy

- Solo responde a peticiones desde el dominio del sitio
- Solo acepta dos acciones (`autocomplete` y `detalle`)
- Límite de 60 llamadas por minuto por visitante
- Tope de 2,000 llamadas al día
- Devuelve solo los campos que la página necesita

### Si el endpoint no responde

El campo de dirección funciona como un input normal y se escribe a mano. El
sitio no se rompe si Google falla o si se agota la cuota.

### Reglas

- No poner claves en `config.js`, `index.html` ni en ningún archivo del repo
- `.gitignore` ya bloquea `.env`, `*.key` y `*.pem`
- Si una clave llega a publicarse, rotarla en Google Cloud (botón **Rotar clave**)

### Comprobar que las claves funcionan

```
POST /api/diagnostico
```

Devuelve si cada variable está configurada y si Google acepta la clave, sin
revelar su valor. Solo responde desde el dominio del sitio.

Respuesta sana:

```json
{
  "GOOGLE_PLACES_KEY": { "configurada": true, "largo": 39, "prueba": { "ok": true, "sugerencias": 5 } },
  "GOOGLE_ROUTES_KEY": { "configurada": true, "largo": 39, "prueba": { "ok": true, "km": 311 } }
}
```

Si `configurada` es `false`, falta registrar la variable en Vercel **y volver a
desplegar**: las variables no se aplican a despliegues ya existentes.
