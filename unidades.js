/* ============================================================
   Catálogo de unidades — FUENTE ÚNICA
   ------------------------------------------------------------
   Todo el sitio lee de aquí: las fichas de la sección Unidades,
   el selector de tipo de unidad del buscador y el desplegable
   del formulario. Para dar de alta una unidad, agrégala en esta
   lista y aparecerá sola en los tres lugares.

   cotizadorAutomatico: true  -> muestra precio y permite pagar en línea
                        false -> solo "Solicitar cotización"
   ============================================================ */

window.UNIDADES = [
  { id: 'irizar-i6s', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Premium', name: 'Irizar i6S', cap: '51 pasajeros', max: 51, img: 'i6s', full: 'hero2', seat: 'seat_i6s',
    desc: 'Comodidad, tecnología y diseño para viajes con estilo. Diseño aerodinámico, acabados premium y suspensión avanzada para un trayecto suave, seguro y placentero.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Asientos reclinables', '2 puertas'],
    spec: [['i-users', '51 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-seat', 'Asientos reclinables con descansapiés'], ['i-bag', 'Amplia capacidad de equipaje'], ['i-shield', 'Seguro de viajero incluido'], ['i-route', 'Suspensión avanzada'], ['i-briefcase', 'Ideal para giras y viajes ejecutivos']] },
  { id: 'irizar-i6', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Turismo', name: 'Irizar i6', cap: '47 a 51 pasajeros', max: 51, img: 'i6', full: 'hero1',
    desc: 'El caballito de batalla para excursiones y viajes foráneos: espacio, silencio de marcha y equipamiento completo para trayectos largos.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Pantallas', 'Audio'],
    spec: [['i-users', '47 a 51 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-tv', 'Pantallas y sistema de audio'], ['i-seat', 'Asientos reclinables'], ['i-bag', 'Cajuela amplia'], ['i-shield', 'Seguro de viajero incluido'], ['i-pin', 'Monitoreo GPS']] },
  { id: 'irizar-pb', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Larga distancia', name: 'Irizar PB', cap: '47 a 51 pasajeros', max: 51, img: 'pb', full: 'hero3',
    desc: 'Unidad de piso alto pensada para carretera: mayor visibilidad para el pasajero y bodega generosa para grupos con mucho equipaje.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Piso alto', 'Bodega amplia'],
    spec: [['i-users', '47 a 51 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-seat', 'Asientos reclinables'], ['i-bag', 'Bodega de gran capacidad'], ['i-tv', 'Pantallas'], ['i-shield', 'Seguro de viajero incluido'], ['i-route', 'Óptimo para viajes de varios días']] },
  { id: 'neobus', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Grupos grandes', name: 'Neobus', cap: '50 pasajeros', max: 50, img: 'neobus', seat: 'seat_neobus',
    desc: 'Excelente relación costo-beneficio para traslados de personal, viajes escolares y recorridos de uno o varios días.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Pantallas', 'Reclinables'],
    spec: [['i-users', '50 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-tv', 'Pantalla y sistema de audio'], ['i-seat', 'Asientos reclinables'], ['i-bag', 'Espacio para equipaje'], ['i-shield', 'Seguro de viajero incluido'], ['i-cap', 'Muy usado en viajes escolares']] },
  { id: 'sprinter', cat: 'sprinter', cotizadorAutomatico: true, tag: 'Sprinter · Grupos pequeños', name: 'Sprinter', cap: '20 pasajeros', max: 20, img: 'sprinter',
    desc: 'Moderna, segura y funcional. Diseño compacto y elegante para moverse igual de bien en ciudad que en carretera: traslados ejecutivos, eventos y excursiones familiares.',
    amen: ['Aire acondicionado', 'Asientos reclinables', 'Audio', 'Pantalla'],
    spec: [['i-users', '20 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-seat', 'Asientos reclinables'], ['i-tv', 'Pantalla y sistema de audio'], ['i-bag', 'Espacio para equipaje'], ['i-shield', 'Seguro de viajero incluido'], ['i-briefcase', 'Traslados ejecutivos y eventos'], ['i-route', 'Ágil en ciudad y carretera']] },
  { id: 'suburban', cat: 'suburban', cotizadorAutomatico: false, tag: 'Suburban · Ejecutivo', name: 'Suburban', cap: 'Hasta 6 pasajeros', max: 6, img: 'suburban',
    desc: 'Elegancia y comodidad para traslados ejecutivos, recepción de directivos en el aeropuerto y grupos reducidos que viajan con equipaje.',
    /* La pantalla táctil la confirmó el dueño el 29-ago-2026, al preguntarle
       por qué la página decía «Wifi ilimitado» y este catálogo no: dijo
       «interiores de piel y pantalla táctil». El wifi NO lo tiene y se quitó
       de index.html el mismo día. */
    amen: ['Aire acondicionado', 'Servicio ejecutivo', 'Equipaje', 'Chofer'],
    spec: [['i-users', 'Hasta 6 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-seat', 'Interiores en piel'], ['i-tv', 'Pantalla táctil'], ['i-bag', 'Espacio para equipaje'], ['i-plane', 'Traslados aeropuerto'], ['i-shield', 'Seguro de viajero incluido'], ['i-briefcase', 'Servicio ejecutivo puerta a puerta'], ['i-clock', 'Disponible por horas']] }
];
