/* ============================================================
   Cuánto debe un viaje, contado desde Stripe
   ------------------------------------------------------------
   PASO 1 del spec de abonos en línea
   (`docs/superpowers/specs/2026-08-25-abonos-en-linea-design.md`).

   STRIPE ES LA ÚNICA VERDAD DEL DINERO, y por eso el saldo no se
   guarda en ningún lado: se cuenta cada vez, sumando lo cobrado.

       saldo = total − (anticipo + todos los abonos pagados)

   POR QUÉ NO SE GUARDA UNA COPIA

   Si la página llevara su propia cuenta de cuánto ha pagado
   alguien, habría **dos verdades sobre el mismo dinero**, y
   terminarían discrepando. Nada truena; nada más los números
   dejan de cuadrar, que es el peor defecto posible aquí: nadie se
   entera hasta que un cliente reclama.

   ------------------------------------------------------------
   LO QUE ESTE ARCHIVO NO HACE
   ------------------------------------------------------------
   No habla con Stripe. Recibe lo que Stripe ya contestó y hace la
   cuenta. Así se puede probar entero sin red y sin llaves — que es
   lo que pedía el spec para este paso: «no depende de nada
   externo y es la base».

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   EL MÍNIMO DE UN ABONO
   ------------------------------------------------------------
   Cien pesos. Por debajo, la comisión de Stripe se come el abono:
   cobrar $50 para que lleguen $37 no le sirve a nadie, y deja al
   cliente creyendo que abonó cincuenta.
   ------------------------------------------------------------ */
const MINIMO_ABONO = 100;

/* Lo que marca una sesión como abono, en la metadata. Vive aquí porque
   `_reversas.js` ya lo lee con el mismo nombre y tienen que decir lo
   mismo: si se separan, un abono revertido dejaría de reconocerse. */
const TIPO_ABONO = 'abono';

function aNumero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------
   ¿ESTA SESIÓN ES UN ABONO DE ESTE VIAJE?
   ------------------------------------------------------------
   Dos condiciones, y las dos hacen falta: que sea un abono —y no
   el anticipo que creó el contrato— y que sea de ESTE folio. Sin
   lo segundo, el cliente con dos viajes vería los abonos de uno
   descontados del otro.
   ------------------------------------------------------------ */
function esAbonoDe(sesion, folio) {
  const m = (sesion || {}).metadata || {};
  if (String(m.tipo || '') !== TIPO_ABONO) return false;
  const suyo = String(m.folio || '').trim();
  return !!suyo && suyo === String(folio || '').trim();
}

/* ------------------------------------------------------------
   LO QUE YA SE PAGÓ
   ------------------------------------------------------------
   Solo cuenta lo que Stripe da por PAGADO. Un voucher de OXXO
   generado y no pagado es una sesión que existe y un dinero que no
   entró: contarlo bajaría el saldo del cliente sin que nadie haya
   pagado nada.

   `estadoDePago` lo decide `_stripe.js` y se recibe ya aplicado,
   para no tener dos lecturas de lo mismo.
   ------------------------------------------------------------ */
function abonosPagados(sesiones, folio, estadoDe) {
  const lista = Array.isArray(sesiones) ? sesiones : [];
  const estado = typeof estadoDe === 'function' ? estadoDe : function () { return 'pagado'; };

  return lista
    .filter(function (s) { return esAbonoDe(s, folio); })
    .filter(function (s) { return estado(s) === 'pagado'; })
    .map(function (s) {
      const m = s.metadata || {};
      return {
        id: String(s.id || ''),
        monto: Math.max(0, Math.round(aNumero(m.monto || m.abono))),
        cuando: String(m.cobradoEn || '')
      };
    })
    .filter(function (a) { return a.monto > 0; });
}

/* ------------------------------------------------------------
   LA CUENTA
   ------------------------------------------------------------
   Devuelve `{ total, pagado, saldo, abonos }`. Nunca negativo y
   nunca por encima del total: un descuadre no puede convertirse en
   un saldo absurdo en la pantalla del cliente.

   Si algún día lo pagado se pasa del total —un abono duplicado, un
   total corregido a la baja— el saldo queda en cero y `descuadre`
   lo dice, para que se vea en el registro en vez de esconderse.
   ------------------------------------------------------------ */
function calcula(datos) {
  const d = datos || {};
  const total = Math.max(0, Math.round(aNumero(d.total)));
  const anticipo = Math.max(0, Math.round(aNumero(d.anticipo)));

  const abonos = abonosPagados(d.sesiones, d.folio, d.estadoDe);
  const sumaAbonos = abonos.reduce(function (a, b) { return a + b.monto; }, 0);

  const pagadoCrudo = anticipo + sumaAbonos;
  const pagado = Math.min(total, pagadoCrudo);

  return {
    total: total,
    pagado: pagado,
    saldo: Math.max(0, total - pagadoCrudo),
    abonos: abonos,
    /* Cuánto se pasó, si se pasó. Cero en el caso normal. */
    descuadre: Math.max(0, pagadoCrudo - total)
  };
}

/* ------------------------------------------------------------
   ¿SE PUEDE ABONAR ESTE MONTO?
   ------------------------------------------------------------
   Devuelve `{ ok: true, monto }` o `{ ok: false, aviso }`.

   ESTO CORRE EN EL SERVIDOR, contra el saldo de verdad, y no
   contra lo que mande el navegador. Es la misma disciplina de
   `/api/pagar`, que recalcula el precio en vez de creerle a la
   pantalla: quien puede escribir el monto puede escribir cualquier
   monto.
   ------------------------------------------------------------ */
function revisaAbono(monto, saldo) {
  const m = Math.round(aNumero(monto));
  const s = Math.max(0, Math.round(aNumero(saldo)));

  if (s <= 0) {
    return { ok: false, aviso: 'Este viaje ya está pagado completo.' };
  }
  if (!(m > 0)) {
    return { ok: false, aviso: '¿Cuánto quieres abonar?' };
  }
  if (m < MINIMO_ABONO) {
    /* El mínimo se dice con su razón: «no puedes» sin más se lee como
       un capricho nuestro. */
    return { ok: false, aviso: 'El abono más chico es de $' + MINIMO_ABONO +
      '. Por debajo, la comisión se lo come.' };
  }
  if (m > s) {
    return { ok: false, aviso: 'Tu saldo es de $' + s.toLocaleString('es-MX') +
      '. No puedes abonar de más.' };
  }
  return { ok: true, monto: m };
}

/* Lo que se le sugiere al cliente en la pantalla: el saldo completo y la
   mitad. La mitad se redondea a la centena para que no salga «$10,400.5»,
   y se cae si no llega al mínimo. */
function sugerencias(saldo) {
  const s = Math.max(0, Math.round(aNumero(saldo)));
  if (s < MINIMO_ABONO) return [];
  const mitad = Math.round(s / 2 / 100) * 100;
  const lista = [s];
  if (mitad >= MINIMO_ABONO && mitad < s) lista.unshift(mitad);
  return lista;
}

module.exports = {
  MINIMO_ABONO, TIPO_ABONO,
  esAbonoDe, abonosPagados, calcula, revisaAbono, sugerencias
};
