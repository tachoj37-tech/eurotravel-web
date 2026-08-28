/* ============================================================
   Las defensas de los endpoints, en un solo lugar
   ------------------------------------------------------------
   Lo usan places, cotizar, pagar y diagnostico. Antes cada uno
   traia su propia copia de: la lista de origenes, el guardia de
   origen, el freno por visitante, el tope diario y la lectura de
   la IP. Cuatro copias que habia que mantener sincronizadas a
   mano —el propio codigo lo pedia: «si cambias la lista, cambiala
   en los dos archivos»—. Aqui viven una vez.

   El guion bajo del nombre evita que Vercel lo publique como una
   direccion mas del sitio.

   ------------------------------------------------------------
   POR QUE LA IP SE LEE ASI, Y NO DEL PRIMER x-forwarded-for
   ------------------------------------------------------------
   `x-forwarded-for` es una cadena "cliente, proxy1, proxy2". El
   PRIMER valor lo escribe quien llama: es dato del cliente, no
   del servidor. Frenar por ese extremo es no tener freno —quien
   ataca rota el primer valor en cada peticion y el contador por
   visitante nunca sube—. Este mismo defecto se pago en EuroSystem
   y quedo documentado con ataque de prueba: con la cabecera fija
   salian los 429, rotandola no salia ninguno.

   Lo correcto en Vercel es `x-vercel-forwarded-for`, que lo pone
   el borde y el cliente no puede tocar; si no esta, el ULTIMO
   valor de `x-forwarded-for`, que es el que agrego el proxy mas
   cercano a nosotros. El primero jamas.
   ============================================================ */

/* ------------------------------------------------------------
   EL DOMINIO DEL SITIO VIVE EN UNA VARIABLE, NO EN EL CODIGO
   ------------------------------------------------------------
   Esta lista decide TRES cosas, y conviene tenerlas juntas en la
   cabeza porque no es evidente que sean la misma:

     1. quién puede llamar a las APIs (`origenValido`)
     2. a dónde regresa Stripe después de pagar (`sitioDe`)
     3. LA LIGA PROPIA QUE VA EN EL CORREO DEL CONTRATO — el
        webhook la arma con `PERMITIDOS[0]`, porque Stripe llama de
        servidor a servidor y no manda `Origin`. No hay cabecera de
        dónde sacarlo: sale de aquí o no sale.

   Estaba fija en `https://eurotravel-web.vercel.app`. El día que
   entre el dominio de verdad eso significa, en este orden: cotizar
   y pagar contestando 403 desde el primer minuto, y los correos de
   los contratos mandando al cliente al dominio viejo.

   Así que el dominio se pone en Vercel y no se toca código:

     SITIO_URL       el dominio bueno — el que sale en los correos
     ORIGENES_EXTRA  otros que también pueden llamar, con coma en
                     medio. Para el `www.` y para el día del cambio.

   El `.vercel.app` se queda SIEMPRE en la lista aunque haya
   dominio nuevo: Vercel no lo apaga, las ligas ya mandadas siguen
   apuntando ahí, y un cliente que abra un correo viejo tiene que
   poder entrar.
   ------------------------------------------------------------ */
const SITIO_POR_OMISION = 'https://eurotravel-web.vercel.app';

/* Un origen es `https://algo`, sin ruta, sin barra al final y sin nada más.
   Lo que no cumpla se TIRA: un `SITIO_URL` mal tecleado —con `/` al final, o
   con la ruta pegada— no puede acabar armando ligas rotas ni abriendo la
   puerta a un origen que no es. Vale más quedarse con el de siempre. */
function origenLimpio(texto) {
  const t = String(texto == null ? '' : texto).trim();
  if (!t) return '';
  let u;
  try { u = new URL(t); } catch (e) { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  /* En producción solo https. Un `http://` en la lista sería un correo
     mandando al cliente por una liga sin candado. */
  if (u.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)(:|$)/.test(u.host)) return '';
  if (u.pathname !== '/' || u.search || u.hash) return '';
  return u.origin;
}

function listaDeOrigenes() {
  const fuera = [];

  /* El canónico va PRIMERO: de ahí salen las ligas de los correos. */
  const canonico = origenLimpio(process.env.SITIO_URL);
  if (process.env.SITIO_URL && !canonico) {
    /* Regla 9: esto lo lee un programador en el registro, no un cliente. */
    console.error('[defensas] SITIO_URL con mala forma, se ignora: ' +
      JSON.stringify(String(process.env.SITIO_URL).slice(0, 120)));
  }
  fuera.push(canonico || SITIO_POR_OMISION);

  String(process.env.ORIGENES_EXTRA || '').split(',').forEach(function (trozo) {
    const o = origenLimpio(trozo);
    if (o) fuera.push(o);
  });

  /* El de Vercel nunca se cae de la lista: ver la nota de arriba. */
  fuera.push(SITIO_POR_OMISION);

  /* El origen de desarrollo NO viaja a producción. Antes estaba fijo en la
     lista y se publicaba con el sitio: una entrada más que defender a cambio
     de nada, porque en producción nadie legítimo llega desde localhost. */
  if (process.env.VERCEL_ENV !== 'production') {
    fuera.push('http://localhost:5175');
  }

  /* Sin repetidos, y respetando el orden: el primero manda. */
  return fuera.filter(function (o, i) { return fuera.indexOf(o) === i; });
}

const PERMITIDOS = listaDeOrigenes();

/* ------------------------------------------------------------
   COMPARAR ORÍGENES ENTEROS, NUNCA POR PREFIJO
   ------------------------------------------------------------
   Aquí había un hueco, y se comprobó contra el sitio publicado antes de
   taparlo. La comparación era:

       referer.indexOf(permitido) === 0

   O sea, por PREFIJO. Y un dominio ajeno puede empezar con el nuestro:

       https://eurotravel-web.vercel.app.malicioso.example/

   empieza con `https://eurotravel-web.vercel.app`, así que pasaba. Se probó
   en producción y la puerta abrió. Igual con el de localhost.

   Qué se podía hacer con eso: no leer datos —no mandamos cabeceras de CORS,
   así que el navegador ajeno no ve la respuesta— pero SÍ disparar nuestras
   puertas caras desde el navegador de un visitante suyo, gastando cuota de
   Google que se paga, y con el freno contando contra la IP de la VÍCTIMA en
   vez de la del atacante.

   Ahora se compara el origen COMPLETO, sacado con el analizador de URL. Un
   dominio que empiece igual ya no cuela, porque su origen es otro.

   Y OJO CON LO QUE ESTA PUERTA NO ES: no protege contra quien llame
   directo. Cualquiera con curl pone `Origin` a mano y entra —se comprobó—.
   Esto es defensa contra el navegador de un tercero, nada más. Lo que de
   verdad protege es el freno y que el precio se vuelva a calcular aquí.
   ------------------------------------------------------------ */
function origenValido(req) {
  const h = req.headers || {};

  /* Si viene `origin`, manda y se compara exacto. */
  const origen = String(h.origin || '').trim();
  if (origen) return PERMITIDOS.indexOf(origen) >= 0;

  /* Si no, el `referer`, pero quedándose solo con su origen. */
  const referer = String(h.referer || '').trim();
  if (!referer) return false;
  return PERMITIDOS.indexOf(origenDe(referer)) >= 0;
}

/* El origen de una URL, o cadena vacía si no se puede leer. */
function origenDe(url) {
  try { return new URL(url).origin; } catch (e) { return ''; }
}

/* El origen concreto desde el que vino, para armar las URLs de retorno del
   pago. Cae al primero de la lista si no reconoce ninguno. */
function sitioDe(req) {
  const h = req.headers || {};
  const origen = String(h.origin || '').trim();
  if (PERMITIDOS.indexOf(origen) >= 0) return origen;

  /* El mismo arreglo que en origenValido: por origen completo, no por prefijo.
     Aquí importa el doble, porque de esto sale la dirección a la que Stripe
     regresa al cliente después de pagar. */
  const suyo = origenDe(String(h.referer || '').trim());
  if (PERMITIDOS.indexOf(suyo) >= 0) return suyo;

  /* Si no se reconoce nada, el sitio de verdad. Nunca lo que mandó quien
     llamó: así esta función no puede devolver una dirección ajena, y la
     pantalla de pago no se puede usar para mandar a nadie a otro lado. */
  return PERMITIDOS[0];
}

/* La IP en la que se puede confiar para contar. Ver la nota de arriba: nunca
   el primer x-forwarded-for. */
function ipDeConfianza(req) {
  const h = req.headers || {};
  const vercel = (h['x-vercel-forwarded-for'] || '').trim();
  if (vercel) return vercel;
  const cadena = String(h['x-forwarded-for'] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (cadena.length) return cadena[cadena.length - 1];   // el ultimo, el del borde
  return (h['x-real-ip'] || '').trim() || 'sin-ip';
}

/* Un freno con estado propio. Cada endpoint crea el suyo con sus topes:
   Places aguanta mas que Pagar. El estado (el Map de visitantes, el contador
   del dia) vive en el cierre, no en variables sueltas de cada archivo.

   La clave del contador la elige el servidor (la IP de confianza), no el
   cliente: un Map con clave que elige quien ataca crece sin tope. Por eso el
   barrido por reloj y el desalojo duro al pasar de 5000. */
function creaFreno(opciones) {
  const porMinuto = opciones.porMinuto;
  const porDia = opciones.porDia;
  const visitantes = new Map();
  let dia = { fecha: '', total: 0 };

  function permiteVisitante(ip) {
    const ahora = Date.now();
    const reg = visitantes.get(ip) || { desde: ahora, n: 0 };
    if (ahora - reg.desde > 60000) { reg.desde = ahora; reg.n = 0; }
    reg.n += 1;
    visitantes.set(ip, reg);
    if (visitantes.size > 5000) visitantes.clear();
    return reg.n <= porMinuto;
  }

  function permiteDia() {
    const hoy = new Date().toISOString().slice(0, 10);
    if (dia.fecha !== hoy) dia = { fecha: hoy, total: 0 };
    dia.total += 1;
    return dia.total <= porDia;
  }

  /* Cobra una peticion contra los dos topes. Devuelve el codigo a responder
     (429) o null si pasa. Se le da el req: de ahi saca la IP de confianza. */
  return function cobra(req) {
    const ip = ipDeConfianza(req);
    if (!permiteVisitante(ip)) return { status: 429, error: 'Demasiadas solicitudes' };
    if (!permiteDia()) return { status: 429, error: 'Límite diario alcanzado' };
    return null;
  };
}

/* La puerta comun al inicio de cada handler. Resuelve OPTIONS, exige POST
   (salvo que se permita otro metodo) y el origen. Devuelve true si YA
   contesto —el handler debe salir— o false si puede seguir. */
function puerta(req, res, opciones) {
  const o = opciones || {};
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  const metodos = o.metodos || ['POST'];
  if (metodos.indexOf(req.method) < 0) {
    res.status(405).json({ error: 'Método no permitido' });
    return true;
  }
  if (!origenValido(req)) {
    res.status(403).json({ error: 'Origen no autorizado' });
    return true;
  }
  return false;
}

/* ------------------------------------------------------------
   NADIE SE QUEDA SIN RESPUESTA
   ------------------------------------------------------------
   Comprobado el 27-ago-2026, y no era hipotético: la propia batería
   de pruebas de esta máquina tiró «Deriving bits failed» —`scrypt`
   sin memoria— en medio de una corrida.

   Si eso pasa mientras un cliente crea su cuenta, la función
   revienta y sin esto no hay nada que lo ataje. El resultado,
   medido: un rechazo no atendido, el cliente SIN RESPUESTA, y la
   pantalla diciéndole «no hubo conexión» — que es mentira, sí
   hubo: el que falló fue el servidor. Además, un rechazo no
   atendido puede tumbar la instancia y llevarse por delante a los
   que estaban a media compra.

   Lo que se le dice al cliente NO nombra lo que pasó: eso va al
   registro, que es donde lo lee un programador (regla 9). A él se
   le dice lo único que le sirve.

   Y el `catch` de adentro NO es paranoia de más: si lo que reventó
   fue después de contestar, volver a contestar tira otro error y
   estaríamos en las mismas.
   ------------------------------------------------------------ */
function aPruebaDeTronadas(nombre, aviso, handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      console.error('[' + nombre + '] reventó: ' + ((e && e.stack) || e));
      try {
        res.status(503).json({ error: true, aviso: aviso });
      } catch (e2) { /* ya se había contestado; no hay nada más que hacer */ }
    }
  };
}

/* Lee y parsea el cuerpo JSON con tolerancia: Vercel a veces lo entrega ya
   como objeto, a veces como texto. Nunca revienta. */
function cuerpoJSON(req) {
  let cuerpo = req.body;
  if (typeof cuerpo === 'string') {
    try { cuerpo = JSON.parse(cuerpo); } catch (e) { cuerpo = {}; }
  }
  return cuerpo || {};
}

module.exports = {
  PERMITIDOS,
  SITIO_POR_OMISION,
  /* Las dos de abajo se exportan para poder probar el cambio de dominio sin
     tener que recargar el módulo con otras variables de entorno. */
  origenLimpio,
  listaDeOrigenes,
  origenValido,
  sitioDe,
  ipDeConfianza,
  creaFreno,
  puerta,
  aPruebaDeTronadas,
  cuerpoJSON
};
