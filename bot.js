/* ============================================================
   Qué contesta el bot de WhatsApp
   ------------------------------------------------------------
   Aquí NO hay red, ni Meta, ni claves: solo texto que entra y
   texto que sale. Por eso se puede probar entero sin conectar
   nada, y por eso vive aparte de `whatsapp.js`.

   TRES REGLAS QUE NO SE ROMPEN

   1. NO INVENTA PRECIOS. Nunca. Los precios los dicta el dueño
      (R12 del criterio). Si el cliente pide precio, el bot manda
      la liga del cotizador o pasa la conversación a una persona,
      pero jamás dice una cifra que no salió del motor de cobro.

   2. NO INVENTA DATOS. Todo lo que dice de las unidades sale de
      `unidades.js`, que el propio archivo declara FUENTE ÚNICA.
      Si algo no está ahí, el bot no lo sabe y lo dice.

   3. NO USA IA. Es puro texto contra palabras clave. Cuesta cero
      por mensaje y contesta igual de rápido de noche que de día.
      Cuando no entiende, no adivina: pasa con una persona.
      Adivinar mal el precio de un viaje cuesta más que no
      contestar.
   ============================================================ */

/* ------------------------------------------------------------
   Las unidades salen del catálogo del sitio, no de una copia.
   `unidades.js` es un archivo de navegador: hace
   `window.UNIDADES = [...]`. En el servidor no hay `window`, así
   que se le presta uno antes de pedirlo. Es la misma maña que ya
   usan las pruebas del proyecto.

   Se hace así, y no copiando la lista aquí, porque una copia se
   desactualiza en silencio: el dueño daría de alta una unidad y
   el bot seguiría ofreciendo la flota vieja.
   ------------------------------------------------------------ */
global.window = global.window || {};
require('./unidades');
const UNIDADES = global.window.UNIDADES || [];

/* Y las fotos, por la misma razón y con la misma maña. En el
   navegador `medios-unidades.js` ya se cargó antes que este
   archivo; aquí se pide para que el webhook también las tenga.

   El `try` es a propósito: si algún día ese archivo no está, el
   bot debe seguir cotizando. Quedarse sin fotos molesta; quedarse
   sin bot, no. */
try { require('./medios-unidades'); } catch (e) { /* sin fotos, pero vivo */ }

const TELEFONO = '33 2400 2285';

/* ------------------------------------------------------------
   EL NOMBRE DEL VENDEDOR
   ------------------------------------------------------------
   El bot no tiene nombre propio. Dictado del dueño el 2-sep-2026:
   *«sin nombre, que use el nombre del vendedor que lo use»*.

   Sale de la configuración —`VENDEDOR` en Vercel, o
   `window.VENDEDOR` en el navegador— porque el mismo `bot.js`
   corre en los dos lados.

   SI NO ESTÁ CONFIGURADO NO SE INVENTA UNO. Se saluda sin nombre
   y ya. Presentarse como «Ricardo» cuando no hay ningún Ricardo
   es la clase de mentira chiquita que después hay que sostener.
   ------------------------------------------------------------ */
const VENDEDOR = String(
  (typeof process !== 'undefined' && process.env && process.env.VENDEDOR) ||
  (typeof window !== 'undefined' && window.VENDEDOR) || ''
).trim().slice(0, 40);
const SITIO = process.env.SITIO_URL || 'https://eurotravel-web.vercel.app';

/* Quita acentos y baja a minúsculas, para que «cuántos» y «cuantos»
   sean la misma palabra. Sin esto, media conversación se pierde por
   un acento. */
function normaliza(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    /* Los acentos van con escape, no con el caracter suelto: son
       invisibles en el editor y cualquier copiar-pegar los borra sin
       que se note. U+0300 a U+036F son las tildes que `NFD` separo. */
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/* ============================================================
   ESCRIBIR MAL NO PUEDE COSTAR UNA VENTA
   ------------------------------------------------------------
   La gente escribe desde el celular, con prisa y con el pulgar:
   «kiero uan spter», «cuanto kuesta», «vallarrta». Un bot que
   solo entiende lo bien escrito pierde clientes de verdad.

   Esto NO usa IA. Son tres pasos baratos, en orden de qué tan
   seguido aciertan:

   1. FONÉTICA. La mayoría de las faltas del español no cambian
      cómo suena la palabra: b/v, s/z/c, y/ll, la h muda, qu/k,
      g/j. Si dos palabras suenan igual, son la misma. Esto solo
      caza «kiero», «boy», «aser», «sierto», «llendo».

   2. ABREVIATURA. Escribir «spter» por «sprinter» no es una
      falta, es teclear rápido: se comieron letras pero las que
      quedaron van en orden. Si lo tecleado es subcadena en orden
      de la palabra buena, es esa.

   3. DISTANCIA. Para lo demás —una letra de más, una de menos,
      dos cambiadas de lugar— se cuenta cuántos cambios hacen
      falta. El tope sube con el largo de la palabra: en una de
      cuatro letras un cambio ya es otra palabra, en una de diez
      no.

   Las palabras cortas se comparan EXACTAS. «no» y «lo» están a
   un cambio, y confundirlas cambiaría el sentido de la frase.
   ============================================================ */

/* Cómo suena la palabra, a lo bruto. No es un algoritmo formal
   —no hace falta— sino las confusiones que de verdad se ven. */
function fonetica(p) {
  return String(p)
    .replace(/h/g, '')                       // la h no suena: ola = hola
    .replace(/qu|ck|k/g, 'k')                // kiero = quiero
    .replace(/c([eiéí])/g, 's$1')            // sierto = cierto
    .replace(/c/g, 'k')                      // kasa = casa
    .replace(/z/g, 's')                      // ves = vez
    .replace(/v/g, 'b')                      // boy = voy
    .replace(/ll/g, 'y')                     // lla = ya
    .replace(/g([eiéí])/g, 'j$1')            // jente = gente
    .replace(/x/g, 's')
    .replace(/(.)\1+/g, '$1');               // vallarrta = vallarta
}

/* ¿Lo tecleado son las letras de la palabra buena, en orden y sin
   inventar ninguna? Así se cazan las abreviaturas del pulgar. */
function esAbreviatura(corta, larga) {
  if (corta.length < 4 || corta.length >= larga.length) return false;
  if (corta.length / larga.length < 0.5) return false;
  if (corta[0] !== larga[0]) return false;   // la primera letra sí se respeta
  let j = 0;
  for (let i = 0; i < larga.length && j < corta.length; i++) {
    if (larga[i] === corta[j]) j++;
  }
  return j === corta.length;
}

/* Cuántos cambios hay de una palabra a la otra. Cuenta el cambio de
   lugar de dos letras contiguas como UNO —«uan» por «una»— porque es
   de las faltas más comunes al teclear rápido. */
function distancia(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;        // ni vale la pena medir
  const d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function tope(largo) {
  if (largo <= 4) return 0;                  // corta: exacta o nada
  if (largo <= 7) return 1;
  return 2;
}

/* ------------------------------------------------------------
   LAS QUE SE COMPARAN EXACTAS, PASE LO QUE PASE
   ------------------------------------------------------------
   Hay palabras cuyo vecino a un cambio de distancia significa otra
   cosa. Tolerarles la falta no ayuda: se equivoca.

   El caso que lo destapó: «somos 15 personaz» acababa en «te paso
   con una persona» —porque «personaz» está a un cambio de
   «persona»— en vez de recomendar unidad. Es la MISMA confusión
   que ya se había arreglado con los límites de palabra, y la
   tolerancia a faltas la revivió.

   Quien quiere una persona lo dice de otro modo: «hablar con»,
   «con alguien», «asesor». Esas siguen tolerando faltas.
   ------------------------------------------------------------ */
const EXACTAS = ['persona', 'no', 'si', 'dia', 'dias'];

/* ¿Lo que escribió es esta palabra, aunque la haya escrito mal? */
function esLaPalabra(dicho, buena) {
  if (dicho === buena) return true;
  if (EXACTAS.indexOf(buena) !== -1) return false;
  const fd = fonetica(dicho), fb = fonetica(buena);
  if (fd === fb) return true;                // suena igual
  if (esAbreviatura(dicho, buena) || esAbreviatura(fd, fb)) return true;
  const t = tope(buena.length);
  if (t === 0) return false;
  return distancia(fd, fb) <= t;
}

/* Parte la frase en palabras, para poder comparar una por una. */
function palabrasDe(t) {
  return String(t).split(/[^a-z0-9ñ]+/).filter(function (p) { return p.length > 0; });
}

/* ------------------------------------------------------------
   PALABRA COMPLETA, NO PEDAZO
   ------------------------------------------------------------
   Esto empezó buscando con `indexOf`, y estaba mal de tres formas
   que las pruebas cazaron de golpe:

     «somos 45 PERSONAS»        -> casaba con «persona» y en vez de
                                   recomendar unidad, pasaba con
                                   alguien sin contestar nada
     «CUÁNTOS caben»            -> casaba con «cuanto» y lo trataba
                                   como pregunta de precio
     «BUSCO un camión»          -> casaba con «bus»

   Con `\b` a los lados, «persona» ya no casa dentro de «personas»
   porque después viene una letra.

   Aquí `\b` SÍ es de fiar, y en otras partes de este proyecto no:
   `\b` no reconoce las acentuadas, pero `normaliza` ya les quitó
   el acento antes de llegar, así que a esta altura todo es ASCII.
   ------------------------------------------------------------ */
function tiene(t, palabras) {
  /* Primero exacto: es lo que acierta casi siempre y no cuesta nada. */
  for (let i = 0; i < palabras.length; i++) {
    if (new RegExp('\\b' + palabras[i] + '\\b').test(t)) return true;
  }
  /* Y si no, mal escrito. Solo se compara contra palabras sueltas y
     literales: las que traen espacio son frases —«hablar con»— y las
     que traen `\w*` son comodines; a esas no se les puede medir la
     distancia sin inventar coincidencias. */
  const sueltas = palabras.filter(function (p) { return /^[a-zñ]+$/.test(p); });
  if (!sueltas.length) return false;
  const dichas = palabrasDe(t);
  for (let i = 0; i < dichas.length; i++) {
    for (let j = 0; j < sueltas.length; j++) {
      if (esLaPalabra(dichas[i], sueltas[j])) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------
   FECHAS
   ------------------------------------------------------------
   El cliente escribe la fecha como se le da la gana, igual que en
   el papel: «10 de septiembre», «10/9», «mañana», «el 15».

   Todo viaja como texto `aaaa-mm-dd` y NUNCA se arma un `Date` a
   partir de pedazos: `new Date('2026-09-10')` es medianoche UTC,
   o sea las 18:00 del día ANTERIOR aquí. Ese defecto no se ve en
   la computadora de la oficina, solo en el servidor — y aquí
   correría en los dos lados.

   En formato ISO el orden alfabético ES el cronológico, así que
   comparar cadenas basta y no hay zona horaria que se cuele.
   ------------------------------------------------------------ */
const MESES = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12
};

function dosDigitos(n) { return (n < 10 ? '0' : '') + n; }

/* El día de hoy en `aaaa-mm-dd`, con la hora LOCAL. Se usan las
   partes locales del reloj, no `toISOString`, que convierte a UTC y
   después de las 6 de la tarde daría mañana. */
function hoyISO(reloj) {
  const d = reloj || new Date();
  return d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate());
}

/* Suma días a una fecha ISO sin construir un Date con texto. */
function masDias(iso, n) {
  const p = iso.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + n);
  return hoyISO(d);
}

function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

/* Devuelve `aaaa-mm-dd` o null. `hoy` entra como parámetro —y no se
   pregunta al reloj aquí dentro— para que las pruebas puedan fijar
   el día y no cambien de resultado en año nuevo. */
function fechaDe(texto, hoy) {
  const t = normaliza(texto);
  const base = hoy || hoyISO();

  if (/\bhoy\b/.test(t)) return base;
  if (/\bmanana\b/.test(t)) return masDias(base, 1);
  if (/\bpasado manana\b/.test(t)) return masDias(base, 2);

  const anioHoy = Number(base.slice(0, 4));

  /* «10 de septiembre», «10 septiembre», «10 de sep del 2027», y
     también «4 sep», «10 setiembre», «10 de septienbre». */
  let m = t.match(/(\d{1,2})\s*(?:de\s*)?([a-z]+)(?:\s*(?:de(?:l)?\s*)?(\d{4}))?/);
  if (m) {
    let mes = MESES[m[2]];
    if (!mes) {
      /* Mal escrito. Se compara contra los nombres largos nada más:
         medirle la distancia a «ene» o «may» confundiría meses entre
         sí, y equivocar el mes de un viaje no es un detalle. */
      const nombres = Object.keys(MESES).filter(function (k) { return k.length > 4; });
      for (let i = 0; i < nombres.length && !mes; i++) {
        if (esLaPalabra(m[2], nombres[i])) mes = MESES[nombres[i]];
      }
    }
    if (mes) return armaFecha(Number(m[3]) || null, mes, Number(m[1]), base);
  }

  /* «10/9», «10-09-2026», «10.9.26» */
  m = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (m) {
    let a = m[3] ? Number(m[3]) : null;
    if (a !== null && a < 100) a += 2000;
    return armaFecha(a, Number(m[2]), Number(m[1]), base);
  }

  /* ------------------------------------------------------------
     «el 15» · el 15 más cercano que no haya pasado
     ------------------------------------------------------------
     Dos formas, y las dos hacen falta:

     · El mensaje entero es el número —«14», «el 14»—, que es como
       contesta quien ya vio la pregunta.
     · El número va dentro de la frase, PERO precedido de «el» o
       «día»: «regresamos el 14», «el sábado 14».

     El «el» no es adorno, es el candado. Sin él, «somos 12» se
     leería como el día 12 y el viaje saldría con la fecha de otro
     mes. Por eso NO se acepta un número suelto en medio de una
     frase: el que va solo es fecha porque no puede ser otra cosa;
     el que va acompañado solo lo es si alguien lo señaló.

     Costó una conversación entera: «regresamos el 14» caía en «esa
     fecha no la entendí» y el cliente se quedaba dando vueltas ahí
     mismo hasta que se aburría.
     ------------------------------------------------------------ */
  const DIAS_SEMANA = 'lunes|martes|miercoles|jueves|viernes|sabado|domingo';
  m = t.match(/^(?:el\s*)?(\d{1,2})$/) ||
    t.match(new RegExp('\\b(?:el|dia)\\s+(?:' + DIAS_SEMANA + ')?\\s*(\\d{1,2})\\b'));
  if (m) {
    const dia = Number(m[1]);
    const mesHoy = Number(base.slice(5, 7));
    const diaHoy = Number(base.slice(8, 10));
    let mes = mesHoy, anio = anioHoy;
    if (dia < diaHoy) { mes += 1; if (mes > 12) { mes = 1; anio += 1; } }
    return armaFecha(anio, mes, dia, base);
  }

  return null;
}

function armaFecha(anio, mes, dia, base) {
  if (!(mes >= 1 && mes <= 12)) return null;
  const anioHoy = Number(base.slice(0, 4));
  let a = anio || anioHoy;
  if (!(dia >= 1 && dia <= diasDelMes(a, mes))) return null;
  let iso = a + '-' + dosDigitos(mes) + '-' + dosDigitos(dia);
  /* Sin año escrito, una fecha ya pasada se entiende del año que viene:
     nadie cotiza un viaje para atrás. Con año escrito se respeta. */
  if (!anio && iso < base) {
    a += 1;
    if (dia > diasDelMes(a, mes)) return null;      // 29 de febrero
    iso = a + '-' + dosDigitos(mes) + '-' + dosDigitos(dia);
  }
  return iso;
}

/* Para enseñarla como la diría una persona. */
const NOMBRE_MES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaEnPalabras(iso) {
  return Number(iso.slice(8, 10)) + ' de ' + NOMBRE_MES[Number(iso.slice(5, 7))] +
    ' de ' + iso.slice(0, 4);
}

/* ------------------------------------------------------------
   «Somos 30» · «para 45 personas» · «45 pax»
   ------------------------------------------------------------
   Se busca un número que venga acompañado de algo que hable de
   gente. Un número suelto NO cuenta: «salimos el 15» es una
   fecha, no quince pasajeros, y recomendarle una Sprinter a un
   grupo de cincuenta por confundir eso es perder la venta.
   ------------------------------------------------------------ */
function cuantaGente(t) {
  /* Los botones que ofrece el propio bot. Si no se leyeran aquí, el bot
     se atoraría con su propia opción — que fue lo que pasó al probarlo.

     «Más de 20» NO se lee aquí a propósito: no es un número, es la
     ausencia de uno. Antes se traducía a 21 y el bot contestaba «andan
     por poquito arriba», que a un grupo de 60 le suena absurdo y a
     nadie le sirve. Se detecta aparte, en `masDeQue`, para PREGUNTAR
     cuántos son. */
  if (/entre \d{1,3} y (\d{1,3})/.test(t)) return Number(t.match(/entre \d{1,3} y (\d{1,3})/)[1]);
  if (/(\d{1,3}) o menos/.test(t)) return Number(t.match(/(\d{1,3}) o menos/)[1]);

  /* `somos` NO va en esta lista, y por eso: aquí las palabras van DESPUÉS
     del número —«16 personas»—, y «somos» va antes —«somos 16»—, que es
     lo que atrapa `alReves`. Teniéndolo aquí, la frase

         «una sprinter a chapala el 20 somos 12»

     leía «20 somos» y decía que iban 20, cuando van 12 y el 20 es el día.
     Lo destapó el lector de frases de un jalón (2-sep-2026). */
  const pistas = /(\d{1,3})\s*(personas|pasajeros|pax|gente|alumnos|ninos|adultos|alumnas)/;
  const alReves = /(somos|para|seriamos|van|vamos|iriamos|serian)\s*(?:como\s*)?(\d{1,3})/;
  let m = t.match(pistas);
  if (m) return parseInt(m[1], 10);
  m = t.match(alReves);
  if (m) return parseInt(m[2], 10);
  return null;
}

/* La unidad más chica en la que cabe el grupo. Se ordena por
   capacidad para no depender del orden del catálogo. */
/* «somos más de 20», «como unos 40 o más», «bastantes». Dice que son
   MUCHOS, no cuántos. Devuelve el piso que mencionó, o 0 si ni eso. */
function masDeQue(t) {
  const m = t.match(/mas de (\d{1,3})|arriba de (\d{1,3})|(\d{1,3}) o mas/);
  if (m) return Number(m[1] || m[2] || m[3]);
  if (/\b(muchos|bastantes|un chingo|somos varios|harta gente)\b/.test(t)) return 0;
  return null;
}

function unidadPara(gente) {
  const caben = UNIDADES
    .filter(function (u) { return Number(u.max) >= gente; })
    .sort(function (a, b) { return Number(a.max) - Number(b.max); });
  return caben.length ? caben[0] : null;
}

function listaDeUnidades() {
  return UNIDADES.map(function (u) {
    return '• *' + u.name + '* — ' + u.cap;
  }).join('\n');
}

/* Lo que trae una unidad, con sus palabras del catálogo. */
function fichaDe(u) {
  const cosas = (u.spec || []).map(function (s) {
    return Array.isArray(s) ? s[1] : s;
  });
  return '*' + u.name + '* — ' + u.cap + '\n\n' +
    cosas.map(function (c) { return '✓ ' + c; }).join('\n');
}

/* ------------------------------------------------------------
   NUNCA SE ANUNCIA EL PASE
   ------------------------------------------------------------
   Decisión del dueño, 2-sep-2026: el cliente no tiene por qué
   enterarse de con qué está hablando.

   Antes el bot decía «te paso con una persona del equipo», «su
   precio lo da una persona», «te contacta un vendedor». Cada una
   de esas frases delata que quien escribe no es quien resuelve, y
   el cliente ata cabos solo.

   Ahora todo va en PRIMERA PERSONA: «déjame confirmarlo», «te lo
   mando», «márcame». Por dentro no cambia nada —la bandera `pasa`
   le sigue avisando al equipo—; cambia lo que se lee.

   Lo que NO se hizo, y queda dicho aquí: si alguien pregunta
   derecho «¿eres un bot?», no hay una respuesta que lo niegue. No
   anunciar es una cosa; escribir una mentira es otra, y ésa no se
   puso sin que se pida.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   EL QUE YA DIJO QUE SÍ
   ------------------------------------------------------------
   Aquí cae el botón que el bot mismo ofrece después del precio,
   y las formas en que la gente dice lo mismo con sus palabras.

   Antes ese botón decía «Apartar en línea» y NO TENÍA MANEJADOR:
   el cliente le picaba y caía en el «déjame checarte eso bien
   tantito», o sea que al que acababa de decir que sí se le
   contestaba como al que no se entendió.

   Y el nombre estaba mal desde el 3-sep-2026: «en línea» era la
   liga de Stripe, y el bot ya no cobra con Stripe. El cobro por
   la página —con cuenta, sesión y todo— sigue con Stripe igual;
   lo que cambió es el bot, que solo recibe transferencia.

   Se le pide el nombre —el dato que hace falta para el contrato—
   y se pasa, porque los datos bancarios NO están en este archivo
   y no se inventan: el dueño los dicta. Es la misma regla del
   precio. Un CLABE equivocado es el dinero de un cliente que se
   va a otra cuenta.
   ------------------------------------------------------------ */
/* Las raíces van con comodín al final —`apart\w*`— porque la gente
   les pega de todo: «apártamela», «apartándola», «reservármela». Con
   la palabra cerrada, «sí apártala» y «resérvamela» no entraban, que
   son justo las dos formas más comunes de decir que sí. */
const QUIERE_APARTAR = /\b(apart\w*|reserv\w*|bloque(a|á)\w*|amarr\w*|le entramos|le entro|va que va|quedamos as[ií])\b/;

/* ------------------------------------------------------------
   LO ÚNICO QUE EL BOT AFIRMA DE LA EMPRESA
   ------------------------------------------------------------
   Catorce años, dictado por el dueño el 4-sep-2026.

   Es la prueba social que Cialdini pone como el principio de más
   peso, y aquí se puede usar porque es CIERTA y no cambia. Se le
   preguntó también por grupos al mes y él lo cuestionó con razón:
   ése es un número que se mueve, que habría que estar
   actualizando, y que en cuanto se quede viejo se vuelve una
   mentira. Catorce años no se despinta.

   NO SE INVENTA NADA MÁS. Ni unidades, ni clientes, ni «somos
   líderes». Lo único verificable que hay además de esto es el
   seguro de viajero, que está en su propio sitio oficial.
   ------------------------------------------------------------ */
const ANIOS = 14;

/* ------------------------------------------------------------
   LA COMISIÓN DE AGENCIA
   ------------------------------------------------------------
   5 %, dictado por el dueño el 4-sep-2026.

   Es **5 % de descuento sobre el precio público** —la agencia
   paga 95 y vende a 100— y **solo cuando es cuenta**, o sea
   agencia registrada. Precisado por el dueño el 4-sep-2026.

   EL BOT LA DICE Y NO LA CALCULA, y ese «solo cuando es cuenta»
   es justo la razón por la que no se puede automatizar todavía:

   El bot reconoce a una agencia por SEÑALES —«pax», «neto»,
   «comisión», varias fechas de un jalón— no por un registro. Eso
   sirve de sobra para cambiarle el TONO, que es para lo que se
   hizo: hablarle de colega a colega en vez de venderle la fiesta
   que empieza en Guadalajara.

   Pero descontar dinero por una señal es otra cosa. Cualquiera
   que escriba «pax» se llevaría el 5 % sin ser cuenta de nadie,
   y eso es margen que se va en silencio. Para descontarlo solo a
   las de verdad hace falta una lista de agencias registradas
   —`AGENCIAS_REGISTRADAS` en el propio JSON del dueño— y esa
   lista todavía no existe.

   Así que el bot nombra el porcentaje y pasa la conversación.
   Cuando haya registro, el descuento se aplica en `_tarifa.js`,
   que es el dueño del dinero, y nunca aquí.
   ------------------------------------------------------------ */
const COMISION_AGENCIA = 5;

const PASA = {
  texto: 'Claro 🙌 Márcame o escríbeme al *' + TELEFONO + '* y lo vemos ahí mismo.\n\n' +
    'O si prefieres, déjame aquí a dónde van y cuántos son, y yo te lo armo.',
  pasa: true
};

/* ------------------------------------------------------------
   LA RESPUESTA
   ------------------------------------------------------------
   Devuelve { texto, pasa }. `pasa` en true significa que esta
   conversación necesita una persona: quien llame decide si eso
   es avisarle al dueño, marcarla en un tablero, o nada.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   LA COTIZACIÓN, PASO A PASO
   ------------------------------------------------------------
   Solo para la Sprinter: es la única unidad con
   `cotizadorAutomatico` en el catálogo. Para las demás el precio
   lo da una persona, y el bot no lo inventa.

   El estado NO vive aquí dentro. Entra y sale como parámetro,
   por dos razones:

     · en el servidor esto corre sin memoria entre mensajes; una
       variable de módulo se mezclaría entre clientes distintos
     · así se puede probar cada paso sin fingir una conversación

   Cuando ya juntó los cuatro datos NO cotiza: devuelve `cotiza`
   con lo que hay que preguntarle a `/api/cotizar`. Quien llama es
   el que tiene la red. El precio SIEMPRE sale del motor de cobro,
   nunca de aquí (R12).
   ------------------------------------------------------------ */
/* Las horas del recorrido mueven el precio, así que se preguntan. Se
   ofrecen TRES, que es el máximo de botones de WhatsApp, y con
   etiquetas de menos de 20 caracteres, que es su tope. */
/* Tres, porque tres son los botones de WhatsApp. La de en medio dice
   «20» a propósito: es el corte real —hasta ahí llega la Sprinter, que
   es la única que se cotiza sola—. */
const OPCIONES_GENTE = ['Somos 10 o menos', 'Entre 11 y 20', 'Somos más de 20'];

function porId(id) {
  for (let i = 0; i < UNIDADES.length; i++) if (UNIDADES[i].id === id) return UNIDADES[i];
  return null;
}
const SPRINTER = porId('sprinter');
const SUBURBAN = porId('suburban');
const MAYOR = UNIDADES.reduce(function (a, b) {
  return Number(b.max) > Number(a.max) ? b : a;
}, UNIDADES[0]);

/* Hasta cuántos se le pregunta si pueden acomodarse en la Sprinter en
   vez de mandarlos derecho a un autobús. Arriba de esto ya no tiene
   caso: nadie deja a seis personas fuera. */
const CASI_SPRINTER = 24;

/* ------------------------------------------------------------
   QUÉ UNIDAD OFRECERLE
   ------------------------------------------------------------
   Esto lo pidió el dueño después de probarlo: con 21 personas el bot
   le saltaba directo a un autobús, sin preguntarle nada. Un grupo de
   21 casi siempre puede ser 20, y esa diferencia es la que decide si
   el precio sale al momento o hay que esperar a una persona.

   Y con grupos chicos hay DOS opciones y no una: la Suburban es
   servicio ejecutivo —interiores en piel, puerta a puerta— y cuesta
   distinto. Ofrecer solo la Sprinter era esconderle media flota.
   ------------------------------------------------------------ */
/* `previo` es el estado que ya se traía. Se agregó el 2-sep-2026 al
   cambiar el orden: ahora «cuántos van» se pregunta DESPUÉS del destino
   y de las fechas, así que esta función ya no puede arrancar la
   conversación de cero — tiraría lo que el cliente ya contestó.

   Sin `previo` se comporta igual que siempre, que es como la llaman las
   entradas sueltas («somos 16» a secas). */
function recomienda(gente, previo) {
  const traido = previo || {};
  /* Grupo chico: caben en las dos, y son unidades muy distintas. */
  if (gente <= Number(SUBURBAN.max)) {
    return {
      texto: 'Para ' + gente + (gente === 1 ? ' persona' : ' personas') +
        ' tienes dos opciones 👇\n\n' +
        '🚐 *' + SPRINTER.name + '* — ' + SPRINTER.cap + '\n' +
        'La de siempre. Te la cotizo aquí mismo, al momento.\n\n' +
        '🚙 *' + SUBURBAN.name + '* — ' + SUBURBAN.cap + '\n' +
        'Servicio ejecutivo: interiores en piel, puerta a puerta. Es más ' +
        'premium y su precio te lo confirmo yo en unos minutos.\n\n' +
        '¿Cuál te late?',
      opciones: ['La Sprinter', 'La Suburban'],
      estado: Object.assign({}, traido, { paso: 'elegirChica', gente: gente })
    };
  }

  /* Le cabe a la Sprinter: derecho a cotizar. */
  if (gente <= Number(SPRINTER.max)) {
    const p = siguiente(alSiguienteHueco(Object.assign({}, traido, { unidad: 'sprinter', gente: gente })));
    return {
      texto: 'Para ' + gente + ' personas te va la *' + SPRINTER.name + '* (' +
        SPRINTER.cap + ').\n\nTe saco el precio ahorita 👇\n\n' + p.texto,
      opciones: p.opciones,
      estado: p.estado
    };
  }

  /* Por poquito arriba. Vale la pena preguntar antes de mandarlo con
     una persona: si pueden ser 20, tiene precio en un minuto. */
  if (gente <= CASI_SPRINTER) {
    return {
      texto: 'Andan por poquito arriba 🤏\n\nLa *' + SPRINTER.name + '* lleva ' +
        SPRINTER.max + ', y ustedes son ' + gente + '.\n\n' +
        'Si logran acomodarse en ' + SPRINTER.max + ', te saco el precio ahorita ' +
        'mismo. Si no, les armo un autobús y te confirmo el precio.',
      opciones: ['Sí, somos ' + SPRINTER.max, 'Somos ' + gente],
      estado: Object.assign({}, traido, { paso: 'ajustar', gente: gente })
    };
  }

  /* ------------------------------------------------------------
     YA ES AUTOBÚS · PERO ¿CUÁL?
     ------------------------------------------------------------
     Aquí decía «les va un *autobús*» y se seguía de largo. El dueño
     lo cachó a la primera:

       «no me dijo ni cuál unidad es, necesita seleccionar una
        unidad, no se puede quedar como autobús 50 personas»

     Y tiene razón por dos lados. Uno operativo: hay CUATRO
     autobuses y no son el mismo — el i6S lleva 51 y el i6 lleva
     47, así que «autobús» ni siquiera dice si caben.

     Y uno de venta, que pesa más. «Un autobús» es un genérico:
     no se ve, no se desea y no se compara. «El Irizar i6S, 51
     pasajeros, con baño» es un producto — el cliente se lo puede
     imaginar y se lo puede enseñar a su grupo.

     Escoger también compromete: quien eligió su unidad ya no está
     cotizando, está armando SU viaje.

     Solo se ofrecen las que de verdad le caben. Enseñarle una en la
     que no cabe es hacerle escoger algo que después hay que
     quitarle.
     ------------------------------------------------------------ */
  const lesCaben = UNIDADES.filter(function (u) {
    return u.cat === 'autobus' && gente <= Number(u.max);
  }).sort(porEscalon);

  /* No cabe en ninguna: van más de 51. Ahí no hay que escoger, hay que
     hablar — son dos unidades o más, y eso lo arma una persona. */
  if (!lesCaben.length) {
    const p = siguiente(alSiguienteHueco(Object.assign({}, traido,
      { unidad: 'autobus', gente: gente })));
    return {
      texto: 'Para ' + gente + ' personas se ocupa más de una unidad — la más ' +
        'grande que tenemos lleva ' + MAYOR.max + '.\n\nEso te lo armo yo ' +
        'directo. Déjame juntar los datos para no hacerte repetir nada 👇\n\n' +
        p.texto,
      opciones: p.opciones,
      estado: p.estado
    };
  }

  /* ------------------------------------------------------------
     SE ANOTA QUE ES AUTOBÚS, PERO NO SE ESCOGE TODAVÍA
     ------------------------------------------------------------
     El primer intento preguntaba cuál autobús AQUÍ MISMO, en cuanto
     el cliente decía cuántos son. Estaba mal, y se vio al probarlo:
     el cliente contestaba «Puerto Vallarta» y el bot le repetía
     «¿cuál de esos te late?» porque esperaba el nombre de un camión.

     El orden correcto ya está escrito en `alSiguienteHueco`, y es el
     mismo que dice el guion de ventas: destino → fechas → cuántos →
     CUÁL unidad → de dónde. El destino va primero porque es lo único
     que el cliente ya tiene decidido, y porque revela la ocasión.

     Así que aquí solo se anota la categoría y se deja que el orden
     mande. Cuando toque escoger, `elegirBus` lo pregunta.
     ------------------------------------------------------------ */
  const conBus = alSiguienteHueco(Object.assign({}, traido,
    { unidad: 'autobus', gente: gente }));
  const p = siguiente(conBus);

  /* ------------------------------------------------------------
     EL HUECO ENTRE LA SPRINTER Y EL AUTOBÚS
     ------------------------------------------------------------
     Confirmado por el dueño el 4-sep-2026: **no hay unidades de 21 a
     35 pasajeros**. Se brinca de la Sprinter (20) al autobús chico
     (47).

     Un grupo de 25 recibía «les va autobús» a secas, sin enterarse de
     que se va a subir a un camión de 47. Y se entera después —cuando
     lo ve— con cara de que le vendieron de más.

     Se dice de frente, y de frente vende: es el argumento de dos
     caras del documento del dueño. Conceder el hueco compra el
     derecho a que crean lo bueno, que además es cierto — 25 personas
     en un camión de 47 van sobradas, con lugar para equipaje y
     hieleras.
     ------------------------------------------------------------ */
  const chico = Math.min.apply(null, lesCaben.map(function (u) { return Number(u.max); }));
  const vanSobrados = gente <= chico - 8;

  return {
    texto: 'Para ' + gente + ' personas les va *autobús* 🚌' +
      (vanSobrados
        ? '\n\nNo manejamos nada entre la Sprinter (20) y el autobús (' + chico +
          '), así que van bien sobrados — con lugar de más para equipaje.'
        : '') +
      '\n\n' + p.texto,
    opciones: p.opciones,
    estado: p.estado
  };
}

const HORAS_MOV = [
  { etiqueta: 'Hasta 8 horas', fin: '16:00' },
  { etiqueta: 'Hasta 10 horas', fin: '18:00' },
  { etiqueta: 'Todo el día', fin: '20:00' }
];

/* ------------------------------------------------------------
   LOS PASEOS CON NOMBRE, PARA PODER OFRECERLOS
   ------------------------------------------------------------
   Dictado el 1-sep-2026: «los 3 destinos de CDMX ofrécelos: si el
   cliente puso CDMX de destino y quiere movimientos, despliega esas
   3 opciones […] tanto en la app como en el chatbot».

   Esta tabla es un ESPEJO de la que cobra, que vive en
   `api/_tarifa.js`. Se duplica porque el navegador no puede leer
   `api/`, y un espejo se despega solo: si allá se agrega un paseo y
   aquí no, el bot deja de ofrecerlo y nadie se entera.

   Por eso `probar-whatsapp.cjs` compara las dos listas y se pone en
   rojo si dejan de coincidir. Los PRECIOS no se copian —esos solo
   viven allá, con el motor de cobro— aquí solo están los nombres.
   ------------------------------------------------------------ */
const PASEOS_POR_DESTINO = [
  { busca: /ciudad de m[eé]xico|cdmx|distrito federal/i,
    opciones: ['Taxco', 'Chalma', 'Xochimilco'] },
  { busca: /huasteca/i,
    opciones: ['El Meco', 'El Naranjo'] }
];

/* ------------------------------------------------------------
   LIMPIAR EL DESTINO
   ------------------------------------------------------------
   El cliente no escribe «Tequila»: escribe «vamos a Tequila de
   despedida». Antes eso se guardaba TAL CUAL, y aunque el precio
   salía bien —el buscador de destinos encuentra «Tequila» dentro
   de la frase— el texto entero terminaba en la pantalla y en el
   contrato:

       📍 Guadalajara → vamos a Tequila de despedida

   Se recorta por los dos extremos, y con mucho cuidado:

   · Al principio, solo frases de arranque conocidas. La «a» suelta
     SÍ se quita —«a Chapala» → «Chapala»— pero solo cuando va
     seguida de espacio: así «Aguascalientes» y «Acapulco» quedan
     intactos, porque ahí la «a» es parte de la palabra.

   · Al final, solo colas de OCASIÓN de una lista cerrada. Nada de
     quitar cualquier «de algo», porque medio país se llama así:
     San Juan de los Lagos, Barra de Navidad, Real de Catorce.

   Y si el recorte deja menos de tres letras, NO se recorta: vale
   más un destino feo que uno mutilado.
   ------------------------------------------------------------ */
const ARRANQUES = /^(?:nos\s+)?(?:vamos|queremos\s+ir|quiero\s+ir|iremos|vamonos|nos\s+vamos|es|seria|ser[ií]a|ir)\s+(?:a|al|para|hacia|hasta)\s+|^(?:para|hacia|rumbo\s+a|a|al)\s+/i;
const COLAS_DE_OCASION = /\s+(?:de|por|para)\s+(?:despedida|boda|bodas|xv|quince|quincea[nñ]era|graduaci[oó]n|generaci[oó]n|peregrinaci[oó]n|romer[ií]a|cumplea[nñ]os|convivencia|paseo|excursi[oó]n|viaje|placer|trabajo|negocios)\b.*$/i;

function limpiaDestino(texto) {
  const original = String(texto || '').trim();
  let d = original;

  const arranque = d.match(ARRANQUES);
  if (arranque) {
    d = d.slice(arranque[0].length);
    /* «al Manto» es «a EL Manto», y ese artículo es parte del nombre:
       el destino se llama **El Manto** y su buscador es /el manto/i.
       Quitando el «al» completo quedaba «Manto» y dejaba de encontrarse.
       Se devuelve el artículo. */
    if (/\bal\s+$/i.test(arranque[0])) d = 'el ' + d;
  }

  d = d.replace(COLAS_DE_OCASION, '').replace(/[\s,;.]+$/, '').trim();
  return conMayuscula(d.length >= 3 ? d : original);
}

/* ------------------------------------------------------------
   EL DESTINO SE ESCRIBE CON MAYÚSCULA
   ------------------------------------------------------------
   La gente teclea «a chapala» y el bot le contestaba «*chapala*,
   va 📍». Un nombre propio en minúscula se ve descuidado, y este
   destino se le repite al cliente cuatro o cinco veces —en el
   acuse, en el resumen, en el precio, en el cierre—. Cinco veces
   descuidado.

   Las palabras cortas de unión se dejan en minúscula, que es como
   se escriben de verdad: «San Juan de los Lagos», no «San Juan De
   Los Lagos». La primera SIEMPRE va con mayúscula, aunque sea una
   de ésas.

   Y lo que ya venía con mayúsculas se respeta: quien escribió
   «CDMX» quiso decir CDMX, no «Cdmx».
   ------------------------------------------------------------ */
const MINUSCULAS = ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'a'];

function conMayuscula(texto) {
  return String(texto || '').split(/\s+/).map(function (p, i) {
    if (!p) return p;
    /* Ya trae mayúscula adentro: es una sigla o alguien que lo
       escribió a propósito. No se toca. */
    if (/[A-ZÁÉÍÓÚÑ]/.test(p)) return p;
    if (i > 0 && MINUSCULAS.indexOf(p.toLowerCase()) !== -1) return p.toLowerCase();
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(' ');
}

/* ------------------------------------------------------------
   LAS FOTOS DE CADA UNIDAD
   ------------------------------------------------------------
   Salen de `medios-unidades.js`, que a su vez salió de la página
   oficial. Son fotos de estudio del dueño: ni generadas, ni de
   banco de imágenes.

   Aquí NO se guardan las rutas otra vez — se arman desde el
   conteo, que es el único lugar donde vive. Dos listas de lo
   mismo se separan y una empieza a apuntar a archivos que ya no
   están.

   Se mandan TRES, no las siete: en WhatsApp una ráfaga de fotos
   satura y el cliente deja de mirarlas. Tres se ven.
   ------------------------------------------------------------ */
const MEDIOS = (typeof window !== 'undefined' && window.MEDIOS_UNIDADES) || {};

function mediosDe(idUnidad) {
  const id = idUnidad === 'autobus' ? 'irizar-i6s' : String(idUnidad || 'sprinter');
  const m = MEDIOS[id];
  if (!m || !m.fotos) return null;

  const u = porId(id) || porId('sprinter');
  const fotos = [];
  for (let i = 1; i <= Math.min(3, m.fotos); i++) {
    fotos.push('img/unidades/' + id + '/' + id + '-' + (i < 10 ? '0' : '') + i + '.jpg');
  }
  return {
    unidad: id,
    fotos: fotos,
    video: m.video ? 'https://www.youtube.com/watch?v=' + m.video : null,
    texto: 'Claro 📸 Ésta es la *' + (u ? u.name : 'unidad') + '*' +
      (u ? ' — ' + u.cap : '') + '.\n\n' +
      (m.video ? 'Te dejo también un video por dentro 👇\n\n' : '') +
      '¿Te saco el precio de tu viaje?'
  };
}

/* ------------------------------------------------------------
   LA FRASE DE UN JALÓN
   ------------------------------------------------------------
   «vamos a Tequila el 12, somos 16»

   Así escribe la gente el PRIMER mensaje, y hasta hoy el bot no
   entendía nada de eso: se rendía y pedía que empezaran de nuevo,
   paso por paso. En una página se aguanta; en WhatsApp se pierde
   al cliente en el primer intento.

   Devuelve **exactamente la misma forma** que devuelve la IA de
   `_entender.js`, para poder pasárselo a `aplicaEntendido`, que ya
   existe y ya sabe qué hacer. Así el camino es uno solo:

       lector gratis  ─┐
                        ├─► aplicaEntendido ─► la conversación
       la IA (respaldo)─┘

   Y por eso esto va PRIMERO y la IA después: lo que se lea aquí no
   cuesta nada.

   ------------------------------------------------------------
   EL ORDEN IMPORTA, Y ES LO ÚNICO DELICADO
   ------------------------------------------------------------
   «somos 16» y «el 12» son los dos números de la misma frase. Si
   se busca la fecha primero, el 16 se lee como día 16 y el viaje
   sale con la fecha equivocada.

   Por eso: PRIMERO la gente, y su pedazo se BORRA del texto. Lo
   que quede es donde se busca la fecha. Un número que ya se usó
   para contar personas no puede volver a usarse para contar días.
   ------------------------------------------------------------ */

/* Lo que, una vez leído como gente, deja de existir para la fecha. */
const PEDAZOS_DE_GENTE = [
  /\bentre \d{1,3} y \d{1,3}\b/g,
  /\b\d{1,3} o menos\b/g,
  /\b\d{1,3}\s*(?:personas|pasajeros|pax|gente|alumnos|alumnas|ninos|adultos)\b/g,
  /\b(?:somos|seriamos|iriamos|serian)\s*(?:como\s*)?\d{1,3}\b/g,
  /\bmas de \d{1,3}\b/g
];

/* Los pedazos de texto que pueden ser una fecha. No se interpretan
   aquí: se le pasan enteros a `fechaDe`, que ya sabe leerlos y ya
   está probada. Duplicar esa lógica sería tener dos calendarios. */
function fragmentosDeFecha(t) {
  const trozos = [];
  const mete = function (s) { if (s) trozos.push(s); };

  /* «del 10 al 13» trae las DOS fechas de un golpe. Va primero
     porque si no, el «10» se leería solo y el «13» se perdería. */
  const rango = t.match(/\bdel?\s+(\d{1,2})\s+al\s+(\d{1,2})\b/);
  if (rango) return { salida: 'el ' + rango[1], regreso: 'el ' + rango[2] };

  /* «el 12 de septiembre», «el 12» */
  const conEl = t.match(/\bel\s+(\d{1,2})(\s+de\s+[a-zñ]+)?\b/);
  if (conEl) mete('el ' + conEl[1] + (conEl[2] || ''));

  /* «12 de septiembre», sin «el» */
  const conMes = t.match(/\b(\d{1,2})\s+de\s+([a-zñ]{3,10})\b/);
  if (conMes) mete(conMes[1] + ' de ' + conMes[2]);

  /* «12/9» */
  const conDiagonal = t.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (conDiagonal) mete(conDiagonal[0]);

  /* «mañana», «el sábado» */
  const relativo = t.match(/\b(pasado manana|manana|hoy|el\s+(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo))\b/);
  if (relativo) mete(relativo[1]);

  return { salida: trozos[0] || null, regreso: null };
}

/* Después de «a», «para» o «hacia» viene el destino — y se corta en
   cuanto empieza otra cosa: una coma, una fecha, o cuántos son. */
function destinoDeLaFrase(crudo) {
  const m = String(crudo || '').match(
    /\b(a|al|para|hacia|rumbo a)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][^,;.!?]{2,45})/i);
  if (!m) return null;
  /* «al Manto» es «a EL Manto», y ese artículo es parte del nombre:
     el destino se llama **El Manto** y su buscador es /el manto/i.
     `limpiaDestino` ya devolvía el artículo, pero aquí no llegaba: el
     «al» se lo come esta expresión de arriba, así que cuando el
     destino se toma de esta función —y desde el 4-sep-2026 se toma
     también en el paso «destino»— quedaba en «Manto», que el catálogo
     NO encuentra. Un destino que no se encuentra se va por la fórmula
     y cobra otro precio. */
  const conArticulo = /^al$/i.test(m[1]);
  /* OJO CON LAS PALABRAS DE CORTE · aquí estuvieron `los` y `del`, y se
     comían medio país: «san juan de LOS lagos» quedaba en «San Juan de»,
     y ese destino ya no se encuentra en el catálogo — o sea, otro precio.
     Lo mismo pasaría con Los Cabos y Los Mochis.

     `el` sí se queda, porque es lo que corta «a Tequila EL 12». Y no
     estorba con «El Manto»: ahí el «El» va al principio del pedazo, sin
     espacio antes, así que no empata. */
  /* Se corta también en palabras de FECHA. Sin esto, «a Chapala mañana»
     dejaba el destino en «Chapala Manana», que el catálogo ya no
     encuentra — y lo que no se encuentra cobra otro precio. */
  let d = m[2]
    .split(/\s+(?:el|somos|para|con|y|de\s+ida|ida|manana|ma[nñ]ana|hoy|pasado|lunes|martes|miercoles|mi[eé]rcoles|jueves|viernes|sabado|s[aá]bado|domingo|del)\s+/i)[0]
    .replace(/\s+(?:manana|ma[nñ]ana|hoy)$/i, '')
    .split(/\s+\d/)[0]
    .trim();
  d = limpiaDestino(d);
  if (d.length < 3) return null;
  /* Se devuelve el artículo que se comió el «al», salvo que el cliente
     ya lo haya escrito él («vamos al el Manto» no existe, pero «a El
     Manto» sí). */
  if (conArticulo && !/^el\s/i.test(d)) d = 'el ' + d;
  /* Con mayúscula inicial en cada palabra: el cliente escribe «tequila»
     y ese texto termina impreso en el contrato. Las palabras cortas
     —de, la, los— se quedan en minúscula, como se escriben de verdad:
     «Barra de Navidad», no «Barra De Navidad». */
  return d.replace(/\S+/g, function (p, i) {
    const chica = /^(de|del|la|las|los|el|y)$/i.test(p);
    return (i > 0 && chica) ? p.toLowerCase()
      : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  });
}

/* De dónde salen, cuando lo dicen en la misma frase.

   ESTO ES DINERO: Ocotlán y Yurécuaro llevan recargo sobre el precio de
   lista. Si el cliente escribe «salimos de Ocotlán a Chapala» y el
   origen no se lee, el viaje se cotiza desde Guadalajara y **se cobra de
   menos**. Se destapó en la revisión del 2-sep-2026.

   Solo se leen las formas EXPLÍCITAS —«salimos de X», «desde X»—. Un
   «de» suelto no basta: en «vamos de despedida a Tequila» diría que
   salen «de despedida». */
function origenDeLaFrase(crudo) {
  const m = String(crudo || '').match(
    /\b(?:salimos|saliendo|salgo|salen|partimos|arrancamos)\s+de\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][^,;.!?]{2,40})|\bdesde\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][^,;.!?]{2,40})/i);
  if (!m) return null;
  let o = (m[1] || m[2] || '')
    .split(/\s+(?:a|al|para|hacia|el|somos|con|y)\s+/i)[0]
    .split(/\s+\d/)[0]
    .trim();
  return o.length >= 3 ? o : null;
}

function leeDeUnJalon(crudo, hoy) {
  const original = String(crudo || '');
  const t = normaliza(original);

  const gente = cuantaGente(t);

  /* Se borra lo que ya se leyó como gente. Ver la nota del orden. */
  let sinGente = t;
  PEDAZOS_DE_GENTE.forEach(function (p) { sinGente = sinGente.replace(p, ' '); });

  const trozos = fragmentosDeFecha(sinGente);
  const salida = trozos.salida ? fechaDe(trozos.salida, hoy) : null;
  const regreso = trozos.regreso ? fechaDe(trozos.regreso, hoy) : null;

  const destino = destinoDeLaFrase(original);

  let unidad = null;
  if (/\bsprinter\b|\bsprinters\b/.test(t)) unidad = 'sprinter';
  else if (/\bsuburban\b/.test(t)) unidad = 'suburban';
  else if (/\bautobus\b|\bcamion\b|\bbus\b/.test(t)) unidad = 'autobus';

  return {
    intencion: 'cotizar',
    gente: gente,
    unidad: unidad,
    destino: destino,
    origen: origenDeLaFrase(original),
    salida: salida,
    regreso: regreso,
    soloIda: /\bsolo ida\b|\bsencillo\b|\bnada mas de ida\b/.test(t),
    ocasion: ocasionDe(original, destino),
    respuesta: null
  };
}

/* ¿Vale la pena usar lo que se leyó? Con UN solo dato no: «somos 16»
   a secas ya lo maneja el camino de siempre, y mejor. Esto es para
   cuando el cliente soltó el viaje casi completo de una vez. */
function traeSuficiente(d) {
  /* ------------------------------------------------------------
     UN DESTINO SOLO YA ES SUFICIENTE
     ------------------------------------------------------------
     Pedía DOS señales, y con eso «a chapala» —a secas, que es de
     los mensajes con los que más arranca la gente— se caía hasta
     el fondo: el guion se rendía y quedaba en manos de la IA. El
     dueño lo vio a la primera y creyó que era falta de IA. No lo
     era: era que el guion no quería leer lo que ya había leído.

     Depender de una llamada de pago para entender «a chapala» es
     caro y frágil. Si la IA está caída, el cliente más fácil de
     todos se topa con pared.

     El riesgo de bajarlo a uno es leer como destino algo que no lo
     es —«a mi casa»—. Se acepta a propósito, por dos razones: el
     bot SIEMPRE confirma lo que entendió («si me equivoqué dime
     cambiar algo»), y equivocarse enseñando lo que entendiste es
     mucho más barato que rendirse.

     Un número solo NO alcanza: «somos 16» ya lo maneja mejor el
     camino de siempre, que recomienda unidad. Y una fecha sola
     tampoco dice nada sin a dónde.
     ------------------------------------------------------------ */
  let señales = 0;
  if (d.gente) señales++;
  if (d.destino) señales++;
  if (d.salida) señales++;
  if (d.unidad) señales++;
  return señales >= 2;
}

function paseosDe(destino) {
  const t = String(destino || '');
  for (let i = 0; i < PASEOS_POR_DESTINO.length; i++) {
    if (PASEOS_POR_DESTINO[i].busca.test(t)) return PASEOS_POR_DESTINO[i].opciones;
  }
  return null;
}

/* ------------------------------------------------------------
   LA OCASIÓN
   ------------------------------------------------------------
   El cliente no es «un grupo de 40»: es UNA persona, la que está
   organizando. Y lo que compra no es el camión — es no quedar mal
   con los 40 que confiaron en ella.

   Saber para qué es el viaje cambia dos cosas, y ninguna es el
   precio: cómo se le contesta al principio, y contra qué se
   compara el número al final. Un viaje a Tequila se compara con
   cuatro coches y con que alguien se quede sin tomar; uno de
   empresa, con la factura y la hora de llegada.

   El destino da la ocasión por defecto. Las palabras del cliente
   MANDAN sobre el destino: una boda en Tequila es una boda.
   ------------------------------------------------------------ */
const OCASION_POR_DESTINO = [
  { busca: /tequila|amatit[aá]n|guachimontones/i, ocasion: 'fiesta' },
  { busca: /vallarta|mazatl[aá]n|manzanillo|guayabitos|canc[uú]n|acapulco|sayulita|chacala|barra de navidad|tenacatita|mayto|punta perula|mismaloya|ixtapa|huatulco/i, ocasion: 'playa' },
  { busca: /talpa|san juan de los lagos|sto\.? toribio|santo toribio/i, ocasion: 'peregrinacion' },
  { busca: /chapala|ajijic|cosal[aá]|mazamitla|tapalpa|zirahu[eé]n|p[aá]tzcuaro/i, ocasion: 'escapada' },
  { busca: /ciudad de m[eé]xico|cdmx|puebla|quer[eé]taro|monterrey|le[oó]n|guadalajara/i, ocasion: 'ciudad' }
];

/* Lo que el cliente dice de su viaje gana sobre el mapa de arriba. */
const OCASION_POR_PALABRA = [
  { ocasion: 'boda',           palabras: ['boda', 'bodas', 'novia', 'novio', 'xv', 'quince', 'quinceanera', 'quinceañera'] },
  { ocasion: 'fiesta',         palabras: ['despedida', 'cumpleanos', 'cumpleaños', 'cantaritos', 'fiesta', 'party'] },
  { ocasion: 'empresa',        palabras: ['empresa', 'empresarial', 'convivencia', 'corporativo', 'trabajo', 'oficina', 'factura'] },
  { ocasion: 'escolar',        palabras: ['escuela', 'escolar', 'graduacion', 'graduación', 'generacion', 'generación', 'alumnos', 'colegio'] },
  { ocasion: 'peregrinacion',  palabras: ['peregrinacion', 'peregrinación', 'peregrinar', 'romeria', 'romería'] }
];

/* Cuando no hay señal se queda en `null` a propósito: un acuse
   entusiasta y genérico —«¡qué buen plan!»— suena a robot y no a
   vendedor. Sin señal, se contesta corto y ya. */
function ocasionDe(texto, destino) {
  const t = String(texto || '');
  for (let i = 0; i < OCASION_POR_PALABRA.length; i++) {
    if (tiene(t, OCASION_POR_PALABRA[i].palabras)) return OCASION_POR_PALABRA[i].ocasion;
  }
  const d = String(destino || '');
  for (let i = 0; i < OCASION_POR_DESTINO.length; i++) {
    if (OCASION_POR_DESTINO[i].busca.test(d)) return OCASION_POR_DESTINO[i].ocasion;
  }
  return null;
}

/* Una línea, específica, al enterarse del destino. Nunca dos. */
const ACUSE_DE_OCASION = {
  fiesta:        'Buenísimo plan, esa ruta la hacemos cada fin.',
  playa:         'Va, playa 🌴',
  peregrinacion: 'Esa ruta la conocemos bien, la hacemos cada año.',
  escapada:      'Buen destino para desconectarse.',
  ciudad:        'Perfecto.',
  boda:          'Felicidades 🎉 Tú dedícate al evento, de mover gente nos encargamos nosotros.',
  empresa:       'Perfecto.',
  escolar:       'Va.'
};

/* ------------------------------------------------------------
   CONTRA QUÉ SE COMPARA EL PRECIO
   ------------------------------------------------------------
   Un número solo no dice nada: el cliente lo va a comparar con
   algo, y si no le damos con qué, se lo inventa —y se lo inventa
   caro—. Aquí va lo que de verdad es la alternativa.

   Todas son ciertas y ninguna presume. La de la fiesta es la más
   fuerte porque nombra el miedo real: que alguien maneje de
   regreso.
   ------------------------------------------------------------ */
/* Cada una tiene que sostenerse SOLA. La de fiesta decía «y nadie se
   queda sin tomar» —media frase— porque venía de una comparación con
   «lo que gastan en 4 coches». Ese número no lo puedo sostener: no sé
   qué gasta su grupo en gasolina ni en casetas, y ponerlo sería
   inventar. Lo que sí es cierto sin número es que nadie maneja. */
/* ------------------------------------------------------------
   MODO AGENCIA · §8 del guion
   ------------------------------------------------------------
   Muchos clientes de Eurotravel son agencias que revenden el
   servicio a SU propio cliente. Es otro comprador, y venderle
   igual que a un particular lo espanta.

   El particular compra no quedar mal con sus amigos. La agencia
   compra **no quedar mal frente a su cliente** — y ya sabe lo que
   cuesta un autobús, así que el discurso de «la fiesta empieza
   desde que se suben» le suena a que le están vendiendo humo.

   NUNCA SE PREGUNTA. Un buen vendedor no dice «¿eres agencia?»:
   se da cuenta. Aquí se lee de cómo escribe.

   Las señales son de dos tipos y por eso van separadas:

   · VOCABULARIO DE OFICIO. «pax», «tarifa neta», «mi pasajero»,
     «operadora». Nadie que rente para su propia boda dice «pax».

   · CÓMO PIDE. Manda todo junto y ordenado, o pregunta por
     factura y seguro ANTES que por el precio. Un particular
     pregunta el precio primero, siempre.

   Ante la duda NO se asume: se sigue en modo normal. Tratar a un
   particular como agencia le quita justo lo que lo hace comprar.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   LA LISTA, DEPURADA · y por qué salió cada palabra
   ------------------------------------------------------------
   La primera versión traía seis palabras que había que quitar, y
   una tumbó una conversación entera en la prueba del navegador:

   · `cotizame`, `coticen` · **el defecto que se coló.** El propio
     botón del bot dice «Sí, cotizar», y `tiene()` los empareja
     por tolerancia a errores de dedo. Resultado: cualquier
     cliente que le picara al botón se volvía agencia en el último
     paso, justo antes del precio — y recibía la versión seca, sin
     su precio por persona. Además «cotízame» lo dice cualquiera.

   · `neto` · está a UNA letra de «nieto». «Voy con mi nieto» no
     es una agencia.

   · `netas` · en México es «¿netas?», o sea «¿de verdad?».

   · `cupo`, `cupos` · «¿hay cupo?» lo pregunta cualquiera.

   Lo que queda son palabras que **solo se dicen trabajando**.
   Ante la duda se prefiere NO marcar: tratar a un particular como
   agencia le quita justo lo que lo hace comprar.
   ------------------------------------------------------------ */
const HABLA_DE_AGENCIA = [
  'pax', 'tarifa neta', 'tarifas netas', 'precio neto', 'comision', 'comisiones',
  'mi pasajero', 'mi cliente', 'mis pasajeros', 'mis clientes',
  'operadora', 'mayorista', 'para un grupo que tengo', 'traigo un grupo',
  'mi grupo va', 'requisicion', 'orden de servicio'
];

/* Pide papeles antes que precio. Un particular nunca hace eso. */
const PIDE_PAPELES = /\b(factura|facturaci[oó]n|constancia|p[oó]liza|seguro de pasajeros|permiso sct|r[eé]gimen fiscal)\b/i;

function esAgencia(crudo, t) {
  if (tiene(t, HABLA_DE_AGENCIA)) return true;
  /* Papeles antes que precio, y sin haber preguntado cuánto cuesta. */
  if (PIDE_PAPELES.test(String(crudo || '')) &&
      !tiene(t, ['precio', 'cuesta', 'cuanto'])) return true;
  return false;
}

/* ------------------------------------------------------------
   EL CIERRE · lo que se pregunta al final del precio
   ------------------------------------------------------------
   Investigado el 2-sep-2026. Tres cosas que cambian si contesta o
   no, y las tres estaban mal:

   1 · UNA PREGUNTA DE SÍ O NO REGALA EL «NO». «¿Lo apartamos?»
       pone la venta entera en manos de una sola palabra. El cierre
       asumido no pide permiso: da por hecho que sigue y pregunta
       el DETALLE. «¿A qué nombre te la aparto?» ya está del otro
       lado de la decisión.

   2 · LO CONCRETO GANA A LO CORRECTO. «¿Te aparto la fecha?» es
       educado y vago. Decir QUÉ pasa —«con $3,000 tu fecha queda
       bloqueada»— quita la duda de qué le van a cobrar y cuándo.

   3 · REPETIRLE SUS PALABRAS. Nombrar su destino y su fecha en el
       cierre —no «tu viaje», sino «tu Tequila del 12»— le dice que
       lo escucharon. Es lo más barato que hay y casi nadie lo hace.

   Lo que NO se hizo: la falsa urgencia. «Solo queda una unidad»
   cuando no es cierto se detecta una vez y se pierde la confianza
   para siempre. La única escasez que este bot puede decir es la
   de marzo, mayo y septiembre, porque ésa sí es verdad.
   ------------------------------------------------------------ */
function cierreDelPrecio(anticipo, saldo, resumen, pesos) {
  const r = resumen || {};
  const suyo = r.destino
    ? 'tu ' + String(r.destino).split(',')[0].trim() +
      (r.salida ? ' del ' + Number(r.salida.slice(8, 10)) : '')
    : 'tu fecha';
  /* ------------------------------------------------------------
     EL NOMBRE VA AQUÍ, Y CASI EN NINGÚN OTRO LADO
     ------------------------------------------------------------
     De toda la investigación de ventas que trajo el dueño, usar el
     nombre del cliente es lo más barato y lo que más cambia el tono.
     Pero su propia regla dice «no en cada mensaje», y tiene razón:
     un nombre repetido en cada renglón deja de sonar a cercanía y
     empieza a sonar a telemarketing.

     Así que se gasta en el mensaje que más importa —el del cierre,
     donde se le pide que diga que sí— y se guarda para las
     objeciones. En el resto de la conversación no aparece.
     ------------------------------------------------------------ */
  return 'Con *' + pesos(anticipo) + '* te bloqueo ' + suyo +
    ', y los ' + pesos(saldo) + ' restantes los liquidas antes de salir.\n\n' +
    (r.nombre ? '¿Te la aparto, ' + r.nombre + '?' : '¿A qué nombre la aparto?');
}

const COMPARACION = {
  fiesta:        'Y de regreso nadie tiene que manejar.',
  playa:         'Llegan juntos y descansados, en vez de horas cada quien manejando.',
  peregrinacion: 'Van todos juntos y el operador conoce la ruta.',
  escapada:      'Llegan juntos, y de regreso nadie maneja.',
  ciudad:        'Todos llegan a la misma hora.',
  boda:          'Tus invitados llegan puntuales y tú no andas de valet.',
  empresa:       'Todos llegan a la misma hora, y va con factura.',
  escolar:       'Van todos juntos y con seguro de viajero.'
};

/* Días de servicio contando los dos extremos: salir el 10 y volver el
   12 son tres días. Se arma el Date con NÚMEROS, nunca con el texto:
   `new Date('2026-09-10')` es medianoche UTC, o sea el día anterior. */
function diasEntre(desde, hasta) {
  const arma = function (s) {
    return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  };
  return Math.round((arma(hasta) - arma(desde)) / 86400000) + 1;
}

/* ¿Cae en domingo? Se arma el Date con NÚMEROS por la misma razón
   que `diasEntre`: `new Date('2026-09-06')` es medianoche UTC y en
   México cae el día anterior — o sea que un domingo se leería como
   sábado y R52 no se aplicaría nunca. */
function esDomingoISO(iso) {
  const s = String(iso || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1,
    Number(s.slice(8, 10))).getDay() === 0;
}

function resumenDe(e) {
  const dias = diasEntre(e.salida, e.regreso);
  /* La unidad escogida va PRIMERO y con su nombre. El resumen es lo
     último que el cliente lee antes de decir que sí, y si ahí no
     aparece la unidad que acaba de escoger, parece que no se guardó —
     que fue lo que pasó cuando el dueño lo probó. */
  const suUnidad = e.unidadNombre ||
    (e.unidad === 'suburban' ? SUBURBAN.name
      : e.unidad === 'sprinter' ? SPRINTER.name : null);

  let t = (suUnidad ? '🚌 ' + suUnidad + (e.gente ? ' · ' + e.gente + ' pasajeros' : '') + '\n' : '') +
    '📍 ' + e.origen + ' → ' + e.destino + '\n' +
    '📅 ' + fechaEnPalabras(e.salida) + ' al ' + fechaEnPalabras(e.regreso) +
    '  (' + dias + (dias === 1 ? ' día' : ' días') + ')';
  if (e.recorridos > 0) {
    t += '\n🚐 ' + e.recorridos + (e.recorridos === 1 ? ' día' : ' días') +
      ' de recorrido, ' + HORAS_MOV[e.banda || 0].etiqueta.toLowerCase();
    if (e.lejos) t += ', lejos';
    /* El paseo se enseña aparte y con estrella: es lo que más mueve el
       precio de todo lo que se preguntó. Si el cliente lo escogió por
       error, aquí lo ve antes de que se le cobre. */
    if (e.paseo) t += '\n⭐ Con *' + e.paseo + '*';
  } else if (e.recorridos === 0) {
    t += '\n🚐 Sin recorridos, solo ida y vuelta';
  }
  return t;
}

/* Arma lo que se le pregunta en cada casilla, con sus opciones. Las
   opciones son las que en WhatsApp serán botones o lista, y por eso
   se respetan sus topes: 3 botones de 20 caracteres, o 10 filas de
   24. Hay una prueba que lo vigila. */
function pregunta(estado) {
  const e = estado;
  switch (e.paso) {
    case 'cuantos':
      /* Sin opciones a propósito: cualquier rango que ofreciera sería
         otra vez «más de 20». Lo que hace falta es el número. */
      return {
        texto: e.piso
          ? '¿Como cuántos van? 🤔\n\nCon el número te digo qué unidad les ' +
            'conviene — no es lo mismo un grupo de ' + (e.piso + 5) + ' que de ' +
            (e.piso * 2) + '.'
          : '¿Como cuántos van?\n\nUn número aproximado me basta.',
        opciones: []
      };
    /* ------------------------------------------------------------
       CUÁL DE LOS AUTOBUSES
       ------------------------------------------------------------
       Faltaba esta rama, y `pregunta` devolvía null: el bot tronaba
       entero al llegar a este paso por el camino largo. Es el mismo
       defecto que ya avisa el comentario de `alSiguienteHueco` —un
       paso nuevo sin su pregunta— y se pagó otra vez.

       Solo se enseñan las que de verdad le caben al grupo. Cada una
       con lo que la hace distinta, porque si no, escoger es echar
       un volado.
       ------------------------------------------------------------ */
    case 'elegirBus': {
      const caben = UNIDADES.filter(function (u) {
        return u.cat === 'autobus' && Number(e.gente || 0) <= Number(u.max);
      }).sort(porEscalon);

      return {
        texto: '¿En cuál los acomodo? 🚌\n\n' +
          caben.map(function (u) {
            /* El año va junto al nombre, no al final: es lo primero que
               distingue una unidad de otra cuando las dos traen aire y
               baño. Solo el i6S lo tiene capturado; las demás no
               enseñan año en vez de inventarlo. */
            return '*' + u.name + '* — ' + u.cap +
              (u.modelo ? ' · modelo ' + u.modelo : '') + '\n' +
              String(u.tag).replace(/^Autobús · /, '') +
              (u.amen && u.amen.length ? '. ' + u.amen.join(', ') + '.' : '');
          }).join('\n\n'),
        opciones: caben.map(function (u) { return u.name; })
      };
    }
    case 'elegirChica':
      return {
        texto: '¿La Sprinter o la Suburban?',
        opciones: ['La Sprinter', 'La Suburban']
      };
    case 'ajustar':
      return {
        texto: '¿Se acomodan en ' + SPRINTER.max + '?',
        opciones: ['Sí, somos ' + SPRINTER.max, 'Somos ' + (e.gente || 21)]
      };
    case 'destino':
      /* «Escríbeme la ciudad o el lugar» iba aquí abajo y se quitó el
         3-sep-2026, con la regla de forma del documento de ventas:
         máximo tres líneas, una sola pregunta. Ese renglón no decía
         nada que «¿a dónde van?» no dijera ya, y cada línea de más
         hace que la pregunta se lea menos.

         Es una instrucción defensiva, de cuando el bot leía peor. Hoy
         entiende «a chapala», «vamos a Tequila» y «puerto vallarta»
         igual de bien. */
      return { texto: '¿A dónde van? 📍', opciones: [] };
    case 'origen':
      return {
        texto: '¿De dónde salen?',
        opciones: ['Guadalajara', 'Tlaquepaque', 'Otro lugar']
      };
    case 'origenLibre':
      return { texto: '¿De qué ciudad salen?', opciones: [] };
    case 'salida':
      return {
        texto: '¿Qué día salen? 📅\n\nEscríbelo como quieras: *10 de septiembre*, ' +
          '*10/9* o *mañana*.',
        opciones: []
      };
    case 'regreso':
      return { texto: '¿Y qué día regresan?', opciones: [] };
    case 'recorridos': {
      const dias = diasEntre(e.salida, e.regreso);
      /* Nunca más días de recorrido que días de viaje, y la lista de
         WhatsApp aguanta 10 filas contando la de «ninguno». */
      const tope = Math.min(dias, 9);
      const ops = ['Ninguno'];
      for (let i = 1; i <= tope; i++) ops.push(i + (i === 1 ? ' día' : ' días'));
      return {
        /* ------------------------------------------------------------
           UNA PREGUNTA, NO DOS
           ------------------------------------------------------------
           Decía «¿van a usar la unidad para pasear o hacer recorridos?»
           y enseguida «¿cuántos días?». Dos signos de interrogación en
           un mensaje, que es lo que la regla de forma del guion de
           ventas prohíbe — y aquí ni siquiera eran dos preguntas: los
           botones («Ninguno», «1 día», «2 días») contestan las dos de
           un golpe.

           Y va con el beneficio ANTES de preguntar, que es la otra
           regla del guion: el cliente no sabe que el chofer se queda
           con ellos sin costo extra, y ése es justo el dato que hace
           que quiera los recorridos.
           ------------------------------------------------------------ */
        texto: 'El operador se queda con ustedes todo el viaje 🚐\n\n' +
          '¿Cuántos días quieren usar la unidad para pasear allá?',
        opciones: ops
      };
    }
    case 'paseo': {
      const ops = paseosDe(e.destino) || [];
      return {
        texto: 'En *' + e.destino + '* tenemos estos paseos 👇\n\n' +
          ops.map(function (o) { return '• ' + o; }).join('\n') +
          '\n\n¿Van a alguno? Si no, dime *ninguno* y contamos recorridos normales.',
        /* «Ninguno» va al final y no al principio: primero se enseña lo que
           sí se ofrece. Con los tres de CDMX son cuatro filas, y WhatsApp
           aguanta diez. */
        opciones: ops.concat(['Ninguno'])
      };
    }
    case 'lejos':
      return {
        texto: 'Esos recorridos, ¿son por la zona o se van lejos?\n\n' +
          'Lejos es *más de 80 km* — como irse a otra ciudad y volver.',
        opciones: ['Por la zona', 'Nos vamos lejos']
      };
    /* ------------------------------------------------------------
       PEDIR CONSEJO, NO OPINIÓN
       ------------------------------------------------------------
       De la investigación del dueño, y es contraintuitivo: pedir
       CONSEJO acerca psicológicamente al otro, pedir OPINIÓN lo
       aleja. Quien opina te evalúa; quien aconseja se pone de tu
       lado.

       «¿Cuántas horas al día?» es un formulario. «¿Tú qué dices?»
       es un vendedor tanteando con el cliente — y contesta lo
       mismo, con los mismos botones.
       ------------------------------------------------------------ */
    case 'horas':
      return {
        texto: '¿Tú qué dices, cuántas horas al día les alcanza?',
        opciones: HORAS_MOV.map(function (h) { return h.etiqueta; })
      };
    case 'confirmar':
      return {
        texto: 'Déjame confirmar 👇\n\n' + resumenDe(e) + '\n\n¿Todo bien?',
        opciones: ['Sí, cotizar', 'Cambiar algo']
      };
    case 'cambiar':
      return {
        texto: '¿Qué cambiamos?',
        opciones: ['El destino', 'De dónde salen', 'Las fechas', 'Los recorridos']
      };
  }
  return null;
}

/* ------------------------------------------------------------
   Hace la pregunta de la casilla en la que quedó, y antes acusa
   recibo de lo que acaba de contestar.

   Ese acuse no es adorno: en una conversación de verdad uno
   repite lo que oyó antes de seguir —«Chapala, va»— y así el
   otro se entera de inmediato si entendiste mal, en vez de
   descubrirlo hasta el final. Sin él, el bot se siente un
   formulario que no escucha.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   AL PRIMER HUECO QUE QUEDE
   ------------------------------------------------------------
   Decide en qué casilla sigue la conversación mirando qué falta,
   NO suponiendo por dónde venía.

   Vive aquí, en un solo lugar, porque tenerla dos veces ya costó:
   el paso de origen decidía por su cuenta `e.salida ? 'confirmar'
   : 'salida'` —sin revisar el regreso—. Mientras el bot siempre
   preguntaba en el mismo orden, eso nunca fallaba. En cuanto el
   lector de frases de un jalón empezó a llenar casillas salteadas,
   una conversación con salida pero sin regreso llegaba a
   `confirmar` y **tronaba el bot completo** (2-sep-2026).

   Regla que salió de ahí: el siguiente paso se calcula de lo que
   FALTA, y esa cuenta se hace en una sola función.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   ¿ESTE VIAJE VA EN AUTOBÚS?
   ------------------------------------------------------------
   Se mira `unidad` si ya está puesta, y si no, el número de
   gente. Hacía falta las dos formas: por el camino largo —destino,
   fechas y luego «somos 50»— la unidad NO se guarda, solo la
   gente, y con eso la elección de autobús nunca se disparaba.

   Se cazó probándolo a mano hasta el final: el cliente contestaba
   «Irizar i6S» y el bot lo guardaba como su ORIGEN.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   EN QUÉ ORDEN SE ENSEÑAN LOS AUTOBUSES
   ------------------------------------------------------------
   Los escalones son del dueño, dictados el 4-sep-2026:

     Century → PB → Neobus → premium (i6, i6S, G8)

   Se enseñan de MEJOR a más sencillo, y dentro del mismo escalón,
   la más nueva primero. Antes salían ordenadas por capacidad y con
   eso lo más nuevo del parque —el G8 de 2026— quedaba hasta abajo
   de una lista de seis, donde ya nadie lee.

   Ordenar no es recomendar: el bot NO le dice cuál escoger. Enseña
   las que le caben, con lo que las distingue, y el cliente decide.
   Empujarlo a la más cara sería vender por el precio y no por lo
   que le sirve — y el que lo siente, no vuelve.
   ------------------------------------------------------------ */
const ESCALONES = { 'Clásico': 1, 'Turismo': 2, 'Gran Turismo': 3, 'Premium': 4 };

function escalonDe(u) {
  return ESCALONES[String(u.tag || '').replace(/^Autobús · /, '')] || 0;
}

function porEscalon(a, b) {
  const d = escalonDe(b) - escalonDe(a);
  if (d !== 0) return d;
  const anio = Number(b.modelo || 0) - Number(a.modelo || 0);
  if (anio !== 0) return anio;
  return Number(b.max) - Number(a.max);
}

/* ------------------------------------------------------------
   «NOSOTROS TAMBIÉN SOMOS DE AQUÍ»
   ------------------------------------------------------------
   El principio de UNIDAD, de la investigación que trajo el dueño:
   compartir identidad pesa más que caer bien. No es «qué amable
   el vendedor», es «éste es de los míos».

   Y aquí es verdad, que es lo único que lo hace usable: Eurotravel
   está en Tlaquepaque. Cuando el cliente sale de la zona
   metropolitana de Guadalajara, son paisanos de hecho.

   POR ESO SE COMPRUEBA EL ORIGEN Y NO SE DICE SIEMPRE. A alguien
   que sale de Monterrey decirle «también somos de aquí» es una
   mentira que se cacha sola, y de las que cuestan la venta entera.

   Sale UNA vez, al acusar el origen, y no se vuelve a mencionar:
   repetido deja de ser identidad compartida y se vuelve muletilla.
   ------------------------------------------------------------ */
const POR_AQUI = /guadalajara|tlaquepaque|zapopan|tonala|tonalá|tlajomulco|\bgdl\b|zapopan|san pedro/i;

function unidadTapatia(origen) {
  return POR_AQUI.test(String(origen || '')) ? ' Somos de por acá también.' : '';
}

function esDeAutobus(e) {
  if (e.unidad) return e.unidad === 'autobus';
  return Number(e.gente || 0) > Number(SPRINTER.max);
}

function alSiguienteHueco(e) {
  /* ------------------------------------------------------------
     EL ORDEN · §2 del guion, cambiado el 2-sep-2026
     ------------------------------------------------------------
     destino → salida → regreso → cuántos → de dónde → recorridos

     Antes «cuántos van» iba PRIMERO, y el motivo era técnico: sin
     saber cuántos son no se sabe qué unidad, y sin unidad no se
     sabe si el precio se puede dar aquí. Correcto, pero ése es el
     orden del sistema, no el de una conversación.

     El destino manda porque es lo único que el cliente ya tiene
     decidido cuando escribe —cuántos van todavía lo está
     contando— y porque revela la OCASIÓN, que después decide todo
     el discurso.

     **Lo que cuesta, dicho de frente:** un grupo de 45 contesta
     tres preguntas antes de enterarse de que su precio lo pone
     una persona. Antes se enteraba a la primera. A cambio, los
     que sí caben en Sprinter —los que la página cobra sola—
     llegan al precio con la conversación ya cálida.
     ------------------------------------------------------------ */
  if (!e.destino) e.paso = 'destino';
  else if (!e.salida) e.paso = 'salida';
  else if (!e.regreso) e.paso = 'regreso';
  else if (!e.gente && !e.unidad) e.paso = 'cuantos';
  /* ------------------------------------------------------------
     Y SI ES AUTOBÚS, CUÁL AUTOBÚS
     ------------------------------------------------------------
     Faltaba por completo. Un grupo de 50 llegaba hasta el final
     como «autobús» a secas, y el dueño lo cachó:

       «no me dijo ni cuál unidad es, necesita seleccionar una
        unidad, no se puede quedar como autobús 50 personas»

     Hay CUATRO autobuses y no son el mismo: el i6S lleva 51 y el
     i6 lleva 47. «Autobús» ni siquiera dice si caben.

     Va DESPUÉS de saber cuántos son —antes no se sabe cuáles le
     caben— y ANTES del origen, porque escoger unidad es la parte
     que emociona y las direcciones son trámite. Lo que emociona
     primero.

     Solo para autobús. La Sprinter es una sola y la Suburban ya
     se escoge en `recomienda`.
     ------------------------------------------------------------ */
  else if (!e.unidadNombre && esDeAutobus(e) &&
           UNIDADES.some(function (u) {
             return u.cat === 'autobus' && (e.gente || 0) <= Number(u.max);
           })) e.paso = 'elegirBus';
  else if (!e.origen) e.paso = 'origen';
  /* R22: el viaje de un día no paga movimientos, así que ni se
     preguntan. */
  else if (diasEntre(e.salida, e.regreso) === 1) { e.recorridos = 0; e.paso = 'confirmar'; }
  else if (typeof e.recorridos !== 'number') e.paso = 'recorridos';
  else e.paso = 'confirmar';
  return e;
}

function siguiente(e, acuse) {
  const p = pregunta(e);
  return {
    texto: (acuse ? acuse + '\n\n' : '') + p.texto,
    opciones: p.opciones, pasa: false, estado: e
  };
}

function pasoDeCotizacion(t, crudo, estado, hoy) {
  const e = Object.assign({}, estado);
  const dicho = String(crudo).trim();

  if (tiene(t, ['cancelar', 'olvidalo', 'ya no', 'mejor no'])) {
    return { texto: 'Listo, lo dejamos ahí 👍\n\n¿Te ayudo con algo más?',
      pasa: false, estado: null, opciones: [] };
  }

  /* ---- ¿cuántos son, de verdad? ---- */
  if (e.paso === 'cuantos') {
    const n = cuantaGente(t) || (t.match(/^\s*(\d{1,3})\s*$/) ? Number(RegExp.$1) : null);
    if (!n) {
      /* Se vuelve a preguntar DISTINTO. Repetir la misma frase palabra
         por palabra es lo que más delata a un robot, y además no ayuda:
         si no se entendió la primera vez, decirlo igual no arregla nada. */
      return {
        texto: 'Perdón, no me quedó claro 🙈\n\nNada más el número: ¿son como *30*? ' +
          '¿*45*? Lo que sea, aunque no sea exacto.',
        pasa: false, estado: e, opciones: []
      };
    }
    const r = recomienda(n, e);
    return { texto: r.texto, pasa: false, estado: r.estado, opciones: r.opciones };
  }

  /* ---- ¿Sprinter o Suburban? ---- */
  if (e.paso === 'elegirChica') {
    if (/suburban/.test(t)) {
      e.unidad = 'suburban';
    } else if (/sprinter/.test(t)) {
      e.unidad = 'sprinter';
    } else {
      return siguiente(e);
    }
    e.paso = 'destino';
    const p = siguiente(e);
    return {
      texto: 'Va, la *' + (e.unidad === 'suburban' ? SUBURBAN.name : SPRINTER.name) + '*.\n\n' +
        (e.unidad === 'suburban'
          ? 'Ése te lo confirmo yo en unos minutos; déjame juntar los datos para no ' +
            'hacerte esperar 👇\n\n'
          : '') + p.texto,
      pasa: false, estado: p.estado, opciones: p.opciones
    };
  }

  /* ------------------------------------------------------------
     ¿CUÁL DE LOS AUTOBUSES?
     ------------------------------------------------------------
     Se compara contra los nombres de verdad, no contra palabras
     sueltas. «i6» está DENTRO de «i6S», así que si se buscara con
     `indexOf` el que pide el i6S se llevaría el i6 — 47 lugares
     para un grupo de 51.

     Por eso se recorren de mayor a menor nombre y se toma la
     primera coincidencia exacta de palabra; `esLaPalabra` además
     aguanta que lo escriban mal, que es lo normal con un nombre
     que nadie ha visto escrito.
     ------------------------------------------------------------ */
  if (e.paso === 'elegirBus') {
    const buses = UNIDADES.filter(function (u) {
      return u.cat === 'autobus' && (e.gente || 0) <= Number(u.max);
    });
    /* Los nombres largos primero: «Irizar i6S» antes que «Irizar i6». */
    const porNombre = buses.slice().sort(function (a, b) {
      return b.name.length - a.name.length;
    });

    let elegido = null;
    for (let i = 0; i < porNombre.length && !elegido; i++) {
      const suyo = normaliza(porNombre[i].name);
      /* Sin la palabra «irizar», que la tienen tres y no distingue. */
      const clave = suyo.replace(/^irizar\s*/, '');
      if (t.indexOf(suyo) !== -1) elegido = porNombre[i];
      else if (new RegExp('\\b' + clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t)) {
        elegido = porNombre[i];
      }
    }

    if (!elegido) {
      /* No dijo un autobús. Antes de insistir, se mira si dijo OTRA
         cosa útil —el destino, una fecha, de dónde salen—: es la misma
         trampa del paso del destino, donde «somos 50» se guardaba como
         nombre de un lugar. La gente no contesta la pregunta que le
         hiciste, contesta lo que trae en la cabeza. */
      const otro = leeDeUnJalon(crudo, hoy);
      if (otro.destino || otro.salida || otro.gente) {
        if (otro.destino && !e.destino) e.destino = otro.destino;
        if (otro.salida && !e.salida) e.salida = otro.salida;
        if (otro.regreso && !e.regreso) e.regreso = otro.regreso;
        if (otro.gente) e.gente = otro.gente;
        alSiguienteHueco(e);
        return siguiente(e, 'Anotado 👍');
      }

      /* Ahora sí: no se entendió cuál. NO se escoge por él — un autobús
         mal escogido es un grupo que no cabe. */
      return {
        texto: '¿Cuál de esos te late? 🚌',
        pasa: false, estado: e,
        opciones: buses.map(function (u) { return u.name; })
      };
    }

    e.unidad = 'autobus';
    e.unidadNombre = elegido.name;
    alSiguienteHueco(e);
    const p = siguiente(e);
    return {
      texto: 'Va, el *' + elegido.name + '* — ' + elegido.cap + ' 🚌\n\n' +
        'Ése te lo confirmo yo directo; déjame juntar los datos para no ' +
        'hacerte repetir nada 👇\n\n' + p.texto,
      pasa: false, estado: p.estado, opciones: p.opciones
    };
  }

  /* ---- ¿se acomodan en 20? ---- */
  if (e.paso === 'ajustar') {
    /* «Sí, somos 20» contra «Somos 23». Se mira el número que dijo, no
       el sí o el no: los dos botones empiezan distinto pero lo que
       decide es cuántos son. */
    const n = cuantaGente(t);
    const cabe = /^si/.test(t) || (n !== null && n <= Number(SPRINTER.max));
    e.unidad = cabe ? 'sprinter' : 'autobus';
    if (n !== null) e.gente = cabe ? Number(SPRINTER.max) : n;
    e.paso = 'destino';
    const p = siguiente(e);
    return {
      texto: (cabe
        ? '¡Perfecto! Con ' + SPRINTER.max + ' les va la *' + SPRINTER.name +
          '* y te saco el precio ahorita 👇'
        : 'Sin problema, les va un *autobús*. Déjame juntar los datos para que una ' +
          'persona te pase el precio rápido 👇') + '\n\n' + p.texto,
      pasa: false, estado: p.estado, opciones: p.opciones
    };
  }

  /* ---- a dónde ---- */
  if (e.paso === 'destino') {
    /* ------------------------------------------------------------
       LO QUE ESCRIBIÓ PUEDE NO SER UN DESTINO
       ------------------------------------------------------------
       El bot pregunta «¿a dónde va el plan?» y el cliente contesta
       «somos 50». Antes eso se guardaba COMO DESTINO, tal cual: el
       bot decía «*somos 50*, va 📍» y seguía a la fecha con un
       destino que no existe. De ahí en adelante todo salía mal.

       Lo cachó el dueño a la primera que lo probó, y con razón: es
       de las respuestas más normales que hay a esa pregunta. La
       gente no contesta la pregunta que le hiciste, contesta lo
       que trae en la cabeza.

       `leeDeUnJalon` ya sabe leer una frase entera. Si de aquí sale
       gente, una fecha o una unidad y NO un destino, se aplica eso
       y se vuelve a preguntar lo que falta — sin regañar y sin
       tirar lo que sí dijo.

       ------------------------------------------------------------
       Y SI SÍ TRAE DESTINO, TAMBIÉN SE APROVECHA — 4-sep-2026
       ------------------------------------------------------------
       Esto estaba escrito para el caso de que NO hubiera destino, y
       cuando sí lo había se caía de largo hasta `limpiaDestino(dicho)`,
       que recorta la frase por los bordes pero no busca el lugar. Con
       la respuesta más normal que existe a «¿a dónde van?»:

         «somos 45 personas y queremos ir a puerto vallarta el 20 de
          octubre, salimos de guadalajara»

       el bot guardaba como destino LA FRASE ENTERA —contestaba
       «*Somos 45 Personas y Queremos Ir a Puerto Vallarta el 20 de
       Octubre, Salimos de Guadalajara*, va 📍»— y tiraba a la basura
       las 45 personas, la fecha y el origen que venían en el mismo
       renglón. Enseguida preguntaba «¿qué día salen?», que el cliente
       ACABABA de decir, y tomaba el «regresamos el 22» como salida.

       Y no avisaba a nadie: el bot creía que había entendido, así que
       ni ticket ni aviso. Se cazó leyendo una conversación con el
       comando `ver`, que es exactamente para lo que se hizo.

       El arreglo es de clase, no de caso: lo que `leeDeUnJalon`
       encuentre se guarda SIEMPRE, haya destino o no. Antes se
       guardaba solo cuando faltaba el destino, que es justo cuando
       menos datos hay.
       ------------------------------------------------------------ */
    const leido = leeDeUnJalon(crudo, hoy);

    if (leido.gente) e.gente = leido.gente;
    if (leido.unidad) e.unidad = leido.unidad;
    if (leido.salida) e.salida = leido.salida;
    if (leido.regreso) e.regreso = leido.regreso;
    /* El origen no se pisa: si ya venía de antes, ése es el bueno. */
    if (leido.origen && !e.origen) e.origen = leido.origen;

    if (!leido.destino && (leido.gente || leido.salida || leido.unidad)) {
      if (leido.gente) e.gente = leido.gente;
      if (leido.unidad) e.unidad = leido.unidad;
      if (leido.salida) e.salida = leido.salida;
      if (leido.regreso) e.regreso = leido.regreso;
      /* El destino sigue pendiente, así que se vuelve a él — pero
         acusando lo que sí entendió, para que se note que se leyó. */
      e.paso = 'destino';
      const que = leido.gente ? 'Son *' + leido.gente + '*'
        : leido.salida ? 'El *' + fechaEnPalabras(leido.salida) + '*'
          : 'Va';
      return {
        texto: que + ', anotado 👍\n\n¿Y a dónde van?',
        pasa: false, estado: e, opciones: []
      };
    }

    if (dicho.length < 3) {
      return {
        texto: 'No alcancé a leer el lugar 🙈 ¿A qué ciudad van?',
        pasa: false, estado: e, opciones: []
      };
    }
    /* La ocasión se lee del texto CRUDO, antes de recortarlo: es
       justo la parte que `limpiaDestino` se va a llevar. */
    /* Si el buscador de destinos encontró el lugar dentro de la frase,
       ÉSE es el destino. `limpiaDestino` solo recorta por los bordes
       —«a Chapala» → «Chapala»—; no sabe buscar en medio de un
       párrafo, y ahí es donde la gente escribe. Se le pasa igual por
       encima para que un lugar que no está en el catálogo se siga
       viendo bien escrito. */
    e.destino = (leido.destino
      ? limpiaDestino(leido.destino)
      : limpiaDestino(dicho)).slice(0, 120);
    /* La ocasión sale de aquí: del destino, y de lo que el cliente
       haya escrito al decirlo —«vamos a Tequila de despedida»—. No
       se le pregunta nunca: preguntar «¿para qué es el viaje?» suena
       a formulario, y de todos modos casi siempre ya lo dijo.

       Si ya venía puesta de antes no se pisa: la primera señal es la
       buena, y el destino no debe sobrescribir una boda. */
    if (!e.ocasion) e.ocasion = ocasionDe(crudo, e.destino);
    const acuse = ACUSE_DE_OCASION[e.ocasion]
      ? '*' + e.destino + '*, va 📍 ' + ACUSE_DE_OCASION[e.ocasion]
      : '*' + e.destino + '*, va 📍';
    /* Decidía a mano «origen o confirmar», que era correcto cuando el
       destino iba al final. Con el orden nuevo el siguiente hueco puede
       ser la fecha, así que se calcula en un solo lugar. */
    alSiguienteHueco(e);
    return siguiente(e, acuse);
  }

  /* ---- de dónde ---- */
  if (e.paso === 'origen' || e.paso === 'origenLibre') {
    if (e.paso === 'origen' && /otro/.test(t)) {
      e.paso = 'origenLibre';
      return siguiente(e);
    }
    if (dicho.length < 3) {
      return {
        texto: '¿De qué ciudad salen?', pasa: false, estado: e,
        opciones: e.paso === 'origen' ? pregunta(e).opciones : []
      };
    }
    e.origen = dicho.slice(0, 120);
    /* Antes decía `e.salida ? 'confirmar' : 'salida'` y se saltaba el
       regreso. Ver la nota de `alSiguienteHueco`. */
    alSiguienteHueco(e);
    return siguiente(e, 'Salen de *' + e.origen + '* 👍' + unidadTapatia(e.origen));
  }

  /* ---- cuándo ---- */
  if (e.paso === 'salida') {
    const f = fechaDe(crudo, hoy);
    if (!f) {
      return { texto: 'Esa fecha no la entendí 🙈\n\nEscríbela como *10 de septiembre* ' +
        'o *10/9*.', pasa: false, estado: e, opciones: [] };
    }
    e.salida = f;
    /* Si ya había regreso y quedó antes, se vuelve a preguntar. */
    if (e.regreso && e.regreso < f) e.regreso = null;
    alSiguienteHueco(e);
    return siguiente(e, 'Salen el *' + fechaEnPalabras(f) + '* 📅');
  }

  if (e.paso === 'regreso') {
    /* Las tres salidas de R52. Van ANTES de leer la fecha porque son
       respuestas a la pregunta que hizo R52, no fechas. Hay una prueba
       —«el bot entiende sus propios botones»— que le da de comer al bot
       cada opción que ofrece; si esto no estuviera, se quedaría en un
       bucle pidiendo una fecha que el cliente ya contestó. */
    if (/\bs[aá]bado\b/.test(t) && e.salida) {
      const sabado = masDias(e.salida, -1);
      e.salida = sabado; e.regreso = sabado; e.recorridos = 0;
      e.paso = 'confirmar';
      return siguiente(e, 'Va, lo movemos al *' + fechaEnPalabras(sabado) + '* 📅');
    }
    if (/\blunes\b/.test(t) && e.salida) {
      e.regreso = masDias(e.salida, 1);
      e.paso = 'recorridos';
      return siguiente(e, 'Va, se quedan a dormir y regresan el *' +
        fechaEnPalabras(e.regreso) + '* 📅');
    }
    if (/\bsprinter\b/.test(t) && e.salida) {
      e.unidad = 'sprinter';
      e.regreso = e.salida; e.recorridos = 0;
      e.paso = 'confirmar';
      return siguiente(e, 'Va, en *Sprinter* — ésa sí lo hace el domingo 🚐');
    }

    /* ------------------------------------------------------------
       «EL MISMO DÍA» ES UNA FECHA, NADA MÁS QUE ESCRITA CON LETRAS
       ------------------------------------------------------------
       Es de las respuestas más comunes que hay a esta pregunta, y
       caía en «esa fecha no la entendí»: el cliente se quedaba ahí
       dando vueltas hasta que se aburría.

       Se traduce a la fecha de salida y se deja seguir por el mismo
       camino de siempre. NO se atajan aquí los pasos que vienen
       después —y se pensó hacerlo—: por ahí abajo está R52, que
       frena el autobús en domingo. Un atajo que la brincara vendería
       un servicio que no existe, y eso no se corrige después.
       ------------------------------------------------------------ */
    const esElMismoDia = /\bmismo dia\b|\bese dia\b|\bel mismo\b|\bida y vuelta\b|\bvamos y (nos )?ven|\bsolo un dia\b|\bun solo dia\b/.test(t);

    const f = esElMismoDia && e.salida ? e.salida : fechaDe(crudo, hoy);
    if (!f) {
      return { texto: 'Esa fecha no la entendí. ¿Qué día regresan?',
        pasa: false, estado: e, opciones: [] };
    }
    if (f < e.salida) {
      return {
        texto: 'El regreso queda antes de la salida 🤔\n\nSalen el *' +
          fechaEnPalabras(e.salida) + '*. ¿Qué día vuelven?',
        pasa: false, estado: e, opciones: []
      };
    }
    /* ------------------------------------------------------------
       R52 · UN AUTOBÚS NO HACE IDA Y VUELTA EL MISMO DOMINGO
       ------------------------------------------------------------
       Dictado el 2-sep-2026: «el bot no puede vender dominicales con
       bus, no se puede un bus 1 día en domingo». Es de operación, no
       de precio.

       `api/_tarifa.js` ya impedía que un autobús agarrara la TARIFA
       dominical —solo la Sprinter la toma—. Lo que faltaba era esto:
       que el bot no lo OFREZCA. Sin la regla, el viaje seguía de
       largo, se cotizaba como un día cualquiera y se le armaba al
       vendedor la solicitud de un servicio que no existe.

       Dar un precio equivocado se corrige; prometer algo que no se
       puede dar, no. Por eso se corta aquí y con salidas concretas,
       no con un «no se puede» a secas. */
    if (e.unidad === 'autobus' && f === e.salida && esDomingoISO(f)) {
      const cabenEnSprinter = (e.gente || 0) <= SPRINTER.max;
      return {
        texto: 'Ahí sí te tengo que parar 🙌\n\nEn autobús no manejamos ida y ' +
          'vuelta el mismo domingo.\n\n¿Cuál te sirve?',
        pasa: false, estado: e,
        opciones: cabenEnSprinter
          ? ['Nos vamos el sábado', 'Regresamos el lunes', 'En Sprinter']
          : ['Nos vamos el sábado', 'Regresamos el lunes']
      };
    }

    e.regreso = f;
    const dias = diasEntre(e.salida, f);
    /* R22: el viaje de un día no cobra movimientos, así que preguntarlos
       sería pedirle un dato al cliente para después ignorarlo. Se salta
       la casilla y se deja en cero. */
    if (dias === 1) {
      e.recorridos = 0;
      alSiguienteHueco(e);
      return siguiente(e, 'Van y vuelven el mismo día, perfecto 👍');
    }
    alSiguienteHueco(e);
    return siguiente(e, 'Entonces son *' + dias + ' días* de viaje.');
  }

  /* ---- recorridos ---- */
  if (e.paso === 'recorridos') {
    let n = null;
    if (/ningun|no\b|nada|solo ida|ninguna/.test(t)) n = 0;
    else {
      const m = t.match(/(\d{1,2})/);
      if (m) n = Number(m[1]);
    }
    if (n === null || n < 0) return siguiente(e);
    const tope = diasEntre(e.salida, e.regreso);
    if (n > tope) {
      return {
        texto: 'El viaje dura *' + tope + (tope === 1 ? ' día' : ' días') +
          '*, así que no pueden ser más recorridos que eso. ¿Cuántos días?',
        pasa: false, estado: e, opciones: pregunta(e).opciones
      };
    }
    e.recorridos = n;
    if (n === 0) {
      e.paso = 'confirmar';
      return siguiente(e, 'Va, solo el traslado 👍');
    }
    /* Si el destino tiene paseos con nombre, se ofrecen ANTES de las horas:
       un paseo trae su propio precio y su propia duración, así que
       preguntarle las horas primero sería preguntar de más. */
    e.paso = paseosDe(e.destino) ? 'paseo' : 'lejos';
    return siguiente(e, n + (n === 1 ? ' día' : ' días') + ' de paseo, anotado 🚐');
  }

  /* ---- ¿alguno de los paseos con nombre? ---- */
  if (e.paso === 'paseo') {
    const ops = paseosDe(e.destino) || [];
    if (/ningun|no\b|nada|normales/.test(t)) {
      e.paseo = null;
    } else {
      let escogido = null;
      for (let i = 0; i < ops.length && !escogido; i++) {
        if (esLaPalabra(t, normaliza(ops[i])) ||
            palabrasDe(t).some(function (p) { return esLaPalabra(p, normaliza(ops[i].split(' ').pop())); })) {
          escogido = ops[i];
        }
      }
      if (!escogido) return siguiente(e);
      e.paseo = escogido;
    }
    e.paso = 'lejos';
    return siguiente(e, e.paseo ? '*' + e.paseo + '*, anotado ✅' : 'Va, recorridos normales.');
  }

  /* ---- ¿dentro de 80 km? ---- */
  if (e.paso === 'lejos') {
    if (/lejos|otra ciudad|fuera|si\b/.test(t)) e.lejos = true;
    else if (/zona|cerca|aqui|no\b/.test(t)) e.lejos = false;
    else return siguiente(e);
    e.paso = 'horas';
    return siguiente(e, e.lejos ? 'Recorridos largos, anotado.' : 'Por la zona, va.');
  }

  if (e.paso === 'horas') {
    let b = null;
    if (/todo|12|doce/.test(t)) b = 2;
    else if (/10|diez/.test(t)) b = 1;
    else if (/8|ocho/.test(t)) b = 0;
    if (b === null) {
      return {
        /* Se le vuelve a preguntar con las mismas palabras que la
           primera vez —pidiendo consejo, no dato— para que no suene a
           que el formulario se enojó. */
        texto: '¿Tú qué dices, cuántas horas al día les alcanza?',
        pasa: false, estado: e, opciones: pregunta(e).opciones
      };
    }
    e.banda = b;
    e.paso = 'confirmar';
    return siguiente(e);
  }

  /* ---- confirmar ---- */
  if (e.paso === 'confirmar') {
    if (/cambiar|no\b|corregi|modificar/.test(t)) {
      e.paso = 'cambiar';
      return siguiente(e);
    }
    /* Cualquier otra cosa se toma como que sí: es lo que quiso decir
       quien contesta «va», «sale», «dale» o «ok». */
    const movimientos = [];
    for (let i = 0; i < (e.recorridos || 0); i++) {
      const m = { horaInicio: '08:00', horaFin: HORAS_MOV[e.banda || 0].fin };
      /* Los km solo se mandan cuando el cliente dijo que se van lejos. Si
         no lo dijo, NO se inventa un número: sin `km` el motor cobra la
         banda de horas de siempre. */
      if (e.lejos) m.km = 120;
      /* El paseo con nombre va en UN día, el primero. Es un producto que
         se hace una vez, no todos los días del viaje. */
      if (e.paseo && i === 0) m.paseo = e.paseo;
      movimientos.push(m);
    }

    /* ------------------------------------------------------------
       LO QUE NO SE COTIZA SOLO
       ------------------------------------------------------------
       Autobús y Suburban no tienen `cotizadorAutomatico`, así que el
       precio lo pone una persona. Pero el cliente ya contestó todo:
       sería una grosería —y una venta perdida— mandarlo a empezar de
       nuevo por teléfono.

       Se le entrega la solicitud armada. Quien conteste solo pone el
       precio, que es justo lo que pidió el dueño.
       ------------------------------------------------------------ */
    if (e.unidad && e.unidad !== 'sprinter') {
      return {
        texto: textoDeSolicitud(e),
        pasa: true,
        estado: null,
        opciones: ['Enviar por WhatsApp', 'Cotizar otro'],
        solicitud: {
          unidad: e.unidad, gente: e.gente || null,
          origen: e.origen, destino: e.destino,
          salida: e.salida, regreso: e.regreso,
          recorridos: e.recorridos || 0,
          horas: e.recorridos ? HORAS_MOV[e.banda || 0].etiqueta : null,
          /* Para el ticket de WhatsApp: los días ya calculados —para no
             hacer la cuenta dos veces— el paseo, y si es agencia. */
          dias: diasEntre(e.salida, e.regreso),
          paseo: e.paseo || null,
          agencia: !!e.agencia
        }
      };
    }

    return {
      texto: 'Va, déjame sacar el precio…',
      pasa: false,
      estado: null,
      opciones: [],
      cotiza: {
        unidad: 'sprinter',
        origen: { direccion: e.origen },
        destino: { direccion: e.destino },
        salida: e.salida,
        regreso: e.regreso,
        redondo: true,
        movimientos: movimientos
      },
      /* Se guarda para poder repetirlo al dar el precio: el cliente
         tiene que ver QUÉ se cotizó, no solo cuánto. */
      resumen: {
        destino: e.destino, origen: e.origen, salida: e.salida, regreso: e.regreso,
        recorridos: e.recorridos || 0, horas: HORAS_MOV[e.banda || 0].etiqueta,
        paseo: e.paseo || null, lejos: !!e.lejos,
        /* Estos dos no cambian el precio: cambian cómo se cuenta.
           `gente` es para el ancla por persona y `ocasion` para saber
           contra qué comparar. Si falta cualquiera de los dos, esa
           parte del mensaje simplemente no sale. */
        gente: e.gente || 0,
        ocasion: e.ocasion || null,
        /* Su nombre, si WhatsApp lo mandó. Viaja hasta aquí para que
           el cierre pueda decir «¿te la aparto, Marisol?» — que es el
           único lugar donde se usa, a propósito. */
        nombre: e.nombre || null,
        /* Y cuál unidad escogió, para poder enseñarle su foto con el
           precio: «ésta es la que les tocaría». */
        unidadNombre: e.unidadNombre || null,
        unidad: e.unidad || null,
        agencia: !!e.agencia
      }
    };
  }

  /* ---- corregir una casilla sin volver a empezar ---- */
  if (e.paso === 'cambiar') {
    if (/destino|donde van|a donde/.test(t)) { e.paso = 'destino'; e.destino = null; }
    else if (/salen|origen|de donde/.test(t)) { e.paso = 'origen'; e.origen = null; }
    else if (/fecha|dia|cuando/.test(t)) { e.paso = 'salida'; e.salida = null; e.regreso = null; }
    else if (/recorrid|pasear|movim/.test(t)) { e.paso = 'recorridos'; e.recorridos = null; e.banda = null; }
    else return siguiente(e);
    return siguiente(e);
  }

  return null;
}

/* ------------------------------------------------------------
   LA SOLICITUD ARMADA
   ------------------------------------------------------------
   Para lo que no se cotiza solo. Sale con todo lo que necesita
   quien vaya a poner el precio, en el orden en que lo va a
   buscar, y de una pieza para que el cliente pueda copiarla y
   pegarla en WhatsApp sin escribir nada.

   NO trae precio. Ese lo pone la persona (R12).
   ------------------------------------------------------------ */
function textoDeSolicitud(e) {
  const dias = diasEntre(e.salida, e.regreso);
  /* El nombre de la unidad que el cliente ESCOGIÓ, no la categoría.
     Decía «Autobús» a secas, y con eso quien recibía la solicitud no
     sabía si armar el i6S de 51 o el i6 de 47 — y tenía que volver a
     preguntárselo al cliente, que es justo lo que esta solicitud
     existe para evitar. */
  const queUnidad = e.unidadNombre ||
    (e.unidad === 'suburban' ? SUBURBAN.name : 'Autobús');

  return '📋 *Solicitud de cotización*\n\n' +
    '🚌 Unidad: ' + queUnidad + '\n' +
    (e.gente ? '👥 Pasajeros: ' + e.gente + '\n' : '') +
    '📍 Salen de: ' + e.origen + '\n' +
    '📍 Van a: ' + e.destino + '\n' +
    '📅 Salida: ' + fechaEnPalabras(e.salida) + '\n' +
    '📅 Regreso: ' + fechaEnPalabras(e.regreso) + '\n' +
    '🗓️ ' + dias + (dias === 1 ? ' día' : ' días') + ' de servicio\n' +
    '🚐 Recorridos: ' + (e.recorridos
      ? e.recorridos + (e.recorridos === 1 ? ' día' : ' días') + ', ' +
        HORAS_MOV[e.banda || 0].etiqueta.toLowerCase()
      : 'ninguno') + '\n\n' +
    'Ya tengo todo ✅\n\n' +
    'Mándale esto por WhatsApp al *' + TELEFONO + '* y te pasan el precio en ' +
    'un momento — no tienes que volver a explicar nada.';
}

/* ------------------------------------------------------------
   Arma el mensaje con el precio que devolvió `/api/cotizar`.
   El número entra tal cual del motor de cobro: aquí NO se
   calcula ni se redondea nada.
   ------------------------------------------------------------ */
function textoDeCotizacion(precio, resumen) {
  if (!precio || typeof precio.total !== 'number') {
    return {
      texto: 'Ese no me lo está dando el sistema 🙈\n\nMárcame al *' + TELEFONO +
        '* y te lo saco al momento.',
      pasa: true
    };
  }
  /* R45 · Ese viaje NO se sabe al 100 %, así que no se le pone precio.
     Dictado el 1-sep-2026: «si no sabes un precio al 100 % no se lo
     compartas al cliente; le dices que un vendedor lo va a contactar».

     Se promete el contacto, no se le pide que llame: quien se mueve somos
     nosotros. Y se le deja el teléfono por si prefiere no esperar. */
  if (precio.requiereAsesor) {
    return {
      texto: 'Ese viaje déjame confirmártelo bien 🙌\n\n' +
        'No te aviento un número al aire: prefiero darte el bueno.\n\n' +
        '*Hoy mismo te lo mando.* Y si lo necesitas ya, márcame al *' +
        TELEFONO + '*.',
      pasa: true,
      opciones: ['Hablar con alguien', 'Cotizar otro']
    };
  }

  const pesos = function (n) { return '$' + Number(n).toLocaleString('es-MX'); };
  const r = resumen || {};

  /* ------------------------------------------------------------
     EL ANCLA: CUÁNTO SALE POR PERSONA
     ------------------------------------------------------------
     $12,800 no dice nada; $800 cada uno sí. El cliente va a
     comparar ese número contra algo de todos modos, y si no se lo
     damos se lo inventa.

     Es una división, no un precio nuevo: el total sale tal cual
     del motor de cobro y aquí solo se reparte. Y se REDONDEA a la
     decena de arriba para no prometer un peso que luego no cuadre
     al repartir entre el grupo.

     Solo sale si sabemos cuántos van. Sin el número no se inventa
     uno: preferimos no poner el ancla a ponerla mal. */
  /* ------------------------------------------------------------
     A UNA AGENCIA, NADA DE ESTO
     ------------------------------------------------------------
     El precio por persona y la comparación —«y de regreso nadie
     tiene que manejar»— son para quien organiza su propio viaje.

     A una agencia le sobran las dos: ella no va, y ya sabe lo que
     cuesta un autobús. Decírselo la hace sentir que le están
     vendiendo humo, que es justo lo que la espanta.

     Lo que necesita es la ficha limpia para pegarla en su propia
     cotización. Por eso su versión es MÁS CORTA, no más larga.
     ------------------------------------------------------------ */
  const paraAgencia = !!r.agencia;

  let porPersona = '';
  const gente = Number(r.gente) || 0;
  if (!paraAgencia && gente > 1 && precio.total > 0) {
    porPersona = 'Entre ' + gente + ' son *' +
      pesos(Math.ceil(precio.total / gente / 10) * 10) + ' por persona*\n';
  }

  /* La comparación contra la alternativa real, según la ocasión.
     Si no se detectó ocasión no se pone nada: una comparación
     genérica —«sale más barato que en coche»— es justo el relleno
     que hace que un anuncio se lea como anuncio. */
  const comparacion = (!paraAgencia && COMPARACION[r.ocasion])
    ? COMPARACION[r.ocasion] + '\n' : '';

  /* ------------------------------------------------------------
     EL IVA NO SE NOMBRA, PERO SE COBRA IGUAL
     ------------------------------------------------------------
     Aclarado por el dueño el 31-ago-2026: «no quiero que no lo
     cobres, solo no lo menciones».

     Esto estuvo mal una vez y hay que dejarlo escrito. Primero se
     entendió «por WhatsApp no cobres IVA» como quitarle el 16 % al
     precio —sus precios de lista YA lo traen dentro, así que no
     cobrarlo habría sido cobrar menos—. Chapala 3 días habría
     pasado de $9,000 a $7,759: **$1,241 menos por viaje**.

     No es eso. El precio es el MISMO que en la página. Lo único
     que cambia es que aquí no se dice «IVA incluido», porque por
     este canal no se factura.

     Por eso los montos entran TAL CUAL del motor de cobro y aquí
     no se divide ni se multiplica nada.
     ------------------------------------------------------------ */
  return {
    /* La unidad que ESCOGIÓ, no «Sprinter» escrito a mano. Hoy casi
       siempre es la Sprinter —es la única que se cotiza sola— pero
       escribirlo fijo es una mentira esperando el día que se cotice
       un autobús: el cliente escogería el i6S y leería «Sprinter,
       hasta 20 pasajeros» encima de su precio. */
    texto: '🚐 *' + (unidadDelResumen(r) || SPRINTER.name + ' · hasta 20 pasajeros') + '*\n\n' +
      (r.origen ? '📍 ' + r.origen + ' → ' + r.destino + '\n' : '') +
      /* El «al [regreso]» solo si hay regreso. Sin esta guarda,
         `fechaEnPalabras(undefined)` tronaba y se caía el mensaje del
         precio entero — el mensaje que más importa de la conversación.
         Lo destapó una prueba al pasar salida sin regreso. */
      (r.salida
        ? '📅 ' + fechaEnPalabras(r.salida) +
          (r.regreso ? ' al ' + fechaEnPalabras(r.regreso) : '') + '\n'
        : '') +
      '🗓️ ' + precio.dias + (precio.dias === 1 ? ' día' : ' días') + ' de servicio\n' +
      (r.recorridos ? '🚐 ' + r.recorridos + (r.recorridos === 1 ? ' día' : ' días') +
        ' de recorrido (' + String(r.horas).toLowerCase() +
        (r.lejos ? ', lejos' : '') + ')\n' : '') +
      (r.paseo ? '⭐ Con ' + r.paseo + '\n' : '') +
      /* El anticipo ya NO va aquí arriba: lo dice el cierre. Estaba las
         dos veces —«Para apartar: $3,000» y luego «con $3,000 te
         bloqueo»— y repetir una cifra la hace sonar a trámite. */
      '\n*Total: ' + pesos(precio.total) + '*\n' +
      porPersona + '\n' +
      'Incluye operador, combustible, casetas y seguro de viajero.\n' +
      comparacion +
      '\n' + (paraAgencia
        /* De colega a colega: el dato y la pregunta. Sin nombrarle su
           destino ni su fecha —eso es para el que va— y sin cierre
           asumido, que a quien compra seguido le suena a técnica. */
        ? 'Anticipo *' + pesos(precio.anticipo) + '* para bloquear la fecha, ' +
          'el resto antes de salir.\n\n¿Te la aparto?'
        : cierreDelPrecio(precio.anticipo, precio.saldo, r, pesos)),
    pasa: false,
    /* ------------------------------------------------------------
       EFECTO DOTACIÓN · «ésta es la que les tocaría»
       ------------------------------------------------------------
       De la investigación del dueño: una vez que el cliente ve la
       unidad y piensa «mi Sprinter», ya la siente suya — y lo que
       uno siente suyo cuesta más trabajo soltarlo. El bot tenía 58
       fotos y solo las enseñaba si se las pedían.

       Va JUNTO al precio, que es el momento en que el cliente está
       decidiendo, y no antes: enseñar fotos a quien todavía no sabe
       cuánto cuesta es enseñarle un catálogo.

       A la agencia NO se le mandan. Quien revende ya sabe cómo se
       ven las unidades y lo que quiere es el número; llenarle el
       chat de fotos es hacerle perder el tiempo. Si las necesita,
       las pide — y ahí sí se las damos.
       ------------------------------------------------------------ */
    medios: paraAgencia ? null : mediosDe(r.unidadNombre
      ? (porNombre(r.unidadNombre) || {}).id
      : (r.unidad || 'sprinter')),
    opciones: paraAgencia
      ? ['Sí, apártamela', 'Condiciones de agencia', 'Mándame el seguro']
      : ['Sí, apártamela', 'Está caro', 'Lo checo con el grupo']
  };
}

/* Busca una unidad por su nombre exacto. Hace falta porque el resumen
   guarda el NOMBRE que escogió el cliente —«Irizar i6S»— y `mediosDe`
   trabaja con el id —«irizar-i6s»—. Sin esto, al que escogió el i6S se
   le enseñaba la foto de otro camión. */
function porNombre(nombre) {
  const n = normaliza(nombre);
  return UNIDADES.filter(function (u) { return normaliza(u.name) === n; })[0] || null;
}

/* Cómo se llama la unidad de este viaje, para el encabezado del precio.
   Devuelve null si no se sabe, y quien llama pone lo de siempre. */
function unidadDelResumen(r) {
  const u = (r && r.unidadNombre && porNombre(r.unidadNombre)) ||
    (r && r.unidad && porId(r.unidad === 'autobus' ? 'irizar-i6s' : r.unidad));
  return u ? u.name + ' · hasta ' + u.max + ' pasajeros' : null;
}

/* ------------------------------------------------------------
   LA ENVOLTURA QUE RECUERDA QUE ES AGENCIA
   ------------------------------------------------------------
   `respuestaBase` tiene una veintena de puntos de salida y marcar
   la bandera en cada uno seria pedir que un dia se olvide en el
   nuevo. Se marca AQUI, una sola vez, sobre lo que sea que salga.

   Y se hereda: si dijo «pax» en el primer mensaje, sigue siendo
   agencia aunque despues escriba como cualquiera.
   ------------------------------------------------------------ */
function respuestaA(mensaje, estado, hoy) {
  const esDeAgencia = (estado && estado.agencia === true) ||
    esAgencia(mensaje, normaliza(mensaje));

  if (esDeAgencia && estado) estado.agencia = true;

  const r = respuestaBase(mensaje, estado, hoy);

  /* Si la respuesta trae estado, la bandera viaja en el. Si no trae
     —porque la conversacion termino— no hay donde guardarla, y esta
     bien: la siguiente vez se vuelve a leer de como escriba. */
  if (esDeAgencia && r && r.estado) r.estado.agencia = true;
  return noSeAtore(r, estado);
}

/* ------------------------------------------------------------
   EL BOT NO SE QUEDA REPITIENDO
   ------------------------------------------------------------
   Se cazó chateando con él: al preguntarle el regreso y no
   entender la respuesta, contestaba *exactamente lo mismo* —y lo
   volvía a contestar, y lo volvía a contestar—. `pasa` en false,
   así que al dueño no le llegaba nada. El cliente se aburría y se
   iba, y del otro lado nadie se enteraba nunca.

   El arreglo va AQUÍ y no en el paso del regreso a propósito. El
   defecto no es de esa pregunta: es de cualquier paso que pueda
   volver a preguntar lo mismo, incluido el que se escriba mañana.
   Arreglarlo en el regreso hubiera sido arreglar un caso; medir la
   repetición sobre lo que salga arregla la clase entera.

   Se cuenta la respuesta REPETIDA, no el intento fallido: si el bot
   avanzó aunque sea un poco, el cliente no está atorado.

   Al tercero se entrega a una persona. Y sin anunciarlo —«no
   avises que va pasar a una persona, el chiste es que el cliente no
   sepa»—: se dice algo que un vendedor diría, y el ticket sale por
   detrás.
   ------------------------------------------------------------ */
const REPETIDAS_PARA_ENTREGAR = 3;

function noSeAtore(r, estadoQueEntro) {
  /* ------------------------------------------------------------
     DÓNDE SE APUNTA LA CUENTA
     ------------------------------------------------------------
     De preferencia en el estado que sale. Pero hay respuestas que
     NO traen estado y aún así se repiten —las objeciones, por
     ejemplo—: «está caro» contestado tres veces seguidas con el
     mismo párrafo. Y ésa es justo la conversación que quiere una
     persona, porque negociar no es del bot: *«esos descuentos los
     ofrezco yo, pero tú no»*.

     Para ésas se apunta en el estado que ENTRÓ, que es el mismo
     objeto que el webhook tiene guardado para ese cliente. No se
     le agrega la llave `estado` a la respuesta —eso cambiaría lo
     que quien llama hace con ella—: solo se anota en el objeto que
     ya existía.

     Si no hay ni uno ni otro no se cuenta nada, y está bien: sin
     memoria no hay atorón que medir.
     ------------------------------------------------------------ */
  const e = (r && r.estado) || estadoQueEntro;
  if (!r || !e || !r.texto) return r;
  if (e.ultimaRespuesta === r.texto) e.repeticiones = (e.repeticiones || 1) + 1;
  else { e.ultimaRespuesta = r.texto; e.repeticiones = 1; }

  if (e.repeticiones < REPETIDAS_PARA_ENTREGAR || r.pasa) return r;

  /* Se limpia el contador para que, si la persona lo destraba y la
     conversación sigue, no vuelva a entregarse al primer tropiezo. */
  e.repeticiones = 0;
  e.ultimaRespuesta = null;
  return {
    texto: 'Déjame revisarlo bien y te confirmo en un momento 🙏',
    pasa: true,
    estado: e,
    opciones: []
  };
}

/* Lo que se dice queriendo VER la unidad. Vive aparte porque se usa en
   dos lugares: a media cotización (abajo) y en el bloque de fotos del
   final. OJO CON LAS FRASES CORTAS Y COMUNES: aquí estuvieron «como es»
   y «como son», y mandaban fotos a quien preguntaba «¿cómo es el pago?». */
const PIDE_FOTOS = ['foto', 'fotos', 'fotografia', 'fotografias', 'imagen', 'imagenes',
  'video', 'videos', 'ensename', 'ensenamela', 'muestrame', 'mandame fotos',
  'como se ve', 'como es por dentro', 'como son las unidades',
  'ver la unidad', 'ver el camion', 'ver la sprinter'];

function respuestaBase(mensaje, estado, hoy) {
  const t = normaliza(mensaje);

  /* ------------------------------------------------------------
     FOTOS A MEDIA COTIZACIÓN — 5-sep-2026
     ------------------------------------------------------------
     El dueño, probando como cliente: el bot esperaba el origen, él
     escribió «quiero fotos», y el bot entendió que salía de un lugar
     llamado Quiero Fotos. Con la fecha pasa igual: «tienes fotos del
     autobús?» → «esa fecha no la entendí».

     Es la misma familia del bug de Vallarta de hoy: el paso en curso
     se traga cualquier texto como respuesta, CON CONFIANZA, así que
     ni siquiera le pasa la bola a la IA (`noEntendio` queda en
     falso). El bloque de fotos de abajo existe y funciona — pero solo
     cuando no hay cotización en curso, que es justo cuando menos se
     piden.

     Aquí se contesta la pregunta lateral SIN perder el hilo: van las
     fotos y, pegada, la pregunta que quedó pendiente. El estado no se
     toca. Va ANTES del paso a propósito: si fuera después, el paso ya
     se habría comido el texto.
     ------------------------------------------------------------ */
  if (estado && estado.paso && tiene(t, PIDE_FOTOS)) {
    const m = mediosDe(estado.unidad || 'sprinter');
    if (m) {
      const p = pregunta(estado);
      return {
        texto: m.texto + '\n\n' + p.texto,
        medios: m,
        opciones: p.opciones,
        pasa: false,
        estado: estado
      };
    }
  }

  /* Si va a media cotización, ese paso manda: lo que escriba es la
     respuesta a lo que se le acaba de preguntar, no un tema nuevo.
     Sin esto, contestar «Chapala» se leería como saludo fallido. */
  if (estado && estado.paso) {
    const seguir = pasoDeCotizacion(t, mensaje, estado, hoy);
    if (seguir) return seguir;
  }

  if (!t) {
    return {
      texto: 'No alcancé a leer eso. ¿Me lo escribes de nuevo?',
      pasa: false
    };
  }

  /* Que pida una persona gana sobre todo lo demás. Si alguien
     escribe «quiero hablar con alguien, cuánto cuesta», lo que
     quiere es la persona, no el precio. */
  if (tiene(t, ['persona', 'humano', 'asesor', 'alguien', 'agente',
    'me atienda', 'hablar con', 'ejecutivo', 'operador'])) {
    return PASA;
  }

  /* ------------------------------------------------------------
     «¿CÓMO TE PAGO?» — LA PREGUNTA QUE MÁS VALE DE TODAS
     ------------------------------------------------------------
     Desde el 3-sep-2026 el anticipo se paga por TRANSFERENCIA, no
     con la liga de Stripe. O sea que el que pregunta a qué cuenta
     deposita ya decidió: solo le falta el número de cuenta.

     Y eso el bot NO lo puede contestar. Los datos bancarios no
     están en ningún archivo de aquí, y no se inventan — es la
     misma regla del precio: el dueño los dicta, el bot no los
     supone. Un CLABE equivocado es dinero de un cliente que se va
     a otra cuenta.

     Así que se entrega, con `pasa` en true, y al dueño le llega el
     aviso. Va ANTES que todo lo demás porque «a qué cuenta
     deposito» traía la palabra «cuenta» y se leía como el arranque
     de una cotización: al que ya iba a pagar se le contestaba
     «¿a dónde va el plan?» y se le mandaba a empezar de nuevo.

     Cuando el dueño dé los datos de la cuenta, este es el lugar
     donde se ponen.
     ------------------------------------------------------------ */
  if (/\b(a que cuenta|que cuenta|numero de cuenta|clabe|transferencia|transferir|te transfiero|deposit|donde (te )?pago|como (te )?pago|como le pago|donde le deposito|datos bancarios|banco)\b/.test(t) ||
      QUIERE_APARTAR.test(t)) {
    return {
      texto: 'Va, te la aparto 🙌\n\n¿A qué nombre la pongo?',
      pasa: true,
      /* ------------------------------------------------------------
         LOS DATOS DE LA CUENTA NO VIVEN AQUÍ
         ------------------------------------------------------------
         `bot.js` corre TAMBIÉN en el navegador —el chat de la página
         carga este mismo archivo— así que todo lo que se escriba aquí
         queda a la vista de cualquiera que abra el código fuente.

         Una CLABE no es un secreto —sirve para depositarte, no para
         sacarte— pero tampoco tiene por qué andar suelta en el código
         de una página pública: quien la copie de ahí puede usarla para
         cobrar a nombre de Eurotravel.

         Así que el bot solo IZA LA BANDERA y quien tiene el dato lo
         pega: `_whatsapp-webhook.js`, que lee `DATOS_BANCARIOS` de las
         variables de entorno. Mismo camino que `VENDEDOR`.

         Si la variable no está puesta, el mensaje sale sin los datos y
         `pasa` en true hace que le llegue el aviso al dueño — o sea,
         se los pasa él. Nunca queda el cliente esperando.
         ------------------------------------------------------------ */
      pideDatosBancarios: true,
      opciones: []
    };
  }

  /* ------------------------------------------------------------
     EL VIAJE SOLTADO DE UN JALÓN
     ------------------------------------------------------------
     «vamos a Tequila el 12, somos 16»

     Va aquí arriba, antes que el bloque de precio y antes que la
     IA, porque es GRATIS y porque si no, ese mensaje caía en
     «¿como cuántos van?» — preguntándole algo que el cliente ya
     había dicho en la misma frase. Nada hace sentir menos
     escuchado que eso.

     Solo entra si trae DOS datos o más (`traeSuficiente`). Con uno
     solo, el camino de siempre contesta mejor.

     Y solo cuando la conversación va empezando: a media cotización
     manda el paso en el que va, no una frase suelta.
     ------------------------------------------------------------ */
  /* Se marca en SILENCIO, sin decirle nada al cliente. La bandera viaja
     en el estado y cambia el tono de aqui en adelante. Una vez marcada no
     se quita: si dijo «pax» una vez, es agencia aunque despues escriba
     normal. */
  if (estado && !estado.agencia && esAgencia(mensaje, t)) estado.agencia = true;

  if (!estado || !estado.paso) {
    const deUnJalon = leeDeUnJalon(mensaje, hoy);
    if (esAgencia(mensaje, t)) deUnJalon.agencia = true;
    if (traeSuficiente(deUnJalon)) {
      const r = aplicaEntendido(deUnJalon, hoy);
      if (r) return r;
    }
  }

  /* ------------------------------------------------------------
     «¿TIENES FOTOS?»
     ------------------------------------------------------------
     El bot tenía 58 fotos y 6 videos de las unidades —bajados de
     su propio sitio— y no sabía que los tenía: contestaba «esa no
     me la sé». Lo cazó el dueño a la primera que lo probó.

     Es de las preguntas que más vende y de las más fáciles: quien
     pide fotos ya está considerando el viaje. Contestar «no sé» a
     eso es tirar el cliente.

     Qué unidad enseñar:
       · Si ya se sabe cuál va, ésa.
       · Si no, la Sprinter — es la que la página cotiza sola, y
         la que le toca a la mayoría de los grupos.

     `medios` no lleva texto ni precio: son las rutas de los
     archivos y el video, para que quien pinta la conversación
     decida cómo enseñarlos. En la página van como imágenes; en
     WhatsApp irán como adjuntos.
     ------------------------------------------------------------ */
  /* La lista vive arriba, en `PIDE_FOTOS`, porque también se usa a
     media cotización. */
  if (tiene(t, PIDE_FOTOS)) {
    const cual = (estado && estado.unidad) || 'sprinter';
    const m = mediosDe(cual);
    if (m) {
      return {
        texto: m.texto,
        pasa: false,
        medios: m,
        opciones: ['Cotizar mi viaje', 'Ver otra unidad', 'Márcame']
      };
    }
  }

  /* ------------------------------------------------------------
     LAS OBJECIONES
     ------------------------------------------------------------
     Van ANTES del bloque de precio a propósito: «está caro» y «otro
     me lo da más barato» no son preguntas de precio, son respuestas
     a uno que ya se dio. Si cayeran en el bloque de abajo, el bot
     volvería a preguntar cuántos van.

     Tres cosas que ninguna de estas hace:
     · Bajar el precio. Eso no lo decide el bot.
     · Ponerse a la defensiva o hablar mal de la competencia.
     · Quedarse sin pregunta al final. Todas cierran preguntando.
     ------------------------------------------------------------ */

  /* «Está caro» · No se defiende el número: se le pide contra qué lo
     está comparando. Casi siempre lo compara contra nada, y ahí se
     acaba la objeción sola. */
  if (tiene(t, ['caro', 'cara', 'carisimo', 'carísimo', 'muy alto', 'es mucho',
    'mucho dinero', 'se pasa', 'no me alcanza', 'fuera de presupuesto'])) {
    return {
      texto: 'Te entiendo 🙂 Ese precio ya trae operador, combustible, casetas ' +
        'y seguro de viajero — no se le suma nada después.\n\n' +
        '¿Contra qué lo estás comparando? Te ayudo a ver si de verdad te sale mejor.',
      pasa: false,
      opciones: ['Contra otra empresa', 'Contra irnos en coche', 'Hablar con alguien']
    };
  }

  /* «Déjame preguntarle al grupo» · LA OBJECIÓN NÚMERO UNO de este
     negocio, y la única que no se combate: se FACILITA. El que
     organiza necesita reenviarle algo al grupo, y si no se lo damos
     lo va a escribir él —mal, y sin lo que incluye—. */
  /* OJO CON LAS PALABRAS SUELTAS LARGAS · Aquí estuvieron «checarlo» y
     «platicarlo», y las dos se tragaban «caro»: el detector de
     abreviaturas de `tiene()` acepta una palabra corta como abreviatura
     de una larga si sus letras van en orden, y c-a-r-o va en orden
     dentro de che-C-A-R-l-O y de plati-C-A-R-l-O.

     Resultado: el cliente decía «está caro» y el bot le contestaba
     «te lo dejo listo para reenviar al grupo».

     La regla, que ya va por su tercera versión en este archivo: en estas
     listas, FRASES. Una palabra suelta larga se come a las cortas por
     abreviatura, igual que una corta se colaba dentro de otra por
     pedazo. */
  if (tiene(t, ['preguntarle', 'preguntar al grupo', 'lo consulto',
    'lo checo', 'lo checamos', 'les digo', 'les pregunto', 'ver con',
    'comento con', 'lo platico', 'avisar al grupo', 'consultarlo con'])) {
    /* ------------------------------------------------------------
       EL «NO» FÁCIL (Voss)
       ------------------------------------------------------------
       De la investigación que trajo el dueño, y es de lo más fino
       que hay ahí: **un «no» es más fácil de dar que un «sí»**, y
       preguntando al revés se consigue lo mismo sin empujar.

       «¿Te la aparto?» obliga al cliente a comprometerse por un
       grupo que todavía no le contesta, así que contesta «déjame
       ver» — y ahí se enfría. «¿Sería mala idea apartártela
       mientras confirmas?» se responde con un «no, órale» que no
       le cuesta nada, y la fecha queda bloqueada.

       Va DESPUÉS del mensaje reenviable, no antes: primero se le
       facilita lo que pidió —que es lo que su documento llama «no
       lo combatas»— y ya después se le ofrece la salida.
       ------------------------------------------------------------ */
    return {
      texto: 'Claro 👌 Te lo dejo listo para reenviar tal cual:\n\n' +
        '_(copia el mensaje de arriba y mándalo a tu grupo — trae destino, ' +
        'fechas, unidad y lo que incluye)_\n\n' +
        '¿Sería mala idea que te la aparte mientras te contestan?',
      pasa: false,
      opciones: ['Esta semana', 'Sí, apártamela', 'Hablar con alguien']
    };
  }

  /* «Otro me lo da más barato» · Sin descalificar a nadie: se le dice
     qué comparar. Y con lo ÚNICO que se puede afirmar de la empresa
     —el seguro de viajero, que está en su propio sitio oficial—. */
  /* OJO CON `menos` · Aquí estuvo la palabra «menos» a secas y se tragó
     el botón «Somos 10 o menos»: el cliente decía cuántos iban y el bot
     le contestaba de la competencia. Lo cazó la prueba que le da de
     comer al bot cada opción que ofrece.

     Es el MISMO error que ya se pagó dos veces en este archivo —«persona»
     dentro de «personas», y «personaz» contra «persona»—. La regla que
     salió de aquellas sigue valiendo: una palabra corta y común no se
     pone sola; se pone la frase. */
  /* «me dieron» a secas se llevaba «me dieron el número de ustedes».
     Va con lo que sigue, que es lo que la vuelve una objeción. */
  if (tiene(t, ['mas barato', 'más barato', 'me lo dejan en', 'otra empresa',
    'otro me lo', 'otro proveedor', 'me dieron mejor', 'me dieron en',
    'me cotizaron', 'la competencia'])) {
    /* ------------------------------------------------------------
       ARGUMENTO DE DOS CARAS
       ------------------------------------------------------------
       De la investigación del dueño, y es de lo más contraintuitivo
       que trae: un mensaje que ADMITE una limitación convence más
       que uno perfecto. «No somos los más baratos» compra el derecho
       a que se crea lo que sigue.

       Aquí cae bien porque el cliente acaba de decir que encontró
       algo más barato. Negarlo lo pone a defender su hallazgo;
       concederlo lo pone a comparar lo que de verdad importa.

       Se concede UNA cosa y una sola vez. Un vendedor que se
       desprecia dos veces deja de sonar honesto y empieza a sonar
       inseguro.
       ------------------------------------------------------------ */
    return {
      texto: 'Puede ser, y te soy honesto: *no siempre somos los más baratos* 🤝\n\n' +
        'Nomás checa que su precio incluya casetas, operador y que la unidad ' +
        'traiga *seguro de viajero*. Ahí suele estar la diferencia.\n\n' +
        '¿Quieres que te lo desglose?',
      pasa: false,
      opciones: ['Sí, desglósamelo', 'Sí, apártamela', 'Hablar con alguien']
    };
  }

  /* ------------------------------------------------------------
     LOS BOTONES QUE EL BOT OFRECE Y NO SE ENTENDÍA A SÍ MISMO
     ------------------------------------------------------------
     Hay una prueba vieja —«el bot entiende sus propios botones»—
     que le da de comer cada opción que ofrece. Cubría los botones
     de los PASOS de la cotización, que traen estado. Los de aquí
     abajo no traen: las objeciones contestan sin estado.

     Resultado: el bot preguntaba «¿quieres que te lo desglose?»,
     el cliente picaba *Sí, desglósamelo*, y le contestaba «déjame
     checarte eso bien tantito». Ofrecer un botón y no entenderlo
     es peor que no ofrecerlo: el cliente hizo justo lo que se le
     pidió y aun así se topó con pared.

     Se contestan las cuatro que quedaban sueltas. La regla, para
     el que venga: **un botón nuevo se escribe junto con lo que
     contesta cuando le piquen**, no después.
     ------------------------------------------------------------ */

  /* ------------------------------------------------------------
     «CONDICIONES DE AGENCIA»
     ------------------------------------------------------------
     Otro botón que el bot ofrecía y no entendía: quien le picaba
     caía en el «déjame checarte eso bien tantito».

     Se contesta de colega a colega, como pide el guion para las
     agencias: el dato y nada más. Sin discurso emocional, sin
     precio por persona, sin comparar con coches — eso es para el
     que viaja, no para el que revende.

     El 5 % SE NOMBRA, NO SE CALCULA. Es dinero: R12 dice que los
     números los pone el dueño. Y falta que él precise si es
     descuento sobre el público o comisión que se paga después,
     así que la conversación pasa a una persona.
     ------------------------------------------------------------ */
  if (/\bcondiciones\b|\btarifa neta\b|\bneto\b|\bcomisi[oó]n\b|\bconvenio\b/.test(t)) {
    return {
      /* «Descuento sobre el público», no «comisión»: son cosas
         distintas y una agencia lo nota. El dueño lo precisó el
         4-sep-2026. */
      texto: 'Para cuenta manejamos *' + COMISION_AGENCIA +
        '% de descuento* sobre el precio público 🤝\n\n' +
        'Llevamos ' + ANIOS + ' años y todas las unidades traen seguro de viajero, ' +
        'permiso vigente y factura.\n\n' +
        'Te paso los detalles del convenio ahorita.',
      pasa: true,
      /* Se devuelve el estado CON la marca de agencia. Quien pregunta
         por tarifa neta o comisión es agencia por definición, y si esa
         marca se perdiera aquí, el siguiente mensaje lo trataría como
         particular: le saldría el precio por persona y la comparación
         con coches, que a quien revende lo espanta. */
      estado: Object.assign({}, estado || {}, { agencia: true }),
      opciones: []
    };
  }

  /* «Sí, márcame» / «Márcame» · Pide que le hablen. Es lo mismo que
     pedir una persona, y para eso ya está `PASA`. */
  if (/^\s*(s[ií],?\s*)?m[aá]rcame\b/.test(t) || /\bmarcame\b/.test(t)) {
    return PASA;
  }

  /* «Sí, desglósamelo» · Contestó que sí a que le desglosaran lo que
     incluye el precio. La lista es la misma que ya usa la respuesta
     de «¿qué incluye?»: una sola verdad, no dos redacciones. */
  if (/\bdesglos\w*|\bdesgl[oó]s\w*/.test(t)) {
    return respuestaA('que incluye', null, hoy);
  }

  /* «Esta semana» / «La próxima» · Contestó cuándo tendrá respuesta
     del grupo. No se le pide nada más: se le dice que se le escribe
     ese día y se cierra amable. El recordatorio de verdad lo maneja
     `_recordatorios.js`, no esta frase. */
  if (/\b(esta semana|la proxima|proxima semana|el fin|este fin|manana te digo|en unos dias)\b/.test(t)) {
    return {
      texto: 'Perfecto, quedo al pendiente 🙌\n\nSi antes de eso necesitas ' +
        'que le mueva algo —fechas, días, otra unidad— me dices.',
      pasa: false,
      opciones: []
    };
  }

  /* «Sí, vamos» · Dijo que sí a que le armaran el viaje después de
     explicarle cómo funciona. Es un sí de arranque, no de cierre: lo
     que falta es el viaje, así que se le pregunta por él. */
  if (/^\s*s[ií],?\s*(vamos|va|le entro|dale)\s*$/.test(t)) {
    return {
      texto: '¡Va! 🚐 ¿A dónde van y qué día?',
      pasa: false,
      estado: { paso: 'destino' },
      opciones: []
    };
  }

  /* «Nunca he rentado» · El miedo aquí no es el precio, es no saber
     cómo funciona. Se baja con el proceso, en tres pasos. */
  if (tiene(t, ['nunca he rentado', 'primera vez', 'como funciona', 'cómo funciona',
    'como es el proceso', 'que sigue', 'qué sigue', 'como le hago'])) {
    /* ------------------------------------------------------------
       ETIQUETAR LA EMOCIÓN (Voss)
       ------------------------------------------------------------
       Nombrar lo que el otro siente baja su resistencia: deja de
       tener que defenderlo. Aquí el miedo no es el precio, es no
       saber cómo funciona y quedar mal frente a su grupo.

       «Se siente raro» lo dice el bot ANTES que el cliente, y con
       eso el cliente ya no tiene que admitirlo. Luego los tres pasos,
       que es lo que de verdad lo tranquiliza: saber qué sigue.
       ------------------------------------------------------------ */
    /* Los 14 años entran AQUÍ y no en el saludo. Es donde sirven: el
       miedo del que nunca ha rentado no es el precio, es entregarle
       dinero a alguien que no conoce. Un dato verificable de la
       empresa baja eso; en el saludo sería presumir. */
    return {
      texto: 'Se siente raro la primera vez, es normal 🙂 Llevamos ' + ANIOS +
        ' años en esto.\n\n' +
        'Es sencillo: apartas tu fecha, te llega tu contrato, y el resto lo ' +
        'liquidas antes del viaje. Yo te acompaño en todo.\n\n¿Te lo armo?',
      pasa: false,
      opciones: ['Sí, vamos', 'Cotizar mi viaje', 'Hablar con alguien']
    };
  }

  /* Cancelaciones · El bot NO tiene política que dar. La decide el
     vendedor caso por caso (dictado el 2-sep-2026), así que aquí no
     se inventa una ni se promete un reembolso. Se pasa y ya. */
  if (tiene(t, ['cancelo', 'cancelar', 'cancelacion', 'cancelación', 'me rajo',
    'se rajan', 'devuelven', 'reembolso', 'me regresan'])) {
    return {
      texto: 'Eso lo vemos directo contigo, según tu caso 🙌\n\n' +
        '¿Te marco para verlo?',
      pasa: false,
      opciones: ['Sí, márcame', 'Cotizar mi viaje']
    };
  }

  /* ---- el precio: lo más delicado ---- */
  /* «cotiz» va con comodín porque cubre cotizar, cotización y cotizame.
     «vale» se quitó a propósito: en México «vale» es «de acuerdo», y
     «vale, gracias» acababa contestando una explicación de precios. */
  if (tiene(t, ['precio', 'precios', 'costo', 'costos', 'cuesta', 'cuanto',
    'tarifa', 'tarifas', 'cotiz\\w*', 'presupuesto', 'cobran', 'cobras'])) {
    /* «Más de 20» no dice cuántos son. Antes se leía como 21 y el bot
       contestaba «andan por poquito arriba», que a un grupo de 60 le
       suena absurdo. Ahora pregunta. */
    const piso = masDeQue(t);
    if (piso !== null) {
      const p = siguiente({ paso: 'cuantos', piso: piso });
      return { texto: p.texto, pasa: false, estado: p.estado, opciones: p.opciones };
    }
    const gente = cuantaGente(t);
    if (gente) {
      const r = recomienda(gente);
      return { texto: r.texto, pasa: false, estado: r.estado, opciones: r.opciones };
    }
    /* ------------------------------------------------------------
       «¿CUÁNTO CUESTA?» SE CONTESTA CON «¿A DÓNDE?» · §2 del guion
       ------------------------------------------------------------
       Antes esto preguntaba cuántos son, y el razonamiento era
       técnico y correcto: sin saber cuántos van no se sabe qué
       unidad, y sin unidad no se sabe si el precio se puede dar
       aquí. Todo cierto — pero es el orden del SISTEMA, no el de
       una conversación.

       El destino va primero por tres razones:

       · Es lo único que el cliente YA tiene decidido cuando
         escribe. Cuántos van todavía lo está contando.
       · Revela la OCASIÓN, que es lo que después cambia todo el
         discurso y la línea con que se cierra el precio.
       · Se puede acusar recibo de algo suyo —«Buenísimo plan, esa
         ruta la hacemos cada fin»— y eso no se puede hacer con un
         número.

       Cuántos son se pregunta enseguida, y ahí entra `recomienda`
       exactamente igual que antes. No se pierde nada del camino;
       cambia el orden.
       ------------------------------------------------------------ */
    return {
      texto: 'Con gusto 🚐 ¿A dónde va el plan?',
      pasa: false,
      estado: { paso: 'destino' },
      opciones: []
    };
  }

  /* ---- cuántos caben / qué unidad ---- */
  const piso = masDeQue(t);
  if (piso !== null) {
    const p = siguiente({ paso: 'cuantos', piso: piso });
    return { texto: p.texto, pasa: false, estado: p.estado, opciones: p.opciones };
  }
  const gente = cuantaGente(t);
  if (gente) {
    const r = recomienda(gente);
    return { texto: r.texto, pasa: false, estado: r.estado, opciones: r.opciones };
  }

  /* ------------------------------------------------------------
     UNA UNIDAD POR SU NOMBRE
     ------------------------------------------------------------
     Antes esto solo enseñaba la ficha y ahí se moría: el dueño
     escribió «quiero una Sprinter» y el bot le contestó qué
     incluye, sin ofrecerle cotizar. Quien nombra la unidad que
     quiere ya decidió; lo que sigue es el precio, no el folleto.
     ------------------------------------------------------------ */
  for (let i = 0; i < UNIDADES.length; i++) {
    const u = UNIDADES[i];
    /* «spter», «suburvan», «neobús»: se busca por palabra y con
       tolerancia, no con `indexOf`, que exige escribirlo perfecto. */
    const nombre = normaliza(u.name);
    const loNombro = t.indexOf(nombre) !== -1 || palabrasDe(t).some(function (p) {
      return esLaPalabra(p, nombre);
    });
    if (loNombro) {
      if (u.cotizadorAutomatico) {
        const p = siguiente({ paso: 'destino', unidad: 'sprinter' });
        return {
          texto: '*' + u.name + '* — ' + u.cap + ' 🚐\n\nTe saco el precio ahorita.\n\n' +
            p.texto,
          pasa: false, estado: p.estado, opciones: p.opciones
        };
      }
      /* Las que no se cotizan solas TAMPOCO se quedan en la ficha: se
         le juntan los datos igual, para que quien ponga el precio no
         tenga que preguntarle todo otra vez. */
      const p = siguiente({
        paso: 'destino',
        unidad: u.id === 'suburban' ? 'suburban' : 'autobus'
      });
      return {
        texto: '*' + u.name + '* — ' + u.cap + '\n\nSu precio lo da una persona del ' +
          'equipo. Déjame juntar los datos para que te lo pasen rápido 👇\n\n' + p.texto,
        pasa: false, estado: p.estado, opciones: p.opciones
      };
    }
  }

  /* ---- «quiero cotizar», sin más ---- */
  if (tiene(t, ['cotizar', 'cotizame', 'cotizacion', 'quiero rentar', 'necesito rentar',
    'quiero un', 'necesito un', 'rentar'])) {
    return {
      texto: 'Va 🚐 ¿Cuántas personas viajan?\n\nSi son *20 o menos* te saco el precio ' +
        'aquí mismo.',
      pasa: false, opciones: []
    };
  }

  /* ---- la flota ---- */
  if (tiene(t, ['unidad', 'unidades', 'camion', 'autobus', 'autobuses', 'bus',
    'flota', 'vehiculo', 'transporte', 'capacidad', 'caben'])) {
    return {
      texto: 'Estas son nuestras unidades:\n\n' + listaDeUnidades() +
        '\n\n¿Cuántas personas viajan? Con eso te digo cuál te conviene.',
      pasa: false
    };
  }

  /* ---- qué incluye ---- */
  if (tiene(t, ['incluye', 'incluyen', 'servicio', 'baño', 'bano', 'aire',
    'seguro', 'gasolina', 'combustible', 'caseta', 'chofer', 'gps'])) {
    return {
      texto: 'Todos nuestros servicios incluyen:\n\n' +
        '✓ Operador profesional\n' +
        '✓ Seguro de viajero\n' +
        '✓ Monitoreo GPS 24/7\n' +
        '✓ Combustible y casetas\n\n' +
        'Cada unidad además trae lo suyo. ¿Cuál te interesa?\n\n' + listaDeUnidades(),
      pasa: false
    };
  }

  /* ---- saludo ---- */
  if (tiene(t, ['hola', 'buenas', 'buenos dias', 'buen dia', 'buenas tardes',
    'buenas noches', 'que tal', 'saludos', 'informacion', 'informes'])) {
    return {
      /* ------------------------------------------------------------
         EL SALUDO ARRANCA POR EL DESTINO · §2 del guion
         ------------------------------------------------------------
         Antes era un menú de tres opciones —«nuestras unidades»,
         «qué incluye», «pasarte con una persona»— y terminaba
         pidiendo dos datos de golpe.

         Tres cosas estaban mal:

         · **Un menú no vende.** Le pasa la carga al cliente de
           averiguar qué preguntar, cuando el que sabe qué preguntar
           es el vendedor.
         · **«Pasarte con una persona» delataba al bot**, y esa regla
           ya se había quitado de todos lados menos de aquí.
         · **Empezaba por lo administrativo.** El destino es lo que
           revela la OCASIÓN, y la ocasión es lo que después decide
           todo el discurso — incluida la línea con la que se cierra
           el precio.

         Una sola pregunta, abierta, y la que más información trae.
         ------------------------------------------------------------ */
      /* ------------------------------------------------------------
         EL SALUDO, SEGUNDA VERSIÓN
         ------------------------------------------------------------
         La primera decía «¡Hola! Aquí *Eurotravel* 🚐 / ¿A dónde va
         el plan?» y el dueño fue directo: *«el saludo está de la
         chingada»*. Tenía razón, y vale la pena escribir por qué,
         porque el defecto no se ve hasta que lo lees en voz alta:

         · **«Aquí Eurotravel» no lo dice una persona.** Es lo que
           contesta una centralita. Y el bot vive dentro del chat de
           un vendedor: si suena a empresa, ya perdió.
         · **No decía a qué se dedica.** Alguien que llegó de un
           anuncio no necesariamente sabe qué le van a rentar.
         · **«¿A dónde va el plan?» a secas es una pregunta al
           aire.** Sin decir para qué la haces, se contesta con
           desgana o no se contesta.

         Ahora dice quién es, qué hace y por qué pregunta — en tres
         renglones cortos. Y cierra ofreciendo el precio, que es lo
         único que el cliente vino a buscar.

         El nombre sigue saliendo de `VENDEDOR` y SIGUE sin
         inventarse uno si no está puesto: un vendedor que no existe
         es una mentira que el cliente descubre el día que pregunta
         por él. Sin nombre, se saluda igual de cálido en plural.
         ------------------------------------------------------------ */
      texto: (VENDEDOR
        ? '¡Hola! Soy *' + VENDEDOR + '*, de *Eurotravel* 🚐'
        : '¡Hola! Le marcaste a *Eurotravel* 🚐') +
        '\n\nRentamos camionetas y autobuses con chofer, para grupos.\n\n' +
        '¿A dónde van? Con eso te saco el precio.',
      pasa: false,
      estado: { paso: 'destino' },
      opciones: []
    };
  }

  /* ------------------------------------------------------------
     «A CHAPALA», A SECAS · el último intento antes de rendirse
     ------------------------------------------------------------
     Es de los mensajes con los que más arranca la gente, y el bot
     se rendía: `traeSuficiente` pide DOS datos y aquí solo hay uno.
     El dueño lo vio a la primera y creyó que faltaba la IA. No
     faltaba — el guion ya lo había leído y decidió no usarlo.

     Se intentó primero bajando el umbral a un dato, ALLÁ ARRIBA. Fue
     un error y vale la pena que quede escrito: `traeSuficiente` corre
     ANTES que las objeciones, así que «déjame preguntarle al grupo»
     se convirtió en un viaje al destino «Grupo». Tres pruebas se
     pusieron en rojo y tenían razón.

     Aquí abajo no pasa: para llegar a este punto ya se descartaron
     el saludo, las fotos, las unidades, el precio, las objeciones y
     todo lo demás. Lo que queda es alguien nombrando un lugar.

     Y aun así se confirma —«creo que entendí»— porque un destino
     leído de una palabra suelta se puede equivocar.
     ------------------------------------------------------------ */
  if (!estado || !estado.paso) {
    const soloDestino = leeDeUnJalon(mensaje, hoy);
    if (soloDestino.destino) {
      const r = aplicaEntendido(soloDestino, hoy);
      if (r) return r;
    }
  }

  /* ---- gracias / despedida ---- */
  if (tiene(t, ['gracias', 'muchas gracias', 'adios', 'hasta luego', 'bye'])) {
    return {
      texto: '¡Con gusto! Aquí andamos para lo que necesites 🚌',
      pasa: false
    };
  }

  /* ------------------------------------------------------------
     No entendió. Y aquí NO adivina.
     ------------------------------------------------------------
     `noEntendio` es la señal para quien llama: aquí —y solo aquí—
     vale la pena gastar una llamada a la IA para que traduzca lo
     que quiso decir. Si no hay IA configurada, o falla, este
     mismo texto es la respuesta y el bot sigue funcionando.
     ------------------------------------------------------------ */
  /* ------------------------------------------------------------
     AQUÍ NO SE PASA A NADIE, PORQUE YA ESTAMOS TODOS
     ------------------------------------------------------------
     Dato del dueño, 2-sep-2026, y cambia el diseño:

       «la IA bot vive dentro del chat del vendedor, yo puedo
        contestar también, no tienes que pasar a nadie»

     No hay dos conversaciones ni un traspaso: es UNA sola, la del
     vendedor, y el bot escribe en ella mientras el vendedor no
     esté. Cuando el vendedor entra, entra — sin anuncio, sin
     transferencia, sin que el cliente note el relevo.

     Por eso este texto ya no manda a marcarle a nadie. Sostiene
     la conversación, pide lo que le falta y deja `pasa: true`
     para que del lado de adentro se vea que aquí hace falta el
     vendedor. Esa bandera es para el equipo, no para el cliente.
     ------------------------------------------------------------ */
  return {
    texto: 'Déjame checarte eso bien tantito 🙏\n\n' +
      'Mientras, dime *cuántos van y a dónde* y te voy armando el precio.',
    pasa: true,
    noEntendio: true
  };
}

/* ------------------------------------------------------------
   LO QUE LA IA ALCANZÓ A LEER
   ------------------------------------------------------------
   Recibe los datos sueltos que sacó `_entender.js` y los mete en
   el mismo camino de siempre, saltándose lo que el cliente ya
   dijo. La IA NO escribe la respuesta: solo traduce. Todo lo que
   se le contesta lo redacta este archivo, y el precio lo sigue
   poniendo el motor de cobro.

   Devuelve null cuando lo entendido no alcanza para nada, y
   entonces quien llama se queda con la respuesta de siempre.
   ------------------------------------------------------------ */
function aplicaEntendido(datos, hoy) {
  if (!datos) return null;

  /* Intenciones que ya tienen respuesta escrita: se contesta esa. Es
     gratis y está mejor redactada que cualquier improvisación. */
  if (datos.intencion === 'persona') return respuestaA('quiero hablar con una persona', null, hoy);
  if (datos.intencion === 'unidades') return respuestaA('que unidades tienen', null, hoy);
  if (datos.intencion === 'incluye') return respuestaA('que incluye', null, hoy);
  if (datos.intencion === 'saludo') return respuestaA('hola', null, hoy);
  if (datos.intencion === 'fotos') return respuestaA('tienes fotos', null, hoy);

  /* ------------------------------------------------------------
     FUERA DEL TEMA · se regresa, no se contesta
     ------------------------------------------------------------
     Política, religión, consejos de vida, tareas, o preguntarle qué
     es. Nada de eso se contesta — ni de pasada ni por educación.

     La frase es fija y va aquí, en el guion: gratis, revisada, y
     siempre la misma. Ni se le pide a la IA que redacte una salida
     amable, porque entonces estaría opinando de algo que no le toca
     con palabras que nadie revisó.

     Y no se corta en seco: se regresa al tema con una pregunta, que
     es lo que hace un vendedor cuando el cliente se va por la rama. */
  if (datos.intencion === 'fuera') {
    return {
      texto: 'Jaja, de eso sí no sé 🙂\n\nLo mío son los viajes: ¿a dónde ' +
        'van y cuántos son?',
      pasa: false,
      opciones: ['Cotizar mi viaje', 'Ver fotos', 'Qué unidades tienen']
    };
  }

  /* Para cotizar hace falta AL MENOS una pista de qué quiere. Con nada
     de nada, preguntar de cero es mejor que fingir que se entendió. */
  const algo = datos.gente || datos.unidad || datos.destino || datos.salida;

  /* ------------------------------------------------------------
     LO QUE LA IA CONTESTÓ POR SU CUENTA
     ------------------------------------------------------------
     Cuando no hay NADA que extraer —«¿y si se me poncha una llanta?»—
     pero la IA sí supo qué contestar, se usa su frase. Es el único
     lugar del proyecto donde el cliente lee algo que no escribimos
     nosotros.

     Ya viene filtrada por `respuestaSegura` en `_entender.js`: sin
     cifras, sin datos inventados de la empresa y sin anunciar
     traspasos. Aquí solo se le pega la pregunta de siempre, para que
     la conversación no muera en una explicación.

     Va DESPUÉS de las intenciones conocidas y ANTES de rendirse: las
     respuestas escritas ganan —son gratis y están mejor redactadas—,
     y esto gana contra no contestar.
     ------------------------------------------------------------ */
  if (!algo && datos.respuesta) {
    return {
      texto: datos.respuesta + '\n\n¿A dónde van y cuántos son?',
      pasa: false,
      opciones: ['Cotizar mi viaje', 'Ver fotos']
    };
  }

  if (!algo) return null;

  /* Qué unidad. Si dijo cuántos son, manda el número —es más confiable
     que el nombre que haya alcanzado a escribir—. */
  let unidad = datos.unidad;
  if (datos.gente) {
    if (datos.gente <= Number(SPRINTER.max)) unidad = 'sprinter';
    else if (datos.gente > CASI_SPRINTER) unidad = 'autobus';
    else unidad = null;                      // en la orilla: mejor preguntarle
  }

  /* ------------------------------------------------------------
     SIN UNIDAD CLARA
     ------------------------------------------------------------
     Si dijo cuántos son pero el número cae en la orilla —entre la
     Sprinter y el autobús—, se le recomienda y se le deja escoger.

     Si NO dijo cuántos son, antes se devolvía `null`, o sea: se
     tiraba todo lo entendido. Y con eso «a chapala» —a secas, que
     es de los mensajes con los que más arranca la gente— acababa
     en «déjame checarte eso bien tantito», con el destino leído,
     entendido, y en la basura.

     No hace falta saber la unidad para preguntar cuántos van. Se
     guarda el destino y se sigue: `alSiguienteHueco` ya sabe qué
     falta y en qué orden.
     ------------------------------------------------------------ */
  if (!unidad && datos.gente) {
    const r = recomienda(datos.gente);
    return { texto: r.texto, pasa: false, estado: r.estado, opciones: r.opciones };
  }

  /* Y si no quedó NADA con qué seguir —ni destino ni fecha— entonces
     sí no hay nada que hacer: preguntar de cero es mejor que fingir
     que se entendió. */
  if (!unidad && !datos.destino && !datos.salida) return null;

  const e = { unidad: unidad || null, gente: datos.gente || null };
  /* La ocasión que leyó la IA vale igual que la que se lee del texto:
     es la que decide con qué se compara el precio al final. Si no la
     sacó, se queda sin ella y el precio va sin comparación — que es
     mejor que una comparación equivocada. */
  if (datos.ocasion) e.ocasion = datos.ocasion;
  if (datos.agencia) e.agencia = true;
  if (datos.destino) e.destino = limpiaDestino(datos.destino);
  if (datos.origen) e.origen = datos.origen;
  if (datos.salida) e.salida = datos.salida;
  if (datos.regreso) e.regreso = datos.regreso;

  /* Solo ida: se cotiza como salir y volver el mismo día, que es lo que
     el motor sabe cobrar. Y así R22 le quita los movimientos solo. */
  if (datos.soloIda && e.salida && !e.regreso) e.regreso = e.salida;

  alSiguienteHueco(e);

  const p = siguiente(e);
  const leido = [];
  /* La unidad se nombra SOLO si se sabe cuál es. Antes se ponía
     «autobús» en el `else`, o sea que un mensaje sin unidad le
     repetía al cliente «autobús» sin que nadie lo hubiera dicho —y
     el que va a Chapala con 12 no va en autobús. */
  if (unidad === 'sprinter') leido.push(SPRINTER.name);
  else if (unidad === 'suburban') leido.push(SUBURBAN.name);
  else if (unidad === 'autobus') leido.push('autobús');
  if (e.destino) leido.push('a ' + e.destino);
  if (e.salida) leido.push(fechaEnPalabras(e.salida));

  return {
    /* Se le repite lo que se entendió ANTES de seguir. Si la IA leyó
       mal, el cliente lo ve de inmediato y lo corrige, en vez de
       enterarse hasta el final. */
    /* Iba en TRES renglones: lo entendido, «si me equivoqué dime
       cambiar algo», y la pregunta. Con la regla de forma del guion de
       ventas —tres líneas, una pregunta— se juntaron los dos primeros:
       la corrección va en el mismo renglón, entre paréntesis, donde se
       lee igual y no le roba peso a la pregunta que sigue. */
    texto: 'Creo que entendí: *' + leido.join(', ') + '* 🤔 ' +
      '(si me equivoqué, dime *cambiar algo*)\n\n' + p.texto,
    pasa: false, estado: p.estado, opciones: p.opciones
  };
}

module.exports = {
  respuestaA, textoDeCotizacion, textoDeSolicitud, aplicaEntendido, mediosDe,
  /* Se exportan para poder probarlos solos: son los que leen la frase
     de un jalon, y ahi es donde se han colado los defectos de dinero. */
  leeDeUnJalon, origenDeLaFrase, destinoDeLaFrase, limpiaDestino, esAgencia,
  /* Para probar la tolerancia a faltas sin pasar por todo el bot. */
  esLaPalabra, fonetica, distancia,
  normaliza, cuantaGente, unidadPara, fechaDe, fechaEnPalabras, hoyISO,
  /* `pregunta` y `diasEntre` se exportan para poder vigilarlos desde las
     pruebas: que ninguna opción se pase de los topes de WhatsApp —3
     botones de 20 caracteres o 10 filas de 24— y que los días se cuenten
     con los dos extremos. */
  pregunta, diasEntre, HORAS_MOV,
  /* `paseosDe` lo usa TAMBIEN la pantalla de cotizar, no solo el chat. Se
     comparte a propósito: una tercera copia de esa tabla sería una tercera
     cosa que se despega sola. */
  paseosDe,
  UNIDADES, TELEFONO, SITIO
};
