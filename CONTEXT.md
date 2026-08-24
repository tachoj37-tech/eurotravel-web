# El vocabulario de la página

Los nombres con los que habla este repositorio. Si un módulo nuevo necesita un
concepto que no está aquí, se agrega aquí primero.

| Término | Qué es |
|---|---|
| **Viaje** | Lo que el visitante arma en el paso 1: origen, destino, fechas, unidad y si es redondo. Vive en la máquina de cotización; la pantalla solo lo pinta. |
| **Lugar** | Una punta del viaje. Trae `place` (nombre, estado, tipo del catálogo), y si el visitante afinó, `placeId`/`coords`/dirección de Google. `aprox: true` significa «es el centro del destino, no una dirección» — de ahí sale el aviso de *esta cifra puede afinarse*. |
| **La máquina de cotización** | `cotizacion.js`. El módulo profundo del sitio: valida el borrador, compromete el viaje, corre la carrera de «gana la última búsqueda» y habla con `/api/cotizar`. Se prueba en Node (`npm run probar`) con un `pide` inyectado. |
| **Cotización** | La respuesta guardada del cotizador: días, total, anticipo, saldo. Pasa por **lista blanca** al guardarse. |
| **La regla del kilómetro** | El cliente nunca ve la tarifa por kilómetro ni los kilómetros — con total y kilómetros juntos, la tarifa se saca dividiendo. Del lado del servidor la aplica `_tarifa.js` (separación `interno`/externo); del lado del navegador, la lista blanca de la máquina. |
| **Unidad** | Una entrada de `unidades.js` (fuente única del catálogo). `cotizadorAutomatico` decide si enseña precio en línea o se **cotiza a la medida**. |
| **Solicitud** | Lo que sale al final del paso 3: el resumen que se manda por WhatsApp o correo, o el pago del anticipo por `/api/pagar` — que **recalcula** con `_tarifa.js` y jamás confía en un total del navegador. |
| **Movimientos** | Los traslados dentro del destino, por día, capturados en el paso 2. |
| **Folio** | Lo asigna EuroSystem al crear el contrato; la página solo lo enseña. La única puerta entre página y sistema es `POST /api/contratos/externo`. |
