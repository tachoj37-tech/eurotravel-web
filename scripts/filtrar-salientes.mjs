/* ============================================================
   ¿CUÁNTOS MENSAJES SALIENTES HABRÍA FRENADO EL FILTRO DE SALIDA?
   ============================================================
   Reparación del 8-sep-2026, Falla 4. Lee los últimos 500 mensajes del
   bot en el almacén (tabla `mensajes`, de = 'bot') y los pasa por el
   mismo filtro que corre en `manda`. Lo corre el dueño con sus llaves:

     ALMACEN_URL=https://xxxx.supabase.co ALMACEN_CLAVE=sb_secret_... \
       node scripts/filtrar-salientes.mjs

   No manda nada, no borra nada, no escribe nada: solo cuenta y muestra
   los que habría frenado (recortados a 120 caracteres).
   ============================================================ */
const FORMA_DE_CODIGO = /```|[{}<>]|\btool_(use|result)\b|\bfunction\b|\bsystem prompt\b|\bprompt\b|\binstrucciones del (agente|sistema)\b|\bException\b|\bundefined\b|\bnull\b|\bNaN\b|\/api\/|\.(m?js|json|ts)\b|\bError:|\bTypeError\b|\bReferenceError\b|\bstack\b/i;

const url = String(process.env.ALMACEN_URL || '').replace(/\/+$/, '');
const clave = process.env.ALMACEN_CLAVE;
if (!url || !clave) {
  console.error('Faltan ALMACEN_URL y ALMACEN_CLAVE en el entorno.');
  process.exit(2);
}
const r = await fetch(url + '/rest/v1/mensajes?de=eq.bot&select=numero,texto,cuando&order=cuando.desc&limit=500', {
  headers: { apikey: clave, Authorization: 'Bearer ' + clave }
});
if (!r.ok) { console.error('El almacén contestó ' + r.status + ': ' + (await r.text()).slice(0, 200)); process.exit(1); }
const filas = await r.json();
const frenados = filas.filter(function (f) {
  const t = String(f.texto || '');
  return FORMA_DE_CODIGO.test(t) || t.length > 1200;
});
console.log('Mensajes salientes revisados: ' + filas.length);
console.log('Habría frenado: ' + frenados.length);
frenados.slice(0, 50).forEach(function (f) {
  const m = String(f.texto).match(FORMA_DE_CODIGO);
  console.log('- ' + f.cuando + ' · …' + String(f.numero).slice(-4) + ' · ' + (m ? '«' + m[0] + '»' : 'largo') + ' · ' +
    String(f.texto).replace(/\n/g, '⏎').slice(0, 120));
});
