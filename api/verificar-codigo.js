/* ============================================================
   «Éste es mi código»
   ------------------------------------------------------------
   Si cuadra, se abre la sesión de ocho horas y se devuelve el
   viaje en la misma respuesta: el cliente teclea seis dígitos y
   ve su viaje, sin un paso de más.

   TRES CANDADOS, NO UNO

     · el código vence a los diez minutos
     · sirve UNA SOLA VEZ —al acertar se borra—
     · y aguanta cinco intentos

   El de un solo uso es el que más pesa: sin él, un código que se
   quedó en el historial del correo seguiría abriendo la puerta
   sus diez minutos completos, cuantas veces quisieran.
   ============================================================ */

const defensas = require('./_defensas');
const ligas = require('./_ligas');
const acceso = require('./_acceso');
const stripe = require('./_stripe');
const publico = require('./_publico');

/* Contra la fuerza bruta sobre el código: un millón de combinaciones suena a
   mucho, pero sin freno se prueban rápido. Se cuenta por IP de confianza —la
   que pone el borde de Vercel, no la que manda quien llama—. El freno que de
   verdad ataja está en el contador de intentos, que vive en Stripe y es el
   mismo para todas las máquinas. */
const freno = defensas.creaFreno({ porMinuto: 10, porDia: 120 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  const puerta = ligas.abre(cuerpo.t);
  if (!puerta.ok) {
    console.error('[verificar] liga rechazada: ' + puerta.motivo);
    res.status(puerta.vencida ? 410 : 404).json({
      error: puerta.vencida ? 'liga vencida' : 'no encontrado',
      vencida: !!puerta.vencida
    });
    return;
  }

  if (!stripe.hayClave() || !acceso.hayClave()) {
    res.status(503).json({ error: 'sin configurar', aviso: 'No pudimos verificarte ahora mismo.' });
    return;
  }

  const consulta = await stripe.traeSesion(puerta.sesion);
  if (consulta.error) {
    res.status(consulta.reintentar ? 503 : 404).json({ error: consulta.error });
    return;
  }
  const sesion = consulta.sesion;
  const idCliente = typeof sesion.customer === 'string' ? sesion.customer
                  : (sesion.customer && sesion.customer.id) || '';
  if (!idCliente) { res.status(409).json({ error: 'sin cliente' }); return; }

  const ficha = await stripe.traeCliente(idCliente);
  if (ficha.error) {
    res.status(503).json({ error: 'no se pudo consultar',
      aviso: 'No pudimos verificarte ahora mismo. Vuelve a intentar en un momento.' });
    return;
  }

  const veredicto = acceso.revisaCodigo((ficha.cliente || {}).metadata, cuerpo.codigo);

  if (!veredicto.ok) {
    /* Solo se sube el contador cuando el código EXISTIA y no cuadró. Si ya
       venció o nunca se pidió, subirlo dejaría a alguien fuera por algo que
       ni siquiera intentó. */
    if (veredicto.gastado) {
      const m = {};
      m[acceso.CAMPO_INTENTOS] = String(veredicto.van);
      await stripe.guardaEnCliente(idCliente, m);
    }
    /* Al agotar los intentos se BORRA el código: obliga a pedir uno nuevo, que
       llega al correo del dueño, y así el que estaba probando se queda sin nada. */
    if (veredicto.agotado) await stripe.guardaEnCliente(idCliente, acceso.paraBorrar());

    console.error('[verificar] ' + veredicto.motivo + ' (cliente ' + idCliente + ')');
    res.status(401).json({
      error: 'código incorrecto',
      /* Se le dice si tiene que pedir uno nuevo —eso le sirve y no le enseña
         nada a nadie— pero nunca cuántos intentos le quedan ni por qué falló. */
      pideOtro: !!(veredicto.agotado || veredicto.motivo === 'código vencido' ||
                   veredicto.motivo === 'no hay código pedido'),
      aviso: veredicto.agotado
        ? 'Demasiados intentos. Pide un código nuevo.'
        : (veredicto.motivo === 'código vencido' || veredicto.motivo === 'no hay código pedido')
          ? 'Ese código ya no sirve. Pide uno nuevo.'
          : 'Ese código no es correcto.'
    });
    return;
  }

  /* ---- cuadró: se quema el código y se abre la sesión ---- */
  await stripe.guardaEnCliente(idCliente, acceso.paraBorrar());

  const token = acceso.firmaSesion(idCliente);
  res.setHeader('Set-Cookie', acceso.cookieDeSesion(token));

  if (consulta.estado === 'sinPagar') {
    res.status(200).json({ estado: 'sinPagar',
      aviso: 'Este viaje todavía no tiene un pago registrado.' });
    return;
  }
  res.status(200).json(publico.viaje(sesion.metadata || {}, consulta.estado));
};
