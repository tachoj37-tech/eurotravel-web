# Resend: que los correos le lleguen al cliente

**19-sep-2026.** Hoy la página manda correos con el remitente de prueba de
Resend, y por eso **solo le llegan al dueño de la cuenta de Resend**. Ningún
cliente recibe su folio, su contrato ni su recibo. Esto lo arregla.

Son 15 minutos tuyos y una espera de DNS que suele ser de minutos.

---

## La precaución que va primero

Tu correo de la empresa vive en **Google Workspace**: los registros MX del
dominio apuntan a `aspmx.l.google.com`. Comprobado hoy.

> **No toques los MX ni el SPF que ya existen.** Si el SPF de la raíz se
> reemplaza por el de Resend, el correo de Google empieza a caer en spam o a
> rebotar. Es el error clásico y se paga caro.

Por eso, cuando Resend te pregunte, **usa un subdominio para enviar**:
`send.eurotravel.com.mx`. Así Resend pone sus registros ahí, aparte, y lo de
Google queda intacto.

---

## Paso 1 · Agregar el dominio en Resend

1. Entra a **resend.com** → **Domains** → **Add Domain**.
2. Escribe `eurotravel.com.mx`.
3. Cuando pregunte por la región, elige la más cercana. Si no pregunta, sigue.
4. Si te ofrece un **subdominio de envío**, pon `send`. Si no lo ofrece, no
   pasa nada: lo importante es no tocar el SPF de la raíz.

Resend te va a enseñar una tabla con **tres o cuatro registros**. Algo así:

| Tipo | Nombre | Valor |
|---|---|---|
| MX | `send` | `feedback-smtp.…amazonses.com` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSq…` (una cadena larga) |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

Los valores son tuyos y los genera Resend: no los copies de aquí.

---

## Paso 2 · Ponerlos en Cloudflare

Tu DNS está en **Cloudflare** (los nameservers son `alex` y `vera` de
Cloudflare). Ahí van:

1. Entra a **dash.cloudflare.com** → tu dominio → **DNS** → **Records**.
2. Por cada renglón de la tabla de Resend: **Add record**, eliges el tipo,
   pegas el nombre y el valor tal cual.
3. **La nube gris, no naranja.** Si algún registro admite «Proxy status»,
   déjalo en **DNS only**. Un registro de correo proxeado no funciona.
4. **Ojo con el `_dmarc`**: si ya tienes uno, **no lo dupliques**. Un dominio
   solo puede tener un DMARC. Si existe, déjalo como está y sáltate ese.

Lo que **no** se toca en esa pantalla: los cinco MX de Google y cualquier TXT
que empiece con `v=spf1` en la raíz.

---

## Paso 3 · Verificar

De vuelta en Resend, botón **Verify**. Suele tardar minutos; puede tardar
hasta unas horas.

✅ Queda cuando el dominio dice **Verified**.

---

## Paso 4 · Avisarme

Cuando esté verificado, pon esto en Vercel, proyecto `eurotravel-web`:

```
RESEND_DE = Eurotravel <ventas@eurotravel.com.mx>
```

Y dale **Redeploy**. Con eso los correos salen a nombre de Eurotravel.

Avísame y yo compruebo, desde aquí, que un correo de verdad llega a una
bandeja de Gmail y que no cae en spam.

---

## Qué cambia cuando esto quede

| Correo | Hoy | Después |
|---|---|---|
| Folio y contrato en PDF al cliente | solo al dueño de Resend | al cliente |
| Recibo de cada abono | solo al dueño | al cliente |
| Aviso de reversa al cliente | solo al dueño | al cliente |
| Ficha del camión a la oficina | solo al dueño | a `AVISOS_A` |
