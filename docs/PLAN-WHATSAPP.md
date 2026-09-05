# El plan de WhatsApp

Lo que el dueño quiere que acabe pasando, en etapas, y **ordenado para
gastar lo menos posible antes de tener que pagar Vercel Pro**.

Dictado el 2-sep-2026: *«vamos a hacer todo lo posible que podamos hacer
antes de pagar los $20 de Vercel»*.

---

## Cómo va a funcionar, en una imagen

```
   CLIENTE                    EL BOT                      EL DUEÑO
   ────────                   ──────                      ────────
   escribe o                                        (no le llega nada
   manda audio  ──────────►   entiende                 de los clientes)
                              junta los datos
                                   │
                              ¿sabe el precio?
                                   │
                    no ────────────┴──────────── sí
                     │                            │
              le manda un ticket ────────►   contesta solo
              con TODO el viaje                (Sprinter de la
                     │                          página, si aplica)
                     │
                 el dueño escribe
                 el precio ◄──────── botón «Sí, $19,000»
                     │                si ya lo dio antes
                     ▼
              el bot le contesta
              al cliente
```

**El dueño solo recibe mensajes del bot.** Nunca de los clientes.

---

## Lo que ya está hecho (2-sep-2026)

| | |
|---|---|
| El guion que vende | ancla por persona, comparación por ocasión, cierre asumido |
| Las objeciones | cinco, y ninguna baja el precio |
| Las fotos | 58 fotos y 6 videos, de su propio sitio |
| La IA de respaldo | solo cuando el guion se rinde · con candado de tema y de gasto |
| R51 y R52 | el anticipo al medio millar · el autobús no hace dominical |
| Los audios | Groq, tope de un minuto, y no se le cree si sale dudosa |
| El webhook | escrito y probado, esperando su lugar en `pendiente/` |

**2,114 pruebas, 0 fallas.**

---

## Etapa 1 · El bot al puro chingadazo — **HECHA** (2-sep-2026)

- [x] **Entender una frase completa de un jalón.** «vamos a Tequila el
      12, somos 16» ahora sale con las cuatro cosas de un solo mensaje,
      **sin gastar IA**.
- [x] **Arrancar por el destino** (§2). El saludo dejó de ser un menú.
- [x] **El nombre del vendedor**, de `VENDEDOR`. Si no está, **no se
      inventa uno**.
- [x] **Modo agencia** (§8): detectado por señales, nunca preguntando.

### Los cuatro defectos de dinero que salieron aquí

| Era | Costaba |
|---|---|
| «a chapala el 20 somos 12» leía **20 personas** | Otra unidad y otro precio |
| «san juan de los lagos» quedaba en «San Juan de» | El catálogo no lo encuentra → **otro precio** |
| «salimos de Ocotlán» no leía el origen | Ocotlán lleva recargo → **cobraba de menos** |
| El botón **«Sí, cotizar»** activaba el modo agencia | El cliente perdía su precio por persona |

Los cuatro quedaron con prueba propia. La del último le da de comer al
detector **los 31 botones** que el bot ofrece: si mañana alguien mete una
palabra golosa, truena ahí.

---

## Etapa 2 · WhatsApp vivo — **HECHA** (2-sep-2026)

**Gratis. Usa el lugar 12 de 12.**

- [x] Webhook publicado: salió de `pendiente/`, entró a `api/whatsapp.mjs`.
- [x] **Los tickets al número del dueño** (`DUENO_WHATSAPP`), con el
      viaje armado y **sin precio** — el precio lo pone él.
- [x] **El dueño contesta AL BOT y el bot reenvía**, tal cual, sin
      adornar. Dos caminos: respondiendo al ticket, o empezando su
      mensaje con el número del cliente.
- [x] **La IA se calla** con ese cliente en cuanto el dueño entra, por
      dos horas.
- [x] **Recordatorio a las 15 horas**, colgado del tráfico.
- [x] Audios con Groq, con tope de un minuto y filtro de confianza.

> **Costó un lugar de función, y ahí me equivoqué en la cuenta.** Dije
> «quedan 11 de 12, el webhook cabe» sin contar `webhook-stripe.mjs`,
> que también es una función. Eran 12 de 12 y el webhook era el 13.
>
> Se sacó `diagnostico` a `pendiente/`, que es lo que el dueño había
> autorizado. **Lo que se pierde:** la pantalla que dice si las claves
> quedaron bien puestas en Vercel — justo cuando se van a meter tres
> nuevas. Con Vercel Pro regresa.

### Lo que armar esto destapó

**El webhook llamaba al bot SIN ESTADO.** `respuestaA(texto)` a secas.
O sea que **por WhatsApp el bot nunca pudo sostener una conversación**:
cada mensaje lo trataba como el primero y volvía a preguntar lo que el
cliente ya había contestado.

En la página no se notaba porque ahí el estado vive en el navegador.
Se destapó porque el ticket salía vacío.

Ya guarda la conversación de cada quien, seis horas. **Es memoria de
instancia**: Vercel recicla y se pierden las charlas a medias. Cubre al
que contesta en minutos, no al que contesta al día siguiente.

### Lo que quedó a medias, y por qué

| | |
|---|---|
| Amarrar la respuesta del dueño con su cliente | Memoria de instancia. Por eso hay un **segundo camino** que no depende de ella: el número escrito en el ticket |
| El recordatorio de las 15 h | Cuelga del tráfico. **Si en 15 horas no escribe nadie, no sale** hasta que alguien escriba |
| Que el dueño escriba solo el precio (`46500`) y el bot lo redacte | Necesita saber qué viaje era. **Eso es etapa 3** |

Las tres se arreglan igual: guardando en EuroSystem. Es la etapa 3.

> **POR QUÉ EL DUEÑO NO PUEDE ABRIR EL CHAT DEL CLIENTE**
>
> Un número dado de alta en el API de WhatsApp **no vive en la app del
> teléfono**. No es que esté ocupado por el bot: es que ese chat no
> existe en ningún celular. Los mensajes van al webhook y ya.
>
> Por eso el dueño contesta *a través* del bot. No es un rodeo — es la
> única forma con este API.

---

## Etapa 3 · La memoria y los registros

**Gratis del lado de la página. Necesita una puerta nueva en EuroSystem.**

- [ ] **Guardar cada conversación**, para que el dueño pueda entrar a
      verlas. Hoy el bot no guarda nada: atiende y olvida.
- [ ] **LA CARTERA DE CONTACTOS.** Dictado el 2-sep-2026: *«es muy
      importante que yo pueda acceder a la cartera de contactos del
      chatbot»*.

      Cada persona que escriba queda registrada con su número, su
      nombre si lo dio, y sus viajes. Es el activo que se está
      generando solo mientras el bot trabaja — y hoy **se está
      tirando en cada mensaje**.

      Va en `clientes` de EuroSystem, que ya existe: así la cartera del
      bot y la de la oficina son la misma, no dos listas que se
      separan.
- [ ] **Memoria de precios.** Dos viajes son «el mismo» cuando empatan
      **destino + unidad + días + si hubo movimientos**. No importa
      cuántos movimientos ni qué día.
- [ ] **Seis meses naturales**, y **se reinicia cada vez que se usa**.
- [ ] **Recomienda, nunca decide.** El ticket llega con un botón
      *«Sí, $19,000»* y **con la fecha en que se dio**: «hace 3 meses
      diste $19,000 por este mismo viaje». El dueño decide si sigue
      bueno — puede subirlo o bajarlo según el cliente.

> EuroSystem ya tiene `clientes` y `cotizaciones`. La memoria vive ahí,
> no en un lugar nuevo: es el sistema de registro y la página lo toca
> por una sola puerta, como los contratos.
>
> **Cualquier cambio de esquema pasa por `experto-migraciones` y espera
> confirmación explícita del dueño.** Es su regla, no una mía.

---

## Etapa 4 · El cierre completo

**Necesita EuroSystem. Es lo último.**

- [ ] **Consultar el calendario** antes de cobrar: ¿está libre esa unidad
      esos días? Puerta nueva en EuroSystem — `CONTRATOS-API.md` solo
      documenta CREAR contratos, no preguntar disponibilidad.
- [ ] Si está libre, **la liga de Stripe**. Esto ya existe: `/api/pagar`.
- [ ] **Los datos del contrato**, y son menos de los que parece:

| Dato | ¿Hace falta preguntarlo? |
|---|---|
| Teléfono | **No.** Viene con el mensaje de WhatsApp |
| Fechas, origen, destino, unidad, monto | **No.** Ya los juntó el bot |
| **Nombre** | **Sí.** Es lo único que falta |
| Dirección de salida | Sí, si quiere que se imprima el punto exacto |
| Dirección de destino | No tiene campo propio: va en el itinerario |
| Correo, RFC, dirección del cliente | **Opcionales.** Sin dirección el contrato imprime «CONOCIDO.» |

> **Cada pregunta de más pierde clientes.** El contrato se puede generar
> preguntando UNA cosa: cómo se llama.

- [ ] Generar el contrato con `POST /api/contratos/externo`.

---

## Cuándo se paga Vercel Pro, y por qué

**No por el espacio.** Quedan 11 de 12 funciones y el webhook es el 12:
cabe. `diagnostico` se queda —es la herramienta que dice si las claves
nuevas quedaron bien puestas, y justo se van a meter dos.

**Por el TIEMPO.** En el plan gratis una función tiene ~10 segundos; en
Pro, hasta 60. Bajar un audio de Meta y transcribirlo va apretado en 10.

**Se prueba en la etapa 2 y ahí se sabe.** Si aguanta, no se paga nada.

> Y hay algo que revisar antes: EuroSystem tiene muchas más de 12 rutas y
> está publicado. O ya está en un plan de paga, o Next.js las agrupa. Hay
> que verificarlo antes de contar con que una puerta nueva allá es gratis.

---

## Las claves que faltan

Las pone el dueño en Vercel. **Nunca en un archivo ni en un mensaje.**

| Clave | Para qué | ¿Ya? |
|---|---|---|
| `ANTHROPIC_API_KEY` | La IA del chat | falta |
| `GROQ_API_KEY` | Transcribir las notas de voz | falta |
| `WHATSAPP_TOKEN` | Bajar los audios y mandar mensajes | falta (sale de Meta) |
| `WHATSAPP_APP_SECRET` | Verificar que el aviso sea de Meta | falta |
| `WHATSAPP_VERIFY_TOKEN` | El alta del webhook | falta |

Si falta cualquiera, **nada truena**: esa parte simplemente no funciona y
el bot sigue contestando.

---

## Lo que NO cambia

**La página se queda como está.** Sigue cotizando la Sprinter sola y
cobrando sola. Dictado del dueño: *«en la página déjalo como está…
me gustaría dejarlo libre en la página, pero también me gustaría primero
probarlo con WhatsApp de manera cotidiana»*.

Lo de «no autorices nada» es **solo para WhatsApp**.
