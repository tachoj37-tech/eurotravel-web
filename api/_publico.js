/* ============================================================
   Qué puede ver el cliente. Se decide AQUI, y solo aqui.
   ------------------------------------------------------------
   LA REGLA DEL KILOMETRO

   El cliente nunca ve los kilometros ni ninguna tarifa. Con el
   total y el kilometraje juntos, el precio por kilometro se saca
   dividiendo; y con «2 noches · $2,000», el de la noche.

   POR QUE EXISTE ESTE ARCHIVO

   Esa regla se hacia cumplir en CINCO lugares distintos, de
   cinco maneras, y ninguno sabia de los otros:

     _tarifa.js         parte el resultado en `interno` y lo demas
     cotizar.js         enumeraba a mano los campos que devolvia
     pagar.js           enumeraba a mano los suyos, por separado
     confirmar.js       enumeraba a mano los de la metadata
     cotizacion.js      una lista blanca, en el navegador

   Y YA FALLO DOS VECES. Al agregar `desglose` hubo que acordarse
   de tocar la lista del navegador. Al quitar la tarifa por noche,
   otra vez. Las dos las cazo una prueba — pero por disciplina, no
   por estructura. La siguiente dependia de que alguien se
   acordara.

   QUE CAMBIA

   Se invierte el sentido. Antes, un campo nuevo SALIA salvo que
   alguien se acordara de recortarlo. Ahora NO SALE salvo que
   alguien lo agregue aqui a proposito.

   La lista blanca del navegador se queda: deja de ser la unica
   defensa y pasa a ser la segunda. Y hay una prueba que falla si
   las dos listas se separan.
   ============================================================ */

/* ------------------------------------------------------------
   LO QUE SI PUEDE SALIR
   ------------------------------------------------------------
   Agregar un renglon aqui es una decision, no un descuido. Antes
   de hacerlo, la pregunta es: ¿con esto y el total en la mano, se
   puede deducir una tarifa?
   ------------------------------------------------------------ */
const CAMPOS_PRECIO = [
  'total',
  'ivaIncluido',
  'porcentajeAnticipo',
  'anticipo',
  'saldo',
  /* Un SÍ o un NO, no una cantidad: dice que el viaje es tan largo que lo
     cotiza una persona. Se agregó a sabiendas —la pregunta de arriba se
     contestó: con esto y el total en la mano no sale ninguna tarifa, porque
     cuando vale `true` todos los montos vienen en cero. Sin él, la pantalla
     enseñaría «$0» y el cliente creería que el viaje es gratis. */
  'requiereAsesor'
];

/* El desglose lleva su propia lista porque es objeto anidado: copiarlo entero
   dejaria entrar cualquier campo que `calcula` le agregue mañana, que es
   justamente lo que esto existe para impedir.

   Ojo con lo que NO esta: `traslado`, `nochesExtra` e `importeNoches`. Juntos
   dicen cuanto cuesta la noche. Por eso el servidor los manda ya sumados en
   `servicio`, y esos tres se quedan en `interno`. */
const CAMPOS_DESGLOSE = [
  'servicio',
  'diasMovimiento',
  'importeMovimientos',
  'reglaDestino'
];

/* Lo que puede salir de la METADATA de Stripe al confirmar un pago. Es otra
   forma distinta —viene de Stripe, no de `calcula`— pero la misma regla: en
   esa metadata VIVE el kilometraje, y de ahi no pasa. */
const CAMPOS_CONFIRMACION = ['estado', 'folio', 'anticipo', 'saldo', 'total', 'ruta', 'canal'];

/* ------------------------------------------------------------
   LO QUE VE EL CLIENTE EN SU PROPIA PANTALLA DE VIAJE
   ------------------------------------------------------------
   Entra con su liga firmada, así que ya sabemos que el viaje es
   suyo. Aun así la regla del kilómetro no se afloja: en la
   metadata de Stripe VIVE `km`, y esta pantalla es el camino más
   nuevo por donde se podría escapar.

   Lleva más que la confirmación de pago porque aquí sí necesita
   ver su viaje entero —a dónde va, cuándo, en qué unidad, dónde
   lo recogen— para saber que lo que apartó es lo que quería.

   Y NO lleva su teléfono ni su correo: ya son suyos, no aportan
   nada en pantalla, y menos datos personales en una respuesta es
   siempre mejor.
   ------------------------------------------------------------ */
const CAMPOS_VIAJE = [
  'estado', 'folio', 'nombre',
  'total', 'anticipo', 'saldo',
  'origen', 'destino', 'ruta',
  'salida', 'regreso', 'dias', 'unidad', 'puntoSalida', 'paradas',
  'diasMovimiento', 'movDetalle'
];

function porLista(objeto, lista) {
  const limpio = {};
  for (let i = 0; i < lista.length; i++) {
    const k = lista[i];
    if (objeto && Object.prototype.hasOwnProperty.call(objeto, k)) limpio[k] = objeto[k];
  }
  return limpio;
}

/* ------------------------------------------------------------
   EL PRECIO, LISTO PARA MANDARSE
   ------------------------------------------------------------
   Recibe lo que devuelve `tarifa.calcula()` —que trae `interno`
   con la tarifa, el kilometraje y el desglose de las noches— y
   devuelve solo lo que puede viajar.

   Quien llama le agrega lo suyo: `cotizar` los dias y si es
   redondo, `pagar` la direccion del cobro y el folio. Eso no es
   dinero y no lo decide este archivo.
   ------------------------------------------------------------ */
function precio(p) {
  const salida = porLista(p, CAMPOS_PRECIO);
  if (p && p.desglose) salida.desglose = porLista(p.desglose, CAMPOS_DESGLOSE);
  return salida;
}

/* ------------------------------------------------------------
   LA CONFIRMACION DE UN PAGO
   ------------------------------------------------------------
   Los montos salen de la metadata de STRIPE, no de lo que mando
   el navegador: por eso se puede confiar en ellos. Pero en esa
   metadata tambien esta `km`, y de ahi no sale.
   ------------------------------------------------------------ */
function confirmacion(m, estado) {
  const datos = m || {};
  return porLista({
    estado: estado,
    folio: typeof datos.folio === 'string' ? datos.folio.slice(0, 20) : '',
    anticipo: Number(datos.anticipo) || 0,
    saldo: Number(datos.saldo) || 0,
    total: Number(datos.total) || 0,
    ruta: typeof datos.ruta === 'string' ? datos.ruta.slice(0, 90) : '',
    canal: datos.canal === 'whatsapp' ? 'whatsapp' : 'correo'
  }, CAMPOS_CONFIRMACION);
}

/* ------------------------------------------------------------
   EL VIAJE, PARA SU PROPIA PANTALLA
   ------------------------------------------------------------
   Recibe la metadata de la sesión de Stripe —donde vive `km`— y
   el estado del pago. Devuelve solo lo de `CAMPOS_VIAJE`.

   Se arma nombrando campo por campo, como todo lo de este
   archivo: lo que no está nombrado no sale, ni aunque mañana
   `pagar.js` le agregue algo nuevo a la metadata.
   ------------------------------------------------------------ */
function viaje(m, estado) {
  const d = m || {};
  const texto = function (v, largo) { return String(v == null ? '' : v).slice(0, largo); };
  return porLista({
    estado: estado,
    folio: texto(d.folio, 20),
    nombre: texto(d.nombre, 80),
    total: Number(d.total) || 0,
    anticipo: Number(d.anticipo) || 0,
    saldo: Number(d.saldo) || 0,
    origen: texto(d.origen, 160),
    destino: texto(d.destino, 160),
    ruta: texto(d.ruta, 90),
    salida: texto(d.salida, 25),
    regreso: texto(d.regreso, 25),
    dias: Number(d.dias) || 0,
    unidad: texto(d.unidad, 60),
    puntoSalida: texto(d.puntoSalida, 200),
    paradas: texto(d.paradas, 300),
    diasMovimiento: Number(d.movDias) || 0,
    movDetalle: texto(d.movDetalle, 500)
  }, CAMPOS_VIAJE);
}

module.exports = {
  CAMPOS_PRECIO,
  CAMPOS_DESGLOSE,
  CAMPOS_CONFIRMACION,
  CAMPOS_VIAJE,
  precio,
  confirmacion,
  viaje
};
