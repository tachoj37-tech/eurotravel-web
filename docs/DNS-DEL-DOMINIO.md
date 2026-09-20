# El DNS de eurotravel.com.mx: qué hay hoy y quién manda

**19-sep-2026.** Inventario completo, leído de los servidores públicos de
nombres. Sirve para dos cosas: entender qué hace Cloudflare ahí, y poder mover
el dominio **sin tumbar el correo**.

---

## Quién manda hoy

El dominio apunta a los servidores de nombres de **Cloudflare**:
`alex.ns.cloudflare.com` y `vera.ns.cloudflare.com`.

Pero esa cuenta de Cloudflare **no es la del dueño**: en su cuenta
(`Tachoj37@gmail.com`) la sección de dominios dice «No data available».
Comprobado el 19-sep-2026. Lo más probable es que sea la cuenta de quien hizo
el sitio de WordPress.

---

## Qué está haciendo Cloudflare ahí

**1 · Es la agenda del dominio.** Guarda la lista de a dónde va cada cosa: la
página, el correo, las verificaciones. Todo lo de abajo vive ahí. Si esa agenda
desaparece sin haber copiado su contenido a otro lado, **se cae el sitio y se
cae el correo de la empresa**.

**2 · Es un escudo delante de la página.** Las direcciones que contesta
(`104.21.20.144`, `172.67.192.248`) son de Cloudflare, no del servidor donde
vive el WordPress. Cloudflare recibe las visitas, las filtra y las pasa. De ahí
salen el candado de HTTPS, el caché y la protección contra ataques.

**3 · Esconde dónde está alojado el sitio.** Nadie ve la dirección real del
servidor del WordPress.

> **Por eso no se «desconecta y ya».** Desconectarlo sin plan es como tirar la
> agenda de teléfonos de la empresa: no es que se apague un adorno, es que
> nadie sabe a dónde mandar el correo.

---

## Todo lo que hay hoy, para poder reconstruirlo

### Correo (Google Workspace) — lo más delicado

| Tipo | Prioridad | Valor |
|---|---|---|
| MX | 1 | `aspmx.l.google.com` |
| MX | 5 | `alt1.aspmx.l.google.com` |
| MX | 5 | `alt2.aspmx.l.google.com` |
| MX | 10 | `alt3.aspmx.l.google.com` |
| MX | 10 | `alt4.aspmx.l.google.com` |

### TXT de la raíz

```
v=spf1 a mx include:_spf.elasticemail.com include:_spf.google.com ~all
v=DMARC1; p=none;
google-site-verification=PU89yzquXVRZxOt9ZAGTMjuNmBV9H0fn97NMHOeuXTI
google-site-verification=mNl4p_UqP74DWDStSC5H6Kj7l93pJuzMjK4sSXrB8LI
ca3-82c6951e61fe435ebb987605d3764bbc
```

Dos cosas que saltan:

- El **SPF incluye `elasticemail.com`**: alguien manda o mandaba correos por
  ElasticEmail a nombre del dominio. Conviene saber quién antes de quitarlo.
- El **DMARC está en la raíz**, cuando lo normal es `_dmarc.eurotravel.com.mx`.
  Así puesto, es probable que no lo esté leyendo nadie.

### La página

- `eurotravel.com.mx` y `www` contestan con direcciones de Cloudflare,
  proxeadas. El WordPress está detrás.

---

## Cómo se recupera el control, sin romper nada

Hay tres caminos, de menos a más dolor:

**1 · Que te agreguen a esa cuenta de Cloudflare.** Quien la tenga entra a
Manage account → Members y te invita con tu correo. No pierde su acceso. Es lo
más rápido y lo menos riesgoso.

**2 · Mover el DNS a tu propia cuenta.** No hace falta que nadie te dé permiso,
solo entrar al **registrador** donde se compró el dominio:

1. Agregas `eurotravel.com.mx` en tu Cloudflare (o en el DNS de Vercel).
2. Copias **todos** los registros de arriba, uno por uno, antes de nada.
3. En el registrador, cambias los servidores de nombres a los nuevos.
4. Esperas a que se propague y compruebas que el correo sigue llegando.

El paso 2 no se salta: si los nameservers cambian y los registros no están del
otro lado, **el correo de la empresa deja de llegar**.

**3 · Pedirle a quien administra que ponga lo que haga falta.** Resuelve el día,
pero te deja dependiendo de alguien que no contestas tú.

---

## Por qué esto importa ahora

- **Resend** necesita tres registros para que los correos le lleguen al cliente.
- **El lanzamiento** necesita apuntar el dominio a la página nueva.
- Si algo del correo falla un domingo, hoy no lo puedes arreglar tú.

Los tres piden lo mismo: control del DNS.

---

## Lo que falta saber

- **¿En qué registrador se compró el dominio?** (Akky, GoDaddy, Namecheap…).
  Ahí se cambian los servidores de nombres, y es la llave para recuperar el
  control sin depender de nadie.
- **¿Quién administra esa cuenta de Cloudflare?**
- **¿Quién usa ElasticEmail** a nombre del dominio?
