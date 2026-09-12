/* ============================================================
   LA PUERTA A KOMMO (12-sep-2026)
   ============================================================
   El bot va a mudarse a Kommo. Esta batería prueba el cliente de su API
   con una puerta de mentiras: ni una llamada de verdad, ni un token.

   Lo que de verdad se cuida aquí, por orden de lo que cuesta:

     1. Que APAGADO no haga nada. El archivo vive en producción desde
        hoy, mientras el bot sigue atendiendo por Dualhook. Si llamara
        a Kommo sin querer, tocaría una cuenta que todavía no está lista.
     2. Que no invente ids. Una etapa o un campo con el id equivocado
        mueve leads a donde no van o escribe el precio en otro lado — y
        eso no truena, se ve semanas después.
     3. Que un fallo deje rastro. Es la lección del almacén, que se pagó
        con meses de precios perdidos en silencio.
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

/* Se recarga el módulo en cada bloque porque lee el entorno al llamar. */
function kommo() {
  delete require.cache[require.resolve(path.join(RAIZ, 'api/_kommo.js'))];
  return require(path.join(RAIZ, 'api/_kommo.js'));
}

function limpia() {
  delete process.env.KOMMO_SUBDOMINIO;
  delete process.env.KOMMO_TOKEN;
  delete process.env.KOMMO_ETAPAS;
  delete process.env.KOMMO_CAMPO_PRECIO;
}

/* Una puerta que apunta lo que le piden y contesta lo que le digamos. */
function puerta(respuesta, opciones) {
  const o = opciones || {};
  const vistas = [];
  const fn = function (url, init) {
    vistas.push({ url: String(url), init: init || {} });
    if (o.truena) return Promise.reject(new Error('sin red'));
    if (o.status) return Promise.resolve({ ok: false, status: o.status,
      text: async function () { return 'ups'; } });
    return Promise.resolve({ ok: true, status: 200,
      text: async function () { return ''; },
      json: async function () { return respuesta; } });
  };
  fn.vistas = vistas;
  return fn;
}

(async function () {

  titulo('sin llaves, no hace nada');
  {
    limpia();
    const k = kommo();
    ok('se reporta apagado', k.hayKommo() === false);

    const p = puerta({});
    ok('  la prueba de vida no llama a nadie',
      (await k.pruebaDeVida({ pide: p })).vive === false && p.vistas.length === 0);

    const p2 = puerta({});
    ok('  mover de etapa no llama a nadie',
      (await k.mueveDeEtapa(123, 'con_precio', { pide: p2 })) === false && p2.vistas.length === 0);

    const p3 = puerta({});
    ok('  guardar un precio no llama a nadie',
      (await k.guardaPrecio(123, 19000, { pide: p3 })) === false && p3.vistas.length === 0);
  }

  titulo('con llaves, arma bien la dirección y la cabecera');
  {
    limpia();
    process.env.KOMMO_SUBDOMINIO = 'eurotravel';
    process.env.KOMMO_TOKEN = 'token-de-mentiras';
    const k = kommo();
    ok('se reporta encendido', k.hayKommo() === true);

    const p = puerta({ id: 7, name: 'Eurotravel' });
    const vida = await k.pruebaDeVida({ pide: p });
    ok('la prueba de vida dice que vive', vida.vive === true);
    ok('  y pega a /account de su subdominio',
      /^https:\/\/eurotravel\.kommo\.com\/api\/v4\/account$/.test(p.vistas[0].url));
    ok('  con el token como Bearer',
      p.vistas[0].init.headers.Authorization === 'Bearer token-de-mentiras');

    /* El subdominio se escribe de muchas formas y todas deben servir. */
    for (const v of ['eurotravel', 'https://eurotravel.kommo.com', 'eurotravel.kommo.com/']) {
      process.env.KOMMO_SUBDOMINIO = v;
      const k2 = kommo();
      ok('«' + v + '» se entiende igual',
        k2.config().base === 'https://eurotravel.kommo.com/api/v4');
    }
  }

  titulo('no inventa ids · lo que más caro sale');
  {
    limpia();
    process.env.KOMMO_SUBDOMINIO = 'eurotravel';
    process.env.KOMMO_TOKEN = 'token-de-mentiras';
    const k = kommo();

    /* Sin el mapa de etapas no se mueve nada. Adivinar un id manda leads
       a una etapa que no es, y eso no truena: se ve semanas después. */
    const p = puerta({});
    ok('sin KOMMO_ETAPAS no mueve nada',
      (await k.mueveDeEtapa(123, 'con_precio', { pide: p })) === false && p.vistas.length === 0);

    process.env.KOMMO_ETAPAS = '{"con_precio": 555}';
    const k2 = kommo();
    const p2 = puerta({ id: 123 });
    ok('con el mapa sí mueve', (await k2.mueveDeEtapa(123, 'con_precio', { pide: p2 })) === true);
    ok('  con PATCH', p2.vistas[0].init.method === 'PATCH');
    ok('  al lead que se le dijo', /\/leads\/123$/.test(p2.vistas[0].url));
    ok('  mandando el status_id numérico',
      JSON.parse(p2.vistas[0].init.body).status_id === 555);

    /* Una etapa que no está en el mapa no se inventa. */
    const p3 = puerta({ id: 123 });
    ok('una etapa desconocida no se mueve',
      (await k2.mueveDeEtapa(123, 'etapa_que_no_existe', { pide: p3 })) === false &&
      p3.vistas.length === 0);

    /* Y un mapa mal escrito no tumba nada, solo apaga el movimiento. */
    process.env.KOMMO_ETAPAS = 'esto no es json';
    const k3 = kommo();
    ok('un KOMMO_ETAPAS roto no truena', k3.mapaDeEtapas() === null);
  }

  titulo('el precio, al campo que es y no a otro');
  {
    limpia();
    process.env.KOMMO_SUBDOMINIO = 'eurotravel';
    process.env.KOMMO_TOKEN = 'token-de-mentiras';
    const k = kommo();

    const p = puerta({ id: 1 });
    ok('sin KOMMO_CAMPO_PRECIO no escribe',
      (await k.guardaPrecio(123, 19000, { pide: p })) === false && p.vistas.length === 0);

    process.env.KOMMO_CAMPO_PRECIO = '9001';
    const k2 = kommo();
    const p2 = puerta({ id: 123 });
    ok('con el campo sí escribe', (await k2.guardaPrecio(123, 19000, { pide: p2 })) === true);
    const cuerpo = JSON.parse(p2.vistas[0].init.body);
    ok('  en el campo que se le dijo', cuerpo.custom_fields_values[0].field_id === 9001);
    ok('  con el total', cuerpo.custom_fields_values[0].values[0].value === 19000);

    /* Y nada de guardar basura, igual que en el almacén. */
    for (const malo of [0, -500, null]) {
      const p3 = puerta({ id: 1 });
      ok('un total «' + malo + '» no se guarda',
        (await k2.guardaPrecio(123, malo, { pide: p3 })) === false && p3.vistas.length === 0);
    }
  }

  titulo('cuando Kommo falla, queda rastro y no truena');
  {
    limpia();
    process.env.KOMMO_SUBDOMINIO = 'eurotravel';
    process.env.KOMMO_TOKEN = 'token-de-mentiras';
    process.env.KOMMO_CAMPO_PRECIO = '9001';
    const k = kommo();

    for (const [nombre, fallo] of [['se cae la red', { truena: true }],
      ['contesta 401 (token malo)', { status: 401 }],
      ['contesta 500', { status: 500 }]]) {
      let trono = false, r = null;
      try { r = await k.guardaPrecio(123, 19000, { pide: puerta({}, fallo) }); }
      catch (e) { trono = true; }
      ok('si ' + nombre + ', no revienta y avisa que no guardó', !trono && r === false);
    }
  }

  titulo('leer los precios ya cotizados');
  {
    limpia();
    process.env.KOMMO_SUBDOMINIO = 'eurotravel';
    process.env.KOMMO_TOKEN = 'token-de-mentiras';
    process.env.KOMMO_CAMPO_PRECIO = '9001';
    const k = kommo();

    const unaPagina = {
      _embedded: {
        leads: [
          { id: 1, name: 'Ana · Vallarta', updated_at: 1789000000,
            custom_fields_values: [{ field_id: 9001, values: [{ value: 19000 }] }] },
          { id: 2, name: 'Sin precio todavía', custom_fields_values: [] }
        ]
      }
    };
    const lista = await k.leadsConPrecio({ pide: puerta(unaPagina), topePaginas: 1 });
    ok('trae solo los que tienen precio', lista.length === 1);
    ok('  con su total', lista[0] && lista[0].total === 19000);
    ok('  y con cuándo fue', !!(lista[0] && lista[0].cuando));
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
