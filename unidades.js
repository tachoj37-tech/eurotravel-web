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
  /* ------------------------------------------------------------
     EL G8 · la más nueva, dada de alta el 4-sep-2026
     ------------------------------------------------------------
     51 pasajeros, modelo 2026, premium. Dictado del dueño.

     VA SIN FOTOS TODAVÍA, y eso está marcado con `sinFotos` en vez de
     dejarlo al descubrimiento. El bot enseña la foto de la unidad
     junto con el precio —efecto dotación— y una unidad sin fotos
     rompería justo ese momento. Con la marca, el bot la ofrece
     normal y simplemente no promete foto; el día que lleguen se
     quita la marca y se enseña sola.

     EL NOMBRE salió de las fotos, no de suponer. Se llegó a pensar que
     sería un Irizar i8 —porque el resto de la flota es Irizar— y era
     falso: en el techo dice «Paradiso 1200», abajo «Marcopolo», y en
     el costado trae el badge «G8». La segunda foto está tomada en la
     planta de Marcopolo. Es un **Marcopolo Paradiso G8**.

     Vale la pena que quede escrito: la suposición era razonable y aun
     así estaba mal. Un nombre de unidad se lee de la unidad.

     Y ES EL ÚNICO CON AÑO. Los demás no lo llevan porque de cada
     modelo hay varias unidades de años distintos —el Century a veces
     es 2007, el i6 puede ser 2023 o 2017—. De este hay uno y es 2026.
     ------------------------------------------------------------ */
  { id: 'g8', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Premium', name: 'Marcopolo Paradiso G8', cap: '51 pasajeros', max: 51, modelo: 2026, img: 'g8',
    desc: 'La unidad más nueva del parque, modelo 2026. Línea premium: lo más cómodo que tenemos para grupos grandes.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Asientos reclinables'],
    spec: [['i-users', '51 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-seat', 'Asientos reclinables'], ['i-shield', 'Seguro de viajero incluido']] },
  /* SIN AÑO, Y ES A PROPÓSITO · corregido por el dueño el 4-sep-2026.
     Traía `modelo: 2023` y se quitó:

       «el Century a veces es 2007 y el i6 puede ser 2023 o 2017.
        Yo que tú, esos ni les pongo año. Punto.»

     De cada modelo hay VARIAS unidades y de años distintos. Prometer
     «2023» y que llegue la de 2017 es la misma falla que prometer 49
     asientos y que lleguen 47: se descubre el día del viaje, cuando ya
     no se puede arreglar.

     El único que lleva año es el G8, porque de ése hay uno y es de
     2026. Quien no tiene año garantizado, no enseña año. */
  { id: 'irizar-i6s', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Premium', name: 'Irizar i6S', cap: '51 pasajeros', max: 51, img: 'i6s', full: 'hero2', seat: 'seat_i6s',
    desc: 'Comodidad, tecnología y diseño para viajes con estilo. Diseño aerodinámico, acabados premium y suspensión avanzada para un trayecto suave, seguro y placentero.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Asientos reclinables', '2 puertas'],
    spec: [['i-users', '51 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-seat', 'Asientos reclinables con descansapiés'], ['i-bag', 'Amplia capacidad de equipaje'], ['i-shield', 'Seguro de viajero incluido'], ['i-route', 'Suspensión avanzada'], ['i-briefcase', 'Ideal para giras y viajes ejecutivos']] },
  /* 47, NO 51 · Verificado el 2-sep-2026 en la página oficial: el
     número viene en grande y el diagrama numera los asientos hasta
     el 47. Antes decía «47 a 51» con `max: 51`, y con eso el bot le
     habría dicho a un grupo de 50 que sí cabía —tres personas
     paradas el día del viaje—. Lo mismo aplica al PB, abajo.

     Nota de método: la primera lectura de esa página dio «Pasajeros
     0», porque la capacidad es un contador animado y el texto crudo
     trae el valor de antes de la animación. Un número que sale en
     cero se mira, no se copia. */
  /* PREMIUM, igual que el i6S · Dictado del dueño el 4-sep-2026:
     «utiliza todo lo i6, que es premium, ya sea sin S o con S». Decía
     «Turismo», que lo ponía un escalón abajo del i6S y no lo está: son
     el mismo camión, y el bot los estaba ofreciendo como si uno fuera
     mejor que el otro. */
  { id: 'irizar-i6', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Premium', name: 'Irizar i6', cap: '47 pasajeros', max: 47, img: 'i6', full: 'hero1',
    desc: 'La misma línea premium del i6S: espacio, silencio de marcha y equipamiento completo para trayectos largos.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Pantallas', 'Audio'],
    spec: [['i-users', '47 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-tv', 'Pantallas y sistema de audio'], ['i-seat', 'Asientos reclinables'], ['i-bag', 'Cajuela amplia'], ['i-shield', 'Seguro de viajero incluido'], ['i-pin', 'Monitoreo GPS']] },
  /* 47 · Misma verificación y misma razón que el i6 de arriba. */
  /* NO es «larga distancia» · Dictado del dueño el 4-sep-2026: «el PB
     no es de la distancia, no lo pongas así». Va un escalón arriba del
     Century y a la par del Neobus. La etiqueta anterior lo mandaba a
     una categoría que no existe en el negocio, y con eso el bot se lo
     recomendaba a quien iba lejos aunque no fuera lo que le convenía. */
  /* 47, confirmado por el dueño y por el sitio oficial el 4-sep-2026.
     Y es «como un Century mejorado, tantito más chido» — palabras
     suyas—: un escalón arriba del Century y a la par del Neobus. */
  { id: 'irizar-pb', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Turismo', name: 'Irizar PB', cap: '47 pasajeros', max: 47, img: 'pb', full: 'hero3',
    desc: 'Un escalón arriba del Century: piso alto, más visibilidad para el pasajero y bodega generosa para grupos con mucho equipaje.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Piso alto', 'Bodega amplia'],
    spec: [['i-users', '47 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-seat', 'Asientos reclinables'], ['i-bag', 'Bodega de gran capacidad'], ['i-tv', 'Pantallas'], ['i-shield', 'Seguro de viajero incluido'], ['i-route', 'Óptimo para viajes de varios días']] },
  /* UN ESCALÓN ARRIBA DEL PB · precisado por el dueño el 4-sep-2026:
     «el Neobus es un poquito mejor que el PB y tiene más asientos».
     Primero se había entendido que iban a la par y no: va encima.

     «Gran Turismo» no es un invento de aquí — es como se clasifica el
     servicio de autobús en México, justo el escalón arriba de
     «Turismo». Nombra el nivel sin inventarse una categoría. */
  { id: 'neobus', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Gran Turismo', name: 'Neobus', cap: '50 pasajeros', max: 50, img: 'neobus', seat: 'seat_neobus',
    desc: 'Un escalón arriba del PB, y el que más asientos tiene después del premium: cómodo para traslados de personal, viajes escolares y recorridos de varios días.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Pantallas', 'Reclinables'],
    spec: [['i-users', '50 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-tv', 'Pantalla y sistema de audio'], ['i-seat', 'Asientos reclinables'], ['i-bag', 'Espacio para equipaje'], ['i-shield', 'Seguro de viajero incluido'], ['i-cap', 'Muy usado en viajes escolares']] },
  /* ------------------------------------------------------------
     EL CENTURY · dado de alta el 4-sep-2026
     ------------------------------------------------------------
     Llevaba meses existiendo sin estar aquí. Estaba en el sitio
     oficial —`/renta/autobuses/irizar/`—, tenía sus seis fotos y su
     video bajados en `img/unidades/irizar/`, y hasta tenía su renglón
     en el Excel de precios (`DOMINICAL CENTURY`). Lo único que no
     tenía era estar en el catálogo, y por eso el bot no lo podía
     ofrecer: una unidad completa que no vendía.

     El sitio oficial la llama nada más «Irizar», que no distingue —
     hay otras tres Irizar. Aquí lleva su nombre de modelo, que es
     como el dueño la nombra y como se distingue de verdad.

     CÓMO SE VENDE, dictado del dueño: *«el Century es la unidad menos
     cara. No te refieras a ella como la más barata, sino que más se
     alinea a un presupuesto corto»*. La diferencia no es de cortesía:
     «la más barata» le dice al cliente que va a viajar peor, y el que
     la renta la renta apenado. Hay una prueba que lo vigila para todo
     el catálogo.

     47 pasajeros, confirmado dos veces: lo dijo el dueño y lo dice su
     página. El contador de la página sale en 0 si se lee antes de que
     acabe la animación — pasó la primera vez que se leyó, y por eso
     el número se saca del texto y no del contador.

     HAY DOS CENTURYS DE 49, y aun así aquí dice 47. No es un
     descuido: el dueño lo aclaró el 4-sep-2026 y el número que el bot
     puede prometer es el que aguantan TODOS, no el del mejor. Si
     dijera 49 y llegara uno de 47, dos personas se quedan paradas el
     día del viaje — y ésa no se corrige después. Prometer de menos no
     cuesta nada; prometer de más cuesta el viaje.
     ------------------------------------------------------------ */
  { id: 'irizar', cat: 'autobus', cotizadorAutomatico: false, tag: 'Autobús · Clásico', name: 'Irizar Century', cap: '47 pasajeros', max: 47, img: 'irizar',
    desc: 'Autobús completo y de trato sencillo: el que mejor se ajusta cuando el presupuesto del grupo es corto, sin recortar lo que importa — aire, baño y seguro de viajero.',
    amen: ['Aire acondicionado', 'Baño a bordo', 'Asientos reclinables', 'Cajuela amplia'],
    spec: [['i-users', '47 pasajeros'], ['i-snow', 'Aire acondicionado'], ['i-wc', 'Baño a bordo'], ['i-seat', 'Asientos reclinables'], ['i-bag', 'Cajuela amplia'], ['i-shield', 'Seguro de viajero incluido'], ['i-route', 'Sirve igual para un día que para varios']] },
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
