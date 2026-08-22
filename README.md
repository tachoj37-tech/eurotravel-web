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
