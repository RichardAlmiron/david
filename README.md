# Noelux™ — Plataforma E-Commerce COD (Pago Contra Entrega) + Cerebro Psicológico AutoAds v2 + Kernel Autopiloto + Motor Multi-WhatsApp y Voz Neuronal Deepgram Aura-2

Aplicación full-stack desarrollada en **React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Baileys Multi-Device + Deepgram Aura-2 (TTS OGG/Opus Nativo) + Deepgram Nova-3 (STT) + OpenRouter (`openai/gpt-4o`, `openai/gpt-image-2.6-sunburst`, `google/gemini-omni-1.2-flash` y `z-ai/glm-5.3-flash`)** con persistencia dual en tiempo real sobre **Supabase** y disco local e interfaz administrativa **100% Negro Puro estilo App Móvil Android / Vercel**.

---

## 🤖 Distribución Real de Modelos de IA en OpenRouter

1. **Desarrollo Web & Kernel Autopiloto de Páginas (`ProductTemplateBuilderStudio.tsx` / `/api/builder/coding-agent`)**:
   - Modelo: **`z-ai/glm-5.3-flash`** en OpenRouter.
   - Función: Mutación algorítmica de plantillas de landing pages, ejecución de los 4 plugins del Kernel Cordis y reestructuración de código HTML/React.
2. **AutoAds — Cerebro Psicológico v2, Estrategia e Investigación (`server/autoAdsIntelligence.ts` / `/api/autoads/brain-train` / `/api/autoads/regenerate-ad`)**:
   - Modelo: **`openai/gpt-4o`** vía OpenRouter.
   - Función: Investigación de mercado y competencia en 3 niveles honestos, construcción de perfil psicológico e **hipótesis dinámicas (`AutoAdsHypothesisV2`)**, memoria histórica de formularios y generación de copy y prompts creativos.
3. **Generación de Imágenes de Anuncios (`/api/autoads/generate-ad-images`)**:
   - Modelo: **`openai/gpt-image-2.6-sunburst`** en OpenRouter (soportando `1:1` y `9:16`).
   - Función: Síntesis visual fotorrealista alimentada por los `aiImagePrompt` específicos de cada hipótesis.
4. **Creador de Video Reels Animados**:
   - Modelo: **`google/gemini-omni-1.2-flash`** en OpenRouter (alimentado con `videoScriptPrompt` de cada hipótesis).
   - Función: Producción y dirección de video reels comerciales (`9:16`).

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
      - **`📦 Pedidos`**: Vista desplegada automáticamente al abrir el panel con pestaña **`✅ Confirmados (N)`** (`ProductConfirmedOrdersPanel.tsx`), comparativa Web vs. Chat IA, barra de **Función Logística Universal** (`No Enviado`, `Enviado`, `Concretado / Cobrado`), edición manual post-llamada, sincronización en paralelo sobre Supabase y consola de **Chat de WhatsApp en Vivo** 100% en modo oscuro.
2. **Módulo 2 — Autopilot Studio IA (`creador` — `ProductTemplateBuilderStudio.tsx`)**:
   - Motor **100% Autopiloto de 1 Clic** impulsado por el **Kernel Oficial `deepseek-ai/deepseek-harness` (`src/utils/deepseekHarnessKernel.ts`)** y **`z-ai/glm-5.3`**.
   - 4 plugins activos (`theme-architect`, `cod-pricing-engine`, `physical-truth-shield`, `whatsapp-brain-trainer`), 5 comandos slash (`/autopilot`, `/luxury`, `/flash`, `/pack2-gift`, `/audit`), 33 plantillas diferenciadas y botón `Undo` reversible.
3. **Módulo 3 — AutoAds 360: Cerebro Psicológico v2 + Meta Ads Directo & Pipeboard (`autoads` — `AutoAdsView.tsx`)**:
   - Conserva **intacta la interfaz operativa de 3 pasos** (`1. INVESTIGAR -> 2. GENERAR TODOS LOS CREATIVOS -> 3. PUBLICAR EN META ADS`), ejecutando toda la nueva inteligencia desde backend (`Circuito A`).
   - El cerebro psicológico y de hipótesis (`openai/gpt-4o`) investiga competencia en 3 niveles honestos, diseña 6 hipótesis psicológicas distintas (`policyGuardOnly` protege los hooks sin truncarlos) y alimenta a **`openai/gpt-image-2.6-sunburst`** (imágenes) y **`google/gemini-omni-1.2-flash`** (vídeos) en modo seguro turno por turno.
   - **Optimización y Señal Canónica Única (`Lead`) Independiente del Courier**: Las campañas optimizan `OUTCOME_LEADS` / `LEAD` únicamente al completarse y guardarse el formulario (`POST /api/pedidos`), contando una vez por pedido (`OrderReservedCOD` opcional como telemetría secundaria sin duplicar). El learning rate, CVR, CPF y madurez estadística nunca dependen de entregas, cobros ni liquidaciones courier (`Circuito B` separado para ERP y `Purchase` backend-only).
   - Documentación central del cerebro: [`CEREBRO_AUTOADS.md`](./CEREBRO_AUTOADS.md) y guía operativa [`GUIA_CONFIGURACION_META_ADS.md`](./GUIA_CONFIGURACION_META_ADS.md).
4. **Módulo 4 — Conexiones WhatsApp QR (`whatsapp`)**:
   - Centro multi-línea ilimitado por Código QR o Código de 8 dígitos con respaldo GZIP automático en Supabase (`WAAUTH-*`) resistente a redespliegues en Railway.
5. **Módulo 5 — Confirmación Express 1 Paso (`"CORRECTO"`), Compuerta Audio-Primero (`1s`) + Voz Neuronal 99–100% Audio Deepgram Aura-2 (`deepgram`)**:
   - **Compuerta Estricta Audio-Primero (`1000ms` después del Audio)**: Aunque la imagen ya esté 100% generada en memoria, el sistema bloquea su salida hasta que el agente haya enviado primero la nota de voz; **exactamente 1 segundo (`1000ms`) después del audio**, se autoriza y envía la imagen en tiempo real.
   - **Etapa 1 — Bienvenida**: Envía **primero la Nota de Voz `Deepgram Aura-2`** (pronunciando montos en **`"guaraníes"`** y teléfono en ritmo `4-3-3`) pidiendo responder únicamente **`"CORRECTO"`**, y **1 segundo después** envía la **Imagen #1 Personalizada `1080×1080` (`stage1_welcome`)** con los datos del comprador.
   - **Etapa Final — Al Confirmar con `"CORRECTO"`**: Sella el pedido como confirmado y en empaquetado (`convStep = 5`), envía el Reporte Ejecutivo al WhatsApp del vendedor, responde al comprador **primero con el Audio de Confirmación**, y **1 segundo después** le envía por última etapa la **Imagen Impactante de Pedido Confirmado `1080×1080` (`stage3_confirmed`)** a su nombre con **`"¡FELICIDADES!"`** y el aviso de que en **48 a 72 horas** la transportadora / los agentes del courier entrarán en contacto y le estarán llamando para entregarle el producto.
6. **Módulo 6 — Motor Multi-Modelo OpenRouter (`openrouter`)**:
   - `z-ai/glm-5.3-flash` para desarrollo web Autopilot, `openai/gpt-4o` para cerebro psicológico e hipótesis AutoAds, `openai/gpt-image-2.6-sunburst` para imágenes y `google/gemini-omni-1.2-flash` para video reels.

---

## Documentación Técnica Actualizada del Proyecto

- 🧠 **[`CEREBRO_AUTOADS.md`](./CEREBRO_AUTOADS.md)**: Documentación central del Cerebro AutoAds v2 (investigación y competencia 3 niveles, perfil psicológico e hipótesis dinámicas, alimentación a motores existentes, señal canónica única `Lead`, atribución 30d, aislamiento estricto Circuito A vs Circuito B, preflight Meta/Pipeboard y circuito ERP/Purchase independiente).
- 📜 **[`CONTEXTO_DE_CHAT.md`](./CONTEXTO_DE_CHAT.md)**: Bitácora cronológica completa (**Fases 1 a 79**) con decisiones técnicas y auditorías acumuladas.
- 🏗️ **[`ARQUITECTURA_CONSTRUCTOR_PLANTILLAS_IA_META_DEEPSEEK.md`](./ARQUITECTURA_CONSTRUCTOR_PLANTILLAS_IA_META_DEEPSEEK.md)**: Especificación algorítmica del Kernel Cordis (`src/utils/deepseekHarnessKernel.ts`), Estudio Autopiloto 1-Clic, Cola Anti-`HTTP 402`, CAPI `Lead` + `Purchase` independiente y Publicación Meta Direct / Pipeboard.
- 🎙️ **[`ARQUITECTURA_WHATSAPP_IA_VOZ.md`](./ARQUITECTURA_WHATSAPP_IA_VOZ.md)**: Manual del Motor de Confirmación Express (`"CORRECTO"`), Compuerta Audio-Primero (`1s`), Deepgram Aura-2 + Nova-3, Muro de Hierro y tokens de atribución WA.
- 📲 **[`ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md`](./ARQUITECTURA_REPORTES_VENDEDOR_Y_SINCRONIZACION_BD.md)**: Especificación de Reportes Ejecutivos al Vendedor, Sincronización en Supabase, persistencia conjunta `pedidos` + `order_attribution` y ejes logísticos del Circuito B.
- 🗄️ **[`database/autoads_v2_additive_migration.sql`](./database/autoads_v2_additive_migration.sql)** y **[`database/noelux_admin_schema.sql`](./database/noelux_admin_schema.sql)**: Esquemas SQL oficiales (la migración aditiva v2 debe ejecutarse manualmente en Supabase SQL Editor).
- 🎯 **[`GUIA_CONFIGURACION_META_ADS.md`](./GUIA_CONFIGURACION_META_ADS.md)**: Guía operativa de Meta Ads, OAuth en 1 clic, preflight `OUTCOME_LEADS` / moneda real PYG vs USD y despliegue en Railway.



