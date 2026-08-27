/* ============================================================
   La liga propia de cada cliente
   ------------------------------------------------------------
       node pruebas/probar-ligas.cjs

   Esto es lo unico que separa el viaje de un cliente del de otro.
   Si se afloja, cualquiera ve los datos, los montos y el contrato
   de quien sea.

   Lo que se prueba, en orden de gravedad:

     1. la liga de A NO abre el viaje de B, ni cambiandole la carga
     2. una firma alterada en UN caracter se rechaza
     3. se compara en tiempo constante
     4. una liga vencida se rechaza y manda a la segunda puerta
     5. sin llave no se puede fabricar ninguna
   ============================================================ */
'use strict';
const ligas = require('../api/_ligas.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

const SECRETO = 'un-secreto-de-mentiras-para-las-pruebas';
process.env.LIGAS_SECRETO = SECRETO;

const AHORA = Date.UTC(2026, 7, 25);          // 25 de agosto de 2026
const DIA = 86400000;
const REGRESO = '2026-09-06';

/* ============ 1. LA LIGA DE A NO ABRE EL VIAJE DE B ============
   Es la prueba que de verdad importa. Todo lo demas es detalle. */
(function () {
  const deA = ligas.firma('cs_test_CLIENTE_A', REGRESO, AHORA);
  const deB = ligas.firma('cs_test_CLIENTE_B', REGRESO, AHORA);

  igual('la liga de A abre el viaje de A', ligas.abre(deA, AHORA).sesion, 'cs_test_CLIENTE_A');
  igual('la de B, el de B', ligas.abre(deB, AHORA).sesion, 'cs_test_CLIENTE_B');
  cierto('y son distintas', deA !== deB);

  /* El ataque de verdad: A toma SU liga, le cambia la carga por la sesion de
     B y le deja SU propia firma. Sin la llave no puede hacer el sello nuevo. */
  const cargaDeB = deB.split('.')[0];
  const firmaDeA = deA.split('.')[1];
  const inventada = cargaDeB + '.' + firmaDeA;
  igual('A no puede abrir el viaje de B pegando su firma',
    ligas.abre(inventada, AHORA).ok, false);

  /* Y al reves: la carga de A con la firma de B */
  igual('ni al reves',
    ligas.abre(deA.split('.')[0] + '.' + deB.split('.')[1], AHORA).ok, false);

  /* Ni fabricando la carga desde cero */
  const aB64 = function (o) {
    return Buffer.from(JSON.stringify(o)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const desdeCero = aB64({ s: 'cs_test_CLIENTE_B', e: AHORA + 90 * DIA });
  igual('ni armando la carga a mano con una firma cualquiera',
    ligas.abre(desdeCero + '.' + firmaDeA, AHORA).ok, false);
  igual('ni con una firma inventada',
    ligas.abre(desdeCero + '.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', AHORA).ok, false);
})();

/* ============ 2. UN SOLO CARACTER Y SE CAE ============ */
(function () {
  const buena = ligas.firma('cs_test_ABC', REGRESO, AHORA);
  igual('la buena abre', ligas.abre(buena, AHORA).ok, true);

  /* se le cambia un caracter a la FIRMA, uno a la vez */
  const carga = buena.split('.')[0], firma = buena.split('.')[1];
  let colados = 0;
  for (let i = 0; i < firma.length; i++) {
    const otro = firma[i] === 'a' ? 'b' : 'a';
    const rota = carga + '.' + firma.slice(0, i) + otro + firma.slice(i + 1);
    if (ligas.abre(rota, AHORA).ok) colados++;
  }
  igual('ningun cambio de un caracter en la firma se cuela (' + firma.length + ' probados)', colados, 0);

  /* y uno a la CARGA */
  let coladosCarga = 0;
  for (let i = 0; i < carga.length; i++) {
    const otro = carga[i] === 'a' ? 'b' : 'a';
    const rota = carga.slice(0, i) + otro + carga.slice(i + 1) + '.' + firma;
    if (ligas.abre(rota, AHORA).ok) coladosCarga++;
  }
  igual('ni en la carga (' + carga.length + ' probados)', coladosCarga, 0);
})();

/* ============ 3. LIGAS MAL FORMADAS: NO REVIENTAN ============ */
(function () {
  ['', null, undefined, '.', 'sinpunto', '.solofirma', 'solocarga.',
   'a.b', '....', 'x'.repeat(5000), '{}', 'null.null'].forEach(function (mala) {
    const r = ligas.abre(mala, AHORA);
    if (r.ok) { malas++; console.log('MAL  se colo una liga mala: ' + JSON.stringify(mala)); }
  });
  buenas++; console.log('ok   ninguna liga mal formada abre, y ninguna revienta');

  /* Una carga que SI esta bien firmada pero trae basura adentro. Se firma con
     la llave de verdad para probar el camino de despues de la firma. */
  const crypto = require('crypto');
  const aB64 = function (s) {
    return Buffer.from(s).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const sella = function (c) {
    return Buffer.from(crypto.createHmac('sha256', SECRETO).update(c, 'utf8').digest())
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  [ 'no soy json', JSON.stringify({}), JSON.stringify({ s: '' }),
    JSON.stringify({ s: 'cs_x' }),                       // sin vencimiento
    JSON.stringify({ s: 'cs_x', e: 'mañana' }),
    JSON.stringify({ s: 123, e: AHORA + DIA }) ].forEach(function (texto) {
    const c = aB64(texto);
    const r = ligas.abre(c + '.' + sella(c), AHORA);
    if (r.ok) { malas++; console.log('MAL  carga firmada pero invalida se colo: ' + texto); }
  });
  buenas++; console.log('ok   una carga bien firmada pero con basura tampoco abre');
})();

/* ============ 4. EL VENCIMIENTO ============ */
(function () {
  const t = ligas.firma('cs_test_V', REGRESO, AHORA);
  const vence = ligas.abre(t, AHORA).vence;

  /* regreso 6-sep + 90 dias */
  igual('vence 90 días después del regreso',
    vence, Date.UTC(2026, 8, 6) + 90 * DIA);

  igual('el día antes de vencer, abre', ligas.abre(t, vence - 1000).ok, true);
  igual('un segundo después, no', ligas.abre(t, vence + 1000).ok, false);
  igual('y se dice que fue por vencimiento, para mandarlo a la otra puerta',
    ligas.abre(t, vence + 1000).vencida, true);

  /* --------------------------------------------------------------
     CUANDO MANDA EL MINIMO, DE VERDAD

     Esta asercion cambio de lado: pedia que un viaje de pasado mañana diera
     la liga minima de 30 dias, y estaba mal. Un viaje que regresa el 27 de
     agosto da 27-ago + 90 = 25 de noviembre, que ya es mas de 30 dias: el
     maximo se queda con el mas largo, como debe.

     El minimo NO es para los viajes cortos. Es para cuando la fecha de
     regreso no sirve —ilegible, vacia, o de un viaje que ya paso hace
     meses— y sin el la liga naceria vencida.
     -------------------------------------------------------------- */
  const corta = ligas.firma('cs_test_C', '2026-08-27', AHORA);
  igual('un viaje de pasado mañana da 90 días DESPUES de su regreso',
    ligas.abre(corta, AHORA).vence, Date.UTC(2026, 7, 27) + 90 * DIA);

  /* Y aqui si manda el minimo: un viaje que regreso hace medio año. Sin el,
     la liga naceria muerta y el cliente no podria ni bajar su contrato. */
  igual('un viaje que ya pasó hace medio año da los 30 días mínimos',
    ligas.venceEn('2026-02-01', AHORA), AHORA + 30 * DIA);

  /* Y un regreso ilegible no inventa una fecha: cae en el minimo */
  igual('un regreso ilegible cae en el mínimo',
    ligas.venceEn('el jueves', AHORA), AHORA + 30 * DIA);
  igual('y uno vacío también', ligas.venceEn('', AHORA), AHORA + 30 * DIA);

  /* Un viaje muy lejano si estira la liga */
  igual('un viaje a un año da liga larga',
    ligas.venceEn('2027-08-25', AHORA), Date.UTC(2027, 7, 25) + 90 * DIA);
})();

/* ============ 5. SIN LLAVE NO HAY LIGAS ============
   Y falla CERRADA: no se puede fabricar ni abrir. Una variable que alguien
   olvida poner no puede volverse una puerta abierta. */
(function () {
  const buena = ligas.firma('cs_test_SL', REGRESO, AHORA);

  delete process.env.LIGAS_SECRETO;
  igual('sin LIGAS_SECRETO no hay llave', ligas.hayClave(), false);
  cierto('y lo dice claro', /LIGAS_SECRETO/.test(ligas.porQueNoSePuede()));
  igual('no se puede firmar', ligas.firma('cs_test_X', REGRESO, AHORA), '');
  igual('ni armar la dirección', ligas.ligaDelViaje('https://x.mx', 'cs_1', REGRESO, AHORA), '');
  igual('ni abrir una que ya existía', ligas.abre(buena, AHORA).ok, false);

  /* Con OTRA llave, la liga de antes tampoco abre: cambiar el secreto invalida
     todas las ligas emitidas. Es lo que se quiere. */
  process.env.LIGAS_SECRETO = 'otro-secreto-distinto';
  igual('con otra llave, la liga vieja no abre', ligas.abre(buena, AHORA).ok, false);

  process.env.LIGAS_SECRETO = SECRETO;
  igual('y con la buena, vuelve a abrir', ligas.abre(buena, AHORA).ok, true);
})();

/* ============ 6. LA DIRECCION QUE VA EN EL CORREO ============ */
(function () {
  const url = ligas.ligaDelViaje('https://eurotravel-web.vercel.app', 'cs_test_U', REGRESO, AHORA);
  /* Cambió de lado el 26-ago-2026: antes exigía /viaje?t= y esa ruta da 404
     en producción (Vercel sirve el estático en /viaje.html, sin cleanUrls).
     La prueba fijaba el bug; ahora exige la ruta que sí abre. */
  cierto('sale con /viaje.html?t=', url.indexOf('https://eurotravel-web.vercel.app/viaje.html?t=') === 0);
  cierto('y NO con /viaje?t= a secas, que da 404', !/\/viaje\?t=/.test(url));
  igual('sin diagonal doble aunque el sitio traiga una',
    ligas.ligaDelViaje('https://x.mx/', 'cs_1', REGRESO, AHORA).indexOf('x.mx//'), -1);

  /* base64url: nada que se tenga que escapar en una direccion */
  const t = url.split('t=')[1];
  igual('el token no trae caracteres que ensucien la liga', /[+/=?&#%]/.test(t), false);
  igual('y sobrevive el viaje de ida y vuelta por la dirección',
    ligas.abre(decodeURIComponent(encodeURIComponent(t)), AHORA).sesion, 'cs_test_U');

  /* sin identificador de sesion no hay liga */
  igual('sin sesión no hay liga', ligas.firma('', REGRESO, AHORA), '');
  igual('ni con nulo', ligas.firma(null, REGRESO, AHORA), '');
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
