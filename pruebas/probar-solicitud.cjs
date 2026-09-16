/* ============================================================
   La solicitud del viaje que no lleva precio
   ------------------------------------------------------------
       node pruebas/probar-solicitud.cjs

   FASES 2 Y 3 DEL PLAN (`docs/PLAN-DE-LA-PAGINA.md`).

   Desde la fase 1 hay viajes que no llevan precio: los que no
   salen del criterio y los de toda unidad que no sea la Sprinter.
   Antes, ese cliente leía «te cotiza un vendedor» y se iba **sin
   dejar rastro**. Ahora deja su WhatsApp o su correo y la ficha
   del viaje le llega al vendedor.

   LO QUE SE CUIDA, en orden de gravedad:

     1. UN contacto ilegible no se acepta. Un teléfono mal escrito
        no es un detalle de forma: es el único hilo que queda con
        este cliente, y en la fase 0 se vio que «12» pasaba.
     2. Uno de los dos BASTA. Pedir los dos es gente que se va.
     3. La ficha del vendedor es la MISMA que la del bot, y trae
        de vuelta el contacto: sin eso, llega un viaje al que
        nadie puede contestarle.
     4. Aquí NO se da precio. Esta puerta existe para los viajes
        que no lo tienen; si algún día devolviera una cifra, sería
        una cifra que no salió del criterio.
     5. La solicitud se da por recibida aunque el aviso falle. Un
        cliente que dejó sus datos no puede ver un error.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const solicitud = require(path.join(RAIZ, 'api', '_solicitud.js'));

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Cuando una revisión falla, `solicitud` no existe. Sin esto, la primera
   aserción en rojo revienta la corrida y las demás nunca se ven — y el rojo
   sirve justamente para leerlo entero. Se comprobó rompiendo el código a
   propósito: con la regla del contacto invertida, la prueba se caía en la
   primera línea en vez de enseñar las ocho que cazaba. */
function datos(r) { return (r && r.solicitud) || {}; }

/* Un viaje completo, para no repetirlo en cada caso. */
function viaje(extra) {
  return Object.assign({
    origen: 'Guadalajara',
    destino: 'Querétaro',
    salida: '2026-09-20T08:00',
    regreso: '2026-09-23T18:00',
    unidad: 'Irizar i6S',
    nombre: 'Prueba de la Fase Dos'
  }, extra || {});
}

/* ============================================================ */
titulo('el teléfono se entiende como lo escribe la gente');
{
  /* Todas estas son la MISMA persona. Un cliente que escribe su número con
     lada, con espacios o con el +52 de WhatsApp no está haciendo nada raro. */
  [
    ['3324002285', 'pelón'],
    ['33 2400 2285', 'con espacios'],
    ['33-2400-2285', 'con guiones'],
    ['(33) 2400 2285', 'con paréntesis'],
    ['+52 33 2400 2285', 'con el +52'],
    ['52 33 2400 2285', 'con el 52 sin el más'],
    ['+521 33 2400 2285', 'con el viejo +52 1 de WhatsApp']
  ].forEach(function (par) {
    igual('  ' + par[1], solicitud.telefonoLimpio(par[0]), '3324002285');
  });

  /* Y lo que no es un teléfono, no pasa. El «12» es el de la fase 0. */
  ['12', '', '33240022', '332400228512345', 'no sé', '0000'].forEach(function (t) {
    igual('  «' + t + '» NO es un teléfono', solicitud.telefonoLimpio(t), '');
  });
}

/* ============================================================ */
titulo('el correo tiene que parecer un correo');
{
  igual('  uno normal', solicitud.correoLimpio('Alguien@Ejemplo.MX'), 'alguien@ejemplo.mx');
  igual('  con punto en el nombre', solicitud.correoLimpio('a.b@ejemplo.com.mx'), 'a.b@ejemplo.com.mx');
  /* «no-es-correo» es textualmente el que pasaba en el paso de datos, y que
     la fase 0 dejó anotado. */
  ['no-es-correo', 'sin@dominio', '@ejemplo.com', 'a@b', 'a b@c.com', ''].forEach(function (c) {
    igual('  «' + c + '» NO es un correo', solicitud.correoLimpio(c), '');
  });
}

/* ============================================================ */
titulo('uno de los dos basta, y ninguno no');
{
  const soloTel = solicitud.revisa(viaje({ telefono: '3324002285' }));
  cierto('con solo WhatsApp, pasa', soloTel.ok);
  igual('  y el correo queda vacío', datos(soloTel).correo, '');

  const soloMail = solicitud.revisa(viaje({ correo: 'alguien@ejemplo.com' }));
  cierto('con solo correo, pasa', soloMail.ok);
  igual('  y el teléfono queda vacío', datos(soloMail).telefono, '');

  const losDos = solicitud.revisa(viaje({ telefono: '3324002285', correo: 'a@ejemplo.com' }));
  cierto('con los dos, también', losDos.ok);

  /* Si mandó los dos y uno está mal escrito, se usa el que sirve. El cliente
     quería que le escribieran, no aprobar un examen de formato. */
  const unoMalo = solicitud.revisa(viaje({ telefono: '12', correo: 'a@ejemplo.com' }));
  cierto('con uno malo y uno bueno, pasa con el bueno', unoMalo.ok);
  igual('  y el malo no se guarda', datos(unoMalo).telefono, '');

  const nada = solicitud.revisa(viaje({}));
  igual('sin ninguno de los dos, NO pasa', nada.ok, false);
  igual('  y se le pide, no se le regaña', nada.error, 'sin contacto');

  /* «No puso nada» y «lo puso mal» son dos cosas distintas para quien está
     del otro lado de la pantalla, y se le dicen distinto. */
  const ilegible = solicitud.revisa(viaje({ telefono: '12' }));
  igual('con el contacto ilegible, NO pasa', ilegible.ok, false);
  igual('  y se le dice qué esperábamos', ilegible.error, 'contacto ilegible');
  cierto('  nombrando el formato', /diez d[ií]gitos/i.test(ilegible.aviso));

  /* Sin destino no hay ficha que mandar. */
  igual('sin destino, NO pasa', solicitud.revisa({ telefono: '3324002285' }).ok, false);
}

/* ============================================================ */
titulo('los días los cuenta el servidor');
{
  /* La pantalla no los manda. Es el mismo contador del cotizador y del
     cobro: una segunda cuenta en el navegador se separaría de la primera. */
  const r = solicitud.revisa(viaje({ telefono: '3324002285' }));
  igual('del 20 al 23 son cuatro días de servicio', datos(r).dias, 4);

  const unDia = solicitud.revisa(viaje({ telefono: '3324002285', regreso: '2026-09-20T18:00' }));
  igual('ida y vuelta el mismo día es un día', datos(unDia).dias, 1);

  /* Y lo que mande el navegador en `dias` se ignora: si se hiciera caso, el
     número de la ficha del vendedor lo escogería el cliente. */
  const mentiroso = solicitud.revisa(viaje({ telefono: '3324002285', dias: 99 }));
  igual('lo que mande el navegador NO se usa', datos(mentiroso).dias, 4);
}

/* ============================================================ */
titulo('la ficha del vendedor es la misma de siempre, con el contacto');
{
  const r = solicitud.revisa(viaje({ telefono: '33 2400 2285' }));
  const ficha = solicitud.fichaParaElVendedor(r.solicitud);

  /* El formato del bot: el vendedor lleva meses leyéndolo y sus botones
     —incluido el de mandar fotos de la unidad— cuelgan de ese ticket. */
  cierto('lleva el encabezado del ticket del bot', /Viaje para cotizar/.test(ficha));
  cierto('lleva la ruta', /Guadalajara → Querétaro/.test(ficha));
  cierto('lleva la unidad que escogió, por su nombre', /Irizar i6S/.test(ficha));
  cierto('lleva los días', /4 días/.test(ficha));

  /* Las fechas se leen, no se le enseña el ISO crudo. */
  cierto('la fecha se lee en palabras', /20 de septiembre/.test(ficha));
  igual('  y no sale el ISO crudo', /2026-09-20T/.test(ficha), false);

  /* Lo que hace distinta a la de la página: hay que escribirle primero. */
  cierto('dice que entró por la página', /Entró por la página/.test(ficha));
  cierto('trae el WhatsApp del cliente', /3324002285/.test(ficha));
  cierto('trae su nombre', /Prueba de la Fase Dos/.test(ficha));
  cierto('le dice al vendedor que él escribe primero', /Escríbele tú/.test(ficha));

  /* Sin teléfono, el consejo cambia: no se le puede decir que le escriba por
     WhatsApp a alguien que no dejó WhatsApp. */
  const porCorreo = solicitud.revisa(viaje({ correo: 'alguien@ejemplo.com' }));
  const fichaCorreo = solicitud.fichaParaElVendedor(porCorreo.solicitud);
  cierto('si no dejó WhatsApp, se le dice que conteste por correo',
    /Contéstale por correo/.test(fichaCorreo));
  cierto('  y trae el correo', /alguien@ejemplo\.com/.test(fichaCorreo));
}

/* ============================================================
   LA FICHA VA COMPLETA · 15-sep-2026
   ------------------------------------------------------------
   Lo pidió el dueño: los camiones y la Suburban los cotiza una
   persona, y esa persona cotiza CON LO QUE TENGA. Media docena de
   datos que el cliente ya había escrito en la pantalla no llegaban
   a la ficha, así que el vendedor tenía que volver a preguntarlos
   por WhatsApp — o cotizar a ojo.

   Lo que faltaba, en orden de lo que más cuesta preguntar otra vez:

     · cuántos van          (el campo nuevo del cotizador)
     · si es solo ida       (cambia el precio entero)
     · de dónde se recoge   (calle, colonia y referencia)
     · si se mueven allá    (y sus notas)
     · su nombre            (decía «No dejó nombre» casi siempre)
     · sus comentarios

   La ficha la lee una persona EN UN TELÉFONO: los renglones nuevos
   solo salen cuando hay algo que decir.
   ============================================================ */
titulo('la ficha lleva todo lo que el cliente ya escribió');
{
  const completo = solicitud.revisa(viaje({
    telefono: '3324002285',
    pasajeros: 44,
    redondo: false,
    calle: 'Av. Alba 1666',
    colonia: 'Lomas de San Pedrito',
    referencia: 'Frente a la gasolinera',
    movimientos: 2,
    notasMovimientos: 'Queremos ir al Malecón y un día a Sayulita',
    nombre: 'Ana Ruiz',
    notas: 'Somos de una escuela, van 4 maestros'
  }));
  cierto('con todo lleno, pasa', completo.ok);
  const f = solicitud.fichaParaElVendedor(completo.solicitud);

  cierto('cuántos van', /44 pasajeros/.test(f));
  cierto('que es solo ida', /[Ss]olo ida/.test(f));
  cierto('de dónde se recoge · la calle', /Av\. Alba 1666/.test(f));
  cierto('  la colonia', /Lomas de San Pedrito/.test(f));
  cierto('  y la referencia', /Frente a la gasolinera/.test(f));
  cierto('que se mueven allá', /2 días con movimiento/.test(f));
  cierto('  y a dónde van esos días', /Malec[óo]n/.test(f));
  cierto('su nombre', /Ana Ruiz/.test(f));
  igual('  y ya no dice que no lo dejó', /No dejó nombre/.test(f), false);
  cierto('sus comentarios', /4 maestros/.test(f));

  /* Y sigue sin precio: esta puerta existe para los viajes que no lo tienen. */
  igual('y sigue sin ningún precio', /\$\s?\d/.test(f), false);
}

titulo('lo que no escribió no ensucia la ficha');
{
  /* Una ficha con seis renglones vacíos se lee peor que una corta. El
     vendedor la abre en el teléfono, entre dos llamadas. */
  const pelado = solicitud.revisa(viaje({ telefono: '3324002285', nombre: '' }));
  const f = solicitud.fichaParaElVendedor(pelado.solicitud);

  igual('sin dirección, no hay renglón de dirección', /📌/.test(f), false);
  igual('sin movimientos, no se inventan', /días con movimiento/.test(f), false);
  igual('sin comentarios, no hay renglón vacío', /📝\s*$/m.test(f), false);
  /* Un viaje redondo no lo dice: es lo normal, y el ticket ya enseña las dos
     fechas. Lo que hay que gritar es el SOLO IDA. */
  igual('un viaje redondo no lleva el aviso de solo ida', /[Ss]olo ida/.test(f), false);
}

titulo('los datos nuevos se recortan como todos los demás');
{
  const largo = 'x'.repeat(5000);
  const r = solicitud.revisa(viaje({
    telefono: '3324002285',
    calle: largo, colonia: largo, referencia: largo, notasMovimientos: largo
  }));
  const s = datos(r);
  igual('la calle se recorta', (s.calle || '').length, 160);
  igual('la colonia también', (s.colonia || '').length, 80);
  igual('la referencia también', (s.referencia || '').length, 160);
  igual('y las notas de movimientos', (s.notasMovimientos || '').length, 400);

  /* Los días con movimiento los manda el navegador y llevan tope, como la
     gente: nadie se mueve trescientos días en el destino. */
  igual('los días con movimiento se acotan',
    datos(solicitud.revisa(viaje({ telefono: '3324002285', movimientos: 9999 }))).movimientos, 60);
  igual('  y no admiten negativos',
    datos(solicitud.revisa(viaje({ telefono: '3324002285', movimientos: -3 }))).movimientos, 0);
}

/* ============================================================ */
titulo('el acuse del cliente es corto y trae su viaje');
{
  const r = solicitud.revisa(viaje({ telefono: '3324002285' }));
  const acuse = solicitud.acuseParaElCliente(r.solicitud);

  cierto('saluda como pidió el plan', /Recibimos tu solicitud/.test(acuse));
  cierto('trae su ruta', /Guadalajara → Querétaro/.test(acuse));
  cierto('trae su unidad', /Irizar i6S/.test(acuse));
  cierto('cierra prometiendo la cotización', /cotización en breve/i.test(acuse));

  /* AQUÍ NO VA NINGÚN PRECIO. Esta puerta existe justamente para los viajes
     que no lo tienen; una cifra aquí sería una que no salió del criterio. */
  igual('no trae ningún precio', /\$\s?\d/.test(acuse), false);
  igual('  ni la ficha del vendedor',
    /\$\s?\d/.test(solicitud.fichaParaElVendedor(r.solicitud)), false);

  /* Y no le promete una hora exacta que nadie firmó. */
  igual('no promete una hora', /\b\d{1,2}\s*(horas|hrs)\b/i.test(acuse), false);
}

/* ============================================================ */
titulo('lo que llega se recorta antes de usarse');
{
  const largo = 'x'.repeat(5000);
  const r = solicitud.revisa(viaje({ telefono: '3324002285', destino: largo, notas: largo }));
  cierto('con un destino kilométrico, sigue pasando', r.ok);
  cierto('  pero el destino se recorta', (datos(r).destino || '').length <= 160);
  cierto('  y las notas también', (datos(r).notas || '').length <= 400);

  /* Los saltos de línea se aplanan: la ficha del vendedor se lee por
     WhatsApp y un salto metido a mano le rompe el formato. */
  const conSaltos = solicitud.revisa(viaje({ telefono: '3324002285', nombre: 'Ana\n\n\nPérez' }));
  igual('los saltos de línea se aplanan', datos(conSaltos).nombre, 'Ana Pérez');

  /* Y la gente tiene tope: nadie viaja con mil personas, y ese número entra
     del navegador. */
  igual('la gente se acota',
    datos(solicitud.revisa(viaje({ telefono: '3324002285', gente: 99999 }))).gente, 200);
  igual('  y no admite negativos',
    datos(solicitud.revisa(viaje({ telefono: '3324002285', gente: -5 }))).gente, 0);
}

/* ============================================================ */
titulo('el aviso puede fallar y la solicitud sigue recibida');
{
  /* Sin `RESEND_API_KEY` no sale ningún correo — que es justo el estado del
     servidor local—. Lo que NO puede pasar es que eso truene: un cliente que
     dejó sus datos no puede ver un error por algo que no es suyo. */
  const antes = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  const r = solicitud.revisa(viaje({ telefono: '3324002285' }));
  let salida = null, trono = false;
  const promesa = solicitud.avisa(r.solicitud)
    .then(function (s) { salida = s; })
    .catch(function () { trono = true; });

  promesa.then(function () {
    if (antes !== undefined) process.env.RESEND_API_KEY = antes;
    igual('avisar sin llave NO truena', trono, false);
    cierto('  y dice que no se pudo', salida && salida.alVendedor === false);
    cierto('  con el motivo escrito', salida && !!salida.porQue);
    igual('  y al cliente tampoco se le escribió', salida && salida.alCliente, false);

    console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
    process.exit(malas ? 1 : 0);
  });
}
