# Fase 0 · La limpia: lo que se encontró al recorrer la página

Recorrido del **12-sep-2026**, en el worktree `pagina-web`, contra el
servidor local en `http://localhost:5175`. En computadora (1280×720) y en
celular (375×812).

Lo que pidió el dueño, y que es lo que se hizo:

> «Vamos a hacer una limpia en la que vas a ver que todo el cotizador
> funcione correctamente. Vas a ver que todos los botones funcionen
> perfectamente: los inicios de sesión, las contraseñas y el resend.»

La batería que vigila todo esto es **`pruebas/probar-recorrido.cjs`** (31
comprobaciones). Corre sola dentro de `node pruebas/correr-todas.cjs`.

---

## 1 · Lo que estaba roto, y ya no

### Dos unidades salían con la foto rota

**Dónde se veía:** el Marcopolo Paradiso G8 y el Irizar Century, en la
pestaña *Unidades* —y en la ficha que abre al picarlas, y en la tarjeta
del resultado del cotizador—. Tres lugares, o sea todos los que las
enseñan. En computadora y en celular igual.

**Qué pasaba:** las dos se dieron de alta en `unidades.js` con `img: 'g8'`
e `img: 'irizar'`, pero nadie las puso en `window.IMGS`, que es donde la
página busca la ruta. El HTML se arma con `I[u.img] || ''`, así que lo que
se dibujaba era `src=""`: el ícono de imagen rota —y de paso el navegador
vuelve a pedir la página entera creyendo que es una imagen—.

**Lo que dolía de más:** las fotos SÍ existían, en `img/unidades/g8/` y
`img/unidades/irizar/`. No faltaba nada; faltaba el renglón.

**Arreglo:** dos renglones en `window.IMGS`. La del G8 es la `01`, el
exterior de tres cuartos que ya estaba escogido a propósito para salir
junto al precio (ver `medios-unidades.js`).

> La prueba no cuida esos dos renglones: cuida que **ninguna unidad que la
> página enseñe se quede sin foto**. La siguiente que se dé de alta no
> puede repetirlo.

### «Cotizar esta unidad», en el inicio, no llevaba la unidad

**Dónde se veía:** las tres bandas del inicio —Renta de autobuses, Renta de
Sprinters, Renta de Suburbans—. El cliente lee media pantalla sobre una
unidad, pica el botón, y llega al cotizador **con el selector vacío**, a
elegirla otra vez.

El mismo texto, en la ficha de la galería, sí la llevaba. Dos
comportamientos distintos con las mismas palabras.

**Arreglo:** cada botón trae ahora `data-unidad`, y el manejador de
`[data-go]` la pone antes de cambiar de vista. Se probó: al picar cada uno,
el selector queda en la unidad y el botón de cotizar hasta cambia su texto
solo —«Cotizar» para la Sprinter, «Solicitar cotización» para las que no se
cotizan solas—.

> **ESTO NECESITA UNA PALABRA DEL DUEÑO.** La banda de autobuses habla de
> cuatro modelos, así que hubo que escoger con cuál se abre: va el **G8**,
> por ser el primero del catálogo y el más nuevo del parque. Si prefiere
> otro —el i6S de 2023, el Century— se cambia un atributo en el HTML y ya;
> está marcado con un comentario que lo dice.

### «Entrar» con los campos vacíos le echaba la culpa al cliente

**Dónde se veía:** en los dos «Entrar» —el del modal de la barra y el de la
pantalla de pago—. Sin escribir nada, el botón mandaba la petición y
contestaba:

> «Ese correo o esa contraseña no son.»

No escribió ninguno de los dos. El mensaje era falso, y además gastaba una
petición del freno por IP: el mismo freno que está para frenar a quien de
verdad anda adivinando contraseñas.

Crear cuenta y «olvidé mi contraseña» ya lo hacían bien —avisan qué falta y
no mandan nada—, así que ni siquiera había que inventar el texto.

**Arreglo:** los dos avisan «Escribe tu correo.» / «Escribe tu contraseña.»
y no mandan nada. Comprobado en el navegador: **0 peticiones** con los
campos vacíos, y la petición sigue saliendo normal cuando los dos están
llenos.

### El código del correo se mandaba a medias

**Dónde se veía:** en las tres pantallas que piden código —la de pago, la
del modal de la barra y la de la contraseña nueva—. Con tres dígitos
tecleados, el botón mandaba «123».

**Qué dolía:** el servidor aguanta **cinco intentos** y después cierra
(`probar-acceso.cjs`, `probar-olvide.cjs`). Un código a medias gastaba uno
de esos cinco sin que el cliente se hubiera equivocado de código.

**Arreglo:** las tres avisan «Faltan dígitos del código.» y no mandan nada
hasta que estén las seis casillas.

---

## 2 · Lo que se encontró flojo y NO se arregló aquí

### El cotizador acepta un teléfono que no es teléfono

En el paso de *Tus datos*, con **teléfono `12`** y **correo
`no-es-correo`** el formulario pasa al resumen sin decir nada, y esos datos
llegan tal cual al resumen y al mensaje de WhatsApp. `validaDatos()` solo
mira que el campo no esté vacío.

Hoy no truena nada porque el resumen se lo manda el cliente por su cuenta.
**En la fase 2 sí truena**: ahí el teléfono deja de ser un dato de adorno y
se vuelve el único hilo que queda con un cliente al que no se le pudo dar
precio. Un teléfono mal tecleado va a ser, exactamente, un cliente perdido.

**Por eso se deja anotado y no se arregla aquí:** la fase 2 va a rehacer
ese paso entero, y el formato que hay que exigir depende de por dónde se le
vaya a escribir.

### El aviso bueno del reenvío sale vestido de error

Al picar «No me llegó — mándame otro», el aviso de que sí se mandó —«Listo,
va otro código en camino.»— se escribe en el mismo renglón de los errores,
que es rojo (`#db0d0d`), y las casillas se quedan marcadas en rojo de la
equivocación anterior. La buena noticia se lee como una mala.

Es cosmético, no rompe nada, y toca el color de un componente que también
usan otras pantallas. Se deja para cuando se toque esa parte.

### Crear cuenta no revisa el correo ni el largo de la contraseña

`cta-a-crear` comprueba que nombre y correo no estén vacíos, pero no que el
correo tenga forma de correo ni que la contraseña llegue a 8 caracteres. El
servidor los rechaza bien —así salió el mensaje «La contraseña necesita al
menos 8 caracteres»—, o sea que **no hay hueco de seguridad**: hay un viaje
de ida y vuelta que se pudo haber ahorrado, y una contraseña débil que se
pudo no haber mandado por la red.

---

## 3 · Lo que se probó y está sano

Esto no es «no lo revisé»: es «lo revisé y funciona».

| | |
|---|---|
| Errores de consola al cargar | **0** |
| Peticiones | **30, todas en 200** |
| Imágenes rotas | **0** (eran 2) |

**Las cinco pestañas** y sus cinco vistas: inicio, unidades, cotizaciones,
sobre nosotros, contacto. Cada `data-go` apunta a una vista que existe.

**Unidades:** los cuatro filtros (Todas, Autobuses, Sprinter, Suburban)
enseñan y esconden lo que deben. Las ocho fichas abren con su texto, sus
características y su mapa de asientos. El i6 de 51 sigue fuera de la página
a propósito (`soloBot`), que es lo que se acordó.

**El calendario:** los días de antes de hoy salen apagados y no se pueden
picar; el rango de ida y vuelta se pinta entero; las horas quedan en 08:00
y 18:00; «solo ida» quita el regreso. En celular hay que deslizar un poco
para alcanzar «Listo» —se alcanza, pero queda debajo del borde al abrirlo—.

**El cotizador, de punta a punta:**

- Guadalajara → Puerto Vallarta, Sprinter, 20 al 23 sep: **$19,000**, que
  es el del criterio. Con sus cuatro días de servicio y su desglose.
- El mismo viaje con un **camión** (Irizar i6S): no da número. Dice «Esta
  unidad se cotiza a la medida: te respondemos el mismo día hábil» y el
  resumen final ya no ofrece apartar —solo mandar la solicitud—. Ese freno
  ya estaba bien puesto.
- Los obligatorios se reclaman: sin nombre, sin teléfono o sin punto de
  salida no se pasa al resumen.
- Los botones «Enviar por WhatsApp» y «Enviar por correo» arman la ficha
  completa del viaje en el texto del mensaje.

**La cuenta:** crear cuenta con su código de seis casillas; pegar los seis
dígitos de un jalón en la primera casilla los reparte bien; un **código
equivocado** pinta las casillas de rojo, las vacía y deja el cursor en la
primera; un **código vencido** enseña lo que contesta el servidor; el
**reenvío** manda otro; «olvidé mi contraseña» no dice si el correo tiene
cuenta o no —«*Si* ese correo tiene cuenta…»—, que es justo lo que debe
decir; y la contraseña nueva se rechaza si no llega a 8 caracteres.

**El chat de la página** abre, contesta y cierra. (Su motor es del bot y va
por otra rama; aquí solo se comprobó la cáscara.)

**El carrusel de destinos** del inicio: los cuatro puntos cambian la ficha.

**En celular:** ninguna vista desborda la pantalla a lo ancho. La barra de
pestañas se desliza —«Contacto» queda fuera del borde a 375 px y hay que
empujarla para verla; se alcanza, pero no se anuncia—. Los modales de
origen y destino se ven completos, con su botón de confirmar a la vista.

---

## 4 · Dos cosas que parecían bugs y no lo eran

Quedan escritas para que nadie las vuelva a perseguir:

1. **«El Enter no manda el mensaje del chat.»** El navegador de las pruebas
   no genera el envío implícito de un formulario: se comprobó con un
   formulario de control, hecho al vuelo, y tampoco se mandó. El `<form>`
   del chat está bien armado, con su botón `type="submit"`.

2. **«La página pide `/api/cuenta` dos veces al cargar.»** Son dos acciones
   distintas: `yo` —preguntar si hay sesión— y `config` —preguntar si
   Google está configurado, para dibujar su botón—. No es una repetida.

También conviene saber que **las capturas de pantalla de este navegador se
quedan atrasadas** respecto al DOM: más de una vez enseñó media pantalla en
blanco donde la página estaba bien. Lo que se mide con JavaScript sí es de
fiar; lo que sale en una captura, conviene confirmarlo.
