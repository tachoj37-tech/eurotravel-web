/* ============================================================
   LOS CAMINOS DEL QUE LLEGA (12-sep-2026)
   ============================================================
   Hasta hoy el saludo no ofrecía NINGÚN botón: la única salida era
   ponerse a escribir. Dictado del dueño: que pueda escoger.

   Y dos días de trabajo cabe en una frase suya:

     «Hablar con alguien o consultar cotizaciones previas, porque es
      lo mismo, prácticamente.»

   Tenía razón, y de paso resolvió un problema que el diseño de tres
   botones no podía. Un botón de «mi cotización anterior» necesita que
   el bot RECUERDE ese viaje, y los viajes archivados viven en un
   `Map()` en memoria: en serverless cada instancia tiene la suya y se
   recicla. Ese botón habría acertado unos minutos y fallado por días —
   diciéndole «no encuentro nada» justo al cliente al que ya le habían
   dado un precio.

   Mandándolo a una persona no falla nunca: si el bot todavía tiene la
   ficha se la pasa al vendedor, y si ya la perdió, el vendedor la
   busca. El cliente no nota la diferencia.

   Esta batería cuida las tres cosas que pueden romperse sin avisar:
   que los botones quepan, que el bot ENTIENDA sus propios botones, y
   que quien diga «ya me cotizaron» no acabe empezando de cero.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const conv = require(path.join(RAIZ, 'bot.js'));

const HOY = '2026-09-12';

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

titulo('el saludo ofrece por dónde empezar');
{
  const r = conv.respuestaA('hola', null, HOY);
  const ops = r.opciones || [];

  ok('trae botones', ops.length > 0);
  ok('  uno para cotizar', ops.some(function (o) { return /cotizar/i.test(o); }));
  ok('  y otro para una persona', ops.some(function (o) { return /hablar/i.test(o); }));

  /* WhatsApp no enseña botones de más de 20 caracteres. Si uno se pasa,
     no sale cortado: puede no salir. */
  ok('ninguno se pasa de 20 caracteres',
    ops.every(function (o) { return o.length <= 20; }));
  ok('  y no son más de tres', ops.length <= 3);

  /* CAMBIÓ DE LADO EL 12-sep-2026, y por una buena razón del dueño.
     Aquí se exigía que el mensaje explicara «si ya cotizaste, dale a
     Hablar con alguien». Mandó quitar esa frase: era enseñarle al
     cliente a usar los botones, y un botón que necesita instrucciones
     está mal puesto.

     Lo que se pide ahora es que la pregunta NOMBRE los dos caminos, para
     que quien lee el texto y quien solo mira los botones entiendan lo
     mismo. */
  /* Y CAMBIÓ OTRA VEZ EL MISMO DÍA. Esto exigía que la pregunta nombrara
     los dos caminos —«¿qué necesitas: cotizar un viaje o hablar con
     alguien?»— y el dueño lo recortó a «¿Qué necesitas?» a secas: los
     botones ya lo dicen, y repetirlo es leerle en voz alta lo que tiene
     enfrente.

     Lo que se cuida ahora es lo que de verdad importa y no cambia con el
     gusto: que PREGUNTE algo y que los botones estén. Los dos canales los
     pintan —WhatsApp por su cuenta y la página con `pintaAtajos`—, así
     que nadie se queda sin ver las opciones. */
  ok('pregunta qué necesita', /qu[ée] necesitas/i.test(r.texto));
  ok('  sin enumerar lo que ya dicen los botones',
    !/cotizar un viaje/i.test(r.texto));
  ok('  y sin explicar cómo usarlos', !/dale a \*/i.test(r.texto));

  /* La regla de forma del guion: nada de más de tres renglones. */
  const renglones = r.texto.split('\n').filter(function (l) { return l.trim(); });
  ok('  sin pasarse de tres renglones', renglones.length <= 3);
}

titulo('el bot entiende sus propios botones');
{
  /* Un botón que se ofrece y no se entiende es peor que no ponerlo: el
     cliente le pica y no pasa nada. */
  const saludo = conv.respuestaA('hola', null, HOY);
  for (const boton of (saludo.opciones || [])) {
    const r = conv.respuestaA(boton, null, HOY);
    ok('«' + boton + '» lleva a algún lado',
      !!(r && r.texto) && !r.noEntendio);
  }

  const cotiza = conv.respuestaA('Cotizar un viaje', null, HOY);
  ok('«Cotizar un viaje» arranca un viaje, no pasa a persona',
    cotiza.pasa !== true && /d[oó]nde/i.test(cotiza.texto));

  const persona = conv.respuestaA('Hablar con alguien', null, HOY);
  ok('«Hablar con alguien» sí pasa a persona', persona.pasa === true);
}

titulo('quien ya cotizó no empieza de cero');
{
  /* Todas estas acababan en «¿a dónde va el plan?» — mandando a
     empezar de nuevo a alguien que ya tenía un precio dado. */
  const frases = [
    'mi cotización',
    'consultar cotizaciones previas',
    'quiero ver mi cotizacion anterior',
    'ya me cotizaron',
    'ya cotizé antes',
    'necesito mi presupuesto anterior'
  ];
  for (const f of frases) {
    const r = conv.respuestaA(f, null, HOY);
    ok('«' + f + '» va a una persona', r.pasa === true);
  }
}

titulo('y lo que NO debe irse a una persona');
{
  /* El candado al revés: si esto se rompe, el bot deja de cotizar y
     manda todo al vendedor — que es justo lo que el bot existe para
     evitar. */
  const cotizables = [
    'quiero cotizar a vallarta',
    'cuanto cuesta una sprinter a chapala',
    'hola',
    'somos 40 a mazatlan',
    'que unidades tienen'
  ];
  for (const f of cotizables) {
    const r = conv.respuestaA(f, null, HOY);
    ok('«' + f + '» lo atiende el bot', r.pasa !== true);
  }
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
