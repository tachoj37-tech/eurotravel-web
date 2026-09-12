/* ============================================================
   EL SEGUIMIENTO QUE ESCRIBE LA IA (12-sep-2026)
   ============================================================
   Dictado del dueño: «que la IA redacte los mensajes de cada 22 horas,
   cada 3 días y cada 7».

   Hasta hoy eran diez frases fijas por toque, turnándose. Buenas, pero
   genéricas: «¿te llegó bien la cotización?». La IA nombra SU viaje, y
   eso es la diferencia entre un mensaje de plantilla y uno que suena a
   que alguien se acuerda de ti.

   Lo delicado: esto SALE SOLO. Nadie lo lee antes de que le llegue al
   cliente. Así que lo que de verdad se prueba aquí no es que la IA
   escriba bonito —eso se ve hablándole— sino que **la red nunca falle**:

     · lo que traiga dinero NO sale
     · si la IA se cae, se tarda o no hay clave, sale la frase de siempre
     · pase lo que pase, al cliente le llega algo

   Todo con una puerta de mentiras: ni una llamada de verdad, ni un peso
   gastado en correr esta batería.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const agente = require(path.join(RAIZ, 'api/_agente.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Una IA de mentiras que contesta lo que le digamos. */
function iaQueDice(texto, opciones) {
  const o = opciones || {};
  return function () {
    if (o.truena) return Promise.reject(new Error('sin red'));
    if (o.status) return Promise.resolve({ ok: false, status: o.status, text: async function () { return 'ups'; } });
    return Promise.resolve({
      ok: true, status: 200,
      json: async function () {
        return { content: [{ type: 'text', text: texto }], usage: { input_tokens: 10, output_tokens: 20 } };
      }
    });
  };
}

const VIAJE = { destino: 'Puerto Vallarta', salida: '20 de diciembre', gente: 40, unidad: 'Irizar i6S' };
const BASE = { toque: 1, cliente: '5213311111111', clave: 'de-mentiras', viaje: VIAJE };

(async function () {

  titulo('cuando la IA escribe algo bueno, se usa');
  {
    const suyo = await agente.redactaSeguimiento(Object.assign({}, BASE, {
      pide: iaQueDice('¿Cómo ves lo de Vallarta del 20? Si le movemos algo, aquí ando 🙌')
    }));
    ok('sale lo que escribió', /Vallarta del 20/.test(suyo || ''));
    ok('  y viene limpio, sin comillas', !/^["'«]/.test(suyo || ''));
  }

  titulo('lo que trae dinero NO sale — el candado que más importa');
  {
    /* El precio lo dicta el dueño. Que la IA lo repita en un recordatorio
       es exactamente lo que no puede pasar: si se equivoca en un dígito,
       el cliente tiene por escrito un precio que nadie autorizó. */
    const conDinero = [
      'Oye, ¿cómo ves los $19,000 de tu viaje a Vallarta?',
      'Te recuerdo que quedamos en 19000 pesos.',
      'Sigue en pie tu cotización de $19,000 MXN.'
    ];
    for (const t of conDinero) {
      const suyo = await agente.redactaSeguimiento(Object.assign({}, BASE, { pide: iaQueDice(t) }));
      ok('«' + t.slice(0, 40) + '…» no sale', suyo === null);
    }
  }

  titulo('cuando la IA no puede, no se queda callado');
  {
    const casos = [
      ['se cae la red', { truena: true }],
      ['contesta 500', { status: 500 }],
      ['contesta 429 (sin crédito)', { status: 429 }]
    ];
    for (const [nombre, fallo] of casos) {
      const suyo = await agente.redactaSeguimiento(Object.assign({}, BASE, {
        pide: iaQueDice('lo que sea', fallo)
      }));
      ok('si ' + nombre + ', devuelve null (y arriba va el texto fijo)', suyo === null);
    }

    /* Sin clave ni siquiera se intenta: no se gasta una llamada para nada. */
    const sinClave = await agente.redactaSeguimiento(Object.assign({}, BASE, {
      clave: null, pide: iaQueDice('no debería llamarse')
    }));
    ok('sin clave configurada, ni lo intenta', sinClave === null);
  }

  titulo('la frase fija sigue ahí para los tres toques');
  {
    /* La red: si esto se rompe, un fallo de la IA deja al cliente sin
       nada, y ésa es la única falla que no se puede permitir. */
    const rec = require(path.join(RAIZ, 'api/_recordatorios.js'));
    for (const t of [1, 2, 3]) {
      const fijo = rec.recordatorio(t, { cliente: '5213311111111', vuelta: 3 });
      ok('el toque ' + t + ' tiene su texto de siempre', !!fijo && fijo.length > 10);
    }
  }

  titulo('no se redacta lo que no toca');
  {
    for (const t of [0, 4, null, undefined]) {
      const suyo = await agente.redactaSeguimiento(Object.assign({}, BASE, {
        toque: t, pide: iaQueDice('no debería llamarse')
      }));
      ok('toque «' + t + '» no se redacta', suyo === null);
    }
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
