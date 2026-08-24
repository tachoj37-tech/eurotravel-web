/* ============================================================
   Pruebas de la máquina de cotización — sin navegador
   ------------------------------------------------------------
   Esto es exactamente lo que antes NO se podía hacer: ejercitar
   el flujo de cotización sin abrir la página ni apretar botones.
   La máquina recibe un `pide` falso y todo corre en Node:

       node pruebas/probar-cotizacion.cjs

   No toca la red, no gasta cuota de Google y no necesita clave.
   ============================================================ */
'use strict';
const COTIZACION = require('../cotizacion.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* un pide falso que contesta lo que le digas, cuando le digas */
function pideFalso(respuesta, opciones) {
  const o = opciones || {};
  return function () {
    return new Promise(function (resuelve) {
      const contesta = function () {
        resuelve({ ok: o.ok !== false, json: function () { return Promise.resolve(respuesta); } });
      };
      if (o.retrasa) { setTimeout(contesta, o.retrasa); } else { contesta(); }
    });
  };
}

const LUGAR_GDL = { place: ['Guadalajara', 'Jalisco', 'ciudad'], coords: '20.6597, -103.3496', placeId: 'X1', aprox: true };
const LUGAR_PVR = { place: ['Puerto Vallarta', 'Jalisco', 'playa'], coords: '20.6534, -105.2253', placeId: 'X2', aprox: true };
const SPRINTER = { id: 'sprinter', name: 'Sprinter', cotizadorAutomatico: true };
const AUTOBUS = { id: 'irizar-i6s', name: 'Irizar i6S', cotizadorAutomatico: false };

(async function () {

  /* ---------------- faltantes: la validación, a secas ---------------- */
  igual('borrador vacío: falta todo',
    COTIZACION.faltantes({}),
    ['origen', 'destino', 'fecha', 'unidad']);

  igual('completo: no falta nada',
    COTIZACION.faltantes({ origen: LUGAR_GDL, destino: LUGAR_PVR, salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00', unidad: SPRINTER }),
    []);

  igual('regreso antes de la salida: se acusa',
    COTIZACION.faltantes({ origen: LUGAR_GDL, destino: LUGAR_PVR, salida: '2026-09-06T08:00', regreso: '2026-09-03T18:00', unidad: SPRINTER }),
    ['fechasInvertidas']);

  /* ---------------- puntoDe: el armado del punto --------------------- */
  igual('puntoDe con coordenadas',
    COTIZACION.puntoDe(LUGAR_GDL),
    { placeId: 'X1', lat: 20.6597, lng: -103.3496, direccion: 'Guadalajara, Jalisco, México' });

  igual('puntoDe con calle y colonia arma la dirección completa',
    COTIZACION.puntoDe({ place: ['Zapopan', 'Jalisco', 'ciudad'], calle: 'Av. Alba 1666', col: 'Las Fuentes' }),
    { placeId: '', lat: null, lng: null, direccion: 'Av. Alba 1666, Las Fuentes, Zapopan, Jalisco, México' });

  cierto('punto con dirección de Google es exacto',
    COTIZACION.puntoExacto({ placeId: 'X', aprox: false }));
  cierto('el centro del destino NO es exacto (aprox)',
    !COTIZACION.puntoExacto({ placeId: 'X', aprox: true }));

  /* ---------------- la unidad manda: manual vs automático ------------ */
  const m1 = COTIZACION.crea({ pide: pideFalso({ total: 1 }) });
  m1.pon({ origen: LUGAR_GDL, destino: LUGAR_PVR, salida: '2026-09-03', regreso: '2026-09-06', unidad: AUTOBUS, redondo: true });
  igual('autobús sin cotizador automático: veredicto manual, sin red',
    (await m1.cotiza()).tipo, 'manual');
  cierto('cotizaEnAutomatico dice que no', !m1.cotizaEnAutomatico());

  /* ---------------- el camino feliz, con lista blanca ---------------- */
  /* El servidor de mentiras contesta el precio Y de más: mete kilómetros y
     tarifa como si un despiste del futuro los filtrara. La máquina los debe
     tirar ANTES de guardarlos: esa es la regla del kilómetro de este lado. */
  const RESPUESTA_SUCIA = {
    dias: 4, redondo: true, total: 21700, ivaIncluido: true,
    porcentajeAnticipo: 20, anticipo: 4340, saldo: 17360,
    km: 621.2, kmIda: 311.4, tarifaKm: 35, interno: { porKilometro: 21742 }
  };
  const m2 = COTIZACION.crea({ pide: pideFalso(RESPUESTA_SUCIA) });
  m2.pon({ origen: LUGAR_GDL, destino: LUGAR_PVR, salida: '2026-09-03', regreso: '2026-09-06', unidad: SPRINTER, redondo: true });
  const v2 = await m2.cotiza();
  igual('sprinter: veredicto listo', v2.tipo, 'listo');
  igual('la cotización queda SOLO con los campos permitidos',
    Object.keys(m2.estadoVivo().cotizacion).sort(),
    ['anticipo', 'dias', 'ivaIncluido', 'porcentajeAnticipo', 'redondo', 'saldo', 'total']);
  igual('ni un kilómetro ni tarifa en el estado',
    JSON.stringify(m2.estadoVivo()).match(/km|tarifa|interno/i), null);
  igual('el total sobrevive entero', m2.estadoVivo().cotizacion.total, 21700);

  /* ---------------- la carrera: gana la última búsqueda -------------- */
  const lenta = pideFalso({ dias: 1, total: 999 }, { retrasa: 40 });
  const m3 = COTIZACION.crea({ pide: lenta });
  m3.pon({ origen: LUGAR_GDL, destino: LUGAR_PVR, salida: '2026-09-03', regreso: '', unidad: SPRINTER, redondo: false });
  const enVuelo = m3.cotiza();            // sale la primera búsqueda…
  m3.pon({ origen: LUGAR_PVR, destino: LUGAR_GDL, salida: '2026-09-10', regreso: '', unidad: SPRINTER, redondo: false });
  const v3 = await enVuelo;               // …y su respuesta llega tarde
  igual('la respuesta vieja se declara tarde', v3.tipo, 'tarde');
  igual('y NO se guarda', m3.estadoVivo().cotizacion, null);

  /* ---------------- el servidor no pudo ------------------------------ */
  const m4 = COTIZACION.crea({ pide: pideFalso({ aviso: 'No encontramos ruta.' }, { ok: false }) });
  m4.pon({ origen: LUGAR_GDL, destino: LUGAR_PVR, salida: '2026-09-03', regreso: '', unidad: SPRINTER, redondo: false });
  const v4 = await m4.cotiza();
  igual('sin ruta: veredicto sinPrecio con su aviso',
    [v4.tipo, v4.aviso], ['sinPrecio', 'No encontramos ruta.']);

  /* ---------------- pon() limpia la cotización anterior --------------- */
  cierto('tras pon(), la cotización vieja no sobrevive',
    (m2.pon({ origen: LUGAR_GDL, destino: LUGAR_PVR, salida: '2026-10-01', regreso: '', unidad: SPRINTER }),
     m2.estadoVivo().cotizacion === null));

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
