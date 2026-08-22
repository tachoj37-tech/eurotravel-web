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
conoce la clave. Lo mismo hará `/api/cotizar` en la Fase 2 con el cálculo de
kilómetros.

### Variables de entorno

Se configuran en Vercel → Settings → Environment Variables. Ver `.env.example`.

| Variable | Para qué | Restricción en Google Cloud |
|---|---|---|
| `GOOGLE_PLACES_KEY` | Autocompletado de direcciones | Places API (New), sin restricción de sitio |
| `GOOGLE_ROUTES_KEY` | Cálculo de kilómetros (Fase 2) | Routes API, sin restricción de sitio |

Ambas se restringen **por API**, no por sitio web: las llama el servidor, que no
envía cabecera `Referer`.

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
