# Qué falta para los abonos, y cómo está el inicio de sesión

**12-sep-2026.** Respuesta a tres preguntas del dueño: si el inicio de sesión
está bien, qué falta, y qué hace falta para las ligas de abono y el portal
donde el cliente ve sus viajes.

---

## 1 · El inicio de sesión: está bien, y ahora está probado a golpes

Se auditó en dos tandas —las ligas primero, las cuentas después— atacando el
código en vez de leerlo esperando ver el error. **Cuarenta y seis casos de
abuso.** Aguantó todos menos dos, ya arreglados
(`docs/AUDITORIA-LIGAS-Y-SESION.md`).

### Las contraseñas

| | |
|---|---|
| Guardado | `scrypt` con N=16384, r=8, p=1 — los parámetros recomendados |
| Medido | **59 ms por intento**, que es lo que hace cara la fuerza bruta |
| Sal | 16 bytes aleatorios, **distinta por cuenta** y nueva al cambiarla |
| En claro | la ficha **no guarda la contraseña por ningún lado** — se comprobó buscándola en el JSON |
| Al entrar | corre `scrypt` **aunque la cuenta no exista**, para que el reloj no delate quién está registrado |

Se atacó con contraseña vacía contra ficha con contraseña, ficha con el hash
vaciado, ficha con la sal vaciada, contraseña como objeto, y correo con salto
de línea para inyectar una copia oculta. **Ninguno pasó.**

### Lo que ya estaba bien de antes

La liga va firmada y **la firma se verifica antes de tocar Stripe**. La liga
sola **no abre nada**: pide además un código al correo. La sesión va atada al
cliente, no al viaje. Los permisos «ver un viaje» y «entrar a la cuenta» van
**dentro del sello**, así que uno no puede hacerse pasar por el otro. La
cookie es `HttpOnly`, `Secure`, `SameSite=Lax`, y dos cookies con el mismo
nombre se rechazan en vez de adivinar.

### Lo que queda dicho y no se tocó

**Cambiar la contraseña no cierra las demás sesiones.** El token va firmado
sin estado: no hay lista que revocar. Si alguien robó la cookie, cambias la
contraseña y sigue dentro hasta ocho horas. Cerrarlo obligaría a consultar
Stripe en cada validación —hoy es pura criptografía, sin red—. Para viajes y
con ocho horas de tope, la ventana es acotada.

---

## 2 · El portal del cliente YA EXISTE

Es lo primero que hay que decir, porque la pregunta suena a que hay que
construirlo y no es así. Está en el menú de la barra, en **«Mis viajes»**, y
se probó con viajes de verdad:

> **Puerto Vallarta**
> ET-1042 · 20 dic 2026 · Sprinter
> Te falta $15,000 de $19,000
>
> **Mazatlán**
> ET-0988 · 5 oct 2026 · Irizar Century 49
> Pagado completo · $40,000

Cada renglón lleva al viaje completo con su liga. Está bien construido: pinta
con `textContent` —no se puede colar HTML—, y antes de seguir una liga
comprueba que apunte a nuestro propio sitio.

**Lo único que no puede hacer es abonar.** Eso es lo que falta, y es de lo que
trata el resto de este documento.

> Un detalle menor, anotado: si faltara `LIGAS_SECRETO`, los renglones salen
> deshabilitados diciendo «busca el correo con tu liga» — pero ese correo
> tampoco traería liga, porque se firma con la misma llave. El consejo sería
> imposible de seguir. Solo pasa con la variable mal puesta.

---

## 3 · Los abonos: ya están diseñados, y falta UNA cosa

> **Al día · 15-sep-2026.** Lo de abajo ya se cumplió y esta sección se lee
> como historia. Las dos puertas de EuroSystem existen (§13), los abonos del
> portal se registran solos, y **el anticipo también**: desde hoy, cuando
> Stripe confirma el pago, `api/_webhook-logica.js` crea el contrato con
> `pagado: true` —**nace CONFIRMADO, no BORRADOR**— y enseguida anota el
> anticipo como abono por `POST /api/contratos/abono-externo`, con el `pi_…`
> como referencia: el mismo que busca la reversa si ese dinero se devuelve.
>
> El orden es contrato → abono → correo al cliente, y no es casual: si el
> abono falla se contesta 500 y Stripe insiste tres días; con el correo antes,
> el cliente recibiría un comprobante por cada reintento. Las dos puertas son
> idempotentes, así que insistir no duplica ni un contrato ni un peso.

**No hay que inventar nada.** Existe `docs/superpowers/specs/2026-08-25-abonos-en-linea-design.md`,
escrito y aprobado por el dueño, con el diseño completo. Y una parte del
camino ya está construida: `api/_reversas.js` ya sabe distinguir un abono
revertido de un anticipo revertido.

Lo que **no** está empezado son `api/_saldo.js` y `api/abonar.js`.

### La única dependencia que no depende de mí

El spec lo dice sin rodeos: **esto no se puede construir desde este
repositorio**.

La puerta de contratos de EuroSystem hoy **solo sabe crear**, y su
documentación dice a propósito que *«el anticipo no queda registrado como
pago»*. Eso es un **control**, no un olvido: alguien lo puso para que ningún
sistema de fuera pudiera afirmar que entró dinero.

Hacen falta dos puertas nuevas allá:

```
POST /api/contratos/abono-externo            registrar el abono
POST /api/contratos/abono-externo/revertir   marcarlo revertido
```

**Se comprobó: ninguna de las dos existe hoy** (no aparecen en
`../EUROSYSTEM/CONTRATOS-API.md`).

La segunda no es opcional. Es la condición del diseño que el dueño aprobó:

> *Stripe confirma que el dinero ENTRÓ. Ningún sistema de pagos puede
> confirmar que no volverá a salir.*

Una tarjeta se puede revertir hasta ~120 días después. Sin la puerta de
revertir, el sistema acabaría enseñando dinero que ya no existe.

### Y lo que sí se puede hacer sin esperar

Esta es la parte buena, y también sale del spec: **los pasos 1 al 3 se pueden
entregar sin que la puerta exista.**

| paso | qué es | ¿depende de EuroSystem? |
|---|---|---|
| 1 | `_saldo.js` y sus pruebas | no |
| 2 | `abonar.js` y el botón | no |
| 3 | la pantalla de «recibido» | no |
| **4** | **PAUSA hasta que exista la puerta** | — |
| 5 | registrar el abono y avisar a la oficina | **sí** |
| 6 | las reversiones | **sí** |

Con los pasos 1 a 3, **el cliente ya abona de verdad y su pantalla dice la
verdad**; la oficina lo captura a mano como hoy. No es lo ideal, pero funciona
desde el día uno y no deja al cliente esperando.

---

## 4 · Lo que me falta de ti, en orden

| | para qué | cuándo |
|---|---|---|
| **Abrir las dos puertas en EuroSystem** | sin esto los abonos no se registran solos | antes del paso 5 |
| **Decidir si el abono entra confirmado o como borrador** que alguien libera | lo decide el diseño de allá | antes del paso 5 |
| **Dar de alta `charge.refunded` y `charge.dispute.created` en Stripe** | sin eso un contracargo pasa sin que nadie se entere | antes del paso 6 |
| **Decir a qué correo llegan los avisos de la oficina** | hoy `AVISOS_A` decide, y hay que confirmarlo | antes del paso 5 |
| **Verificar `eurotravel.com.mx` en Resend** | hoy sale con el remitente de prueba | antes del primer cliente real |

Y una que salió del trabajo de hoy y no estaba en el spec:

| | |
|---|---|
| **Revisar `RESEND_API_KEY` y `AVISOS_A` en Vercel** | las solicitudes de la fase 2 salen por correo. Si esas variables están mal, **no le llegan a nadie** — queda gritado en el registro, pero nadie mira el registro |

---

## 5 · Lo que le falta al portal, aparte de abonar

Salió de mirarlo funcionando, y ninguna es urgente:

- **El saldo solo sabe de Stripe.** Si cobras un abono por transferencia o en
  efectivo, el cliente sigue viendo el saldo viejo. Cuando exista la puerta de
  EuroSystem, el saldo debería venir de allá, que es quien los conoce todos.
- **No se puede pedir el contrato desde ahí.** Llega por correo al comprar; si
  lo perdió, tiene que buscar el correo.
- **No hay «cambiar mi correo».** Configuración deja cambiar nombre y
  contraseña, no el correo — y el correo es la llave de la cuenta, así que
  cambiarlo necesita su propio código de confirmación.
