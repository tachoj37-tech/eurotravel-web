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

---

# Pasada con Snyk — 30-ago-2026

Pedida por el dueño: *«usa Snyk para darte una vuelta de vulnerabilidades de
seguridad en este proyecto, completo»*.

## Lo que Snyk sí escaneó

| escáner | resultado |
|---|---|
| **Dependencias (SCA)** | **0 problemas.** El proyecto no tiene ninguna dependencia ni lockfile: no hay cadena de suministro que atacar |
| **Infraestructura (IaC)** | No aplica — no hay Terraform, Kubernetes ni CloudFormation |
| **Código (SAST)** | **BLOQUEADO**: Snyk Code no está activado en su organización, y activarlo devuelve 403 — pide permisos de administrador que la sesión no tiene |

Como el escáner de código es justamente el que importa aquí —sin dependencias,
todo el riesgo vive en el JavaScript— se hizo la pasada a mano sobre las
mismas categorías.

## Lo que salió: el escapador de `index.html`

**Único hallazgo.** La página tenía **dos escapadores distintos sin saberlo**:

| | escapa |
|---|---|
| `viaje.html` | `& < > " '` |
| `index.html` | `& < >` — **sin comillas** |

Alcanza para texto entre etiquetas, pero varios de esos textos se pegan
**dentro de un atributo** (`alt="…"`, `src="…"`), y ahí una comilla se sale del
atributo aunque los signos de menor y mayor estén escapados. Y las tarjetas de
unidades no escapaban **nada**.

**Comprobado en el navegador, rojo y verde**, metiendo un nombre malicioso:

| | atributos que quedan en la imagen |
|---|---|
| escapador viejo | `alt`, **`onerror`**, **`x`**, `src` |
| escapador nuevo | `alt`, `src` |

**No había hueco abierto, y conviene decirlo con precisión:** esos datos salen
de archivos nuestros (`unidades.js`, `lugares.js`) y de Google Places. Ninguno
lo escribe un visitante. Pero el día que un nombre traiga comilla, o que alguno
de esos textos lo teclee una persona, sí lo habría.

## Lo que se revisó y está bien

| | |
|---|---|
| **Ejecución dinámica** | Ni `eval`, ni `new Function`, ni `child_process`. Los `exec(` que aparecen son expresiones regulares |
| **Archivos** | Cero lecturas o escrituras con ruta variable: no hay travesía de directorios posible |
| **Secretos** | Ninguno en el código ni en el historial de Git. Lo único que aparece es `sk_test_x`, un relleno de pruebas. Ningún `.env` comprometido |
| **Firma de Stripe** | HMAC-SHA256, `timingSafeEqual` y tolerancia de 5 minutos contra reenvíos |
| **Comparaciones** | 11 usos de comparación en tiempo constante, y **cero** secretos comparados con `===` |
| **Galleta de sesión** | `HttpOnly; Secure; SameSite=Lax; Path=/` con vencimiento |
| **Redirección abierta** | `sitioDe()` solo puede devolver una dirección de la lista blanca, nunca lo que mandó quien llamó. Importa el doble porque de ahí sale a dónde regresa Stripe al cliente después de pagar |
| **Aleatoriedad** | El folio usa `Math.random`, pero **no es una llave**: `pedir-codigo` exige la liga firmada. Lo que sí es secreto usa `crypto` |

## Lo que falta

**Activar Snyk Code**, que es cosa del dueño: app.snyk.io → Settings → Snyk
Code → encender. Vale la pena porque sería una revisión **independiente** del
código —no la mía sobre mi propio trabajo— y las partes de cuentas, cobros y
firmas son justo donde una segunda opinión pesa.

---

# Snyk Code — el escaneo de verdad, 30-ago-2026

El dueño activó Snyk Code y el escáner corrió sobre todo el proyecto.
**17 hallazgos.** Ninguno se dio por bueno sin comprobarlo: cada uno se
verificó leyendo el código, y los que parecían reales se probaron **en el
navegador** antes de tocar nada.

Veredicto: **2 reales, 1 mío encontrado al leer, 14 falsos positivos.**

## LO REAL · Redirección abierta en `viaje.html`

**Snyk tenía razón y yo me había equivocado.** En mi pasada a mano del mismo
día di por buena esta línea:

```js
location.replace(location.pathname);
```

Razoné que `pathname` es siempre del mismo sitio. **No lo es.** Probado en el
navegador con `https://sitio.com//malo.com/x`:

| | |
|---|---|
| `location.pathname` | `//malo.com/x` |
| a dónde iba | **`http://malo.com/x`** |

Bastaba mandarle a un cliente una liga con doble barra: al cerrar sesión —si la
red fallaba— salía de la página. Un buen anzuelo, porque el cliente cree que
sigue en Eurotravel.

### El primer arreglo NO alcanzó, y también se probó

Colapsé las barras del principio. Volví a probar con más trucos y **tres se le
saltaban igual**: `/\malo.com/x`, `\malo.com/x` y un tabulador en medio —el
navegador trata la barra invertida como barra normal.

El arreglo bueno no memoriza trucos: parte de `new URL(location.href)`, que ya
es una dirección absoluta de nuestro origen, y solo le quita la consulta. No
se puede mover de sitio por construcción. Comprobado contra los cuatro casos.

**Lección:** una lista negra de caracteres peligrosos siempre está incompleta.
Vale más partir de algo que ya es correcto que intentar limpiar lo sucio.

## LO MIO · La cookie que no se borraba

Leyendo esa misma función salió otra cosa. El comentario prometía:

> «Aunque falle la red, la cookie se borra del navegador»

Y no. `ev` es **HttpOnly** —la pone el servidor justo para que este script no
la pueda tocar—, así que `document.cookie = 'ev=; …'` no hacía nada. Se quitó:
más vale no prometer lo que no se cumple. Si la red falla, la sesión sigue
abierta del lado del servidor hasta que venza.

## ENDURECIDO · Las dos redirecciones que sí eran nuestras

Ninguna era un hueco —las dos direcciones las arma nuestro servidor— pero las
dos terminan en `location` con datos que vienen de la red:

| | qué se hizo |
|---|---|
| **La liga de «Mis viajes»** | se resuelve contra la dirección actual y se exige mismo origen |
| **La dirección de pago** | se exige que sea de `stripe.com` |

La de Stripe importa más de lo que parece: es **el único punto de la página que
manda al cliente fuera del sitio**, y es justo donde va a teclear su tarjeta.

## LOS 14 FALSOS POSITIVOS, y por qué

| cuántos | qué marcaba | por qué no lo es |
|---|---|---|
| **3 altos** | XSS en `viaje.html` | los tres pasan por `esc()`, que cubre `& < > " '`. Snyk sigue el flujo A TRAVES del escapador pero no lo reconoce por ser función propia |
| **1 medio** | XSS en el buscador de `index.html` | también escapa; el `data-i` es el índice del bucle, un número |
| **4 medios** | XSS en `prueba-cotizador.html` | herramienta interna tras una clave, y usa el escapador completo |
| **1 alto** | «secreto escrito en el código» en `_cuentas.js` | es `SAL_DE_RELLENO`, la sal falsa que iguala los tiempos cuando la cuenta NO existe. No protege nada porque no hay nada que proteger |
| **4 altos** | secretos en `pruebas/` | rellenos de prueba, no secretos de verdad |
| **1 bajo** | galleta sin `Secure` | era la línea que borraba la cookie, ya retirada |

## Lo que hay que saber para la próxima

**Snyk seguirá marcando 15.** Trece son los falsos positivos de arriba y dos
son el código ya arreglado, que Snyk no reconoce saneado. Vale la pena volver
a correrlo cuando se toque código nuevo, pero el número por sí solo no dice
nada: hay que mirar si aparece algo distinto de esta lista.
