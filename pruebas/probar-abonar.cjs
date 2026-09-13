/* ============================================================
   La puerta de abonar, y la vuelta de Stripe
   ------------------------------------------------------------
       node pruebas/probar-abonar.cjs

   PASOS 2 Y 3 del spec de abonos en línea. Aquí se mueve dinero
   de verdad, así que lo que se cuida es lo que cuesta:

     1. NO ES UN ARCHIVO NUEVO en `api/`. El plan Hobby publica
        doce funciones y hay doce exactas.
     2. El monto se revisa EN EL SERVIDOR contra el saldo real,
        nunca contra lo que mandó el navegador.
     3. Las tres comprobaciones de la liga van ANTES: firma,
        Stripe y que quien pide sea el dueño del viaje.
     4. La vuelta de Stripe NO le cree a la dirección de regreso:
        le pregunta a Stripe, y comprueba que ese abono sea de
        este viaje y de este cliente.
     5. Un voucher de OXXO sin pagar NO dice «recibido con éxito».
     6. El abono lleva `tipo` y `folio` en la metadata — sin eso
        existe en Stripe y para nosotros no.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const viaje = fs.readFileSync(path.join(RAIZ, 'api', 'viaje.js'), 'utf8');
const publico = require(path.join(RAIZ, 'api', '_publico.js'));
const saldos = require(path.join(RAIZ, 'api', '_saldo.js'));

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

function entre(texto, desde, hasta) {
  const a = texto.indexOf(desde);
  if (a < 0) return '';
  const b = texto.indexOf(hasta, a);
  return b > a ? texto.slice(a, b) : texto.slice(a);
}

/* ============================================================ */
titulo('no gasta una función de vercel');
{
  const enApi = fs.readdirSync(path.join(RAIZ, 'api'));
  igual('no hay un api/abonar.js suelto', enApi.indexOf('abonar.js'), -1);
  cierto('el motor del saldo es módulo interno', enApi.indexOf('_saldo.js') >= 0);
  cierto('abonar se atiende dentro de viaje.js', /accion === 'abonar'/.test(viaje));
  cierto('y la vuelta de Stripe también', /accion === 'abono'/.test(viaje));
}

/* ============================================================ */
titulo('abonar pasa DESPUÉS de las tres comprobaciones');
{
  /* Éste es el orden que sostiene todo: si abonar estuviera antes,
     cualquiera con una liga inventada podría abrir un cobro. */
  const firma = viaje.indexOf('ligas.abre(');
  const stripeDice = viaje.indexOf('stripe.traeSesion(');
  const esSuyo = viaje.indexOf('acceso.sesionValida(');
  const abonar = viaje.indexOf("accion === 'abonar'");

  cierto('la firma va primero', firma > 0 && firma < stripeDice);
  cierto('luego se le pregunta a Stripe', stripeDice < esSuyo);
  cierto('luego se comprueba que sea suyo', esSuyo < abonar);
  cierto('y hasta el final, abonar', abonar > esSuyo);
}

/* ============================================================ */
titulo('el monto lo decide el servidor, no el navegador');
{
  const rama = entre(viaje, "accion === 'abonar'", "accion === 'abono'");

  cierto('el saldo se cuenta antes de cobrar', /cuentaElSaldo\(\)/.test(rama));
  cierto('y el monto se revisa contra ese saldo',
    /revisaAbono\(cuerpo\.monto, r\.cuenta\.saldo\)/.test(rama));
  cierto('si no pasa, no se abre cobro', /status\(422\)/.test(rama));

  /* Lo que se le cobra a Stripe es el monto REVISADO, no el que llegó. */
  cierto('se cobra el monto revisado', /revisado\.monto \* 100/.test(rama));
  igual('y NUNCA el del navegador', /cuerpo\.monto \* 100/.test(rama), false);

  /* Y el saldo del que se parte no sale de la metadata —que es la de
     cuando se firmó el contrato— sino de la cuenta. */
  igual('el saldo no se lee de la metadata en esta rama',
    /metadata\.saldo/.test(rama), false);
}

/* ============================================================ */
titulo('el abono queda marcado como abono');
{
  const rama = entre(viaje, "accion === 'abonar'", "accion === 'abono'");

  /* Sin `tipo` y `folio` en la metadata, `_saldo.js` no lo encuentra y
     `_reversas.js` no lo reconoce: el abono existiría en Stripe y para
     nosotros no. */
  cierto('lleva el tipo', /tipo: saldos\.TIPO_ABONO/.test(rama));
  cierto('y el folio', /folio: folio/.test(rama));
  cierto('y el monto, para poder sumarlo después', /monto: String\(revisado\.monto\)/.test(rama));
  /* El mismo cliente, para que el abono aparezca junto a su viaje. */
  cierto('va al mismo cliente', /customer: idCliente/.test(rama));

  /* `tipo` tiene que decir lo mismo que lee `_reversas.js`. */
  const reversas = fs.readFileSync(path.join(RAIZ, 'api', '_reversas.js'), 'utf8');
  cierto('y `_reversas.js` lo va a reconocer',
    reversas.indexOf("=== 'abono'") >= 0 && saldos.TIPO_ABONO === 'abono');
}

/* ============================================================ */
titulo('la vuelta de stripe no le cree a la dirección');
{
  const rama = entre(viaje, "accion === 'abono'", '3. LO QUE PUEDE VER');

  /* La dirección de regreso trae el id, pero la escribe cualquiera. */
  cierto('se comprueba la forma del id', /idDeSesionValido\(id\)/.test(rama));
  cierto('y se le pregunta a Stripe', /traeSesion\(id\)/.test(rama));
  cierto('el abono tiene que ser de ESTE cliente', /dueno !== idCliente/.test(rama));
  cierto('  y de ESTE viaje', /esAbonoDe\(suya, folio\)/.test(rama));
  cierto('si no, no se contesta nada', /status\(404\)/.test(rama));

  /* El estado sale de Stripe, no de un «listo» inventado: un voucher de
     OXXO generado y no pagado no puede decir «recibido con éxito». */
  cierto('el estado lo dice Stripe', /estado: laDelAbono\.estado/.test(rama));
  igual('no se da por pagado a la ligera', /estado: 'pagado'/.test(rama), false);

  /* Y el saldo se vuelve a contar DESPUÉS, para que vea el de ahora. */
  cierto('el saldo se recuenta tras el pago', /cuentaElSaldo\(\)/.test(rama));
}

/* ============================================================ */
titulo('lo que sale del viaje sigue pasando por _publico.js');
{
  /* La disciplina de ese archivo es que NADA sale si no está en su lista.
     Pegar el saldo después de `porLista` la rompería. */
  cierto('el saldo se le PASA a publico.viaje', /publico\.viaje\(metadata, consulta\.estado,/.test(viaje));
  igual('y no se pega después', /suyo\.saldo =|\.pagado =/.test(viaje), false);

  /* Y los campos nuevos están declarados allá, no colados. */
  ['pagado', 'abonoMinimo', 'sugerencias'].forEach(function (c) {
    cierto('`' + c + '` está en la lista blanca', publico.CAMPOS_VIAJE.indexOf(c) >= 0);
  });

  /* Sin cuenta, la pantalla no debe creer que puede abonar. */
  const sinCuenta = publico.viaje({ folio: 'ET-1', total: '19000', saldo: '15000' }, 'pagado');
  igual('sin cuenta no salen los de abonar',
    ['pagado', 'abonoMinimo', 'sugerencias'].filter(function (c) {
      return Object.prototype.hasOwnProperty.call(sinCuenta, c);
    }), []);
  igual('  y el saldo es el de la metadata', sinCuenta.saldo, 15000);

  /* Con cuenta, el saldo CONTADO manda sobre el de la metadata: ése es el
     de cuando se firmó el contrato y no sabe de los abonos de después. */
  const conCuenta = publico.viaje({ folio: 'ET-1', total: '19000', saldo: '15000' }, 'pagado',
    { total: 19000, pagado: 9000, saldo: 10000, abonoMinimo: 100, sugerencias: [5000, 10000] });
  igual('con cuenta, manda el saldo contado', conCuenta.saldo, 10000);
  igual('  y sale lo que lleva pagado', conCuenta.pagado, 9000);
  igual('  y las sugerencias', conCuenta.sugerencias, [5000, 10000]);

  /* Y la regla del kilómetro no se afloja ni con la cuenta puesta. */
  const conKm = publico.viaje({ folio: 'ET-1', km: '540', total: '19000' }, 'pagado',
    { total: 19000, pagado: 4000, saldo: 15000, abonoMinimo: 100, sugerencias: [] });
  igual('el kilometraje sigue sin salir', conKm.km, undefined);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
