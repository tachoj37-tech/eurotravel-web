/* ------------------------------------------------------------
   LOS PRECIOS QUE EL DUEÑO AUTORIZÓ (13-sep-2026)
   ------------------------------------------------------------
   Dictado del dueño, al diseñar cómo se suelta un precio aprendido:

     · cómo autoriza   «me lo dices a mí»: él lo dice en la sesión y
                       se apunta aquí, con su fecha y su frase
     · cuántas veces   tres clientes distintos antes de proponérselo
     · cuál precio     el más reciente
     · y al cliente    «EL PRECIO NO DEBERIA SALIR SOLO TODAVIA»

   AUTORIZAR HOY ES APUNTAR, NO PUBLICAR. Nadie del lado del cliente lee
   este archivo: ni la página, ni el cotizador, ni el bot. Lo lee
   `scripts/precios-al-cerebro.mjs` para no volver a proponer lo que ya
   se autorizó, y nada más. `pruebas/probar-por-autorizar.mjs` se pone
   roja si alguien lo engancha — tiene que ser una decisión suya, a la
   vista, y no un efecto de otra cosa.

   Por qué un archivo y no una tabla: cada autorización queda en Git con
   su fecha y su commit. Un precio que sale al público no se «des-sale»,
   así que conviene que quede escrito quién lo dijo y cuándo.

   CÓMO SE APUNTA UNO. La clave sale de `docs/PRECIOS-POR-AUTORIZAR.md`,
   que la trae escrita en cada viaje:

     { clave: 'zmg|chapala|sprinter|1', total: 7000,
       fecha: '2026-09-13', frase: 'autoriza Chapala' }

   `frase` son sus palabras tal cual. Un renglón por clave: si él cambia
   el precio, se cambia el renglón (y Git guarda el anterior).
   ------------------------------------------------------------ */
'use strict';

/* El interruptor. Mientras sea `false`, lo autorizado no llega a nadie. */
const SALEN_AL_CLIENTE = false;

const AUTORIZADOS = [
];

/* Devuelve la lista de problemas; vacía si todo está bien escrito. */
function revisa(lista) {
  const problemas = [];
  const vistas = new Set();
  (lista || []).forEach(function (a, i) {
    const donde = 'renglón ' + (i + 1);
    if (!a || typeof a.clave !== 'string' || !a.clave.trim()) {
      problemas.push(donde + ': falta la clave');
      return;
    }
    if (!Number.isInteger(a.total) || a.total <= 0) problemas.push(donde + ': el total tiene que ser un entero de pesos');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.fecha || ''))) problemas.push(donde + ': la fecha va como AAAA-MM-DD');
    if (typeof a.frase !== 'string' || !a.frase.trim()) problemas.push(donde + ': falta la frase del dueño');
    if (vistas.has(a.clave)) problemas.push(donde + ': la clave ' + a.clave + ' ya estaba (¿cuál manda?)');
    vistas.add(a.clave);
  });
  return problemas;
}

module.exports = { SALEN_AL_CLIENTE, AUTORIZADOS, revisa };
