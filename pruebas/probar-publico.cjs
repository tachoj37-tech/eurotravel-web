/* ============================================================
   La regla del kilometro, en su unico dueño
   ------------------------------------------------------------
       node pruebas/probar-publico.cjs

   El cliente nunca ve los kilometros ni ninguna tarifa. Con el
   total y el kilometraje juntos, el precio por kilometro se saca
   dividiendo; y con «2 noches · $2,000», el de la noche.

   Antes esa regla se hacia cumplir en cinco lugares y FALLO DOS
   VECES en una semana: al agregar `desglose` y al quitar la
   tarifa por noche, hubo que acordarse de tocar la lista blanca
   del navegador. Ahora hay un solo dueño -_publico.js- y esta
   prueba, que es la que se acordaria por nosotros.
   ============================================================ */
'use strict';
const publico = require('../api/_publico.js');
const tarifa = require('../api/_tarifa.js');
const COTIZACION = require('../cotizacion.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* ============ 1. NADA SALE SI NO ESTA EN LA LISTA ============
   Se le mete de todo, incluido lo que MAS duele que se escape, y se exige
   que no salga ni uno. Es la inversion del sentido: antes un campo nuevo
   salia salvo que alguien lo recortara; ahora no sale salvo que alguien lo
   agregue a proposito. */
(function () {
  const envenenado = {
    total: 30500, ivaIncluido: true, porcentajeAnticipo: 20,
    anticipo: 6100, saldo: 24400,
    desglose: {
      servicio: 23000, diasMovimiento: 2, importeMovimientos: 7500, reglaDestino: null,
      /* lo que NO debe salir, ni aunque `calcula` lo mande */
      traslado: 21000, nochesExtra: 2, importeNoches: 2000,
      km: 621.2, tarifaKm: 34
    },
    /* y a nivel de arriba */
    km: 621.2, tarifaKm: 34, kmIda: 311.4,
    interno: { porKilometro: 21120, tarifaKm: 34, km: 621.2 },
    sinRedondear: 21120, minimoPorDia: 3000
  };

  const salida = publico.precio(envenenado);

  igual('solo salen los campos de la lista',
    Object.keys(salida).sort(),
    /* `porcentajeAnticipo` salió de la lista con R51. El objeto envenenado de
       arriba lo sigue mandando adrede: si mañana alguien lo revive en el
       servidor, esta prueba tiene que seguir tirándolo. */
    ['anticipo', 'desglose', 'ivaIncluido', 'saldo', 'total']);

  igual('y del desglose, solo los suyos',
    Object.keys(salida.desglose).sort(),
    ['diasMovimiento', 'importeMovimientos', 'reglaDestino', 'servicio']);

  const texto = JSON.stringify(salida);
  igual('ni kilometraje ni tarifa, en ningun nivel',
    texto.match(/km|tarifa|interno|sinRedondear|minimoPorDia/i), null);
  igual('ni la tarifa por noche', texto.match(/noche/i), null);
  igual('ni el traslado suelto, que con las noches la delata',
    texto.indexOf('traslado'), -1);

  /* y lo que SI tiene que llegar, llega entero */
  igual('el total pasa entero', salida.total, 30500);
  igual('y el desglose suma el total',
    salida.desglose.servicio + salida.desglose.importeMovimientos, salida.total);
})();

/* ============ 2. CON UN PRECIO DE VERDAD ============ */
(function () {
  const p = tarifa.calcula(621.2, 6, {
    noches: 5,
    movimientos: [{ horaInicio: '08:00', horaFin: '16:00' }],
    destino: { placeId: 'ChIJ_cualquiera' }
  });
  const salida = publico.precio(p);

  cierto('`interno` existe del lado del servidor', !!p.interno);
  igual('pero no sale', salida.interno, undefined);
  igual('lo que sale sigue sumando el total',
    salida.desglose.servicio + salida.desglose.importeMovimientos, salida.total);
  igual('sin rastro de kilometraje',
    JSON.stringify(salida).match(/km|tarifa/i), null);
})();

/* ============ 3. LA CONFIRMACION DE PAGO ============
   Los montos salen de la metadata de Stripe, donde TAMBIEN vive `km`. */
(function () {
  const metadata = {
    folio: 'ET-Q7TW-K3R', anticipo: '6100', saldo: '24400', total: '30500',
    ruta: 'Guadalajara a Puerto Vallarta', canal: 'correo',
    km: '621.2', nombre: 'Ana Ruiz', telefono: '3312345678',
    correo: 'ana@ejemplo.mx', nochesExtra: '2', importeNoches: '2000'
  };
  const salida = publico.confirmacion(metadata, 'pagado');

  igual('solo salen los campos de la confirmacion',
    Object.keys(salida).sort(),
    ['anticipo', 'canal', 'estado', 'folio', 'ruta', 'saldo', 'total']);
  igual('el kilometraje de la metadata NO sale',
    JSON.stringify(salida).match(/km|621/), null);
  igual('ni el telefono ni el correo, que no hacen falta ahi',
    JSON.stringify(salida).match(/3312345678|ana@ejemplo/), null);
  igual('los montos llegan como numeros', [salida.total, salida.anticipo], [30500, 6100]);
  igual('un canal inventado cae a correo',
    publico.confirmacion({ canal: 'telepatia' }, 'pagado').canal, 'correo');
})();

/* ============ 4. QUE LAS DOS LISTAS NO SE SEPAREN ============
   ESTA es la prueba que hacia falta.

   El servidor decide que manda (_publico.js) y el navegador decide que
   guarda (cotizacion.js). Son dos archivos, en dos mundos distintos —uno
   corre en Vercel, el otro en el celular del cliente— y no pueden compartir
   codigo sin un paso de compilacion que este proyecto no tiene.

   Asi que se comprueba aqui: TODO lo que manda el servidor tiene que estar
   en la lista del navegador. Si no, el navegador lo tira EN SILENCIO y la
   pantalla se queda sin ese dato sin que nada truene.

   Eso ya paso, dos veces. Con esta prueba, la proxima se caza sola. */
(function () {
  /* Lo que de verdad manda /api/cotizar: el precio publico mas sus dos
     campos propios, que no son dinero. */
  const p = tarifa.calcula(621.2, 6, { noches: 5, movimientos: [{ horaInicio: '08:00', horaFin: '16:00' }] });
  const loQueManda = Object.assign({ dias: 6, redondo: true }, publico.precio(p));

  /* Se comparan LAS LISTAS, no una muestra.

     La primera version de esta prueba comparaba los campos que aparecian en
     un precio de ejemplo, y NO CAZABA EL FALLO: un campo permitido en el
     servidor pero ausente de la muestra se le escapaba. Se descubrio
     poniendola en rojo a proposito -y quedandose en verde-. Comparar las
     listas no depende de que la muestra traiga el campo. */
  const mandaElServidor = publico.CAMPOS_PRECIO.concat(['desglose']);
  const huerfanos = mandaElServidor.filter(function (k) {
    return COTIZACION.CAMPOS_COTIZACION.indexOf(k) < 0;
  });
  igual('todo lo que el servidor PUEDE mandar, el navegador lo acepta', huerfanos, []);

  const huerfanosDesglose = publico.CAMPOS_DESGLOSE.filter(function (k) {
    return COTIZACION.CAMPOS_DESGLOSE.indexOf(k) < 0;
  });
  igual('y lo mismo dentro del desglose', huerfanosDesglose, []);

  /* Y sobre la muestra tambien, que ahi salen los campos propios de
     /api/cotizar -dias, redondo- que no pasan por la lista del precio. */
  const enLaMuestra = Object.keys(loQueManda).filter(function (k) {
    return COTIZACION.CAMPOS_COTIZACION.indexOf(k) < 0;
  });
  igual('y lo que manda de verdad, tambien', enLaMuestra, []);

  /* Y al reves: que el navegador no espere campos que el servidor ya no
     manda. No es grave -se quedan sin valor- pero es señal de que alguien
     quito algo de un lado y se olvido del otro. */
  const sobrantes = COTIZACION.CAMPOS_DESGLOSE.filter(function (k) {
    return publico.CAMPOS_DESGLOSE.indexOf(k) < 0;
  });
  igual('el navegador no espera campos que ya no existen', sobrantes, []);

  /* Y la otra mitad de la defensa: aunque el servidor se equivocara y mandara
     el kilometraje, el navegador lo tiraria. Dos lineas, no una. */
  const maquina = COTIZACION.crea({
    pide: function () {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve(Object.assign({}, loQueManda, {
            km: 621.2, tarifaKm: 34,
            desglose: Object.assign({}, loQueManda.desglose, { km: 621.2, traslado: 21000 })
          }));
        }
      });
    }
  });
  maquina.pon({
    origen: { place: ['A'], placeId: 'x' }, destino: { place: ['B'], placeId: 'y' },
    salida: '2026-09-03', regreso: '2026-09-08',
    unidad: { id: 'sprinter', name: 'Sprinter', cotizadorAutomatico: true }, redondo: true
  });
  maquina.cotiza().then(function () {
    igual('si el servidor se equivocara, el navegador lo tira igual',
      JSON.stringify(maquina.estadoVivo().cotizacion).match(/km|tarifa|traslado/i), null);

    console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
    process.exit(malas ? 1 : 0);
  });
})();
