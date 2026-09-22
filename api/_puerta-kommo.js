/* ============================================================
   LA PUERTA: EL CEREBRO DECIDE ANTES DEL SALUDO (16-sep-2026)
   ============================================================
   Spec: docs/ESPEC-UN-NUMERO-CUATRO-FUNCIONES.md, §2. Cada conversación
   nueva en Kommo pasa primero por aquí, callada. Con el primer mensaje
   se decide UNA de cuatro salidas y Kommo hace el resto con bloques:

     comprobante · llegó una foto, un PDF (o un audio: Kommo no dice cuál)
                   → acuse fijo y parar. Sea quien sea (§4.4).
     espera      · el texto anuncia un pago («te mando el comprobante»)
                   → «Va, mándamelo por aquí» y esperar la foto (§4.4).
     denada      · el mensaje es SOLO un agradecimiento
                   → «De nada, quedo a tus órdenes» y parar (§4.3, opción A).
     saludo      · cualquier otra cosa → el saludo con tres botones (§3).

   Sin IA: son reglas cerradas, y por eso se prueban con frases reales.
   Una pregunta nunca cae en «espera» ni en «denada»: quien pregunta
   quiere respuesta, y esa la da el saludo (botón «Hablar con un agente»)
   o el cerebro de la cotización.
   ============================================================ */
'use strict';

const TEXTOS = require('./_textos-fijos.js');

function limpia(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/[^a-z0-9ñ¿?¡!\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function esPregunta(texto) {
  const t = limpia(texto);
  return /[?¿]/.test(String(texto || '')) ||
    /\b(como|donde|cuando|cuanto|cuantos|cuanta|cuantas|que|cual|cuales|quien|puedo|puedes|pueden|podria|podrian|hay|tienen|tiene|me (?:dices|dicen|pasas|pasan|mandas|mandan|puedes))\b/.test(t);
}

/* ------------------------------------------------------------
   SOLO UN AGRADECIMIENTO
   ------------------------------------------------------------
   Lista sacada de cómo escribe la gente (pláticas reales del almacén y
   del número de prueba), no de mi cabeza. Cuenta como «solo gracias» un
   mensaje corto hecho nada más de estas palabras, con o sin emojis y
   signos. En cuanto trae otra cosa —una pregunta, un dato, un «pero»—
   ya no lo es.
   ------------------------------------------------------------ */
const PALABRAS_DE_GRACIAS = new Set([
  'gracias', 'grax', 'grac', 'gracia', 'thanks', 'muchas', 'muchisimas', 'mil',
  'ok', 'okey', 'okay', 'oki', 'va', 'vale', 'sale', 'listo', 'lista', 'perfecto', 'perfect',
  'excelente', 'genial', 'super', 'buenisimo', 'bien', 'muy', 'amable', 'gentil',
  'de', 'acuerdo', 'entendido', 'enterado', 'recibido', 'anotado', 'claro', 'si', 'sii', 'siii',
  'por', 'la', 'el', 'lo', 'info', 'informacion', 'respuesta', 'atencion', 'ayuda', 'todo', 'tu', 'su',
  /* 19-sep-2026: este número recibe sobre todo agradecimientos de pago
     («gracias por el abono»). Antes traían «palabras de más» y caían al
     cerebro, que solo sabe cotizar. */
  'abono', 'abonos', 'pago', 'pagos', 'deposito', 'comprobante', 'servicio', 'apoyo',
  'amabilidad', 'comprension', 'paciencia', 'confirmacion', 'aviso', 'aviso',
  'quedo', 'pendiente', 'al', 'estamos', 'en', 'contacto', 'saludos', 'buen', 'buenas', 'dia', 'tarde', 'noche', 'noches', 'tardes', 'dias',
  'igualmente', 'bendiciones', 'que', 'este', 'esten', 'les', 'te', 'a', 'ti', 'usted', 'ustedes', 'y', 'un', 'una', 'buena'
]);
const NUCLEO_DE_GRACIAS = /\b(gracias|grax|thanks|ok|okey|okay|oki|va|vale|sale|listo|lista|perfecto|excelente|genial|super|entendido|enterado|recibido|anotado|de acuerdo)\b/;

function soloAgradecimiento(texto) {
  const crudo = String(texto || '');
  if (!crudo.trim()) return false;
  if (esPregunta(crudo)) return false;
  const t = limpia(crudo).replace(/[¿?¡!]/g, ' ').replace(/\s+/g, ' ').trim();
  /* Solo emojis (👍 🙏 ❤️): también es un «gracias». */
  if (!t) return /[\u{1F44D}\u{1F64F}\u{2764}\u{1F60A}\u{1F642}\u{1F44C}\u{1F91D}\u{2705}]/u.test(crudo);
  const palabras = t.split(' ');
  if (palabras.length > 8) return false;
  if (!NUCLEO_DE_GRACIAS.test(t)) return false;
  return palabras.every(function (p) { return PALABRAS_DE_GRACIAS.has(p); });
}

/* ------------------------------------------------------------
   ANUNCIA UN PAGO
   ------------------------------------------------------------
   «te mando el comprobante», «ahí va la ficha», «ya hice la
   transferencia», «adjunto el depósito», «le mando el pago». Hace falta
   un verbo de mandar/hacer Y una palabra de pago, o un verbo de pagar
   conjugado. Una pregunta («¿cómo hago el pago?») no entra.
   ------------------------------------------------------------ */
const PALABRA_DE_PAGO = /\b(comprobante|ficha|transferencia|deposito|pago|abono|voucher|captura|recibo|ticket|anticipo|apartado)\b/;
const VERBO_DE_MANDAR = /\b(te|le|les)?\s?(mando|envio|enviamos|mandamos|paso|pasamos|comparto|adjunto|dejo|anexo|ahi va|ahi te va|aqui va|aqui te va|ahi esta|aqui esta|ahi le va|aqui le va)\b/;
const YA_PAGUE = /\b(ya|acabo de|acabamos de|recien)\s+(hice|hicimos|realice|realizamos|deposite|depositamos|transferi|transferimos|pague|pagamos|mande|mandamos|envie|enviamos|abone|abonamos|depositar|transferir|pagar|abonar|hacer(?:la|lo)?(?: la| el)?(?: transferencia| deposito| pago)?)\b|\b(deposite|transferi|pague|abone|depositamos|transferimos|pagamos|abonamos)\b/;

/* ------------------------------------------------------------
   EL PAGO YA ESTÁ HECHO, SIN VERBO DE MANDAR (19-sep-2026)
   ------------------------------------------------------------
   Caso real, lead 26816888: «Ya quedo el pago completo». `YA_PAGUE` pedía
   un verbo de su lista (hice, deposité, pagué) y «quedó» no estaba, así
   que el mensaje cayó al cerebro y salió una cotización a Mazatlán que
   nadie pidió. Así habla la gente de un pago ya saldado.

   Las tres formas, y lo que las separa de una pregunta o de un «ya
   quedamos» que no habla de dinero: SIEMPRE tiene que haber una palabra
   de pago. «Ya quedó la fecha» no entra.
   ------------------------------------------------------------ */
const COSA_PAGADA = 'pago|pagado|pagada|abono|abonado|deposito|depositado|anticipo|saldo|saldado|cubierto|liquidado|transferencia|contrato';
const YA_QUEDO_PAGADO = new RegExp('\\bya\\s+(?:quedo|quedaron|esta|estan|fue|fueron)\\b[\\s\\wñ]{0,25}\\b(?:' + COSA_PAGADA + ')\\b');
const YA_SE_HIZO = new RegExp('\\bya\\s+se\\s+(?:hizo|hicieron|realizo|efectuo)\\b[\\s\\wñ]{0,15}\\b(?:' + COSA_PAGADA + ')\\b');
const COSA_YA_ESTA = new RegExp('\\b(?:' + COSA_PAGADA + ')\\b\\s+ya\\s+(?:esta|quedo|fue)\\s+(?:hecho|hecha|pagado|pagada|saldado|cubierto|liquidado|realizado)\\b');
const YA_LIQUIDE = /\bya\s+(?:liquide|liquidamos|salde|saldamos|cubri|cubrimos|complete|completamos)\b/;

function anunciaPago(texto) {
  const crudo = String(texto || '');
  if (!crudo.trim() || esPregunta(crudo)) return false;
  const t = limpia(crudo);
  if (YA_PAGUE.test(t)) return true;
  if (YA_QUEDO_PAGADO.test(t) || YA_SE_HIZO.test(t) || COSA_YA_ESTA.test(t) || YA_LIQUIDE.test(t)) return true;
  return VERBO_DE_MANDAR.test(t) && PALABRA_DE_PAGO.test(t);
}

/* ------------------------------------------------------------
   LA DECISIÓN
   ------------------------------------------------------------
   `aviso` es lo que ya leyó `leeAvisoDeWidget`: `mensaje` (texto o
   vacío). Kommo manda el mensaje vacío cuando llega un archivo.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   UN ADJUNTO LLEGA COMO UNA PALABRA (21-sep-2026)
   ------------------------------------------------------------
   El dueño mandó una foto a su chat de pruebas y Kommo se la pasó al bot
   como el texto «imagen»; el bot la trató como texto y contestó «me llegó
   la imagen pero no la puedo ver bien, ¿qué es?». Criterio del dueño:
   «normalmente las fotos son abonos, ajusta ese criterio». Una foto, un
   archivo o un documento = comprobante: acuse de pago, nota al vendedor
   y el bot se hace a un lado. Un audio no se puede leer todavía: se pide
   por texto. Solo cuentan a secas —«imagen», no «imagen del camión»—.
   ------------------------------------------------------------ */
const ADJUNTO = /^\s*(?:imagen|imagenes|imágenes|foto|fotos|photo|image|archivo|documento|document|file|pdf|sticker|ubicaci[oó]n|location|video|vídeo)\s*[.!]?\s*$/i;
const AUDIO = /^\s*(?:audio|nota de voz|voz|voice|ptt)\s*[.!]?\s*$/i;
function esAdjunto(texto) { return ADJUNTO.test(String(texto || '')); }
function esAudio(texto) { return AUDIO.test(String(texto || '')); }

function decide(aviso) {
  const texto = String((aviso && aviso.mensaje) || '');
  if (!texto.trim()) return { modo: 'comprobante', texto: TEXTOS.archivoRecibido, nota: TEXTOS.notaComprobante };
  if (esAdjunto(texto)) return { modo: 'comprobante', texto: TEXTOS.comprobanteRecibido, nota: TEXTOS.notaComprobante };
  if (esAudio(texto)) return { modo: 'comprobante', texto: TEXTOS.audioRecibido, nota: '' };
  /* Anuncia un pago («adjunto transferencia contrato tal»): el bot NO
     contesta y se apaga; queda nota para el vendedor (dictado del dueño,
     17-sep-2026: la gente saluda, manda la foto y escribe el aviso; el
     Salesbot ni ve la foto, así que «mándamelo» era un callejón). */
  if (anunciaPago(texto)) return { modo: 'pago', texto: '', nota: TEXTOS.notaPago };
  if (soloAgradecimiento(texto)) return { modo: 'denada', texto: TEXTOS.deNada, nota: '' };
  return { modo: 'saludo', texto: '', nota: '' };
}

/* ------------------------------------------------------------
   MOLESTO O PIDIENDO PERSONA (spec §5, 16-sep-2026)
   ------------------------------------------------------------
   Dictado: «la primera respuesta que no entiendas o notes que el cliente
   está siendo grosero porque está enojado… ofrécele hablar con alguien de
   verdad y apágate». La IA ya sabe pasar a persona cuando el cliente lo
   pide o está molesto; esto es el candado determinista por si la IA no
   lo hace. Sin segunda oportunidad.
   ------------------------------------------------------------ */
const MOLESTO = /\b(pendej|estupid|idiot|imbecil|tont[oa]s?\b|chinga|chingad|vete a la|verga|mierda|carajo|puta|puto|jodid|mamad|no mames|no manches|inutil|inutiles|basura|porqueria|ridicul)/;
const NO_ENTIENDE = /\b(no (me )?entiendes?|no entiendes nada|no me estas entendiendo|no me (esta|estas) ayudando|no sirves?|no sirve(s)? (de|para) nada|otra vez lo mismo|ya te dije|te lo repito|es la (segunda|tercera|cuarta) vez|eres un bot|es un bot|esto es un bot|robot|maquina)\b/;
const PIDE_PERSONA = /\b(hablar con (una |un |alguna |algun )?(persona|humano|alguien|gente|asesor|agente|vendedor|el dueno|el encargado)|pasame con|comunicame con|quiero (una|a una) persona|persona real|humano real|alguien real|atiendame alguien|que me atienda (alguien|una persona))\b/;
/* «agente» a secas (el saludo del bot v3 dice «escribe agente»), con o sin
   cortesía alrededor: «un agente», «asesor», «humano por favor». */
const SOLO_PERSONA = /^(?:(?:con|quiero|dame|pasame|necesito|por favor|porfa|porfavor|un|una|el|la|al)\s+)*(?:agente|asesor|asesora|persona|humano|humana|vendedor|vendedora|alguien)(?:\s+(?:por favor|porfa|porfavor|real|humano|de verdad|gracias))*\s*$/;

/* ------------------------------------------------------------
   PIDE A UN VENDEDOR POR SU NOMBRE (19-sep-2026)
   ------------------------------------------------------------
   Caso real, lead 26861216: «Agente Carmen cortina por favor», dos veces.
   El bot contestó «aquí no tenemos agente Carmen» y le siguió cotizando,
   porque `SOLO_PERSONA` exige que el mensaje sea «agente» y nada más: con
   un nombre detrás dejaba de valer. Quien llama a alguien por su nombre
   ya sabe con quién quiere hablar, y no es con el bot.

   Las dos formas en que llega: un cargo con el nombre pegado («agente
   Carmen», «señorita Lupita») o un verbo de buscar a alguien («me
   comunico con Carmen», «busco a Lupita»). En las dos, lo que sigue tiene
   que parecer un nombre: si es una palabra común —«ustedes», «la
   empresa», «el chofer»— no está pidiendo a nadie en particular y el bot
   sigue trabajando.
   ------------------------------------------------------------ */
const NO_ES_NOMBRE = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'uno', 'mi', 'su', 'ti', 'usted', 'ustedes',
  'alguien', 'alguno', 'alguna', 'persona', 'personas', 'humano', 'humana', 'gente', 'grupo',
  'agente', 'agentes', 'asesor', 'asesora', 'vendedor', 'vendedora', 'ejecutivo', 'ejecutiva',
  'chofer', 'conductor', 'operador', 'dueno', 'encargado', 'jefe', 'gerente', 'equipo',
  'empresa', 'oficina', 'eurotravel', 'euro', 'travel', 'ventas', 'atencion', 'soporte',
  'informacion', 'info', 'precio', 'precios', 'cotizacion', 'cotizar', 'presupuesto',
  'viajes', 'viaje', 'autobus', 'autobuses', 'camion', 'camiones', 'sprinter', 'unidad', 'unidades',
  'que', 'quien', 'como', 'donde', 'cuando', 'cuanto', 'porfavor', 'porfa', 'favor', 'gracias',
  'si', 'no', 'y', 'o', 'para', 'por', 'con', 'bien', 'semana', 'mes', 'dia', 'dias', 'hoy', 'manana'
]);
/* El cargo con el nombre pegado. El «con la», «el», etc. lo come el
   prefijo opcional del otro patrón; aquí basta el cargo. */
const TITULO_Y_NOMBRE = /\b(?:agente|asesor|asesora|vendedor|vendedora|ejecutiv[oa]|licenciad[oa]|lic|senor|senora|senorita|srita|sr|sra)\s+([a-zñ]{3,})/;
/* El verbo de buscar a alguien. Solo formas explícitas: un «está…» suelto
   cazaría «está bien» y «esta semana». */
const BUSCA_A_ALGUIEN = /\b(?:me comunico con|me comunican con|comunicame con|me pasas? con|pasame con|me puedes? pasar con|busco a|buscaba a|buscando a|hablar con|quiero con)\s+(?:la |el |mi |don |dona |senor |senora |senorita |srita |lic )?([a-zñ]{3,})/;

function pideAAlguienPorSuNombre(texto) {
  const t = limpia(texto);
  if (!t) return false;
  for (const patron of [TITULO_Y_NOMBRE, BUSCA_A_ALGUIEN]) {
    const hallado = patron.exec(t);
    if (hallado && !NO_ES_NOMBRE.has(hallado[1])) return true;
  }
  return false;
}

function pareceMolesto(texto) {
  const crudo = String(texto || '');
  const t = limpia(crudo);
  if (!t) return false;
  if (MOLESTO.test(t) || NO_ENTIENDE.test(t) || PIDE_PERSONA.test(t) || SOLO_PERSONA.test(t.replace(/[¿?¡!]/g, '').trim())) return true;
  if (pideAAlguienPorSuNombre(crudo)) return true;
  /* Gritando: un mensaje de 8 letras o más, todo en mayúsculas, con signos. */
  const letras = crudo.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  return letras.length >= 8 && letras === letras.toUpperCase() && /[!¡?¿]{2,}/.test(crudo);
}

/* ------------------------------------------------------------
   TRES COSAS QUE NO SON DEL BOT (simulación del 17-sep, tanda y)
   ------------------------------------------------------------
   · Dos o más unidades («dos sprinters para 34»): el motor cotiza UNA;
     lo arma una persona.
   · «Quiero retomar mi cotización de la semana pasada» escrito a mano:
     es «Cotización anterior», sin IA → una persona.
   · «Saben qué, ya no, gracias»: se despide; el bot se apaga.
   ------------------------------------------------------------ */
const VARIAS_UNIDADES = /\b(dos|tres|cuatro|2|3|4)\s+(sprinters?|camionetas|vans?|autobuses|camiones|unidades|suburbans?)\b|\b(otra|una segunda)\s+(sprinter|camioneta|unidad)\s+(m[aá]s|aparte|adem[aá]s)/;
const COTIZACION_ANTERIOR = /\b(?:mi cotizaci[oó]n(?: anterior| pasada| de antes)?|cotizaci[oó]n (?:anterior|pasada|de la semana|del mes)|retomar|retomemos|ya me (?:hab[ií]an )?cotiz|me cotizaron|la cotizaci[oó]n que me (?:mandaron|pasaron|dieron))/;
/* «ya no» y «no gracias» solo si cierran el mensaje: «ya no el 14, el 15»
   y «no gracias, pero quiero el precio» no son cancelaciones. */
const CANCELA = /\bya no(?: quiero| queremos| gracias| va| me interesa| nos interesa| lo (?:quiero|queremos|necesito|necesitamos))?\s*$|\bcancel\w*|\bolv[ií]da(?:lo|nlo)\b|\bmejor no\s*$|\bno gracias\s*$|\bd[eé]jalo as[ií]\b|\bno (?:me|nos) interesa\b/;

function pideVariasUnidades(texto) { return VARIAS_UNIDADES.test(limpia(texto)); }
function pideCotizacionAnterior(texto) { return COTIZACION_ANTERIOR.test(limpia(texto)); }
function cancela(texto) {
  const t = limpia(texto);
  return !!t && t.split(' ').length <= 10 && CANCELA.test(t) && !/[?¿]/.test(String(texto || ''));
}

/* ------------------------------------------------------------
   ¿ESTE MENSAJE PIDE COTIZAR UN VIAJE? (19-sep-2026)
   ------------------------------------------------------------
   El saludo de Kommo manda al cerebro TODO lo que no sea un botón, y el
   cerebro solo sabe cotizar. Por eso, el 19-sep, tres clientas que solo
   contestaron al aviso de su abono acabaron con una cotización abierta.
   Dictado del dueño: «si no le picaron a ningún botón y hablaron, el bot
   empieza a cotizar, ¿te diste cuenta?».

   Este es el filtro de entrada: la PRIMERA vez que el cerebro habla en
   una conversación, el mensaje tiene que pedir un viaje. Si no, no se
   adivina: lo atiende una persona.

   A propósito NO vive aquí la lista de destinos —eso lo sabe
   `_destinos.js`, y quien llama la consulta aparte—: aquí solo están las
   palabras con las que la gente pide transporte.
   ------------------------------------------------------------ */
const BOTON_DE_COTIZAR = /^nueva cotizacion$/;
const PIDE_VIAJE = new RegExp(
  /* Solo palabras que hablan de un viaje o de su precio. Los verbos
     sueltos («quiero», «necesito», «ocupo») quedaron FUERA a propósito:
     «quiero saber de mi contrato» no es pedir una cotización, y con
     ellos dentro volvía a colarse al cerebro. «Contrato» tampoco entra,
     por lo mismo: casi siempre habla de uno que ya existe. */
  '\\b(?:cotiz\\w*|presupuest\\w*|precio|precios|costo|costos|tarifa|tarifas' +
  '|rent\\w*|alquil\\w*|apart\\w*|reserv\\w*|disponib\\w*' +
  '|viaje|viajes|excursion|paseo|traslado|tour|itinerario' +
  '|autobus|autobuses|camion|camiones|sprinter|van|vans|camioneta|camionetas|suburban|unidad|unidades|transporte' +
  '|pasajeros|pax)\\b'
);
/* «cuánto sale», «cuánto cuesta», «cuánto me cobran»: preguntas de precio. */
const PREGUNTA_DE_PRECIO = /\bcuanto\s+(?:sale|cuesta|cuestan|es|seria|serian|me\s+(?:sale|cuesta|cobran|saldria))\b/;
/* Un número de gente suelto («somos 45», «45 personas», «para 30»). */
const CUANTA_GENTE = /\b(?:somos|seriamos|para|van|vamos|iremos)\s+\d{1,3}\b|\b\d{1,3}\s*(?:personas|pasajeros|pax|gentes?)\b/;

/* ------------------------------------------------------------
   ¿NOMBRA UN LUGAR QUE CONOCEMOS?
   ------------------------------------------------------------
   Decirle «Vallarta» o «vamos a vta» al bot es pedir una cotización,
   aunque no traiga ni una palabra de las de arriba.

   Se pasa por las DOS puertas que ya existen, y hacen falta las dos:
   `comoDestino` (bot.js) normaliza y entiende las abreviaturas —«vta» es
   Puerto Vallarta—, pero acepta lugares que no están en el catálogo, así
   que por sí sola convertiría «Es sobre mi contrato» en un destino.
   `buscaDestino` (_destinos.js) es el catálogo y no inventa. Juntas:
   se normaliza primero y se comprueba contra el catálogo después.

   Los `require` van perezosos y protegidos, como en `_agente.js`: si
   alguno falta, la respuesta es «no sé», que es la prudente.
   ------------------------------------------------------------ */
function nombraUnLugarDelCatalogo(texto) {
  try {
    const bot = require('../bot.js');
    const destinos = require('./_destinos.js');
    const nombre = bot.comoDestino(String(texto || ''));
    if (!nombre) return false;
    return !!destinos.buscaDestino({ texto: nombre });
  } catch (e) {
    return false;
  }
}

function pideCotizar(texto) {
  const t = limpia(texto);
  if (!t) return false;
  if (BOTON_DE_COTIZAR.test(t)) return true;
  if (PIDE_VIAJE.test(t) || PREGUNTA_DE_PRECIO.test(t) || CUANTA_GENTE.test(t)) return true;
  return nombraUnLugarDelCatalogo(texto);
}

/* ¿Habla de un contrato, un pago o un abono que ya existe? Eso no es para
   el bot: lo atiende una persona (21-sep-2026). «¿cuánto hay que pagar?»
   también cae aquí, y está bien: el dinero lo ve una persona. */
const DE_UN_CONTRATO = /\b(?:contrat\w*|abon\w*|anticipo|saldo|pag(?:o|os|ar|ue|amos|ado|ada)|factur\w*|deposit\w*|comprobante\w*|folio|reembols\w*|devoluci\w*|cancel\w*)\b/;
function hablaDeUnContrato(texto) { return DE_UN_CONTRATO.test(limpia(texto)); }

module.exports = { decide, esAdjunto, esAudio, soloAgradecimiento, anunciaPago, esPregunta, limpia, pareceMolesto, pideAAlguienPorSuNombre, pideCotizar, hablaDeUnContrato, pideVariasUnidades, pideCotizacionAnterior, cancela };
