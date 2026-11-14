# Arquitectura Oficial y Flujo Exacto Píxel por Píxel del Agente IA de WhatsApp, Compuerta Audio-Primero (1s), Confirmación Express ("CORRECTO"), Imágenes Personalizadas y Voz Neuronal 99–100% Audio — Noelux™

Este documento constituye el **manual técnico y algorítmico definitivo** de cómo piensa, escucha, habla, aplica la **Compuerta Estricta Audio-Primero (`1 segundo después del audio`)**, genera la **Imagen #1 de Bienvenida (`stage1_welcome`)** y la **Imagen Final de Pedido Confirmado (`stage3_confirmed`)** con felicitaciones y aviso de courier de 48 a 72 horas, confirma pedidos en **1 solo paso sin fricción** con la única palabra clave **`"CORRECTO"`** y protege los chats personales el **Agente de WhatsApp de Noelux™** (`server/whatsappEngine.ts`, `src/utils/orderConfirmation.ts`, `src/utils/waStageCommercials.ts` y `server/waStageCommercialRenderer.ts`), junto con el Panel de Administración (`src/components/ProductConfirmedOrdersPanel.tsx` y `src/views/AdminView.tsx`).

> 📌 **Documentos complementarios del proyecto:**
> - [`CONTEXTO_DE_CHAT.md`](./CONTEXTO_DE_CHAT.md) — Bitácora histórica cronológica completa (**Fases 1 a 80**).
> - [`ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md`](./ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md) — Especificación de Reportes Ejecutivos Directos al WhatsApp del Vendedor, Panel de Confirmados y Sincronización Multi-Dispositivo en Paralelo sobre Supabase (`pedidos`, `ORD-*`, `DEL-ORD-*`, `CFG-*`, `WAENG-*`, `WAAUTH-*`).
> - [`CEREBRO_AUTOADS.md`](./CEREBRO_AUTOADS.md) — Documentación central de AutoAds v2 (Cerebro Psicológico, Persistencia Autoritativa en Supabase, Aprendizaje Circuito A, Preflight Meta/Pipeboard y Circuito B ERP).

---

## 1. Diagrama General del Flujo Exacto del Agente (Compuerta Audio-Primero `1s` + Confirmación con `"CORRECTO"`)

```mermaid
flowchart TD
    WebOrder["🛒 1. Cliente llena Formulario Oficial del Producto\n(POST /api/pedidos · Casa o Edificio + Mapa GPS · 0% pérdida de leads)"] --> IronWall{"🛡️ Muro de Hierro\nisOfficialRegisteredProductOrder()"}
    IronWall -->|Contacto sin pedido web oficial\no código NX-WA-* / test| Silence["🔇 Silencio Absoluto (100%)\nJamás habla ni crea órdenes fuera del registro web"]
    IronWall -->|Pedido Oficial Válido| ArrivalSeq["⚡ Secuencia Express Inicial (Compuerta Audio-Primero)\n1) PRIMERO Audio #1 (Deepgram Aura-2): Saludo + Nombre + Tel 4-3-3 + Pack + Monto en 'guaraníes' pidiendo responder 'CORRECTO'\n2) 1 SEGUNDO DESPUÉS (1000ms): Imagen #1 Personalizada 1080×1080 (stage1_welcome) con Datos del Cliente y banner 'CORRECTO'"]

    ArrivalSeq --> InactivityTimer["⏱️ Monitor de Ausencia Inteligente\n1er recordatorio a los 3 MINUTOS (180s) en 100% Audio\nSiguientes recordatorios cada 1 HORA (3600s) en 100% Audio (CERO imágenes extra)"]
    ArrivalSeq --> WaIncoming["📲 2. Evento messages.upsert en Baileys\n(Serializado por perPhoneVoiceTurnQueue)"]

    WaIncoming --> LidResolver{"🔍 3. Resolución @lid en 4 Capas + Filtro Estricto\nresolveJidToCleanPhone()"}
    LidResolver -->|Chat personal o número sin pedido web| Silence
    LidResolver -->|Vendedor pidiendo 'reporte'| SellerReport["📊 Motor Ejecutivo del Vendedor\nhandleIncomingSellerWhatsAppInstruction()\nEnvía Reporte Enumerado #1, #2..."]
    LidResolver -->|Cliente con Pedido Oficial\n(incluye Self-Chat de prueba)| CheckAudio{"🎧 ¿Es Nota de Voz?"}

    CheckAudio -->|Sí| DeepgramSTT["🎙️ Deepgram Nova-3 / Nova-2 STT\ntranscribeWhatsAppAudioMessage()"]
    CheckAudio -->|No (Texto / Ubicación)| CheckOrderState{"📌 4. ¿El pedido YA está\nConfirmado (datosConfirmados)?"}
    DeepgramSTT --> CheckOrderState

    %% CONFIRMACIÓN EXPRESS EN 1 PASO
    CheckOrderState -->|NO: Esperando confirmación Express| ExpressEval{"⚡ Evaluador Determinista + LLM\nevaluateExpressOrderConfirmationInput()"}
    ExpressEval -->|Dice/escribe 'CORRECTO'\no envía Pin GPS de WhatsApp| InstantClose["🟢 CIERRE INSTANTÁNEO EN 1 PASO (Compuerta Audio-Primero)\ndatosConfirmados = true | empaquetado = true | convStep = 5\nEnvía Reporte Verde al WhatsApp del Vendedor\n1) PRIMERO Audio de Confirmación: Pedido confirmado y pasa directo a empaquetado\n2) 1 SEGUNDO DESPUÉS (1000ms): Imagen Final de Pedido Confirmado (stage3_confirmed) a nombre del cliente con ¡Felicidades! y aviso de llamada del Courier en 48 a 72 hs"]
    ExpressEval -->|Corrige un dato o hace pregunta\ndel producto / frase incompleta| ContextualAudio["🎙️ Responde 100% en AUDIO (Deepgram Aura-2)\nActualiza el dato o aclara la duda con empatía humana\ny recuerda responder 'CORRECTO'"]

    %% POST-CONFIRMACIÓN
    CheckOrderState -->|SÍ: Pedido YA Confirmado| PostConfirm["📞 Atención Post-Confirmación 100% en AUDIO:\nResponde dudas técnicas con calidez o deriva cambios/cancelaciones\na llamada telefónica con Especialista de Ventas"]
```

---

## 2. Reglas Inquebrantables de la Arquitectura Algorítmica Actual

### 2.1. Muro de Hierro Estricto: Cero Contactos No Registrados (`isOfficialRegisteredProductOrder`)
El Agente IA **tiene prohibido hablar con cualquier persona que no haya registrado un pedido oficial en la página web de un producto**:
- La función pura `isOfficialRegisteredProductOrder(order)` valida que exista un `reservaid` legítimo (bloqueando prefijos huérfanos o de prueba como `NX-WA-*`, `NX-TEST-*`, `TEST-UNIT-*` o `wa-lead-*`), que esté vinculado a un producto real (`productoId` o `producto`) y que posea dirección cargada.
- **Eliminación de Auto-Creación `NX-WA-*`:** Si un amigo, familiar, proveedor o desconocido escribe por WhatsApp sin haber llenado el formulario de compra en la web, el motor permanece en **100% silencio absoluto** y jamás crea órdenes automáticas.

### 2.2. Regla 99–100% Audio (`Deepgram Aura-2` OGG/Opus PTT), Compuerta Estricta Audio-Primero (`1s`) y Palabra Clave Única `"CORRECTO"`
El Agente IA se comunica mediante **Notas de Voz humanas (`ptt: true`)** aplicando una **Compuerta Estricta Audio-Primero (`Audio-First Gate`)**:
1. **Prohibición Estricta de Enviar Imagen Antes que el Audio:**
   - Aunque la imagen ya esté 100% generada en memoria (`preGenerateStageCommercialForOrder`), el sistema **jamás permite que la imagen salga antes que el audio del agente**.
   - Primero el agente envía su **Nota de Voz**, y recién una vez enviado el audio, se autoriza automáticamente en tiempo real el envío de la imagen **exactamente 1 segundo (`1000ms`) después**.
2. **Paso 1 — Bienvenida Express (Audio #1 → 1s → Imagen #1 Personalizada):**
   - Primero envía el **Audio #1 (`Deepgram Aura-2`)** saludando al cliente por su nombre y pidiéndole verificar sus datos y responder únicamente con la palabra **`CORRECTO`**.
   - **1 segundo (`1000ms`) después del audio**, envía la **Imagen #1 Personalizada (`stage1_welcome`)** con los datos reales de entrega del cliente y el llamado a la acción: **`RESPONDÉ: CORRECTO PARA CONFIRMAR`**.
3. **Paso 2 — Cierre al Responder `"CORRECTO"` (Audio de Confirmación → 1s → Imagen Final de Pedido Confirmado):**
   - Cuando el cliente escribe o dice en audio **`"CORRECTO"`**, el agente confirma el pedido en el acto y envía **primero el Audio de Confirmación** informándole que su pedido ya está confirmado y pasa directo a empaquetado a su nombre.
   - **1 segundo (`1000ms`) después del audio de confirmación**, el sistema envía por última etapa la **Imagen Impactante de Pedido Confirmado (`stage3_confirmed`)** personalizada a nombre del cliente, dándole las **¡FELICIDADES!** e informándole claramente que en **48 a 72 horas (unos días)** la transportadora y los agentes del courier entrarán en contacto y le estarán llamando en cuanto ya estén listos para entregarle el producto.

### 2.3. Pronunciación Obligatoria en `"guaraníes"` y Gramática Natural (`src/utils/orderConfirmation.ts`)
Para evitar que el motor TTS pronuncie cifras ambiguas:
- **`numberToSpanishGuaraniesWords(amount)` y `formatGuaraniesSpeech(amount)`:** Convierten cualquier monto numérico a palabras completas en español seguidas siempre de la moneda **`"guaraníes"`**:
  - `189000` → **`"ciento ochenta y nueve mil guaraníes"`**
  - `358000` → **`"trescientos cincuenta y ocho mil guaraníes"`**
  - `507000` → **`"quinientos siete mil guaraníes"`**
- **`normalizeGuaraniesCurrencyForSpeech(text)`:** Intercepta cualquier expresión escrita por el LLM antes de enviarla a Deepgram Aura-2 y la transforma en su lectura hablada completa con `"guaraníes"`.
- **Contracción Gramatical Española Automática:** Sanitiza secuencias como `"de el Proyector"` → `"del Proyector"` y `"a el cliente"` → `"al cliente"` antes de sintetizar el audio.
- **Lectura Telefónica Paraguaya `4 - 3 - 3` Dígito por Dígito (`formatParaguayanPhonesForSpanishTTS`):** Todo número local (`0973 532 550`) se pronuncia pausadamente dígito por dígito en tres bloques (`"cero nueve siete tres, cinco tres dos, cinco cinco cero"`), nunca en cientos ni miles.

---

## 3. Imágenes Personalizadas con Compuerta Audio-Primero (`stage1_welcome` y `stage3_confirmed` · `1080×1080`)

1. **Imagen #1 de Bienvenida (`stage1_welcome` — 1s después del Audio #1):**
   - Generada dinámicamente por cliente para el paquete exacto adquirido (`Pack 1 = Gs. 189.000`, `Pack 2 = Gs. 358.000`, `Pack 3 = Gs. 507.000`) mostrando los datos del comprador y la instrucción de responder con la palabra **`"CORRECTO"`**.
2. **Imagen Final de Pedido Confirmado (`stage3_confirmed` — 1s después del Audio de Confirmación):**
   - Generada dinámicamente (`renderPersonalizedOrderConfirmedImage`) a nombre del cliente con el titular **`"¡PEDIDO CONFIRMADO!"`**, felicitaciones (**`"¡FELICIDADES, [NOMBRE]!"`**) y el aviso oficial de entrega: en **48 a 72 horas** la transportadora / los agentes del courier entrarán en contacto y le llamarán en cuanto estén listos para entregarle su producto.
3. **Envío Limpio Sin Pie de Foto (`whatsappCaption: ''`) y Candado Anti-Duplicado (`inFlightStageCommercialKeys`):**
   - Ambas imágenes viajan **100% limpias sin texto pegado abajo (`caption: ''`)** y protegidas por `inFlightStageCommercialKeys` + `order.waCommercialSentStages` para que jamás se envíen duplicadas.

---

## 4. Flujo Exacto de Confirmación Express en 1 Solo Paso (`server/whatsappEngine.ts`)

### 4.1. Llegada del Pedido Web (`startOrAdvanceVoiceCall` — Turno Inicial)
Apenas el comprador envía el formulario en `src/components/OrderForm.tsx` (que garantiza **0% pérdida de leads** incluso si el navegador no concede permiso GPS), el sistema pre-genera la imagen en memoria pero la retiene hasta que salga el audio:
1. **Primero — Nota de Voz #1 (`Deepgram Aura-2`):**
   - Lo saluda con calidez por su nombre, menciona la cantidad de unidades y el monto en **`"guaraníes"`** con envío gratis al recibir, y le pide responder con la palabra **`"CORRECTO"`** para confirmar su envío.
2. **1 Segundo Después (`1000ms`) — Imagen #1 Personalizada `1080×1080` (`stage1_welcome`):**
   - Se autoriza y envía automáticamente en tiempo real con todos sus datos y la instrucción de responder **`"CORRECTO"`**.

### 4.2. Cierre Instantáneo y Definitivo al Responder `"CORRECTO"` (`evaluateExpressOrderConfirmationInput`)
Cuando el cliente responde por texto o por nota de voz con la palabra **`"CORRECTO"`**:
1. Sella el pedido como 100% confirmado: `datosConfirmados = true`, `empaquetado = true`, `agenteCompletado = true`, `convStep = 5`, `estado = 'en_camino'`, `modalidadPagoElegida = 'contra_entrega'` y construye `comparativaDatos`.
2. Sincroniza el pedido confirmado en tiempo real con **Supabase (`public.pedidos` y `ORD-*`)** y con `/api/pedidos`.
3. Dispara `notifySellerOfOrderEvent(matchedOrder, 'green')`, entregando el **Reporte Ejecutivo Enumerado (`#1`, `#2`...)** al WhatsApp del vendedor (`waNotificacionesVendedor`).
4. **Primero — Envía el Audio de Confirmación (`Deepgram Aura-2`):**
   - *"Excelente, [Nombre], muchísimas gracias por tu confirmación. Tu pedido de [pack] de [producto] ya está totalmente confirmado y pasa directo a empaquetado a tu nombre."*
5. **1 Segundo Después (`1000ms`) — Envía por última etapa la Imagen de Pedido Confirmado (`stage3_confirmed`):**
   - Imagen impactante personalizada a nombre del cliente (`A NOMBRE DE: [Nombre]`), dándole las **¡FELICIDADES!** e informándole que en **48 a 72 horas (unos días)** la transportadora / los agentes del courier entrarán en contacto con él/ella y le estarán llamando en cuanto ya estén para entregarle el producto.

### 4.3. Manejo Inteligente de Correcciones y Dudas Antes de Confirmar
- Si el cliente corrige su nombre, ciudad o barrio, o hace una consulta del producto, el motor LLM actualiza el dato corregido, responde su consulta con calidez humana **100% en Audio** y le recuerda decir o escribir la palabra **`"CORRECTO"`** para pasar su pedido a empaquetado.

---

## 6. Temporizador de Ausencia de 3 Minutos y Blindaje Anti-Audios Duplicados

### 6.1. Seguimiento Inteligente por Inactividad (`getInactivityFollowUpDelayMs`)
- Nunca responde al instante de forma robótica ante el silencio del comprador:
  - **1er intento de seguimiento (`attempts === 0`):** Espera exactamente **3 minutos (`180.000 ms`)** de ausencia real del cliente antes de enviar una **Nota de Voz amable y humana** preguntándole si pudo ver el mensaje de arriba para confirmar con la palabra **`"CORRECTO"`**. **Cero imágenes en el seguimiento.**
  - **Intentos posteriores (`attempts >= 1`):** Espera **1 hora (`3.600.000 ms`)** entre recordatorios (máximo 8 intentos), siempre **100% en Audio**.

### 6.2. Triple Candado Anti-Concurrencia y Anti-Audios Iguales (`server/whatsappEngine.ts`)
1. **Cola Serializada por Teléfono (`perPhoneVoiceTurnQueue`):** Garantiza que `startOrAdvanceVoiceCall` procese un único turno a la vez por cada número de cliente, impidiendo carreras entre la automatización de llegada y respuestas rápidas.
2. **Guardia Anti-Repetición de Audio (`recentAiSpokenTurnByPhone`):** Compara la huella normalizada del texto hablado con el último audio enviado al mismo teléfono; si han pasado menos de **25 segundos** y la similitud supera el **85%**, bloquea el segundo envío para que **jamás salgan dos audios iguales consecutivos**.
3. **Debounce de Ráfagas del Cliente (`pendingCustomerBurstState` · `1800ms`) y Estado `'pending_connection'`:** Si el cliente manda 2 o 3 mensajes seguidos en 1 segundo, el motor los agrupa en una sola respuesta coherente; además, `anyVoiceOrAudioSent` reconoce tanto `'sent'` como `'pending_connection'` para no encolar textos redundantes cuando el socket reconecta.

---

## 7. Lógica Post-Confirmación (Pedido Inmutable por Chat + Derivación a Llamada)

Una vez que el pedido está confirmado (`datosConfirmados === true`) y fuera de la recepción de pago adelantado:
- **Pedido Bloqueado por Chat:** El agente jamás altera unidades, precios ni cancela pedidos por mensaje.
- **Identidad Humana 100%:** Nunca menciona que es IA o bot; habla siempre en primera persona como operador humano del área de despacho de Noelux™ y responde **100% en Nota de Voz**.
- **Si pide sumar/bajar unidades, cambiar dirección o cancelar:** Le explica con calidez que su pedido ya quedó cerrado en empaquetado y **lo deriva amablemente a realizar una llamada telefónica a ese mismo número** para que un **Especialista del Área de Ventas** procese la solicitud en vivo (tras lo cual el vendedor edita manualmente el pedido en `ProductConfirmedOrdersPanel.tsx` o `AdminView.tsx`).

---

## 8. Resolución `@lid` en 4 Capas, `Self-Chat`, Preservación Signal `pendingPreKey` y Persistencia Cloud en Supabase

1. **Resolución de Identificadores `@lid` (Baileys Multi-Device) Exclusiva para Pedidos Oficiales y `Self-Chat`:**
   - **Capa 1:** Pre-caché proactivo al enviar el turno inicial (`cacheRecipientLidMapping` vía `sock.onWhatsApp` y `lidMapping.getLIDsForPNs`).
   - **Capa 2:** Escucha continua de `lid-mapping.update` y `contacts.upsert` con guardado en `lid-mapping-*.json`.
   - **Capa 3:** Consulta USync en vivo en `messages.upsert` sobre los pedidos oficiales registrados cuando entra un `@lid` nuevo.
   - **Capa 4:** Vinculación segura por `pushName` sobre órdenes web activas y soporte completo de **`Self-Chat`** (`session.connectedLid` / `isSelfChat = true`) para que el dueño pueda probar el flujo completo desde su propio celular conectado (o pedir `"reporte"` para recibir su Reporte Ejecutivo).
2. **Preservación de Sesiones Criptográficas Signal (`pendingPreKey`):**
   - Ni `sanitizeAuthDirectory` ni el manejador de `stubType === 2` (`CIPHERTEXT`) destruyen archivos `session-*.json` válidos con `pendingPreKey`, asegurando que la primera respuesta de un comprador nuevo complete el handshake X3DH y se desencripte al primer intento.
3. **Persistencia Inmune a Redespliegues en Railway (`WAAUTH-*`, `WAVOICE-*`, `CFG-*`, `WAENG-*`):**
   - **Sesiones Baileys (`WAAUTH-*`):** Respaldo automático comprimido con GZIP en Base64 dentro de `public.codigos` en **Supabase Oficial (`https://pgpmopannzzubunuhlmb.supabase.co`)**, restaurado en el arranque antes de abrir sockets.
   - **Voz Neuronal por Producto (`WAVOICE-*` y `CFG-*`):** Conserva de forma inmutable la voz **Deepgram Aura-2** (`Estrella`, `Celeste`, `Sirio`, `Néstor`) elegida para cada producto.
   - **Doble Motor STT (`Deepgram Nova-3` + `Nova-2` en español):** Desenvuelve mensajes efímeros/`viewOnce`, autodetecta el contenedor nativo (`audio/ogg`, `audio/mp4`, `audio/aac`) y transcribe notas de voz entrantes en ~1 segundo.

---

## 9. Integración No Invasiva con Atribución AutoAds v2 (`AA-XXXXX`)

- El flujo Express de WhatsApp en 1 paso (`"CORRECTO"`), la Compuerta Audio-Primero (`1s`) y el Muro de Hierro (`isOfficialRegisteredProductOrder`) **permanecen 100% intactos** y NO afectan las métricas del algoritmo publicitario (`Circuito A`, optimizado sobre formularios web confirmados `Lead`).
- De forma paralela e independiente, AutoAds v2 dispone del endpoint `POST /api/attribution/wa-token` (tokens `AA-XXXXX` en `wa_attribution_tokens`, vigencia 30 días) y del matching telefónico normalizado (`5959XXXXXXXX`, `phone_stitch_30d`) en [`server/attributionAndOrders.ts`](./server/attributionAndOrders.ts) para recuperar la atribución publicitaria cuando un visitante derivado por WhatsApp termina completando un pedido.
- **Hidratación y Sincronización Autoritativa en Supabase (`server/autoadsStore.ts`)**: Tras redespliegues en Railway o búsquedas sin coincidencia en memoria, tanto `resolveWaTokenFromText` como los registros de `wa_attribution_tokens` se hidratan bajo demanda desde Supabase vía `hydrateAutoadsFromSupabase()` / `postgrestSelect()`, y cualquier escritura pendiente en cola se reintenta mediante `flushPendingSupabaseSyncs()` (`POST /api/sync/retry-queues`), sin depender de archivos JSON locales efímeros. Documentación completa en [`CEREBRO_AUTOADS.md`](./CEREBRO_AUTOADS.md).

---

## 10. Consola Administrativa en 2 Etapas, Cero Autodisparo e Imágenes en `localStorage`

1. **Flujo Visual Unificado en 2 Etapas (`Etapa 1/2` y `Etapa 2/2`):**
   - **Etapa 1/2:** Saludo inicial en audio + Imagen personalizada (esperando respuesta `"CORRECTO"`).
   - **Etapa 2/2:** Pedido confirmado (`datosConfirmados = true`) y agradecimiento final.
   - El botón en cada tarjeta del pedido se llama **`Mensaje`** con el contador explícito **`N msg`** (para no confundirlo con la etapa).
2. **Cero Autodisparo y Contextualización Estricta (`AdminView.tsx` + `whatsappEngine.ts`):**
   - Abrir la consola con **`Mensaje`** o alternar entre `👤 Yo Escribo`, `IA Texto` e `IA Audio` es **100% libre de autodisparo** (`triggerAiNow = false`).
   - En el servidor, `hasConversationAlreadyStarted()` y `getLatestUnansweredClientMessage()` impiden reiniciar la charla al saludo #1 cuando el pedido ya avanzó, respondiendo únicamente en contexto si el último mensaje sin contestar es del cliente (o mediante el botón manual **`🔄 Re-disparar etapa`**).
3. **Conciliación de Cola Offline (`WACHAT-*`) y Caché Local de Imágenes:**
   - Al reconectar WhatsApp, `flushPendingMessages()` y `reconcileLocalAndCloudChatMessages()` sincronizan `WACHAT-*` y descartan recordatorios `pending_connection` antiguos ya colapsados y enviados.
   - Las imágenes entrantes enviadas por clientes (`client_*`) se cachean en el **`localStorage` del navegador** (`noelux_chat_imgs_<orderId>`) sin almacenarse en la base de datos, y se purgan automáticamente al eliminar el pedido.
4. **Tarjeta Horizontal Fija de Etapa 1/2, Último Mensaje y Temporizador en Vivo:**
   - `getCustomerFollowUpStatus()` y `GET /api/whatsapp/messages` exponen el estado real del temporizador de seguimiento (`5 min` primer recordatorio, `1 hora` sucesivos), renderizado en una tarjeta horizontal fija en `AdminView.tsx` junto a **Último Mensaje Enviado** y una barra descriptiva dinámica con cuenta regresiva en vivo (`src/utils/whatsappChatStatus.ts`).

---

## 11. Embudo Paralelo de Oferta de Entrada (`server/entryEventEngine.ts` — Solo `purchasePath === 'entry_only'`)

Cuando un comprador solicita **únicamente el Producto Complementario de Entrada** (`purchasePath === 'entry_only'`) en un producto con `tripwireConfig.enabled`, `handleNewOrderAutomation()` bifurca **exclusivamente ese pedido** al motor `server/entryEventEngine.ts` (manteniendo al **100% intacto** el flujo `"CORRECTO"` para pedidos normales o `principal_bundle`):

1. **Nota de Voz con Música de Fondo (`mixVoiceWithBackgroundMusic`):**
   - Toma el audio `Deepgram Aura-2` (`OGG/Opus`) y lo mezcla mediante `/usr/bin/ffmpeg` (`libopus`, `48kHz`) con el preset musical configurado en el **Creador Rápido** (`warm_ambient`, `soft_lounge`, `commercial_pulse` o `none`) a nivel sutil (`volume=0.085`) para enviar una nota de voz humana con identidad de marca sin abrumar al cliente.
2. **Encuesta Nativa Interactiva de WhatsApp (`buildEntryPollDefinition` + `decryptPollVote`):**
   - Después de la nota de voz + imagen de oferta, envía una **encuesta real de 1 toque** (sin mencionar jamás la palabra interna `"tripwire"`):
     - **Opción 1:** Pasarse ahora al **Producto Principal con descuento** + **Complemento de Entrada GRATIS + Envío Gratis** → convierte el pedido en `principal_bundle` y avanza al flujo normal de empaquetado.
     - **Opción 2:** Anotarse en la **Lista Especial de 10 Cupos (5–6 horas)** sin presión.
   - Acepta tanto clics nativos sobre la encuesta (`pollUpdateMessage` desencriptado vía `decryptPollVote` de `@whiskeysockets/baileys`) como respuestas por texto o nota de voz (`classifyEntryTextIntent`).
3. **Respeto al Horario Laboral (Tope Estricto de 2 Intentos) + Avisos Cada 2 Horas + Cierre Transparente (`processDueEntryEvents`):**
   - **Sin respuesta:** Tras el Intento #1, espera **90 minutos** y envía un único **Intento #2** amable (`attemptsSent = 2`). Si tras otros **90 minutos** sigue sin responder, pasa a **`silenced_until_end`** (silencio absoluto hasta completar las 5–6 horas del evento).
   - **En Lista de 10 Cupos (`waitlist_enrolled`):** Envía actualizaciones cordiales cada **2 horas** mostrando cupos restantes y tiempo faltante.
   - **Fin del Evento (`final_dispatched`):** Al vencer `eventEndsAt`, envía la confirmación final del artículo individual transparentando siempre el **delivery (`Gs. 40.000` por defecto, ej. `Gs. 20.000 + Gs. 40.000 = Gs. 60.000 al recibir`)** sin prometer jamás envío gratis en el artículo suelto.

> Detalles completos de arquitectura en [`ARQUITECTURA_CREADOR_UNIVERSAL_Y_EMBUDO_GANCHO.md`](./ARQUITECTURA_CREADOR_UNIVERSAL_Y_EMBUDO_GANCHO.md).

