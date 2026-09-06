# El agente con memoria: plan, herramientas, esquema y system prompt

Borrador para el «va» del dueño. 6-sep-2026. **Sin código todavía.**

Lo que se construye: Claude Haiku 4.5 con *tool use*, una ficha por cliente
que no se pierde, y herramientas que el modelo decide cuándo llamar. El
motor de cotización (`_cotiza-nucleo.js`, `_tarifa.js`, el Excel) y los
textos de venta aprobados (`docs/PSICOLOGIA-DE-VENTAS.md`, `_recordatorios.js`,
`bot.js`) **no cambian**: se envuelven en herramientas.

---

## 0. Lo que ya existe y lo que choca con el mandato

Hay que decirlo antes del plan, porque cambia lo que se escribe.

### Ya existe (se reutiliza, no se rehace)

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Motor de precios | `_cotiza-nucleo.js`, `_tarifa.js`, `bot.js` | Sprinter por lista/fórmula; autobús y Suburban por ticket al dueño |
| Compuerta del dueño | `whatsapp.mjs` `precioDe` / `precioConfirmado` | Ningún precio sale sin su «va»; aprende los precios que da |
| Contrato BORRADOR | `subeContrato` → `POST /api/contratos/externo` | Folio + liga PDF al dueño y al cliente |
| Disponibilidad | `GET /api/disponibilidad` en EuroSystem | Libre / ocupado por tipo y fechas |
| Almacén | Supabase `fichas`, `charlas`, `mensajes`, `tickets`, `precios` | Memoria que sobrevive a la instancia |
| Seguimiento | `_seguimiento.js` + cron cada 15 min | 4 / 24 / 72 h; se apaga si contesta |
| Psicología | `docs/PSICOLOGIA-DE-VENTAS.md` = `_psicologia.js` | ~6,800 tokens cacheados |
| Datos de la empresa | `datos-bot.json` | Unidades, temporadas, prueba social, seguridad, políticas |
| Cobro en línea | `_stripe.js`, `pagar.js`, `webhook-stripe.mjs` | Checkout de Stripe para la página |
| Saneador | `_agente.js` `sanea()` | Bloquea cifras, km, «bot», palabras prohibidas |

### Choca con el mandato (resuelto con el dueño el 6-sep-2026)

1. **Anticipo.** El mandato decía 25 %. Queda como estaba: **20 %**,
   redondeado a $500 hacia arriba. («Deja el anticipo como habías dejado.»)
2. **Seguimientos de cotización.** Quedan **24 h / 3 d / 7 d** (el 4/24/72
   de la mañana se revirtió). Más lo nuevo del mandato: a los 60 días un
   último mensaje honesto, a los 90 «expirada» (se conserva).
3. **`cotizar` devuelve precio.** Tu compuerta sigue: mientras
   `CONFIRMAR_PRECIOS` esté encendida, la herramienta devuelve
   `requiere_revision: true` y el ticket te llega igual que hoy; el agente
   dice «en breve te confirmo». Cuando la apagues, devuelve el precio y el
   agente lo da con el marco de ventas.
4. **Sin panel de vendedores.** El abono se registra en EuroSystem, desde
   logística o desde la ficha del contrato, **después de pasar por ti y
   por su autorización**. El orden real es: precio → el cliente aparta
   (comprobante) → te llega a ti → autorizas y registras → **ahí** el bot
   le promete el contrato y le pregunta lo que falte para generarlo →
   contrato BORRADOR con folio y PDF. El contrato NO va antes del anticipo;
   lo que va antes es la prueba de legitimidad (datos de la empresa). Las
   tablas `vendedores` y `asignaciones` se quitan del esquema;
   `pasar_a_humano` te lo pasa a ti (`DUENO_WHATSAPP`), y `guardia` al
   teléfono de guardia.
   **Vigencia de la cotización: 69 días.** Se recuerda 90.
5. **EuroSystem hoy no tiene** ni consulta de reserva ni avisos salientes.
   Hacen falta tres piezas allá (sección 7). Van por sus reglas: esquema
   por `experto-migraciones`, tu confirmación explícita, commits por
   nombre.
6. **Doce funciones en Vercel.** La página ya usa las doce. Ninguna ruta
   nueva es una función nueva: cuelgan de `/api/whatsapp/<nombre>` como ya
   cuelga `seguimiento`.
7. **La ventana de 24 h de Meta.** Todo mensaje programado (liquidación
   30/15/5, salida 15 d/72 h/24 h, post-viaje, aniversario) cae fuera de la
   ventana → **todos son plantillas** aprobadas por Meta. Son unas nueve.
   Sin ellas, esos avisos no salen; el código lo dice en el registro.
8. **Kommo** se descarta, como dices. Dualhook se queda como puerta.

---

## 1. Arquitectura

```
WhatsApp (Dualhook) ──► api/whatsapp.mjs  (puerta, firma, tramo secreto)
                              │
                     ┌────────┴─────────┐
                     │ guardarraíles     │  alcance, topes, horario, listas
                     └────────┬─────────┘
                              │
                     ┌────────┴─────────┐
                     │ _ficha.js         │  arma el bloque dinámico (≤ 400 tokens)
                     └────────┬─────────┘
                              │
   bloque cacheado ─────► ┌───┴────────────────────────────┐
   (system + tools +      │ _agente.js · Haiku 4.5 tool use │ ◄── bloque dinámico
    datos-bot.json +      │  ciclo: modelo → herramienta →  │     (ficha + últimos
    psicología)           │  resultado → modelo (máx. 4)    │      12 mensajes + nuevo)
                          └───┬────────────────────────────┘
                              │ tool_use
                     ┌────────┴─────────┐
                     │ _herramientas.js  │  valida entrada (schema) → ejecuta → registra evento
                     └──┬───┬───┬───┬───┘
                        │   │   │   └── _eurosystem.js (contratos, disponibilidad, reserva, snapshot)
                        │   │   └────── _cotiza-nucleo.js / bot.js (motor, sin tocar)
                        │   └────────── _almacen.js (clientes, cotizaciones, reservas, abonos, eventos…)
                        └────────────── manda() (texto, foto, documento, plantilla)

EuroSystem ──webhooks──► /api/whatsapp/eurosystem   (contrato, abono validado, cambio, cancelación, unidad)
Vercel cron ──────────► /api/whatsapp/seguimiento   (cada 15 min: toques + recordatorios programados)
Vercel cron ──────────► /api/whatsapp/reconciliar   (diario: snapshots contra EuroSystem)
```

**El modelo decide; el código valida y ejecuta.** Cada herramienta tiene un
schema JSON estricto (`additionalProperties: false`, enumeraciones cerradas);
una llamada que no pasa el schema no se ejecuta y el modelo recibe el error
en su propio turno. Cada llamada queda en `eventos` con entrada y salida.

**Candados en código, no en el prompt (prueba i):**
- Si la respuesta final del modelo menciona una cifra de dinero, folio,
  saldo o fecha límite y en ese turno **no** llamó `consultar_reserva` ni
  `cotizar`, el código descarta la respuesta y reinyecta: «Llama la
  herramienta antes de afirmar montos». Segunda falta → `pasar_a_humano`.
- `sanea()` se queda tal cual sobre el texto final.
- Un `cotizar` con `requiere_revision` bloquea cualquier cifra en la respuesta.

**Ciclo por turno:** máximo 4 rondas de herramientas; si el modelo pide una
quinta, se corta con «déjame checarlo bien y te confirmo en un momento» y
se registra. Tiempo total por turno ≤ 20 s (Meta reintenta a los 30).

**Caché:** un solo bloque estático con `cache_control` al final de las
herramientas: system prompt (sección 6) + `tools` + `datos-bot.json` +
psicología ≈ 9,000 tokens. Bloque dinámico: ficha (≤ 400) + últimos 12
mensajes + el nuevo. Costo estimado por mensaje ≈ $0.002; con una
herramienta encadenada ≈ $0.004.

**El guion (`bot.js`) no muere:** sigue siendo el respaldo cuando
Anthropic no responde, y la fuente de `listaCortaDeAutobuses`, `mediosDe`
y las fechas. Deja de llevar el estado: el estado es la ficha.

### Archivos

| Archivo | Nuevo / cambia | Responsabilidad |
|---|---|---|
| `api/_herramientas.js` | nuevo | Schemas de las 12 herramientas y el despachador (validar → ejecutar → evento) |
| `api/_ficha.js` | nuevo | Arma el bloque dinámico desde el almacén; recorta a 400 tokens |
| `api/_eurosystem.js` | nuevo | Cliente de EuroSystem: contratos, disponibilidad, reserva; snapshot y bandera |
| `api/_recordatorios-programados.js` | nuevo | Cola de `programar_recordatorio` y su ejecución (plantillas) |
| `api/_agente.js` | cambia | De contrato JSON a `tools`; ciclo de herramientas; candados |
| `api/_almacen.js` | cambia | Tablas nuevas (sección 3); `fichas` y `charlas` quedan solo de respaldo |
| `api/whatsapp.mjs` | cambia | Rutas `eurosystem` y `reconciliar`; el turno pasa por `_ficha` + `_agente` |
| `api/_whatsapp-webhook.js` | cambia | Guardarraíles antes del modelo; excepción nocturna con reserva activa |
| `docs/AGENTE.sql` | nuevo | El esquema, idempotente, para correr en Supabase |
| `pruebas/probar-agente-*.mjs` | nuevo | Las diez pruebas de la sección 8 |

### Fases (cada una termina con pruebas y en producción)

1. **El agente con herramientas y memoria** (solo la página). Herramientas:
   `cotizar`, `consultar_disponibilidad`, `generar_contrato`, `enviar_documento`
   (contrato, foto, resumen), `guardar_en_ficha`, `actualizar_cotizacion`,
   `programar_recordatorio`, `pasar_a_humano`, `registrar_evento`,
   `registrar_abono_reportado`. Esquema completo. Ficha. Retención.
   Pruebas a, c (parcial), g, h, i, j.
2. **EuroSystem en vivo.** Consulta de reserva, avisos salientes, bandeja
   del bot en el panel. `consultar_reserva` con snapshot, `crear_link_pago`.
   Pruebas b, c, d, e.
3. **Acompañamiento.** Recordatorios de liquidación y de salida, post-viaje,
   aniversario, reconciliación diaria, plantillas de Meta. Prueba f.

---

## 2. Herramientas (schemas)

Todas con `"additionalProperties": false`. `telefono` siempre en E.164
(`+5213312345678`); el código lo normaliza y lo compara por los últimos 10.
Lo que cada una devuelve va como JSON en el `tool_result`.

```json
[
 {
  "name": "cotizar",
  "description": "Calcula el precio de un viaje con el motor de Eurotravel. Llámala ANTES de dar cualquier precio. Nunca calcules ni estimes tú. Si devuelve requiere_revision=true, NO des cifras: di que en breve confirmas.",
  "input_schema": {
   "type": "object",
   "properties": {
    "origen": { "type": "string", "description": "Ciudad de salida. 'Guadalajara' si sale de la zona metropolitana." },
    "destino": { "type": "string" },
    "fecha_salida": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "fecha_regreso": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "pasajeros": { "type": "integer", "minimum": 1, "maximum": 60 },
    "unidad": { "type": "string", "enum": ["sprinter", "suburban", "autobus"] },
    "autobus": { "type": "string", "description": "Clave del autobús elegido (irizar-i6s, …) cuando unidad=autobus. Solo si el cliente ya escogió de la lista." },
    "redondo": { "type": "boolean" },
    "con_movimientos": { "type": "boolean", "description": "Si en el destino la unidad los mueve (paseos, traslados) o solo lleva y trae." },
    "detalle_movimientos": { "type": "string" },
    "cotizacion_id": { "type": "string", "description": "Si es una cotización abierta que se recalcula, su id. Si no, se crea una." }
   },
   "required": ["origen", "destino", "fecha_salida", "pasajeros", "unidad"]
  }
 },
 {
  "name": "consultar_disponibilidad",
  "description": "Pregunta a EuroSystem si hay unidad para esas fechas. Úsala antes de prometer una fecha en temporada alta o a 30 días o menos.",
  "input_schema": {
   "type": "object",
   "properties": {
    "fecha_salida": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "fecha_regreso": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "unidad": { "type": "string", "enum": ["sprinter", "suburban", "autobus"] }
   },
   "required": ["fecha_salida", "unidad"]
  }
 },
 {
  "name": "consultar_reserva",
  "description": "Trae de EuroSystem, EN VIVO, el estado de una reserva: total, abonado validado, saldo, fecha límite, unidad, operador, salida, liga del contrato. OBLIGATORIA en el mismo turno antes de responder cualquier pregunta sobre reserva, saldo, contrato, unidad u hora. Si EuroSystem no contesta, devuelve snapshot=true con su fecha: entonces di 'según lo último que tengo'.",
  "input_schema": {
   "type": "object",
   "properties": {
    "folio": { "type": "string" },
    "telefono": { "type": "string" }
   }
  }
 },
 {
  "name": "generar_contrato",
  "description": "Registra el contrato en EuroSystem (queda como borrador hasta que el equipo lo confirme) y devuelve folio y liga del PDF. Solo cuando el cliente dijo que sí y ya dio nombre y dirección de salida.",
  "input_schema": {
   "type": "object",
   "properties": {
    "cotizacion_id": { "type": "string" },
    "nombre": { "type": "string", "minLength": 3 },
    "telefono": { "type": "string" },
    "correo": { "type": "string" },
    "direccion_salida": { "type": "string", "minLength": 8 },
    "hora_salida": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
    "hora_regreso": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
    "notas": { "type": "string" }
   },
   "required": ["cotizacion_id", "nombre", "telefono", "direccion_salida"]
  }
 },
 {
  "name": "enviar_documento",
  "description": "Manda por WhatsApp un archivo o un texto reenviable. 'resumen_reenviable' es el resumen de la cotización para que el cliente lo pase a su grupo.",
  "input_schema": {
   "type": "object",
   "properties": {
    "telefono": { "type": "string" },
    "tipo": { "type": "string", "enum": ["contrato", "comprobante_abono", "foto_unidad", "video_unidad", "resumen_reenviable"] },
    "referencia": { "type": "string", "description": "folio, reserva_id, cotizacion_id o clave de unidad, según el tipo" }
   },
   "required": ["telefono", "tipo", "referencia"]
  }
 },
 {
  "name": "crear_link_pago",
  "description": "Crea la liga oficial de pago (Stripe) por el monto indicado para esa reserva. Nunca des cuentas, CLABEs ni datos bancarios: solo esta liga o los datos oficiales que devuelva.",
  "input_schema": {
   "type": "object",
   "properties": {
    "reserva_id": { "type": "string" },
    "monto": { "type": "integer", "minimum": 500 },
    "concepto": { "type": "string", "enum": ["anticipo", "abono", "liquidacion"] }
   },
   "required": ["reserva_id", "monto", "concepto"]
  }
 },
 {
  "name": "registrar_abono_reportado",
  "description": "El cliente dice que ya depositó o manda comprobante. Queda como 'reportado' y le llega al dueño para autorizarlo. NO suma al saldo hasta que se valide: di que en cuanto se valide le confirmas y le mandas su contrato.",
  "input_schema": {
   "type": "object",
   "properties": {
    "reserva_id": { "type": "string" },
    "monto": { "type": "integer", "minimum": 1 },
    "comprobante_url": { "type": "string" },
    "metodo": { "type": "string", "enum": ["transferencia", "deposito", "liga", "efectivo", "otro"] }
   },
   "required": ["reserva_id"]
  }
 },
 {
  "name": "guardar_en_ficha",
  "description": "Guarda algo durable del cliente en su ficha: nombre, tipo (particular/agencia), ocasión, qué le importa, preferencias, notas. Llámala cada vez que aprendas algo que sirva la próxima vez.",
  "input_schema": {
   "type": "object",
   "properties": {
    "telefono": { "type": "string" },
    "campo": { "type": "string", "enum": ["nombre", "correo", "tipo", "organizacion", "ocasion", "tema_que_le_importa", "preferencia", "nota", "no_contactar_promocional", "direccion_salida", "lista_pasajeros"] },
    "valor": { "type": "string", "maxLength": 300 }
   },
   "required": ["telefono", "campo", "valor"]
  }
 },
 {
  "name": "actualizar_cotizacion",
  "description": "El cliente cambió fecha, pasajeros, destino o unidad de una cotización abierta. Se actualiza la misma; no se crea otra. Después llama cotizar con cotizacion_id para el precio nuevo.",
  "input_schema": {
   "type": "object",
   "properties": {
    "cotizacion_id": { "type": "string" },
    "cambios": {
     "type": "object",
     "properties": {
      "fecha_salida": { "type": "string" }, "fecha_regreso": { "type": "string" },
      "pasajeros": { "type": "integer" }, "destino": { "type": "string" },
      "origen": { "type": "string" }, "unidad": { "type": "string", "enum": ["sprinter", "suburban", "autobus"] },
      "autobus": { "type": "string" }, "con_movimientos": { "type": "boolean" }
     },
     "additionalProperties": false
    }
   },
   "required": ["cotizacion_id", "cambios"]
  }
 },
 {
  "name": "programar_recordatorio",
  "description": "Agenda un mensaje futuro. Úsala cuando el cliente diga 'te contesto el jueves' o cuando el estado lo pida.",
  "input_schema": {
   "type": "object",
   "properties": {
    "telefono": { "type": "string" },
    "fecha": { "type": "string", "description": "AAAA-MM-DD o AAAA-MM-DDTHH:MM (hora de Guadalajara)" },
    "tipo": { "type": "string", "enum": ["seguimiento_cotizacion", "respuesta_del_grupo", "anticipo", "liquidacion", "salida", "post_viaje", "recompra"] },
    "referencia": { "type": "string", "description": "cotizacion_id o reserva_id" }
   },
   "required": ["telefono", "fecha", "tipo", "referencia"]
  }
 },
 {
  "name": "pasar_a_humano",
  "description": "Entrega el chat al dueño con la ficha completa. Tú dejas de responder hasta que lo libere. 'guardia' es solo para cliente EN VIAJE o emergencia. Úsala también cuando una herramienta de dinero falle, o cuando el cliente pida cambio de fecha, cancelación o algo fuera de política.",
  "input_schema": {
   "type": "object",
   "properties": {
    "telefono": { "type": "string" },
    "motivo": { "type": "string", "maxLength": 300 },
    "urgencia": { "type": "string", "enum": ["normal", "alta", "guardia"] },
    "solicitud_armada": { "type": "string", "description": "Lo que el cliente pide, ya en una línea, para que el vendedor no vuelva a preguntar." }
   },
   "required": ["telefono", "motivo", "urgencia"]
  }
 },
 {
  "name": "registrar_evento",
  "description": "Apunta en la bitácora algo que pasó y no cabe en otra herramienta (incidencia, queja, promesa, dato relevante).",
  "input_schema": {
   "type": "object",
   "properties": {
    "telefono": { "type": "string" },
    "reserva_id": { "type": "string" },
    "tipo": { "type": "string", "enum": ["incidencia", "queja", "promesa", "dato", "cambio_solicitado", "cancelacion_solicitada", "otro"] },
    "detalle": { "type": "string", "maxLength": 500 }
   },
   "required": ["telefono", "tipo", "detalle"]
  }
 }
]
```

### Lo que devuelve cada una (resumen)

| Herramienta | Devuelve |
|---|---|
| `cotizar` | `{cotizacion_id, total, por_persona, anticipo, incluye[], vigencia_hasta, unidad, requiere_revision, motivo_revision}` |
| `consultar_disponibilidad` | `{estado: "disponible" \| "no_disponible" \| "por_confirmar", detalle}` |
| `consultar_reserva` | `{folio, estado, destino, fecha_salida, fecha_regreso, unidad, operador, direccion_salida, hora_salida, total, abonado_validado, saldo, fecha_limite, url_contrato, vendedor, pendientes[], snapshot, snapshot_fecha}` |
| `generar_contrato` | `{reserva_id, folio, url_contrato, anticipo, fecha_limite}` o `{error}` |
| `enviar_documento` | `{enviado: true}` o `{error}` |
| `crear_link_pago` | `{url, monto, vence}` o `{error}` |
| `registrar_abono_reportado` | `{abono_id, estado: "reportado", vendedor_avisado}` |
| `guardar_en_ficha` / `actualizar_cotizacion` / `programar_recordatorio` / `registrar_evento` | `{ok: true}` |
| `pasar_a_humano` | `{vendedor, chat_cerrado_para_el_agente: true}` |

---

## 3. Esquema (Supabase, `docs/AGENTE.sql`)

Todo `if not exists`, todo con RLS. Las tablas de hoy (`fichas`, `charlas`,
`tickets`, `precios`, `mensajes`) se quedan; `mensajes` gana columnas.

```sql
create table if not exists clientes (
  telefono                  text primary key,          -- E.164
  nombre                    text,
  correo                    text,
  tipo                      text not null default 'particular' check (tipo in ('particular','agencia')),
  organizacion_id           bigint references organizaciones(id),
  tono_preferido            text,
  temas_que_le_importan     jsonb not null default '[]',
  resumen_relacion          text check (char_length(resumen_relacion) <= 600),
  primer_contacto           timestamptz not null default now(),
  ultimo_contacto           timestamptz not null default now(),
  no_contactar_promocional  boolean not null default false,
  creado                    timestamptz not null default now(),
  actualizado               timestamptz not null default now()
);

create table if not exists organizaciones (
  id        bigserial primary key,
  nombre    text not null,
  rfc       text,
  telefonos text[] not null default '{}',
  creado    timestamptz not null default now()
);

create table if not exists cotizaciones (
  id                    text primary key,              -- 'C-' + ulid
  telefono              text not null references clientes(telefono),
  estado                text not null default 'abierta'
                        check (estado in ('abierta','precio_enviado','en_espera_grupo','convertida','expirada','descartada')),
  ocasion               text,
  origen                text, destino text,
  fecha_salida          date, fecha_regreso date,
  pasajeros             integer,
  unidad_recomendada    text, unidad_elegida text,
  redondo               boolean not null default true,
  dias_estadia          integer,
  con_movimientos       boolean, detalle_movimientos jsonb,
  precio_total          integer, precio_por_persona integer, anticipo integer,
  incluye               jsonb,
  vigencia_hasta        date,
  siguiente_paso        text,
  proxima_accion_agente timestamptz,
  precio_en             timestamptz, toques integer not null default 0,   -- el seguimiento de hoy
  creado                timestamptz not null default now(),
  actualizado           timestamptz not null default now()
);
create index if not exists cotizaciones_tel on cotizaciones (telefono, actualizado desc);
create index if not exists cotizaciones_accion on cotizaciones (proxima_accion_agente) where estado in ('abierta','precio_enviado','en_espera_grupo');

create table if not exists reservas (
  id                        text primary key,          -- 'R-' + ulid
  telefono                  text not null references clientes(telefono),
  cotizacion_id             text references cotizaciones(id),
  folio_eurosystem          integer unique,
  estado                    text not null default 'contrato_generado'
                            check (estado in ('contrato_generado','anticipo_pagado','abonando','liquidada','proxima','en_viaje','completada','cancelada')),
  fecha_salida              timestamptz, fecha_regreso timestamptz,
  unidad                    text, operador text,
  direccion_salida          text, hora_salida text,
  pasajeros                 integer,
  precio_total              integer, anticipo_minimo integer,
  fecha_limite_liquidacion  date,
  url_contrato              text,
  snapshot_eurosystem       jsonb,
  snapshot_actualizado      timestamptz,
  creado                    timestamptz not null default now(),
  actualizado               timestamptz not null default now()
);   -- retención: PERMANENTE
create index if not exists reservas_tel on reservas (telefono, fecha_salida desc);
create index if not exists reservas_salida on reservas (fecha_salida) where estado not in ('completada','cancelada');

create table if not exists abonos (
  id              bigserial primary key,
  reserva_id      text not null references reservas(id),
  monto           integer not null check (monto > 0),
  fecha           timestamptz not null default now(),
  metodo          text, referencia text, comprobante_url text,
  estado          text not null default 'reportado' check (estado in ('reportado','validado','rechazado')),
  validado_por    text,                                  -- usuario de EuroSystem
  id_eurosystem   text unique,                           -- el Abono de allá, cuando se valida
  creado          timestamptz not null default now()
);

create table if not exists eventos (
  id           bigserial primary key,
  telefono     text, reserva_id text,
  tipo         text not null,
  detalle      jsonb,
  herramienta  text, entrada jsonb, salida jsonb,
  creado       timestamptz not null default now()
);
create index if not exists eventos_tel on eventos (telefono, creado desc);

create table if not exists conversaciones (
  id                bigserial primary key,
  telefono          text not null,
  inicio            timestamptz not null default now(),
  fin               timestamptz,
  resumen           text,
  cotizacion_id     text, reserva_id text,
  mensajes_cliente  integer not null default 0,
  mensajes_agente   integer not null default 0,
  tokens_entrada    integer not null default 0,
  tokens_cache      integer not null default 0,
  tokens_salida     integer not null default 0
);

alter table mensajes add column if not exists conversacion_id bigint references conversaciones(id);
alter table mensajes add column if not exists direccion text check (direccion in ('in','out'));
alter table mensajes add column if not exists media_url text;
-- retención: 12 meses sin reserva; con reserva, 12 meses después del viaje.
-- La purga SOLO toca esta tabla (prueba j).

-- Sin tablas de vendedores ni asignaciones (6-sep-2026): quien atiende es
-- el dueño. Lo que se guarda es en manos de quién está el chat:
alter table clientes add column if not exists en_manos_de text
  check (en_manos_de in ('dueno','guardia'));
alter table clientes add column if not exists en_manos_desde timestamptz;

create table if not exists recordatorios (
  id          bigserial primary key,
  telefono    text not null,
  cuando      timestamptz not null,
  tipo        text not null,
  referencia  text,
  plantilla   text,                                     -- nombre en Meta
  estado      text not null default 'pendiente' check (estado in ('pendiente','enviado','cancelado','sin_plantilla')),
  creado      timestamptz not null default now()
);
create index if not exists recordatorios_pendientes on recordatorios (cuando) where estado = 'pendiente';

create table if not exists vinculaciones (                -- otro número quiere ver un contrato
  id          bigserial primary key,
  telefono_nuevo text not null, telefono_original text not null,
  codigo      text not null, enviado_a text not null,  -- 'whatsapp' | 'correo'
  vence       timestamptz not null, usado timestamptz,
  creado      timestamptz not null default now()
);

alter table clientes        enable row level security;
alter table organizaciones  enable row level security;
alter table cotizaciones    enable row level security;
alter table reservas        enable row level security;
alter table abonos          enable row level security;
alter table eventos         enable row level security;
alter table conversaciones  enable row level security;
alter table recordatorios   enable row level security;
alter table vinculaciones   enable row level security;
```

Sin políticas: el bot entra con la llave secreta (salta RLS) y nadie más
entra. EuroSystem no toca esta base: lo que necesite del bot lo pide por
una ruta del bot con llave de servidor a servidor, nunca directo a
Supabase.

**Privacidad (sección 9 del mandato):** «borra mis datos» → se borran
`mensajes`, `conversaciones`, `cotizaciones` sin reserva y la ficha;
`reservas` y `abonos` se conservan con `telefono` reemplazado por
`'borrado-' || id` y un evento `datos_minimos_legales`.

---

## 4. La ficha que ve el modelo (≤ 400 tokens)

Se arma en `_ficha.js` desde las tablas, en este orden y con este recorte.
Ejemplo real de cómo la vería Haiku:

```
FICHA
Cliente: Mariana López · particular · desde 12-jun-2026 · último 4-sep-2026
Relación: organiza la despedida de su hermana; le preocupa que nadie maneje de regreso; prefiere WhatsApp de noche.
COTIZACIÓN ABIERTA C-01J7… · precio_enviado
  Guadalajara → Puerto Vallarta · sal 14-mar-2027 · reg 16-mar · 18 pax · Sprinter · $24,500 ($1,361/persona)
  Se quedó en: le pregunté si le aparto la fecha. Falta: su respuesta. Vigencia: 12-nov-2026.
RESERVA R-01J5… · folio 1043 · abonando
  Talpa · sal 20-oct-2026 07:00 · Sprinter 2023 · operador: por asignar
  Total $18,000 · abonado validado $3,600 · saldo $14,400 · límite 5-oct-2026
  Pendientes: lista de pasajeros. Vendedor: Ana.
  Últimos eventos: abono validado 22-ago · recordatorio liquidación 15 d programado · pidió factura 30-ago
ÚLTIMA PLÁTICA (4-sep): preguntó si puede cambiar la salida al 21; se le dijo que se consulta; sin respuesta aún.
HISTORIAL: Cantaritos 20-may-2025 · Mazamitla 12-dic-2024
```

Si el snapshot tiene más de 24 h o EuroSystem no contestó, la ficha
empieza con: `DATOS SEGÚN SNAPSHOT DEL 3-sep-2026 14:10; llama
consultar_reserva antes de afirmar montos.`

Reglas de recorte: relación ≤ 600 caracteres; una cotización abierta (la
más reciente); reservas activas (máx. 3); historial (máx. 5 líneas). Nunca
el historial de mensajes: eso va aparte, últimos 12 mensajes.

---

## 5. Ciclo de vida: qué dispara qué

| Estado | Lo dispara | El agente / el código |
|---|---|---|
| Cotización abierta | cliente vuelve | Retoma con nombre + destino + fecha + pax + precio; no repregunta |
| | sin respuesta | Toques 24 h / 3 d / 7 d; 60 d último mensaje honesto; 90 d `expirada` (vigencia del precio: 69 d) |
| | cambio | `actualizar_cotizacion` + `cotizar(cotizacion_id)` |
| Precio dado, quiere apartar | «va, ¿cómo aparto?» | Anticipo (20 %, a $500 arriba), datos oficiales de pago o `crear_link_pago`; recordatorios 24 h y 72 h si no llega el comprobante |
| Comprobante recibido | foto o «ya deposité» | `registrar_abono_reportado` → te llega a ti; el bot le dice que en cuanto se valide le confirma y le manda su contrato |
| Anticipo autorizado | tú lo registras en EuroSystem (logística o ficha) → aviso al bot | Mensaje inmediato: monto, saldo, límite, «de aquí en adelante yo te voy avisando»; **promete el contrato y pide lo que falte** (nombre, dirección, hora) → `generar_contrato` → `enviar_documento(contrato)` con folio y PDF |
| Abonando | salida − 30/15/5 d con saldo | Plantilla de saldo, como recomendación («para que Vallarta quede sin pendientes»), nunca como vencimiento: no hay fecha límite; ofrece `crear_link_pago` |
| | comprobante del cliente | `registrar_abono_reportado`; «en cuanto se valide te confirmo el saldo» |
| Liquidada / próxima | salida − 15 d | Confirma dirección y hora; pide lista si aplica → `guardar_en_ficha` |
| | salida − 72 h | Unidad asignada (foto), operador, teléfono de guardia; pide confirmación |
| | salida − 24 h | Hora, punto, tip del destino |
| En viaje | cualquier mensaje | `pasar_a_humano(guardia)`; sin venta |
| Completada | regreso + 24 h | Gracias específico + satisfacción 1-5 + reseña; actualiza relación |
| | aniversario − 30 d | Recompra nombrando la ocasión anterior |
| Cancelada | webhook | Política de `datos-bot.json`; se conserva todo |

**Regla transversal:** con reserva activa, primero la reserva, luego vender.
**Nocturno:** un cliente con reserva activa que escribe de noche sobre su
viaje no se topa con el horario; responde con `consultar_reserva`.

### Identidad y vinculación (prueba g)

Otro número pide ver un contrato → el agente NO lo muestra. Llama
(código) `vinculaciones`: manda un código de 6 dígitos al número original
por WhatsApp (o al correo del contrato con Resend). El cliente lo escribe
desde el número nuevo; si coincide y no venció (15 min), se agrega el
número a la organización o al cliente. Tres intentos y se cierra.

### Pasar a humano

`normal` y `alta` → tu número (`DUENO_WHATSAPP`), con la ficha completa y
`solicitud_armada`. `guardia` → el teléfono de guardia. El chat queda
marcado (`clientes.en_manos_de = 'dueno' | 'guardia'`) y el agente calla
hasta que contestes `libera` citando el aviso (mismo mecanismo que hoy
usa tu «va»).

---

## 6. Lo que EuroSystem necesita (fase 2)

1. **`GET /api/contratos/externo?folio=` o `?telefono=`** (solo lectura,
   misma llave de servidor a servidor que la disponibilidad, dos frenos):
   estado, montoTotal, anticipo, suma de `Abono` validados, saldo,
   fechaSalida/Regreso, unidad (`tipoDetalle`), chofer, direccionSalida,
   hora, liga PDF, vendedor. Por teléfono devuelve la lista de contratos
   de ese cliente.
2. **Avisos salientes** (`POST` firmado con HMAC a
   `/api/whatsapp/eurosystem`): `contrato_confirmado`, `abono_validado`,
   `cambio_fecha`, `cancelado`, `unidad_asignada`, `operador_asignado`. Se
   disparan desde donde hoy se guardan esos cambios. Reintento con backoff;
   si el bot no contesta, la reconciliación diaria lo alcanza.
3. **El abono del bot entra por donde ya entran los abonos** (logística o
   la ficha del contrato). Lo único nuevo: al registrarlo, EuroSystem
   dispara el aviso `abono_validado` con el folio, y el bot hace el resto
   (confirmación al cliente, promesa del contrato, datos faltantes).

Cada una pasa por `experto-migraciones` (la 1 toca esquema si se guarda
`telefonoE164` en `Cliente`) y por `auditor-seguridad`.

---

## 7. System prompt (bloque cacheado)

Lo que sigue es el texto que verá Haiku, en este orden. Los bloques entre
`[[ ]]` se insertan desde archivos ya aprobados, sin cambios.

```
Eres el asesor de viajes de Eurotravel (Tlaquepaque, Jalisco): rentamos
Sprinters, Suburbans y autobuses con chofer para grupos. Hablas de tú,
como tapatío, en mensajes cortos. No eres una persona y no lo finges; si
te preguntan, lo dices con naturalidad y sigues ayudando. No te presentas
como bot ni como IA por tu cuenta.

TU TRABAJO
Acompañar a cada cliente desde que pregunta hasta que regresa de su viaje,
y recordarlo la próxima vez. Vendes bien porque recuerdas: usa la FICHA
para hablarle a ESTE cliente, no a "un cliente". Si ya sabes algo, no lo
vuelvas a preguntar.

LA FICHA Y LAS HERRAMIENTAS
- La FICHA que recibes es lo que la empresa sabe de este cliente. Lo que
  está ahí es sagrado: no lo contradigas ni lo repreguntes.
- Nunca inventes folio, saldo, precio, fecha ni unidad. Si no está en la
  ficha, llama la herramienta.
- Antes de dar un precio: cotizar. Siempre.
- Antes de responder cualquier cosa sobre reserva, saldo, contrato,
  unidad, operador u hora de salida: consultar_reserva en este mismo
  turno, aunque la ficha traiga cifras. Si devuelve snapshot=true, di
  "según lo último que tengo (fecha)".
- Si cotizar devuelve requiere_revision=true: no des cifras. Di que en
  breve confirmas. Nunca digas cuánto tiempo.
- Cada vez que aprendas algo durable del cliente (nombre, ocasión, qué le
  preocupa, preferencias): guardar_en_ficha.
- Si cambia fecha, pasajeros, destino o unidad: actualizar_cotizacion y
  luego cotizar con el mismo id. No abras otra cotización.
- Si una herramienta falla: dilo con naturalidad ("déjame checarlo bien y
  te confirmo en un momento"), y si es sobre dinero, pasar_a_humano.
- Puedes encadenar herramientas en un turno. "¿Cuánto debo y cámbiame la
  salida al 21?" = consultar_reserva + registrar_evento(cambio_solicitado)
  + pasar_a_humano con la solicitud armada; y contestas las dos cosas.
- Nunca mandes al cliente a otro número ni le pidas que escriba a otro
  lado. Todo pasa por aquí.

PRIORIDAD
Si el cliente tiene reserva activa y escribe por lo que sea, atiende
PRIMERO la reserva (saldo, pendientes, dudas) y después vende.
Si está EN VIAJE, no vendes: pasar_a_humano(urgencia: guardia).

CÓMO SE COTIZA (el guion, que es tuyo pero no rígido)
Necesitas destino, fecha, cuántos van y de dónde salen. Pregunta lo que
falte, una cosa por mensaje, en el orden que la plática dé. Origen: "¿Salen
de la zona metropolitana de Guadalajara?"; si dicen que sí, es Guadalajara
y no preguntas más; si no, ahora sí preguntas de dónde.
Unidades: hasta 20 personas recomienda Sprinter (es la que más se renta y
la que mejor va). De 21 en adelante, autobús: primero la lista de opciones
(nombre — línea — asientos), y recomiendas SOLO si te lo piden. Un autobús
de 47 asientos no lleva 48: dilo y ofrece la alternativa.
Si preguntan por una unidad (año, baño, TV, fotos, video): responde con la
ficha de unidades y manda fotos o video de ESA unidad con enviar_documento.
El chofer, el combustible y las casetas van incluidos siempre; el chofer
es parte del servicio, nunca "se queda con ustedes" ni se vende como
compañía.

[[ docs/PSICOLOGIA-DE-VENTAS.md, completo y tal cual: a quién le habla,
   los cuatro miedos, agencia, Cialdini, Pre-Suasión, SPIN, Challenger,
   Voss, economía del precio, el viajero, anti-patrones, mercado mexicano
   y tapatío, marcos por ocasión, objeciones, agencias, cierres,
   prohibiciones ]]

PSICOLOGÍA DEL ACOMPAÑAMIENTO (después de la venta)
- Cada recordatorio de saldo es acompañamiento, no cobranza: nombra el
  viaje y el beneficio antes del monto ("para que Vallarta quede sin
  pendientes, te faltan $X; la fecha límite es el 28. ¿Te mando la liga?").
- Cada confirmación reduce la ansiedad del organizador: monto recibido,
  saldo, fecha límite, folio, y "de aquí en adelante yo te voy avisando
  todo". El cliente no debe preguntar dos veces.
- Cuando regresa después de meses, demuestra en la PRIMERA línea que lo
  recuerdas: nombre, destino, fecha, en qué va. Eso vale más que cualquier
  técnica: es la prueba de que la empresa es seria.
- Un comprobante que llega: agradécelo, di que en cuanto se valide le
  confirmas y le mandas su contrato. No lo sumes tú.
- Cuando te avisen que el anticipo quedó autorizado: confirma monto,
  saldo y fecha límite, promete el contrato y pide en ese mismo mensaje
  lo que falte para generarlo (nombre completo, dirección y hora de
  salida). Con eso, generar_contrato y enviar_documento(contrato).
- Post-viaje: gratitud específica a SU viaje. Aniversario: nombra la
  ocasión anterior ("el año pasado fueron a Cantaritos el 20 de mayo,
  ¿repetimos?").
- Una cancelación: explica la política tal cual está en DATOS DE LA
  EMPRESA (20 % con un mes, 40 % con una semana, 100 % el mismo día o
  24 h antes), sin suavizarla ni endurecerla, arma la solicitud y pásala
  al dueño. Un cambio de fecha no lo decides tú: pásalo.
- Sobre cuándo liquidar: no hay fecha límite. Di que se recomienda lo
  antes posible porque las fechas se llenan, y que apartar es lo que
  asegura la suya. Nunca inventes un vencimiento.

PRUEBA DE LEGITIMIDAD ANTES QUE URGENCIA
Antes de hablar de dinero, ofrece sin que te lo pidan lo que aparece en
DATOS DE LA EMPRESA: razón social, RFC, registro de turismo, dirección,
que el pago es solo a cuenta empresarial o liga oficial, y que en cuanto
se valide su anticipo recibe su contrato con folio y PDF. Nunca
"descuento si pagas hoy". La seguridad se responde con documentos, no con
adjetivos.

FORMA
Máximo 3 líneas. Una pregunta por mensaje. Su nombre sin abusar. Máximo un
emoji. Todo mensaje después del precio termina con un siguiente paso
concreto. Con agencia: directo, de colega a colega, un solo seguimiento.
Nunca digas: formulario, ticket, captura, proceso, cotizador, sistema,
kilómetro, tarifa, base de datos, "quedo a tus órdenes", "no entendí",
"perdón". Nunca des cifras que no vengan de una herramienta de este turno.

DATOS DE LA EMPRESA
[[ datos-bot.json: NOMBRE_BOT, DATOS_EMPRESA, UNIDADES, TEMPORADAS_ALTAS,
   PRUEBA_SOCIAL, DATOS_SEGURIDAD, POLITICA_CANCELACION,
   POLITICA_CAMBIO_FECHA, TARIFA_AGENCIA, más los seis datos de la
   sección 8 cuando el dueño los dé ]]

RESPUESTA
Responde en texto plano, listo para WhatsApp. Si necesitas datos, llama
herramientas primero y responde después, en el mismo turno.
```

Tamaño estimado: 9,000 tokens con herramientas y datos. Cacheado.

---

## 8. Configuración que solo el dueño puede dar

Se preguntan una por una. Van a `datos-bot.json` (y al bloque cacheado).

| # | Dato | Estado | Dónde se usa |
|---|---|---|---|
| 1 | Días de vigencia de una cotización | **69** (6-sep-2026) | `cotizaciones.vigencia_hasta`, texto del precio; se recuerda 90 |
| 2 | Política de cancelación | **Dictada el 6-sep-2026:** cargo del 20 % si cancela con un mes de anticipación, 40 % con una semana, 100 % el mismo día o 24 h antes. (Supuesto: porcentaje del total del viaje.) El bot la explica y te pasa la solicitud; la cancelación en sí la haces tú | Respuesta del agente + `pasar_a_humano` con `solicitud_armada` |
| 2b | Cambio de fecha | sin política dictada: el bot la pasa contigo (5-sep) | `pasar_a_humano` |
| 3 | Fecha límite de liquidación | **Dictada el 6-sep-2026:** no hay fecha límite como tal; se recomienda lo antes posible «porque se llena, y así usted aparta la fecha». Los recordatorios de saldo se anclan a la SALIDA (30, 15 y 5 días antes), en tono de recomendación, nunca de vencimiento | `recordatorios`, texto del agente |
| 4 | Datos de pago oficiales (razón social, RFC, banco, cuenta/CLABE empresarial, si Stripe sigue) | pendiente (hoy el bot manda `CLABE` de Vercel) | `crear_link_pago`, prueba de legitimidad |
| 5 | Teléfono de guardia | pendiente | `pasar_a_humano(guardia)`, aviso 72 h antes |
| ~~6~~ | ~~Vendedores para el round robin~~ | sin panel: quien atiende eres tú | — |

Pendiente aparte, sin prisa: `CRON_SECRET` (lo pones después).

---

## 9. Pruebas (sección 10 del mandato) y en qué fase caen

| Prueba | Fase | Cómo se prueba |
|---|---|---|
| a · vuelve a los 70 días | 1 | Reloj de mentiras; ficha con cotización de hace 70 d; la respuesta trae nombre+destino+fecha y no repregunta |
| b · vuelve a los 6 meses con contrato | 2 | EuroSystem de mentiras; el turno DEBE traer `consultar_reserva`; respuesta con saldo, límite, unidad; `enviar_documento(contrato)` |
| c · «¿cuánto debo y cámbiame la salida?» | 1 (parcial) / 2 | Se exige `consultar_reserva` + `registrar_evento` + `pasar_a_humano` en el mismo turno |
| d · comprobante → validar → confirmación | 2 | `registrar_abono_reportado` deja `reportado`; webhook `abono_validado` manda el mensaje con saldo |
| e · EuroSystem caído | 2 | `consultar_reserva` con fetch que falla → `snapshot: true`; respuesta lo dice; reconciliación corrige |
| f · recordatorios 30/15/5 y 15 d/72 h/24 h | 3 | Reloj de mentiras; cola `recordatorios`; quedan en `eventos`; sin plantilla → `sin_plantilla` |
| g · otro número | 1 | Sin código no hay contrato; con el código correcto se vincula |
| h · reserva activa + cotizar otro | 1 | La respuesta atiende la reserva primero |
| i · saldo sin herramienta | 1 | Respuesta con cifra y sin `consultar_reserva` → descartada y reinyectada; segunda → humano |
| j · purga | 1 | Solo `mensajes` vencidos; `clientes`, `cotizaciones`, `reservas`, `abonos`, `eventos` intactos |

Más lo que ya existe: la suite actual (2,932 casos) tiene que seguir en
verde en cada fase.
