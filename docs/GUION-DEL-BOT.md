# El guion del bot

Esto es lo que el bot **dice**, casilla por casilla.

## Qué está puesto y qué no (2-sep-2026)

| | |
|---|---|
| §3 · El precio con ancla por persona y comparación | ✅ puesto |
| §4 · Las cinco objeciones | ✅ puesto |
| §5 · Cierre con paso concreto | ✅ puesto |
| §6 · R52, el autobús no hace dominical | ✅ puesto |
| La ocasión: se detecta y cambia el discurso | ✅ puesto |
| §1 · El nombre del vendedor en vez de uno propio | ⬜ falta |
| §2 · El orden nuevo (destino primero) | ⬜ falta |
| §8 · Modo agencia | ⬜ falta |
| §9 · Seguimiento a 24 h / 3 d / 7 d | 🚫 **bloqueado** — necesita el WhatsApp real |

Lo puesto tiene su propia batería: **`pruebas/probar-venta.cjs`, 72
comprobaciones.** Vigila sobre todo que el bot no invente un número — ni el
por persona sin saber cuántos van, ni una comparación con un gasto que no
conocemos.

---

El bot de hoy (`bot.js`) es una máquina de estados: `pregunta()` da el texto de
cada casilla y `pasoDeCotizacion()` interpreta la respuesta. Este guion **no
cambia esa máquina**; cambia lo que dice y el orden de dos casillas.

---

## 0 · Lo que el bot nunca hace

Estas no se negocian. Cada una salió de algo que ya costó.

| No | Por qué |
|---|---|
| Inventar un precio | **R12** los precios los dicta el dueño · **R45** si no se sabe al 100 %, lo da una persona |
| Decir kilómetros, tarifa por km o por noche | Con el total y los km se despeja la tarifa. Lo cuida `api/_publico.js` |
| Mencionar el IVA | Se cobra igual; en conversación no se menciona |
| Inventar escasez | Solo **marzo, mayo y septiembre** son temporada alta |
| Decir algo de la empresa que no esté aquí | Ver §7 |
| Dar política de cancelación | La decide el vendedor, caso por caso |
| Bajar el precio | Nunca por su cuenta |
| Insistirle a quien ya dijo que no | Se despide y ya |

**La IA solo entra cuando el cliente se sale del guion, y nunca toca números.**
Es `api/_entender.js`, que hoy ya existe como último recurso.

---

## 1 · Cómo habla

- **No tiene nombre propio.** Se presenta con el nombre del vendedor que lo trae:
  *«Soy Ricardo de Eurotravel»*. Una sola vez, al principio.
- Tutea. Usa el nombre del cliente en cuanto lo tenga.
- **Máximo tres líneas por mensaje. Una sola pregunta.** Nunca dos.
- Un emoji como mucho, y no en todos los mensajes.
- Nunca dice «formulario», «captura», «proceso», «ticket». Dice **tu viaje**,
  **tu plan**, **tu fecha**.

---

## 2 · El orden, y por qué cambia

Hoy arranca preguntando **cuántos van**. El nuevo orden arranca por el
**destino**, porque el destino revela la ocasión y la ocasión es lo que permite
vender. Los datos que recoge son exactamente los mismos.

> **El costo de este cambio, dicho de frente:** un grupo de 45 contesta tres
> preguntas antes de enterarse de que su viaje lo cotiza una persona. Antes se
> enteraba a la primera. A cambio, los grupos que sí caben en Sprinter —que son
> los que la página cobra sola— llegan al precio con la conversación ya cálida.

### Paso 1 · Destino y ocasión

> **¡Hola! Soy [vendedor] de Eurotravel 🚐**
> **¿A dónde va el plan?**

Con la respuesta, clasifica la **ocasión** y contesta con una línea específica
—nunca genérica— antes de la siguiente pregunta.

| Destino | Ocasión que asume | Lo que contesta |
|---|---|---|
| Tequila, Amatitán, Guachimontones | Fiesta | «Buenísimo plan, esa ruta la hacemos cada fin. ¿Ya tienen fecha?» |
| Vallarta, Mazatlán, Manzanillo, Guayabitos, Cancún, Acapulco | Playa | «Va, playa. ¿Ya saben qué días?» |
| Talpa, San Juan de los Lagos | Peregrinación | «Talpa la conocemos bien, la hacemos cada año. ¿Para qué fecha?» |
| Chapala, Ajijic, Mazamitla, Tapalpa | Escapada | «Buen destino para desconectarse. ¿Qué días?» |
| CDMX, Puebla, Querétaro, Monterrey | Ciudad / empresa | «Perfecto. ¿Qué días serían?» |
| Cualquier otro | Neutro | «Va. ¿Ya tienen fecha?» |

**Palabras que mandan sobre el destino.** Si el cliente dice *boda*, *XV*,
*despedida*, *empresa*, *convivencia*, *escuela*, *graduación* o
*peregrinación*, esa es la ocasión, no la del destino. Una boda en Tequila es
una boda.

| Ocasión dicha | Lo que contesta |
|---|---|
| Boda / XV | «Felicidades 🎉 Tú dedícate al evento, de mover gente nos encargamos nosotros. ¿Qué día?» |
| Despedida | «Va, de esos viajes. ¿Ya tienen fecha?» |
| Empresa / convivencia | «Perfecto. ¿Para qué fecha la necesitan?» |
| Escuela / graduación | «Va. ¿Qué día sería?» |

### Paso 2 · Fecha de salida

> **¿Qué día salen? 📅**
> Escríbelo como quieras: *10 de septiembre*, *10/9* o *mañana*.

Si la fecha cae en **marzo, mayo o septiembre**, y solo entonces:

> **Ese mes se nos llena rápido, déjame checar disponibilidad.**

Fuera de esos tres meses **no dice nada de escasez.** Ni una palabra.

### Paso 3 · Regreso

> **¿Y qué día regresan?**

Si salida y regreso son el mismo día **y es domingo**, entra la regla del
dominical (§6).

### Paso 4 · Cuántos van

> **¿Como cuántos van?**
> Un número aproximado me basta.

Con el número **recomienda**, no pregunta. Nunca dice «¿qué unidad prefieres?».

| Van | Qué dice |
|---|---|
| Hasta 6 | «Para [n] la Suburban les queda cómoda, es ejecutiva y con asientos de piel. ¿O prefieren la Sprinter?» |
| 7 a 20 | «Para [n] la Sprinter les queda perfecta: van cómodos y sobra lugar para las hieleras.» |
| 21 a 24 | «Van [n] y la Sprinter es de 20. ¿Se acomodan en 20 o le buscamos otra unidad?» |
| 25 a 45 | **Las dos opciones** — ver abajo |
| 46 en adelante | «Para [n] va autobús. Te lo cotiza un vendedor porque el precio depende de la unidad.» |

**De 25 a 45**, textual:

> **Para [n] tienes dos caminos:**
> **• Un autobús — van holgados, con baño y aire.**
> **• Dos Sprinters — dos unidades, dos choferes.**
> **¿Cuál te late?**

Si el cliente pide otra unidad, **se respeta sin discutir.**

### Paso 5 · De dónde salen

> **¿De dónde salen?**
> · Guadalajara · Tlaquepaque · Otro lugar

### Paso 6 · Recorridos allá

Reencuadrado como servicio, no como pregunta técnica:

> **Ya estando allá, ¿la unidad se queda estacionada o quieren que los mueva
> —a cenar, a un tour, a otra playa?**

Si es destino de playa, antes de preguntar los días mete el beneficio:

> **El chofer se queda con ustedes hasta 3 noches sin costo extra.**

Las casillas de `paseo`, `lejos` y `horas` se quedan como están hoy. Ya
funcionan y no venden ni desvenden.

### Paso 7 · Confirmar

> **Déjame confirmar 👇**
> [resumen]
> **¿Todo bien?**

---

## 3 · Cómo se da el precio

**El precio jamás va desnudo.** Siempre estas cinco piezas, en un solo mensaje:

1. El total.
2. **Cuánto sale por persona.**
3. Qué incluye.
4. **Una** comparación con la alternativa real, según la ocasión.
5. El siguiente paso, en pregunta.

**Ejemplo — Tequila, 16 personas, viaje redondo:**

> Tu viaje redondo a Tequila en Sprinter queda en **$12,800**.
> Entre los 16 son **$800 por persona**, con chofer, casetas y gasolina.
> Menos de lo que gastan en 4 coches, y nadie se queda sin tomar.
> **¿Te aparto la fecha?**

**Ejemplo — Vallarta, 18 personas, 4 días:**

> Tu Sprinter a Vallarta, ida y vuelta, queda en **$[total]**.
> Son **$[x] por persona**, y el chofer se queda los 3 días con ustedes sin
> costo extra.
> Llegan juntos y descansados, en vez de 5 horas cada quien manejando.
> **¿Les aparto la fecha?**

**La comparación, por ocasión:**

| Ocasión | La línea |
|---|---|
| Fiesta | «…y nadie se queda sin tomar.» |
| Playa | «Llegan juntos y descansados, en vez de 5 horas cada quien manejando.» |
| Boda / XV | «Tus invitados llegan puntuales y tú no andas de valet.» |
| Empresa | «Todos llegan a la misma hora, y va con factura.» |
| Peregrinación | «Van todos juntos y el chofer conoce la ruta.» |
| Escapada | «Llegan juntos y nadie maneja de regreso.» |

**Si el viaje no se cotiza solo** (autobús, Suburban, o **R45** arriba de
1,400 km sin precio de lista), no hay número que envolver:

> Ya tengo tu viaje completo. Éste te lo cotiza [vendedor] directo, porque el
> precio depende de la unidad. **Te contesta hoy mismo.**
> [resumen para el vendedor]

**Nunca lo deja en silencio.** Si el vendedor tarda, a los 10 minutos:

> **Sigo con tu cotización, ya casi.**

---

## 4 · Objeciones

Nunca se pone a la defensiva. Nunca baja el precio. **Siempre termina en
pregunta.**

**«Está caro» / «es mucho»**
> Te lo pongo por persona: son **$[x]** cada uno, con chofer, casetas y
> gasolina.
> **¿Contra qué lo estás comparando? Te ayudo a ver si de verdad te sale
> mejor.**

**«Déjame preguntarle al grupo»** — *la objeción número uno de este negocio.*
No se combate: **se facilita.**
> Claro. Te mando un resumen que puedas reenviar tal cual 👇
>
> [mensaje limpio y reenviable: destino, fecha, unidad, precio por persona, qué
> incluye. Sin links raros, sin «soy un bot».]
>
> **¿Cuándo crees tener respuesta? Te escribo ese día.**

**«Otro me lo da más barato»** — sin descalificar a nadie.
> Puede ser. Nomás checa que incluya casetas, chofer y que la unidad traiga
> seguro de viajero; ahí suele estar la diferencia.
> **¿Quieres que te lo desglose?**

**«Nunca he rentado, no sé cómo funciona»**
> Es fácil: apartas tu fecha, te llega tu contrato al correo y al celular, y el
> resto lo liquidas antes del viaje.
> **¿Te lo armo?**

**«¿Y si se cancelan varios?» / «¿si cancelo?»**
> Eso lo ve [vendedor] contigo directo, según tu caso.
> **¿Te lo paso?**

**«¿Es seguro?»**
> Todas nuestras unidades traen **seguro de viajero**.
> **¿Qué más te gustaría saber?**

---

## 5 · El cierre

- **Todo mensaje después del precio termina en un paso concreto.** Nunca «quedo
  a tus órdenes». Siempre *«¿te aparto la fecha?»*, *«¿te mando el link?»*,
  *«¿a qué correo te mando el contrato?»*.
- El anticipo **se llama «apartar la fecha»**, nunca «pagar».
- Cuando dice que sí, **pasa de inmediato** a pedir los datos del contrato —uno
  por uno— y manda el link. Sin celebrar de más.

**R51 · El anticipo es el 20 % del total, redondeado hacia arriba al medio
millar.** Si cae justo en un medio millar, ahí se queda.

| Total | 20 % | Se apartan con |
|---|---|---|
| $10,000 | $2,000 | **$2,000** |
| $12,800 | $2,560 | **$3,000** |
| $21,700 | $4,340 | **$4,500** |
| $26,000 | $5,200 | **$5,500** |

> **El bot ya no dice «el 20 %»,** porque deja de serlo: $3,000 de $12,800 es
> 23 %. Dice **«apartas con $3,000»** y ya.

---

## 6 · R52 · El autobús no hace dominical

Un autobús **no puede** hacer ida y vuelta el mismo domingo. Si el grupo
necesita autobús y pide eso:

> Para ese día en autobús no tenemos servicio de ida y vuelta el mismo domingo.
> **Dos opciones: lo hacemos sábado, o se quedan a dormir y regresan el lunes.**
> ¿Cuál te sirve?

Si caben en Sprinter, ofrece la tercera:

> **O nos vamos en Sprinter, que sí lo hace el domingo.**

`api/_tarifa.js:278` ya impide que un autobús agarre **precio** dominical. Lo
que falta es que el bot **no lo ofrezca**.

---

## 7 · Lo único que el bot puede decir de la empresa

Sale de la página oficial (`eurotravel.com.mx`), verificado el 2-sep-2026:

- **Todas las unidades traen seguro de viajero.**
- Sprinter: 20 pasajeros, aire, pantalla, asientos reclinables, espacio para
  equipaje.
- Irizar i6S: 51 pasajeros, aire, baño, 2 puertas, reclinables con
  descansapiés.
- Neobus: 50 pasajeros, aire, baño, pantallas, cafetera, hielera y **puerto USB
  en cada asiento**.
- Suburban: ejecutiva, asientos de piel, wifi, 2 pantallas táctiles, USB.

**Todo lo demás está prohibido** hasta que el dueño lo dé por escrito: años
operando, número de unidades, permisos, cuántos grupos al mes, cualquier
testimonio.

> **Pendiente:** el sitio dice que el **Irizar i6 y el PB son de 47**, y
> `unidades.js` dice «47 a 51». Y el sitio tiene un **Irizar i6 AM (amarillo,
> 47 pasajeros, 1 puerta)** que no está en el catálogo. Hasta que el dueño
> decida, el bot **no promete 51 en i6 ni en PB**.

---

## 8 · Modo agencia

Muchos clientes son agencias que revenden. **Es otro comprador:** no le vendes
emoción, le vendes que nunca le quedes mal frente a *su* cliente.

### Cómo lo detecta — nunca preguntando

Un buen vendedor no pregunta «¿eres agencia?». Se da cuenta.

**Señales de agencia** (con una basta):
- Vocabulario: *pax*, *tarifa neta*, *neto*, *comisión*, *mi pasajero*, *mi
  cliente*, *operadora*, *cupo*, *servicio*, *cotízame*.
- Manda **todos** los datos en un solo mensaje, ordenados.
- Pide varias cotizaciones o varias fechas de un jalón.
- Pide factura, seguro o permiso **antes** que el precio.
- Habla de los viajeros en tercera persona: *«ellos salen»*, *«el grupo llega»*.

**Señales de particular:**
- Primera persona plural: *vamos*, *somos*, *queremos*.
- Menciona la ocasión: cumpleaños, boda, mis amigos, la familia.
- Pregunta cómo funciona.

**Sin señal clara, no pregunta.** Arranca en tono neutro —sin comparar con
coches, sin emoción cargada— y cambia de modo en silencio en cuanto aparezca
una. Si de plano necesita saberlo:

> **¿Tú también vas en el viaje?**

El particular dice «sí, claro». La agencia dice «no, es para un grupo que
tengo». Nunca *«¿es para ti o para un cliente?»*, nunca *«¿eres agencia?»*.

### Cómo se porta en modo agencia

- **Cero discurso emocional.** Cero precio por persona. Cero comparación con
  coches.
- De colega a colega: profesional, directo, breve. Cálido pero sin adorno.
- **Acepta todos los datos en un solo mensaje** y no los vuelve a preguntar uno
  por uno.
- Contesta en **ficha reenviable**: unidad, capacidad, servicio, qué incluye,
  precio, vigencia, condiciones de anticipo.
- Ofrece de entrada lo que la agencia necesita para cerrar: fotos reales de la
  unidad, seguro de viajero, factura.
- **Prioridad:** las agencias pasan al vendedor humano más rápido que nadie.

**Tarifa de agencia:** *pendiente de que el dueño la defina.* Mientras tanto el
bot da **precio público** y ofrece:

> Si manejan volumen, te paso con [vendedor] para ver condiciones de agencia.

### Objeciones de agencia

**«Otro proveedor me da mejor tarifa»**
> Entiendo. Lo que te garantizo es que la unidad llega y **tú no recibes el
> reclamo**. Si el volumen lo justifica, hablamos de condiciones.

**«Necesito la cotización ya»**
> Se contesta en el momento con lo que haya, y se marca urgente al vendedor.

---

## 9 · Seguimiento — bloqueado, y por qué

El documento pide seguimiento a **24 h, 3 días y 7 días**. Es de lo mejor que
trae, y **hoy no se puede**:

- El webhook real de WhatsApp está en `pendiente/` porque el plan Hobby de
  Vercel solo deja **12 funciones** y no cabe.
- En el chat de la página **no hay a dónde escribirle** a alguien después: si
  cierra la pestaña, se acabó.
- Los mensajes que arrancan una conversación en WhatsApp necesitan **plantillas
  aprobadas por Meta**.

Cuando el WhatsApp real esté en pie, el guion queda listo:

| Cuándo | Qué dice |
|---|---|
| 24 h | «Hola [nombre], ¿qué dijo el grupo del viaje a [destino]? Sigue disponible la fecha.» |
| 3 días | Valor, no presión: un tip del destino, o la foto de la unidad que les tocaría. |
| 7 días | «Te dejo de dar lata, [nombre]. Si retoman el plan aquí estoy.» |
| Agencia | **Uno solo**, a las 24 h. A una agencia no se le da lata. |

Máximo tres. Después, silencio.

---

Relacionado: `docs/CRITERIO-DE-PRECIOS.md` · `cerebro/el-bot.md` · `bot.js`
