-- ============================================================
-- LIMPIAR LAS CONVERSACIONES DE PRUEBA DEL BOT
-- ============================================================
-- Para probar el bot desde cero, sin que un chat contaminado de
-- las pruebas anteriores le cambie la respuesta (8-sep-2026).
--
-- Se corre en Supabase → proyecto del bot → SQL Editor. Borra lo
-- que el bot recuerda de CADA número: la ficha (etapa, precio,
-- seguimiento), la plática (a dónde va, cuántos son), la
-- conversación guardada, los tickets, los ids vistos y el registro
-- por turno de la IA. NO toca el esquema ni las políticas.
--
-- DESPUÉS de correrlo: Vercel → eurotravel-web → Deployments → los
-- tres puntos del último → Redeploy. Una instancia caliente todavía
-- puede tener la plática en memoria; el redeploy la tira.
--
-- Primero mira qué hay (esto no borra nada):
-- ------------------------------------------------------------
select 'fichas'   as tabla, count(*) from fichas
union all select 'charlas',  count(*) from charlas
union all select 'mensajes', count(*) from mensajes
union all select 'tickets',  count(*) from tickets
union all select 'vistos',   count(*) from vistos
union all select 'turnos',   count(*) from turnos
union all select 'precios',  count(*) from precios;

-- Los números que el bot conoce, por si quieres conservar alguno
-- (si sí, agrega «where numero <> '33XXXXXXXX'» a cada delete):
select numero, cliente, etapa, total, visto from fichas order by visto desc;

-- ------------------------------------------------------------
-- BORRAR. No hay vuelta atrás (plan gratuito, sin respaldo).
-- ------------------------------------------------------------
delete from mensajes;
delete from turnos;
delete from tickets;
delete from vistos;
delete from charlas;
delete from fichas;

-- ------------------------------------------------------------
-- OPCIONAL · los precios que el bot «aprendió» en las pruebas.
-- Son los «va» y números que diste en chats de prueba; si se quedan,
-- el bot te los va a sugerir como precio anterior para el mismo
-- viaje. Si todos fueron de prueba, quita los guiones de abajo.
-- ------------------------------------------------------------
-- delete from precios;

-- Comprobar que quedó en cero:
select 'fichas'   as tabla, count(*) from fichas
union all select 'charlas',  count(*) from charlas
union all select 'mensajes', count(*) from mensajes
union all select 'tickets',  count(*) from tickets
union all select 'vistos',   count(*) from vistos
union all select 'turnos',   count(*) from turnos;
