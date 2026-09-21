/* ============================================================
   EL AGENTE EN SONNET 5, CON RAZONAMIENTO (21-sep-2026)
   ============================================================
   Dictado del dueño en la revisión del lunes: «siento que el bot no
   piensa, ¿para qué estoy pagando IA?». Tenía razón y era medible: el
   agente que habla con el cliente corría en Haiku 4.5, el modelo más
   chico, sin razonamiento. Escogió Sonnet 5.

   Sonnet 5 no es solo otro nombre. Tres cosas que, mal hechas, NO dan
   error visible sino un bot más tonto que antes:

     · rechaza `temperature` con un 400 → la IA fallaría en cada turno y
       contestaría el guion, en silencio;
     · el razonamiento cuenta dentro de `max_tokens` → con el tope viejo
       (500) se cortaría a media respuesta y tampoco saldría nada;
     · razonar tarda más → con la espera vieja (12 s) se abortaría y,
       otra vez, contestaría el guion.

   Esta batería comprueba las tres, que la respuesta se lea aunque venga
   un bloque de razonamiento antes, y que el costo se cuente con la
   tarifa de Sonnet (el tope en dólares del simulador depende de eso).
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const agente = require(path.join(RAIZ, 'api/_agente.js'));
const entendedor = require(path.join(RAIZ, 'api/_entender.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Una API de mentiras: guarda lo que se le pidió y contesta lo que se le
   diga. Así se ve el cuerpo exacto que saldría a Anthropic. */
function apiDeMentiras(contenido, extra) {
  const pedidos = [];
  const pide = async function (url, opciones) {
    pedidos.push({ url: url, cuerpo: JSON.parse(opciones.body), espera: opciones.signal });
    return {
      ok: true, status: 200,
      json: async function () {
        return Object.assign({ content: contenido, stop_reason: 'end_turn',
          usage: { input_tokens: 300, cache_read_input_tokens: 10000, output_tokens: 400 } }, extra || {});
      },
      text: async function () { return ''; }
    };
  };
  return { pide: pide, pedidos: pedidos };
}
const JSON_BUENO = '{"respuesta":"Va, Nuevo Vallarta desde Villa Corona. ¿Para qué fecha?","datos":{"destino":"Nuevo Vallarta"},"accion":"seguir"}';

/* El chat de pruebas del dueño: Kommo no manda su teléfono, así que su
   número es «5299» + el lead 26818280. Un cliente real tiene su teléfono. */
const DE_PRUEBA = '529926818280';
const CLIENTE_REAL = '5213312345678';

(async function () {
  titulo('primero en pruebas: un cliente real sigue en Haiku, igual que antes');
  {
    const api = apiDeMentiras([{ type: 'text', text: JSON_BUENO }]);
    await agente.conversa('a vallarta el 5 de diciembre', { clave: 'x', pide: api.pide, cliente: CLIENTE_REAL });
    const c = api.pedidos[0] && api.pedidos[0].cuerpo;
    ok('el modelo es Haiku 4.5', c && c.model === 'claude-haiku-4-5-20251001');
    ok('  con su temperatura baja de siempre (0.4)', c && c.temperature === 0.4);
    ok('  sin razonamiento ni esfuerzo (Haiku no los acepta así)', c && !('thinking' in c) && !('output_config' in c));
    ok('  y su tope de siempre (500)', c && c.max_tokens === 500);
  }

  titulo('lo que sale hacia Anthropic en el chat de pruebas');
  {
    const api = apiDeMentiras([{ type: 'text', text: JSON_BUENO }]);
    await agente.conversa('la sprinter de 20 a nuevo vallarta saliendo de villa corona', { clave: 'x', pide: api.pide, cliente: DE_PRUEBA });
    const c = api.pedidos[0] && api.pedidos[0].cuerpo;
    ok('se pidió una sola vez', api.pedidos.length === 1);
    ok('el modelo es Sonnet 5', c && c.model === 'claude-sonnet-5');
    ok('SIN temperature, top_p ni top_k (Sonnet 5 los rechaza con 400)',
      c && !('temperature' in c) && !('top_p' in c) && !('top_k' in c));
    ok('con razonamiento adaptable', c && c.thinking && c.thinking.type === 'adaptive');
    ok('con un nivel de esfuerzo válido',
      c && c.output_config && ['low', 'medium', 'high', 'xhigh', 'max'].indexOf(c.output_config.effort) >= 0);
    ok('con espacio para razonar Y contestar (el tope viejo de 500 cortaba)',
      c && c.max_tokens >= 2000);
    ok('sin «prefill» del asistente (Sonnet 5 lo rechaza)',
      c && Array.isArray(c.messages) && c.messages[c.messages.length - 1].role === 'user');
  }

  titulo('la respuesta se lee aunque venga razonamiento antes');
  {
    const api = apiDeMentiras([
      { type: 'thinking', thinking: '', signature: 'abc' },
      { type: 'text', text: JSON_BUENO }
    ]);
    const r = await agente.conversa('la sprinter de 20 a nuevo vallarta saliendo de villa corona', { clave: 'x', pide: api.pide, cliente: DE_PRUEBA });
    ok('el bloque de razonamiento no estorba: sale la respuesta del texto',
      r && /Nuevo Vallarta/.test(String(r.respuesta)));
    ok('  y los datos que leyó', r && r.datos && r.datos.destino === 'Nuevo Vallarta');
  }

  titulo('si se corta por el tope, no truena: contesta el guion');
  {
    const api = apiDeMentiras([{ type: 'thinking', thinking: '', signature: 'abc' }], { stop_reason: 'max_tokens' });
    let r, tronó = false;
    try { r = await agente.conversa('hola', { clave: 'x', pide: api.pide, cliente: DE_PRUEBA }); } catch (e) { tronó = true; }
    ok('no lanza', !tronó);
    ok('devuelve null para que conteste el guion', r === null);
  }

  titulo('el interruptor para dárselo a todos: AGENTE_SONNET=1');
  {
    process.env.AGENTE_SONNET = '1';
    const api = apiDeMentiras([{ type: 'text', text: JSON_BUENO }]);
    await agente.conversa('a vallarta el 5 de diciembre', { clave: 'x', pide: api.pide, cliente: CLIENTE_REAL });
    delete process.env.AGENTE_SONNET;
    const c = api.pedidos[0] && api.pedidos[0].cuerpo;
    ok('con el interruptor, el cliente real también va en Sonnet 5', c && c.model === 'claude-sonnet-5' && !('temperature' in c));
    const api2 = apiDeMentiras([{ type: 'text', text: JSON_BUENO }]);
    await agente.conversa('a vallarta el 5 de diciembre', { clave: 'x', pide: api2.pide, cliente: CLIENTE_REAL });
    ok('  y al quitarlo vuelve a Haiku', api2.pedidos[0].cuerpo.model === 'claude-haiku-4-5-20251001');
  }

  titulo('la lista de autobuses no la tira el tope de letras (caso real, 21-sep)');
  {
    /* En el chat de pruebas del dueño, para 49 personas, Sonnet copió la
       lista del motor pero le puso adelante «Va, salen de Guadalajara 🙌».
       Midió 489 letras, el tope de 480 la tiró entera y contestó el
       respaldo. El dueño: «los autobuses me los ofreciste muy mal, antes me
       decías en cuáles cabía, su calidad y hasta en los que no». */
    const lista = 'Va, salen de Guadalajara 🙌 Para 49 se ajustan a la capacidad estos:\n' +
      'Marcopolo Paradiso G8 — Premium — 51 asientos\n' +
      'Irizar i6S — Premium — 51 asientos\n' +
      'Irizar i6 — Premium — 47 y 51 asientos\n' +
      'Neobus — Gran Turismo — 50 asientos\n' +
      'Irizar Century — Clásico — 47 y 49 asientos\n\n' +
      'Te los recomiendo porque son los que les caben.\n\n' +
      'Estos no caben, pero también tenemos otras opciones por si gustas:\n' +
      'Irizar PB — Turismo — 47 asientos\n\n' +
      '¿Cuál te late? Si quieres te mando fotos de alguno o te recomiendo uno.';
    ok('la lista mide más de 480 (si no, esta prueba no prueba nada)', lista.length > 480);
    ok('la lista completa con su saludo adelante SÍ pasa', agente.sanea(lista) === lista.replace(/\s+\n/g, '\n').trim());
    ok('pero un texto largo que NO es la lista sigue cayendo en el tope',
      agente.sanea('Mira, te platico. '.repeat(40)) === null);
    ok('y la lista con una cifra de dinero sigue cayendo (los demás candados no se aflojan)',
      agente.sanea(lista + '\nEl G8 sale en $38,000') === null);
  }

  titulo('el costo se cuenta con la tarifa del modelo que contestó');
  {
    const millon = { input_tokens: 1e6, output_tokens: 1e6 };
    ok('Sonnet 5: $2 entrada + $10 salida por millón',
      Math.abs(entendedor.costoDeUso(millon, 'claude-sonnet-5') - 12) < 1e-9);
    ok('Haiku 4.5 sigue en $1 + $5 (el extractor no cambió de modelo)',
      Math.abs(entendedor.costoDeUso(millon) - 6) < 1e-9);
    ok('la caché de Sonnet 5: escribir $2.50, leer $0.20 por millón',
      Math.abs(entendedor.costoDeUso({ cache_creation_input_tokens: 1e6, cache_read_input_tokens: 1e6 }, 'claude-sonnet-5') - 2.7) < 1e-9);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
