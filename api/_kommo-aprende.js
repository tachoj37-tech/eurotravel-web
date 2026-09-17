/* ============================================================
   APRENDER LOS PRECIOS QUE EL VENDEDOR PONE EN KOMMO (16-sep-2026)
   ============================================================
   Dictado del dueño: «los precios futuros anótalos».

   Por Kommo no hay «va»: el bot manda el resumen y el vendedor escribe
   el precio en el chat, donde el bot no lo ve. Lo que sí se puede leer
   es la tarjeta del lead. Cuando el vendedor pone la «Venta» del lead
   (o el campo «Precio cotizado», si está configurado), el cron del
   seguimiento lo recoge aquí, lo cruza con la ficha del bot —que sabe
   a dónde iba, cuándo y en qué unidad— y lo guarda en el almacén como
   precio FIJADO por una persona, igual que un «número» del dueño por
   WhatsApp. De ahí sale «Antes lo diste a…» en el siguiente ticket y el
   cerebro de precios.

   Cuidados, todos a propósito:
   · Solo lectura en Kommo. Aquí no se escribe nada allá.
   · Solo leads con ficha del bot y con viaje: un lead ajeno al bot no
     tiene resumen y se ignora.
   · Sin repetir: el cron corre cada 15 minutos y ve el mismo lead
     varias veces; si ya hay un precio fijado con ese mismo total para
     ese mismo viaje, no se guarda otra vez. Cambiar el precio en el
     lead sí lo vuelve a anotar (es una corrección).
   · Nunca frena al seguimiento: cualquier falla se cuenta y se
     registra, y el cron sigue.
   ============================================================ */
'use strict';

const VENTANA_MS = 24 * 60 * 60 * 1000;

async function aprendeDeKommo(dep, opciones) {
  const kommo = dep.kommo, almacen = dep.almacen, aprendidos = dep.aprendidos;
  const o = opciones || {};
  const cuenta = { leads: 0, sinTelefono: 0, sinFicha: 0, sinViaje: 0, repetidos: 0, anotados: 0, fallas: 0 };
  if (!kommo.hayKommo() || !almacen.hayAlmacen()) return cuenta;
  const llamada = o.pide ? { pide: o.pide } : {};
  const desde = Math.floor(((o.ahora || Date.now()) - (o.ventanaMs || VENTANA_MS)) / 1000);

  let leads = [];
  try { leads = await kommo.leadsConVentaReciente(desde, llamada); }
  catch (e) { console.error('[kommo-aprende] no se pudieron leer los leads: ' + (e && e.message)); return cuenta; }

  for (const l of leads) {
    cuenta.leads++;
    try {
      const numero = await kommo.telefonoDelContacto(l.contactoId, llamada);
      if (!numero) { cuenta.sinTelefono++; continue; }
      const ficha = await almacen.leeFicha(numero);
      if (!ficha) { cuenta.sinFicha++; continue; }
      const resumen = (ficha.porConfirmar && ficha.porConfirmar.resumen) || ficha.viajeDatos || null;
      if (!resumen || !resumen.destino) { cuenta.sinViaje++; continue; }
      const unidad = resumen.unidadNombre || resumen.unidad || 'sprinter';
      const clave = aprendidos.claveDe(resumen, unidad);
      const parecidos = await almacen.preciosParecidos(clave, 10);
      const yaEsta = (parecidos || []).some(function (p) {
        return p && p.fijado && Math.round(Number(p.total)) === l.total;
      });
      if (yaEsta) { cuenta.repetidos++; continue; }
      const calculado = (ficha.porConfirmar && typeof ficha.porConfirmar.total === 'number')
        ? ficha.porConfirmar.total : null;
      const guardado = await almacen.guardaPrecio(aprendidos.renglonDe(resumen, unidad,
        { total: l.total, anticipo: 0 },
        { fijado: true, cliente: numero, calculado: calculado }));
      if (guardado) {
        cuenta.anotados++;
        console.log('[kommo-aprende] lead ' + l.id + ' · ' + clave + ' · $' + l.total +
          (calculado !== null ? ' (el motor decía $' + calculado + ')' : ''));
      } else {
        cuenta.fallas++;
        console.error('[precio-perdido] kommo-aprende · lead ' + l.id + ' · ' + clave + ' · $' + l.total);
      }
    } catch (e) {
      cuenta.fallas++;
      console.error('[kommo-aprende] falló el lead ' + (l && l.id) + ': ' + (e && e.message));
    }
  }
  return cuenta;
}

module.exports = { aprendeDeKommo, VENTANA_MS };
