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
