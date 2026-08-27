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
const google = require('./_google');
const ligas = require('./_ligas');
const defensas = require('./_defensas');

/* El sitio del que salen las ligas de «Mis viajes». Sale de la lista de
   orígenes —o sea de `SITIO_URL` en Vercel— y no de una cabecera: es la misma
   dirección que el webhook pone en el correo del contrato, y las dos tienen
   que decir lo mismo el día que entre el dominio de verdad. */
function sitio() { return defensas.PERMITIDOS[0]; }

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

/* ============================================================
   ENTRAR
   ------------------------------------------------------------
   Correo y contraseña. Y NADA MAS: el dueño lo pidió expreso —«una
   vez que creó correo y contraseña ya no le vas a mandar correos
   para nada al entrar»—.

   CONTRA LA FUERZA BRUTA, LO QUE DE VERDAD ATAJA ES `scrypt`.

   Cada intento cuesta ~100 ms de máquina, así que probar un
   diccionario de un millón pasa de un segundo a día y medio. Eso
   es el freno de fondo; el de la puerta solo evita la ráfaga.

   Y NO HAY BLOQUEO POR CUENTA, a propósito. La regla 4 del
   proyecto lo dice: «un candado que el atacante le puede cerrar a
   otro no es un candado». Contar los fallos por correo dejaría a
   cualquiera fuera de su propia cuenta con solo teclearle mal la
   contraseña quince veces.
   ============================================================ */
async function entrar(cuerpo, ahoraMs) {
  const c = cuerpo || {};
  const email = cuentas.normalizaCorreo(c.correo);

  /* El MISMO mensaje para todo lo que salga mal: correo que no existe,
     cuenta sin contraseña, contraseña equivocada. Distinguirlos regalaría
     la lista de clientes registrados. */
  const generico = 'Ese correo o esa contraseña no son.';

  if (!cuentas.correoValido(email) || cuentas.porQueNoSirve(c.contrasena)) {
    return no(401, generico);
  }

  const hallados = await stripe.clientesPorCorreo(email);
  if (hallados.error) {
    console.error('[cuentas] no se pudo consultar a Stripe al entrar: ' + hallados.error);
    return no(503, 'No pudimos entrar ahora mismo. Inténtalo en un momento.');
  }

  const cliente = eligeCliente(hallados.clientes);
  const m = (cliente && cliente.metadata) || {};
  if (!cliente || !cuentas.tieneContrasena(m)) return no(401, generico);

  const buena = await cuentas.contrasenaValida(m, c.contrasena);
  if (!buena) return no(401, generico);

  /* Acertó la contraseña, así que ya demostró que la cuenta es suya: aquí
     SI se le puede decir que le falta confirmar, sin regalarle nada a nadie.
     Al revés —avisarlo antes de comprobar la contraseña— sería decirle a
     cualquiera que ese correo tiene cuenta. */
  if (!cuentas.estaVerificada(m)) {
    return no(403, 'Te falta confirmar tu correo. Te mandamos un código cuando quieras.',
      { faltaConfirmar: true });
  }

  return {
    status: 200,
    cuerpo: ok({ nombre: String(cliente.name || '').trim(), correo: email }),
    sesionPara: cliente.id
  };
}

/* ============================================================
   SALIR
   ------------------------------------------------------------
   No hay nada que borrar del lado del servidor —la sesión no se
   guarda en ningún lado, va firmada— así que salir es tirar la
   cookie. La cáscara es la que la tira.
   ============================================================ */
function salir() {
  return { status: 200, cuerpo: ok({ salio: true }), borrarSesion: true };
}

/* ============================================================
   ¿QUIEN SOY?
   ------------------------------------------------------------
   Lo pregunta la pantalla al cargar, para saber si enseña «entrar»
   o el nombre del cliente. Contesta con lo mínimo: si hay sesión y
   de quién es. Nunca el identificador de Stripe.

   Sin sesión NO es un error: es la respuesta normal de quien no ha
   entrado. Por eso contesta 200 con `dentro: false` en vez de un
   401, que la pantalla tendría que tratar como falla.
   ============================================================ */
async function yo(idCliente) {
  if (!idCliente) return { status: 200, cuerpo: { dentro: false } };

  const ficha = await stripe.traeCliente(idCliente);
  if (ficha.error) {
    /* La cookie estaba bien firmada pero el cliente ya no está. Se contesta
       «fuera» y la cáscara tira la cookie: dejarla puesta haría que la
       pantalla preguntara lo mismo en cada carga, para siempre. */
    return { status: 200, cuerpo: { dentro: false }, borrarSesion: true };
  }

  const cliente = ficha.cliente || {};
  const m = cliente.metadata || {};
  if (!cuentas.tieneCuenta(m) || !cuentas.estaVerificada(m)) {
    return { status: 200, cuerpo: { dentro: false }, borrarSesion: true };
  }

  return {
    status: 200,
    cuerpo: {
      dentro: true,
      nombre: String(cliente.name || '').trim(),
      correo: cuentas.normalizaCorreo(cliente.email),
      /* Para que Configuración sepa si pedir «tu contraseña de ahorita»: quien
         entró con Google nunca puso una. No es dato sensible —es sobre la
         cuenta de quien pregunta, y solo se contesta con sesión buena— y sin
         esto la pantalla tendría que adivinar. */
      tieneClave: cuentas.tieneContrasena(m)
    }
  };
}

/* ============================================================
   CONTINUAR CON GOOGLE
   ------------------------------------------------------------
   Lo pidió el dueño junto con las cuentas. La comprobación del
   papel firmado vive en `_google.js`, con el detalle de por qué
   se revisa cada cosa; aquí solo está lo que se hace DESPUES.

   LA REGLA: EL CORREO ES LA PERSONA.

   Si el correo que trae Google ya tiene cuenta, se LIGA a la que
   hay. No se crea una segunda. Da igual que la de antes se hiciera
   con contraseña: quedan las dos formas de entrar y el cliente
   escoge. Duplicar sería partirle el historial de viajes en dos
   sin que él se entere.

   Y SI YA TENIA CONTRASEÑA, ¿NO ES UN HUECO?

   No, y conviene tenerlo claro porque parece que sí. Google no
   dice «esta persona se llama así»: dice «esta persona demostró
   que ese buzón es suyo» —eso es `email_verified`, y sin él no se
   pasa de `_google.js`—. Quien controla el buzón ya puede entrar
   por «olvidé mi contraseña», que manda un código a ese mismo
   buzón. O sea que no abre ninguna puerta que no estuviera
   abierta. Lo que sí sería un hueco es aceptar el correo SIN que
   Google lo haya verificado, y eso está cerrado allá.

   ADEMAS QUEDA VERIFICADA. Si el cliente se había registrado con
   contraseña y nunca tecleó el código, entrar con Google le sirve
   de confirmación: Google acaba de comprobar el mismo buzón al
   que le mandamos ese código.
   ============================================================ */
async function conGoogle(cuerpo, ahoraMs) {
  if (!google.hayGoogle()) {
    console.error('[cuentas] entraron por Google sin GOOGLE_CLIENT_ID configurado');
    return no(503, 'Entrar con Google no está disponible ahora mismo. Usa tu correo y contraseña.');
  }

  if (!acceso.hayClave()) {
    console.error('[cuentas] sin LIGAS_SECRETO: no se puede firmar la sesión');
    return no(503, 'No podemos entrar en este momento. Inténtalo más tarde.');
  }

  const v = await google.verifica((cuerpo || {}).credencial, ahoraMs);
  if (!v.ok) {
    /* El motivo va al registro, NUNCA a la pantalla: decir cuál de las
       comprobaciones falló le enseña a quien ataca qué arreglar. */
    console.error('[cuentas] Google rechazado: ' + v.motivo);
    return v.reintentar
      ? no(503, 'No pudimos comprobarlo ahora mismo. Inténtalo en un momento.')
      : no(401, 'No pudimos comprobar tu cuenta de Google. Entra con tu correo y contraseña.');
  }

  const email = cuentas.normalizaCorreo(v.correo);
  if (!cuentas.correoValido(email)) {
    console.error('[cuentas] Google mandó un correo con mala forma');
    return no(401, 'No pudimos comprobar tu cuenta de Google. Entra con tu correo y contraseña.');
  }

  const hallados = await stripe.clientesPorCorreo(email);
  if (hallados.error) {
    console.error('[cuentas] no se pudo consultar a Stripe con Google: ' + hallados.error);
    return no(503, 'No pudimos entrar ahora mismo. Inténtalo en un momento.');
  }

  let cliente = eligeCliente(hallados.clientes);

  if (cliente) {
    /* Se escribe solo lo que falte: si ya estaba ligada y verificada, no se
       toca la ficha en cada entrada. */
    const m = cliente.metadata || {};
    const cambios = {};
    if (cuentas.googleDe(m) !== v.sub) Object.assign(cambios, cuentas.paraLigarGoogle(v.sub));
    if (!cuentas.estaVerificada(m)) Object.assign(cambios, cuentas.paraVerificar());

    if (Object.keys(cambios).length) {
      const escrito = await stripe.guardaEnCliente(cliente.id, cambios);
      if (escrito.error) {
        console.error('[cuentas] no se pudo ligar Google: ' + escrito.error);
        return no(503, 'No pudimos entrar ahora mismo. Inténtalo en un momento.');
      }
      cliente = Object.assign({}, cliente, { metadata: Object.assign({}, m, cambios) });
    }
  } else {
    /* Cuenta nueva, y nace VERIFICADA: el código de seis dígitos existe para
       comprobar que el buzón es suyo, y Google acaba de comprobarlo. Mandarle
       un código sería pedirle dos veces lo mismo. */
    const nueva = Object.assign(
      cuentas.paraLigarGoogle(v.sub),
      cuentas.paraVerificar(),
      cuentas.paraNacer(ahoraMs)
    );
    const creado = await stripe.creaCliente({ email: email, name: v.nombre, metadata: nueva });
    if (creado.error) {
      console.error('[cuentas] no se pudo crear el cliente con Google: ' + creado.error);
      return no(503, 'No pudimos entrar ahora mismo. Inténtalo en un momento.');
    }
    cliente = creado.cliente;
  }

  return {
    status: 200,
    cuerpo: ok({ nombre: String(cliente.name || v.nombre || '').trim(), correo: email }),
    sesionPara: cliente.id
  };
}

/* ============================================================
   LO QUE LA PANTALLA NECESITA SABER ANTES DE DIBUJARSE
   ------------------------------------------------------------
   Hoy solo el id de Google. Se pregunta en vez de escribirlo en
   el HTML para que el día que el dueño lo pegue en Vercel el
   botón aparezca solo, sin tocar código ni volver a desplegar.

   El id NO es secreto —va en la página, cualquiera lo ve—. Si no
   está configurado se devuelve vacío y la pantalla no enseña el
   botón: más vale no ofrecerlo que ofrecerlo roto.
   ============================================================ */
function config() {
  const id = google.idDeCliente();
  const cuerpo = { google: id };
  /* Si está apagado, se dice POR QUE: «sin-poner» o «mala-forma». No enseña
     el valor, y el id es público de todas formas. Sin esto, desde fuera no
     hay manera de distinguir «falta el redespliegue» de «se pegó mal», que
     son dos arreglos distintos. */
  if (!id) cuerpo.porque = google.porQueNoHayGoogle();
  return { status: 200, cuerpo: cuerpo };
}

/* ============================================================
   MIS VIAJES
   ------------------------------------------------------------
   No hay base de datos: los viajes SON las sesiones de cobro de
   Stripe, con el folio y los montos en su metadata —los mismos
   que el webhook usa para armar el contrato—.

   DE QUIEN SON LOS VIAJES QUE SE DEVUELVEN

   Del cliente que viene en la COOKIE FIRMADA, nunca de un campo
   del cuerpo. La cáscara ya lo saca del sello; aquí solo se
   recibe el id. Es toda la seguridad de esta puerta, así que vale
   la pena decirlo de frente: si algún día alguien le pasa a esta
   función un id que venga del navegador, cualquiera lee los
   viajes de cualquiera con solo cambiarlo.

   CADA VIAJE LLEVA SU LIGA, la misma firmada que le llegó por
   correo. Así el botón «Ver» reusa la pantalla que ya existe en
   vez de tener que hacer otra.

   Y NO SE ENSEÑA MAS DE LO QUE HACE FALTA: para la lista bastan
   folio, destino, fechas y saldo. El desglose completo vive en la
   pantalla del viaje, detrás de la liga.
   ============================================================ */
async function misViajes(idCliente) {
  if (!idCliente) return { status: 200, cuerpo: { dentro: false, viajes: [] } };

  const r = await stripe.sesionesDelCliente(idCliente);
  if (r.error) {
    console.error('[cuentas] no se pudieron traer los viajes: ' + r.error);
    return no(503, 'No pudimos traer tus viajes ahora mismo. Inténtalo en un momento.');
  }

  const ahora = Date.now();
  const viajes = [];
  (r.sesiones || []).forEach(function (s) {
    const m = s.metadata || {};
    /* Sin folio no es un viaje cerrado: es un cobro que quedó a medias, y
       enseñarlo confunde más de lo que ayuda. */
    const folio = String(m.folio || '').trim();
    if (!folio) return;

    const estado = stripe.estadoDePago(s);
    viajes.push({
      folio: folio,
      destino: String(m.destino || '').slice(0, 160),
      origen: String(m.origen || '').slice(0, 160),
      salida: String(m.salida || '').slice(0, 25),
      regreso: String(m.regreso || '').slice(0, 25),
      total: Number(m.total) || 0,
      saldo: Number(m.saldo) || 0,
      unidad: String(m.unidad || '').slice(0, 60),
      estado: estado,
      liga: acceso.hayClave() ? ligas.ligaDelViaje(sitio(), s.id, m.regreso, ahora) : ''
    });
  });

  /* El más nuevo primero: es el que la gente viene a ver. */
  viajes.sort(function (a, b) { return String(b.salida).localeCompare(String(a.salida)); });

  return { status: 200, cuerpo: { dentro: true, viajes: viajes } };
}

/* ============================================================
   CAMBIAR LA CONTRASEÑA
   ------------------------------------------------------------
   SE PIDE LA DE AHORITA aunque ya haya sesión abierta, y no es
   burocracia: una sesión robada —un teléfono prestado, una
   pestaña abierta en un café— podría cambiar la contraseña y
   dejar al dueño fuera de su propia cuenta para siempre. Con la
   actual de por medio, lo peor que hace quien se sienta en esa
   pestaña es mirar; no se apodera.

   Quien entró con Google y nunca puso contraseña puede ponerse
   una: ahí no hay ninguna que pedir.
   ============================================================ */
async function cambiarClave(cuerpo, idCliente) {
  if (!idCliente) return no(401, 'Entra a tu cuenta primero.');
  const c = cuerpo || {};

  const malaNueva = cuentas.porQueNoSirve(c.nueva);
  if (malaNueva) return no(422, malaNueva);

  const ficha = await stripe.traeCliente(idCliente);
  if (ficha.error) return no(503, 'No pudimos hacerlo ahora mismo. Inténtalo en un momento.');

  const cliente = ficha.cliente || {};
  const m = cliente.metadata || {};

  if (cuentas.tieneContrasena(m)) {
    const buena = await cuentas.contrasenaValida(m, c.actual);
    if (!buena) return no(401, 'Esa no es tu contraseña de ahorita.');
  }

  const escrito = await stripe.guardaEnCliente(idCliente, await cuentas.paraCambiar(c.nueva));
  if (escrito.error) {
    console.error('[cuentas] no se pudo cambiar la contraseña: ' + escrito.error);
    return no(503, 'No pudimos hacerlo ahora mismo. Inténtalo en un momento.');
  }

  return { status: 200, cuerpo: ok({ cambiada: true }) };
}

/* ============================================================
   OLVIDE MI CONTRASEÑA
   ------------------------------------------------------------
   El dueño lo pidió con las cuentas: «solo le mandarías correo si
   olvida su contraseña». Es el ÚNICO correo que recibe una cuenta
   ya confirmada.

   Y ES LA PUERTA MAS DELICADA DE TODAS. Por aquí se cambia la
   contraseña de alguien sin saber la que tenía: si se hace mal,
   es el camino para robarse una cuenta. Tres cosas la sostienen:

   1. EL CODIGO VA AL BUZON, NO A LA PANTALLA. Quien pide el
      cambio no ve nada; el código llega al correo del dueño. Sin
      acceso a ese buzón no hay nada que hacer.

   2. PEDIRLO NO DICE SI LA CUENTA EXISTE. Un correo registrado y
      uno inventado contestan EXACTAMENTE lo mismo. Si no, esto se
      vuelve un buscador de clientes de la empresa.

   3. EL CODIGO ES DE UN SOLO USO, vive diez minutos y aguanta
      cinco errores. Es el mismo mecanismo del alta, con las
      mismas reglas ya probadas.

   LO QUE ESTA PUERTA SI PERMITE, dicho de frente: quien sepa el
   correo de alguien puede hacerle llegar hasta doce correos en
   veinticuatro horas, y después dejarlo sin poder pedir otro
   hasta el día siguiente. Es la regla 4 del proyecto —un candado
   que el atacante le puede cerrar a otro— y aquí se acepta a
   sabiendas: sin tope, el ataque es llenarle el buzón, que es
   peor. Los códigos ya mandados siguen sirviendo, así que quien
   recibió uno de esos doce todavía puede usarlo.
   ============================================================ */
async function olvide(cuerpo, ahoraMs) {
  const email = cuentas.normalizaCorreo((cuerpo || {}).correo);

  /* La MISMA respuesta pase lo que pase, armada una sola vez para que no se
     pueda ir separando por descuido en cada rama. */
  const igualParaTodos = {
    status: 200,
    cuerpo: ok({ mandado: true, pista: acceso.pistaDeCorreo(email) })
  };

  if (!cuentas.correoValido(email)) return igualParaTodos;
  if (!acceso.hayClave()) {
    console.error('[cuentas] sin LIGAS_SECRETO: no se puede firmar el código');
    return igualParaTodos;
  }

  const hallados = await stripe.clientesPorCorreo(email);
  if (hallados.error) {
    console.error('[cuentas] no se pudo consultar a Stripe al recuperar: ' + hallados.error);
    return igualParaTodos;
  }

  const cliente = eligeCliente(hallados.clientes);
  /* Sin cuenta no hay nada que recuperar, y no se dice. */
  if (!cliente || !cuentas.tieneCuenta(cliente.metadata || {})) return igualParaTodos;

  const puede = cuentas.puedeMandarCodigo(cliente.metadata || {}, ahoraMs);
  if (!puede.ok) {
    /* Tampoco aquí se distingue: decir «espera 40 segundos» solo a los correos
       registrados sería contestar distinto y regalar la lista. Se calla y se
       apunta en el registro. */
    console.error('[cuentas] recuperación frenada (' + puede.motivo + ')');
    return igualParaTodos;
  }

  const codigo = acceso.nuevoCodigo();
  const guardar = Object.assign(
    acceso.paraGuardar(codigo, ahoraMs),
    cuentas.paraContarEnvio(cliente.metadata || {}, ahoraMs)
  );

  const escrito = await stripe.guardaEnCliente(cliente.id, guardar);
  if (escrito.error) {
    console.error('[cuentas] no se pudo guardar el código de recuperación: ' + escrito.error);
    return igualParaTodos;
  }

  const envio = await correo.mandaCodigoDeClave(email, codigo, cliente.name);
  if (!envio.ok) {
    /* El código quedó escrito pero no llegó: se borra, para que el cliente no
       se quede con una cuenta pidiendo un código que nunca vio. */
    await stripe.guardaEnCliente(cliente.id, acceso.paraBorrar());
    console.error('[cuentas] el código de recuperación NO salió: ' + envio.motivo);
  }

  return igualParaTodos;
}

/* ============================================================
   LA CONTRASEÑA NUEVA
   ------------------------------------------------------------
   Código + contraseña nueva. Al acertar se cambia la contraseña,
   se borra el código —de un solo uso— y se abre sesión: quien
   demostró que el buzón es suyo ya no tiene nada más que probar,
   y mandarlo a teclear la contraseña que acaba de inventar sería
   un paso de más.

   Y SE MARCA VERIFICADA. Si la cuenta estaba a medias, acabar
   aquí vale como confirmación: es el mismo buzón al que se le
   mandó el código de alta.
   ============================================================ */
async function claveNueva(cuerpo, ahoraMs) {
  const c = cuerpo || {};
  const email = cuentas.normalizaCorreo(c.correo);

  /* El mismo mensaje para todo lo que salga mal, por lo mismo de arriba: un
     correo sin cuenta y un código equivocado no se pueden distinguir. */
  const generico = 'Ese código no es. Revísalo o pide otro.';

  const mala = cuentas.porQueNoSirve(c.nueva);
  if (mala) return no(422, mala);
  if (!cuentas.correoValido(email)) return no(422, generico);

  const hallados = await stripe.clientesPorCorreo(email);
  if (hallados.error) return no(503, 'No pudimos hacerlo ahora mismo. Inténtalo en un momento.');

  const cliente = eligeCliente(hallados.clientes);
  if (!cliente || !cuentas.tieneCuenta(cliente.metadata || {})) return no(422, generico);

  const veredicto = acceso.revisaCodigo(cliente.metadata || {}, c.codigo, ahoraMs);
  if (!veredicto.ok) {
    if (veredicto.gastado) {
      const m = {};
      m[acceso.CAMPO_INTENTOS] = String(veredicto.van);
      await stripe.guardaEnCliente(cliente.id, m);
    }
    if (veredicto.agotado) return no(429, 'Se acabaron los intentos de ese código. Pide uno nuevo.');
    return no(422, generico);
  }

  const escrito = await stripe.guardaEnCliente(cliente.id, Object.assign(
    await cuentas.paraCambiar(c.nueva),
    cuentas.paraVerificar(),
    acceso.paraBorrar(),
    cuentas.paraBorrarEnvios()
  ));
  if (escrito.error) {
    console.error('[cuentas] no se pudo poner la contraseña nueva: ' + escrito.error);
    return no(503, 'No pudimos hacerlo ahora mismo. Inténtalo en un momento.');
  }

  return {
    status: 200,
    cuerpo: ok({ cambiada: true, nombre: String(cliente.name || '').trim(), correo: email }),
    sesionPara: cliente.id
  };
}

module.exports = {
  crear, reenviar, confirmar, entrar, salir, yo,
  conGoogle, config, misViajes, cambiarClave,
  olvide, claveNueva,
  eligeCliente, mandaCodigo
};
