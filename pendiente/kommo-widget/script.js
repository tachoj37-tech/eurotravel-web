/* ============================================================
   EuroBot · el paso del Salesbot que habla con el cerebro (16-sep-2026)
   ============================================================
   Este widget no pinta nada en Kommo: existe para que el Salesbot tenga
   un paso «EuroBot» que le manda cada mensaje del cliente a nuestro
   servidor (`/api/whatsapp/kommo`) y sigue por la salida que el servidor
   diga:

     success → el cerebro sigue platicando: el bot espera el siguiente
               mensaje y vuelve a este mismo paso.
     fail    → el cerebro terminó (entregó el ticket o pidió persona):
               el bot se para y el chat queda con el vendedor.

   Lo que el servidor contesta en `data`:
     status → «sigue» o «fin». Cualquier otra cosa se trata como «fin»,
              para que un error nunca deje al cliente dando vueltas.
     texto  → lo que dice el cerebro; lo pinta el bloque «Mensaje» del
              bot con {{json.texto}}.
     fotos  → la carpeta de la unidad cuyas fotos hay que adjuntar
              («irizar-i6»), o vacío. Las fotos viven en el drive de Kommo
              y aquí abajo va la tabla de uuids (la escribe
              generar-fotos.mjs desde api/_kommo-fotos.json). Dictado del
              dueño: «fotos reales, no links».
     pie    → el texto que acompaña a la primera foto.
   ============================================================ */
define(['jquery'], function ($) {
  var FOTOS = /* FOTOS:INICIO */ {
      "irizar-i6s": [
        "bd99c39a-eadc-4489-b20f-479e3922574b",
        "baa5f40a-6c1d-4707-a8af-ba15be671c6b",
        "e57cfd3a-bf14-400d-b9b6-7161afc5ff47"
      ],
      "irizar-i6": [
        "b382cae9-aff2-43c1-aa4e-2397910ab2b8",
        "a759f257-707e-400d-b063-82ac604cc291",
        "e31b3169-9484-4e4f-91ba-5f64afbdf14b"
      ],
      "neobus": [
        "9f9d639c-98a0-44db-8c2b-fc6c9f357993",
        "107b01bf-9684-4e47-81dc-db916024086d",
        "f0a54a1a-ab31-47c4-a70f-cab3388d0a20"
      ],
      "g8": [
        "919f9d98-2778-4929-890d-ec1d6e821ace",
        "9114066c-a956-4606-958a-ec22c5a4c34a",
        "7b8dd8c6-3325-4dee-992b-fe12a5d63d12"
      ],
      "irizar-pb": [
        "facf948a-28a9-47b7-9a60-3fbd1a1c42f2",
        "5ececb31-6e39-46a9-87fd-9d7645bf12cf",
        "770d097c-3b48-4831-ab76-6276b7ec61a2"
      ],
      "irizar": [
        "d6979585-1541-4088-bd2d-72418fcb7559",
        "fbc7f099-39d1-4ab3-9e2e-71d9f1833bef",
        "d0812156-41f3-4ef3-bdf3-5d02cad3d137"
      ],
      "sprinter": [
        "1425607b-1656-4d0f-b6e7-74fc3fbce778",
        "a4c63001-ef8a-40d8-9ceb-e68cb7f5cffa",
        "c5465275-4640-4c9a-a9fd-3278e9f83b1d"
      ],
      "suburban": [
        "d239267c-78f1-48f7-93ac-a66b131ba0b2",
        "0484deed-2673-491a-900b-ec072c81a700",
        "52f06bae-4583-4358-ba75-c96db5350431"
      ]
    } /* FOTOS:FIN */;

  /* Un mensaje con una foto del drive, como lo guarda el diseñador de
     bots (mismo formato que el bloque «Mensaje» con adjunto). Va a todos
     los canales del lead: el bot solo corre donde lo dispara el embudo. */
  function conFoto(uuid, texto) {
    return {
      handler: 'send_message',
      params: {
        tag: '', text: texto || '', type: 'external', on_error: null,
        recipient: { type: 'all_contacts', way_of_communication: 'over_all' },
        attachments: [{ type: 'picture', value: uuid, is_external: true }],
        send_to_all_chat_sources: true, chat_sources: [], is_in_starting_block: false
      }
    };
  }

  var CustomWidget = function () {
    var self = this;

    this.callbacks = {
      render: function () { return true; },
      init: function () { return true; },
      bind_actions: function () { return true; },
      settings: function () { return true; },
      onSave: function () { return true; },
      destroy: function () {},
      /* Kommo lo llama al picar «+ Agregar» en el diseñador: aquí se
         declaran las dos salidas del bloque. Sin este callback el
         diseñador truena («reading 'id'») y el bloque sale vacío (16-sep). */
      salesbotDesignerSettings: function ($body, renderRow, params) {
        return {
          exits: [
            { code: 'success', title: 'El cerebro sigue platicando' },
            { code: 'fail', title: 'El cerebro terminó (ticket o persona)' },
            { code: 'silencio', title: 'Terminó sin decir nada (la persona sigue)' }
          ]
        };
      },
      /* Lo que Kommo ejecuta en el servidor cada vez que el bot pasa por
         este bloque. Tres pasos:
           0 · pedirle al cerebro (widget_request) y seguir al 1.
           1 · si `fotos` nombra una carpeta, adjuntar sus fotos (la
               primera con el pie) y seguir al 2; si no, seguir al 2.
           2 · según `status`, salir por success o por fail. */
      onSalesbotDesignerSave: function (handler_code, params) {
        var url = (params && params.url) ? String(params.url) : '';
        var pasoDeFotos = [];
        Object.keys(FOTOS).forEach(function (carpeta) {
          var envios = FOTOS[carpeta].map(function (uuid, i) { return conFoto(uuid, i === 0 ? '{{json.pie}}' : ''); });
          if (!envios.length) return;
          pasoDeFotos.push({
            handler: 'conditions',
            params: {
              logic: 'and',
              conditions: [{ term1: '{{json.fotos}}', term2: carpeta, operation: '=' }],
              result: envios.concat([{ handler: 'goto', params: { type: 'question', step: 2 } }])
            }
          });
        });
        pasoDeFotos.push({ handler: 'goto', params: { type: 'question', step: 2 } });

        var flujo = [
          {
            question: [
              {
                handler: 'widget_request',
                params: {
                  url: url,
                  data: {
                    from: 'kommo',
                    message: '{{message_text}}',
                    lead_id: '{{lead.id}}',
                    contact_name: '{{contact.name}}',
                    contact_phone: '{{contact.phone}}',
                    talk_id: '{{talk.id}}'
                  }
                }
              },
              { handler: 'goto', params: { type: 'question', step: 1 } }
            ]
          },
          { question: pasoDeFotos },
          {
            question: [
              /* Terminó sin nada que decir (p. ej. «sí, todo bien» después
                 del ticket): salida «silencio», sin mensaje vacío. */
              {
                handler: 'conditions',
                params: {
                  logic: 'and',
                  conditions: [{ term1: '{{json.callado}}', term2: 'si', operation: '=' }],
                  result: [{ handler: 'exits', params: { value: 'silencio' } }]
                }
              },
              {
                handler: 'conditions',
                params: {
                  logic: 'and',
                  conditions: [{ term1: '{{json.status}}', term2: 'sigue', operation: '=' }],
                  result: [{ handler: 'exits', params: { value: 'success' } }]
                }
              },
              { handler: 'exits', params: { value: 'fail' } }
            ]
          }
        ];
        return JSON.stringify(flujo);
      }
    };
    return this;
  };
  return CustomWidget;
});
