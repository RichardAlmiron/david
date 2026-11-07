# Noelux™ — Plataforma E-Commerce COD (Pago Contra Entrega) + Kernel Autopiloto `deepseek-harness` + Motor Multi-WhatsApp, Voz Deepgram Aura-2, Meta Ads Pipeboard y Cerebro Exclusivo `GLM-5.3` (OpenRouter)

Aplicación full-stack desarrollada en **React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Baileys Multi-Device + Deepgram Aura-2 (TTS OGG/Opus Nativo) + Deepgram Nova-3 (STT) + Kernel Oficial `deepseek-ai/deepseek-harness` (Cordis) & OpenRouter `z-ai/glm-5.3` (GLM-5.3 Exclusivo)** con sincronización universal en tiempo real sobre **Supabase** e interfaz administrativa **100% Negro Puro estilo App Móvil Android / Vercel**.

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
     - **`📦 Pedidos`**: Vista de **`✅ Confirmados (N)`** (`ProductConfirmedOrdersPanel.tsx`) con comparativa Web vs. Chat IA, barra de **Función Logística Universal** (`No Enviado`, `Enviado`, `Concretado / Cobrado`), edición manual post-llamada y consola de **Chat de WhatsApp en Vivo** 100% en modo oscuro.
2. **Módulo 2 — Autopilot Studio IA (`creador` — `ProductTemplateBuilderStudio.tsx`)**:
   - Motor **100% Autopiloto de 1 Clic** impulsado por el **Kernel Oficial `deepseek-ai/deepseek-harness` (`src/utils/deepseekHarnessKernel.ts`)** y **`z-ai/glm-5.3`**.
   - 4 plugins activos (`theme-architect`, `cod-pricing-engine`, `physical-truth-shield`, `whatsapp-brain-trainer`), 5 comandos slash (`/autopilot`, `/luxury`, `/flash`, `/pack2-gift`, `/audit`), 33 plantillas diferenciadas y botón `Undo` reversible.
3. **Módulo 3 — Creador de Anuncios en Piloto Automático (`pipeboard` — `PipeboardAdsManagerView.tsx`)**:
   - Interfaz 100% Negro Puro con guía paso a paso integrada, 4 fórmulas psicológicas (`/flash-sale`, `/anti-scam`, `/duo-pack`, `/viral-demo`), generación en 1 clic de **3 imágenes (`1:1 Feed #1`, `1:1 Feed #2`, `9:16 Story`) + 1 Video Comercial Animado (`9:16`)** con **`GLM-5.3`** y publicación automática en Meta Ads vía `pipeboard-co/meta-ads-mcp`.
4. **Módulo 4 — Conexiones WhatsApp QR (`whatsapp`)**:
   - Centro multi-línea ilimitado por Código QR o Código de 8 dígitos con respaldo GZIP automático en Supabase (`WAAUTH-*`) resistente a redespliegues en Railway.
5. **Módulo 5 — Voz Neuronal Deepgram Aura-2 (`deepgram`)**:
   - Síntesis de notas de voz nativas OGG/Opus PTT (`Aura-2`) y transcripción ultrarrápida de audios entrantes en español (`Nova-3` + `Nova-2`).
6. **Módulo 6 — Motor Exclusivo GLM-5.3 OpenRouter (`openrouter`)**:
   - Bloqueado exclusivamente al modelo **`z-ai/glm-5.3` (GLM-5.3)** con detección automática de la variable de entorno ya configurada en Railway (`OPENROUTER_API_KEY` / `OPENROUTESERVICE_API_KEY`).

---

## Documentación Técnica Actualizada del Proyecto

- 📜 **[`CONTEXTO_DE_CHAT.md`](./CONTEXTO_DE_CHAT.md)**: Bitácora cronológica completa de todas las solicitudes y fases del chat (Fases 1 a 40), mapa de archivos y reglas invariantes.
- 🏗️ **[`ARQUITECTURA_CONSTRUCTOR_PLANTILLAS_IA_META_DEEPSEEK.md`](./ARQUITECTURA_CONSTRUCTOR_PLANTILLAS_IA_META_DEEPSEEK.md)**: Especificación algorítmica del Kernel Oficial `deepseek-ai/deepseek-harness` (Cordis), Estudio Autopiloto 1-Clic, modelo exclusivo `GLM-5.3`, Meta CAPI, Pipeboard Ads Autopilot e interfaz móvil Android 100% negro puro.
- 🎙️ **[`ARQUITECTURA_WHATSAPP_IA_VOZ.md`](./ARQUITECTURA_WHATSAPP_IA_VOZ.md)**: Documentación técnica del motor WhatsApp de 5 pasos, voz Deepgram Aura-2 OGG/Opus, STT Deepgram Nova-3, pronunciación telefónica `4-3-3`, cerebro `GLM-5.3` y aislamiento de Railway.
- 📲 **[`ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md`](./ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md)**: Especificación de Reportes Ejecutivos Directos al WhatsApp del Vendedor, Panel de Confirmados, Logística Universal y tombstones `DEL-ORD-*` en Supabase.
