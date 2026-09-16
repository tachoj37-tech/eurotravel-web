# Lanzamiento · paso a paso

**16-sep-2026.** Lo que falta para cobrar de verdad, en el orden en que se hace.
Cada paso dice quién lo hace y cómo se sabe que quedó. Se va tachando.

Lo que ya está en producción y comprobado (no se repite aquí): cotizador solo
Sprinter con precio; solo ida se paga; pasajeros hasta el contrato; cuentas
escondidas; camioncito en las esperas; ficha completa al vendedor; webhook con
firma verificada y a prueba de pérdidas; consulta y abono con número de
contrato + apellido; EuroSystem con sus puertas y su migración; aviso
instantáneo construido y apagado hasta que se pongan sus variables.

---

## Bloque A · Lo del dueño, se puede hacer ya

### A1 · Stripe: la cuenta YA cobra, no se toca nada de lo que existe
La cuenta recibe hoy los pagos de la página vieja, con un webhook que hizo
otro programador. **Regla del dueño (16-sep): que nada de esto afecte esa
recepción.** Por eso, en Stripe:
- **NO** rotar («Roll key») ni borrar la llave secreta que existe: la usa la
  página vieja
- **NO** tocar, editar ni desactivar el webhook que ya está
- **NO** cambiar métodos de pago, datos del negocio ni nombre público
- Solo se **agregan** dos cosas nuevas, que conviven con lo viejo (A2)
- La página ya distingue sus cobros de los de la página vieja
  (`esDeLaPagina`, `pruebas/probar-pagos-ajenos.cjs`): un pago o un
  reembolso de la página vieja que llegue a nuestro webhook se contesta
  «ajeno» y no dispara nada.

### A2 · Stripe: UNA llave nueva y UN webhook nuevo (10 min)
- [ ] Modo real (apagar «test mode») → Developers → API keys → en «Standard
      keys» → **«Create secret key»** (crear una NUEVA, nombre
      `eurotravel-web`) → copiar la **`sk_live_…`** que te enseña.
      Nunca «Roll key» sobre la que ya existe.
- [ ] Developers → Webhooks → **Add endpoint** (uno nuevo, junto al viejo) →
      `https://eurotravel-web.vercel.app/api/webhook-stripe`
- [ ] Palomear los **5 eventos**: `checkout.session.completed`,
      `checkout.session.async_payment_succeeded`, `charge.refunded`,
      `charge.dispute.created`, `charge.dispute.funds_withdrawn`
- [ ] Copiar el **`whsec_…`** de ESE webhook nuevo (cada endpoint tiene el suyo)
- ⚠️ La firma ya se comprueba de verdad: un `whsec_` equivocado hace que
  Stripe reciba 400 y reintente hasta que se corrija.
- ✅ Queda cuando en Webhooks se ven DOS endpoints: el viejo intacto y el nuevo.

### A3 · Resend: los correos al cliente (10 min + espera de DNS)
- [ ] Domains → Add Domain → `eurotravel.com.mx` → agregar los registros DNS
      donde se administra el dominio
- ✅ Queda cuando dice **Verified**. Sin esto, ningún cliente recibe correo.

### A4 · El aviso instantáneo por WhatsApp (30–40 min + aprobación de Meta)
El número lo crea Meta, no Kommo: un número dentro de Kommo no da token para la
API, y un número solo puede tener un dueño en la API de Meta. El de ventas en
Kommo no se toca. Detalle en `docs/AVISO-INSTANTANEO.md`.
- [ ] Un número **sin WhatsApp instalado** (chip nuevo o virtual que reciba SMS)
- [ ] business.facebook.com → WhatsApp Manager → la cuenta de WhatsApp Business →
      **Agregar número** → verificar por SMS
- [ ] Message templates → Create → categoría **Utilidad**, idioma **es_MX**,
      nombre `entro_dinero`, el texto de los siete `{{1}}…{{7}}`
- [ ] Configuración → Usuarios del sistema → crear uno → acceso a la app de
      WhatsApp con `whatsapp_business_messaging` → **token sin caducidad**
- [ ] Copiar el **Phone number ID** del número nuevo
- ✅ Queda cuando Meta apruebe la plantilla (1–24 h)
- Mientras: **Telegram** (15 min) si se quieren avisos desde hoy — pasos en
  `docs/AVISO-INSTANTANEO.md`

### A5 · Las variables en Vercel (10 min)

Proyecto **`eurotravel-web`** → Settings → Environment Variables:

| Variable | Valor |
|---|---|
| `PORTAL_API_KEY` | la cadena de `Documentos\EUROAPP\LLAVE-PORTAL.txt` |
| `STRIPE_SECRET_KEY` | la `sk_live_…` (A2) |
| `STRIPE_WEBHOOK_SECRET` | el `whsec_…` del webhook nuevo (A2) |
| `RESEND_DE` | `Eurotravel <ventas@eurotravel.com.mx>` |
| `AVISOS_A` | los correos de oficina, separados por coma |
| `AVISO_WA_TOKEN` | el token del usuario del sistema (A4) |
| `AVISO_WA_PHONE_ID` | el ID del número nuevo (A4) |
| `AVISO_WA_A` | los 2 números con lada, separados por coma |
| `AVISO_WA_PLANTILLA` | `entro_dinero` |
| `AVISO_WA_IDIOMA` | `es_MX` |
| `AVISO_TELEGRAM_TOKEN` / `AVISO_TELEGRAM_CHAT` | solo si se usa Telegram |

Proyecto **`eurosystem`**:

| Variable | Valor |
|---|---|
| `PORTAL_API_KEY` | **la misma** cadena |
| `URL_PUBLICA` | `https://eurosystem.site` |

- [ ] **Redeploy** en los dos proyectos
- [ ] Borrar `LLAVE-PORTAL.txt`
- [ ] **Avisar aquí**

### A6 · Confirmar
- [ ] El número de WhatsApp para clientes es **33 2183 2993**
- [ ] El plan de Vercel del equipo EURO es **Pro**
- [ ] El último despliegue de `eurosystem` en Vercel está en **Ready** (el
      16-sep quedó uno en ERROR de otra sesión; producción sirve el anterior)

---

## Bloque B · Lo de Claude, en cuanto avise el dueño (30 min)

- [ ] B1 · Comprobar con evidencia: consulta con un folio real; correo de
      prueba llegando a la bandeja; el webhook recibiendo de la cuenta nueva;
      el aviso saliendo (si ya hay plantilla o Telegram)
- [ ] B2 · **Abrir el candado del cobro real** (`PERMITIR_COBRO_REAL`) y subirlo
- [ ] B3 · Comprobar que la página deja pagar y que el modo es real

## Bloque C · La prueba de fuego, juntos (20 min)

- [ ] C1 · El dueño reserva una Sprinter de verdad, el viaje más barato
- [ ] C2 · Claude verifica uno por uno: contrato **confirmado** en EuroSystem ·
      anticipo como **abono sin aprobar** · **correo con PDF** al cliente ·
      **aviso** a los dos teléfonos · consulta con folio + apellido enseña saldo
- [ ] C3 · El dueño abona $100 desde la pantalla de abonos; Claude verifica que llegue
- [ ] C4 · El dueño **reembolsa** desde Stripe; Claude verifica que EuroSystem lo
      marque revertido y el saldo vuelva

✅ Con C2, C3 y C4 en verde, **está lanzado**.

## Bloque D · Después de lanzar

- [ ] D1 · Marcar «revertido» en el panel de EuroSystem (hoy se ve como pendiente)
- [ ] D2 · Avisos internos cuando un pago quede «para registrar a mano»
- [ ] D3 · Política de cancelación y aviso de privacidad donde se paga (el dueño dicta)
- [ ] D4 · Dominio `eurotravel.com.mx` apuntando a la página
- [ ] D5 · EuroSystem: `probar:reporte-mitades` y `probar:una-sola-cuenta` en rojo
      desde `7ee2613` («Falta `contrato.unidades`») — es cálculo de costos
- [ ] D6 · Asistente de EuroSystem suma abonos sin aprobar como pagados
- [ ] D7 · Alta rápida de cliente parte «Juan Pablo» en nombre y apellido
- [ ] D8 · «Tu fecha sigue libre» con el calendario real (`DISPONIBILIDAD_API_KEY`)
- [ ] D9 · La página pesa 2.9 MB al abrir: 2 MB son seis JPG de fondo (`viaje-*.jpg`,
      `dest-*.jpg`) que bajan completos desde el primer segundo aunque están al final.
      Cambiarlos a `<img loading="lazy">` o cargarlos al llegar; el HTML pesa 380 KB.
- [ ] D10 · `probar-ticket-y-se-baja.mjs` caducó con el calendario el 16-sep («15 a 20
      de septiembre» ya pasó y el bot descarta la salida). Es del bot: no se toca sin
      que el dueño lo pida.
- [ ] D11 · Quien llega a Stripe y regresa con «Atrás» encuentra el cotizador vacío:
      origen, destino, fechas y datos se pierden y tiene que capturar todo otra vez.
      Lo vio el recorrido con Playwright del 16-sep. Guardar el viaje en
      `sessionStorage` y rehidratarlo al volver.
