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

### Paso 2 · Crear cuenta y confirmar el correo

- `POST /api/cuenta-crear` — correo, contraseña, nombre, teléfono. Crea el
  cliente en Stripe y manda el código de 6 dígitos.
- `POST /api/cuenta-codigo` — reenvía el código, **las veces que haga falta**
  hasta que confirme.
- `POST /api/cuenta-confirmar` — el código; marca verificada y abre sesión.

Lo que hay que cuidar: que dos altas del mismo correo no hagan dos cuentas
(Stripe no lo impide); freno por correo **y** por quien ataca, para que nadie
pueda dejar fuera a otro; y que nada de esto diga si un correo ya existe.

### Paso 3 · Entrar y salir

- `POST /api/cuenta-entrar` — correo y contraseña → sesión de 8 horas, la
  misma cookie firmada que ya usa la liga.
- `POST /api/cuenta-salir`
- `POST /api/cuenta-yo` — quién está dentro, para que la pantalla lo sepa.

Sin correo de por medio: es lo que pidió el dueño.

### Paso 4 · Las dos pantallas, antes de pagar

- La bifurcación **invitado / crear cuenta**, con el texto diciendo lo que de
  verdad se gana: hoy cada viaje es una liga suelta; con cuenta, todos en un
  lugar y sin buscar correos viejos.
- Formulario de alta, formulario de entrada, pantalla del código.
- Al pagar con sesión abierta, el viaje queda ligado a la cuenta.
- **Y cambiar los textos que hoy prometen lo contrario**: `index.html` dice
  «no hay que abrir cuenta ni recordar contraseñas» y «No necesitas crear
  cuenta». No están mal — se escribieron cuando la liga era el único camino.

### Paso 5 · Mis viajes

- `POST /api/mis-viajes` — los viajes del cliente, sacados de Stripe.
- La pantalla, con saldos y el botón de abonar.

### Paso 6 · Olvidé mi contraseña

- `POST /api/cuenta-olvide` — manda un código al correo.
- `POST /api/cuenta-nueva` — código + contraseña nueva.

El único correo que recibe una cuenta ya confirmada.

### Paso 7 · Continuar con Google

- Verificar el token de Google **sin dependencias**: se piden sus llaves
  públicas y se comprueba la firma con el `crypto` de Node.
- Si el correo de Google ya tiene cuenta, se liga en vez de duplicar.
- Hay que abrir la CSP para `accounts.google.com`, que hoy está cerrada.

**Necesita el ID de cliente del dueño.**

### Paso 8 · Probarlo de punta a punta

Crear una cuenta de verdad, confirmarla, salir, entrar con la contraseña,
pagar un viaje y verlo aparecer en «Mis viajes». Con la regla del proyecto:
no se da por terminado hasta hacer la operación completa.

---

## Lo que NO cambia

El camino de **invitado** se queda tal cual: cotiza, paga, y le llega su liga
firmada con su folio y su contrato. Quien no quiera cuenta no la necesita, y
nada de lo que ya funciona se toca.
