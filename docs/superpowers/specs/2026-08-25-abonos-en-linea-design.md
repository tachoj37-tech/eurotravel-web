# Abonos en línea

**25 de agosto de 2026** · Especificación para revisión del dueño

Esta pieza cierra lo último que falta de la entrega al cliente: que pueda **abonar
desde su propia pantalla**, que el abono **se registre solo** en EuroSystem con su
comprobante, y que **la oficina se entere**.

Lo demás ya está construido y funcionando: el correo con el contrato adjunto, la
liga propia de cada cliente, y la puerta con código cada ocho horas.

---

## La decisión de fondo, y por qué el dueño la tomó así

El dueño pidió que el abono se registre solo, con el argumento de que **Stripe
confirma que el dinero entró**. Eso es cierto, y es mejor evidencia que un depósito
reportado por teléfono.

Pero se le corrigió una mitad de la premisa, y el diseño depende de esa corrección:

> **Stripe confirma que el dinero ENTRÓ. Ningún sistema de pagos puede confirmar
> que no volverá a salir.**

| Forma de pago | ¿Se puede revertir? | Hasta cuándo |
|---|---|---|
| Tarjeta | **Sí** | ~120 días (contracargo del banco) |
| OXXO | No | es efectivo |

**No existe un momento en que una tarjeta sea irreversible.** Es así en Stripe, en
Mercado Pago, en Conekta y en la terminal del mostrador.

Con eso enfrente, el dueño eligió: **registrar el abono de inmediato, y marcarlo
REVERTIDO si algún día pasa.** Es lo que hace todo el mundo, y lo único que no le
enseña a la oficina dinero que ya no existe.

De ahí sale el requisito que EuroSystem tiene que cumplir: **la puerta de abonos
necesita saber revertir**, no solo registrar.

---

## Lo que ya existe y no se toca

- El cobro del anticipo (`/api/pagar`) y su webhook
- El correo con folio y contrato en PDF adjunto
- La liga firmada y la puerta con código de ocho horas
- La regla del kilómetro, en `_publico.js`

## Lo que NO entra aquí

- **Cuentas de usuario** y «Mis viajes». Es el proyecto siguiente.
- **WhatsApp.** Necesita la API de Meta: empresa verificada, plantillas aprobadas
  una por una, días de trámite. El canal queda preparado, no conectado.
- **Facturación.** El abono no genera CFDI; eso sigue siendo de la oficina.

---

## Parte 1 — Lo que hace falta en EuroSystem

**Esto no se puede construir desde este repositorio**, y es la única dependencia
externa de la pieza.

### Por qué hace falta algo nuevo

La puerta de contratos de hoy solo sabe **crear**. Y su documentación dice, a
propósito:

> «El **anticipo no queda registrado como pago**. Es lo que dice el contrato que se
> acordó; el pago se captura en la oficina cuando se confirma que entró.»

Eso es un **control**, no un olvido. Alguien lo puso ahí para que ningún sistema de
fuera pudiera afirmar que entró dinero.

Lo que se pide es levantar ese control **solo para el dinero que llega por Stripe**,
con el argumento de que Stripe ya confirmó que entró — y a cambio, obligarse a
avisar cuando se revierta.

### La puerta que se pide

```
POST /api/contratos/abono-externo
x-api-key: <CONTRATOS_API_KEY>

{
  "referenciaExterna": "WEB-cs_…",   // el contrato, como ya se identifica hoy
  "monto": 5000,
  "formaPago": "TARJETA",            // o "EFECTIVO" cuando es OXXO
  "referenciaPago": "pi_3AbC…",      // el pago de Stripe: la llave de idempotencia
  "cobradoEn": "2026-08-25T14:32:00-06:00",
  "comprobante": "https://dashboard.stripe.com/payments/pi_3AbC…",
  "origen": "WEB"
}
```

**Contesta** el saldo actualizado:

```json
{ "folio": 51001, "abonoId": "abo_…", "totalPagado": 10200, "saldo": 15800 }
```

### La segunda puerta: revertir

```
POST /api/contratos/abono-externo/revertir
x-api-key: <CONTRATOS_API_KEY>

{
  "referenciaPago": "pi_3AbC…",
  "motivo": "CONTRACARGO",     // o "REEMBOLSO"
  "detalle": "El banco del cliente inició una disputa el 12-dic-2026"
}
```

Sin esta segunda puerta la pieza **no se puede entregar**, porque el sistema
acabaría enseñando dinero que ya no existe. Es la condición del diseño que el dueño
aprobó.

### Tres reglas que la puerta tiene que cumplir

1. **Idempotente por `referenciaPago`.** Misma lección que los contratos: el mismo
   pago de Stripe nunca puede generar dos abonos. Stripe reintenta sus avisos hasta
   tres días.
2. **El abono nunca puede pasar del saldo.** Si llega uno que se pasa, se rechaza
   con `422` y se grita en el registro: significa que algo se descuadró.
3. **Revertir es idempotente también.** Un contracargo avisado dos veces se marca
   una sola vez.

### Lo que el dueño tiene que decidir allá

- Si el abono entra como **pago confirmado** o como **borrador que alguien libera**.
  Se recomienda **confirmado**: es lo que hace que el saldo y el PDF se actualicen
  solos, que es justo lo que se pidió.
- Quién recibe el aviso de un contracargo.

> **REGLA DEL OTRO REPOSITORIO.** Si esto toca el esquema de Prisma, pasa por
> `experto-migraciones` y **espera confirmación explícita del dueño** antes de
> correr nada. Ni siquiera en local. Desde este repositorio no se toca.

---

## Parte 2 — Lo que se construye aquí

### La pantalla

Desde su viaje, un botón **«Abonar»**.

```
Saldo:  $20,800

  ┌──────────────────────────────┐
  │  ¿Cuánto quieres abonar?     │
  │  $ [            5,000     ]  │
  │                              │
  │  [ Abonar todo el saldo ]    │
  │  [ Continuar al pago     ]   │
  └──────────────────────────────┘
```

- El monto se teclea libre. Sugerencias: **el saldo completo** y **la mitad**.
- Mínimo $100 — por debajo, la comisión de Stripe se come el abono.
- **El monto se valida EN EL SERVIDOR** contra el saldo real, nunca contra lo que
  mande el navegador. Es la misma regla que ya cumple `/api/pagar`.

### El saldo, calculado desde Stripe

**Stripe es la única fuente de verdad del dinero.** El saldo no se guarda en ningún
lado: se calcula sumando lo cobrado.

```
saldo = total − (anticipo + todos los abonos pagados)
```

Los abonos se encuentran listando las sesiones del cliente con
`metadata.tipo = 'abono'` y `metadata.folio = <su folio>`. Se usan **filtros de
lista**, no la búsqueda de Stripe: la búsqueda tarda hasta un minuto en reflejar lo
recién escrito, y este flujo es «paga y da clic al momento».

**Por qué no se guarda una copia:** si la página guardara su propia cuenta de cuánto
ha pagado alguien, habría **dos verdades sobre el mismo dinero** y terminarían
discrepando. Nada truena; nada más los números dejan de cuadrar. Es el peor defecto
posible aquí.

### El cobro

Se abre una sesión de Stripe con:

- `customer` = **el mismo cliente**, para que el abono aparezca junto a su viaje
- `metadata.tipo` = `abono`
- `metadata.folio` = su folio
- `metadata.referenciaExterna` = la del contrato, para que el webhook sepa a cuál va

### La vuelta: «tu pago fue recibido con éxito»

Es lo que el dueño pidió expresamente. Al volver de Stripe, la pantalla **le
pregunta al servidor** si el pago está confirmado — no le cree a la dirección de
regreso, que la puede escribir cualquiera.

| Lo que contesta Stripe | Lo que ve el cliente |
|---|---|
| pagado | **«Tu pago fue recibido con éxito»**, su nuevo saldo y su folio |
| voucher de OXXO sin pagar | «Genera tu ficha y págala en la tienda» |
| no pagado | «No se completó el pago» |

Decirle «recibido con éxito» a alguien que generó un voucher de OXXO y no lo ha
pagado sería mentirle.

### El registro, y el aviso a la oficina

Cuando Stripe confirma el pago —**preguntándole a Stripe**, no creyéndole al aviso,
que es lo que el webhook ya hace hoy—:

1. Se registra el abono en EuroSystem con su `referenciaPago` y su comprobante.
2. **Le llega un correo a la oficina**: quién abonó, cuánto, de qué folio, y el
   saldo que queda.
3. Si el registro falla, se contesta **500** para que Stripe reintente tres días.
   Es idempotente, así que reintentar no duplica.

### Las reversiones

Se atienden dos avisos más de Stripe:

| Aviso | Qué se hace |
|---|---|
| `charge.refunded` | se revierte el abono y se avisa a la oficina |
| `charge.dispute.created` | igual, con motivo `CONTRACARGO` |

**Estos dos avisos hay que darlos de alta en Stripe**, junto a los dos que ya
existen. Sin ellos la reversión nunca llega y el sistema enseña dinero que ya no
está.

---

## Los archivos

| Archivo | Qué |
|---|---|
| `api/_saldo.js` | calcula el saldo desde Stripe. Nuevo, y es el único que sabe hacerlo |
| `api/abonar.js` | valida el monto contra el saldo real y abre el cobro |
| `api/_webhook-logica.js` | atiende `tipo=abono` y las dos reversiones |
| `api/_correo.js` | el aviso a la oficina |
| `viaje.html` | el botón, el monto y la pantalla de «recibido con éxito» |
| `pruebas/probar-saldo.cjs` | nuevo |
| `pruebas/probar-abonos.cjs` | nuevo |

---

## Cómo se prueba

Con proveedores fingidos, como ya se hace con Stripe, Google y Resend. Nada toca la
red.

**El dinero**
- el saldo se calcula desde Stripe y cuadra con lo cobrado
- **no se puede abonar más que el saldo**, aunque el navegador mande otro monto
- el monto que mande el navegador **se ignora**
- un abono repetido —mismo pago de Stripe— **no se registra dos veces**
- abonar el saldo exacto lo deja en cero, ni un peso arriba ni abajo
- un abono de $0 o negativo se rechaza

**Las reversiones**
- un contracargo marca el abono revertido y **sube el saldo otra vez**
- avisado dos veces, se marca una sola
- una reversión de un abono que no existe no revienta

**Lo que ve el cliente**
- un voucher de OXXO sin pagar **NO dice «recibido con éxito»**
- ni el kilometraje ni ninguna tarifa se filtran en ninguna respuesta nueva
- el cliente A no puede abonar al viaje del cliente B

**Si EuroSystem falla**
- el dinero ya está en Stripe: se contesta 500 y se reintenta
- y se grita en el registro con el folio, para capturarlo a mano si hace falta

---

## En qué orden

1. **`_saldo.js`** con sus pruebas. No depende de nada externo y es la base.
2. **`abonar.js`** y el botón. Aquí el cliente ya puede abonar y ver su saldo
   correcto, **aunque EuroSystem todavía no lo sepa**.
3. **La pantalla de «recibido con éxito»**.
4. **PAUSA** — hasta que exista la puerta en EuroSystem.
5. El registro del abono y el aviso a la oficina.
6. Las reversiones.

**Del 1 al 3 se puede entregar y usar sin que el 4 exista.** El cliente abona de
verdad y su pantalla dice la verdad; la oficina lo captura como hoy. No es lo ideal,
pero funciona desde el día uno y no bloquea al cliente.

---

## Lo que hace falta del dueño

| | Cuándo |
|---|---|
| Decidir si el abono entra confirmado o como borrador en EuroSystem | antes del paso 5 |
| Abrir la puerta `abono-externo` y su reversión en EuroSystem | antes del paso 5 |
| Dar de alta `charge.refunded` y `charge.dispute.created` en Stripe | antes del paso 6 |
| Decir a qué correo llegan los avisos de la oficina | antes del paso 5 |
| Verificar `eurotravel.com.mx` en Resend | antes del primer cliente real |
