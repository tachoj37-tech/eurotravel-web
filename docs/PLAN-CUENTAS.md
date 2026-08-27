# Cuentas de clientes — el plan, paso por paso

Pedido por el dueño el 26-ago-2026: antes de pagar, dos caminos —**continuar
como invitado** o **crear cuenta**— y decirle al cliente que con cuenta tiene
mejor acceso a sus viajes y más control.

**Cómo entra**, en sus palabras:

> «Entra con correo y contraseña, pero al momento de crear su cuenta tiene que
> confirmar su correo con un código de 6 dígitos. El código se manda las veces
> que sea necesario hasta que el cliente verifique su correo. Una vez que creó
> correo y contraseña ya no le vas a mandar correos para nada al entrar, puede
> entrar con su contraseña. Solo le mandarías correo si olvida su contraseña.
> También crea la opción de continuar con Google.»

**Dónde vive una cuenta:** en la ficha del cliente de Stripe. Cero base de
datos y cero dependencias nuevas, que es como está el resto del proyecto.

---

## Dos cosas que tiene que dar el dueño

| | para qué | sin eso |
|---|---|---|
| **Verificar `eurotravel.com.mx` en Resend** | que el código de confirmación llegue | se construye y se prueba con su correo, pero **ningún cliente real puede crear cuenta** |
| **Un ID de cliente de OAuth de Google** | el botón «Continuar con Google» | el paso 7 no se puede terminar |

El ID de Google **no es secreto** (va en la página). Se saca en la misma
consola donde ya viven las llaves de Places y Routes: *Credenciales → Crear
credenciales → ID de cliente de OAuth → Aplicación web*, autorizando el
origen `https://eurotravel-web.vercel.app`.

---

## Los pasos

### Paso 1 · El motor — ✅ HECHO (26-ago-2026)

`api/_cuentas.js` y sus 50 pruebas. La contraseña se guarda con `scrypt` y
sal propia por cliente, nunca en claro; una cuenta nace **sin verificar**;
equivocarse no dice si la cuenta existe. Probado en rojo de cuatro formas.

### Paso 2 · Crear cuenta y confirmar el correo — ✅ HECHO (26-ago-2026)

Crear, reenviar el código «las veces que haga falta» y confirmar. **Todo por
una sola puerta**, `POST /api/cuenta` con un campo `accion`: el plan Hobby de
Vercel publica un máximo de doce funciones y una por acción no cabía.

Dos altas del mismo correo no hacen dos cuentas —Stripe no lo impide, se cuida
aquí—; el freno cuenta por correo **y** por quien ataca; y nada de esto dice si
un correo ya existe: quien ya la tiene recibe un aviso a su buzón, que es a
quien le importa.

### Paso 3 · Entrar y salir — ✅ HECHO (26-ago-2026)

Correo y contraseña → sesión firmada de 8 horas. **Sin correo de por medio**,
que es lo que pidió el dueño. Equivocarse no dice si la cuenta existe.

### Paso 4 · Las dos pantallas, antes de pagar — ✅ HECHO (26-ago-2026)

La bifurcación invitado / crear cuenta, sus tres formularios, y los textos
viejos que prometían lo contrario, corregidos. Si el servidor de cuentas se
cae, **el botón de pagar sigue vivo**: un problema de cuentas no puede costarle
una venta al dueño.

### Paso 5 · Mis viajes — ✅ HECHO (27-ago-2026)

`accion: 'mis-viajes'`. No hay base de datos: los viajes **son** las sesiones
de cobro de Stripe. Cada renglón trae destino, folio, fecha, saldo y **su liga
firmada** —la misma del correo—, así que picarle abre la pantalla del viaje que
ya existe, con su contrato y su botón de abonar. No hubo pantalla nueva que
mantener.

Los cobros sin folio no aparecen: no llegaron a contrato, y enseñarlos haría
creer al cliente que tiene un viaje que no tiene.

El filtro por cliente se hace en Stripe **y otra vez aquí**. Si algún día
Stripe ignorara ese parámetro, sin la segunda revisión cada cliente vería los
viajes de la empresa entera y nada en la pantalla lo delataría.

### Paso 5-bis · La cuenta desde la barra — ✅ HECHO (27-ago-2026)

No estaba en el plan; lo pidió el dueño ese día. Botón arriba a la derecha:
crear cuenta **sin comprar nada**, o entrar si ya se tiene un viaje. Ya dentro
se queda el puro monigote y despliega **Mis viajes**, **Configuración** y
**Cerrar sesión**.

Quien compró como invitado ya existe como cliente en Stripe: al crear su
cuenta, se le monta **encima** de esa ficha y sus viajes viejos siguen siendo
suyos.

Configuración enseña nombre y correo y **cambia la contraseña**, pidiendo la de
ahorita: una sesión abierta en un teléfono prestado podría, si no, dejar al
dueño fuera de su cuenta para siempre.

### Paso 6 · Olvidé mi contraseña — PENDIENTE

- `accion: 'olvide'` — manda un código al correo.
- `accion: 'clave-nueva'` — código + contraseña nueva.

El único correo que recibe una cuenta ya confirmada. **Hoy quien la olvide no
tiene salida**: es lo que falta para que el camino de la contraseña esté
completo.

Casi todo está hecho ya: el código de seis dígitos, su freno, su vida de diez
minutos y sus cinco intentos son los mismos del alta; y `paraCambiar` —con sal
nueva— ya se usa en Configuración. Falta la puerta y su pantalla.

### Paso 7 · Continuar con Google — ✅ HECHO (27-ago-2026)

`api/_google.js` y sus 85 pruebas. La firma se comprueba con las llaves
públicas de Google y el `crypto` de Node, sin dependencias. Se revisan las
cuatro cosas: firma, algoritmo —`alg:none` no pasa—, **destinatario** —un
papel bueno de Google pero emitido para otra aplicación no entra— y
`email_verified`. La CSP se abrió solo para `accounts.google.com/gsi/`.

Si el correo de Google ya tiene cuenta **se liga, no se duplica**: la
contraseña anterior sigue sirviendo y el historial de viajes no se parte en
dos. Y una cuenta que quedó sin confirmar se completa al entrar con Google,
porque Google acaba de comprobar ese mismo buzón.

`GOOGLE_CLIENT_ID` ya está puesto en Vercel (27-ago-2026) y el botón sale en
las dos pantallas. **Falta lo único que no se puede probar sin ser él: que el
dueño le pique con su cuenta de Google de verdad.** Si sale «Acceso
bloqueado», es que falta darle a *Publicar aplicación* en la consola de
Google.

### Paso 8 · Probarlo de punta a punta — A MEDIAS

Hecho, con Stripe y el correo fingidos: crear cuenta sin comprar, código,
confirmar, ver el aviso, menú, listar viajes con sus saldos, cambiar
contraseña, salir y volver a entrar. Y el sitio publicado se atacó con
credenciales de Google forjadas: ninguna entra.

**Falta la mitad que necesita cosas del dueño**, y no es un detalle:

| Falta | Sin eso |
|---|---|
| Verificar `eurotravel.com.mx` en Resend | a un cliente real **no le llega el código**, así que hoy nadie más que el dueño puede crear cuenta |
| Pagar un viaje de verdad | no se ha visto un viaje aparecer en «Mis viajes» con datos reales |
| Entrar con Google con su cuenta | es lo único del paso 7 que no se puede probar por él |

Con la regla del proyecto: **esto no se da por terminado hasta hacer la
operación completa con datos de verdad.**

---

## Lo que NO cambia

El camino de **invitado** se queda tal cual: cotiza, paga, y le llega su liga
firmada con su folio y su contrato. Quien no quiera cuenta no la necesita, y
nada de lo que ya funciona se toca.
