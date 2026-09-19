# Plantillas de WhatsApp para el cliente (Fase 1)

**18-sep-2026.** Lo que hay que dar de alta en Meta para que el cliente reciba por
WhatsApp su contrato, su PDF y el aviso de cada pago. Meta tarda de 1 a 24 h en
aprobar cada una, así que **esto va primero**.

> No confundir con `venta_en_la_pagina` (en `AVISO-INSTANTANEO.md`): esa es el
> aviso **interno**, para los teléfonos de la oficina. Estas tres son **para el
> cliente**.

---

## Dónde se dan de alta

business.facebook.com → **WhatsApp Manager** → la cuenta de WhatsApp Business →
**Plantillas de mensajes** → **Crear plantilla**.

Para las tres: **Categoría `Utilidad`** (no Marketing: Marketing se cobra más caro
y puede rebotar) · **Idioma `Español (MEX)` → `es_MX`**.

---

## 1 · `contrato_listo` — cuando aparta y se genera el contrato

Lleva **documento adjunto**: el PDF del contrato.

- **Encabezado:** tipo `Documento`
- **Cuerpo:**

```
¡Listo {{1}}! Tu viaje ya está apartado 🚐

Folio: {{2}}
Destino: {{3}}
Salida: {{4}}

Total: {{5}}
Anticipo recibido: {{6}}
Queda por abonar: {{7}}

Te dejo tu contrato aquí arriba. Puedes abonar cuando quieras desde la página.
```

- **Botón** (opcional, tipo «Ir al sitio web»): `Abonar a mi viaje` →
  `https://eurotravel-web.vercel.app/viaje.html`

| Hueco | Ejemplo | Qué es |
|---|---|---|
| `{{1}}` | `Ana` | primer nombre |
| `{{2}}` | `43773` | número de contrato de EuroSystem |
| `{{3}}` | `Puerto Vallarta, Jalisco` | destino |
| `{{4}}` | `15 de noviembre de 2026, 08:00` | salida |
| `{{5}}` | `$12,300` | total del viaje |
| `{{6}}` | `$3,000` | lo que acaba de pagar |
| `{{7}}` | `$9,300` | saldo |

---

## 2 · `pago_recibido` — cada abono que entra

Sin adjunto. Es el recibo.

```
Recibimos tu pago, {{1}} ✅

Folio: {{2}}
Pagaste: {{3}}
Fecha: {{4}}

Llevas abonado {{5}} de {{6}}.
Te quedan {{7}} por abonar.

Gracias 🙌
```

| Hueco | Ejemplo |
|---|---|
| `{{1}}` | `Ana` |
| `{{2}}` | `43773` |
| `{{3}}` | `$1,500` |
| `{{4}}` | `18 de septiembre de 2026` |
| `{{5}}` | `$4,500` |
| `{{6}}` | `$12,300` |
| `{{7}}` | `$7,800` |

---

## 3 · `saldo_pendiente` — recordatorio antes del viaje

Solo si el dueño la quiere. Sin adjunto.

```
Hola {{1}}, te recuerdo tu viaje 🚐

Folio: {{2}}
Salida: {{3}}

Te faltan {{4}} por abonar antes de la salida.
Puedes abonar con tarjeta o en el OXXO desde la página.
```

- **Botón** «Ir al sitio web»: `Abonar` → `https://eurotravel-web.vercel.app/viaje.html`

| Hueco | Ejemplo |
|---|---|
| `{{1}}` | `Ana` |
| `{{2}}` | `43773` |
| `{{3}}` | `15 de noviembre de 2026` |
| `{{4}}` | `$7,800` |

---

## Reglas que Meta revisa (para que no la rechacen)

- Nada de promesas ni promociones: son avisos de una operación que el cliente pidió.
- No empezar ni terminar con un hueco `{{ }}`.
- Sin dos huecos pegados: `{{1}} {{2}}` está mal, `{{1}}, folio {{2}}` está bien.
- Los montos van **ya formateados** desde nuestro lado (`$12,300`), no en centavos.

---

## Qué necesito yo cuando estén aprobadas

1. Los **nombres exactos** de las plantillas (si les pones otro nombre).
2. El **Phone number ID** del número desde el que salen.
3. El **token** del usuario del sistema con permiso `whatsapp_business_messaging`
   (sin caducidad). **Va directo a Vercel, nunca al chat.**

Con eso conecto EuroSystem → WhatsApp: cada contrato y cada abono dispara su
mensaje, igual que hoy dispara el correo.

---

## Orden

1. Dar de alta las 3 plantillas (hoy) → esperar aprobación
2. Crear el número en Meta y el token, si aún no está
3. Pasarme nombres, Phone ID y token en Vercel
4. Yo conecto y probamos con un contrato real
