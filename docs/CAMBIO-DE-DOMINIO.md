# El día que entre `eurotravel.com.mx`

El dueño avisó el 27-ago-2026 que en unos seis días la página pasa a su dominio
real. Esto es todo lo que se mueve, en el orden en que conviene moverlo.

**La buena noticia:** el código ya no tiene el dominio escrito dentro. Se
cambia una variable en Vercel y se mueve todo junto. Antes eran tres cosas
regadas y una de ellas se rompía en silencio.

**La que hay que tener presente:** el `.vercel.app` **no se apaga**. Vercel lo
deja vivo, y eso es lo que queremos: las ligas que ya se mandaron a clientes
apuntan ahí, y un correo de la semana pasada tiene que seguir abriendo.

---

## Lo que se rompería si no se hace nada

| Qué | Qué pasaría |
|---|---|
| Cotizar y pagar | **403 desde el primer minuto.** El servidor solo acepta llamadas del origen que conoce, y el dominio nuevo no lo conoce. |
| El correo del contrato | La liga «Ver mi viaje» seguiría apuntando al `.vercel.app`. Funciona, pero el cliente ve un dominio que no es el de la empresa justo cuando acaba de pagar. |
| El regreso de Stripe | Después de pagar, el cliente aterriza en el dominio viejo. |
| Continuar con Google | **Deja de funcionar.** Google solo acepta los orígenes que estén dados de alta. |

---

## 1. Antes de tocar nada: el DNS

En el panel de donde esté comprado el dominio (GoDaddy, Namecheap, quien sea)
van a acabar conviviendo **dos juegos de registros distintos**, y no se
estorban:

| Para | Registros | Los da |
|---|---|---|
| Que la página abra | `A` en la raíz y `CNAME` en `www` | Vercel |
| Que el correo salga | `TXT` y `MX`, normalmente en un subdominio `send.` | Resend |

Conviene hacer los dos en la misma sentada: ya vas a estar en ese panel, y el
de Resend es el que hoy tiene parada la entrega de correos a clientes.

---

## 2. En Vercel: dar de alta el dominio

1. Vercel → proyecto **eurotravel-web** → **Settings** → **Domains**.
2. **Add** → `eurotravel.com.mx` → Add.
3. Vercel enseña los registros que hay que pegar en el panel del dominio.
   Pégalos y espera. Suele tardar minutos; puede tardar horas.
4. Cuando Vercel ponga el dominio en verde, agrega también `www.eurotravel.com.mx`
   y deja que redirija al de la raíz (Vercel lo ofrece solo).

> **El plan Hobby es de uso no comercial**, y esta página cobra. Si todavía no
> se pasó a Pro, éste es el momento: ya pasó una vez que el despliegue se cayera
> por un tope del plan, y ese día la página siguió sirviendo la versión vieja
> sin avisar.

---

## 3. En Vercel: las dos variables

**Settings → Environment Variables**:

| Variable | Valor |
|---|---|
| `SITIO_URL` | `https://eurotravel.com.mx` |
| `ORIGENES_EXTRA` | `https://www.eurotravel.com.mx` |

Sin barra al final y con `https`. Si se teclea mal, el código **la ignora y se
queda con el dominio viejo** en vez de romperse — pero entonces el cambio no
surte efecto, así que conviene comprobarlo (paso 7).

Y después, **Deployments → el último → Redeploy**. Vercel solo aplica las
variables a los despliegues nuevos: sin redesplegar, el sitio sigue corriendo
con las de antes y parece que la variable no sirvió.

---

## 4. Google

Console de Google Cloud → **APIs y servicios** → **Credenciales** → el ID de
cliente de OAuth → **Orígenes autorizados de JavaScript**.

Tienen que estar **los dos**:

```
https://eurotravel-web.vercel.app
https://eurotravel.com.mx
```

Si al crear el ID ya se pusieron los dos —que es como está escrito en el
instructivo— aquí no hay nada que hacer. Vale la pena abrirlo y verlo de todas
formas: es un minuto y es la diferencia entre que el botón funcione o no.

Las claves de **Places** y **Routes** no se tocan: las usa el servidor, no el
navegador, y no tienen restricción de sitio web.

---

## 5. Resend — ESTO NO HAY QUE ESPERARLO

**El correo y la página son dos trámites independientes**, y conviene tenerlo
claro porque parece que van juntos y no:

| | Registros | Qué mueve |
|---|---|---|
| **Resend** | `MX` y `TXT` en `send.` y `resend._domainkey.` | de dónde **sale** el correo |
| **Vercel** | `A` en la raíz, `CNAME` en `www` | dónde **vive** la página |

No se estorban ni se enteran uno del otro. Así que **verificar el dominio en
Resend se puede hacer hoy, sin mover la página** — y conviene, porque es lo
único que impide que un cliente real reciba su código y su contrato.

Mientras `SITIO_URL` siga sin poner, las ligas de los correos seguirán
apuntando al `.vercel.app`. Eso está bien y es lo correcto hasta el día del
cambio: el correo saldrá de `ventas@eurotravel.com.mx` con una liga al
`.vercel.app`, que se ve un poco desparejo pero funciona.

1. Verificar `eurotravel.com.mx` en Resend.
2. `RESEND_DE` = `Eurotravel <ventas@eurotravel.com.mx>` y redesplegar.

**Y una advertencia del DNS:** el `MX` que pide Resend va en el subdominio
`send`, **no** en la raíz. Si se reemplaza el de la raíz, se deja de recibir
correo en `ventas@eurotravel.com.mx` — y eso se nota el mismo día.

---

## 6. Stripe

El webhook sigue apuntando al `.vercel.app` y **sigue funcionando** — Stripe
llama de servidor a servidor y ese dominio no se apaga.

Aun así conviene moverlo al dominio bueno, para que el día que alguien mire la
configuración de Stripe no se pregunte qué es ese dominio raro:

Stripe → **Developers** → **Webhooks** → el endpoint → **Update details** →
cambiar la URL a `https://eurotravel.com.mx/api/webhook-stripe`.

**El secreto de firma no cambia** al editar la URL. Si en vez de editar se crea
un endpoint nuevo, sí cambia, y entonces hay que actualizar
`STRIPE_WEBHOOK_SECRET` en Vercel. Editar es más seguro.

---

## 7. Comprobarlo, sin adivinar

Con el dominio ya en verde y el redespliegue hecho:

**Que las APIs acepten el dominio nuevo** — abre `https://eurotravel.com.mx`,
cotiza un viaje cualquiera y llega hasta la pantalla de pago. Si el dominio no
estuviera dado de alta, la cotización fallaría ahí mismo.

**Que la liga del correo salga con el dominio bueno** — es lo que no se ve. La
única forma honesta de verlo es hacer una compra de prueba y mirar el correo:
el botón «Ver mi viaje» tiene que llevar a `https://eurotravel.com.mx/viaje.html?t=…`.

**Que el correo llegue** — `POST /api/diagnostico` con `{"probarCorreo": true}`
y la clave de diagnóstico. Tiene que contestar `"ok": true`.

**Que Google entre** — pica el botón. Si Google contesta que el origen no está
autorizado, falta el paso 4.

---

## Lo que NO hay que tocar

| Variable | Por qué |
|---|---|
| `LIGAS_SECRETO` | Cambiarla **invalida todas las ligas ya mandadas**. Los clientes que ya recibieron su correo dejan de poder entrar a ver su viaje. El cambio de dominio no la afecta. |
| `CONTRATOS_API_KEY` | Es de servidor a servidor. No sabe de dominios. |

---

## Y una cosa que se va a ver rara, pero está bien

Quien tuviera la sesión abierta en el `.vercel.app` **no aparece dentro** en el
dominio nuevo. Las cookies son por dominio: son dos sitios distintos para el
navegador. Entra otra vez con su contraseña y ya.

Hoy no le pasa a nadie, porque la página todavía no es pública. Queda dicho
para que no se lea como un defecto el día que aparezca.
