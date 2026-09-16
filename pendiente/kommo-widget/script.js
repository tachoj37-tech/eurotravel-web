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

   Lo que el servidor contesta (`data.status`) es lo que decide la salida:
   «sigue» o «fin». Cualquier otra cosa se trata como «fin», para que un
   error nunca deje al cliente dando vueltas con el bot.
   ============================================================ */
define(['jquery'], function ($) {
  var CustomWidget = function () {
    var self = this;

    this.callbacks = {
      render: function () { return true; },
      init: function () { return true; },
      bind_actions: function () { return true; },
      settings: function () { return true; },
      onSave: function () { return true; },
      destroy: function () {},
      onSalesbotDesignerSave: function (handler_code, params) {
        var url = (params && params.url) ? String(params.url) : '';
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
          {
            question: [
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
