# Entrega del contrato y cobro de abonos

**24 de agosto de 2026** · Especificación para revisión del dueño

---

## Por qué

Hoy un cliente paga su anticipo y **no recibe absolutamente nada**. El contrato se
crea solo en EuroSystem, con su PDF, y ahí se queda. El cliente no tiene su folio,
no tiene su contrato, y no tiene manera de seguir abonando sin llamar por teléfono.

Esta pieza cierra eso: al pagar le llega su contrato, y con él una puerta propia
para volver cuando quiera y abonar lo que falte.

## Qué NO entra aquí

Se nombra para que quede claro dónde termina esta pieza:

- **WhatsApp.** Decidido: se arranca por correo. Mandar un WhatsApp automático
  necesita la API de Meta —empresa verificada, plantillas aprobadas una por una,
  costo por conversación— y el trámite tarda días. El diseño deja el canal
  preparado para enchufarlo después **sin rehacer nada**.
- **Cuentas de usuario**, confirmación de correo, olvidé mi contraseña.
- **Mis viajes dentro de una cuenta**, y guardar la cotización al registrarse.
- **Aviso de privacidad.** Obligatorio antes de la primera cuenta, no de esta pieza.

---

## La decisión de fondo: no hay base de datos nueva

**Stripe es la única fuente de verdad del dinero y de quién es quién.** Lo poco que
hay que guardar —el código de un solo uso— vive en la metadata del propio cliente
de Stripe, no en un almacén nuevo. Se explica más abajo.

Se consideró guardar una copia en Supabase. Se descartó, y la razón importa: si la
página guarda su propia copia de cuánto ha pagado alguien, **hay dos verdades sobre
el mismo dinero** y terminan discrepando —un aviso perdido, un reembolso que no
llegó, una escritura a medias—. Nada truena; nada más los números dejan de cuadrar.
Es el peor defecto posible aquí.

Supabase entra en la pieza de cuentas, y guardará lo que solo las cuentas
necesitan: contraseñas, sesiones, cotizaciones. **Nunca dinero.**

### Comprobado contra la cuenta real, no supuesto

Se subió un diagnóstico temporal a producción, se corrió y se borró. Contestó:

| Pregunta | Respuesta |
|---|---|
| ¿Las sesiones quedan con cliente de Stripe? | Sí, `customer_creation: 'always'` cumple |
| ¿Se encuentra al cliente por su correo? | Sí, y es el correcto |
| ¿Se listan todos sus viajes? | Sí, y todos eran suyos |
| ¿Se trae uno solo por su identificador? | Sí, con folio y total |

Y dos hallazgos que cambian el diseño:

**El filtro de correo de Stripe distingue mayúsculas.** Se probó: el mismo correo
en mayúsculas devolvió cero. Un cliente que teclee `Ana@Ejemplo.mx` habiéndose
registrado como `ana@ejemplo.mx` queda fuera de su propio viaje, y nada truena.
→ **Se normaliza a minúsculas en todos los caminos, con prueba que lo vigile.**

**Solo las sesiones pagadas tienen cliente.** De diez sesiones recientes, una tenía
cliente y era la única pagada. Es lo que queremos: un viaje se vuelve localizable
justo cuando se paga, que es cuando se manda el correo. Los intentos abandonados no
ensucian nada.

### Por qué NO se usa la búsqueda de Stripe

La documentación de Stripe es explícita:

> «No uses la búsqueda para flujos de lectura inmediata después de escribir
> —por ejemplo, buscar justo después de hacer un cobro— porque el dato no estará
> disponible de inmediato. En condiciones normales tarda **menos de un minuto**.
> Durante una interrupción, la propagación puede retrasarse.»

Ese **es** nuestro flujo: el cliente paga y da clic al momento. Le diríamos «no
encontramos tu viaje» a alguien que acaba de pagar. Además, la sesión de Checkout
ni siquiera está entre los objetos que aceptan búsqueda.

Se usan solo **filtros de lista**, que no tienen retraso:

```
correo  →  GET /v1/customers?email=<en minúsculas>
        →  GET /v1/checkout/sessions?customer=cus_…&status=complete
liga    →  GET /v1/checkout/sessions/{id}
```

---

## Seguridad: que el cliente A no vea nada del cliente B

Es el requisito que el dueño marcó como fundamental. Hay **dos** puertas de entrada
y ninguna se puede cruzar.

### Puerta 1 — la liga del correo

La liga lleva un **token firmado**:

```
https://eurotravel-web.vercel.app/viaje?t=<carga>.<firma>
```

- `carga` = `{ s: "cs_…", exp: <fecha> }` en base64url
- `firma` = HMAC-SHA256 de la carga con `LIGAS_SECRETO`, que solo vive en Vercel

El servidor verifica la firma **antes de tocar Stripe**, comparando en tiempo
constante con `timingSafeEqual` —igual que `_firma-stripe.js` ya hace hoy—. Sin la
llave no se puede fabricar una carga válida, así que la liga de A **no puede
nombrar** la sesión de B.

Es el mismo patrón que EuroSystem ya usa en su `urlPdf`.

**Vencimiento:** la fecha de regreso del viaje más 90 días, y nunca menos de 30
días desde que se emite. Una liga vencida no deja a nadie fuera: existe la puerta 2.

**Lo que la liga ES:** un pase al portador. Quien tenga ese correo, entra. Igual que
la `urlPdf` de EuroSystem. Es aceptable y es la misma promesa que ya se hace hoy,
pero queda dicho.

### Puerta 2 — folio y código

Para cuando perdió el correo.

1. Teclea **su correo y su folio**.
2. El servidor normaliza el correo a minúsculas, busca al cliente, lista sus
   sesiones pagadas y comprueba que ese folio sea de una de ellas.
3. Si cuadra, manda un **código de 6 dígitos** a ese correo.
4. Lo teclea y entra.

**La búsqueda es por correo, no por folio.** El folio es la segunda comprobación,
no la llave. Razón: el folio no es secreto por diseño —va impreso, se dicta por
teléfono, viaja en mensajes— y una contraseña que se dicta por teléfono no es una
contraseña. Y el código llega al correo del dueño, así que quien teclee datos
ajenos no se entera de nada.

**El código:** 6 dígitos, vence a los 10 minutos, **un solo uso**, máximo 5
intentos. La pantalla acepta pegar y limpia lo que no sea dígito —la gente pega
«Tu código: 12 34 56»—. Aunque son 6 fijos, la validación acepta `\d{6,10}` y las
casillas crecen si llega uno más largo: que la interfaz se estire es feo, que deje
a alguien fuera de su viaje no se puede.

#### Dónde se guarda el código, si no hay base de datos

Un código de un solo uso, con vencimiento y con intentos contados, **es estado**.
En funciones serverless la memoria no sirve: cada llamada puede caer en otra
máquina, y el código que se guardó en una no existe en la siguiente.

Se guarda **en la metadata del cliente de Stripe**, que es el objeto al que
pertenece y que ya existe:

```
POST /v1/customers/{id}
  metadata[codigo_hash]     SHA-256 del código, nunca el código
  metadata[codigo_vence]    fecha de vencimiento
  metadata[codigo_intentos] cuántos van
```

Se guarda el **hash**, no el código: quien vea la metadata en el panel de Stripe no
puede entrar con ella. Al verificar bien, los tres campos se borran — ahí está el
«un solo uso».

**El límite honesto:** dos verificaciones simultáneas podrían pasar las dos, porque
esto no es una transacción. Con un código de 6 dígitos y 10 minutos de vida, el
riesgo es despreciable y el contador de intentos es de mejor esfuerzo. Queda dicho
para que nadie lo descubra como sorpresa.

**Alternativas descartadas:** un código firmado sin guardar nada no puede ser de un
solo uso ni contar intentos —seguiría sirviendo sus 10 minutos completos—. Y meter
Supabase o un almacén de claves aquí traería una pieza nueva que se puede caer,
para guardar algo que vive diez minutos.

**Se contesta lo mismo cuadre o no.** Nunca se revela si un correo o un folio
existen.

### Los frenos, y el error que este proyecto ya pagó

De `antes-de-escribir`, regla 4: *un candado que el atacante le puede cerrar a otro
no es un candado.* Contar solo por correo significa que cualquiera que sepa el
correo de un cliente lo deja fuera de su propio viaje.

Entonces:

| Freno | Clave | Tope |
|---|---|---|
| Pedir código | **IP de confianza** | 5 por minuto, 40 por día |
| Pedir código | correo | 3 por hora, y **nunca bloquea sola** |
| Verificar código | IP + código | 10 por minuto |

La IP de confianza sale de `_defensas.js`, que ya resuelve bien lo de nunca creerle
al primer `x-forwarded-for`.

**Una honestidad sobre los frenos:** los de `_defensas.js` cuentan en memoria, y en
funciones serverless eso es *por máquina*. Un atacante repartido entre instancias
consigue varias veces el tope. Sirve contra el abuso torpe, no contra el decidido.

Para el freno que de verdad importa —**no llenarle el buzón a un cliente con
códigos que él no pidió**— eso no alcanza. Ese contador va junto al código, en la
metadata del cliente de Stripe, que sí es la misma para todas las máquinas.
El de IP se queda como está: es defensa en profundidad, no la única.

---

## El correo

**Resend, por su API**, con `fetch`. Sin instalar nada y sin paso de compilación,
como el resto de la página. Módulo nuevo: `api/_correo.js`.

Más adelante, cuando lleguen las cuentas, **el mismo Resend** queda además como el
SMTP dentro de Supabase para los correos de cuenta (confirmar, recuperar). Un
proveedor, dos trabajos. Supabase por sí solo no puede mandar esto: solo manda sus
plantillas y sin adjuntos.

**Qué lleva:**

- El folio, grande y claro
- Cuánto pagó y cuánto falta
- El viaje: origen, destino, fechas, unidad
- **El contrato en PDF, adjunto**
- La liga a su viaje

**Adjunto y no solo liga**, porque la `urlPdf` de EuroSystem vence a los 30 días.
Se pide con `incluirPdf: true`, que ya existe en su API justo para esto.

**Lo que necesita el dueño:** cuenta en Resend y su API key en Vercel. Y las dos
mitades, sin dramatizar: **se puede probar todo hoy** con su propio correo; **antes
del primer cliente real** hay que verificar `eurotravel.com.mx` en Resend, porque
sin dominio verificado Resend solo entrega al dueño de la cuenta y a cualquier otro
lo rechaza —el envío muere y parece que el código está roto—.

Sale de `ventas@eurotravel.com.mx`.

### Si el correo falla

El contrato ya existe; el correo es lo que falta. Se contesta **500** para que
Stripe reintente durante tres días. Crear el contrato es idempotente —EuroSystem
contesta «ya existía»—, así que reintentar no duplica nada y le da al correo varias
oportunidades más.

**El costo, dicho:** si el correo salió y algo se cayó justo después, el cliente
recibe dos copias. Es mejor que cero, que es el problema que estamos tapando.

---

## Los abonos

### La pantalla

Desde su viaje, «Abonar». Escribe el monto —nunca más que el saldo—, y se abre una
sesión de cobro de Stripe con:

- `customer` = **el mismo cliente**, para que el abono aparezca junto a su viaje
- `metadata.folio` = el folio del contrato
- `metadata.tipo` = `abono`

El monto **se valida en el servidor** contra el saldo real, calculado desde Stripe.
Nunca se cobra un monto que mande el navegador, igual que ya hace `pagar.js`.

### El registro en EuroSystem

Decisión del dueño: **entra como borrador, pero entra**, una vez que el dinero está
en Stripe.

Se registra cuando Stripe confirma el pago —**preguntándole a Stripe**, no creyéndole
al aviso—, que es lo que el webhook ya hace y distingue los tres estados: tarjeta
pagada, voucher de OXXO generado pero sin pagar, y OXXO ya pagado en la tienda.

**Lo que no se puede prometer, y hay que decirlo:** con tarjeta el cliente puede
hacer un contracargo con su banco **hasta 120 días después**. No existe un momento
en que una tarjeta sea irreversible; con OXXO sí, porque es efectivo.

Por eso el diseño incluye la vuelta: Stripe avisa de reembolsos y contracargos
(`charge.refunded`, `charge.dispute.created`) y el abono se marca **revertido** en
la ficha. Sin eso, EuroSystem enseñaría dinero que ya no existe.

### La puerta nueva en EuroSystem — DEPENDENCIA EXTERNA

**Esto no se puede construir desde este repositorio.** EuroSystem solo sabe *crear*
contratos desde fuera; el endpoint que registra abonos exige sesión con permiso
`gestionarContratos`, o sea alguien de la oficina.

Y su documentación dice, a propósito:

> «El anticipo **no queda registrado como pago**. El pago se captura en la oficina
> cuando se confirma que entró.»

Eso es un **control**, no un olvido. Lo que se pide lo quita para el dinero que
llega por Stripe, con el argumento de que Stripe ya confirmó que entró.

Hace falta una puerta nueva, con esta forma:

```
POST /api/contratos/abono-externo
x-api-key: <CONTRATOS_API_KEY>

{
  "referenciaExterna": "WEB-cs_…",     // el contrato, como ya se identifica hoy
  "monto": 5000,
  "formaPago": "TARJETA",
  "referenciaPago": "pi_…",            // el pago de Stripe: la llave de idempotencia
  "estado": "BORRADOR"
}
```

- **Idempotente por `referenciaPago`**, misma lección que los contratos: el mismo
  pago nunca genera dos abonos.
- Contesta el saldo actualizado.

**Requiere:** decisión del dueño y, si toca el esquema, pasar por
`experto-migraciones` con su confirmación explícita, según las reglas de ese
repositorio.

**Mientras no exista**, esta pieza se entrega sin abonos: el correo con el contrato
y la liga al viaje funcionan solos. Los abonos se encienden después.

---

## Los archivos

| Archivo | Qué |
|---|---|
| `api/_correo.js` | **nuevo** · le habla a Resend por REST; arma el mensaje |
| `api/_ligas.js` | **nuevo** · firma y verifica los tokens de las ligas |
| `api/_codigos.js` | **nuevo** · genera, manda y verifica los códigos |
| `api/_stripe-consulta.js` | **nuevo** · las tres consultas de lista, en un lugar |
| `api/viaje.js` | **nuevo** · abre un viaje desde la liga o desde el código |
| `api/pedir-codigo.js` | **nuevo** · manda el código al correo |
| `api/abonar.js` | **nuevo** · abre la sesión de cobro del abono |
| `api/_webhook-logica.js` | manda el correo al crear el contrato; registra abonos |
| `api/pagar.js` | pide `incluirPdf`; marca el tipo en la metadata |
| `viaje.html` | **nuevo** · la pantalla del viaje, con su historial y «Abonar» |
| `index.html` | reescribir la sección que hoy promete lo contrario |
| `vercel.json` | sin cambios: el navegador sigue hablando solo con nuestro dominio |

### La sección que hoy miente

La portada dice hoy, textual:

> «Con ese folio entras desde el celular y ves todo lo tuyo: **no hay que abrir
> cuenta ni recordar contraseñas**.»

Con esta pieza pasa a ser cierto a medias —no hace falta cuenta, pero sí un código
al correo— y con la pieza de cuentas dejará de serlo. Se reescribe ahora.

---

## Variables nuevas

| Variable | Para qué |
|---|---|
| `RESEND_API_KEY` | mandar los correos |
| `LIGAS_SECRETO` | firmar las ligas. Se genera con `randomBytes(32)` y **nunca sale de Vercel** |

Las dos van al `.env.example` y al `README.md` en el mismo cambio que las estrena,
que es la regla 8 de `antes-de-escribir`.

---

## Cómo se prueba

Con proveedores fingidos, como ya se hace con Stripe y Google. Nada de esto toca la
red en las pruebas.

**Las ligas**
- una firma alterada en un solo carácter se rechaza
- **la liga del cliente A no abre el viaje del cliente B**, ni cambiándole la carga
- una liga vencida se rechaza y manda a la puerta 2
- se compara en tiempo constante

**Los códigos**
- el código correcto entra; el de otro correo no
- vencido, no
- **usado, no** — un solo uso, comprobado
- a los 5 intentos se cierra
- teclear el folio de otro **manda el código al dueño**, y a quien lo tecleó no le
  llega nada ni se le dice nada
- **el freno no lo puede cerrar un atacante sobre un cliente**: rotando la IP se
  frena; fijando solo el correo, el cliente legítimo sigue pudiendo entrar

**El correo en minúsculas**
- `Ana@Ejemplo.mx` y `ana@ejemplo.mx` llegan al mismo viaje. Es la prueba que evita
  el fallo que ya se comprobó en la cuenta real.

**El dinero**
- el saldo se calcula desde Stripe y cuadra con lo cobrado
- no se puede abonar más que el saldo
- el monto que mande el navegador se ignora
- un abono repetido —mismo pago de Stripe— no se registra dos veces
- **ni el kilometraje ni ninguna tarifa se filtran** en ninguna respuesta nueva

**El correo que se manda**
- lleva folio, montos y PDF
- si Resend falla, el contrato **no se pierde** y Stripe reintenta
- ninguna llave aparece en el cuerpo del mensaje

---

## En qué orden

1. `_ligas.js` y `_stripe-consulta.js`, con sus pruebas. Son la base y no dependen
   de nada externo.
2. `_correo.js` y el envío desde el webhook. **Aquí ya hay valor entregado**: el
   cliente recibe su contrato.
3. `viaje.html` y `api/viaje.js` — abrir el viaje desde la liga.
4. Los códigos: `pedir-codigo.js` y la puerta 2.
5. Reescribir la sección de la portada.
6. **Pausa.** Los abonos esperan a que exista la puerta en EuroSystem.
7. `abonar.js`, el registro del abono y el manejo de reembolsos.

Del 1 al 5 se puede entregar y usar sin que el 6 y 7 existan.

---

## Lo que hace falta del dueño

| | Cuándo |
|---|---|
| Cuenta en Resend y su API key en Vercel | antes del paso 2 |
| Verificar `eurotravel.com.mx` en Resend | antes del primer cliente real |
| Decidir la puerta de abonos en EuroSystem | antes del paso 6 |
| Confirmar que el contrato de su pago de prueba llegó | ahora, sigue pendiente |
