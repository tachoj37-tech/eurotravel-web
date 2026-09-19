# Los mensajes para las plantillas de Kommo

**18-sep-2026.** Los textos finales, listos para copiar y pegar en
**Kommo → Automatizaciones → Plantillas → Plantillas de chat → Crear**.

Cómo se llena cada una:

1. Canal: **WhatsApp Business**.
2. Pegas el texto de abajo **tal como está**, con los datos de ejemplo puestos.
3. Seleccionas cada dato señalado y lo conviertes en **marcador de posición**
   (placeholder). Kommo te pide un ejemplo de cada uno: usa el mismo valor que
   ya está escrito.
4. Guardas y mandas a revisión. Tarda de un minuto a 48 horas.

Son **cuatro**. Todas avisan de algo que el cliente ya hizo, así que entran
como **Utilidad**, no como publicidad.

> Detalle del camino B: el contrato viaja como **liga**, no como archivo
> adjunto. Ver `WHATSAPP-POR-KOMMO.md`.

---

## 1 · `contrato_listo`

Sale cuando el cliente aparta y se genera su contrato.

```
¡Listo Ana! Tu viaje ya quedó apartado 🚐

Folio: 43773
Destino: Puerto Vallarta, Jalisco
Salida: 15 de noviembre de 2026, 08:00

Total del viaje: $12,300
Anticipo recibido: $3,000
Queda por abonar: $9,300

Aquí está tu contrato: https://eurosystem.site/contrato/43773

Puedes abonar cuando quieras desde nuestra página, con tarjeta o en el OXXO. Cualquier duda, contéstanos por aquí 🙌
```

| Qué marcar como variable | Ejemplo |
|---|---|
| `Ana` | Ana |
| `43773` | 43773 |
| `Puerto Vallarta, Jalisco` | Puerto Vallarta, Jalisco |
| `15 de noviembre de 2026, 08:00` | 15 de noviembre de 2026, 08:00 |
| `$12,300` | $12,300 |
| `$3,000` | $3,000 |
| `$9,300` | $9,300 |
| `https://eurosystem.site/contrato/43773` | https://eurosystem.site/contrato/43773 |

---

## 2 · `pago_recibido`

Sale con cada abono que entra, incluido el anticipo.

```
Recibimos tu pago, Ana ✅

Folio: 43773
Pagaste: $1,500
Fecha: 18 de septiembre de 2026

Llevas abonado $4,500 de $12,300.
Te quedan $7,800 por abonar.

Gracias por tu confianza 🙌
```

| Qué marcar como variable | Ejemplo |
|---|---|
| `Ana` | Ana |
| `43773` | 43773 |
| `$1,500` | $1,500 |
| `18 de septiembre de 2026` | 18 de septiembre de 2026 |
| `$4,500` | $4,500 |
| `$12,300` | $12,300 |
| `$7,800` | $7,800 |

---

## 3 · `pago_revertido`

Sale cuando el banco regresa el dinero: un reembolso o un contracargo.

Es **una sola** plantilla para los dos casos —se cayó un abono o se cayó el
anticipo— a propósito. El texto no promete que el viaje siga apartado ni
anuncia que se canceló: eso lo resuelve una persona por teléfono, como pidió el
dueño. Partirla en dos sería una aprobación más y un riesgo más.

```
Hola Ana, tuvimos un problema con tu pago de $1,500 del folio 43773.

El banco lo regresó, así que ese pago no quedó aplicado y tu saldo pendiente es de $9,300.

Te vamos a marcar para ayudarte a resolverlo. Si ya lo pagaste de otra forma, contéstanos por aquí 🙏
```

| Qué marcar como variable | Ejemplo |
|---|---|
| `Ana` | Ana |
| `$1,500` | $1,500 |
| `43773` | 43773 |
| `$9,300` | $9,300 |

---

## 4 · `saldo_pendiente`

Recordatorio antes de la salida. Es la única opcional.

```
Hola Ana, te recordamos tu viaje 🚐

Folio: 43773
Salida: 15 de noviembre de 2026

Te faltan $7,800 por abonar antes de la salida. Puedes pagar con tarjeta o en el OXXO desde nuestra página.

Cualquier duda, contéstanos por aquí 🙌
```

| Qué marcar como variable | Ejemplo |
|---|---|
| `Ana` | Ana |
| `43773` | 43773 |
| `15 de noviembre de 2026` | 15 de noviembre de 2026 |
| `$7,800` | $7,800 |

---

## Por qué están escritos así

Cada regla de abajo es un motivo de rechazo que Meta aplica:

- **Nunca empiezan ni terminan con una variable.** Por eso `¡Listo Ana!` lleva
  el «¡Listo» delante, y todas cierran con una frase fija.
- **Nunca hay dos variables pegadas.** Siempre va texto en medio: `Folio: 43773`,
  `Pagaste: $1,500`.
- **No venden nada.** Ni «aprovecha», ni «oferta», ni «te invitamos». Son
  avisos de una operación que el cliente ya hizo. Eso las mantiene en Utilidad,
  que es más barato y se aprueba más fácil.
- **Los montos van ya formateados** (`$12,300`), no en centavos. El formato lo
  pone nuestro código antes de mandar.
- **La liga va completa**, sin acortadores: Meta rechaza bit.ly y parecidos.

---

## Si Meta rechaza alguna

Kommo te enseña el motivo en la misma pantalla. Los dos más comunes:

- **Faltan los ejemplos de las variables.** Es el más frecuente. Cada marcador
  necesita el suyo.
- **La mandaron como Marketing.** Debe ir en Utilidad.

Se corrige y se reenvía. No hay castigo por reintentar.
