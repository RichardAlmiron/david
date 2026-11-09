# Noelux™ — Plataforma E-Commerce COD (Pago Contra Entrega) + Kernel Autopiloto `deepseek-harness` + Motor Multi-WhatsApp, Voz Deepgram Aura-2, AutoAds (Cerebro Maestro GPT-4o Mini + Meta Ads Directo) y Modelo Dual `GLM-5.3` (Desarrollo Web) + `openai/gpt-4o-mini` (Anuncios)

Aplicación full-stack desarrollada en **React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Baileys Multi-Device + Deepgram Aura-2 (TTS OGG/Opus Nativo) + Deepgram Nova-3 (STT) + Kernel Oficial `deepseek-ai/deepseek-harness` (Cordis) & OpenRouter `z-ai/glm-5.3` (Desarrollo Web) + `openai/gpt-4o-mini` (AutoAds Marketing Copy)** con sincronización universal en tiempo real sobre **Supabase** e interfaz administrativa **100% Negro Puro estilo App Móvil Android / Vercel**.

---

## 🤖 Distribución Específica de Modelos de IA en OpenRouter

1. **Desarrollo Web & Kernel Autopiloto de Páginas (`ProductTemplateBuilderStudio.tsx` / `/api/builder/coding-agent`)**:
   - Modelo: **`z-ai/glm-5.3` (GLM 5.3)** en OpenRouter.
   - Función: Mutación algorítmica de plantillas de landing pages, ejecución de los 4 plugins del Kernel Cordis y reestructuración de código HTML/React.
2. **AutoAds — Cerebro Maestro de Prompts y Copywriting (`AutoAdsView.tsx` / `/api/autoads/brain-train` / `/api/autoads/regenerate-ad`)**:
   - Modelo: **`openai/gpt-4o-mini`** (GPT-4o Mini) en OpenRouter (~1.6s de respuesta).
   - Función: Generación de todo el contexto, redacción de los 6 creativos publicitarios y dirección de prompts visuales/video.
3. **Generación de Imágenes de Anuncios**:
   - Modelo: **`openai/gpt-image-2.6`** (GPT Image 2.6) exclusivamente en OpenRouter.
   - Función: Sintetizar imágenes publicitarias 8K fotorrealistas en tiempo real sin *pre-holdings*.
4. **Creador de Video Reels Animados**:
   - Modelo: **`minimax/minimax-m3.1-flash`** (MiniMax M3.1 Flash) exclusivamente en OpenRouter.
   - Función: Producción y dirección de video reels comerciales.

---

## Características Principales

### 1. Tienda Pública de Alta Conversión (Storefront 100% Público)
- Galería interactiva `1:1` con las **8 fotografías reales originales** del producto y reproductor de **Video UGC 100% Real** en alta definición (`1080×1080`, 4 capítulos interactivos).
- Cuadrícula completa `1:1` de los **12 Diseños en Movimiento** y demostración óptica en vivo (proyección en fachada vs. giro 360° en mano).
- Selector de packs promocionales en Guaraníes (`Gs. 189.000`, `Gs. 358.000`, `Gs. 507.000`) y formulario de pedido Contra Entrega con soporte **Casa Independiente / Edificio**, **Mapa GPS exacto** y enrutamiento estricto al WhatsApp propio de cada producto (`waVendedor`, sin números por defecto).
- **Pop-up de Confirmación Inmediato**: Al enviar el formulario, el cliente recibe al instante su confirmación en pantalla mientras el Agente IA lo contacta automáticamente en su WhatsApp.
- **Píxel de Facebook + 12 Eventos Full-Funnel + Servidor First-Party CAPI Anti-Apple iOS (`src/utils/metaPixelEngine.ts`)**: Deduplicación por `event_id` y Advanced Matching SHA-256 (`EMQ 9.4/10`).

---

### 2. Aplicación Móvil Administrativa Android / Vercel 100% Negro Puro (`#admin`)
Diseñada desde cero como una aplicación nativa Android con estética monocromática **100% Negro Puro (`#000000` / `#0d0d0f`)**, barra de navegación inferior táctil (`Bottom Navigation Bar`), cajón deslizable (`Drawer`), cero fondos blancos, cero desbordes de texto en móvil y **Guías Interactivas Paso a Paso (`src/components/AdminSectionGuide.tsx`)** en cada uno de los **6 menús**:

1. **Módulo 1 — Páginas & Ventas (`productos`)**:
   - Filtros por nombre/slug, ID de Píxel/WhatsApp y selección múltiple con eliminado masivo en Base de Datos (`deleteProductPagesBatch`).
   - Botón principal móvil de ancho completo **`🤖 Editar con Agente IA (DeepSeek)`** y grilla táctil de acciones secundarias sin recortes de texto.
   - 4 sub-pestañas internas con banners explicativos:
     - **`🎯 Píxel & CAPI`**: Configuración directa de `pixelId` y `capiAccessToken` con botón de prueba CAPI en 1 clic.
     - **`💰 Precios & WhatsApp`**: Edición de precios `1x/2x/3x`, `waVendedor` y panel `🔔 Avisos al Vendedor` (`ProductSellerAgentPanel.tsx`).
     - **`🎙️ Cerebro IA & Voz`**: Selector de voz neuronal **Deepgram Aura-2** (`Estrella`, `Celeste`, `Sirio`, `Néstor`) inmutable por producto (`WAVOICE-*`) y ficha técnica de entrenamiento.
      - **`📦 Pedidos`**: Vista de **`✅ Confirmados (N)`** y pestaña exclusiva **`💎 Pago Adelantado (N)`** (`ProductConfirmedOrdersPanel.tsx`) con brillo característico Ámbar/Dorado para `⚡ PAGO ENVIADO (VERIFICAR)`, visor de comprobante bancario (`Banco Familiar` · Alias `3856033` · Titular `Richard Almirón`), **Interruptor de Confirmación de Pago Adelantado**, comparativa Web vs. Chat IA, barra de **Función Logística Universal** (`No Enviado`, `Enviado`, `Concretado / Cobrado`), edición manual post-llamada y consola de **Chat de WhatsApp en Vivo** 100% en modo oscuro.
2. **Módulo 2 — Autopilot Studio IA (`creador` — `ProductTemplateBuilderStudio.tsx`)**:
   - Motor **100% Autopiloto de 1 Clic** impulsado por el **Kernel Oficial `deepseek-ai/deepseek-harness` (`src/utils/deepseekHarnessKernel.ts`)** y **`z-ai/glm-5.3`**.
   - 4 plugins activos (`theme-architect`, `cod-pricing-engine`, `physical-truth-shield`, `whatsapp-brain-trainer`), 5 comandos slash (`/autopilot`, `/luxury`, `/flash`, `/pack2-gift`, `/audit`), 33 plantillas diferenciadas y botón `Undo` reversible.
3. **Módulo 3 — AutoAds 360: Cerebro Maestro IA + Meta Ads Directo (`autoads` — `AutoAdsView.tsx`)**:
   - Plataforma de publicidad impulsada por **`z-ai/glm-5.3`** (con respaldo a **`openai/gpt-4o-mini`**) que aplica la **Regla de los 0.0 Segundos** (palabras 1 a 4 = Objeto + Dolor/Solución/Placer/Oferta) y genera **6 creativos de alta conversión** (Feed 1:1, Story 9:16 y Video Reels 9:16) en español paraguayo con tiempos reales de entrega COD (`2 a 3 días hábiles`).
   - Generación visual con **`openai/gpt-image-2.6-flare`** / **`openai/gpt-image-2.6-sunburst`** en **Modo Seguro Turno por Turno (`1 a la vez` con pausa de liquidación de 3.5s y backoff anti-`HTTP 402 in-flight requests`)**, más caché persistente dual (`localStorage` Base64 + `store_config.json`) para que las imágenes jamás desaparezcan.
   - **Estructura Oficial Meta Ads Bloqueada por ID + Nombres Reales Dinámicos en Vivo**:
     - **Portafolio Comercial**: `Landingcod`
     - **Cuenta Publicitaria Oficial (`834`)**: `act_1048211497774834` (`1048211497774834`) — su nombre real actual se descubre y actualiza dinámicamente en vivo desde Meta Graph API.
     - **Píxel Oficial de Cuenta 834 (`377`)**: `1276031534651377` — su nombre real actual se descubre y actualiza dinámicamente en vivo desde Meta Graph API.
     - **Página Oficial de Facebook**: `Landingcod Shop` (`1050835598123904`).
     - **Bloqueo Total y Auto-Pausa**: La cuenta personal `Richard Almiron` (`act_424711183775699`) está 100% excluida y cualquier campaña accidental en ella se pausa automáticamente.
   - Documentación completa: [`GUIA_CONFIGURACION_META_ADS.md`](./GUIA_CONFIGURACION_META_ADS.md).
4. **Módulo 4 — Conexiones WhatsApp QR (`whatsapp`)**:
   - Centro multi-línea ilimitado por Código QR o Código de 8 dígitos con respaldo GZIP automático en Supabase (`WAAUTH-*`) resistente a redespliegues en Railway.
5. **Módulo 5 — Voz Neuronal Deepgram Aura-2 (`deepgram`)**:
   - Síntesis de notas de voz nativas OGG/Opus PTT (`Aura-2`) y transcripción ultrarrápida de audios entrantes en español (`Nova-3` + `Nova-2`), con **Corrección Interactiva de Mapa Satelital (`/?corregir-mapa=NX-XXXXXX`)** y **Negociación VIP de Pago Adelantado (-Gs. 50.000) con Comprensión Contextual de Oración Completa por LLM**.
6. **Módulo 6 — Motor Multi-Modelo OpenRouter (`openrouter`)**:
   - `z-ai/glm-5.3` para desarrollo web y Cerebro Maestro + `openai/gpt-4o-mini` para respaldo de copywriting + `openai/gpt-image-2.6-flare` / `sunburst` para imágenes + `bytedance/seedance-2.5` para video reels, con detección automática de la API Key en Railway (`OPENROUTER_API_KEY` / `OPENROUTESERVICE_API_KEY`).

---

## Documentación Técnica Actualizada del Proyecto

- 📜 **[`CONTEXTO_DE_CHAT.md`](./CONTEXTO_DE_CHAT.md)**: Bitácora cronológica completa, píxel por píxel, de todas las solicitudes y fases del chat (**Fases 1 a 60**), mapa de archivos, auditorías en vivo y reglas invariantes para agentes de codificación.
- 🏗️ **[`ARQUITECTURA_CONSTRUCTOR_PLANTILLAS_IA_META_DEEPSEEK.md`](./ARQUITECTURA_CONSTRUCTOR_PLANTILLAS_IA_META_DEEPSEEK.md)**: Especificación algorítmica del Kernel Oficial `deepseek-ai/deepseek-harness` (Cordis), Estudio Autopiloto 1-Clic, Cola Turno por Turno Anti-`HTTP 402 in-flight`, Caché Persistente Dual de Creativos, Meta OAuth 1-Clic con Descubrimiento Dinámico de Nombres (`834` / `377`) y Publicación Directa en Meta Graph API v21.0.
- 🎙️ **[`ARQUITECTURA_WHATSAPP_IA_VOZ.md`](./ARQUITECTURA_WHATSAPP_IA_VOZ.md)**: Documentación técnica del motor WhatsApp de 5 pasos, blindaje anti-repetición, corrección interactiva de mapa satelital (`/?corregir-mapa=NX-XXXXXX`), negociación VIP de pago adelantado con comprensión de oración completa por LLM, voz Deepgram Aura-2 OGG/Opus y STT Deepgram Nova-3.
- 📲 **[`ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md`](./ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md)**: Especificación de Reportes Ejecutivos Directos al WhatsApp del Vendedor, Panel de Confirmados, Comprobantes e Interruptor de Verificación con Pestaña Exclusiva `💎 Pago Adelantado`, Logística Universal y tombstones `DEL-ORD-*` en Supabase.
- 🎯 **[`GUIA_CONFIGURACION_META_ADS.md`](./GUIA_CONFIGURACION_META_ADS.md)**: Guía paso a paso completa para configurar Meta Ads, estructura oficial bloqueada (`Landingcod`, Cuenta `834`, Píxel `377`, Página `Landingcod Shop`), descubrimiento dinámico de nombres en vivo y auto-restauración de sesión OAuth en Railway.

