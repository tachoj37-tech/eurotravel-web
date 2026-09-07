/* ------------------------------------------------------------
   LO QUE EL DUEÑO CONTESTA A UN PRECIO POR CONFIRMAR
   ------------------------------------------------------------
   Regla del dueño (5-sep-2026): «de momento necesitarás mi
   confirmación para dar precios, disponibilidad y hacer contrato».
   El bot calcula el precio pero NO lo manda: le llega a él en un
   ticket, y lo que conteste decide qué recibe el cliente.

     · «va» (y sus parientes)  → el precio tal cual lo calculó el bot
     · un número               → ese precio, en vez del calculado
     · cualquier otra cosa     → sus palabras, literales, como siempre

   Sin red y sin estado: se prueba con texto en `probar-confirmacion`.
   ------------------------------------------------------------ */
'use strict';

const VA = /^(?:va|vá|ok|okey|okay|s[ií]|dale|adelante|m[aá]ndalo|mandaselo|m[aá]ndaselo|listo|sale|👍|✅)[.!]*$/i;

/* «48000», «48,000», «48.000», «48 000», «$48,000.00», «va 48000»,
   «48 mil», «48k», «48,000 pesos». El espacio como separador de miles y
   los centavos entraron el 7-sep-2026 (auditoría C7): antes llegaban
   literales al cliente. */
const PRECIO = /^(?:va[,.]?\s+)?\$?\s*(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d+)?)\s*(mil|k)?\s*(?:pesos|mxn|\$)?[.!]*$/i;
/* Un año a secas («2026») no es un precio de viaje. */
const PARECE_ANO = /^20(?:2[0-9]|3[0-5])$/;

/* Debajo de esto no es un precio de viaje: es un número suelto en una
   frase corta («2», «10»), y eso se le pasa al cliente literal. */
const PRECIO_MINIMO = 1000;

function interpreta(texto) {
  const t = String(texto || '').trim();
  if (!t) return { tipo: 'texto' };
  if (VA.test(t)) return { tipo: 'va' };

  const m = t.match(PRECIO);
  if (m) {
    let n = m[1];
    if (PARECE_ANO.test(n) && !m[2]) return { tipo: 'texto' };
    /* «48,000», «48.000» y «48 000» son miles (con o sin centavos);
       «48.5» con «mil» son 48,500. */
    if (/^\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?$/.test(n)) n = n.replace(/(?:[.,]\d{2})$/, '').replace(/[.,\s]/g, '');
    else n = n.replace(',', '.');
    let total = Number(n);
    if (m[2]) total = total * 1000;
    total = Math.round(total);
    if (Number.isFinite(total) && total >= PRECIO_MINIMO) {
      return { tipo: 'precio', total: total };
    }
  }
  return { tipo: 'texto' };
}

module.exports = { interpreta, PRECIO_MINIMO };
