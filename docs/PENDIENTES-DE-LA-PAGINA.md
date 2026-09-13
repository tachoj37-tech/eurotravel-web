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
| **3** | **Crear el proyecto de Supabase y correr `docs/ALMACEN.sql`**, y poner `ALMACEN_URL` y `ALMACEN_CLAVE` | Hoy **no se guarda ni una conversación ni un precio**. Cada día que pasa no deja nada que aprender | `npm run corte` deja de decir «faltan las llaves» |
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

| # | Qué | Tamaño |
|---|---|---|
| **A** | **El calendario en celular.** Cada día mide **36×34 px** y la guía de Apple y Google son **44×44** para algo que se toca con el dedo. El calendario abre bien y cabe (345 de 375), pero el día es un objetivo chico — y un dedazo ahí elige la fecha equivocada, que es el dato que más cuesta corregir después | chico, es CSS |
| **B** | **Auditoría B15:** escapar los valores en `pide()` de `_almacen.js` | chico |
| **C** | **Los 40 textos de seguimiento** de `_recordatorios.js` que ya no se usan con los toques de 22 h: dejarlos documentados como respaldo o quitarlos | decisión chica |

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
