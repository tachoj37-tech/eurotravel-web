# Revisión de seguridad — 27-ago-2026

Sobre el sistema de cuentas completo, recién terminado: crear, entrar, Google,
Mis viajes, Configuración y recuperar la contraseña.

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

### Lo que aprendí de la grave, y vale para todo lo que siga

Las tres cosas que encontró esta revisión —la entrada libre y los dos relojes—
tienen la misma forma: **el candado estaba bien puesto, y había un camino que
no pasaba por él.** Ninguna se veía leyendo la función de frente; las tres
salieron de preguntar «¿y si llego por otro lado?».

Y la más grave la tapaba una prueba que decía que todo estaba bien. Cuando una
prueba se escribe para confirmar lo que el código quiso hacer, hereda sus
puntos ciegos. **Las pruebas de seguridad se escriben desde el lado de quien
ataca**, y por eso las nuevas se llaman «con el correo de otro, NADA abre su
sesión» y no «confirmar funciona».

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
