# Que un reembolso se refleje en EuroSystem

La página ya detecta cuando el dinero se regresa y ya toca la puerta de
EuroSystem. **Esa puerta todavía no existe**, así que hoy contesta `404` y lo
único que evita perder el dinero es el correo que le llega a la oficina.

Este documento es el encargo para abrirla. Trae, en orden: qué manda la página,
qué tiene que hacer EuroSystem, y un prompt listo para pegar allá.

---

## 1. Qué manda la página, exactamente

```
POST https://eurosystem-smoky.vercel.app/api/contratos/reversa-externa
Content-Type: application/json
x-api-key: <CONTRATOS_API_KEY>
```

La misma llave que ya usa `/api/contratos/externo`. No hace falta una nueva.

```json
{
  "referenciaExterna": "WEB-cs_test_a1b2c3...",
  "referenciaPago":    "pi_3QabcDEF456",
  "tipo":              "ANTICIPO",
  "motivo":            "REEMBOLSO",
  "monto":             5200,
  "detalle":           "El pago que creó este contrato se revirtió en Stripe. El viaje no está pagado."
}
```

| Campo | Qué es |
|---|---|
| `referenciaExterna` | El **mismo** valor con el que se creó el contrato. Así se encuentra. |
| `referenciaPago` | El pago de Stripe. **Es la llave de idempotencia** — ver §3. |
| `tipo` | `ANTICIPO` (el pago que creó el contrato) o `ABONO` (uno posterior). |
| `motivo` | `REEMBOLSO` (se devolvió) o `CONTRACARGO` (el banco lo disputó). |
| `monto` | En **pesos**, no en centavos. Sale de Stripe, no del aviso. |
| `detalle` | Texto para el historial. |

El monto ya viene confirmado contra Stripe del lado de la página: antes de
mandar esto se le pregunta a Stripe si ese dinero de verdad salió. EuroSystem
no tiene que volver a comprobarlo.

---

## 2. Qué tiene que hacer EuroSystem

**Son dos casos y no se parecen.**

### `tipo: "ANTICIPO"` — se cayó el contrato

El pago que creó el contrato se regresó, así que ese viaje **nunca se pagó**.

1. Buscar el contrato por `referenciaExterna`.
2. Dejarlo en `CANCELADO`.
3. Cancelar su viaje en el calendario, para **liberar la unidad de ese día**.
   Es lo más urgente: si no, la mesa de control sigue viendo el camión ocupado.
4. Renglón en el historial a nombre de «Reversa web», con el motivo y el monto.

**El folio NO se recicla.** El contrato se queda con su número, cancelado. Es
la misma regla del §5 de `CONTRATOS-API.md`: los folios son consecutivos y un
hueco no se cierra nunca.

### `tipo: "ABONO"` — solo se cae ese abono

El contrato sigue en pie y su anticipo también.

1. Buscar el abono por `referenciaPago`.
2. Marcarlo revertido, de modo que **el saldo vuelva a subir**.
3. Renglón en el historial.
4. No tocar el contrato ni el viaje.

### Qué contestar

| Situación | Respuesta |
|---|---|
| Se aplicó | `200` con `{ ok: true, folio, accion }` |
| Ya se había aplicado | `200` con `{ ok: true, repetido: true }` |
| No se encontró el contrato o el abono | `404` |
| Sin `CONTRATOS_API_KEY` en el servidor | `503`, y no se toca nada |
| Llave equivocada | `401` |

Cualquier respuesta que no sea `2xx` hace que la página le mande el correo de
alarma a la oficina. Eso está bien: vale más un correo de más que una reversa
que nadie ve.

---

## 3. Lo que no se puede aflojar: la idempotencia

**El mismo `referenciaPago` no puede aplicarse dos veces.**

No es teórico. Un contracargo manda **dos** avisos —`charge.dispute.created`
cuando el banco lo abre y `charge.dispute.funds_withdrawn` cuando Stripe retira
el dinero—, y la página atiende los dos a propósito: el primero para enterarse a
tiempo, el segundo porque es el que de verdad mueve el dinero. Sin idempotencia,
un solo contracargo descontaría el saldo dos veces.

Y si la página no recibe el `200` —un timeout que en realidad sí pasó— Stripe
reintenta durante tres días.

Esto necesita **una tabla nueva** que guarde los `referenciaPago` ya aplicados,
con índice único.

> ⚠️ **Tabla nueva = migración, y las migraciones de EuroSystem pasan por
> `experto-migraciones` y esperan tu confirmación explícita.** Además, por la
> regla 6 del skill `antes-de-escribir`: `ENABLE ROW LEVEL SECURITY` va **en la
> misma migración** que el `CREATE TABLE`, y al terminar se corre
> `npm run revisar:rls`. Supabase publica el esquema `public` por su API REST;
> una tabla sin RLS la lee y la escribe cualquiera con la llave `anon`.

---

## 4. El prompt para pegar en EuroSystem

Abre una sesión **en la carpeta `EUROSYSTEM`** y pega esto tal cual:

---

```
Necesito abrir una puerta nueva: POST /api/contratos/reversa-externa

CONTEXTO
La página de Eurotravel (proyecto EUROAPP/eurotravel-web) ya detecta cuando
Stripe regresa dinero —un reembolso o un contracargo— y ya llama a esta puerta.
Hoy contesta 404 y lo único que evita perder el dinero es un correo a la
oficina. El contrato completo está en
../EUROAPP/eurotravel-web/docs/REVERSAS-PARA-EUROSYSTEM.md — léelo antes de
escribir nada.

AUTENTICACIÓN
La misma que /api/contratos/externo: cabecera x-api-key contra
CONTRATOS_API_KEY. Sin la variable, 503 y no se toca nada. Copia el patrón de
src/app/api/contratos/externo/route.ts en vez de inventar otro.

CUERPO QUE LLEGA
{ referenciaExterna, referenciaPago, tipo, motivo, monto, detalle }
  tipo:   "ANTICIPO" | "ABONO"
  motivo: "REEMBOLSO" | "CONTRACARGO"
  monto:  pesos, no centavos

QUÉ TIENE QUE HACER, EN UNA SOLA TRANSACCIÓN
- tipo ANTICIPO: buscar el contrato por referenciaExterna, dejarlo CANCELADO,
  cancelar su viaje del calendario para liberar la unidad, y dejar renglón en
  el historial a nombre de "Reversa web". El folio NO se recicla: el contrato
  se queda con su número, cancelado.
- tipo ABONO: buscar el abono por referenciaPago, marcarlo revertido para que
  el saldo vuelva a subir, y dejar renglón en el historial. No tocar el
  contrato ni el viaje.

IDEMPOTENCIA — ES LO MÁS IMPORTANTE
El mismo referenciaPago no puede aplicarse dos veces. Un contracargo manda dos
avisos distintos (charge.dispute.created y charge.dispute.funds_withdrawn) y
los dos llegan aquí. Sin esto, un solo contracargo descuenta dos veces.
La segunda vez se contesta 200 con { ok: true, repetido: true }.

RESPUESTAS
200 { ok:true, folio, accion } · 200 { ok:true, repetido:true } · 404 no
encontrado · 401 llave mala · 503 sin llave configurada.

CÓMO QUIERO QUE LO HAGAS
1. Lee primero el skill antes-de-escribir y aplícalo AL ESCRIBIR, no al
   revisar.
2. La tabla nueva para la idempotencia es un cambio de esquema: pasa por
   experto-migraciones y espera mi confirmación explícita antes de correr
   nada. ENABLE ROW LEVEL SECURITY va en la misma migración que el CREATE
   TABLE, y al final corre npm run revisar:rls.
3. Cuando esté, llama a guardian-datos y a verificador-dinero con el diff.
4. Pruébalo de punta a punta tú mismo antes de decir que funciona: los dos
   casos, y el mismo referenciaPago dos veces.
```

---

## 5. Lo que hay que tocar fuera del código

### En Stripe — sin esto nada de lo demás sirve

Los avisos de reversa **no están dados de alta**. Hoy el destino solo escucha
`checkout.session.completed`, así que Stripe nunca nos avisa de un reembolso.

En **Stripe → Webhooks → el destino «Eurotravel» → Edita el destino**, agregar:

```
charge.refunded
charge.dispute.created
charge.dispute.funds_withdrawn
```

⚠️ El modo de prueba y el modo real llevan listas separadas. Lo que se dé de
alta en pruebas **no** pasa al modo real: hay que repetirlo el día que se cobre
de verdad.

### En Vercel — proyecto `eurotravel-web`

| Variable | Para qué | ¿Está? |
|---|---|---|
| `AVISOS_A` | A qué correo llega la alarma de reversa. Acepta varios separados por coma. Sin ella cae en el remitente. | Falta |
| `CONTRATOS_API_KEY` | Para llamar a EuroSystem. Ya se usa para registrar contratos. | Ya está |
| `STRIPE_WEBHOOK_SECRET` | La firma. Ya está, aunque ver §6. | Ya está |

### En Supabase

**Nada a mano.** La tabla nueva y su RLS van dentro de la migración. Tocar el
esquema desde el panel de Supabase lo deja fuera de sincronía con Prisma.

---

## 6. Una cosa que quedó a medias, y conviene saberla

La firma de Stripe **no se está comprobando en producción**, y no es un
descuido de configuración: es que quien llama elige si se le comprueba.

Se atacó el sitio publicado con la misma petición y la misma firma inventada,
cambiando una sola cosa:

```
Content-Type: text/plain          ->  400 firma inválida
Content-Type: application/json    ->  200, y entró
```

Con `application/json`, Vercel parsea el cuerpo antes de que lo veamos, se
pierden los bytes exactos y ya no hay firma que comprobar. Como Stripe manda
justamente `application/json`, no se puede cerrar contestando `400` sin dejar
fuera a los avisos buenos.

Lo que se hizo es **no creerle al aviso**: antes de mover un peso se le pregunta
a Stripe si ese dinero de verdad se fue, y el monto sale de ahí. Un desconocido
que sepa un `pi_…` ya no puede inventar un reembolso.

Queda pendiente recuperar la firma como primera puerta —es defensa en
profundidad, no la única—. Requiere que Vercel entregue el cuerpo crudo, que es
un pleito con el entorno, no con el código.
