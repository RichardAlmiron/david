# Arquitectura Oficial y Flujo Exacto Píxel por Píxel del Agente IA de WhatsApp, Voz Neuronal, Confirmación y Lógica Post-Confirmación — Noelux™

Este documento constituye el **manual técnico y algorítmico definitivo** de cómo piensa, escucha, habla, confirma pedidos y actúa después de la confirmación el **Agente de WhatsApp de Noelux™** (`server/whatsappEngine.ts`), junto con el flujo de edición manual post-llamada en el Panel de Administración (`src/components/ProductConfirmedOrdersPanel.tsx` y `src/views/AdminView.tsx`).

> 📌 **Documentos complementarios del proyecto:**
> - [`CONTEXTO_DE_CHAT.md`](./CONTEXTO_DE_CHAT.md) — Bitácora histórica cronológica de todas las fases de ingeniería.
> - [`ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md`](./ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md) — Especificación de los Reportes Ejecutivos Directos al WhatsApp del Vendedor y Sincronización Multi-Dispositivo en Supabase (`ORD-*`, `DEL-ORD-*`, `CFG-*`, `WACHAT-*`).

---

## 1. Diagrama General del Flujo Exacto del Agente (De Punta a Punta)

```mermaid
flowchart TD
    WebOrder["🛒 1. Cliente crea pedido en la Web\n(POST /api/pedidos)"] --> AutoStart["⚡ handleNewOrderAutomation()\nEnvía Audio/Texto Inicial (Paso 1)\na <celular>@s.whatsapp.net"]
    AutoStart --> WaIncoming["📲 2. Evento messages.upsert en Baileys\n(Cliente responde por Audio o Texto)"]

    WaIncoming --> LidResolver{"🔍 3. Resolución de JID / @lid\nresolveJidToCleanPhone()"}
    LidResolver -->|Es chat con otra persona\nsin pedido registrado| IgnorePersonal["🔇 Silencio Total (100%)\nNo interviene en chats personales"]
    LidResolver -->|Es el Vendedor pidiendo\n'reporte' o sin pedido propio| SellerReport["📊 Motor Ejecutivo del Vendedor\nhandleIncomingSellerWhatsAppInstruction()\nEnvía Reporte #1, #2..."]
    LidResolver -->|Cliente con Pedido Registrado\n(incluye Self-Chat de prueba)| CheckAudio{"🎧 ¿Es Nota de Voz?"}

    CheckAudio -->|Sí| DeepgramSTT["🎙️ Deepgram Nova-3 STT\ntranscribeWhatsAppAudioMessage()"]
    CheckAudio -->|No (Texto)| CheckOrderState{"📌 4. ¿El pedido YA está\nConfirmado (Paso 5)?"}
    DeepgramSTT --> CheckOrderState

    %% FLUJO PASOS 1 AL 5 (ANTES DE CONFIRMAR)
    CheckOrderState -->|NO: En Confirmación\n(Pasos 1 al 4)| LlmConfirm["🧠 LLM de Confirmación (GLM-5.3 · z-ai/glm-5.3 JSON)\nbuildLLMSystemPrompt()"]
    LlmConfirm --> IsCongruent{"¿Respuesta congruente\na la pregunta del Agente?"}
    IsCongruent -->|NO (Incongruente, confusa\no audio cortado)| AskAgain["🔄 Mantiene el mismo Paso (nextStep = actual)\nEl LLM contextualiza lo que dijo el cliente,\nexplica que no entendió y vuelve a hacer\nla pregunta puntual (CERO frases pregrabadas)"]
    IsCongruent -->|Pregunta sobre el producto| AnswerAndReask["💡 Responde la duda con el catálogo real\ny retoma la pregunta del paso actual"]
    IsCongruent -->|SÍ (Congruente)| AdvanceStep["✅ Avanza al siguiente Paso (2, 3, 4 o 5)\nExtrae correcciones y referenciaCasa"]
    AdvanceStep -->|Llega al Paso 5| CloseOrder["🟢 CIERRE DE CONFIRMACIÓN (Paso 5)\ndatosConfirmados = true | empaquetado = true\nGenera comparativaDatos + Envía Reporte\nEjecutivo en Verde al WhatsApp del Vendedor"]

    %% FLUJO POST-CONFIRMACIÓN (DESPUÉS DEL PASO 5)
    CheckOrderState -->|SÍ: Pedido YA Confirmado\n(Cliente vuelve a escribir)| LlmPostConfirm["🔒 LLM Post-Confirmación (Pedido Inmutable por Chat)\nbuildPostConfirmationLLMSystemPrompt()"]
    LlmPostConfirm --> PostIntent{"¿Qué escribe el cliente\ndespués de confirmar?"}
    PostIntent -->|Quiere aumentar/disminuir unidades,\ncambiar datos o CANCELAR| ForceCall["📞 Deriva Obligatoriamente a Llamada:\nHabla como operador humano de despacho.\nExplica que el pedido ya está confirmado y cerrado,\ny que para modificar piezas o cancelar DEBE LLAMAR\na este mismo número para hablar con un\nEspecialista del Área de Ventas"]
    PostIntent -->|Consulta congruente sobre\nel producto o envío| AnswerPost["💬 Responde la duda del producto,\nrecuerda que el pedido ya está confirmado\ny deja el número por si desea llamar"]
    PostIntent -->|Tema NO congruente\n(ajeno al producto)| PoliteBoundary["🛡️ Responde con educación que la línea\nes exclusiva del área de envíos del producto\ny brinda el número para llamadas"]

    ForceCall --> CustomerCalls["☎️ 5. El Cliente llama por teléfono al Vendedor\n(El Vendedor negocia en vivo con el cliente)"]
    CustomerCalls --> ManualAdminEdit["✏️ 6. Vendedor entra al Panel Admin\n(ProductConfirmedOrdersPanel / AdminView)\nModifica unidades (+/-), monto, dirección\no cancela el pedido manualmente"]
```

---

## 2. Fase A: Cómo Actúa el Agente Antes de Confirmar (Pasos 1 al 5 — Comprensión 100% LLM)

### 2.1. Principio Fundamental: Cero Respuestas Pregrabadas ("Pre-holdeadas") y Cero Regex
El agente **no es un chatbot tradicional de árbol rígido ni de palabras clave**. No utiliza listas fijas de palabras (`regex`) ni textos pregrabados para decidir si avanza o no de paso:
- En cada mensaje entrante del cliente, `generateContextualAiReply()` envía a **OpenRouter con el modelo exclusivo `z-ai/glm-5.3` (GLM-5.3 en modo JSON estructurado)** el historial real de la conversación (`conversationHistory`), el catálogo completo del producto (`contextoIA` + `agentBrain`), los datos del pedido web y el paso actual (`currentStep`).
- El servidor detecta automáticamente la API Key desde las variables de entorno configuradas en Railway (`OPENROUTER_API_KEY`, `OPENROUTESERVICE_API_KEY`, `OPENROUTE_API_KEY`), sin requerir configuración manual repetitiva.
- El LLM analiza semánticamente:
  1. **¿Qué le preguntó exactamente el agente al cliente en su último mensaje?**
  2. **¿Qué acaba de responder el cliente?**
  3. **¿Es congruente la respuesta del cliente con la pregunta que se le hizo?**

### 2.2. Los 5 Pasos Exactos de la Confirmación (`buildLLMSystemPrompt`)
1. **PASO 1 — Saludo Inicial y Disponibilidad (`buildInitialOrderAiMessage`):**
   - Cuando el cliente envía su pedido en la tienda (`src/components/OrderForm.tsx`), **ya no se le redirige a WhatsApp ni se genera ningún mensaje pre-holdeado**; en su lugar, la web le muestra al instante un **Pop-up Modal de Confirmación** indicando que su pedido, el producto y la cantidad están confirmados y que en minutos un agente especializado de confirmación y empaquetado le escribirá a su WhatsApp.
   - En paralelo (`POST /api/pedidos`), el agente saluda automáticamente al cliente en su WhatsApp por su primer nombre, se presenta como del área de envíos de Noelux por su pedido del producto correspondiente y le pregunta si tiene un minutito para confirmar sus datos de entrega.
   - Si el modo activo es **Audio Automático (`🎤 Audio`)**, sintetiza la voz con **Deepgram Aura-2 (`synthesizeSpeechSelfHosted`)** y la envía como nota de voz nativa OGG/Opus (`ptt: true`).
2. **PASO 2 — Verificación de Nombre y Número de Teléfono:**
   - Cuando el cliente responde de forma congruente al Paso 1, el LLM avanza a `nextStep: 2`.
   - Le confirma su nombre completo y su número de teléfono registrados en la web, preguntándole si están correctos o si desea corregir alguno.
3. **PASO 3 — Verificación de Ciudad, Barrio y Calle/Dirección en TEXTO (sin pronunciarlos en Audio):**
   - Cuando el cliente valida el Paso 2, el LLM avanza a `nextStep: 3` (si corrigió su nombre, el LLM lo devuelve en `"correctedName"` y actualiza el pedido).
   - **Regla anti-error de pronunciación:** Como los sintetizadores de voz pronuncian mal los nombres propios de calles, barrios y ciudades, en la **Nota de Voz (`"reply"`)** el agente **jamás pronuncia** el nombre de la calle, barrio o ciudad; le envía un audio cortito diciéndole que mire el mensaje de texto de abajo para confirmar si su ciudad, barrio y calle están bien anotados así.
   - Inmediatamente debajo del audio, `sendWhatsAppVoiceCallTurn()` envía en **TEXTO (`"locationTextConfirmation"`)** la **Ciudad / Barrio** y **Calle / Dirección** para que el cliente los lea con total claridad.
4. **PASO 4 — Reconfirmación de Calle/Barrio en TEXTO y Solicitud de Referencia Visual de la Casa:**
   - Cuando el cliente valida o precisa su calle/barrio/ciudad, el LLM avanza a `nextStep: 4` (guardando cualquier ajuste en `"correctedCity"` o `"correctedAddress"`).
   - En un **audio cortito**, el agente le dice que ya recibió esa información, le pide que verifique en el texto de abajo que su calle, barrio y ciudad hayan quedado bien anotados, y le pide **cómo es su casa** (color de fachada o portón y qué comercio, vecino o lugar cercano tiene de referencia). Junto al audio le envía en **TEXTO** la calle, barrio y ciudad actualizados.
5. **PASO 5 — Cierre de Confirmación, Reconfirmación Final en TEXTO, Empaquetado y Reporte Verde al Vendedor:**
   - Cuando el cliente responde en el Paso 4 brindando cómo es su casa / lugar cercano, el LLM avanza a `nextStep: 5`, marca `"orderConfirmed": true` y extrae la referencia limpia en `"extractedHouseReference"`.
   - En el **audio**, el agente le agradece cálidamente, menciona cómo es su casa (sin pronunciar nombres de calles ni barrios), le confirma que su pedido ya pasa a empaquetado/despacho y le deja abajo en **TEXTO (`"locationTextConfirmation"`)** el resumen final reconfirmado con su **Ciudad, Barrio, Calle/Dirección y Referencia de casa**.
   - En ese instante exacto, el servidor:
     - Marca `matchedOrder.datosConfirmados = true`, `matchedOrder.empaquetado = true`, `matchedOrder.agenteCompletado = true`, `matchedOrder.convStep = 5` y `matchedOrder.estado = 'en_camino'`.
     - Construye `matchedOrder.comparativaDatos` comparando los datos de la web contra los confirmados en el chat.
     - Dispara automáticamente `notifySellerOfOrderEvent(matchedOrder, 'green')`, enviando al WhatsApp del dueño del producto (`waNotificacionesVendedor`) el **Reporte Ejecutivo Enumerado (`#1`, `#2`...)** en tiempo real.

### 2.3. ¿Qué hace el Agente cuando el Cliente responde algo INCONGRUENTE o un Audio no se escucha claro?
Si en cualquiera de los pasos (1 al 4) el cliente responde algo que **no tiene sentido respecto a lo que el agente le acaba de preguntar**, es ambiguo, incompleto, o si envía una nota de voz en blanco/entrecortada:
1. **No se usa ningún mensaje pregrabado.**
2. El LLM mantiene el paso sin avanzar (`"nextStep": currentStep`, `"congruent": false`).
3. El LLM redacta en el momento una respuesta hablada 100% contextualizada a la charla: le explica con naturalidad al cliente que no comprendió bien lo que le quiso decir recién en relación con lo que le estaba consultando, le recuerda con sus propias palabras cuál era la pregunta concreta de ese paso y le pide amablemente si se lo puede repetir o aclarar.
   - *Ejemplo real en Paso 4:* Si el agente preguntó *"¿De qué color es tu portón o tu fachada y qué tenés cerca?"* y el cliente responde solo *"sí, dale"* o cualquier frase que no describe su casa, el LLM detecta que eso no es una referencia de casa, se queda en el Paso 4 y le dice naturalmente que no llegó a entender cuál es la referencia de su casa, volviéndole a pedir el color de su fachada o qué punto conocido tiene cerca.

---

## 3. Fase B: Cómo Actúa el Agente DESPUÉS de Confirmar (`buildPostConfirmationLLMSystemPrompt`)

### 3.1. Regla de Oro Post-Confirmación: Pedido Cerrado en Chat, Pero el Agente Sigue Escuchando
Una vez que el pedido alcanzó el **Paso 5 (`datosConfirmados === true`)**, el pedido queda **100% bloqueado e inmutable por chat**: el agente jamás modifica cantidades, ni precios, ni dirección, ni cancela el pedido por mensaje.

Sin embargo, si el cliente vuelve a escribir a ese mismo número horas o días después de haber confirmado, **el agente NO lo ignora**: `generateContextualAiReply()` detecta `isAlreadyConfirmed === true` y activa el motor **LLM Post-Confirmación (`buildPostConfirmationLLMSystemPrompt`)**.

### 3.2. Regla de Identidad Humana
El agente **jamás** dice ni insinúa que es una inteligencia artificial, un bot o un sistema automático. Habla siempre en primera persona como un operador humano del equipo de envíos y despacho de Noelux™.

### 3.3. Los 3 Escenarios Exactos de Respuesta Post-Confirmación

#### Escenario 1: El cliente pide AUMENTAR unidades, DISMINUIR piezas, MODIFICAR datos o CANCELAR / ANULAR el pedido
- **Acción en Base de Datos:** El código **no toca ni modifica ningún campo** del pedido confirmado (`cantidad`, `monto`, `direccion` y `estado` permanecen intactos).
- **Respuesta Contextual del LLM:**
  - Le explica con total profesionalismo y calidez que su pedido ya quedó confirmado y registrado en el sector de despacho.
  - Le aclara que, una vez confirmado el pedido, para que el equipo pueda ejecutar profesionalmente esa nueva orden, modificación de piezas (sumar o bajar unidades) o cancelación, **únicamente se puede realizar mediante una llamada telefónica**.
  - **Lo obliga amablemente a llamar:** Le indica el número de teléfono (`callPhoneSpeech`, el mismo número de WhatsApp del producto) y le pide: *"¿Podrías llamarme por favor a este mismo número? Así un especialista de nuestro equipo de ventas te atiende directamente en llamada y procesa lo que estás solicitando."*

#### Escenario 2: El cliente hace una pregunta CONGRUENTE sobre el mismo producto o sobre su envío (sin pedir cambios ni cancelación)
- **Acción en Base de Datos:** El pedido sigue intacto en estado confirmado.
- **Respuesta Contextual del LLM:**
  - Le responde su consulta sobre el producto (uso, cobertura, garantía, cable, lluvia) o sobre el envío con naturalidad y precisión usando el catálogo real del producto.
  - Le recuerda amablemente que su pedido ya se encuentra confirmado en despacho, y que si en algún momento requiere hacer alguna modificación o agregar unidades, solo debe llamar por teléfono a ese mismo número para hablar con un especialista de ventas.

#### Escenario 3: El cliente escribe algo NO CONGRUENTE (que no tiene nada que ver con el producto ni con su pedido)
- **Acción en Base de Datos:** El pedido sigue intacto.
- **Respuesta Contextual del LLM:**
  - Contextualiza lo que escribió el cliente y le responde de forma educada y profesional explicándole que desde esta línea del área de despacho no pueden ayudarle con ese tema porque no guarda relación con el producto ni con su compra, y le recuerda que por cualquier gestión sobre su pedido confirmado puede llamar directamente a ese mismo número.

---

## 4. Fase C: Intervención Manual del Dueño/Vendedor Tras Recibir la Llamada del Cliente

Gracias al bloqueo post-confirmación del agente, cualquier cliente que quiera cancelar, bajar o aumentar unidades **llama por teléfono directamente al dueño/vendedor**:

1. **Atención en Llamada:** El dueño habla en vivo con el cliente (pudiendo persuadirlo si quería cancelar, o acordando el nuevo total si quiere llevar más o menos unidades).
2. **Edición Manual Inmediata en el Panel de Administración:**
   Al cortar la llamada, el dueño entra a su Panel de Administración (`#admin`) y dispone de **dos lugares directos** para modificar el pedido manualmente:
   - **Opción 1 — Dentro de `[✅ Confirmados]` (`src/components/ProductConfirmedOrdersPanel.tsx`):**
     - Al abrir la ficha de cualquier pedido confirmado (`#1`, `#2`...) aparece el bloque **"✏️ Edición Manual del Vendedor (Post-Llamada con el Cliente)"**.
     - Permite subir o bajar la **Cantidad de Piezas / Unidades** con botones `-` y `+` (recalculando automáticamente el **Monto Total en Gs.** según la tabla de precios del producto o permitiendo escribir un monto personalizado), editar **Ciudad, Dirección y Referencia de Casa**, o hacer clic en **"🚫 Cancelar / Anular este Pedido"** o **"💾 Guardar Modificación del Pedido"**.
   - **Opción 2 — En la Tabla General `Clientes de este Producto` (`src/views/AdminView.tsx`):**
     - En la columna **Pack** cada fila cuenta con botones rápidos `-` y `+` para aumentar o disminuir unidades al instante con recálculo automático del precio, además del selector de **Estado** (`Reservado`, `Confirmado / Courier`, `Entregado`, `Cancelado`) y el botón de eliminación permanente.
3. **Sincronización Instantánea en Base de Datos (`POST /api/pedidos/estado` + `syncOrderUpdateToCloud`):**
   - Cada modificación manual guarda los cambios en `pedidos.json` y dispara `syncOrderUpdateToCloud()`, actualizando el registro `ORD-<reservaid>` en Supabase para que Web Producción, Móvil y los Reportes Ejecutivos del Vendedor reflejen al instante el nuevo número de unidades, monto o estado.

---

## 5. Protección de Chats Personales y Soporte de Pruebas con el Mismo Número (`Self-Chat @lid`)

1. **Aislamiento Total de Contactos Personales:**
   - Cuando el dueño usa su teléfono conectado para escribirle a cualquier otra persona (amigos, familiares, contactos sin pedido en la tienda), aunque WhatsApp Multi-Device utilice identificadores `@lid` para esos contactos, `resolveJidToCleanPhone()` verifica estrictamente que el `@lid` corresponda únicamente al propio usuario (`session.connectedLid` / `state.creds.me.lid`).
   - Por lo tanto, los mensajes enviados a terceros jamás se confunden con el chat propio y el agente **nunca interviene en conversaciones personales**.
2. **Pruebas desde el Mismo Número Conectado (`Self-Chat` / "Mensajes contigo mismo"):**
   - Cuando el dueño crea un pedido de prueba con su propio número conectado (`session.connectedPhone`, ej. `0973532550`) y responde en su chat de WhatsApp, el cliente móvil envía el mensaje con el identificador `@lid` del propietario (`160602198675534:28@lid`) y con el flag de Baileys `msg.key.fromMe = true`.
   - **Mapeo Criptográfico de LID:** Al abrir el socket (`connection === 'open'`) y en cada actualización de credenciales (`creds.update`), el motor extrae el LID del propietario desde `state.creds?.me?.lid` y lo almacena en `session.connectedLid`, indexándolo en `phoneToLidCache` y `lidToPhoneCache`.
   - **Clasificación Correcta del Mensaje:** Si `remoteJid` coincide con `session.connectedLid` o si `cleanPhone === selfCleanPhone`:
     - El mensaje se marca como `isSelfChat = true`.
     - `isFromAdmin = Boolean(msg.key.fromMe) && !isSelfChat` se evalúa como **`false`** (a menos que el `msg.key.id` esté en `recentlySentMsgIds` enviado por la IA).
     - De esta forma, las notas de voz o textos enviados por el dueño desde su propio celular se procesan como mensajes legítimos del cliente, **disparando la respuesta del Agente IA al instante**.
   - Si desde ese mismo número el dueño escribe explícitamente *"reporte"*, *"estado de pedidos"*, *"resumen de pedidos"* o *"cuántos pedidos"*, el enrutador le entrega en su WhatsApp el **Reporte Ejecutivo del Vendedor (`#1, #2...`)**.

---

## 6. Persistencia Permanente en Base de Datos Ante Redespliegues de Railway (`WAVOICE-*`, `CFG-*` y `WAAUTH-*`)

Como los contenedores de **Railway** tienen un sistema de archivos efímero que se reinicia en cada nuevo despliegue (`deploy`), el motor cuenta con **doble persistencia automática en Supabase** para que **nunca se cambie la voz elegida** ni **nunca se desconecte el WhatsApp**:

1. **Voz del Agente IA Inmutable por Producto (`WAVOICE-*` y `CFG-*`):**
   - Al elegir una voz en el Panel de Administración (`POST /api/whatsapp/voice/select`), `setSelectedVoiceId(voiceId, productId)` estampa la voz en el producto (`vozAgente` y `vozAgenteNombre`) y ejecuta `persistVoiceSelectionToCloud()`, guardando inmediatamente en Supabase tanto un registro dedicado `WAVOICE-<timestamp>` como el registro `CFG-<timestamp>` actualizado.
   - Al arrancar un nuevo despliegue en Railway (`restoreCloudStateAndWaSessionsOnBoot()` y `pollCloudCommandsAndOrders()`), el servidor descarga la voz guardada desde `WAVOICE-*` y `CFG-*` en Supabase y la restaura en `store_config.json` y `wa_chats.json`.
   - En cada nota de voz enviada (`startOrAdvanceVoiceCall` y `sendWhatsAppVoiceCallTurn`), `getVoiceProfileForOrder()` utiliza estrictamente la voz `vozAgente` asignada al producto del pedido.

2. **Sesión de WhatsApp (Baileys Multi-Device) Persistente en la Nube (`WAAUTH-*`):**
   - Cuando el usuario vincula su WhatsApp (por QR o código de 8 dígitos) y en cada actualización de llaves criptográficas (`connection === 'open'` y `creds.update`), `backupWaSessionAuthToCloud()` empaqueta `creds.json` y las llaves Signal (`session-*`, `app-state-sync-*`, `sender-key-*`, `lid-mapping-*`, `pre-key-*`), las comprime con GZIP (`zlib.gzipSync`) en Base64 y las guarda en Supabase bajo `WAAUTH-<sessionId>-<timestamp>`.
   - Cuando Railway realiza un nuevo despliegue, antes de iniciar Baileys (`ensureBootCloudRestoreCompleted()`), `restoreCloudStateAndWaSessionsOnBoot()` descarga `WAAUTH-*` desde Supabase, descomprime las credenciales en `~/.noelux_wa_multi/<sessionId>/` e inicia el socket manteniendo el WhatsApp **100% conectado sin volver a pedir QR ni código**.
   - Además, el guardián de entorno (`isProductionRuntime()`) impide que el contenedor de vista previa (Dev) restaure la sesión si Railway Producción ya está conectado, evitando desconexiones por conflicto `440 (connectionReplaced)`.
   - Cuenta con auto-saneamiento activo (`sanitizeAuthDirectory`): si algún archivo temporal o de sesión tiene 0 bytes o no es JSON válido, se elimina de inmediato y se escribe atómicamente (`.tmp` -> `renameSync`) para evitar cualquier corrupción en las llaves Signal.

---

## 7. Limpieza Total de Residuos en la Base de Datos y Memoria

Para garantizar que jamás se acumule historial antiguo ni residuos de pedidos pasados:

1. **Eliminación Total del Ciclo Invasivo `WACHAT-*`:**
   - Se removió definitivamente de `pollCloudCommandsAndOrders()` la rutina que sincronizaba filas estáticas `WACHAT-*` desde Supabase. En su lugar, el servidor en Railway es la única fuente de verdad autoritativa para el estado en memoria y publica las conversaciones completas en `WAENG-*`. Esto previene que registros históricos de 50 mensajes sobreescriban conversaciones recién iniciadas.
2. **Reinicio Limpio para Nuevos Pedidos (`pollCloudCommandsAndOrders` y `handleNewOrderAutomation`):**
   - Cuando ingresa un pedido nuevo para un cliente (`existingIdx === -1`), el motor reinicia inmediatamente `storage.chats[cleanPhone] = []` y `storage.convSteps[cleanPhone] = 1`. De esta manera, el nuevo pedido arranca con la pantalla en blanco y en el Paso 1, sin arrastrar residuos de órdenes previas.
3. **Purga Inmediata al Eliminar Pedidos (`DEL-ORD-*` y `purgeOrphanedChatsAndResidues`):**
   - Al eliminar un pedido desde la administración, se emite un tombstone `DEL-ORD-<reservaid>` en Supabase y se ejecuta `purgeOrphanedChatsAndResidues()`. Si el teléfono del cliente no posee más pedidos activos, se purgan de raíz sus chats, pasos de conversación y modos en memoria.

---

## 8. Doble Motor STT (Deepgram Nova-3 + Nova-2 Español) con Autodetección de Contenedor

Para procesar notas de voz entrantes con respuesta en ~1 segundo:
1. **Desempaquetado de Mensajes (`extractMessageContent`):** Desenvuelve notas de voz contenidas en mensajes efímeros, editados o de visualización única (`viewOnce`).
2. **Detección Automática de Mimetype:** Detecta el formato nativo del audio (`audio/ogg`, `audio/mp4` de iPhone, `audio/aac`) para evitar rechazos en el decodificador de Deepgram.
3. **Fallback Dual Inmediato:** Realiza la transcripción primero contra `model=nova-3&language=es`, y en caso de contingencia o demora conmuta al instante con `model=nova-2&language=es`.

---

## 9. Despliegue de Cambios a Railway Producción

1. **Entorno de Desarrollo vs. Producción:**
   - El código se desarrolla y prueba en AI Studio.
   - Dado que Railway hospeda el contenedor de producción conectado a la línea de WhatsApp, cualquier cambio realizado en el código debe ser subido al repositorio conectado a Railway (mediante git push o sincronización de repositorio) para que tome efecto en el servidor en vivo.
2. **Comando de Arranque:** Railway ejecuta `nixpacks.toml` con `npm run build && npm start`, levantando Vite en modo servidor con el motor de WhatsApp activo.

---

## 10. Protocolo de Contingencia Indestructible de 5 Pasos (Anti-Silencio por Fallas de LLM / OpenRouter 401)

### 10.1. Diagnóstico Forense: ¿Por qué el Primer Mensaje SÍ lo enviaba y el Segundo NO respondía?
1. **Mensaje 1 (Saludo y Disponibilidad):**
   - Cuando se registra o confirma un pedido en la web, `startOrAdvanceVoiceCall()` invoca `buildInitialOrderAiMessage(matchedOrder)`.
   - Si la API Key de OpenRouter fallaba o devolvía error HTTP 401 (`{"error":{"message":"User not found.","code":401}}`), la función poseía una guarda por defecto:
     `initialSpoken = initRes?.text || 'Hola, ¿qué tal? ¿Cómo estás? Te hablo del área de envíos por tu pedido.'`
   - Por este motivo, el motor enviaba este texto directamente a **Deepgram TTS Aura-2 (`synthesizeSpeechSelfHosted`)**, generaba la nota de voz OGG/Opus y Baileys la entregaba exitosamente al WhatsApp del cliente.
2. **Mensaje 2 (Respuesta del Cliente "Sí" / Disponibilidad):**
   - Al responder el cliente, el evento `messages.upsert` de Baileys invocaba `generateSmartAiReply()`, la cual llama a `callOpenRouterLLM()` con el modelo exclusivo **`z-ai/glm-5.3` (GLM-5.3)**.
   - Si en algún momento la cuenta externa tuviese un corte temporal de red o límite 429/401, en versiones antiguas un `return;` abortaba silenciosamente el envío.

### 10.2. Solución de Ingeniería: Motor Exclusivo `GLM-5.3` (`z-ai/glm-5.3`) + Detección Automática en Railway + Contingencia de 5 Pasos (`generateEmergencyFallbackStepReply`)
Para blindar el sistema al 100%:
1. **Conexión Automática con la Variable de Entorno de Railway (`z-ai/glm-5.3`):**
   - El motor `server/whatsappEngine.ts` lee de forma nativa la clave ya configurada por el usuario en Railway (`process.env.OPENROUTER_API_KEY || process.env.OPENROUTESERVICE_API_KEY || process.env.OPENROUTE_API_KEY`) y ejecuta todas las inferencias exclusivamente sobre **`z-ai/glm-5.3`**.
2. **Fallback Automático de 5 Pasos en `generateContextualAiReply()`:**
   - Si en algún instante puntual hay una micro-caída de red externa, se activa de forma instantánea `generateEmergencyFallbackStepReply()` para que el cliente jamás quede sin respuesta en ninguno de los 5 pasos ni en post-confirmación.
3. **No Abortar el Envío en `messages.upsert`:**
   - Si `smartRes.reply` contiene la respuesta generada, el flujo continúa siempre y envía la nota de voz OGG/Opus (`Deepgram Aura-2`) a WhatsApp.


