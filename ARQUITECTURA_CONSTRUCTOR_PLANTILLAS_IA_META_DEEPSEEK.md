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

## 3. Distribución Específica de Modelos de IA vía OpenRouter, Cola Estricta Turno por Turno (`Anti-HTTP 402 in-flight`) y Caché Persistente Dual

La plataforma implementa una distribución especializada de modelos de IA en OpenRouter para maximizar la velocidad, la conversión y la congruencia visual/textual en cada área:

1. **Desarrollo Web & Agente de Código (`ProductTemplateBuilderStudio.tsx` / `/api/builder/coding-agent`)**:
   - Modelo: **`z-ai/glm-5.3` (GLM 5.3)** en OpenRouter.
   - Utilizado para razonamiento estructural profundo, mutación de componentes y plugins del Kernel Harness Cordis.
2. **AutoAds Cerebro Maestro 0.0s, Contexto & Director de Prompts (`AutoAdsView.tsx` / `/api/autoads/brain-train` / `/api/autoads/regenerate-ad`)**:
   - Modelo Principal: **`z-ai/glm-5.3`** con respaldo automático a **`openai/gpt-4o-mini`** en OpenRouter.
   - **Regla Inquebrantable de los 0.0 Segundos (Palabras 1 a 4)**: Cada anuncio nombra en sus primeras 1 a 4 palabras el **objeto exacto** (`PROYECTOR NAVIDEÑO`, `TALADRO PERCUTOR`, etc., sin marcas desconocidas) junto con el **dolor, solución, placer u oferta irresistible** (`🔥 PROYECTOR NAVIDEÑO EN OFERTA:`, `🛑 PROYECTOR NAVIDEÑO PAGO EN PUERTA:`, `💡 PROYECTOR NAVIDEÑO SIN COMPLICACIONES:`, `🎁 2X PROYECTOR NAVIDEÑO EN OFERTA:`, `⚡ PROYECTOR NAVIDEÑO MÁXIMA POTENCIA:`, `📦 PROYECTOR NAVIDEÑO KIT COMPLETO:`).
   - **Logística Realista COD Paraguay**: Prohibido prometer entregas *"hoy mismo en tu puerta"*; todos los anuncios comunican con transparencia que el comprador reserva sin adelantos y recibe en **2 a 3 días hábiles (48 a 72 horas)** pagando al repartidor en puerta.
3. **Generación de Imágenes Publicitarias en Modo Seguro Turno por Turno (`Anti-HTTP 402 in-flight requests`)**:
   - Modelos OpenAI en OpenRouter: **`openai/gpt-image-2.6-flare`** (predeterminado), **`openai/gpt-image-2.6-sunburst`**, **`openai/gpt-5-image-mini`**, **`openai/gpt-image-1-mini`** y **`openai/gpt-5.4-image-2`** en resolución universal `1024x1024`.
   - **Algoritmo Anti-Bloqueo `in-flight requests` (`HTTP 402`)**:
     - En el servidor (`invokeOpenRouterImageModel` en `/vite.config.ts`), si OpenRouter reporta `HTTP 402 ("This request would exceed your available credits given your current in-flight requests. Retry after in-flight requests settle")`, el motor espera **4.5 segundos (`4500ms`)** a que se liquide la reserva en vuelo y reintenta automáticamente el mismo modelo hasta 3 veces sin disparar fallbacks simultáneos.
     - En el frontend (`AutoAdsView.tsx`), el Paso 2 prepara en 2 segundos los **6 Textos y Prompts** y ofrece dos modos 100% seguros:
       1. **Modo Individual (`1 por 1` Manual)**: Botón **`⚡ Generar Imagen IA (Solo este anuncio #N)`** en cada tarjeta.
       2. **Modo Cola Secuencial (`1 a la vez` con Pausa de Liquidación)**: Botón **`🛡️ Generar las 6 Imágenes por Turno (1 a la vez · Espera 3.5s entre turnos)`** con indicador de turno activo y botón **`⏹️ Pausar Cola`**.
   - **Persistencia Dual Anti-Pérdida (`autoads_creatives_cache_v3_` + `/api/autoads/save-creatives-cache`)**:
     - Cada imagen generada se guarda como archivo `.png` en `/public/assets/ai-ads/`, como `dataUrl` Base64 en `localStorage` (`autoads_creatives_cache_v3_<productKey>`) y en el backend (`store_config.json` vía `POST /api/autoads/save-creatives-cache`), garantizando que las imágenes jamás desaparezcan al recargar la página, iniciar sesión con Facebook OAuth o redesplegar el contenedor en Railway.
4. **Creador de Video Reels (`/api/autoads/generate-ad-images` y `AutoAdsView.tsx`)**:
   - Modelos de Video en OpenRouter: **`bytedance/seedance-2.5`** (predeterminado, capaz de animar la foto real del producto y generar video de avatar/demostración) y **`google/gemini-omni-1.2-flash`** / **`google/gemini-omni-1.1-flash`**.

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

## 5. AutoAds 360: Autenticación OAuth 1-Clic con Facebook, Descubrimiento Dinámico de Nombres en Vivo y Publicación Directa en Meta Graph API v21.0 (`src/components/AutoAdsView.tsx` y `vite.config.ts`)

1. **Estructura Comercial Oficial Fijada por ID + Nombres Reales Dinámicos desde Meta Graph API**:
   - **Portafolio Comercial (Business)**: `Landingcod`
   - **Cuenta Publicitaria Oficial (termina en `834`)**: ID bloqueado `act_1048211497774834` (`1048211497774834`). Su nombre real actual (`liveAdAccountName`) se consulta dinámicamente en vivo desde `GET /v21.0/act_1048211497774834?fields=id,account_id,name,currency,account_status,business_name`.
   - **Píxel Oficial de la Cuenta 834 (termina en `377`)**: ID bloqueado `1276031534651377`. Su nombre real actual (`livePixelName`) se consulta dinámicamente en vivo desde `GET /v21.0/act_1048211497774834/adspixels?fields=id,name` y `GET /v21.0/1276031534651377?fields=id,name`.
   - **Página Oficial de Facebook (Fanpage)**: `Landingcod Shop` — ID fijo `1050835598123904`.
   - **Cuenta Personal Excluida y Auto-Pausada**: `act_424711183775699` (`Richard Almiron`) está 100% filtrada y excluida; además, el backend inspecciona automáticamente `act_424711183775699/campaigns` y pausa (`status: 'PAUSED'`) cualquier campaña `[META IA]` que se haya creado allí por error en el pasado.
2. **Autenticación Facebook OAuth en 1 Clic (`GET /api/meta/auth-url`, `GET /api/meta/callback`, `POST /api/meta/restore-session`, `GET /api/meta/status`)**:
   - Resolución dinámica de `redirect_uri` según el host real (`https://autoads360.up.railway.app/api/meta/callback`, `https://landingcod.com/api/meta/callback` o `http://localhost:3000/api/meta/callback`).
   - Intercambio automático por token de larga duración (~60 días) y respaldo en `localStorage` (`autoads_meta_oauth_backup_v1`) con auto-curación vía `POST /api/meta/restore-session` cuando Railway reinicia el contenedor tras un despliegue.
   - Tarjeta de Referencia Oficial (`data-testid="meta-official-reference-card"`) con botones de copiado en 1 clic y botón **`🔄 Actualizar Nombres Reales desde Meta (834 / 377)`** (`data-testid="btn-discover-live-meta-names"`).
3. **Publicación Directa en Meta Graph API v21.0 (`POST /api/meta/publish-direct`)**:
   - Fuerza siempre `adAccountId = 'act_1048211497774834'`, `facebookPageId = '1050835598123904'` y `pixelId = '1276031534651377'`.
   - Detecta en vivo la moneda de la cuenta (`USD` en centavos vs `PYG` entero en Guaraníes), convierte imágenes locales `/assets/ai-ads/...png` o `data:image/...` a Base64 (`bytes`) para `/act_1048211497774834/adimages`, y ejecuta la cadena completa: **Campaña → Conjunto de Anuncios (`AdSet`) → Subida de Imágenes → Creativos (`object_story_spec`) → Anuncios (`Ads`)**.

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
