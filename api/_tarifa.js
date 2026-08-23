/* ============================================================
   Las reglas del dinero, en un solo lugar
   ------------------------------------------------------------
   Lo usan /api/cotizar y /api/pagar. Que vivan aquí y no en cada
   endpoint es a propósito: si el precio que se cotiza y el que se
   cobra pudieran salir de dos archivos distintos, tarde o
   temprano se separan y le cobras a alguien algo distinto de lo
   que le prometiste.

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio.

   Reglas confirmadas por el dueño:
     · $35 por kilómetro, IVA YA INCLUIDO
     · mínimo $3,000 POR DÍA de servicio
     · el total se corta HACIA ABAJO a la centena
     · anticipo del 20% para apartar; el resto se abona
   ============================================================ */

const TARIFA_KM = 35;                 // pesos por kilómetro, IVA incluido
const MINIMO_POR_DIA = 3000;          // piso por día de servicio, IVA incluido
const REDONDEO = 100;                 // el total se corta a la centena de abajo
const TASA_IVA = 0.16;
const ANTICIPO = 0.20;                // 20% para apartar la unidad

/* Días de servicio, contados inclusive: salir el 20 y regresar el 22 son 3 días.
   Se compara solo la fecha en UTC para que no se cuele la zona horaria. */
function diasDeServicio(salida, regreso) {
  function aDia(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    if (p.length !== 3) return NaN;
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  const a = aDia(salida);
  if (!isFinite(a)) return 1;
  const b = aDia(regreso);
  if (!isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/* Del kilometraje y los días sale todo lo demás. */
function calcula(kmTotal, dias) {
  const porKilometro = kmTotal * TARIFA_KM;
  const minimo = dias * MINIMO_POR_DIA;
  const aplicoMinimo = minimo > porKilometro;
  const bruto = aplicoMinimo ? minimo : porKilometro;

  // Hacia abajo, siempre a favor del cliente. Nunca queda por debajo del
  // mínimo, porque el mínimo ya es múltiplo de cien.
  const total = Math.floor(bruto / REDONDEO) * REDONDEO;

  // El anticipo se redondea al peso y el saldo se saca por resta, para que
  // las dos partes sumen exactamente el total y no sobre ni falte un centavo.
  const anticipo = Math.round(total * ANTICIPO);
  const saldo = total - anticipo;

  const subtotal = Math.round((total / (1 + TASA_IVA)) * 100) / 100;

  /* OJO con lo que se devuelve.
     La tarifa por kilómetro NO puede llegar al navegador. Y no basta con no
     escribirla en pantalla: si se manda en la respuesta, cualquiera la ve
     abriendo las herramientas del navegador. Peor aún, con los kilómetros y
     el total juntos se saca dividiendo. Por eso aquí se separa en dos:
     `interno`, que se queda en el servidor, y el resto, que sí puede salir. */
  return {
    interno: {
      tarifaKm: TARIFA_KM,
      minimoPorDia: MINIMO_POR_DIA,
      porKilometro: Math.round(porKilometro),
      minimo: minimo,
      aplicoMinimo: aplicoMinimo,
      sinRedondear: Math.round(bruto),
      redondeo: REDONDEO
    },
    total: total,
    ivaIncluido: true,
    subtotal: subtotal,
    iva: Math.round((total - subtotal) * 100) / 100,
    porcentajeAnticipo: Math.round(ANTICIPO * 100),
    anticipo: anticipo,
    saldo: saldo
  };
}

module.exports = { TARIFA_KM, MINIMO_POR_DIA, REDONDEO, TASA_IVA, ANTICIPO, diasDeServicio, calcula };
