# Formato: qué se prueba antes de subir la página

**19-sep-2026.** La lista que se recorre **completa** antes de cada lanzamiento
o cambio grande. No es burocracia: cada renglón está aquí porque algo se rompió
por no revisarlo.

Regla de la casa: **una casilla solo se palomea con la evidencia enfrente.**
«Debería funcionar» no cuenta. Si algo no se pudo probar, se escribe «NO
PROBADO» y se dice por qué; nunca se deja en blanco como si hubiera pasado.

Cómo usarlo: se copia esta lista, se llena la fecha y se van palomeando.
Al final se guarda con lo que salió.

---

## Antes de empezar

- [ ] `npm run probar` en verde. Anotar el número: ______ buenas, ______ malas
- [ ] `git status` limpio y todo subido a `main`
- [ ] El despliegue de Vercel en **Ready**, no en Error
- [ ] El HTML publicado trae el cambio (buscar una frase nueva con `curl`)

---

## 1 · El dinero

Lo que más caro cuesta si falla. Se prueba **siempre**, aunque el cambio no lo
toque.

- [ ] Cotizar una Sprinter da el precio correcto del criterio. Ruta y monto: ______
- [ ] Un autobús **no** da precio: manda al vendedor
- [ ] «Pagar anticipo» abre Stripe con el monto del anticipo, no el total
- [ ] El webhook rechaza una firma inventada (debe contestar **400**)
- [ ] Un pago de la página vieja que caiga en nuestro webhook se contesta «ajeno» y no mueve nada
- [ ] Antes de abrir el cobro real: `PERMITIR_COBRO_REAL` sigue en `false`

**Con dinero de verdad** (solo en el lanzamiento):

- [ ] Compra real: el contrato nace **confirmado** en EuroSystem
- [ ] El anticipo queda como **abono sin aprobar**
- [ ] Reembolso desde Stripe: el abono se marca revertido y el saldo sube
- [ ] Al cliente le llega el aviso de que su pago se regresó
- [ ] A la oficina le llega el correo, en los dos casos

---

## 2 · Los avisos

- [ ] El correo con folio y contrato en PDF llega a una bandeja **de verdad**
      (Gmail u Outlook), no a la del dueño de Resend
- [ ] No cae en spam
- [ ] El recibo de cada abono llega
- [ ] La ficha del camión llega a los correos de oficina
- [ ] Si hay WhatsApp conectado: llega el mensaje y **no** llega cuando el pago
      no está confirmado

---

## 3 · El recorrido del cliente

Se hace de corrido, como si uno fuera a comprar.

- [ ] Cotizar → Continuar → datos → resumen → pagar, sin atorones
- [ ] El correo es obligatorio cuando el viaje se paga en línea
- [ ] Volver desde Stripe **no borra** la cotización
- [ ] «Abona a tu viaje»: con contrato y apellido enseña saldo, abonos y contrato
- [ ] Un apellido con acentos, mayúsculas o la ñ entra igual
- [ ] En el apellido no se pueden teclear números
- [ ] Un folio que no existe dice lo mismo que un apellido equivocado

---

## 4 · La página, con los ojos

- [ ] Ningún botón muerto: cada uno hace algo visible
- [ ] Ninguna imagen rota ni deformada
- [ ] Nada se sale por los lados: el ancho del documento no pasa el de la ventana
- [ ] Una sola barra de desplazamiento
- [ ] El camioncito sale en las esperas
- [ ] La entrada dura lo que tarda la página, no un reloj fijo

**En celular** (375 y 390 px, y de pasada 320):

- [ ] Las pestañas caben todas en la pantalla
- [ ] Los botones se pueden tocar con el dedo: 44 × 44 px de área
- [ ] El calendario, el buscador de lugar y el chat caben
- [ ] Sin desbordes horizontales

> **Cómo medir el scroll:** con **rueda o clic de verdad**. Un `scrollTo` desde
> la consola se corta a los 240 ms y da falsos negativos. Ya costó tiempo dos
> veces.

---

## 5 · Lo que no se ve

- [ ] Cero errores en la consola del navegador
- [ ] Sentry sin errores nuevos en los últimos días
- [ ] Ninguna llave ni dirección interna sale al navegador
- [ ] Los documentos internos no son públicos (`/docs/…` debe dar **404**)
- [ ] Ningún dato personal viaja en la dirección
- [ ] Peso de la primera carga: ______ KB (vigilar que no crezca)

---

## 6 · Lo legal

- [ ] Aviso de privacidad ligado en el pie, en las dos páginas
- [ ] El aviso de cookies sale una vez por dispositivo y se puede cerrar
- [ ] La política de cancelación se ve **antes** de pagar
- [ ] El precio dice si incluye IVA

---

## 7 · Cuando algo falla

1. **No se parcha el síntoma.** Se busca la causa antes de tocar nada.
2. Se escribe una prueba que falle **primero**, y se guarda en `pruebas/`.
3. Se arregla, y la prueba pasa a verde.
4. Se vuelve a correr la batería completa, no solo esa prueba.
5. Se anota en este formato qué se rompió, para que la próxima vez se revise.

---

## Cierre

- [ ] Batería completa otra vez: ______ buenas, ______ malas
- [ ] Todo subido
- [ ] Lo que quedó **sin probar**, escrito aquí:

```
(qué no se pudo probar y por qué)
```
