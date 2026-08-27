# Al lanzar: qué cambia de prueba a producción

Hoy la página está toda en modo de prueba. Este es el cambio completo, en orden
de qué se rompe si se olvida.

**Lo importante que hay que saber de entrada:** no todo son variables de
entorno. Hay **un cambio de código** y **una cosa que hay que volver a dar de
alta en Stripe**, y las dos son invisibles hasta que fallan.

---

## 1. El seguro que NO es una variable

```js
// api/_stripe.js
const PERMITIR_COBRO_REAL = false;
```

Mientras esté en `false`, una clave `sk_live_` **no cobra nada**: la pantalla
avisa y el viaje se cierra por teléfono.

Así que si solo cambias la clave de Stripe, la página va a rechazar cada cobro
diciendo «clave de producción con el cobro real todavía cerrado». No está roto:
es el seguro haciendo su trabajo.

Ponerlo en `true` es editar el archivo y desplegar, y **va al final** — cuando
ya se probó el recorrido completo con la clave de prueba.

---

## 2. Stripe: son cuatro cosas, no una

El modo de prueba y el modo real de Stripe son **dos mundos separados**. Nada
de lo que está configurado en pruebas existe del otro lado.

| Qué | Dónde | Ojo |
|---|---|---|
| `STRIPE_SECRET_KEY` | Vercel | La `sk_live_`. Cópiala sin espacios: hoy la de prueba trae y el código los quita, pero no siempre hay quien los quite. |
| **Webhook nuevo** | Stripe, modo real | El destino de pruebas NO sirve. Hay que crear otro apuntando a `/api/webhook-stripe`. |
| `STRIPE_WEBHOOK_SECRET` | Vercel | El del webhook **nuevo**. Es distinto al de pruebas. |
| **Los 5 eventos** | Stripe, modo real | Hay que volver a palomearlos uno por uno. La lista de pruebas no se copia sola. |

Los cinco eventos:

```
checkout.session.completed
checkout.session.async_payment_succeeded
charge.refunded
charge.dispute.created
charge.dispute.funds_withdrawn
```

Si se olvidan los tres de abajo, **los reembolsos vuelven a perderse en
silencio** — que es justo el defecto que se tapó.

---

## 3. Resend: el remitente de prueba deja de servir

Hoy sale de `onboarding@resend.dev`, que funciona sin verificar nada **pero
solo entrega al correo de la cuenta de Resend**. A un cliente no le llega nada.

Antes del primer cliente real:

1. Verificar el dominio `eurotravel.com.mx` en Resend.
2. `RESEND_DE` = `Eurotravel <ventas@eurotravel.com.mx>` (o el buzón que se
   decida).
3. `AVISOS_A` = el correo de oficina de verdad. Acepta varios separados por
   coma, y conviene que sean dos personas: un aviso de reversa que nadie abre
   es dinero perdido.

Comprobarlo sin hacer una compra:

```
POST /api/diagnostico    { "probarCorreo": true }
```

Tiene que decir `"ok": true` y enseñar a dónde llegó.

---

## 4. Lo que NO hay que tocar

| Variable | Por qué |
|---|---|
| `LIGAS_SECRETO` | Cambiarla **invalida todas las ligas ya mandadas**. Los clientes que ya tienen su correo dejan de poder entrar a ver su viaje. |
| `CONTRATOS_API_KEY` | Solo cambia si EuroSystem la rota, y entonces cambia en los dos lados a la vez. |

---

## 4-bis. El dominio de verdad

Tiene su propio documento, porque son varios lados y uno de ellos se rompe en
silencio: **[CAMBIO-DE-DOMINIO.md](CAMBIO-DE-DOMINIO.md)**.

En corto: se pone `SITIO_URL` en Vercel y se redespliega. De esa variable
salen las tres cosas que dependen del dominio —quién puede llamar a las APIs,
a dónde regresa Stripe, y la liga que va en el correo del contrato—. Y hay que
darle de alta el origen nuevo a Google, o el botón de «Continuar con Google»
deja de funcionar.

---

## 5. Vercel: el plan

El equipo está en **Hobby**, y el plan Hobby de Vercel es **para uso no
comercial**. Una página que cobra es uso comercial. Hay que pasar a Pro antes
de lanzar, no después.

---

## 6. Y limpiar lo temporal

El cotizador de prueba se hizo para que el dueño revisara costos y **se iba a
eliminar después**. Al lanzar, borrar:

```
prueba-cotizador.html
api/prueba-cotizador.js
pruebas/probar-prueba-cotizador.cjs
```

…y su renglón en `package.json` y su bloque en `.env.example`
(`CLAVE_COTIZADOR`).

---

## Orden sugerido

1. Verificar el dominio en Resend, y probar el correo.
2. Pasar Vercel a Pro.
3. Crear el webhook en modo real con sus cinco eventos.
4. Poner `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` de producción.
5. Comprobar que la página **rechaza** el cobro — el seguro sigue puesto.
6. Borrar el cotizador de prueba.
7. Hasta el final: `PERMITIR_COBRO_REAL = true`, desplegar, y **hacer una
   compra de verdad y reembolsarla** para ver que la alarma llega.
