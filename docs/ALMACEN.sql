-- ============================================================
-- La base del bot de WhatsApp
-- ------------------------------------------------------------
-- ESTA BASE ES SOLO DEL BOT DE LA PÁGINA.
--
-- No es la de EuroSystem y no la toca. La única puerta entre los
-- dos proyectos sigue siendo POST /api/contratos/externo.
--
-- Pedido del dueño, textual (2-sep-2026):
--   «me gustaría que esa base de datos sea independiente, no me
--    gustaría que luego se esté mezclando información que no se
--    debería estar mezclando»
--
-- Por eso va en su PROPIO proyecto, con sus propias llaves. No se
-- agregan estas tablas a una base que ya exista.
--
-- ------------------------------------------------------------
-- CÓMO SE CORRE
-- ------------------------------------------------------------
-- 1. Crear un proyecto NUEVO en Supabase, solo para esto.
-- 2. Pegar todo este archivo en el SQL Editor y correrlo.
-- 3. Copiar de Settings → API:
--      Project URL      → ALMACEN_URL   en Vercel
--      service_role key → ALMACEN_CLAVE en Vercel
--
-- La llave `service_role` se salta RLS a propósito: quien la usa
-- es el servidor, nunca el navegador. Si esa llave llegara al
-- navegador, cualquiera podría leer todas las conversaciones —
-- por eso NO se pone en ninguna variable que empiece con NEXT_
-- ni se manda al cliente, igual que CONTRATOS_API_KEY.
-- ============================================================

-- ------------------------------------------------------------
-- EN QUÉ VA CADA CLIENTE
-- ------------------------------------------------------------
-- La llave son los ÚLTIMOS 10 DÍGITOS del número, y eso no es un
-- detalle: es lo que impide que dos clientes se crucen. La gente
-- escribe desde «521 33...», «+52 1 33...» y «33...» y las tres
-- son la misma persona.
-- ------------------------------------------------------------
create table if not exists fichas (
  numero            text primary key,
  cliente           text not null,          -- el número tal como lo manda Meta
  etapa             text not null default 'escribio',
  viaje             text,
  total             integer,
  anticipo          integer,
  agencia           boolean not null default false,
  contrato          jsonb,                  -- nombre, direcciones, horas
  contrato_avisado  boolean not null default false,
  desde             timestamptz not null default now(),
  visto             timestamptz not null default now()
);

-- Para el tablero, que pide las más recientes.
create index if not exists fichas_visto on fichas (visto desc);

-- ------------------------------------------------------------
-- LO QUE EL BOT LLEVA ENTENDIDO DE CADA QUIEN
-- ------------------------------------------------------------
-- El estado de la máquina de conversación: a dónde va, qué día,
-- cuántos son. Vive poco —seis horas, y se vence al leerlo—
-- porque retomar una conversación de ayer a media pregunta
-- confunde más de lo que ayuda.
-- ------------------------------------------------------------
create table if not exists charlas (
  numero   text primary key,
  estado   jsonb not null,
  cuando   timestamptz not null default now()
);

create index if not exists charlas_cuando on charlas (cuando);

-- ------------------------------------------------------------
-- LA CONVERSACIÓN
-- ------------------------------------------------------------
-- El dueño pidió que durara «al menos un mes». Aquí es donde va a
-- leer el CRM que se haga después: una bandeja compartida no
-- necesita nada más que esto y las fichas.
--
-- `de` dice quién habló: 'cliente', 'bot' o 'dueno'. Sin eso la
-- conversación no se puede volver a pintar.
-- ------------------------------------------------------------
create table if not exists mensajes (
  id       bigserial primary key,
  numero   text not null,
  de       text not null,
  texto    text not null,
  tipo     text not null default 'texto',
  cuando   timestamptz not null default now()
);

-- Un índice por número Y fecha: pintar una conversación es pedir
-- los últimos N de UN número, y sin esto habría que leer la tabla
-- entera para eso.
create index if not exists mensajes_numero_cuando on mensajes (numero, cuando desc);
create index if not exists mensajes_cuando on mensajes (cuando);

-- ------------------------------------------------------------
-- EL CANDADO
-- ------------------------------------------------------------
-- RLS prendido y SIN políticas: nadie que use la llave pública
-- (`anon`) puede leer ni escribir NADA. Solo el servidor, con
-- `service_role`, que se salta RLS.
--
-- Prenderlo sin políticas parece raro y es a propósito: es la
-- única configuración en la que un error de configuración del
-- lado del navegador no puede exponer las conversaciones de los
-- clientes. Si un día hace falta una pantalla que lea de aquí,
-- lee a través del servidor, no directo.
-- ------------------------------------------------------------
alter table fichas   enable row level security;
alter table charlas  enable row level security;
alter table mensajes enable row level security;

-- ------------------------------------------------------------
-- 5-SEP-2026 · EL PRECIO POR CONFIRMAR Y LOS TICKETS
-- ------------------------------------------------------------
-- Regla del dueño: el bot no da precio sin su «va». El precio que
-- calculó se guarda en la ficha hasta que él conteste, para que
-- sobreviva a que Vercel recicle la instancia entre el ticket y
-- la respuesta. Y el ticket (id del mensaje de WhatsApp → cliente)
-- se guarda por lo mismo: el «va» llega citando el ticket, y sin
-- esto una instancia nueva no sabría de qué cliente habla.
-- ------------------------------------------------------------
alter table fichas add column if not exists por_confirmar jsonb;
-- El viaje en datos (origen, destino, fechas, pasajeros, unidad) desde que
-- se dio el precio: es lo que va al contrato con el «va» del dueño a la
-- ficha. Y el folio + liga del contrato ya registrado, para no subirlo dos
-- veces.
alter table fichas add column if not exists viaje_datos jsonb;
alter table fichas add column if not exists contrato_subido jsonb;

create table if not exists tickets (
  id       text primary key,                 -- el id del mensaje, lo pone Meta
  cliente  text not null,                    -- de qué cliente habla ese ticket
  creado   timestamptz not null default now()
);
create index if not exists tickets_creado on tickets (creado desc);

-- Nace cerrada, como las demás.
alter table tickets enable row level security;

-- ------------------------------------------------------------
-- 5-SEP-2026 · LOS PRECIOS QUE EL DUEÑO YA DIO
-- ------------------------------------------------------------
-- Dictado del dueño: «yo te pongo el precio y te aprendes el
-- viaje; si alguien va a hacer el mismo viaje me vas a recomendar
-- ese precio». Cada «va» o número suyo deja un renglón; el ticket
-- del siguiente cliente con el mismo viaje (origen, destino,
-- unidad, días) le enseña lo que dio antes y le sugiere el último.
-- ------------------------------------------------------------
create table if not exists precios (
  id        bigserial primary key,
  clave     text not null,                  -- origen|destino|unidad|dias, normalizado
  origen    text,
  destino   text,
  unidad    text,
  dias      integer,
  pasajeros integer,
  total     integer not null,
  anticipo  integer,
  fijado    boolean not null default false, -- true = lo escribió él; false = dijo «va» al calculado
  cliente   text,                           -- últimos 10 dígitos, para el rastro
  salida    text,                           -- AAAA-MM-DD del viaje
  cuando    timestamptz not null default now()
);
create index if not exists precios_clave on precios (clave, cuando desc);

-- Nace cerrada, como las demás.
alter table precios enable row level security;

-- ------------------------------------------------------------
-- 6-SEP-2026 · EL SEGUIMIENTO AL QUE NO CONTESTÓ
-- ------------------------------------------------------------
-- Dictado del dueño: «una vez que se mandó la cotización, si el
-- cliente no contestó: a las 4 horas, a las 24 y a las 72; si
-- contesta, ya no». Cada 15 minutos un cron de Vercel lee las
-- fichas con precio y toques pendientes (docs/SEGUIMIENTO.md).
-- Sin estas columnas el bot sigue funcionando, pero avisa en el
-- registro y NO hay seguimiento.
-- ------------------------------------------------------------
alter table fichas add column if not exists precio_en  timestamptz;                 -- cuándo recibió el precio
alter table fichas add column if not exists toques     integer not null default 0;  -- cuántos toques van (0-3)
alter table fichas add column if not exists cliente_en timestamptz;                 -- su último mensaje
create index if not exists fichas_seguimiento on fichas (precio_en)
  where etapa = 'con_precio' and toques < 3;

-- ------------------------------------------------------------
-- 7-SEP-2026 · NO OLVIDAR LA COTIZACIÓN PASADA
-- ------------------------------------------------------------
-- Pedido del dueño: «al iniciar otra cotización que no olvide la
-- pasada». La ficha archiva los viajes que ya pasaron por precio
-- (hasta 5), y cada ticket guarda SU viaje: con dos cotizaciones
-- en el aire, el «va» a cada ticket confirma el suyo.
-- ------------------------------------------------------------
alter table fichas  add column if not exists viajes jsonb not null default '[]'::jsonb;
alter table tickets add column if not exists carga  jsonb;

-- ------------------------------------------------------------
-- 7-SEP-2026 · EL RELEVO
-- ------------------------------------------------------------
-- El dueño toma un chat («yo» citando un mensaje del cliente) y el
-- bot se calla y le reenvía lo que el cliente escriba; con «bot» se
-- lo devuelve a la IA. Vive aquí para sobrevivir a la instancia.
-- ------------------------------------------------------------
alter table fichas add column if not exists en_manos_de text;   -- 'dueno' o nulo
