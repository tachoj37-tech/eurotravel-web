/* ============================================================
   Crear una cuenta y confirmar el correo — la lógica
   ------------------------------------------------------------
   Vive aparte de los endpoints por lo mismo que `_webhook-logica`:
   así se prueba sin red y sin servidor, con un Stripe y un correo
   de mentiras. Los tres archivos de `/api` que la usan son cáscaras
   de diez líneas.

   TRES PUERTAS

     crear      correo + contraseña + nombre + teléfono
     reenviar   otra vez el código, «las veces que sea necesario»
     confirmar  el código; deja la cuenta lista y abre sesión

   LA REGLA QUE MANDA SOBRE TODAS: NADA DE ESTO DICE SI UN CORREO
   YA TIENE CUENTA.

   Si «crear» contestara «ese correo ya existe», cualquiera podría
   ir probando correos y sacar la lista de clientes de la empresa.
   Así que crear con un correo ya registrado contesta EXACTAMENTE
   lo mismo que crear con uno nuevo —«te mandamos un código»— y lo
   que cambia es lo que le llega a ese correo: si ya tenía cuenta,
   no le llega un código de alta, le llega un aviso de que alguien
   intentó registrarse con su correo.

   Esa es la única forma honesta de decir «ya existe» sin decírselo
   a quien pregunta: se le dice al dueño del correo, que es a quien
   le importa.
   ============================================================ */

const cuentas = require('./_cuentas');
const acceso = require('./_acceso');
const stripe = require('./_stripe');
const correo = require('./_correo');

/* Lo que la pantalla puede enseñar. NUNCA se devuelve el id del cliente ni
   nada de la ficha: la pantalla no lo necesita y la cookie ya lo lleva. */
function ok(extra) { return Object.assign({ ok: true }, extra || {}); }
function no(status, aviso, extra) {
  return { status: status, cuerpo: Object.assign({ error: true, aviso: aviso }, extra || {}) };
}

/* ------------------------------------------------------------
   ¿ESTA CUENTA YA EXISTE, Y CUAL ES?
   ------------------------------------------------------------
   Stripe no impide dos clientes con el mismo correo, así que
   puede haber más de uno: pasa si alguien compró como invitado
   dos veces antes de registrarse.

   Se queda con el que YA TENGA CUENTA. Si ninguno la tiene, con
   el primero, que es el más viejo: ése es el que trae su historial
   de compras, y la cuenta se le monta encima en vez de nacer
   huérfana al lado.
   ------------------------------------------------------------ */
function eligeCliente(lista) {
  const l = Array.isArray(lista) ? lista : [];
  if (!l.length) return null;
  for (let i = 0; i < l.length; i++) {
    if (cuentas.tieneCuenta(l[i].metadata || {})) return l[i];
  }
  return l[0];
}

/* ------------------------------------------------------------
   MANDAR EL CODIGO, CONTANDO EL ENVIO
   ------------------------------------------------------------
   Guarda el resumen del código en la ficha, manda el correo y
   apunta el envío. Si el correo no sale, NO se apunta: sería
   gastarle un envío al cliente por una falla nuestra.
   ------------------------------------------------------------ */
async function mandaCodigo(cliente, ahoraMs) {
  const codigo = acceso.nuevoCodigo();
  const guardar = Object.assign(
    acceso.paraGuardar(codigo, ahoraMs),
    cuentas.paraContarEnvio(cliente.metadata || {}, ahoraMs)
  );

  const escrito = await stripe.guardaEnCliente(cliente.id, guardar);
  if (escrito.error) return { ok: false, motivo: escrito.error };

  const envio = await correo.mandaCodigoDeCuenta(cliente.email, codigo, cliente.name);
  if (!envio.ok) {
    /* El código quedó escrito pero no llegó. Se borra para que el cliente no
       se quede con una cuenta que pide un código que nunca vio. */
    await stripe.guardaEnCliente(cliente.id, acceso.paraBorrar());
    return { ok: false, motivo: envio.motivo, pista: correo.pistaDelFallo(envio.motivo) };
  }
  return { ok: true };
}

/* ============================================================
   CREAR
   ============================================================ */
async function crear(cuerpo, ahoraMs) {
  const c = cuerpo || {};
  const email = cuentas.normalizaCorreo(c.correo);
  const nombre = String(c.nombre || '').trim().slice(0, 120);
  const telefono = String(c.telefono || '').trim().slice(0, 30);

  if (!cuentas.correoValido(email)) {
    return no(422, 'Revisa el correo, parece que le falta algo.');
  }
  const malaClave = cuentas.porQueNoSirve(c.contrasena);
  if (malaClave) return no(422, malaClave);
  if (nombre.length < 2) return no(422, 'Escribe tu nombre.');

  if (!acceso.hayClave()) {
    /* El mensaje que ve el cliente no nombra variables de entorno (regla 9):
       eso va al registro del servidor, no a su pantalla. */
    console.error('[cuentas] sin LIGAS_SECRETO: no se puede firmar nada');
    return no(503, 'No podemos crear cuentas en este momento. Inténtalo más tarde.');
  }

  const hallados = await stripe.clientesPorCorreo(email);
  if (hallados.error) {
    console.error('[cuentas] no se pudo consultar a Stripe: ' + hallados.error);
    return no(503, 'No podemos crear cuentas en este momento. Inténtalo más tarde.');
  }

  const yaEsta = eligeCliente(hallados.clientes);

  /* --- ese correo YA tiene cuenta --- */
  if (yaEsta && cuentas.tieneCuenta(yaEsta.metadata || {})) {
    /* A quien pregunta se le contesta lo mismo que a todos. A quien de verdad
       es dueño del correo se le avisa, que es quien tiene que enterarse. */
    await correo.manda({
      from: correo.DE,
      to: [email],
      subject: 'Alguien intentó registrarse con tu correo en Eurotravel',
      text: [
        'Hola,', '',
        'Alguien acaba de intentar crear una cuenta en Eurotravel con este correo,',
        'que ya tiene una.', '',
        'Si fuiste tú y no te acuerdas de tu contraseña, usa «Olvidé mi contraseña»',
        'en la página. Si no fuiste tú, no tienes que hacer nada: tu cuenta no cambió',
        'y quien lo intentó no vio nada tuyo.', '',
        'Eurotravel · San Pedro Tlaquepaque, Jalisco'
      ].join('\n')
    });
    /* MISMO cuerpo que el alta buena, campo por campo. La primera versión
       devolvía `{ok, mandado}` aquí y `{ok, mandado, pista}` allá: un campo
       de diferencia bastaba para saber si un correo ya estaba registrado.
       Lo cazó la prueba, no el ojo. */
    return { status: 200, cuerpo: ok({ mandado: true, pista: acceso.pistaDeCorreo(email) }) };
  }

  /* --- hay cliente de compras anteriores, pero sin cuenta: se le monta --- */
  let cliente = yaEsta;
  const nueva = await cuentas.paraCrear(c.contrasena, ahoraMs);

  if (cliente) {
    const escrito = await stripe.guardaEnCliente(cliente.id, nueva);
    if (escrito.error) {
      console.error('[cuentas] no se pudo escribir la cuenta: ' + escrito.error);
      return no(503, 'No podemos crear cuentas en este momento. Inténtalo más tarde.');
    }
    cliente = Object.assign({}, cliente, { metadata: Object.assign({}, cliente.metadata, nueva) });
  } else {
    const creado = await stripe.creaCliente({
      email: email, name: nombre, phone: telefono, metadata: nueva
    });
    if (creado.error) {
      console.error('[cuentas] no se pudo crear el cliente: ' + creado.error);
      return no(503, 'No podemos crear cuentas en este momento. Inténtalo más tarde.');
    }
    cliente = creado.cliente;
  }

  const mandado = await mandaCodigo(cliente, ahoraMs);
  if (!mandado.ok) {
    console.error('[cuentas] cuenta creada pero el código NO salió: ' + mandado.motivo +
      (mandado.pista ? ' — ' + mandado.pista : ''));
    return no(502, 'Creamos tu cuenta pero no pudimos mandarte el código. Inténtalo de nuevo en un momento.');
  }

  return { status: 200, cuerpo: ok({ mandado: true, pista: acceso.pistaDeCorreo(email) }) };
}

/* ============================================================
   REENVIAR — «las veces que sea necesario»
   ============================================================ */
async function reenviar(cuerpo, ahoraMs) {
  const email = cuentas.normalizaCorreo((cuerpo || {}).correo);
  if (!cuentas.correoValido(email)) return no(422, 'Revisa el correo.');

  const hallados = await stripe.clientesPorCorreo(email);
  if (hallados.error) return no(503, 'No podemos mandarlo en este momento. Inténtalo más tarde.');

  const cliente = eligeCliente(hallados.clientes);

  /* Sin cuenta, o ya verificada: se contesta lo MISMO que si hubiera salido.
     Quien pregunta no se entera de nada. */
  if (!cliente || !cuentas.tieneCuenta(cliente.metadata || {}) ||
      cuentas.estaVerificada(cliente.metadata || {})) {
    return { status: 200, cuerpo: ok({ mandado: true }) };
  }

  const puede = cuentas.puedeMandarCodigo(cliente.metadata || {}, ahoraMs);
  if (!puede.ok) {
    return puede.motivo === 'muy seguido'
      ? no(429, 'Espera ' + puede.segundos + ' segundos para pedir otro código.', { segundos: puede.segundos })
      : no(429, 'Pediste demasiados códigos hoy. Inténtalo mañana o escríbenos.');
  }

  const mandado = await mandaCodigo(cliente, ahoraMs);
  if (!mandado.ok) {
    console.error('[cuentas] reenvío fallido: ' + mandado.motivo);
    return no(502, 'No pudimos mandarte el código. Inténtalo de nuevo en un momento.');
  }
  return { status: 200, cuerpo: ok({ mandado: true, pista: acceso.pistaDeCorreo(email) }) };
}

/* ============================================================
   CONFIRMAR
   ============================================================ */
async function confirmar(cuerpo, ahoraMs) {
  const c = cuerpo || {};
  const email = cuentas.normalizaCorreo(c.correo);
  if (!cuentas.correoValido(email)) return no(422, 'Revisa el correo.');

  const hallados = await stripe.clientesPorCorreo(email);
  if (hallados.error) return no(503, 'No podemos confirmar en este momento. Inténtalo más tarde.');

  const cliente = eligeCliente(hallados.clientes);
  /* Un correo sin cuenta y un código equivocado dan el MISMO mensaje: si no,
     probar códigos serviría para averiguar qué correos están registrados. */
  const generico = 'Ese código no es. Revísalo o pide otro.';
  if (!cliente || !cuentas.tieneCuenta(cliente.metadata || {})) return no(422, generico);

  if (cuentas.estaVerificada(cliente.metadata || {})) {
    /* Ya estaba: no es un error, es que le dieron dos veces. Se abre sesión y
       ya, en vez de mandarlo a empezar de nuevo. */
    return { status: 200, cuerpo: ok({ yaEstaba: true }), sesionPara: cliente.id };
  }

  const veredicto = acceso.revisaCodigo(cliente.metadata || {}, c.codigo, ahoraMs);
  if (!veredicto.ok) {
    if (veredicto.gastado) {
      const m = {};
      m[acceso.CAMPO_INTENTOS] = String(veredicto.van);
      await stripe.guardaEnCliente(cliente.id, m);
    }
    if (veredicto.agotado) {
      return no(429, 'Se acabaron los intentos de ese código. Pide uno nuevo.');
    }
    return no(422, generico);
  }

  /* Bien: se marca verificada, se borra el código —de un solo uso— y se
     limpia el contador de envíos. */
  const escrito = await stripe.guardaEnCliente(cliente.id, Object.assign(
    cuentas.paraVerificar(), acceso.paraBorrar(), cuentas.paraBorrarEnvios()
  ));
  if (escrito.error) {
    console.error('[cuentas] no se pudo marcar verificada: ' + escrito.error);
    return no(503, 'No podemos confirmar en este momento. Inténtalo más tarde.');
  }

  return { status: 200, cuerpo: ok({ verificada: true }), sesionPara: cliente.id };
}

module.exports = { crear, reenviar, confirmar, eligeCliente, mandaCodigo };
