/* ============================================================
   EL VIAJE DE UN DÍA NO PODÍA TENER CONTRATO (10-sep-2026)
   ============================================================
   `../EUROSYSTEM/CONTRATOS-API.md` lo exige:

     | fechaRegreso | fecha ISO con zona | Sí | Tiene que ser
     | posterior a la salida.

   Y una fecha sin hora se convierte en las 00:00 de ese día. O sea que
   un viaje que sale y vuelve el MISMO día mandaba:

     fechaSalida : 2026-11-20T07:00:00-06:00
     fechaRegreso: 2026-11-20T00:00:00-06:00

   …un regreso SIETE HORAS ANTES de la recogida. EuroSystem contestaba
   422 y el contrato no se creaba nunca.

   No es un caso raro: le pega a todo viaje de un día —Tequila, Chapala,
   una boda, una graduación, que son de los que más se venden— y a todo
   viaje sencillo, donde la hora de regreso ni siquiera se pregunta.

   Y falla del peor modo posible: el cliente YA depositó, y de las cinco
   salidas de error de `subeContrato` ninguna le llega a él —todas van al
   dueño—. El dueño tampoco podía arreglarlo diciendo «va» otra vez,
   porque el dato se recalculaba igual de roto en cada intento.
   ============================================================ */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

process.env.WHATSAPP_APP_SECRET = 'secreto';
process.env.WHATSAPP_TOKEN = 'tok';
process.env.WHATSAPP_PHONE_ID = '111';
process.env.WHATSAPP_VERIFY_TOKEN = 'v';
process.env.DUENO_WHATSAPP = '5213311112222';
process.env.CONTRATOS_API_KEY = 'llave-de-mentiras';

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const { armaContrato } = await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href);

/* Una ficha como la que queda después de que el dueño autoriza. */
function ficha(viaje, datos) {
  return {
    cliente: '5213366670001',
    total: 19000, anticipo: 4000,
    viajeDatos: Object.assign({
      origen: 'Guadalajara', destino: 'Tequila', gente: 14, unidad: 'Sprinter'
    }, viaje),
    contrato: Object.assign({ nombre: 'Ana López', telefono: '5213366670001' }, datos)
  };
}

function fechas(cuerpo) {
  const s = (cuerpo && cuerpo.servicio) || {};
  return {
    salida: s.fechaSalida, regreso: s.fechaRegreso,
    posterior: new Date(s.fechaRegreso) > new Date(s.fechaSalida),
    tipo: s.tipoViaje, obs: cuerpo.observaciones || ''
  };
}

titulo('1 · ida y vuelta el mismo día, sin hora de regreso acordada');
{
  const f = fechas(armaContrato(
    ficha({ salida: '2026-11-20', regreso: '2026-11-20' }, { horaSalida: '07:00' }),
    '5213366670001'));
  console.log('     salida  = ' + f.salida);
  console.log('     regreso = ' + f.regreso);
  ok('el regreso es POSTERIOR a la salida (si no, EuroSystem da 422)', f.posterior);
  ok('el día no se mueve: sigue siendo el 20', /^2026-11-20T/.test(f.regreso));
  ok('las observaciones dicen que la hora no se acordó',
    /HORA DE REGRESO: no se acord[oó]/.test(f.obs));
  ok('  y le piden a la oficina cuadrarla', /[Cc]uadrarla con el cliente/.test(f.obs));
}

titulo('2 · viaje sencillo (solo ida): la hora de regreso ni se pregunta');
{
  const f = fechas(armaContrato(
    ficha({ salida: '2026-11-20', regreso: '2026-11-20', soloIda: true }, { horaSalida: '07:00' }),
    '5213366670001'));
  ok('el regreso es posterior a la salida', f.posterior);
  ok('y el contrato dice SENCILLO', f.tipo === 'SENCILLO');
}

titulo('3 · si la hora SÍ se acordó, se respeta esa y no las 23:59');
{
  const f = fechas(armaContrato(
    ficha({ salida: '2026-11-20', regreso: '2026-11-20' }, { horaSalida: '07:00', horaRegreso: '19:30' }),
    '5213366670001'));
  ok('el regreso va a las 19:30', /T19:30/.test(f.regreso));
  ok('es posterior a la salida', f.posterior);
  ok('y NO se agrega la nota de hora sin acordar', !/HORA DE REGRESO: no se acord/.test(f.obs));
}

titulo('4 · el viaje de varios días sigue igual que siempre');
{
  const f = fechas(armaContrato(
    ficha({ destino: 'Puerto Vallarta', salida: '2026-11-20', regreso: '2026-11-22' },
      { horaSalida: '07:00', horaRegreso: '20:00' }),
    '5213366670001'));
  ok('salida el 20 a las 07:00', /^2026-11-20T07:00/.test(f.salida));
  ok('regreso el 22 a las 20:00', /^2026-11-22T20:00/.test(f.regreso));
  ok('es posterior', f.posterior);
  ok('y es REDONDO', f.tipo === 'REDONDO');

  /* Y de varios días sin hora de regreso: sigue sirviendo, porque el día
     ya es posterior por sí solo. No se le pone 23:59 a eso. */
  const g = fechas(armaContrato(
    ficha({ destino: 'Puerto Vallarta', salida: '2026-11-20', regreso: '2026-11-22' },
      { horaSalida: '07:00' }),
    '5213366670001'));
  ok('varios días sin hora de regreso: sigue siendo posterior', g.posterior);
  ok('  y no se le inventa la nota de las 23:59', !/23:59/.test(g.obs));
}

titulo('5 · sin fecha de salida no se inventa nada');
{
  const f = fechas(armaContrato(ficha({ salida: '', regreso: '' }, {}), '5213366670001'));
  ok('el regreso queda vacío, no en una fecha falsa', !f.regreso);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
