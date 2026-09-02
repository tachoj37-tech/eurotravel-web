/* ============================================================
   Los movimientos en destino — las reglas, sin pantalla
   ------------------------------------------------------------
   Aqui vive lo que antes estaba trenzado con el DOM dentro de
   index.html: cuantas noches hay, cuantos dias con movimiento
   caben, si un dia esta completo, y que forma se le manda al
   servidor.

   POR QUE EXISTE

   index.html es el archivo mas tocado del proyecto —cuatro mil
   lineas— y estas reglas son las mas nuevas. Estando adentro,
   SOLO SE PODIAN PROBAR APRETANDO BOTONES EN UN NAVEGADOR: las
   de esta semana se comprobaron asi, a mano.

   Es la misma operacion que ya salio bien con la maquina de
   cotizacion (cotizacion.js): la logica sale, la pantalla se
   queda de adaptador —junta de los campos y pinta—.

   EL TOPE ES LA PARTE DELICADA

   «No puede haber mas dias con movimiento que noches en destino»
   es el MISMO numero que aplica el servidor en `movimientosDe`
   de _tarifa.js. Si los dos contaran distinto, el cliente veria
   un precio y se le cobraria otro. Estando aqui, se puede probar
   contra el servidor de verdad, en Node. Antes era una promesa.

   NADA DE ESTE ARCHIVO TOCA EL DOM. Devuelve veredictos; que se
   pinta con ellos es asunto de la pantalla.
   ============================================================ */
(function (raiz) {
  'use strict';

  /* Solo la parte de fecha de un valor tipo "2026-09-03T08:00". */
  function soloFecha(v) { return String(v || '').split('T')[0]; }

  /* ------------------------------------------------------------
     NOCHES EN DESTINO
     ------------------------------------------------------------
     La RESTA entre regreso y salida, no la cuenta inclusive: del
     3 al 6 son cuatro dias de servicio pero TRES noches. Es la
     misma distincion que hace `nochesDe` en _tarifa.js, y por eso
     lleva el mismo nombre de concepto.

     De esto sale el tope de dias con movimiento.
     ------------------------------------------------------------ */
  function noches(salida, regreso) {
    if (!salida || !regreso) return 0;
    var s = new Date(salida), r = new Date(regreso);
    if (isNaN(s) || isNaN(r)) return 0;
    var a = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    var b = new Date(r.getFullYear(), r.getMonth(), r.getDate());
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  /* `paseo` y `lejos` se agregaron el 1-sep-2026 (R40): los dos MUEVEN EL
     PRECIO, así que tienen que viajar hasta `/api/cotizar` —no basta con
     enseñarlos en pantalla—.

     · paseo  Taxco / Chalma / Xochimilco en CDMX, El Meco / El Naranjo en
              la Huasteca. Suma su precio encima del día (R42).
     · lejos  el recorrido pasa de 80 km: son $5,500 y las horas dejan de
              importar (R29). */
  function diaVacio() {
    return { fecha: '', horaInicio: '', horaFin: '', paseo: '', lejos: false };
  }

  /* Los km no se preguntan: se pregunta si pasa de los 80, que es lo que el
     cliente sí sabe contestar. El número solo existe para que el motor
     decida de qué lado del corte cae. */
  var KM_LEJOS = 120;

  /* ------------------------------------------------------------
     ¿ESTA COMPLETO ESTO?
     ------------------------------------------------------------
     Devuelve una lista de problemas, no un booleano. Cada problema
     dice QUE dia, QUE campo y POR QUE, para que la pantalla pueda
     marcar el campo exacto en rojo y escribir el aviso.

     Los indices de campo siguen el orden en que la pantalla los
     dibuja: 0 fecha, 1 hora de inicio, 2 hora de fin.
     ------------------------------------------------------------ */
  function revisa(estado, salida, regreso) {
    if (!estado.incluye) return { ok: true, problemas: [] };

    var problemas = [];
    var tope = noches(salida, regreso);

    if (estado.dias.length > tope) {
      problemas.push({ tipo: 'tope', tope: tope, aviso:
        'Los días con movimiento no pueden exceder las ' + tope + ' noches en destino.' });
      return { ok: false, problemas: problemas };
    }

    var desde = soloFecha(salida), hasta = soloFecha(regreso);
    var vistas = {};

    estado.dias.forEach(function (dia, i) {
      if (!dia.fecha) problemas.push({ dia: i, campo: 0, tipo: 'falta' });
      if (!dia.horaInicio) problemas.push({ dia: i, campo: 1, tipo: 'falta' });
      if (!dia.horaFin) problemas.push({ dia: i, campo: 2, tipo: 'falta' });

      if (dia.fecha) {
        if (dia.fecha < desde || dia.fecha > hasta) {
          problemas.push({ dia: i, campo: 0, tipo: 'fueraDeRango', aviso:
            'La fecha del día ' + (i + 1) + ' está fuera del rango del viaje.' });
        } else if (vistas[dia.fecha]) {
          problemas.push({ dia: i, campo: 0, tipo: 'repetida', fecha: dia.fecha });
        }
        vistas[dia.fecha] = true;
      }

      if (dia.horaInicio && dia.horaFin && dia.horaFin <= dia.horaInicio) {
        problemas.push({ dia: i, campo: 2, tipo: 'horasAlReves', aviso:
          'En el día ' + (i + 1) + ' la hora de fin debe ser posterior a la de inicio.' });
      }
    });

    return { ok: problemas.length === 0, problemas: problemas };
  }

  /* ------------------------------------------------------------
     LO QUE SE LE MANDA AL SERVIDOR
     ------------------------------------------------------------
     Dos formas, y la diferencia importa:

       paraCotizar  solo las horas — es lo unico que mueve el precio
       paraCobrar   el dia completo — el resto se imprime en el
                    itinerario del contrato

     LAS DOS TIENEN EL MISMO LARGO, SIEMPRE. El precio se cobra por
     dia, asi que si una filtrara un renglon y la otra no, se
     cotizaria un dia menos del que se cobra. Por eso ninguna de
     las dos filtra: mapean.
     ------------------------------------------------------------ */
  function paraCotizar(estado) {
    if (!estado.incluye) return [];
    return estado.dias.map(function (d) {
      /* `paseo` y `lejos` van AQUI TAMBIEN, no solo en `paraCobrar`.
         Si solo fueran al cobrar, la pantalla enseñaría un precio y se
         cobraría otro —hasta $15,000 de diferencia con Taxco—, que es
         justo lo que `probar-cotiza-vs-cobra.cjs` existe para impedir. */
      var m = { horaInicio: d.horaInicio || '', horaFin: d.horaFin || '' };
      if (d.paseo) m.paseo = d.paseo;
      if (d.lejos) m.km = KM_LEJOS;
      return m;
    });
  }

  function paraCobrar(estado) {
    if (!estado.incluye) return [];
    /* Se copia día por día para poder traducir `lejos` a los km que el
       motor entiende, sin tocar lo que guarda la pantalla. */
    return estado.dias.map(function (d) {
      var m = { fecha: d.fecha || '', horaInicio: d.horaInicio || '',
        horaFin: d.horaFin || '' };
      if (d.paseo) m.paseo = d.paseo;
      if (d.lejos) m.km = KM_LEJOS;
      return m;
    });
  }

  /* ------------------------------------------------------------
     LA MAQUINA
     ------------------------------------------------------------ */
  function crea() {
    var estado = { incluye: false, dias: [], notas: '' };

    return {
      /* El objeto vivo, como en cotizacion.js: la pantalla lo lee muchas
         veces y copiarlo no compra nada. Se escribe con los metodos. */
      estadoVivo: function () { return estado; },

      noches: noches,

      /* Encender pone el primer dia solo: un bloque abierto y vacio no le
         dice a nadie que hay que agregar algo.

         Pero SIN NOCHES no enciende. Sin esa guarda, un viaje de ida y vuelta
         el mismo dia podia quedar con un dia capturado que el servidor jamas
         iba a contar —el tope de `movimientosDe` seria cero— y la pantalla
         enseñaria un dia que no se cobra. Hoy no se alcanza porque el bloque
         se esconde, pero el estado podia existir; lo caza la prueba que
         compara este tope contra el del servidor. */
      enciende: function (salida, regreso) {
        if (noches(salida, regreso) === 0) return false;
        estado.incluye = true;
        if (!estado.dias.length) estado.dias.push(diaVacio());
        return true;
      },
      apaga: function () { estado.incluye = false; },

      /* Devuelve si se pudo. La pantalla decide que aviso escribir. */
      agregaDia: function (salida, regreso) {
        if (estado.dias.length >= noches(salida, regreso)) return false;
        estado.dias.push(diaVacio());
        return true;
      },

      /* Nunca se queda en cero: un bloque encendido sin dias no tiene
         sentido, y dejaria al cliente sin nada que llenar. */
      quitaDia: function (i) {
        estado.dias.splice(i, 1);
        if (!estado.dias.length) estado.dias.push(diaVacio());
      },

      /* Al cambiar el viaje: si ya no hay noches, no hay movimientos. */
      alCambiarElViaje: function (salida, regreso) {
        if (noches(salida, regreso) === 0) {
          estado.incluye = false;
          estado.dias = [];
        }
      },

      ponNotas: function (t) { estado.notas = String(t == null ? '' : t); },

      revisa: function (salida, regreso) { return revisa(estado, salida, regreso); },
      paraCotizar: function () { return paraCotizar(estado); },
      paraCobrar: function () { return paraCobrar(estado); }
    };
  }

  var MOVIMIENTOS = {
    crea: crea,
    noches: noches,
    revisa: revisa,
    paraCotizar: paraCotizar,
    paraCobrar: paraCobrar,
    soloFecha: soloFecha
  };

  raiz.MOVIMIENTOS = MOVIMIENTOS;
  /* para las pruebas de Node; en el navegador esta rama no existe */
  if (typeof module !== 'undefined' && module.exports) { module.exports = MOVIMIENTOS; }
})(typeof window !== 'undefined' ? window : globalThis);
