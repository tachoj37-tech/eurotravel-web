# Revisión de seguridad — 27-ago-2026

Sobre el sistema de cuentas completo, recién terminado: crear, entrar, Google,
Mis viajes, Configuración y recuperar la contraseña.

**Seis defectos encontrados, seis tapados.** Dos de ellos dejaban entrar a la
cuenta de cualquier cliente.

| | Qué permitía | Cómo se encontró |
|---|---|---|
| **0** | entrar a cualquier cuenta sabiendo solo el correo | leyendo el camino de lado |
| **0-bis** | plantar una contraseña en una cuenta ajena | siguiendo el dato hasta Google |
| **0-ter** | el permiso de ver un viaje valía como cuenta completa | comparando dos permisos parecidos |
| **0-quater** | sacar la lista de clientes, correo por correo | un campo de más en la respuesta |
| **1** | lo mismo, pero con un cronómetro | midiendo |
| **2** | — | lo que salió limpio |

**Ninguno se veía leyendo la función de frente.** Todos tienen la misma forma:
el candado estaba bien puesto y había un camino que no pasaba por él.

Y **tres de ellos los tapaba una prueba que decía que todo estaba bien.**

---

## 0. LA GRAVE: se entraba a cualquier cuenta sabiendo solo el correo — TAPADO

`confirmar` cortaba **antes de mirar el código** si la cuenta ya estaba
verificada —y toda cuenta que sirve lo está— y en ese corte devolvía sesión:

```js
if (cuentas.estaVerificada(cliente.metadata || {})) {
  return { status: 200, cuerpo: ok({ yaEstaba: true }),
           sesionPara: cliente.id };          // <-- cookie de sesión
}
```

O sea que esto:

```
POST /api/cuenta
{"accion":"confirmar","correo":"victima@gmail.com","codigo":"000000"}
```

devolvía **una cookie de sesión buena por ocho horas**. Con ella: su nombre, su
correo, **todos sus viajes**, y las **ligas firmadas de sus contratos**, que
siguen sirviendo semanas después de que la sesión venza.

Todo el cuidado de que los mensajes no delaten, de que el código sea de un solo
uso, de que aguante cinco intentos: no servía de nada. Se entraba por al lado.

**Comprobado, no supuesto** — se ejecutó el ataque completo y devolvió la
sesión, la lista de viajes y la liga del contrato.

**La regla que se rompió:** nunca se abre sesión en un camino que no comprobó
un secreto.

**Por qué se escapó.** La intención era buena y se leía bien: «le dieron dos
veces al botón, no lo mandes a empezar de nuevo». Se lee como amabilidad, no
como puerta.

**Y la prueba lo daba por bueno.** Decía *«confirmar dos veces no truena, solo
entra»* y verificaba que abriera sesión. Estaba escrita para confirmar la
intención del código en vez de para atacar el camino. Una prueba que solo
repite lo que el código quiso hacer no revisa nada.

**Arreglo:** el código se revisa primero, siempre. El «le dieron dos veces» se
resuelve con la verdad —el código es de un solo uso y el segundo intento recibe
«ese código no es»—, y la pantalla ya apaga el botón mientras la petición va en
camino. La prueba nueva hace el ataque completo con cinco variantes; al volver
a abrir el hueco se ponen rojas tres aserciones.

---

## 0-bis. Se podía plantar una contraseña en una cuenta ajena — TAPADO

Cualquiera pedía una cuenta con el correo de **otra persona** y una contraseña
suya. Nacía sin verificar y no abría, así que parecía inofensivo — al dueño
hasta se le escribe *«si no fuiste tú, no tienes que hacer nada: sin este
código la cuenta no se abre»*, y es verdad **mientras nadie la verifique**.

El otro lado era Google. Cuando el dueño de verdad entraba con su cuenta de
Google, se le marcaba la cuenta como verificada —bien— y **se le dejaba puesta
la contraseña del extraño**. Con eso, el extraño entraba a la cuenta ajena y
veía todos sus viajes.

Comprobado con el ataque completo, paso por paso.

**Arreglo:** una contraseña que solo existe en una cuenta **sin verificar** no
la puso nadie que haya demostrado ser dueño del buzón. Cuando alguien lo
demuestra por otra puerta, esa contraseña se tira. Al dueño de verdad no le
cuesta nada: entra con Google, o la repone en dos minutos con «olvidé mi
contraseña».

---

## 0-ter. Un permiso de «ver un viaje» valía como sesión de cuenta — TAPADO

Aquí conviven **dos permisos que se parecen y no valen lo mismo**:

| | Qué da | Cómo se consigue |
|---|---|---|
| **Liga** | ver **un** viaje | el código de 6 dígitos, que **el dueño le dicta a quien quiera** — así está pensado |
| **Cuenta** | todos sus viajes, sus datos, su contraseña | correo y contraseña, o Google |

Los dos usaban el **mismo campo** para el código y la **misma cookie** con el
mismo contenido. Nadie preguntaba de cuál de las dos venía el permiso. Así que
quien recibía el código dictado para ver un viaje se llevaba de pilón:

- **«Mis viajes» completo**, con ligas firmadas a todos los contratos —que
  siguen sirviendo semanas después de que la sesión venza—, y
- en una cuenta de **Google**, donde no hay contraseña anterior que pedir,
  **podía ponerle contraseña a la cuenta** y quedarse con ella para siempre.

No era un hueco de la cuenta ni de la liga: era que los dos permisos se veían
iguales.

**Arreglo:** el uso va **dentro del sello**, en la cookie y en el resumen del
código. Un permiso de liga no puede hacerse pasar por uno de cuenta porque **la
firma no cuadra**, no porque alguien se acuerde de comprobarlo.

> **Al desplegar esto, las sesiones de cuenta abiertas se caen.** Una cookie
> sin marca de uso se trata como la débil —falla cerrado— así que hay que
> volver a entrar. **Las ligas de los viajes no se tocan.**

---

## 0-quater. «Mándame otro código» delataba con un campo de más — TAPADO

`reenviar` devolvía `pista` solo cuando la cuenta existía sin verificar, y un
`429` con `segundos` al frenarse. Un correo sin cuenta recibía `{ok, mandado}`
a secas.

Es **exactamente** el defecto que el comentario del alta, treinta líneas más
arriba, dice que ya se había pagado una vez: *«un campo de diferencia bastaba
para saber si un correo ya estaba registrado»*. Se arregló allá y se escribió
igualito aquí.

Y encadenado con el alta daba un oráculo completo: se pide el alta y luego el
reenvío; si sale `pista`, ese correo **no** tenía cuenta; si no sale, es un
cliente que ya estaba. La lista entera, correo por correo.

**Arreglo:** la misma respuesta en todos los caminos, armada una sola vez, como
en `olvide`. Y su piso de tiempo.

---

## 1. El reloj decía si un correo tenía cuenta — TAPADO

Todo el sistema está escrito para que un correo registrado y uno inventado
contesten **exactamente lo mismo**: mismo estado, mismo mensaje, mismos
campos. Eso se cuidó desde el principio y hay pruebas que lo comparan campo
por campo.

Y aun así se podía sacar la lista de clientes de la empresa **sin leer una sola
respuesta**. Solo con un cronómetro:

| | correo CON cuenta | correo SIN cuenta | |
|---|---|---|---|
| `entrar` | 61.7 ms | 0.1 ms | **661 veces** |
| `olvide` | 187 ms | 31 ms | **6 veces** |

La causa de la primera es, irónicamente, la buena parte del diseño: `scrypt`
tarda ~60 ms **a propósito**, para encarecer la fuerza bruta. Pero solo corría
cuando la cuenta existía. La ausencia de esa espera era la respuesta.

### Cómo se tapó cada una

**`entrar`, con trabajo de verdad.** Cuando no hay cuenta se corre `scrypt`
igual, contra una sal fija que no protege nada. Sin retrasos falsos, y de paso
encarece cualquier barrido.

**`olvide`, con un piso de tiempo.** Ahí no se puede emparejar por arriba —no
se le manda un correo a nadie— así que se empareja por abajo: la respuesta
nunca sale antes de 1,200 ms, exista la cuenta o no. Vive en la cáscara
(`api/cuenta.js`), no en la lógica, igual que la cookie: es cuánto tarda la
*respuesta*, no qué decide el servidor.

### Medido después

| | con cuenta | sin cuenta |
|---|---|---|
| `entrar` | 102 ms | 103 ms |
| `olvide` | 1,203 ms | 1,203 ms |

`pruebas/probar-reloj.cjs` lo mide **pasando por el endpoint**, no por la
lógica, porque el piso vive ahí. Comprobado rompiéndolo: sin el arreglo de
`entrar` se ponen rojas 2 aserciones; sin el piso de `olvide`, otras 2.

### Lo que queda vivo, dicho de frente

Si Resend tuviera un día muy malo y tardara más de 1,200 ms, la diferencia
volvería a asomarse. Contra eso queda el tope de la puerta —4 por minuto, 150
al día por dirección— que es lo que de verdad impide barrer una lista larga.

---

## 2. Lo que se revisó y salió limpio

| Qué | Cómo está |
|---|---|
| **Cada puerta publicada tiene guardia** | las 11 de `/api` con guardia de origen; el webhook, con la firma de Stripe |
| **La cookie de sesión** | firmada con HMAC, `HttpOnly`, `Secure`, `SameSite=Lax`, 8 horas. El sello se comprueba **antes** de leer de quién es |
| **Dos cookies con el mismo nombre** | no se elige ninguna: ante una anomalía en un candado, no abrir |
| **CSRF** | doble candado: el guardia de origen rechaza sin `Origin`/`Referer` válido, y `SameSite=Lax` no manda la cookie en un POST ajeno |
| **Los viajes de otro** | filtrados en Stripe **y otra vez de este lado** |
| **Contraseñas** | `scrypt` con sal propia por cliente; sal nueva en cada cambio; nunca viajan de regreso ni se escriben en el registro |
| **Texto del cliente en la pantalla** | `textContent` o `esc()`; ningún dato ajeno entra crudo a `innerHTML` |
| **Registros del servidor** | ninguno escribe contraseñas, códigos, resúmenes ni llaves |
| **Papeles de Google** | firma, algoritmo, **destinatario** y `email_verified`; probado con papeles forjados |

### Lo que aprendí, y vale para todo lo que siga

**Los seis defectos tienen la misma forma:** el candado estaba bien puesto, y
había un camino que no pasaba por él. Ninguno se veía leyendo la función de
frente; todos salieron de preguntar *«¿y si llego por otro lado?»*.

Los tres más caros venían de lo mismo: **dos cosas parecidas que se trataron
como si fueran la misma.** Una cuenta verificada y una sin verificar. Un
permiso de ver un viaje y uno de entrar a la cuenta. Un código dictado a un
tercero y uno que prueba quién eres. En los tres casos el código las mezclaba
porque *funcionalmente* se parecen — y en seguridad lo que importa no es qué
hacen, sino **qué demostró quien las trae**.

**Y tres los tapaba una prueba que decía que todo estaba bien:**

| La prueba decía | Lo que estaba dando por bueno |
|---|---|
| «confirmar dos veces no truena, solo entra» | entrada libre a cualquier cuenta |
| «así que ya entra con su contraseña también» | la contraseña plantada por un extraño |
| «otro de inmediato se frena, y dice cuántos segundos» | el delator de quién tiene cuenta |

Las tres estaban escritas para **confirmar la intención del código** en vez de
para atacar el camino. Una prueba así hereda los puntos ciegos de lo que
prueba: si el código se equivocó de idea, la prueba se equivoca con él y
además da la tranquilidad de estar en verde.

**Las pruebas de seguridad se escriben desde el lado de quien ataca.** Por eso
las nuevas se llaman «con el correo de otro, NADA abre su sesión» y «la cookie
de LIGA no sirve como cuenta», y no «confirmar funciona».

---

## 3. Lo que NO se arregló, y por qué

### Cambiar la contraseña no cierra las sesiones abiertas en otros lados

Si alguien tiene la cuenta abierta en otro dispositivo y el dueño cambia su
contraseña, **esa sesión sigue viva hasta ocho horas.**

La sesión no se guarda en ningún lado: va firmada y se valida sola. Eso es lo
que permite no tener base de datos, y también lo que impide cancelarla.

**El arreglo, si algún día se quiere:** guardar un número de generación en la
ficha del cliente, meterlo en la sesión firmada, subirlo al cambiar la
contraseña, y compararlo en cada acción que use sesión. Cuesta una lectura más
a Stripe en `mis-viajes`, que hoy no la hace.

**Por qué no se hizo ahora:** toca el formato de la sesión —lo único que no
puede romperse— a cinco días de poner el dominio real, para cerrar una ventana
de ocho horas que hoy no tiene exposición: la página no es pública y hay una
sola cuenta. **Es una decisión, no un olvido.** Si el dueño prefiere cerrarla
antes de lanzar, se hace.

### Quien sepa un correo puede dejar a su dueño sin recuperar por un día

Doce códigos en 24 horas y después nada hasta el día siguiente. Es la regla 4
del proyecto —un candado que el atacante le puede cerrar a otro— y **se acepta
a sabiendas**: sin tope, el ataque es llenarle el buzón, que es peor. Los
códigos ya mandados siguen sirviendo, así que quien recibió uno de esos doce
todavía puede usarlo.

### `script-src` permite guiones en línea

Toda la página es un archivo con su JavaScript adentro, sin paso de
compilación. Quitar `'unsafe-inline'` obligaría a separarlo todo o a firmar
cada bloque. Es anterior a este trabajo y no se tocó.

---

## Lo que hay que volver a mirar el día del lanzamiento

1. **Verificar el dominio en Resend** — hoy ningún cliente real recibe nada.
2. **Los 5 eventos de Stripe en modo real** — si faltan, los reembolsos se
   vuelven a perder en silencio.
3. **Vercel a Pro** — el plan Hobby es de uso no comercial.
4. **`/api/contratos/reversa-externa` en EuroSystem** — hoy la reversa avisa
   pero no revierte.
