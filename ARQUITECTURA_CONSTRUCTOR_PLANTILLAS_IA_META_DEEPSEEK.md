# 🏗️ ARQUITECTURA ALGORÍTMICA: KERNEL `deepseek-ai/deepseek-harness` (CORDIS) + ESTUDIO AUTOPILOTO 1-CLIC + AUTOADS v2 (`openai/gpt-4o`, `openai/gpt-image-2.6-sunburst`, `google/gemini-omni-1.2-flash`) + META CAPI `Lead` CANÓNICO + PIPEBOARD ADS

> 📌 Para la especificación integral del nuevo **Cerebro Psicológico y de Inteligencia Publicitaria de AutoAds (Circuito A independiente del courier)** y el **Circuito B ERP/Purchase**, consultá [`CEREBRO_AUTOADS.md`](./CEREBRO_AUTOADS.md).

Este documento detalla la arquitectura vigente del **Estudio Autopiloto de Páginas de Producto**, el **Kernel DeepSeek Harness (`src/utils/deepseekHarnessKernel.ts`)**, los motores generativos OpenRouter conservados, el **Gateway First-Party de Meta CAPI (`Lead` canónico en checkout COD + `Purchase` backend-only en entrega/cobro)** y los publicadores **Meta Direct** y **Pipeboard MCP**.

---

## 1. Filosofía Central: 100% Autopiloto Sin Formularios Manuales

A diferencia de los constructores tradicionales que obligan al usuario a rellenar cuestionarios largos o formularios de múltiples pasos, toda la arquitectura actual opera en **Modo 100% Autopiloto de 1 Clic**:

1. **Creación en 1 Clic (`src/components/ProductTemplateBuilderStudio.tsx`)**:
   - El usuario únicamente escribe el nombre del producto (o toca un preset rápido / sube una foto y el precio unitario en Guaraníes) y pulsa **`Lanzar Autopiloto (1 Clic)`**.
   - El **Kernel Cordis (`src/utils/deepseekHarnessKernel.ts`)** conectado al modelo **`z-ai/glm-5.3` (GLM-5.3) en OpenRouter** ejecuta automáticamente los 4 plugins de arquitectura: selecciona el arquetipo visual de entre las **33 plantillas diferenciadas**, genera las **8 escenas fotográficas 1:1 en uso real**, calcula la **escalera de precios COD (1x, 2x con regalo y 3x)**, activa el **Escudo de Verdad Física** y **auto-entrena el Cerebro del Agente de WhatsApp a 1000x**.
2. **Clon Intocable del Algoritmo Express de Confirmación en 1 Paso por WhatsApp (`server/whatsappEngine.ts`)**:
   - Cada página publicada hereda automáticamente el **Motor de Confirmación Express en 1 Solo Paso** (`"CORRECTO"` / `"ESTÁ BIEN"`), la **Única Imagen Comercial Automática `1080×1080` según el Paquete Comprado (1x, 2x o 3x)**, la **Regla 99–100% Audio (`Deepgram Aura-2`)** con pronunciación obligatoria en **`"guaraníes"`** y lectura telefónica paraguaya `4 - 3 - 3` dígito por dígito (`0973, 857, 397`), la diferenciación entre **Casa Independiente** y **Edificio**, la validación de **Mapa GPS exacto**, la **Promoción de Pago Adelantado `-Gs. 30.000` (`"QUIERO PARTICIPAR"`) con Botón 1-Clic `"✅ Aprobar Pago"`** y los **Reportes Ejecutivos Verdes al WhatsApp del Vendedor**.

---

## 2. Arquitectura del Kernel Oficial `deepseek-ai/deepseek-harness` (`src/utils/deepseekHarnessKernel.ts`)

Siguiendo la especificación oficial del repositorio [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness), el motor del estudio reemplaza los scripts estáticos por un **Kernel de Eventos basado en Cordis (`CordisHarnessKernel`)** con efectos reversibles (`EffectDisposer`):

### 2.1. Los 4 Plugins Oficiales Registrados en el Kernel
1. **`theme-architect` (`pluginThemeArchitect`)**:
   - Analiza semánticamente el producto y el comando recibido para inyectar uno de los arquetipos visuales del catálogo de **33 plantillas COD Paraguay** (`Brutalist Industrial`, `Minimalist Luxury`, `Warm Culinary`, `Athletic Dark Performance`, `Nordic Clinical`, `Cyber Gadgets` o `Noelux Clásico`), mutando colores de cabecera, tipografía, bordes y sellos de confianza.
2. **`cod-pricing-engine` (`pluginCodPricingEngine`)**:
   - Ejecuta `calculateCodEconomicsParaguay()` y `computePackLadderFromUnit()` para construir la escalera psicológica terminada en `9.000 Gs.`:
     - **Pack 1 Unidad**: Precio base de entrada.
     - **Pack 2 Unidades (Oferta Estrella)**: Descuento proporcional + activación de bono/regalo exclusivo (`pack2GiftText`).
     - **Pack 3 Unidades (Pack Familiar/Mayorista)**: Máximo ahorro por unidad y cálculo de ganancia neta libre descontando costo de proveedor, CPA de Meta Ads, flete de courier y tasa de rebote.
3. **`physical-truth-shield` (`pluginPhysicalTruthShield`)**:
   - Sincroniza la **Verdad Física del Producto (`ProductPhysicalTruth`)**: fuente de alimentación (`220V`, `Batería USB`, `Solar`, `Manual`), resistencia al agua, dimensiones reales, material principal, contenido exacto de la caja sellada y días de garantía oficial.
   - Bloquea cualquier promesa falsa tanto en los titulares de la Landing Page como en las respuestas del Agente de WhatsApp.
4. **`whatsapp-brain-trainer` (`pluginWhatsappBrainTrainer`)**:
   - Ejecuta `buildAutoTrainedAgentBrain()` y genera el cerebro conversacional (`ProductAgentBrain`) con nombre hablado natural (`shortProductSpoken`), ficha técnica hablada, argumento de subida a Pack 2 (`upsellPack2PitchSpoken`) y 5 ángulos extensos post-confirmación (`postConfirmationProductAngles`).

### 2.2. Comandos Slash de Autopiloto (`HARNESS_SLASH_COMMANDS`)
El usuario puede disparar transformaciones completas en 1 clic mediante los comandos del Harness:
- **`/autopilot`**: Sintetiza de punta a punta la página completa, las 8 escenas, la escalera de precios y el cerebro de WhatsApp.
- **`/luxury`**: Transforma la arquitectura visual al arquetipo *Minimalist Luxury* (paleta oscura/oro, tipografía editorial y ángulo de exclusividad).
- **`/flash`**: Activa ángulo de liquidación relámpago con urgencia de stock y foco en cobro contra entrega hoy.
- **`/pack2-gift`**: Inyecta un regalo especial bonificado en el Pack de 2 unidades para maximizar el ticket promedio.
- **`/audit`**: Audita la coherencia entre la Verdad Física, los precios en Guaraníes y el entrenamiento del Agente de WhatsApp.

### 2.3. Disposers y Reversibilidad Instantánea (`undoLastMutation`)
Cada vez que el Kernel aplica una mutación sobre el borrador (`ProductDraftState`), registra un `EffectDisposer` con una instantánea profunda del estado previo. El botón **`Deshacer Último Cambio (Undo)`** restaura en milisegundos el estado exacto anterior sin perder datos.

---

## 3. Distribución Específica de Modelos de IA vía OpenRouter, Cola Estricta Turno por Turno (`Anti-HTTP 402 in-flight`) y Caché Persistente Dual

La plataforma implementa una distribución especializada de modelos de IA en OpenRouter para maximizar la velocidad, la conversión y la congruencia visual/textual en cada área:

1. **Desarrollo Web & Agente de Código (`ProductTemplateBuilderStudio.tsx` / `/api/builder/coding-agent`)**:
   - Modelo: **`z-ai/glm-5.3-flash`** en OpenRouter.
   - Utilizado para razonamiento estructural profundo, mutación de componentes y plugins del Kernel Harness Cordis.
2. **AutoAds Cerebro Psicológico v2 (`server/autoAdsIntelligence.ts` / `/api/autoads/brain-train` / `/api/autoads/regenerate-ad`)**:
   - Modelo: **`openai/gpt-4o`** vía OpenRouter.
   - Preserva los motores originales agregando investigación competitiva en 3 niveles honestos, perfil psicológico Schwartz, 6 hipótesis dinámicas y memoria de aprendizaje desde formularios completados (`Circuito A`). Cuando `strategyMode === 'hypothesis_v2'`, `sanitizeAdCopyForParaguayCod` usa `{ policyGuardOnly: true }` para proteger los hooks psicológicos sin truncarlos; la regla legacy de las 0.0 palabras solo aplica si se desactiva `AUTOADS_STRATEGY_V2_ENABLED`.
   - **Logística Realista COD Paraguay**: Todos los anuncios comunican tiempos reales de entrega COD (**2 a 3 días hábiles / 48 a 72 horas**) y lenguaje claro para el cliente (`pagás cuando recibís`).
3. **Generación de Imágenes Publicitarias en Modo Seguro Turno por Turno (`Anti-HTTP 402 in-flight requests`)**:
   - Modelo conservado intacto: **`openai/gpt-image-2.6-sunburst`** en OpenRouter consumiendo el `aiImagePrompt` específico de cada hipótesis (soportando `1:1` y `9:16`).
   - Mantiene el backoff automático anti-`HTTP 402` de `4.5s`, la cola secuencial turno por turno (`3.5s` en frontend) y la caché persistente dual (`localStorage` + `store_config.json`).
4. **Creador de Video Reels (`/api/autoads/generate-ad-images` y `AutoAdsView.tsx`)**:
   - Modelo conservado intacto: **`google/gemini-omni-1.2-flash`** recibiendo el `videoScriptPrompt` de cada hipótesis.

---

## 4. Píxel de Facebook, Conversión Canónica Única (`Lead`), Atribución 30d y `Purchase` Independiente (`Circuito B`)

Todas las páginas cuentan con infraestructura de **Doble Canal (Browser Pixel `fbq` + Servidor First-Party CAPI `/api/meta-capi/track`)** y persistencia conjunta idempotente en `POST /api/pedidos`:

1. **Atribución 30 Días + `_fbp` / `_fbc` / `aa_cid` (`src/utils/metaPixelEngine.ts`):**
   - Captura `last_paid_touch` por 30 días en `localStorage` y cookie `aa_last_paid_touch_v2` (una visita directa posterior no sobrescribe el último toque pago vigente), junto con `visitorId` único por visitante.
2. **Evento Canónico de Optimización Publicitaria (`Lead`):**
   - Al teclear en el formulario (`OrderForm.tsx`) solo se dispara **`InitiateCheckout`** una vez.
   - **`Lead`** se emite **únicamente** después de que `addOrder` (`POST /api/pedidos`) confirma la persistencia conjunta de `pedidos` + `order_attribution`, contando una sola vez por pedido (`event_id = ord_<reservaid>_Lead`). Opcionalmente puede emitirse `OrderReservedCOD` como evento personalizado secundario de telemetría sin sumar en `Results` (`OUTCOME_LEADS` / `LEAD`).
3. **`Purchase` Backend-Only Separado del Algoritmo AutoAds (`server/metaCapiWorker.ts`):**
   - **Nunca se dispara `Purchase` al enviar el formulario COD.** `Purchase` se emite exclusivamente desde backend (`POST /api/pedidos/estado` / Circuito B) cuando el pedido alcanza `entregado_fisicamente && cobrado_verificado` dentro de la ventana real de 7 días de Meta (`action_source: 'website'`), sin usar `physical_store` ni alterar fechas si venció.

---

## 5. AutoAds 360: UI de 3 Pasos Preservada, OAuth 1-Clic y Preflight Meta Direct / Pipeboard

1. **Flujo UI Intacto (`src/components/AutoAdsView.tsx`):** Se conservan sin cambios los **3 pasos**: `1. INVESTIGAR -> 2. GENERAR TODOS LOS CREATIVOS -> 3. PUBLICAR EN META ADS`.
2. **Estructura Comercial Fija y OAuth 1-Clic:** `Landingcod`, cuenta `act_1048211497774834` (`834`), píxel `1276031534651377` (`377`), página `Landingcod Shop` (`1050835598123904`) y exclusión automática de `act_424711183775699`.
3. **Publicación Compatibilizada (`POST /api/meta/publish-direct`, `POST /api/pipeboard/publish-campaign`, `POST /api/autoads/preflight`):**
   - Optimiza exclusivamente a objetivo **`OUTCOME_LEADS`** (`LEAD`).
   - Normaliza el presupuesto según la moneda real de la cuenta (`PYG` entero sin multiplicar por `100`; `USD` en centavos).
   - Emite advertencia no bloqueante si el píxel tiene pocos eventos `Lead` en 7 días.
   - Adjunta `aa_cid` + UTMs (`url_tags` en Meta Direct y `link` query params en Pipeboard), sube vídeos en Direct vía `/advideos` (con fallback controlado a imagen en Pipeboard cuando MCP no soporta vídeo) y registra cada anuncio publicado en `ad_entities`.

---

## 6. Experiencia Móvil Nativa Android / Vercel 100% Negro Puro + Guías Interactivas (`src/components/AdminSectionGuide.tsx`)

Todo el Panel Administrativo (`#admin`) está construido como una **aplicación móvil Android de alta precisión inspirada en Vercel**:

1. **Monocromo Negro Puro (`#000000` / `#0d0d0f` / `#09090b`)**:
   - Cero tarjetas blancas, cero fondos beige. Contraste limpio descansado para la vista con bordes `border-zinc-800` y acentos funcionales en esmeralda (`emerald-500`), ámbar (`amber-400`) y rojo (`red-500`).
2. **Navegación Inferior Táctil (Bottom Navigation Bar) + Drawer**:
   - Barra fija inferior en pantallas móviles con acceso instantáneo en 1 toque a `Páginas`, `Creador IA`, `Meta Ads`, `WhatsApp` y `Voz & LLM`.
3. **Cero Desbordes en Tarjetas de Producto y Botones Móviles**:
   - En cada tarjeta de producto, el botón principal **`🤖 Editar con Agente IA (DeepSeek)`** ocupa una fila completa (`w-full sm:w-auto h-11`) y los controles secundarios se distribuyen en una grilla de 12 columnas para que ningún texto se corte ni sobresalga en pantallas de `360px–390px`.
4. **Guías Paso a Paso (`AdminSectionGuide`) y Banners Explicativos en Todas las Secciones**:
   - Cada uno de los 6 menús principales y cada una de las 4 sub-pestañas internas de producto cuenta con su guía interactiva desplegable, explicaciones de cada tarjeta y consejos prácticos para operar todo desde el celular sin confusión.
