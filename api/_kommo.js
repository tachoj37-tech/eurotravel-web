/* ============================================================
   KOMMO · LA PUERTA AL CRM (12-sep-2026)
   ============================================================
   El bot va a mudarse de Dualhook a Kommo. Esto es lo que sabe hablar
   con su API: mover un lead de etapa, guardarle el precio, y leer lo que
   los vendedores han cotizado.

   ------------------------------------------------------------
   APAGADO MIENTRAS NO HAYA LLAVES
   ------------------------------------------------------------
   Igual que `_almacen.js`: sin `KOMMO_SUBDOMINIO` y `KOMMO_TOKEN` esto
   no intenta nada y `hayKommo()` contesta que no. Así el archivo puede
   vivir en producción desde hoy sin tocar el bot que está atendiendo
   clientes por Dualhook.

   ------------------------------------------------------------
   NO ESTÁ COMPROBADO CONTRA UNA CUENTA DE VERDAD
   ------------------------------------------------------------
   Los caminos salen de la documentación de Kommo, no de haberlos visto
   funcionar: el dueño todavía no da de alta la integración. Está escrito
   para que se note —cada función dice de dónde salió su forma— y la
   batería lo prueba con una puerta de mentiras.

   El día que haya token, lo primero es `pruebaDeVida()`: una lectura
   inofensiva que dice si la cuenta contesta y si el token sirve. Antes
   de eso, nada de escribir.

   ------------------------------------------------------------
   POR QUÉ NO ES UN ARCHIVO DE `api/` A SECAS
   ------------------------------------------------------------
   El plan Hobby de Vercel publica DOCE funciones y hoy hay doce. Un
   `api/kommo.js` sería la trece y el despliegue entero dejaría de subir.
   Los archivos que empiezan con guion bajo son módulos internos y no
   cuentan: lo vigila `pruebas/probar-despliegue.cjs`.
   ============================================================ */
'use strict';

/* Tope de tiempo: un CRM colgado no puede colgar al bot. Misma regla que
   el almacén, y por la misma razón — Meta y Kommo reintentan. */
const ESPERA_MS = 8000;

function config() {
  const sub = String(process.env.KOMMO_SUBDOMINIO || '').trim()
    .replace(/^https?:\/\//, '').replace(/\.kommo\.com.*$/, '').replace(/\/+$/, '');
  const token = String(process.env.KOMMO_TOKEN || '').trim();
  if (!sub || !token) return null;
  return { base: 'https://' + sub + '.kommo.com/api/v4', token: token };
}

function hayKommo() { return !!config(); }

/* ------------------------------------------------------------
   UNA SOLA PUERTA PARA TODAS LAS LLAMADAS
   ------------------------------------------------------------
   Devuelve el JSON, o `null` si algo salió mal — y ESCRIBE POR QUÉ. La
   lección del almacén, que se pagó con meses de precios perdidos: un
   fallo que no deja rastro es un fallo que nadie arregla.
   ------------------------------------------------------------ */
async function pide(camino, opciones) {
  const c = config();
  if (!c) return null;
  const o = opciones || {};
  const traer = o.pide || (typeof fetch === 'function' ? fetch : null);
  if (!traer) return null;
  try {
    const r = await traer(c.base + camino, {
      method: o.metodo || 'GET',
      signal: AbortSignal.timeout(ESPERA_MS),
      headers: {
        'Authorization': 'Bearer ' + c.token,
        'Content-Type': 'application/json'
      },
      body: o.cuerpo ? JSON.stringify(o.cuerpo) : undefined
    });
    if (!r || !r.ok) {
      const detalle = r && r.text ? await r.text().catch(function () { return ''; }) : '';
      console.error('[kommo] ' + (r && r.status) + ' en ' + camino +
        (detalle ? ': ' + String(detalle).replace(/\s+/g, ' ').slice(0, 300) : ''));
      return null;
    }
    if (o.sinRespuesta) return true;
    return await r.json();
  } catch (e) {
    console.error('[kommo] no se pudo ' + camino + ': ' + (e && e.message));
    return null;
  }
}

/* ------------------------------------------------------------
   ¿CONTESTA LA CUENTA? — lo primero que se corre con el token
   ------------------------------------------------------------
   `GET /account` es la lectura más barata e inofensiva que hay: no
   cambia nada y dice si el token sirve. Antes de escribir un solo lead,
   esto tiene que contestar.
   ------------------------------------------------------------ */
async function pruebaDeVida(opciones) {
  const r = await pide('/account', opciones);
  if (!r) return { vive: false, porQue: 'no contestó o el token no sirve' };
  return { vive: true, cuenta: r.name || r.subdomain || null, id: r.id || null };
}

/* ------------------------------------------------------------
   MOVER UN LEAD DE ETAPA, Y GUARDARLE EL PRECIO
   ------------------------------------------------------------
   `PATCH /api/v4/leads/{id}` con `status_id` y `custom_fields_values`
   (documentación de Kommo, verificada el 12-sep-2026).

   El `status_id` es un NÚMERO que Kommo asigna a cada etapa del embudo,
   no el nombre. Por eso `etapas` entra como un mapa de nombre a número:
   los nombres los puso el dueño —`escribio`, `cotizando`, `con_precio`…—
   y los números salen de su cuenta. Sin ese mapa no se mueve nada, y es
   correcto que así sea: adivinar un id de etapa es mover leads a donde
   no van.
   ------------------------------------------------------------ */
function mapaDeEtapas() {
  const crudo = String(process.env.KOMMO_ETAPAS || '').trim();
  if (!crudo) return null;
  try {
    const m = JSON.parse(crudo);
    return (m && typeof m === 'object') ? m : null;
  } catch (e) {
    console.error('[kommo] KOMMO_ETAPAS no es un JSON válido; no se moverán etapas');
    return null;
  }
}

async function mueveDeEtapa(idDelLead, etapa, opciones) {
  if (!idDelLead || !etapa) return false;
  const mapa = mapaDeEtapas();
  const status = mapa && mapa[etapa];
  if (!status) {
    console.error('[kommo] no hay id para la etapa «' + etapa + '»: no se mueve');
    return false;
  }
  const r = await pide('/leads/' + encodeURIComponent(idDelLead),
    Object.assign({ metodo: 'PATCH', cuerpo: { status_id: Number(status) } }, opciones || {}));
  return !!r;
}

/* El precio que dictó el vendedor, al campo del lead. `KOMMO_CAMPO_PRECIO`
   es el id numérico del campo «Precio cotizado» —Kommo los identifica por
   número, no por nombre—. Sin ese id no se escribe nada: un id equivocado
   escribiría el precio en otro campo. */
async function guardaPrecio(idDelLead, total, opciones) {
  const campo = Number(String(process.env.KOMMO_CAMPO_PRECIO || '').trim());
  if (!idDelLead || !(total > 0)) return false;
  if (!campo) {
    console.error('[kommo] falta KOMMO_CAMPO_PRECIO: el precio no se guarda en el lead');
    return false;
  }
  const r = await pide('/leads/' + encodeURIComponent(idDelLead), Object.assign({
    metodo: 'PATCH',
    cuerpo: {
      custom_fields_values: [
        { field_id: campo, values: [{ value: Number(total) }] }
      ]
    }
  }, opciones || {}));
  if (!r) console.error('[precio-perdido] kommo · lead ' + idDelLead + ' · ' + total);
  return !!r;
}

/* ------------------------------------------------------------
   LOS PRECIOS QUE YA SE COTIZARON, PARA EL CEREBRO
   ------------------------------------------------------------
   Lo que hace que Kommo resuelva el agujero de la memoria: los leads con
   precio se leen de vuelta y de ahí sale `precios-que-he-dado.md`.

   Se pide por páginas porque Kommo las devuelve así, y con un tope: una
   cuenta con miles de leads no se trae entera sin querer.
   ------------------------------------------------------------ */
async function leadsConPrecio(opciones) {
  const o = opciones || {};
  const campo = Number(String(process.env.KOMMO_CAMPO_PRECIO || '').trim());
  if (!campo) return [];
  const porPagina = Math.min(Number(o.porPagina) || 250, 250);
  const topePaginas = Math.min(Number(o.topePaginas) || 4, 20);
  const salida = [];
  for (let pagina = 1; pagina <= topePaginas; pagina++) {
    const r = await pide('/leads?limit=' + porPagina + '&page=' + pagina +
      '&with=contacts', o);
    const lista = r && r._embedded && Array.isArray(r._embedded.leads) ? r._embedded.leads : [];
    if (!lista.length) break;
    for (const l of lista) {
      const campos = Array.isArray(l.custom_fields_values) ? l.custom_fields_values : [];
      const suyo = campos.find(function (c) { return Number(c.field_id) === campo; });
      const valor = suyo && Array.isArray(suyo.values) && suyo.values[0] ? suyo.values[0].value : null;
      if (valor) salida.push({ id: l.id, nombre: l.name || null, total: Number(valor) || null,
        cuando: l.updated_at ? new Date(l.updated_at * 1000).toISOString() : null });
    }
    if (lista.length < porPagina) break;
  }
  return salida;
}

module.exports = {
  hayKommo, pruebaDeVida, mueveDeEtapa, guardaPrecio, leadsConPrecio,
  /* Para las pruebas y para el día del alta. */
  config, mapaDeEtapas, pide
};
