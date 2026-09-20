# Mandar el PDF por WhatsApp desde nuestro lado

**19-sep-2026.** Revisado en vivo el Business Manager del dueño. El camino que
él propuso **es viable**: nosotros enviamos los comprobantes por la API de
Meta, y Kommo sigue recibiendo y atendiendo las pláticas. Un solo número, el
EuroBot intacto, y el contrato como **archivo de verdad**, no como liga.

---

## Lo que se comprobó

| Requisito | Estado |
|---|---|
| El WABA es del dueño, no de Kommo | ✅ «Eurotravel Renta de Autobuses y Sprinter», **propiedad de Ernesto Jimenez** |
| Kommo aparece solo como socio | ✅ socio con control total, que es lo normal al conectar por ellos |
| El número está conectado | ✅ +52 1 33 1616 8587, **Conectado**, calidad **Alta** |
| Identificador del número | ✅ `1325977977265993` |
| Se pueden crear usuarios del sistema | ✅ la sección existe y está vacía, con su botón de agregar |

> **Ojo con la memoria vieja:** `1325977977265993` estaba anotado como «waba».
> No lo es: es el **identificador del número de teléfono**, que es lo que
> necesita el código para enviar.

---

## El candado que no se toca

Cuando se conecta una app a un WABA, Meta pregunta a qué app entregarle los
mensajes **entrantes**. Esa suscripción **es de Kommo y se queda como está**.

Si se la quitamos, los clientes le escriben al número y **no le llega a nadie**:
ni al bot, ni a los vendedores, ni al embudo. Sería la peor falla posible en el
canal que hoy da de comer.

Nosotros solo pedimos permiso para **enviar**. Nada de webhooks, nada de
suscripciones de entrada.

---

## Lo que falta hacer

### 1 · Una app de Meta (del dueño, 10 min)

En **developers.facebook.com** → Mis apps → **Crear app**:

- Tipo: **Negocios**
- Nombre: `Eurotravel avisos`
- Al terminar, **Agregar producto → WhatsApp**
- **NO configurar webhooks.** Esa pantalla se salta.

### 2 · El usuario del sistema (5 min)

Business Manager → **Usuarios del sistema** → **Agregar**:

- Nombre: `eurotravel-avisos`
- Rol: **Administrador**
- **Agregar activos** → Cuentas de WhatsApp → «Eurotravel Renta de Autobuses y
  Sprinter» → **Control total**
- **Agregar activos** → Apps → `Eurotravel avisos` → **Control total**

### 3 · El token (2 min)

En ese usuario → **Generar nuevo token**:

- App: `Eurotravel avisos`
- Caducidad: **Nunca**
- Permisos: `whatsapp_business_messaging` y `whatsapp_business_management`

⚠️ **Se enseña una sola vez.** Va directo a Vercel, **nunca al chat ni a un
archivo del proyecto**.

### 4 · Las plantillas

Se pueden crear **en el mismo Business Manager**, con encabezado de tipo
**Documento**. Ahí el archivo sí es un parámetro de envío: el PDF de cada
cliente. Los textos están en `PLANTILLAS-AL-CLIENTE.md`.

Alternativa: dejarlas en Kommo, que también las manda a Meta. Da igual dónde se
creen: viven en el mismo WABA y nuestra app las va a ver.

### 5 · Las variables en Vercel

```
WA_TOKEN       el token del usuario del sistema
WA_PHONE_ID    1325977977265993
WA_PLANTILLA_CONTRATO    contrato_listo
WA_PLANTILLA_PAGO        pago_recibido
WA_PLANTILLA_REVERTIDO   pago_revertido
WA_IDIOMA                es_MX
```

Sin ellas el código no manda nada y no se queja: todo sigue saliendo por
correo.

---

## Lo que todavía NO está probado

Que una app propia pueda **enviar** por un número cuyo socio con control total
es Kommo. Todos los requisitos están y Meta lo permite en general, pero el caso
exacto se confirma **al primer envío de prueba**, no antes.

Si resultara que no, el plan B sigue en pie: el PDF por correo y la liga por
WhatsApp, que es lo que funciona hoy.

**La prueba se hace al número del dueño, nunca a un cliente.**

---

## De paso

En la ficha que ven los clientes dice **«Renta dd Autobuses y Sprinter»**, con
«dd» en vez de «de». Se corrige en el perfil del número.

---

## Orden

| Paso | Quién | Cuánto |
|---|---|---|
| 1 · Crear la app en developers.facebook.com | dueño | 10 min |
| 2 · Usuario del sistema con los dos activos | dueño | 5 min |
| 3 · Token sin caducidad → a Vercel | dueño | 2 min |
| 4 · Plantillas con encabezado de documento | dueño | 30 min + revisión |
| 5 · Conectar el envío en el webhook | Claude | con pruebas |
| 6 · Primer envío de prueba al número del dueño | los dos | 15 min |
