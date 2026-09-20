# Respaldo de la zona DNS de eurotravel.com.mx

**19-sep-2026.** El dueño tenía un export de la zona del **14-mayo-2025**.
Se comprobó renglón por renglón contra los servidores públicos de nombres: **todo
sigue vigente**. Con esto se puede reconstruir el dominio completo en otra cuenta
sin depender de quien administra el Cloudflare actual.

Nada de esto es secreto: el DNS es público. Se guarda aquí para no volver a
perderlo.

---

## Lo que faltaba saber, y ahora está

**El WordPress vive en `138.68.28.100`** (rango de DigitalOcean). Cloudflare lo
tapaba: desde fuera solo se veían sus direcciones `104.21.20.144` y
`172.67.192.248`. Esa es la dirección real a la que hay que seguir apuntando
mientras el sitio viejo siga en pie.

---

## La zona completa, vigente al 19-sep-2026

### A — la página (las dos van proxeadas por Cloudflare)

| Nombre | Valor |
|---|---|
| `eurotravel.com.mx` | `138.68.28.100` |
| `www` | `138.68.28.100` |

### CNAME

| Nombre | Valor | Proxy |
|---|---|---|
| `tracking` | `api.elasticemail.com` | **DNS only** |

### MX — el correo de Google Workspace

| Prioridad | Valor |
|---|---|
| 1 | `aspmx.l.google.com` |
| 5 | `alt1.aspmx.l.google.com` |
| 5 | `alt2.aspmx.l.google.com` |
| 10 | `alt3.aspmx.l.google.com` |
| 10 | `alt4.aspmx.l.google.com` |

### TXT

En la raíz:

```
v=spf1 a mx include:_spf.elasticemail.com include:_spf.google.com ~all
v=DMARC1; p=none;
google-site-verification=mNl4p_UqP74DWDStSC5H6Kj7l93pJuzMjK4sSXrB8LI
google-site-verification=PU89yzquXVRZxOt9ZAGTMjuNmBV9H0fn97NMHOeuXTI
ca3-82c6951e61fe435ebb987605d3764bbc
```

> ⚠️ El último, `ca3-82c…`, **no está en el respaldo de mayo**: se agregó
> después. Si se migra copiando solo el archivo, ese se pierde. Suele ser una
> verificación de dominio de algún servicio.

En subdominios:

| Nombre | Para qué |
|---|---|
| `_dmarc` | `v=DMARC1; p=none;` |
| `_domainkey` | `v=DKIM1; o=~` |
| `api._domainkey` | firma de **ElasticEmail** |
| `default._domainkey` | firma larga (2048 bits) |
| `dkim._domainkey` | firma (1024 bits) |
| `_acme-challenge` | dos valores, de certificados |

Los valores largos están en el archivo original del dueño. Los cuatro DKIM
siguen respondiendo hoy.

---

## Dos cosas que conviene arreglar de paso

1. **El DMARC está dos veces**: en `_dmarc` (su lugar) y en la raíz (donde nadie
   lo lee). El de la raíz sobra.
2. **ElasticEmail sigue autorizado** a mandar correo a nombre del dominio, con
   su SPF, su DKIM y hasta un subdominio de rastreo. Si ya nadie lo usa, es una
   puerta abierta que conviene cerrar. Antes hay que averiguar quién lo montó.

---

## Cómo mudar el dominio a la cuenta del dueño

Cloudflare permite **importar un archivo de zona**, así que casi todo es
automático:

1. En **su** Cloudflare: **Add a domain** → `eurotravel.com.mx` → plan gratis.
2. **DNS → Records → Import and Export → Import**, y subir el archivo del
   respaldo.
3. Revisar que estén los **cinco MX** y las dos **A** a `138.68.28.100`.
4. Agregar a mano el TXT `ca3-82c…`, que no viene en el archivo.
5. Agregar los **tres de Resend** (`resend._domainkey`, `rsend`, `send`).
6. Cloudflare da **dos servidores de nombres nuevos**.
7. En el **registrador** —donde se compró el dominio— cambiar los servidores de
   nombres por esos dos.
8. Esperar la propagación y **comprobar que el correo sigue llegando** antes de
   cantar victoria.

El paso 3 no se salta. Si los nameservers cambian y los MX no están del otro
lado, el correo de la empresa deja de llegar ese mismo día.

---

## Lo único que falta

**El registrador.** Es donde se cambian los servidores de nombres, y es la
llave para recuperar el control sin encontrar a quien administra el Cloudflare
actual.
