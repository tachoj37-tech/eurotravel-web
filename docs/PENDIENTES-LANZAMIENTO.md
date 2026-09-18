# Pendientes hasta el lanzamiento

**17-sep-2026.** Todo lo que falta, en el orden en que se le pega. Cada punto dice
quién lo hace y cómo se sabe que quedó. Sustituye a `LANZAMIENTO-PASO-A-PASO.md`
en lo que se contradiga.

> **REGLA DEL DUEÑO (17-sep):** la página **no se lanza** hasta que el botón de
> WhatsApp llegue al bot y el bot pueda mandar contratos, PDF y avisos de pago.
> Recordárselo en cada corte.

**Leyenda:** 👤 lo hace el dueño · 🤖 lo hace Claude · 🔒 bloquea el lanzamiento

---

## Bloque 1 · WhatsApp y el bot 🔒

El corazón del lanzamiento. Hoy el botón de la página manda a un número que **no
está conectado a Kommo**, así que el cliente no llega ni al bot ni al embudo.

| # | Qué | Quién |
|---|---|---|
| 1.1 | **Decidir el número público.** Hoy la página usa 33 2183 2993; el canal real de Kommo es 33 1616 8587; el de pruebas, 344 102 9307 | 👤 |
| 1.2 | Apuntar el botón de WhatsApp de la página a ese número. Vive en `config.js` (`WHATSAPP`) y en 5 ligas de `index.html`, más `WHATSAPP_PUBLICO` en Vercel | 🤖 |
| 1.3 | Activar el Salesbot EuroBot en ese canal para mensajes entrantes. Toca el canal con clientes reales | 👤 |
| 1.4 | Probar desde un celular ajeno: escribir por el botón, que conteste el bot, llegar al ticket | 👤 + 🤖 |
| 1.5 | **Meta**: que el bot pueda mandar contrato y PDF. Número en Meta + plantillas aprobadas (utilidad) para: contrato listo, pago recibido, recordatorio de saldo | 👤 |
| 1.6 | Conectar EuroSystem → WhatsApp: cuando entra un pago, sale el aviso con folio y PDF | 🤖 |
| 1.7 | Cambiar el texto de la página cuando 1.5 y 1.6 existan (hoy ya promete WhatsApp) | 🤖 |

---

## Bloque 2 · Stripe 🔒

La cuenta ya cobra los pagos de la página vieja. **Nada de lo que existe se toca.**

| # | Qué | Quién |
|---|---|---|
| 2.1 | ✅ Llave `sk_live_` nueva creada («Create secret key», nunca «Roll key») | 👤 |
| 2.2 | **Webhook nuevo** junto al viejo: URL `https://eurotravel-web.vercel.app/api/webhook-stripe`, ámbito «Tu cuenta», versión 2019-05-16, y los 5 eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.funds_withdrawn`. Copiar su `whsec_` | 👤 |
| 2.3 | Variables en Vercel (`eurotravel-web`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PORTAL_API_KEY`, `AVISOS_A`, `RESEND_DE` | 👤 |
| 2.4 | Variables en Vercel (`eurosystem`): `PORTAL_API_KEY` (la misma) y `URL_PUBLICA=https://eurosystem.site` | 👤 |
| 2.5 | Redeploy en los dos proyectos y borrar `LLAVE-PORTAL.txt` | 👤 |
| 2.6 | Abrir el cobro real (`PERMITIR_COBRO_REAL` en `api/_stripe.js`) y subirlo | 🤖 |
| 2.7 | Comprobar que un pago de la página vieja que caiga en nuestro webhook se contesta «ajeno» y no mueve nada | 🤖 |

---

## Bloque 3 · Correo

| # | Qué | Quién |
|---|---|---|
| 3.1 | Resend: verificar el dominio `eurotravel.com.mx` (registros DNS en Cloudflare) | 👤 |
| 3.2 | Sin esto, **ningún cliente recibe correo**: hoy solo llega al dueño de la cuenta de Resend | — |
| 3.3 | Probar que el correo con folio y PDF llega a una bandeja de verdad (Gmail, Outlook) y no a spam | 🤖 |

---

## Bloque 4 · Seguridad y legal

| # | Qué | Quién | Estado |
|---|---|---|---|
| 4.1 | Aviso de privacidad y cookies (`politicas.html`), ligado en los dos pies | 🤖 | ✅ hecho |
| 4.2 | Aviso de cookies una vez por dispositivo, sin bloquear | 🤖 | ✅ hecho |
| 4.3 | **Política de cancelación y reembolso**, visible antes de pagar. El dueño dicta los porcentajes (se habló de 20/40/100 según anticipación) | 👤 dicta, 🤖 escribe | 🔒 |
| 4.4 | **Términos del servicio**: qué incluye la renta, responsabilidad, equipaje, retrasos | 👤 dicta, 🤖 escribe | |
| 4.5 | Firma del webhook de Stripe verificada de verdad | 🤖 | ✅ comprobado (400 sin firma) |
| 4.6 | La llave de EuroSystem nunca sale al navegador | 🤖 | ✅ con prueba |
| 4.7 | Frenos de peticiones en consulta de contrato (5 cada 15 min) | 🤖 | ✅ |
| 4.8 | Documentos internos fuera del sitio publicado (`/docs/` → 404) | 🤖 | ✅ |
| 4.9 | Repasar Sentry antes de lanzar: que no haya errores nuevos | 🤖 | |
| 4.10 | Revisar que ningún dato personal viaje en la dirección (URL) | 🤖 | ✅ |

---

## Bloque 5 · Pruebas antes de abrir

| # | Qué | Quién |
|---|---|---|
| 5.1 | Batería completa en verde (hoy: 6387 buenas, 0 malas, 117 archivos) | 🤖 ✅ |
| 5.2 | Recorrido en celular con Playwright: botones, imágenes, animaciones | 🤖 ✅ |
| 5.3 | **Compra real de punta a punta**: el dueño reserva la Sprinter más barata y paga de verdad | 👤 |
| 5.4 | Verificar esa compra: contrato CONFIRMADO en EuroSystem · anticipo como abono sin aprobar · correo con PDF · aviso a los teléfonos · consulta con folio y apellido enseña el saldo | 🤖 |
| 5.5 | Abono de $100 desde la pantalla de abonos, verificado | 👤 + 🤖 |
| 5.6 | Reembolso desde Stripe: EuroSystem lo marca revertido y el saldo vuelve | 👤 + 🤖 |
| 5.7 | Probar con contratos viejos reales: folio + apellido, varios apellidos distintos | 👤 |

---

## Bloque 6 · El dominio

| # | Qué | Quién |
|---|---|---|
| 6.1 | Decidir: `eurotravel.com.mx` completo a la página nueva, o un subdominio mientras | 👤 |
| 6.2 | Cloudflare: apuntar a Vercel. El correo (MX de Google) no se toca | 👤 + 🤖 |
| 6.3 | Ojo: si el dominio se muda, el WordPress viejo deja de verse, con lo que cobre ahí | — |

---

## Bloque 7 · Después de lanzar (no bloquea)

- Marcar «revertido» en el panel de EuroSystem (hoy se ve como pendiente)
- Avisos internos cuando un pago quede «para registrar a mano»
- La página pesa 2.9 MB al abrir: 2 MB son seis JPG de fondo que bajan completos desde el primer segundo
- El cotizador se vacía si el cliente vuelve desde Stripe con «Atrás»
- EuroSystem: `probar:reporte-mitades` y `probar:una-sola-cuenta` en rojo desde `7ee2613`
- El asistente de EuroSystem suma abonos sin aprobar como pagados
- El alta rápida de cliente parte «Juan Pablo» en nombre y apellido
- «Tu fecha sigue libre» con el calendario real (`DISPONIBILIDAD_API_KEY`)
- Etiquetas de formulario sin asociar para lectores de pantalla

---

## Orden sugerido

1. **1.1** (el número) — desbloquea todo el bloque 1
2. **2.2 → 2.5** (webhook y variables) — 20 min del dueño
3. **3.1** (Resend) — corre solo mientras esperan los DNS
4. **1.3 → 1.5** (bot y Meta) — lo más largo, Meta tarda de 1 a 24 h
5. **4.3** (cancelación) — el dueño dicta, se escribe en una tarde
6. **2.6 + 5.3 → 5.6** (cobro real y prueba de fuego)
7. **6.1** (dominio) — el último paso, cuando todo lo demás esté probado
