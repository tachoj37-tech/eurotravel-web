/* ============================================================
   La puerta de la IA del chat
   ------------------------------------------------------------
       POST /api/entender   { mensaje: "..." }
       -> { intencion, gente, unidad, destino, origen,
            salida, regreso, soloIda, ocasion, respuesta }

   El chat NO llama aquí en cada mensaje. Llama SOLO cuando
   `bot.js` ya se rindió — el campo `noEntendio` de su respuesta.

   Eso es a propósito y es la mitad del diseño:

     · El guion entiende el 95 % de lo que escribe la gente
       —«hola», «somos 15», «cuánto cuesta», y todo eso mal
       escrito— sin gastar una llamada.
     · Solo el 5 % raro llega hasta aquí.
     · Si la IA falla, o no hay clave, o se acaba la cuota, el bot
       sigue contestando. La IA MEJORA el bot; no lo sostiene.

   ------------------------------------------------------------
   POR QUÉ ESTA FUNCIÓN VALE UN LUGAR DE LOS DOCE
   ------------------------------------------------------------
   El plan Hobby de Vercel deja 12 funciones y con ésta se llenan.
   El lugar lo estaba esperando el webhook de WhatsApp, que sigue
   en `pendiente/`.

   Se decidió así porque el orden lo puso el dueño: primero que el
   chat de la página venda bien, WhatsApp al final. Cuando toque
   WhatsApp habrá que subir de plan o mover algo.

   ------------------------------------------------------------
   LA CLAVE
   ------------------------------------------------------------
   `ANTHROPIC_API_KEY`, puesta por el dueño en Vercel. NUNCA en un
   archivo ni en un mensaje. Si no está, esta puerta contesta
   `{ hayIA: false }` y el chat sigue igual que siempre.
   ============================================================ */

const defensas = require('./_defensas');
const ia = require('./_entender');

/* Más apretado que el de cotizar, y por una razón distinta: aquí
   cada llamada que pasa CUESTA DINERO en la API de Anthropic. El
   freno no está cuidando el servidor, está cuidando la cuenta.

   12 por minuto le sobran a una persona escribiendo —el guion
   atiende casi todo—, y 300 al día es el techo de lo que este
   chat puede gastar sin que nadie lo note. */
const freno = defensas.creaFreno({ porMinuto: 8, porDia: 120 });

/* ------------------------------------------------------------
   CUÁNTO PUEDE COSTAR ESTO, CON NÚMEROS
   ------------------------------------------------------------
   Modelo Haiku, instrucciones de ~1,100 tokens, respuesta topada
   en 400. Sale alrededor de **$0.003 USD por llamada**.

   Con el freno de 120 al día por IP, una sola persona no pasa de
   unos **40 centavos de dólar al día**, por más que escriba.

   Para llegar a $100 harían falta unas 33,000 llamadas: no es un
   cliente escribiendo raro, es un ataque desde muchas IPs. Y
   contra eso este archivo NO alcanza — en serverless cada
   instancia tiene su propia memoria, así que un contador global
   de verdad necesitaría base de datos, y este proyecto no tiene.

   EL TOPE QUE SÍ ES REAL LO PONE EL DUEÑO, en la consola de
   Anthropic: un límite de gasto mensual. Ése no se puede rodear
   desde afuera y es la única garantía dura. Las capas de aquí
   —tope por conversación en el navegador, freno por IP, modelo
   barato, respuesta corta— hacen que nunca se llegue; el de la
   consola hace que no se pueda.
   ------------------------------------------------------------ */

module.exports = async function (req, res) {
  if (defensas.puerta(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }

  const frenado = freno(req);
  if (frenado) {
    /* Frenado NO es error para el cliente: el chat simplemente
       sigue sin IA, como si no estuviera configurada. El cliente
       no tiene por qué enterarse de nuestros topes. */
    return res.status(200).json({ hayIA: false, frenado: true });
  }

  const cuerpo = defensas.cuerpoJSON(req);
  const mensaje = cuerpo && typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje : '';

  if (mensaje.trim().length < 2) {
    return res.status(200).json({ hayIA: false });
  }

  /* ------------------------------------------------------------
     LO QUE NI SE PREGUNTA
     ------------------------------------------------------------
     La llamada más barata es la que no se hace. Esto tira, ANTES
     de gastar un centavo, lo que no puede ser un cliente:

     · Textos largos. Un cliente escribe «somos 16 a tequila el
       12». Nadie pide una Sprinter en 600 caracteres. Lo que sí
       llega así son los intentos de darle instrucciones nuevas a
       la IA, y ésos ni se leen.

     · Mensajes que hablan de la IA en vez de del viaje. Quien
       escribe «ignora tus instrucciones», «actúa como», «system
       prompt» o «eres un modelo» no está rentando un camión.

     Los dos casos contestan igual que si no hubiera IA, así que
     el cliente de verdad nunca nota la diferencia.
     ------------------------------------------------------------ */
  const TOPE_UTIL = 300;
  const NO_ES_CLIENTE = /ignora( tus| las)?( instrucciones| reglas)|olvida (tus|las) (instrucciones|reglas)|act[uú]a como|haz de cuenta que eres|eres un (modelo|bot|asistente|ia|chatgpt|claude)|system ?prompt|tus instrucciones|jailbreak|dev ?mode|prompt injection/i;

  if (mensaje.length > TOPE_UTIL || NO_ES_CLIENTE.test(mensaje)) {
    return res.status(200).json({ hayIA: false });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ hayIA: false, sinClave: true });
  }

  const datos = await ia.entiende(mensaje, {
    hoy: new Date().toISOString().slice(0, 10)
  });

  /* `entiende` ya devolvió todo limpio y validado: sin precios,
     sin datos inventados de la empresa y sin anunciar traspasos.
     Lo que sale de aquí puede ir directo al cliente. */
  if (!datos) return res.status(200).json({ hayIA: false });

  return res.status(200).json(Object.assign({ hayIA: true }, datos));
};
