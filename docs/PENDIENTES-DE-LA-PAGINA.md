# Pendientes de la página · 13-sep-2026

Lista para ir resolviendo **de uno en uno**, como lo pidió el dueño. Cada
renglón dice **quién** lo hace y **cómo se comprueba** que quedó — sin eso, un
pendiente se da por cerrado sin estarlo.

> La lista larga del bot vive aparte, en `docs/PENDIENTES.md` (7-sep). Ésta es
> solo lo que toca a la página y a lo que se construyó el 12 y 13 de sep.

---

## ~~Primero: lo que está construido y apagado~~ · SUBIDO EL 13-SEP

**Ya está en producción.** El dueño dijo «sube los commits y asegúrate que
todo esté correcto», y los seis entraron a `main` en avance limpio
(`6997431..4d48b20`).

Vercel desplegó `dpl_GrYxiRSFJ18mWYkxkJBHLGJP6jFo`: SHA `4d48b20`, rama `main`,
estado **READY**, `aliasError: null`, y **12 funciones**
(`lambdaRuntimeStats: {"nodejs":12}` — lo dice Vercel, no yo).

Comprobado en `eurotravel-web.vercel.app`, en vivo:

| | |
|---|---|
| `COTIZACION.PAGINA_DA_PRECIOS` | `false` |
| La Sprinter cotiza en línea | `false` |
| `/api/cotizar` · Vallarta | `requiereAsesor: true · total 0 · anticipo 0` |
| Con `sinPrecio:false` en el cuerpo | sigue en `total 0` |
| Los dos `meta` | corregidos |
| Frases que prometían precio, en texto visible | **cero** |
| Cifras en pesos en pantalla | **ninguna** |
| Botones de pago | **cero** |
| Errores de consola | **cero** |

Y el recorrido completo del cliente, en producción: Guadalajara → Puerto
Vallarta con Sprinter, sin precio, caja de captura, acuse, y el botón verde con
el mensaje exacto al WhatsApp **no al teléfono**.

---

## Lo que necesito de ti

| # | Qué | Por qué urge | Cómo se comprueba |
|---|---|---|---|
| ~~**1**~~ | ~~Decir si subo los commits~~ | **HECHO el 13-sep.** Ver arriba | ✅ |
| **2** | **Confirmar que te LLEGÓ el correo de prueba** | Ver la nota de abajo: el servidor dice que salió, pero eso no es que haya llegado | Buscar en tu correo «PRUEBA DEL SISTEMA» |
| ~~**3**~~ | ~~Conectar el almacén~~ | **HECHO el 13-sep.** A las 21:00 UTC el recordatorio leyó `fichas` en eurotravel-almacen con la llave `sb_secret_`, 200 en 289 ms. **Falta ver que guarde**: desde el 11-sep 18:29 (GDL) no ha entrado ni un mensaje de WhatsApp al bot — mandarle uno de prueba. Y las llaves viejas SÍ conectaban a ratos: había otro almacén, con al menos el cliente del 11-sep | ✅ lee · ⏳ guarda |
| **4** | **`eurotravel.com.mx`: ¿se muda o no?** | Comprobado el 13-sep: ese dominio sirve un **WordPress**, no esta página. Y en Vercel el proyecto solo tiene los tres dominios `.vercel.app` | El dominio aparece en la lista del proyecto y abre esta página |
| **5** | **Que el bot deje de cotizar la Sprinter** | Dijiste «ningún precio para nadie» incluyendo el bot. Es un renglón en `unidades.js`, pero mueve 100+ aserciones de las pruebas del bot: le toca a su rama | El bot contesta con ficha armada en vez de precio |
| **6** | **Cambio de fecha: ¿hay política?** | Hoy el bot te pasa al cliente sin explicar nada | Si dictas una, se escribe en el criterio |
| **7** | **Las dos puertas de EuroSystem** (registrar abono y revertirlo) | Es el paso 4 de los abonos. Sin la de revertir, el sistema enseñaría dinero que ya no existe | Aparecen en `CONTRATOS-API.md` |
| **8** | **`charge.refunded` y `charge.dispute.created` en Stripe** | Sin eso un contracargo pasa sin que nadie se entere | Llegan al webhook |
| **9** | **Verificar `eurotravel.com.mx` en Resend** | Hoy los correos salen con el remitente de prueba | El correo llega desde el dominio bueno |

### Sobre el #2: el correo al vendedor, medio cerrado

Con R47 en producción, **todas** las cotizaciones salen por ese correo. Era el
riesgo más grande del día, así que se probó: se mandaron **dos solicitudes de
prueba** desde producción, las dos marcadas «PRUEBA DEL SISTEMA (no es un
cliente)» y con el teléfono `3300000000`, que no es de nadie.

Las dos contestaron **`conVendedor: true`**. O sea que `RESEND_API_KEY` está
puesta, `AVISOS_A` apunta a algún lado, y Resend aceptó el correo.

**Lo que eso NO prueba:** que haya llegado a tu bandeja. Podría estar en spam,
o `AVISOS_A` podría apuntar a una dirección válida pero equivocada. Búscalas en
tu correo y con eso se cierra del todo.

---

## Lo mío

| # | Qué | Estado |
|---|---|---|
| ~~**A**~~ | ~~El calendario en celular, 36×34 contra los 44×44 de la guía~~ | **HECHO el 13-sep.** Y de paso salió que el botón flotante **se comía un día**: el toque en el centro del 6 lo recibía el botón verde, o sea que el cliente tocaba un domingo y le abría WhatsApp |
| ~~**B**~~ | ~~Auditoría B15: escapar los valores en `pide()`~~ | **HECHO el 13-sep**, antes de encender el almacén |
| ~~**C**~~ | ~~Los 40 textos de seguimiento que «ya no se usan»~~ | **REVISADO el 13-sep, y la nota estaba mal.** Ver abajo |

### La lista de precios por autorizar (13-sep, noche)

Dictado del dueño: autoriza **diciéndoselo a Claude**; se propone con **tres
clientes distintos**; con el precio **más reciente**; y **«EL PRECIO NO
DEBERIA SALIR SOLO TODAVIA»**.

- `npm run precios:cerebro` escribe ahora también `docs/PRECIOS-POR-AUTORIZAR.md`:
  listos, los que les falta poco, y los autorizados que después se cobraron
  distinto. Con lo que había calculado el motor al lado.
- Lo autorizado se apunta en `api/_precios-autorizados.js`, con fecha y frase.
  **Nadie del lado del cliente lo lee**, y `probar-por-autorizar.mjs` se pone
  roja si alguien lo engancha (comprobado en rojo y en verde).
- Que salga al público es otra decisión, aparte, y no está escrita.

### Sobre la C: no eran cuarenta sin usar, eran diez — y no se borran

La nota decía que los 40 textos de `_recordatorios.js` ya no se usaban. **No es
cierto.** `A_LAS_HORAS` son `[22, 72, 168]` y los tres toques existen, así que
**treinta** de ellos salen en cada recordatorio que se manda.

Los únicos sin alcanzar son los **diez** de `SETENTA_Y_DOS_CON_CALENDARIO` —los
que dicen «tu fecha sigue libre»— porque piden `fechaLibre: true` y los dos
sitios de `whatsapp.mjs` pasan `false`.

Y eso **no es olvido**: el propio código lo dice, *«nadie comprobó el calendario
aquí»*. La regla 4 de ese módulo es que la escasez tiene que ser cierta, y
afirmar que una fecha está libre sin haberlo visto es justo lo que no se vale.

**Por eso no se borran: la consulta que falta ya existe.** `disponibilidadDe()`
vive en el mismo archivo, le pregunta a EuroSystem y contesta `{ libres, total }`.
Están a una llamada de servir, no muertos — borrarlos sería tirar trabajo que ya
tiene su fuente de datos puesta.

> **Queda como una decisión tuya, no como deuda:** ¿enganchamos `fechaLibre` a
> la disponibilidad, para que el tercer toque pueda decir «tu fecha sigue
> libre» cuando de verdad lo esté? Es una llamada, pero **cambia lo que le
> llega a un cliente**, y por eso no lo hice solo. Necesita
> `DISPONIBILIDAD_API_KEY` en Vercel.

Mientras tanto quedó guardado por los dos lados en `probar-recordatorios.cjs`:
si alguien engancha `fechaLibre`, comprueba que los diez funcionan; y si alguien
los borra creyéndolos muertos, se entera ahí.

---

## Decidido, para no volver a preguntarlo

- **Un precio aprendido NO sale solo a la página.** Entra a una tanda que él
  revisa, como la compuerta del dueño (dictado del 12-sep: «sí justo»).
- **El corte es cada quince días**, no cada mes: el almacén purga a los 45 y
  con quince se pueden saltar dos sin perder nada.
- **Las conversaciones no entran a Git.** Sube la lección, no la conversación.

---

## Salió de verificar, y conviene confirmarlo

**El equipo EURO está en plan `pro`, no Hobby.** El tope de **12 funciones**
—que es lo que obligó a meter la solicitud y el abono DENTRO de `cotizar.js` y
`viaje.js` en vez de darles su propio archivo— es un límite del plan Hobby.
Si el equipo ya es Pro, ese techo probablemente no aplica.

No cambia nada de lo hecho —menos puertas públicas sigue siendo mejor— pero
**conviene confirmarlo antes de la próxima función**, porque hoy se está
diseñando alrededor de un límite que quizá ya no existe.

---

## Lo que NO se ha podido verificar, y por qué

Escrito aquí para que nadie lo dé por bueno:

- **Las variables de Vercel.** La herramienta de Vercel no expone sus valores
  —y hace bien—. Que el almacén no exista se deduce de que los dos archivos
  que escribe `npm run precios:cerebro` nunca se han generado, más lo que
  dicen los documentos. **No es prueba.**
- **`/api/pagar` con Stripe de verdad.** Probado con el Stripe fingido del
  proyecto. No se toca el real: abriría una sesión de cobro.
- **Que el mensaje de WhatsApp llegue.** Está verificado el enlace y su
  contenido exacto, no la entrega. Eso necesita un teléfono.
- **El corte contra datos reales.** Imposible hoy: no hay almacén. Solo
  probado con renglones de mentiras.
