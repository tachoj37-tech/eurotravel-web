# Auditoría de textos del bot — Fase 0 (reconocimiento)

**Fecha:** 5-sep-2026 · **Estado:** solo lectura. No se cambió nada. No se propone nada todavía.

Este documento es el **contrato** de la auditoría: el mapa de flujo de la sección 2 es lo que
NO se toca; el inventario de la sección 3 es sobre lo que se va a trabajar.

---

## 1 · Dónde viven los textos que el cliente lee

| Archivo | Qué contiene | Textos al cliente |
|---|---|---|
| `bot.js` (3,628 líneas) | El guion completo: saludo, captura, recomendación de unidad, precio, objeciones, fotos, «qué incluye», cierre, entrega a persona | **~95** |
| `api/_datos-contrato.js` | La etapa de datos del contrato: qué se pide, acuses, resumen | **9** |
| `api/_recordatorios.js` | Seguimientos automáticos a 1 h, 24 h y 72 h (cuatro bolsas con 10 variantes cada una) | **40** |
| `api/_whatsapp-webhook.js` | Acuse de comprobante, ficha bancaria, CLABE | **4** |
| `api/whatsapp.mjs` | Pie de foto de la unidad al dar precio | **1** |
| `api/_entender.js` | **System prompt de la IA** (Haiku 4.5). La IA casi nunca redacta: extrae datos. Puede devolver `respuesta` de ≤240 caracteres solo cuando el guion no tiene nada mejor | 1 (prompt) |
| `api/_tickets.js` | Tickets, tablero, `ver`, espejo — **al dueño, no al cliente**. Fuera de alcance | 0 |

Los botones (`opciones`) van en el mismo objeto que cada texto; se inventarían junto a él.

---

## 2 · Mapa del flujo actual (el contrato — nada de esto se toca)

Cada mensaje del cliente pasa por este orden. `paso` es el hueco que el bot está llenando.

```
 0. ENTRADA
    0.1 Si escribe el DUEÑO → comandos (tablero, ver) o reenvío al cliente. Fuera de alcance.
    0.2 Si pide FOTOS a media cotización → fotos + se repite la pregunta pendiente. No cambia paso.
    0.3 Si hay cotización en curso (estado.paso) → va al paso (bloque 2). Si no → bloque 3.

 1. HUECOS, en este orden fijo (alSiguienteHueco):
    destino → salida → regreso → cuantos → [elegirBus si es autobús] → origen →
    [recorridos → paseo/lejos/horas, solo si el viaje es de 2+ días] → confirmar

 2. PASOS (pasoDeCotizacion) — qué guarda cada uno y qué pasa si no lee:
    2.1 destino    guarda destino y ocasión; lee de un jalón gente/fecha/unidad/origen si vienen.
                   Si no lee → re-pregunta variada + noEntendio (la IA intenta).
    2.2 salida     guarda salida. Si no lee: absorbe lo demás de la frase; si nada → re-pregunta + IA.
    2.3 regreso    guarda regreso (acepta «mismo día»). Igual que salida. Rechaza regreso < salida.
                   Autobús solo ida y vuelta mismo día → se detiene y explica.
    2.4 cuantos    guarda gente → recomienda unidad (Sprinter ≤20 / Suburban / autobús / dos unidades).
    2.5 elegirBus  lista los autobuses que le caben (Premium→Turismo→Clásico) y guarda unidadNombre.
    2.6 elegirChica / ajustar   Sprinter o Suburban / «¿se acomodan en 20?».
    2.7 origen     Guadalajara u otro; origenLibre pide la ciudad.
    2.8 recorridos → paseo (si el destino tiene) → lejos → horas.
    2.9 confirmar  muestra resumen. «Sí» →
          · Sprinter: `cotiza` → la cáscara llama a /api/cotizar → PRECIO (3.6) → foto de la unidad.
          · Autobús / Suburban: `solicitud` + pasa:true → TICKET al dueño; al cliente se le da
            la solicitud armada y se le dice que le pasan el precio.
    2.10 cambiar   «¿Qué cambiamos?» y regresa al hueco.
    2.11 cancelar  en cualquier paso: «Listo, lo dejamos ahí».

 3. SIN COTIZACIÓN EN CURSO (respuestaBase), en este orden de prioridad:
    3.1 pide persona → PASA (teléfono + «o dime a dónde van»)  [pasa:true → aviso al dueño]
    3.2 ¿cómo pago? / quiero apartar → pideDatosBancarios → ficha bancaria + CLABE (webhook)
    3.3 lee de un jalón («somos 45 a vallarta el 20») → arranca cotización con lo leído
    3.4 fotos → 3 fotos + video + «¿te saco el precio?»
    3.5 objeciones: caro / preguntarle al grupo / más barato / agencia / lo pienso /
        nunca he rentado / cancelación
    3.6 precio (textoDeCotizacion): unidad, ruta, fechas, días, recorridos, total,
        por persona, «incluye…», comparación por ocasión, cierre con anticipo y nombre
    3.7 unidades / qué incluye / cuántos caben
    3.8 saludo → «¿A dónde van?» (paso: destino)
    3.9 despedida («gracias», «ok»)
    3.10 se rinde → «Déjame checarte eso bien tantito» + pasa:true + noEntendio
        (la cáscara llama a la IA; si la IA saca algo, se manda ESO y no lo de arriba)

 4. DESPUÉS DEL SÍ AL APARTADO
    4.1 Ficha bancaria (imagen) + CLABE sola (para copiar).
    4.2 Llega comprobante (foto/documento) → acuse + se piden los DATOS DEL CONTRATO
        (nombre · teléfono opcional · dirección y hora de salida · dirección y hora de regreso).
        Aquí la IA entra SIEMPRE (lee párrafos). Acuse por dato, «falta:», y «con eso tengo todo».
    4.3 El pago lo confirma una persona; el bot no lo confirma.

 5. SEGUIMIENTOS AUTOMÁTICOS (solo tras dar precio y sin respuesta)
    1 h → 24 h → 72 h (con o sin fecha). Variante por número de cliente. Se apagan si contesta.

 6. IA (Haiku 4.5) — cuándo entra
    · Extrae datos cuando el guion no lee (noEntendio), en cualquier paso y al inicio.
    · A media plática se PEGA al estado (continuaCon); sin plática arma una (aplicaEntendido).
    · Siempre en datos del contrato. Nunca decide precios ni unidades. Tope 300/día.
```

---

## 3 · Inventario de textos que ve el cliente

Categorías: **GEN** genérico · **FORM** formulario · **ROBOT** · **CEDE** cede control · **PRECIO** precio desnudo ·
**PREG** pregunta prohibida · **INT** revela interno · **SINC** sin cierre · **FRÍO** · **OK**.

Los textos con `+` en el código están unidos aquí tal como los lee el cliente. `{x}` = variable.

### 3.1 Apertura y saludos

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-001 | bot.js:2690 `saludo()` sin vendedor, 3 variantes | Apertura | «¡Hola! Gracias por escribir a *Eurotravel* 🚐 / Rentamos camionetas y autobuses con chofer, para grupos.» · «¡Qué tal! Estás con *Eurotravel* 🚐 / Camionetas y autobuses con chofer para tu grupo.» · «Hola 🚐 Aquí en *Eurotravel* rentamos Sprinters y autobuses con chofer, para grupos.» — seguido siempre de «¿A dónde van? Con eso te saco el precio.» | FRÍO (sin nombre propio: `VENDEDOR` está vacío) |
| T-002 | bot.js:2690 `saludo()` con vendedor, 3 variantes | Apertura | «¡Hola! Soy *{VENDEDOR}*, de *Eurotravel* 🚐 …» · «¡Qué tal! Te atiende *{VENDEDOR}* …» · «Hola, soy *{VENDEDOR}* 🚐 Aquí en *Eurotravel* …» | OK (no activo: `VENDEDOR` sin valor → `{{PENDIENTE_NOMBRE_BOT}}`) |
| T-003 | bot.js:3183 | Apertura («información», «informes») | «Con gusto 🚐 ¿A dónde va el plan?» | OK |
| T-004 | bot.js:3091 | Reactivación («sí, vamos») | «¡Va! 🚐 ¿A dónde van y qué día?» | ROBOT (dos preguntas) |
| T-005 | bot.js:3372 | Despedida | «¡Con gusto! Aquí andamos para lo que necesites 🚌» | CEDE, SINC |

### 3.2 Captura — preguntas de cada hueco (`pregunta()`)

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-010 | bot.js:1537 | destino | «¿A dónde van? 📍» | FRÍO |
| T-011 | bot.js:1547 | salida | «¿Qué día salen? 📅 / Escríbelo como quieras: *10 de septiembre*, *10/9* o *mañana*.» | OK |
| T-012 | bot.js:1552 | regreso | «¿Y qué día regresan?» | FRÍO |
| T-013 | bot.js:1478 | cuantos (con piso) | «¿Como cuántos van? 🤔 / Con el número te digo qué unidad les conviene — no es lo mismo un grupo de {piso+5} que de {piso×2}.» | OK |
| T-014 | bot.js:1478 | cuantos (sin piso) | «¿Como cuántos van? / Un número aproximado me basta.» | FRÍO |
| T-015 | bot.js:1503 | elegirBus | «¿En cuál los acomodo? 🚌 / *{unidad}* — {cap} · modelo {año} / {categoría}. {amenidades}.» (una por autobús que le cabe) | PREG (pregunta la unidad en vez de recomendar) |
| T-016 | bot.js:1894 | elegirBus, no leyó | «¿Cuál de esos te late? 🚌» | PREG, ROBOT |
| T-017 | bot.js:1519 | elegirChica | «¿La Sprinter o la Suburban?» | PREG, FRÍO |
| T-018 | bot.js:1524 | ajustar | «¿Se acomodan en 20?» | FRÍO |
| T-019 | bot.js:1540 | origen | «¿De dónde salen?» + botones («Guadalajara», «Otro») | FORM |
| T-020 | bot.js:1544 / 2049 | origenLibre | «¿De qué ciudad salen?» | FORM |
| T-021 | bot.js:1576 | recorridos | «El operador se queda con ustedes todo el viaje 🚐 / …¿cuántos días quieren que los mueva por allá?» + botones | OK |
| T-022 | bot.js:1584 | paseo | «En *{destino}* tenemos estos paseos 👇 / …» + botones | OK |
| T-023 | bot.js:1595 | lejos | «Esos recorridos, ¿son por la zona o se van lejos? / …» | FRÍO |
| T-024 | bot.js:1613 / 2240 | horas | «¿Tú qué dices, cuántas horas al día les alcanza?» | PREG (pide opinión, no consejo) |
| T-025 | bot.js:1618 | confirmar | «Déjame confirmar 👇 / {resumen} / ¿Todo bien?» + botones | FORM |
| T-026 | bot.js:1623 | cambiar | «¿Qué cambiamos?» | FRÍO |

### 3.3 Acuses entre pregunta y pregunta

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-030 | bot.js:1178 `ACUSE_DE_OCASION` | tras destino | fiesta: «Buenísimo plan, esa ruta la hacemos cada fin.» · playa: «Va, playa 🌴» · peregrinación: «Esa ruta la conocemos bien, la hacemos cada año.» · escapada: «Buen destino para desconectarse.» · ciudad: «Perfecto.» · boda: «Felicidades 🎉 Tú dedícate al evento, de mover gente nos encargamos nosotros.» · empresa: «Perfecto.» | ciudad/empresa: GEN · playa: FRÍO · resto OK |
| T-031 | bot.js:~1995 | tras destino | «*{destino}*, va 📍» (+ acuse de ocasión) | FRÍO |
| T-032 | bot.js:2001 | destino, leyó otra cosa | «Son *{gente}*, anotado 👍 / ¿Y a dónde van?» · «El *{fecha}*, anotado 👍 / …» · «Va, anotado 👍 / …» | OK |
| T-033 | bot.js:1455 `absorbeLoDemas` | salida/regreso | «Son *{gente}*, anotado 👍» · «*{destino}*, va 📍» · «Anotado 👍» | OK |
| T-034 | bot.js:3604 | leyó de un jalón | «Creo que entendí: *{lista}* 🤔 (si me equivoqué, dime *cambiar algo*) / {siguiente pregunta}» | OK |
| T-035 | bot.js:2184 | regreso (viaje largo) | «El viaje dura *{n} días*…» | OK |
| T-036 | bot.js:2125 | regreso < salida | «El regreso queda antes de la salida 🤔 / Salen el *{fecha}*…» | OK |
| T-037 | bot.js:2149 | regreso, autobús solo ida | «Ahí sí te tengo que parar 🙌 / En autobús no manejamos ida y vuelta el mismo día…» + botones | OK |

### 3.4 Re-preguntas cuando no leyó (ya sin «no entendí»)

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-040 | bot.js:1413 `REPREGUNTA.salida` (3) | salida | «¿Qué día salen? 📅 Escríbelo como *10 de septiembre* o *10/9*.» · «Dime la fecha de salida — por ejemplo *sábado 12* o *12/10*.» · «¿Para qué fecha lo necesitan? Con día y mes me basta.» | OK |
| T-041 | bot.js:1413 `REPREGUNTA.regreso` (3) | regreso | «¿Y qué día regresan? Puede ser *el 14* o *mismo día*.» · «¿Cuándo vuelven? Si es ida y vuelta el mismo día, dime *mismo día*.» · «Dime el día de regreso — por ejemplo *domingo 13*.» | OK |
| T-042 | bot.js:1413 `REPREGUNTA.destino` (3) | destino | «¿A qué ciudad van? 📍» · «¿A dónde es el viaje? Con el nombre del lugar me arranco.» · «Dime el destino — Vallarta, Chapala, Tequila, el que sea.» | OK |
| T-043 | bot.js:1413 `REPREGUNTA.vacio` (3) | mensaje vacío | «¿Me lo escribes otra vez? Con que me digas a dónde van, empiezo.» · «Cuéntame: ¿a dónde van y cuántos son?» · «Dime a dónde van y te voy armando el precio.» | 2ª: ROBOT (dos preguntas) |
| T-044 | bot.js:1812 | cuantos, no leyó | «Perdón, no me quedó claro 🙈 / Nada más el número: ¿son como *30*?…» | FRÍO |

### 3.5 Recomendación de unidad

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-050 | bot.js:633 | ≤ 20 personas | «Para {n} personas tienes dos opciones 👇 / 🚐 *Sprinter* — {cap} / La de siempre. Te la cotizo aquí mismo, al momento. / 🚙 *Suburban* — {cap} / Servicio ejecutivo: interiores en piel, puerta a puerta. Es más premium y su precio te lo confirmo yo en unos minutos. / ¿Cuál te late?» + botones | PREG (no recomienda), ROBOT |
| T-051 | bot.js:650 | Sprinter exacta | «Para {n} personas te va la *Sprinter* ({cap})…» | OK |
| T-052 | bot.js:661 | 21–24 | «Andan por poquito arriba 🤏 / La *Sprinter* lleva {max}… / Si logran acomodarse en {max}, te saco el precio ahorita mismo. Si no, les armo un autobús y te confirmo el precio.» + botones | OK |
| T-053 | bot.js:705 | > unidad mayor | «Para {n} personas se ocupa más de una unidad — la más grande que tenemos lleva {max}. / Eso te lo armo yo directo. Déjame juntar los datos para no hacerte repetir nada 👇» | OK |
| T-054 | bot.js:755 | autobús | «Para {n} personas les va *autobús* 🚌 …así que van bien sobrados — con lugar de más para equipaje.» | OK |
| T-055 | bot.js:1833 | eligió chica | «Va, la *{unidad}*. / …para no hacerte esperar 👇» | OK |
| T-056 | bot.js:1905 | eligió autobús | «Va, el *{unidad}* — {cap} 🚌 / Ése te lo confirmo yo directo; déjame juntar los datos para no hacerte repetir nada 👇» | OK |
| T-057 | bot.js:1924 | ajustar «sí» / «no» | «¡Perfecto! Con 20 les va la *Sprinter* y te saco el precio ahorita 👇» · «Sin problema, les va un *autobús*. Déjame juntar los datos para que una persona te pase el precio rápido 👇» | OK |
| T-058 | bot.js:3222 / 3235 | preguntó por una unidad | «*{unidad}* — {cap} 🚐 / Te saco el precio ahorita. / …» · «*{unidad}* — {cap} / Su precio lo da una persona del equipo…» | OK |
| T-059 | bot.js:3246 | «¿cuántos caben?» | «Va 🚐 ¿Cuántas personas viajan? / Si son *20 o menos* te saco el precio…» | OK |
| T-060 | bot.js:3256 | «¿qué unidades tienen?» | «Estas son nuestras unidades: / {lista}» | FORM, SINC |
| T-061 | bot.js:3266 | «¿qué incluye?» | «Todos nuestros servicios incluyen: / ✓ Operador profesional / ✓ Seguro de viajero / ✓ Monitoreo GPS 24/7 / ✓ Combustible y casetas / Cada unidad además trae lo suyo. ¿Cuál te interesa? / {lista}» | GEN («nuestros servicios»), FORM |

### 3.6 Fotos

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-070 | bot.js:888 `mediosDe` | fotos | «Claro 📸 Ésta es la *{unidad}* — {cap}. / Te dejo también un video por dentro 👇 / ¿Te saco el precio de tu viaje?» + botones («Cotizar mi viaje», «Ver otra unidad», «Márcame») | OK |
| T-071 | whatsapp.mjs:154 | con el precio | «Ésta es la que les tocaría 👆» | OK |

### 3.7 Precio y cierre

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-080 | bot.js:2303 | confirmar «sí» (Sprinter) | «Va, déjame sacar el precio…» | FRÍO (espera vacía, sin tiempo) |
| T-081 | bot.js:2396 `textoDeCotizacion` | precio | «🚐 *{unidad}* / 📍 {origen} → {destino} / 📅 {salida} al {regreso} / 🗓️ {n} días de servicio / 🚐 {n} días de recorrido ({horas}) / ⭐ Con {paseo} / *Total: ${total}* / Entre {gente} son *${x} por persona* / Incluye operador, combustible, casetas y seguro de viajero. / {comparación por ocasión} / Con *${anticipo}* te bloqueo tu {destino} del {día}, y los ${saldo} restantes los liquidas antes de salir. / ¿Te la aparto, {nombre}?» | OK en estructura (incluye, total, por persona, comparación, cierre). Mejorable: el marco emocional va DESPUÉS del número, no antes |
| T-082 | bot.js:1323 `COMPARACION` | precio | fiesta: «Y de regreso nadie tiene que manejar.» · playa: «Llegan juntos y descansados, en vez de horas cada quien manejando.» · peregrinación: «Van todos juntos y el operador conoce la ruta.» · escapada: «Llegan juntos, y de regreso nadie maneja.» · ciudad: «Todos llegan a la misma hora.» · boda: «Tus invitados llegan puntuales y tú no andas de valet.» · empresa: «Todos llegan a la misma hora, y va con factura.» · escolar: «Van todos juntos y con seguro de viajero.» | ciudad: GEN · resto OK (falta la comparación con coches/gasolina del marco G) |
| T-083 | bot.js:2412 | precio de fórmula (no de lista) | «Ese viaje déjame confirmártelo bien 🙌 / No te aviento un número al aire: prefiero darte el bueno. / *Hoy mismo te lo mando.* Y si lo necesitas ya, márcame al *{tel}*.» + botones | OK |
| T-084 | bot.js:2399 | precio falló | «Ese no me lo está dando el sistema 🙈 / Márcame al *{tel}* y te lo saco al momento.» | **INT** («sistema»), CEDE |
| T-085 | bot.js:2364 `textoDeSolicitud` | autobús/Suburban → ticket | «📋 *Solicitud de cotización* / 🚌 Unidad: … / 👥 Pasajeros: … / 📍 Salen de: … / 📍 Van a: … / 📅 Salida: … / 📅 Regreso: … / 🗓️ {n} días de servicio / 🚐 Recorridos: … / Ya tengo todo ✅ / Mándale esto por WhatsApp al *{tel}* y te pasan el precio en un momento — no tienes que volver a explicar nada.» | FORM, **CEDE** (manda al cliente a marcar), sin tiempo de espera |
| T-086 | bot.js:2791 | «quiero apartar» | «Va, te la aparto 🙌 / ¿A qué nombre la pongo?» | OK |
| T-087 | webhook:1082 | ficha bancaria | «Aquí están los datos 👆 / Te mando la CLABE sola abajo: déjala apretada para copiarla.» + CLABE sola | OK |

### 3.8 Objeciones

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-090 | bot.js:2906 | «está caro» | «Te entiendo 🙂 Ese precio ya trae operador, combustible, casetas y seguro de viajero — no se le suma nada después. / ¿Contra qué lo estás comparando? Te ayudo a ver si de verdad te sale mejor.» + botones («Contra otra empresa», «Contra irnos en coche», «Hablar con alguien») | OK (falta reencuadre por persona) |
| T-091 | bot.js:2952 | «le pregunto al grupo» | «Claro 👌 Te lo dejo listo para reenviar tal cual: / _(copia el mensaje de arriba y mándalo a tu grupo…)_ / ¿Sería mala idea que te la aparte mientras te contestan?» + botones | ROBOT (pide copiar en vez de mandar el resumen limpio); el «no» fácil está bien |
| T-092 | bot.js:2995 | «más barato» | «Puede ser, y te soy honesto: *no siempre somos los más baratos* 🤝 / Nomás checa que su precio incluya casetas, operador y que la unidad traiga *seguro de viajero*. Ahí suele estar la diferencia. / ¿Quieres que te lo desglose?» + botones | OK |
| T-093 | bot.js:3044 | agencia | «Para cuenta manejamos *5% de descuento* sobre el precio público 🤝 / …permiso vigente y factura. / Te paso los detalles del convenio ahorita.» | SINC; **INT** (nombra el porcentaje; mecánica pendiente `{{PENDIENTE_TARIFA_AGENCIA}}`) |
| T-094 | bot.js:3079 | «lo pienso» / «te aviso» | «Perfecto, quedo al pendiente 🙌 / Si antes de eso necesitas que le mueva algo —fechas, días, otra unidad— me dices.» | **CEDE**, SINC (falta etiqueta + «no» fácil) |
| T-095 | bot.js:3118 | «nunca he rentado» | «Se siente raro la primera vez, es normal 🙂 Llevamos {ANIOS} años en esto. / Es sencillo: apartas tu fecha, te llega tu contrato, y el resto lo liquidas antes del viaje. Yo te acompaño en todo. / ¿Te lo armo?» + botones | OK |
| T-096 | bot.js:3133 | cancelación | «Eso lo vemos directo contigo, según tu caso 🙌 / ¿Te marco para verlo?» + botones | CEDE (`{{PENDIENTE_POLITICA_CANCELACION}}`) |
| T-097 | — | «¿es seguro? ¿quién maneja?» | **No existe.** Cae en 3.10 o en la IA | (falta) |
| T-098 | — | «¿y si se cancelan varios?» | **No existe** como tal (cae en T-096) | (falta) |

### 3.9 Entrega a persona y espera

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-100 | bot.js:554 `PASA` | pide persona | «Claro 🙌 Márcame o escríbeme al *{tel}* y lo vemos ahí mismo. / O si prefieres, déjame aquí a dónde van y cuántos son, y yo te lo armo.» | CEDE (manda a marcar) |
| T-101 | bot.js:3404 | se rindió (3.10) | «Déjame checarte eso bien tantito 🙏 / Mientras, dime *cuántos van y a dónde* y te voy armando el precio.» | OK (espera con tarea) |
| T-102 | bot.js:2665 `noSeAtore` | 3 intentos atorado | «Déjame revisarlo bien y te confirmo en un momento 🙏» | FRÍO (sin tiempo) |
| T-103 | bot.js:1800 | «cancelar» a media captura | «Listo, lo dejamos ahí 👍 / ¿Te ayudo con algo más?» | CEDE |
| T-104 | bot.js:3492 | fuera de tema | «Jaja, de eso sí no sé 🙂 / Lo mío son los viajes: ¿a dónde van y cuántos son?» | ROBOT (dos preguntas) |
| T-105 | bot.js:3522 | la IA redactó | «{respuesta IA ≤240} / ¿A dónde van y cuántos son?» | ROBOT (dos preguntas) |

### 3.10 Comprobante y datos del contrato (`_datos-contrato.js`, webhook)

| ID | Ubicación | Etapa | Texto actual literal | Clasif. |
|---|---|---|---|---|
| T-110 | webhook:334 | foto sin viaje | «Ya lo vi 🙌 Déjame revisarlo y te digo.» | FRÍO |
| T-111 | webhook:336 + contrato:248 | comprobante | «Ya me llegó, gracias 🙌 / Tu pago se confirma en cuanto el equipo lo revise — puede tardar algunas horas 🙌 / Mientras, vamos armando tu contrato 📄 Así queda a tu nombre y el operador sabe exactamente dónde y a qué hora recogerlos. / 1️⃣ *Nombre completo* de quien firma el contrato / 2️⃣ *Teléfono* — si el bueno es otro, dímelo; si no, uso éste / 3️⃣ *De dónde los recogemos* — dirección exacta y hora / 4️⃣ *A qué dirección llegan* — y a qué hora quieren salir de regreso / Mándamelos como te acomode, todos juntos o de uno en uno.» | FORM (lista numerada de 4 datos); la espera sí dice tiempo |
| T-112 | contrato:85–103 `CAMPOS.pide` | falta un dato | «El *nombre completo* de quien firma el contrato» · «Un *teléfono* de contacto» · «La *dirección exacta* de dónde los recogemos» · «La *hora* a la que pasamos por ustedes» · «La *dirección* a la que llegan» · «La *hora* a la que quieren salir de regreso» | FORM |
| T-113 | contrato:288 | acuse parcial | «Anotado 🙌 / Nomás me falta: {lista} / Con eso queda tu contrato.» | OK |
| T-114 | contrato:277 | completo | «Listo, con eso tengo todo ✅ / En cuanto se confirme tu pago te mando tu contrato.» | OK |

### 3.11 Seguimientos automáticos (`_recordatorios.js`)

| ID | Ubicación | Etapa | Texto actual literal (10 variantes cada bolsa) | Clasif. |
|---|---|---|---|---|
| T-120 | :54 `UNA_HORA` | 1 h sin respuesta | «Oye, ¿te llegó bien la cotización? Cualquier duda me dices 🙌» · «¿Alcanzaste a verla? Si tienes alguna pregunta aquí ando.» · «Nomás para checar que sí te haya llegado 🙂 ¿Alguna duda?» · «¿Qué te pareció? Si algo no te cuadra, dime y lo vemos.» · «Ahí te dejé la cotización. ¿Te sirve así o le movemos algo?» · «¿La pudiste ver? Cualquier cosa que necesites, aquí estoy.» · «Oye, ¿todo bien con la cotización? Me dices si le falta algo.» · «¿Le echaste un ojo? Si quieres le cambiamos días o fechas, sin problema.» · «Aquí sigo por si tienes dudas del viaje 🙌» · «¿Cómo ves? Si necesitas que le ajuste algo, nomás dime.» | **CEDE** en 9 de 10 («cualquier duda», «aquí estoy», «nomás dime»), SINC |
| T-121 | :81 `VEINTICUATRO_HORAS` | 24 h | «Por si ayuda: todas las unidades traen seguro de viajero, y apartas tu fecha con el anticipo. El resto lo liquidas antes de salir.» · «Te cuento cómo funciona, por si nunca has rentado: apartas la fecha, te llega tu contrato, y el resto se paga antes del viaje.» · «Una cosa que a veces no queda clara: el precio ya incluye operador, combustible y casetas. No se le suma nada después.» · «¿Te quedó alguna duda de cómo funciona? Te la resuelvo en un minuto.» · «Nomás por si sirve: todas nuestras unidades llevan seguro de viajero.» · «Si lo que te frena es no saber cómo es el trámite, es sencillo: apartas, te mando tu contrato, y ya.» · «Cualquier cosa que te haga ruido del viaje, pregúntame sin pena 🙌» · «Por si lo estás comparando: checa que el otro precio incluya casetas, operador y seguro. Ahí suele estar la diferencia.» · «¿Hay algo que te gustaría que te aclare antes de decidir?» · «Si necesitas verlo distinto —otros días, otra unidad— dime y te lo armo.» | SINC en 8 de 10; 7ª y 9ª CEDE |
| T-122 | :127 `SETENTA_Y_DOS_SIN_CALENDARIO` | 72 h | «Oye, ¿seguimos con lo del viaje? Si ya no va, dime sin pena y te dejo de dar lata 🙂» · «¿Cómo quedaron con el grupo? Nomás para saber si le sigo apartando un lugar en la agenda.» · «Te escribo por última vez para no incomodarte: ¿le seguimos o lo dejamos para después?» · «¿Todavía va el plan? Si cambiaron algo, me dices y lo recotizo.» · «No quiero estarte insistiendo. Nada más dime si sigue en pie y quedo pendiente.» · «¿Se animaron o lo mueven para otra fecha? Cualquiera de las dos me sirve.» · «Última por hoy 🙌 ¿Le entramos, o te escribo más adelante?» · «Si el plan sigue, apartamos. Si no, dime y lo dejo por la paz.» · «¿Quedó en veremos? Dime y te busco cuando se acerque la fecha.» · «Cierro tu cotización o la dejo abierta, ¿cómo la ves?» | OK en tono; 2ª «le sigo apartando un lugar» = escasez no verificada → `{{PENDIENTE}}` |
| T-123 | :146 `SETENTA_Y_DOS_CON_CALENDARIO` | 72 h, con fecha | «Te aviso nomás: el {fecha} todavía lo tengo libre. Si se aparta otro grupo te digo.» · «Sigue disponible tu fecha. En cuanto deje de estarlo te lo digo, para que no te agarre de sorpresa.» · «El {fecha} sigue abierto. ¿Lo apartamos o lo suelto?» · «Todavía tengo unidad para el {fecha}. Nomás no te confíes mucho 🙂» · «Buenas noticias: tu fecha sigue libre. ¿Le entramos?» · «Ahorita el {fecha} está disponible. Si quieres lo bloqueo hoy mismo.» · «Te tengo apartada la fecha hasta que me digas. ¿Seguimos?» · «El {fecha} sigue en pie. En cuanto se ocupe te aviso.» · «Sigo con tu fecha disponible. ¿La cierro a tu nombre?» · «Todavía alcanzas el {fecha}. ¿Lo dejamos amarrado?» | **Escasez no verificada** (no hay calendario real detrás) → todas `{{PENDIENTE_disponibilidad}}`; 7ª afirma «te tengo apartada» sin apartado |

### 3.12 Botones que ve el cliente (resumen)

`OPCIONES_GENTE`: «Somos 10 o menos», «Entre 11 y 20», «Somos más de 20» (FORM) · «La Sprinter» / «La Suburban» · «Sí, somos 20» / «Somos {n}» · «Cotizar mi viaje» / «Ver otra unidad» / «Márcame» · «Hablar con alguien» (aparece en 5 objeciones) · «Sí, apártamela» · «Esta semana» · «Sí, desglósamelo» · «Contra otra empresa» / «Contra irnos en coche» · «Sí, vamos» · «Sí, márcame» · «Hablar con alguien» / «Cotizar otro» (precio de fórmula).

---

## 4 · Resumen de la clasificación

| Categoría | Cuántos | Dónde pesa más |
|---|---|---|
| **CEDE control** | 14 | 9 de los 10 recordatorios de 1 h; «lo pienso»; «cancelar»; despedida; PASA; solicitud a persona |
| **FORM** | 9 | origen, confirmar, unidades, qué incluye, datos del contrato (lista y campos), botones de gente |
| **FRÍO** | 12 | saludo sin nombre, destino, regreso, cuántos, cambiar, lejos, «déjame sacar el precio», foto sin viaje |
| **PREG** pregunta prohibida | 5 | «¿Cuál te late?» (Sprinter/Suburban), elegirBus, horas «¿tú qué dices?» |
| **ROBOT** | 6 | dos preguntas juntas («¿a dónde van y cuántos son?» ×4), «copia el mensaje de arriba» |
| **INT** revela interno | 2 | «no me lo está dando el sistema»; «5% de descuento» sin mecánica |
| **SINC** | 12 | recordatorios de 24 h, unidades, agencia, «lo pienso» |
| **GEN** | 4 | «Perfecto.» ×2, «nuestros servicios incluyen», comparación «ciudad» |
| **Escasez no verificada** | 11 | toda la bolsa de 72 h con fecha + una de 72 h sin fecha |
| **Faltan** | 2 | «¿es seguro? ¿quién maneja?», «¿y si se cancelan varios?» |
| **OK** | ~45 | precio (estructura), objeciones caro/barato/nunca he rentado, fotos, acuses de captura, re-preguntas |

Lo que ya está bien y conviene NO tocar: la estructura del mensaje de precio (incluye → total → por persona → comparación → anticipo → «¿te la aparto, {nombre}?»), el «no» fácil en «pregúntale al grupo», el argumento de dos caras en «más barato», y las re-preguntas sin confesión.

---

## 5 · Estado del modelo y del costo (excepción técnica autorizada — solo reporte, no aplicado)

| Punto del mandato | Estado hoy | Evidencia |
|---|---|---|
| 1. 100 % Haiku 4.5, sin fallback | ✅ | `_entender.js:33` `MODELO = 'claude-haiku-4-5-20251001'`, único modelo en el proyecto |
| 2. Prompt caching activo | ❌ **No existe** | No hay `cache_control` en ninguna llamada; el system prompt se manda completo cada vez |
| 3. `max_tokens` bajo | ✅ para lo que hace | `TOPE_SALIDA = 400`. La IA devuelve JSON de campos (no prosa), y la única prosa (`respuesta`) está acotada a 240 caracteres |
| 4. Registro de tokens y costo por conversación | ❌ **No existe** | Nunca se lee `usage` de la respuesta; no hay cache_read_input_tokens ni costo estimado en ningún registro |
| 5. Meta de costo $15–20/mes a 500 chats | Sin medir | Hoy la IA entra solo cuando el guion no lee (tope 300 llamadas/día). Sin registro no se puede proyectar |

Los puntos 2 y 4 quedan **pendientes de implementar en cuanto autorices el arranque de los lotes**; el mandato los autoriza, pero la instrucción de Fase 0 es no escribir código.

Nota de estructura para cuando se haga: hoy el system prompt lleva `Hoy es {fecha}` adentro; para cachear hay que sacar la fecha al bloque dinámico, o el caché se rompe cada día.

---

## 6 · Datos que el inventario ya deja marcados como PENDIENTES

Nada de esto se inventa. Sale de `datos-bot.json`, que se crea y se llena contigo antes del primer lote.

`{{PENDIENTE_NOMBRE_BOT}}` (T-001/T-002) · `{{PENDIENTE_VENDEDOR_HUMANO}}` (T-085, T-100) · `{{PENDIENTE_MINUTOS_RESPUESTA}}` (T-080, T-085, T-102) · `{{PENDIENTE_POLITICA_CANCELACION}}` (T-096, T-098) · `{{PENDIENTE_TARIFA_AGENCIA}}` (T-093) · `{{PENDIENTE_PRUEBA_SOCIAL}}` (T-030, T-097) · `{{PENDIENTE_DATOS_SEGURIDAD}}` (T-061, T-097) · `{{PENDIENTE_disponibilidad}}` (T-122, T-123) · `{{PENDIENTE_TEMPORADAS_ALTAS}}` (escasez real).

Lo único de la empresa que el bot afirma hoy y que sí está confirmado: **14 años operando**, seguro de viajero, precio incluye operador/combustible/casetas, Sprinter de 20 y autobuses de 47 a 51.

---

**Fin de Fase 0. Espero tu respuesta antes de proponer un solo cambio.**
