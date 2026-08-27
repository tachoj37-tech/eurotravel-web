/* ============================================================
   La liga propia de cada cliente
   ------------------------------------------------------------
   Al pagar, el correo lleva un botón: «Ver mi viaje». Esa liga
   es distinta para cada cliente y solo abre SU viaje.

   LA LIGA NO GUARDA NADA — LA LLEVA ENCIMA

   Es lo que cuesta imaginar de esto, porque suena a que hay que
   guardar en algún lado una lista de ligas. No hay tal lista, ni
   tabla, ni base de datos.

   Piénsalo como un pase de abordar: el pase mismo dice qué vuelo
   y qué asiento, y trae un sello que solo la aerolínea sabe
   hacer. Nadie guarda una lista de pases.

       /viaje.html?t=eyJzIjoiY3NfMUEyQiIsImUiOjE3OTk5fQ.9f3a7c…
                └────── qué viaje y hasta cuándo ──┘ └ sello ┘

   La primera mitad dice CUAL viaje —el identificador de la sesión
   de Stripe— y hasta cuándo vale. La segunda es un HMAC-SHA256
   hecho con `LIGAS_SECRETO`, que solo vive en Vercel.

   Cámbiale UN SOLO CARACTER a la primera mitad y la firma deja de
   cuadrar. Por eso la liga de un cliente NO PUEDE NOMBRAR el
   viaje de otro: para eso tendría que fabricar el sello, y sin la
   llave no puede.

   Y el folio y el contrato tampoco se guardan aquí: cuando abre
   la liga se le preguntan a Stripe y a EuroSystem en ese momento.
   Así siempre ve lo que es cierto hoy, no una copia vieja.

   LO QUE ESTA LIGA ES, DICHO SIN ADORNO

   Un pase al portador. Quien tenga ese correo, entra. Es la misma
   promesa que ya hace la `urlPdf` de EuroSystem, y es aceptable
   porque de aquí no se saca dinero: se ve el viaje y se abona de
   más, nunca de menos. Pero queda dicho.

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio.
   ============================================================ */

const crypto = require('crypto');

/* ------------------------------------------------------------
   CUANTO VIVE UNA LIGA
   ------------------------------------------------------------
   La fecha de regreso más 90 días —para que pueda volver por su
   contrato bastante después del viaje— y nunca menos de 30 días
   desde que se emite, para el que reserva con un mes de
   anticipación... o para el que reserva para mañana.

   Una liga vencida no deja a nadie fuera: existe la segunda
   puerta, la de folio y código.
   ------------------------------------------------------------ */
const DIAS_TRAS_EL_REGRESO = 90;
const DIAS_MINIMOS = 30;
const DIA = 86400000;

function clave() { return (process.env.LIGAS_SECRETO || '').trim(); }
function hayClave() { return clave().length > 0; }

/* Para el diagnóstico y los registros. */
function porQueNoSePuede() {
  if (!hayClave()) return 'Falta LIGAS_SECRETO en Vercel.';
  return '';
}

/* base64url: como base64 pero sin `+`, `/` ni `=`, que en una dirección
   web se escapan y ensucian la liga. */
function aB64(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64(t) {
  const s = String(t || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(s, 'base64');
}

function sello(cargaB64) {
  return aB64(crypto.createHmac('sha256', clave()).update(cargaB64, 'utf8').digest());
}

/* Comparar con `===` filtra información por cuánto tarda en fallar, y con
   eso se puede adivinar la firma carácter por carácter. Misma disciplina
   que `_firma-stripe.js`. */
function igualesEnTiempoConstante(a, b) {
  const A = Buffer.from(String(a), 'utf8');
  const B = Buffer.from(String(b), 'utf8');
  /* timingSafeEqual truena si miden distinto. El largo no es secreto —se ve
     en la liga— así que se resuelve antes, sin filtrar nada más. */
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/* ------------------------------------------------------------
   HASTA CUANDO VALE
   ------------------------------------------------------------
   `regresoISO` es la fecha de regreso del viaje. Si no se
   entiende, se usa el mínimo: más vale una liga corta que una
   liga con una fecha inventada.
   ------------------------------------------------------------ */
function venceEn(regresoISO, ahoraMs) {
  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();
  const minimo = ahora + DIAS_MINIMOS * DIA;

  /* Solo la parte de fecha y en UTC, para que no se cuele la zona horaria.
     Un `new Date('2026-09-06')` es medianoche UTC, o sea las 18:00 del día
     anterior en Tlaquepaque; aquí no importa tanto —son 90 días de holgura—
     pero se hace bien por costumbre. */
  const p = String(regresoISO || '').slice(0, 10).split('-');
  if (p.length !== 3) return minimo;
  const t = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (!isFinite(t)) return minimo;

  return Math.max(minimo, t + DIAS_TRAS_EL_REGRESO * DIA);
}

/* ------------------------------------------------------------
   FIRMAR
   ------------------------------------------------------------
   Devuelve el token, o '' si no hay llave. Quien llama decide
   qué hacer sin llave: el correo, por ejemplo, sale igual pero
   sin botón. Vale más un correo con el folio que ningún correo.
   ------------------------------------------------------------ */
function firma(idSesion, regresoISO, ahoraMs) {
  if (!hayClave()) return '';
  const s = String(idSesion || '').trim();
  if (!s) return '';
  const carga = aB64(JSON.stringify({ s: s, e: venceEn(regresoISO, ahoraMs) }));
  return carga + '.' + sello(carga);
}

/* La dirección completa, lista para el correo.

   VA CON `.html`. Vercel sirve el archivo estático en `/viaje.html`; sin
   `cleanUrls`, `/viaje` a secas da 404. Antes esto armaba `/viaje?t=` y TODO
   cliente que pagaba caía en un 404 al abrir su liga — lo cazó la tanda de
   clientes de prueba el 26-ago-2026. */
function ligaDelViaje(sitio, idSesion, regresoISO, ahoraMs) {
  const t = firma(idSesion, regresoISO, ahoraMs);
  if (!t) return '';
  return String(sitio || '').replace(/\/+$/, '') + '/viaje.html?t=' + t;
}

/* ------------------------------------------------------------
   ABRIR
   ------------------------------------------------------------
   Devuelve `{ ok:true, sesion }` o `{ ok:false, motivo, vencida }`.

   `motivo` es para el registro del servidor, NUNCA para la
   respuesta: a quien toca la puerta no se le explica por qué no
   abrió. `vencida` sí sale, porque a ése hay que mandarlo a la
   segunda puerta en vez de dejarlo mirando un error.

   LA FIRMA SE VERIFICA ANTES DE TOCAR STRIPE. Sin eso, una liga
   inventada nos haría preguntarle a Stripe por sesiones ajenas
   —una por intento— y eso ya es una fuga: el que prueba
   identificadores se entera de cuáles existen.
   ------------------------------------------------------------ */
function abre(token, ahoraMs) {
  if (!hayClave()) return { ok: false, motivo: 'sin LIGAS_SECRETO configurado' };

  const t = String(token || '');
  const punto = t.indexOf('.');
  if (punto < 1 || punto === t.length - 1) return { ok: false, motivo: 'liga mal formada' };

  const carga = t.slice(0, punto);
  const firmaQueTrae = t.slice(punto + 1);

  if (!igualesEnTiempoConstante(firmaQueTrae, sello(carga))) {
    return { ok: false, motivo: 'la firma no cuadra' };
  }

  /* La firma ya cuadró, así que lo de adentro lo escribimos nosotros. Aun
     así se lee con cuidado: un error aquí no puede tumbar la pantalla. */
  let d;
  try { d = JSON.parse(deB64(carga).toString('utf8')); }
  catch (e) { return { ok: false, motivo: 'carga ilegible' }; }

  if (!d || typeof d.s !== 'string' || !d.s) return { ok: false, motivo: 'carga sin sesión' };

  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();
  if (typeof d.e !== 'number' || !isFinite(d.e)) return { ok: false, motivo: 'carga sin vencimiento' };
  if (ahora > d.e) return { ok: false, motivo: 'liga vencida', vencida: true };

  return { ok: true, sesion: d.s, vence: d.e };
}

module.exports = {
  DIAS_TRAS_EL_REGRESO, DIAS_MINIMOS,
  hayClave, porQueNoSePuede, venceEn,
  firma, ligaDelViaje, abre
};
