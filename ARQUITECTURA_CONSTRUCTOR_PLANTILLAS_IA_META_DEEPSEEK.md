# 🏗️ ARQUITECTURA ALGORÍTMICA COMPLETA: KERNEL OFICIAL `deepseek-ai/deepseek-harness` (CORDIS) + ESTUDIO AUTOPILOTO 1-CLIC + DISTRIBUCIÓN MULTI-MODELO OPENROUTER (`z-ai/glm-5.3` DESARROLLO WEB + `openai/gpt-4o-mini` COPYWRITING + `openai/gpt-image-2.6` IMÁGENES + `minimax/minimax-m3.1-flash` VIDEO REELS) + META CAPI ANTI-APPLE + PIPEBOARD ADS AUTOPILOT + INTERFAZ MÓVIL ANDROID 100% NEGRO PURO

Este documento detalla **píxel por píxel** y **algoritmo por algoritmo** la arquitectura vigente del **Estudio Autopiloto de Páginas de Producto**, el **Kernel Oficial DeepSeek Harness (`deepseek-ai/deepseek-harness`)**, la **Distribución Multi-Modelo vía OpenRouter**, el **Gateway First-Party de Meta Conversions API (CAPI)**, el **Creador de Anuncios en Piloto Automático Pipeboard Meta Ads** y la **Interfaz Móvil Nativa Android / Vercel 100% Negro Puro**.

---

## 1. Filosofía Central: 100% Autopiloto Sin Formularios Manuales

A diferencia de los constructores tradicionales que obligan al usuario a rellenar cuestionarios largos o formularios de múltiples pasos, toda la arquitectura actual opera en **Modo 100% Autopiloto de 1 Clic**:

1. **Creación en 1 Clic (`src/components/ProductTemplateBuilderStudio.tsx`)**:
   - El usuario únicamente escribe el nombre del producto (o toca un preset rápido / sube una foto y el precio unitario en Guaraníes) y pulsa **`Lanzar Autopiloto (1 Clic)`**.
   - El **Kernel Cordis (`src/utils/deepseekHarnessKernel.ts`)** conectado al modelo **`z-ai/glm-5.3` (GLM-5.3) en OpenRouter** ejecuta automáticamente los 4 plugins de arquitectura: selecciona el arquetipo visual de entre las **33 plantillas diferenciadas**, genera las **8 escenas fotográficas 1:1 en uso real**, calcula la **escalera de precios COD (1x, 2x con regalo y 3x)**, activa el **Escudo de Verdad Física** y **auto-entrena el Cerebro del Agente de WhatsApp a 1000x**.
2. **Clon Intocable del Algoritmo de Confirmación de WhatsApp (`server/whatsappEngine.ts`)**:
   - Cada página publicada hereda automáticamente el motor de confirmación de 5 pasos en WhatsApp, la pronunciación telefónica paraguaya `4 - 3 - 3` dígito por dígito (`0973, 857, 397`), la diferenciación entre **Casa Independiente** y **Edificio**, la validación de **Mapa GPS exacto** y los **Reportes Ejecutivos Verdes al WhatsApp del Vendedor**.

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

## 3. Distribución Específica de Modelos de IA vía OpenRouter y Motor AutoAds de Impacto en 0.0 Segundos

La plataforma implementa una distribución especializada de modelos de IA en OpenRouter para maximizar la velocidad, la conversión y la congruencia visual/textual en cada área:

1. **Desarrollo Web & Agente de Código (`ProductTemplateBuilderStudio.tsx` / `/api/builder/coding-agent`)**:
   - Modelo: **`z-ai/glm-5.3` (GLM 5.3)** en OpenRouter.
   - Utilizado para razonamiento estructural profundo, mutación de componentes y plugins del Kernel Harness Cordis.
2. **AutoAds Cerebro Maestro 0.0s, Contexto & Director de Prompts (`AutoAdsView.tsx` / `/api/autoads/brain-train` / `/api/autoads/regenerate-ad`)**:
   - Modelo Principal: **`z-ai/glm-5.3`** con respaldo automático a **`openai/gpt-4o-mini`** en OpenRouter.
   - **Regla Inquebrantable de los 0.0 Segundos (Palabras 1 a 4)**: Cada anuncio nombra en sus primeras 1 a 4 palabras el **objeto exacto** (`PROYECTOR NAVIDEÑO`, `TALADRO PERCUTOR`, etc., sin marcas desconocidas) junto con el **dolor, solución, placer u oferta irresistible** (`🔥 PROYECTOR NAVIDEÑO EN OFERTA:`, `🛑 PROYECTOR NAVIDEÑO PAGO EN PUERTA:`, `💡 PROYECTOR NAVIDEÑO SIN COMPLICACIONES:`, `🎁 2X PROYECTOR NAVIDEÑO EN OFERTA:`, `⚡ PROYECTOR NAVIDEÑO MÁXIMA POTENCIA:`, `📦 PROYECTOR NAVIDEÑO KIT COMPLETO:`).
   - **Logística Realista COD Paraguay**: Prohibido prometer entregas *"hoy mismo en tu puerta"*; todos los anuncios comunican con transparencia que el comprador reserva sin adelantos y recibe en **2 a 3 días hábiles (48 a 72 horas)** pagando al repartidor en puerta.
3. **Generación Secuencial 6/6 de Imágenes Publicitarias de Alto Impacto (`/api/autoads/generate-ad-images`)**:
   - Modelos OpenAI en OpenRouter: **`openai/gpt-image-2.6-flare`** (predeterminado), **`openai/gpt-image-2.6-sunburst`**, **`openai/gpt-5-image-mini`**, **`openai/gpt-image-1-mini`** y **`openai/gpt-5.4-image-2`** en resolución universal `1024x1024`.
   - **Arquitectura Secuencial 1 a 1 Tolerante a Fallos**: El frontend solicita las 6 imágenes de forma individual (`[0]` a `[5]`) con `try / catch` aislado y pase automático de autorrecuperación para garantizar siempre las **6 de 6 imágenes**.
   - **Regla Visual de Producto en Uso + Resultado Real + Texto y CTA Congruente**: Cada imagen muestra obligatoriamente el **producto físico funcionando en vivo**, el **resultado real que provoca en las personas o el hogar** y un **titular + botón CTA en español 100% congruente** con el texto de ese anuncio.
4. **Creador de Video Reels (`/api/autoads/generate-ad-images` y `AutoAdsView.tsx`)**:
   - Modelos de Video en OpenRouter: **`bytedance/seedance-2.5`** (predeterminado, capaz de animar la foto real del producto y generar video de avatar/demostración) y **`google/gemini-omni-1.2-flash`** / **`google/gemini-omni-1.1-flash`**.

**Detección Automática desde Railway y Panel Admin**:
- El servidor lee automáticamente la API Key desde `.env`, `store_config.json` o las variables de entorno de Railway (`process.env.OPENROUTER_API_KEY || process.env.OPENROUTESERVICE_API_KEY`).
- También permite configurar y guardar la clave directamente desde el cajón `OpenRouter & Pipeboard` en `#admin`.

---

## 4. Píxel de Facebook + Algoritmo de 12 Eventos Full-Funnel + Servidor First-Party CAPI Anti-Bloqueo de Apple iOS (`src/utils/metaPixelEngine.ts` y `/api/meta-capi/track`)

Todas las páginas creadas cuentan con infraestructura de **Doble Canal (Browser Pixel `fbq` + Servidor First-Party Conversions API `CAPI`)** para alcanzar **Calidad de Coincidencia de Eventos (EMQ) 9.4/10** y evitar pérdidas de atribución por **iOS 14.5+ ATT, Safari ITP y AdBlockers**:

1. **Persistencia First-Party de `_fbp` y `_fbc`**:
   - Captura automática de `?fbclid=...` en el aterrizaje y persistencia en cookie First-Party y `localStorage`.
2. **Gateway First-Party en el Servidor (`POST /api/meta-capi/track` en `vite.config.ts`)**:
   - Recibe los eventos desde el mismo dominio, extrae IP real y User-Agent, normaliza teléfonos paraguayos (`5959...`), aplica **Hash SHA-256 (Advanced Matching)** y transmite Servidor-a-Servidor a `https://graph.facebook.com/v21.0/{pixel_id}/events` con deduplicación exacta por `event_id`.
3. **Los 12 Eventos Full-Funnel Activos**:
   - `PageView`, `ViewContent`, `CustomizeProduct`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Lead`, `Purchase` (con valor real en `PYG` y Advanced Matching SHA-256 completo), `Contact`, `GalleryInteraction`, `EngagedVisitor` (15s/45s) y `DeepScroll` (50%/80%).

---

## 5. Creador de Anuncios en Piloto Automático (`Pipeboard · Meta Ads IA` — `src/components/PipeboardAdsManagerView.tsx` y `src/utils/pipeboardEngine.ts`)

Rediseñado íntegramente en **100% Negro Puro estilo Vercel / Android Nativo (`#0d0d0f`)**, este módulo automatiza la creación y publicación de campañas publicitarias en Meta Ads:

1. **Guía Paso a Paso Integrada en el Panel**:
   - Explica en pantalla los 3 pasos simples: elegir la página de producto, seleccionar el comando psicológico del robot y pulsar **`Iniciar Piloto Automático (1 Clic)`**.
2. **4 Fórmulas Psicológicas Slash del Robot (`AUTOPILOT_STRATEGIES`)**:
   - `/flash-sale` (**Oferta Relámpago**): Urgencia + Descuento 1x y 2x + Pago Contra Entrega.
   - `/anti-scam` (**Cero Riesgo**): Revisás el paquete antes de abonar al delivery (`100% Confianza`).
   - `/duo-pack` (**Pack Ahorro Familiar**): El 80% lleva 2 unidades con envío bonificado.
   - `/viral-demo` (**Demostración de Impacto**): Problema resuelto en 30 segundos con prueba visual.
3. **Generación de Suite `3:2:2` + Video Comercial con `GLM-5.3` (`/api/pipeboard/generate-creatives`)**:
   - Genera automáticamente 4 piezas listas para convertir en Paraguay:
     1. **🖼️ Feed 1:1 (#1)**: Póster cuadrado de Oferta Directa Contra Entrega.
     2. **🖼️ Feed 1:1 (#2)**: Póster cuadrado de Garantía y Confianza.
     3. **📱 Story 9:16**: Póster vertical para Historias y Reels.
     4. **🎬 Video 9:16**: Video comercial animado de 4 escenas (12 segundos) con reproductor en vivo.
   - Incluye selector táctil en grilla `2x2` adaptada a celulares sin desbordes de texto, más cuadros oscuros para el *Titular (Headline)* y el *Texto Principal (Copy Persuasivo)*.
4. **Publicación Directa vía `pipeboard-co/meta-ads-mcp` (`/api/pipeboard/publish-campaign`)**:
   - Ejecuta la secuencia oficial MCP (`get_ad_accounts` → `upload_ad_image` → `create_campaign` → `create_ad_set` → `create_ad_creative` → `create_ad`) conectada al Píxel y URL del producto (`/?p=slug`), listando las campañas publicadas con acceso directo a **Meta Ads Manager**.

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
