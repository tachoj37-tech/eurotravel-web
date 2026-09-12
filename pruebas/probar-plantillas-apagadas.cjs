/* ============================================================
   LAS PLANTILLAS DE META SE PAGAN — Y ESTÁN APAGADAS (12-sep-2026)
   ============================================================
   Dictado del dueño: «solo úsalas si puedes usarlas sin Meta, Meta cobra
   carísimo».

   Meta deja mandar texto libre solo dentro de las 24 horas siguientes al
   último mensaje del cliente. Fuera de esa ventana, la única forma de
   escribirle es una PLANTILLA aprobada, y ésa se paga por mensaje.

   El seguimiento del bot tiene tres toques: 22 horas, 3 días y 7 días. El
   primero cae DENTRO de la ventana a propósito —por eso son 22 y no 24— y
   es gratis. Los otros dos caen fuera.

   HASTA HOY el único freno para no pagar era que la variable
   `WHATSAPP_PLANTILLA_TOQUE1` no estuviera puesta. Eso no es un freno: es
   un descuido que funciona. Bastaba con que alguien la configurara —o que
   siguiera puesta de las pruebas de septiembre— para empezar a pagar por
   cada seguimiento, sin que nadie lo decidiera y sin que se notara hasta
   la factura.

   Desde hoy hacen falta DOS cosas: la plantilla Y `PLANTILLAS_DE_PAGO=1`.

   Esta batería cuida el candado por los dos lados: que apagado no se
   mande NADA de pago aunque las plantillas estén configuradas, y que
   encendido el camino siga funcionando —porque el mecanismo no se borró,
   solo se puso detrás de una decisión.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* El código del candado, leído del archivo. Se comprueba así y no
   llamando al webhook entero porque lo que se vigila es una REGLA, y una
   regla se lee: si alguien la quita, esto lo caza aunque el resto siga
   pasando. */
const fs = require('fs');
const codigo = fs.readFileSync(path.join(RAIZ, 'api/whatsapp.mjs'), 'utf8');

titulo('el candado existe y está en el camino del pago');
{
  ok('se lee `PLANTILLAS_DE_PAGO` en el código',
    /PLANTILLAS_DE_PAGO/.test(codigo));

  /* Lo que importa: que el nombre de la plantilla SOLO se tome cuando el
     interruptor está encendido. Si alguien vuelve a leer la variable
     directo, se paga sin decidirlo. */
  const linea = codigo.split('\n').find(function (l) {
    return /WHATSAPP_PLANTILLA_TOQUE' \+ d\.toque/.test(l);
  });
  ok('el nombre de la plantilla se lee detrás del interruptor',
    !!linea && /dePago\s*\?/.test(linea));

  ok('y el interruptor pide exactamente «1», no cualquier valor',
    /PLANTILLAS_DE_PAGO[^\n]*\)\s*\.trim\(\)\s*===\s*'1'/.test(codigo));
}

titulo('apagado, no se manda nada de pago');
{
  /* Se simula el entorno de producción de hoy: plantillas configuradas
     —como pudieron quedar de las pruebas de septiembre— y el interruptor
     sin poner. */
  const antes = {
    pago: process.env.PLANTILLAS_DE_PAGO,
    t1: process.env.WHATSAPP_PLANTILLA_TOQUE1
  };
  delete process.env.PLANTILLAS_DE_PAGO;
  process.env.WHATSAPP_PLANTILLA_TOQUE1 = 'seguimiento_24h';

  const dePago = String(process.env.PLANTILLAS_DE_PAGO || '').trim() === '1';
  const nombre = dePago ? process.env.WHATSAPP_PLANTILLA_TOQUE1 : null;

  ok('con la plantilla puesta pero el interruptor apagado, no hay plantilla',
    nombre === null);
  ok('  y eso manda el toque al dueño, no al cliente', !nombre);

  /* Y los valores que NO deben encenderlo: sólo «1» cuenta. */
  for (const v of ['0', 'si', 'true', 'SI', '', ' ']) {
    process.env.PLANTILLAS_DE_PAGO = v;
    const enc = String(process.env.PLANTILLAS_DE_PAGO || '').trim() === '1';
    ok('«' + v + '» no enciende el pago', enc === false);
  }

  if (antes.pago === undefined) delete process.env.PLANTILLAS_DE_PAGO;
  else process.env.PLANTILLAS_DE_PAGO = antes.pago;
  if (antes.t1 === undefined) delete process.env.WHATSAPP_PLANTILLA_TOQUE1;
  else process.env.WHATSAPP_PLANTILLA_TOQUE1 = antes.t1;
}

titulo('encendido a propósito, el camino sigue vivo');
{
  const antes = process.env.PLANTILLAS_DE_PAGO;
  process.env.PLANTILLAS_DE_PAGO = '1';
  process.env.WHATSAPP_PLANTILLA_TOQUE1 = 'seguimiento_24h';

  const dePago = String(process.env.PLANTILLAS_DE_PAGO || '').trim() === '1';
  const nombre = dePago ? process.env.WHATSAPP_PLANTILLA_TOQUE1 : null;
  ok('con el interruptor en 1 y su plantilla, sí hay plantilla',
    nombre === 'seguimiento_24h');

  /* Sin plantilla configurada, encender el interruptor no inventa una. */
  delete process.env.WHATSAPP_PLANTILLA_TOQUE1;
  const sinNombre = dePago ? process.env.WHATSAPP_PLANTILLA_TOQUE1 : null;
  ok('  pero encendido sin plantilla sigue sin mandar nada',
    sinNombre === undefined || sinNombre === null);

  if (antes === undefined) delete process.env.PLANTILLAS_DE_PAGO;
  else process.env.PLANTILLAS_DE_PAGO = antes;
}

titulo('el toque gratis sigue siendo gratis');
{
  const rec = require(path.join(RAIZ, 'api/_recordatorios.js'));
  /* Las 22 horas no son un número bonito: es lo que hace que el primer
     toque caiga DENTRO de la ventana de 24 h y no cueste. Si alguien lo
     sube a 24 o más, se acabó lo gratis. */
  const horas = rec.A_LAS_HORAS || [];
  ok('el primer toque va antes de las 24 horas',
    Array.isArray(horas) ? horas[0] < 24 : true);
  ok('  y hay texto para ese toque', !!rec.recordatorio(1, { cliente: '5213311111111' }));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
