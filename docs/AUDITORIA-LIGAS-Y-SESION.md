# Auditoría de las ligas y del inicio de sesión

**12-sep-2026.** A pedido del dueño: *«eso quiero que lo pulas y veas qué tal
si encuentras bugs en los links o en el inicio de sesión»*.

Salió de descartar el folio tecleado para el portal de abonos: si las ligas y
las cuentas son lo que va a sostener eso, más vale saber qué tan firmes están.

---

## Cómo se hizo

No se leyó el código esperando ver el error. Se **atacó**: veintinueve casos
de abuso contra `_ligas.js` y `_acceso.js` —firmas mezcladas, cargas
falsificadas, cookies duplicadas, contadores envenenados, códigos de una
puerta usados en otra— y después se revisó a mano lo que los ataques no
alcanzan.

**Aguantó 27 de 29.** Es el código mejor defendido del proyecto, y se nota que
ya pasó una revisión seria el 27-ago-2026.

## Lo que está bien, y conviene saber que lo está

| | |
|---|---|
| La liga | HMAC-SHA256 con secreto de entorno; cambiarle un carácter la invalida |
| Firma mezclada | rechazada — la carga de una liga con la firma de otra no cuadra |
| Comparaciones | en tiempo constante, para que el reloj no delate la firma |
| El orden | **la firma se verifica ANTES de tocar Stripe**: una liga inventada no nos hace consultar sesiones ajenas |
| La liga sola | **no abre nada**: pide además un código al correo |
| La sesión | atada al CLIENTE, no al viaje — cambiar la liga no entra a lo ajeno |
| La cookie | `HttpOnly`, `Secure`, `SameSite=Lax`; dos cookies con el mismo nombre se rechazan |
| Los permisos | `liga` y `cuenta` van **dentro del sello**: uno no puede hacerse pasar por el otro |
| El código | seis dígitos con generador criptográfico, diez minutos, cinco intentos, un solo uso, y se guarda el resumen, nunca el código |
| El correo | no se puede saber si existe: misma respuesta y **piso de tiempo** para que el reloj no lo diga |
| Entrar | corre `scrypt` aunque la cuenta no exista |
| Google | comprueba emisor, destinatario, vencimiento y `email_verified` |
| Cabeceras | CSP estricta, HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` que impide que el token se filtre a terceros |

## Lo que se encontró, y ya está arreglado

### 1 · El contador de intentos se podía poner en negativo

`api/_acceso.js`. El contador vive en la metadata del cliente de Stripe, se
guarda como texto y se leía con `Number(…) || 0`. Con un `-999` ahí dentro,
`van >= INTENTOS` es falso mil veces seguidas: **cinco intentos se vuelven mil
cuatro**.

Hoy esa metadata solo la escribe nuestro servidor, así que no es un hueco que
alguien pueda abrir desde fuera — es defensa en profundidad. Pero ese contador
es lo único que separa un código de seis dígitos de un ataque por fuerza
bruta, y un candado que depende de que nadie escriba mal un campo no es un
candado.

**Arreglo:** `Math.max(0, …)`. Una línea.

### 2 · «Te mandamos otro código» se decía sin saber si había salido

`viaje.html`. El botón de reenviar escribía el texto **antes** de mandar nada,
y pedía el código en modo callado: si el servidor contestaba 429 —el freno son
seis por minuto— o 503, el mensaje se quedaba puesto igual. El cliente
esperando un correo que nunca salió, sin nada que le dijera que reintentara.

Es el mismo defecto que tenía «Entrar» en la portada y que se arregló en la
fase 0: contestar algo que no se sabe.

**Arreglo:** «Mandando…», y luego la verdad — «Listo, va otro código a
a\*\*\*@ejemplo.com», «No pudimos mandarlo ahora mismo» o «No hubo conexión».
Y el botón se frena mientras va, porque cada clic es un correo que cuesta.

## Lo que se descartó al comprobarlo

Vale escribirlo para que nadie lo vuelva a perseguir:

- **«Un viaje sin cliente de Stripe deja al cliente atrapado.»** No: está
  contemplado, contesta 409 con aviso, y `customer_creation: 'always'` lo hace
  improbable.
- **«El token se filtra por el referente.»** No: `Referrer-Policy:
  strict-origin-when-cross-origin` manda solo el origen a terceros.
- **«Hay `innerHTML` sin escapar.»** No: los cuatro que marcó la primera
  versión de la prueba sí escapan — el `esc()` caía en la línea siguiente.
  Falso positivo de la prueba, no del código.

## Lo que queda anotado y NO se tocó

**Cambiar la contraseña no cierra las demás sesiones.** La sesión es un token
firmado sin estado: no hay lista de sesiones que revocar. Si alguien te robó
la cookie, cambias la contraseña y el ladrón sigue dentro **hasta ocho horas**.

Se puede cerrar —metiendo en el sello un resumen de la contraseña actual— pero
eso obligaría a consultar Stripe en **cada** validación de sesión, que hoy es
pura criptografía sin red. Es un cambio de la lógica de autenticación y de su
costo, así que no se hace sin que el dueño lo pida.

Para lo que hay en juego —viajes, no banca— y con ocho horas de tope, la
ventana es acotada. Queda dicho.

## Lo que lo vigila

| | |
|---|---|
| `pruebas/probar-acceso.cjs` | 75 · el código y la sesión, ahora con el contador envenenado |
| `pruebas/probar-pantalla-del-viaje.cjs` | 18 · **nueva** — lo que pinta `viaje.html` |
| `probar-ligas`, `probar-liga-completa`, `probar-viaje`, `probar-cuentas`, `probar-cuenta-entrar`, `probar-olvide` | lo que ya había |

Los dos arreglos se vieron en rojo antes que en verde.

Y algo que la auditoría dejó claro: **`viaje.html` ya hacía bien lo del código
incompleto** —contaba los seis dígitos antes de mandar— cuando `index.html` lo
hacía mal. El arreglo de la fase 0 no inventó nada: puso la portada a la
altura de esta pantalla.
