# Documentación Oficial de Algoritmos: Carta de Venta Visual E-Commerce de 4 Imágenes (`GPT-2.6`), Investigación Profunda Anti Copia-Pega, Recreación de Estudio 3/4, Tarjetas Enterizas VIP y Revelación Progresiva de Conversión

Este documento técnico describe en detalle los **5 nuevos algoritmos de ingeniería y conversión** implementados en el ecosistema de **Creador Rápido (`creador_rapido`)**, **Páginas & Ventas (`AdminView.tsx`)** y **Landing Visual Full-Bleed (`VisualProductLanding.tsx` + `server/visualLandingGenerator.ts`)**.

---

## Índice de Algoritmos Documentados

1. **Algoritmo 1 — Clasificación Tripartita de Páginas (`Legacy` vs `Quick Standard` vs `Quick Tripwire`) y Tarjetas Enterizas VIP en 1 Sola Pieza (`50% Menos Altura`)**
2. **Algoritmo 2 — Investigación Profunda Anti Copia-Pega (`scrapeEntryProductUrlInfo` + `researchProductDeeplyWithAI`) y Recreación Fotográfica de Estudio 3/4 (`recreateExactProductStudioImage`)**
3. **Algoritmo 3 — Carta de Venta Visual E-Commerce en 4 Imágenes de Altísimo Impacto (`sober_graphic_4sheet`: Imagen 1 Tripwire Envolvente 360° + Imágenes 2, 3 y 4 Exclusivas del Producto Principal)**
4. **Algoritmo 4 — Blindaje Ortográfico en Español para Imágenes IA (`sanitizeAndEnforceSalesLetterImagePrompt`) + Normalización Monetaria (`Gs.`) y Fallback Automático de Proporción (`2:3 -> 3:4`)**
5. **Algoritmo 5 — Embudo Visual Intercalado Cero-HTML, Botones VIP de Conversión y Revelación Tardía al Fondo para el Botón #2 (`evaluateBottomReveal`)**

---

## 1. Algoritmo 1 — Clasificación Tripartita de Páginas y Tarjetas Enterizas VIP en 1 Sola Pieza

### 1.1. Archivos Fuente
- `src/utils/productPageClassifier.ts`
- `src/views/AdminView.tsx`
- `src/components/QuickProductCreatorView.tsx`
- `server/__tests__/entryEventAndRouting.test.ts`

### 1.2. Lógica de Clasificación (`classifyProductPageType`)
Toda página de producto (`ProductConfig`) es evaluada de manera determinista en tres categorías mutuamente excluyentes:

```ts
export type ProductPageCategory = 'legacy' | 'quick_standard' | 'quick_tripwire';
```

1. **`quick_tripwire` (`CREADOR RÁPIDO · TRIPWIRE`)**:
   - Condición: `hasVisualLanding && hasTripwire` (`visualLanding.sheets.length >= 2` y `tripwireConfig.enabled === true` con `entryTitle` válido, o `pageCreationMode === 'dual_tripwire_winner'`).
   - Representa una página de doble oferta creada en Creador Rápido (Paso 1: Oferta de Entrada / Gancho + Paso 2: Oferta Principal / Estrella).
2. **`quick_standard` (`CREADOR RÁPIDO · ESTÁNDAR`)**:
   - Condición: `hasVisualLanding && !hasTripwire` (`visualLanding.sheets.length >= 2` sin `tripwireConfig` activo o `pageCreationMode === 'principal_only'`).
   - Representa una página visual de 1 sola oferta enfocada 100% en el Producto Principal.
3. **`legacy` (`PÁGINA ANTIGUA`)**:
   - Condición: `!hasVisualLanding` (por ejemplo, la página HTML clásica original de `prod-noelux-01`).

### 1.3. Filtros y Contadores en Tiempo Real
- `matchesProductPageCategoryFilter(product, filter)` soporta 5 modos de filtrado instantáneo:
  - `'all'` (*Todas*)
  - `'legacy'` (*Páginas Antiguas*)
  - `'quick_all'` (*Todas las del Creador Rápido: Estándar + Tripwire*)
  - `'quick_standard'` (*Creador Rápido · Estándar*)
  - `'quick_tripwire'` (*CREADOR RÁPIDO · TRIPWIRE*)
- `countProductPageCategories(products)` calcula en $O(N)$ los totales exactos de cada categoría para renderizar las píldoras de filtro con contadores en vivo tanto en **Páginas & Ventas (`AdminView.tsx`)** como en el **Selector de Oferta Principal / Clonaje del Creador Rápido (`QuickProductCreatorView.tsx`)**.

### 1.4. Diseño de Tarjeta Enteriza VIP (1 Sola Pieza · 50% Menos Altura · Cero "2 Tarjetas en 1")
Para evitar tarjetas altas, opacas o partidas en sub-bloques anidados, tanto `AdminView.tsx` como `QuickProductCreatorView.tsx` implementan una **arquitectura de barra horizontal enteriza de una sola pieza (`px-3 py-2`)**:
- **Cero cajas internas anidadas**: No existen rectángulos internos que dividan la tarjeta en dos tarjetas.
- **Diferenciación absoluta por identidad visual y tipografía**:
  - **`CREADOR RÁPIDO · TRIPWIRE`**: Barra enteriza con acento lateral esmeralda/cian (`bg-gradient-to-r from-[#06283d] via-[#072227] to-[#052e2b]`), insignia `TRIPWIRE`, y flujo continuo inline en la misma fila: miniatura `34x34` + `1. GANCHO: [Nombre] Gs. [Precio]` + flecha `→` + miniatura `34x34` + `2. ESTRELLA: [Nombre] Gs. [Precio]`.
  - **`CREADOR RÁPIDO · ESTÁNDAR`**: Barra enteriza azul zafiro real (`bg-gradient-to-r from-[#0c1e3e] via-[#0f172a] to-[#0a1122]`), insignia `ESTÁNDAR`, miniatura `34x34` + título + `OFERTA ÚNICA` + precio en Guaraníes.
  - **`PÁGINA ANTIGUA`**: Barra enteriza sobria en carbón/ámbar (`bg-[#121318]`), insignia `ANTIGUA`, miniatura `34x34` + título + precio en Guaraníes.

---

## 2. Algoritmo 2 — Investigación Profunda Anti Copia-Pega y Recreación Fotográfica de Estudio 3/4

### 2.1. Archivos Fuente
- `server/visualLandingGenerator.ts`
- `vite.config.ts` (`POST /api/products/quick-create-entry-from-url`, `POST /api/products/quick-create-analyze`, `POST /api/products/quick-create-visual`)

### 2.2. Extracción Multi-Fuente desde URL (`scrapeEntryProductUrlInfo`)
Cuando el operador pega una URL de un proveedor, tienda competidora o imagen directa:
1. Detecta si la URL apunta directamente a un archivo de imagen (`.jpg`, `.png`, `.webp`, `.avif`) o a una página HTML.
2. Descarga y parsea metadatos OpenGraph (`og:title`, `og:description`, `og:image`, `product:price:amount`), bloques `application/ld+json` (`Schema.org Product`), etiquetas `<title>`, `<h1>`, y extrae el cuerpo de texto limpio (`bodySnippet`) y galería de imágenes candidatas (`discoveredImages`).
3. Convierte o normaliza precios detectados al rango paraguayo en Guaraníes (`Gs.`).

### 2.3. Investigación Profunda Anti Copia-Pega (`researchProductDeeplyWithAI`)
Nunca se copia y pega literalmente el texto crudo de la página proveedora ni la descripción básica escrita por el usuario:
1. Envía a **`openai/gpt-4o`** (vía OpenRouter) el título, las notas crudas, el HTML extraído de la URL y hasta **2 imágenes reales del producto** (visión multimodal).
2. Sintetiza un expediente de ingeniería persuasiva (`ProductDeepResearchResult`):
   - `cleanCommercialTitle`: Nombre comercial limpio y magnético.
   - `visualAnatomyForPrompt`: Descripción física forense en inglés de materiales, texturas, proporciones, botones, haces de luz y acabados reales para que el generador de imágenes mantenga fidelidad al producto.
   - `emotionalTransformation`: Qué transformación real vive el comprador en su hogar/vida al usar el producto.
   - `hiddenFrustrationsSolved`: Qué dolores o frustraciones cotidianas elimina.
   - `paraguayMarketFit`: Por qué este producto encaja en los hogares y clima de Paraguay.
   - `concreteUseCases`: 4 escenarios de uso reales y tangibles.
   - `technicalHighlights`: 4 especificaciones concretas de autoridad sin relleno genérico.
   - `salesLetterHooks`: 3 titulares de carta de venta de respuesta directa (máximo 4 a 6 palabras en español).
   - `persuasiveNarrativeSummary`: Resumen persuasivo listo para alimentar la Carta de Venta Visual.

### 2.4. Recreación Fotográfica de Estudio en Formato Vertical `3:4` (`recreateExactProductStudioImage`)
Para asegurar que la miniatura y foto base del producto (tanto el Tripwire como el Producto Principal) luzcan como fotografía comercial de gran marca internacional:
1. Toma la imagen original subida o extraída por URL y la descripción física `visualAnatomyForPrompt`.
2. Invoca **`openai/gpt-image-2.6-sunburst`** pasando la foto real del producto como referencia multimodal y un prompt de estudio comercial (`3:4`, iluminación *rim light* + *key light*, superficie de lujo coherente con la categoría, **cero texto o marcas de agua**).
3. Sube el resultado a **Cloudinary** (`uploadImageToCloudinary`) con respaldo en `public/assets/visual-pages/` y devuelve la URL pública optimizada.

---

## 3. Algoritmo 3 — Carta de Venta Visual E-Commerce en 4 Imágenes de Altísimo Impacto (`sober_graphic_4sheet`)

### 3.1. Archivos Fuente
- `server/visualLandingGenerator.ts` (`analyzeQuickCreatorStrategy`, `generateUniversalVisualProductPage`)
- `src/types.ts` (`VisualProductLandingConfig.layoutStyle = 'sober_graphic_4sheet'`)

### 3.2. Arquitectura de las 4 Imágenes por Página (`dual_tripwire_winner`)
Cada página creada en modo Dual genera **exactamente 4 láminas verticales `3:4` (`1080×1440`)** mediante **`openai/gpt-image-2.6-sunburst`**, con una separación cromática y psicológica radical entre la Oferta de Entrada (Imagen 1) y la Carta de Venta de 3 Secciones del Producto Principal (Imágenes 2, 3 y 4):

| N° de Imagen | `sectionRole` | Producto Protagonista | Dirección de Arte y Psicología de Conversión |
| :--- | :--- | :--- | :--- |
| **Imagen 1** | `'entry_offer'` | **Exclusivamente el Producto Tripwire (Oferta de Entrada)** | **Diseño Envolvente 360° de Altísimo Impacto (`Wrap-Around Immersive Studio`)**: Iluminación volumétrica envolvente, partículas atmosféricas reales, profundidad de campo cinematográfica y paleta **Azul Zafiro Eléctrico + Cian Luminoso + Ámbar Dorado (`#040D1A`, `#0284C7`, `#38BDF8`, `#F59E0B`)**. En el tercio inferior incorpora la llamada a la acción integrada en la imagen apuntando hacia el Botón #1 (`"TOCÁ EL BOTÓN DE ABAJO"`). |
| **Imagen 2** | `'principal_section_1_hook'` | **Producto Principal — Sección 1 de 3: Ruptura Dramática y Revelación Heroica** | Cambio cromático total hacia **Negro Obsidiana + Rojo Carmesí Imperial + Oro Real (`#050507`, `#E11D48`, `#F59E0B`, `#10B981`)**. Arriba tiene impresa la entrada brusca **`"¡ESPERÁ UN SEGUNDO!"`** (con tilde obligatoria en la Á) y presenta al Producto Principal como la solución definitiva de gama superior. |
| **Imagen 3** | `'principal_section_2_proof'` | **Producto Principal — Sección 2 de 3: Demostración de Poder y Anatomía E-Commerce** | Muestra el Producto Principal en pleno funcionamiento transformando el ambiente real, acompañado de **3 acercamientos macro / callouts visuales limpios** de sus materiales, potencia y calidad constructiva. |
| **Imagen 4** | `'principal_section_3_offer'` | **Producto Principal — Sección 3 de 3: Cierre de Carta de Venta + Regalo Gratis + Envío Gratis** | Composición épica de cierre: muestra el **Producto Principal** en el centro + el **Artículo Gancho incluido con sello `"GRATIS DE REGALO"`** + insignia gigante **`"ENVÍO GRATUITO EN TODO PARAGUAY"`** + precio promocional y flecha apuntando al Botón #2 inferior. |

> **Nota para modo `principal_only` (Página Estándar sin Tripwire):** También genera **4 imágenes de altísimo impacto** dedicadas 100% al Producto Principal: (1) Héroe Envolvente 360°, (2) Transformación Antes vs. Después, (3) Anatomía Macro y Especificaciones Visuales, y (4) Cierre de Oferta con Envío Gratuito + Pago al Recibir.

---

## 4. Algoritmo 4 — Blindaje Ortográfico en Español para Imágenes IA (`sanitizeAndEnforceSalesLetterImagePrompt`)

### 4.1. Problema Resuelto
Los modelos difusores de imagen suelen cometer errores de ortografía o fusionar sílabas cuando intentan renderizar oraciones largas o párrafos en español dentro de los píxeles de un póster, o cuando reciben precios con prefijos duplicados (`Gs. Gs. 189.000`).

### 4.2. Reglas del Sanitizador (`sanitizeAndEnforceSalesLetterImagePrompt` en `server/visualLandingGenerator.ts`)
Antes de enviar cualquier prompt a `openai/gpt-image-2.6-sunburst`, el algoritmo aplica:
1. **Deduplicación Monetaria**: Corrige cualquier aparición de `Gs. Gs.` o `Gs Gs` a un único `Gs.`.
2. **Corrección Léxica Forzada**: Fuerza tildes y ortografía exacta en palabras críticas (`"¡ESPERÁ UN SEGUNDO!"`, `"ENVÍO GRATUITO"`, `"GRATIS DE REGALO"`, `"EDICIÓN PREMIUM"`, `"PAGO AL RECIBIR"`).
3. **Directiva `STRICT SPANISH ORTHOGRAPHY & ZERO-TYPO RULE`**:
   - Prohíbe terminantemente renderizar párrafos largos, oraciones de más de 4 palabras o letras pequeñas dentro de la imagen.
   - Limita el texto impreso en la lámina a **2 o 3 insignias cortas en MAYÚSCULAS GEOMÉTRICAS Bold Sans-Serif** de **2 a 4 palabras máximo cada una**, deletreadas carácter por carácter entre comillas dentro del prompt.
   - Toda la persuasión adicional viaja a través de la demostración visual hiperrealista, el contraste de color y la composición fotográfica.
4. **Fallback Automático de Aspect Ratio (`2:3 -> 3:4`)**:
   - Si el proveedor de imagen rechaza una relación de aspecto con HTTP `400`, `generateSingleSheetImage` reintenta automáticamente en formato vertical estándar `3:4` antes de recurrir al póster SVG de emergencia.

---

## 5. Algoritmo 5 — Embudo Visual Intercalado Cero-HTML, Botones VIP y Revelación Tardía al Fondo (`evaluateBottomReveal`)

### 5.1. Archivos Fuente
- `src/components/VisualProductLanding.tsx`
- `src/components/OrderForm.tsx`

### 5.2. Secuencia Estricta en Pantalla (`VisualProductLanding.tsx`)
En las páginas visuales creadas con Creador Rápido, **no existe barra de navegación distractiva, ni bloques de texto HTML entre imágenes, ni descripciones debajo de los botones**:

1. **Imagen 1 (Tripwire Envolvente 360°)** a pantalla completa (`100%` ancho).
2. **Botón #1 VIP (`#0284C7` → `#2563EB`)**:
   - Ubicado inmediatamente debajo de la Imagen 1.
   - Un solo botón limpio de alta gama (`Quiero reservar este artículo por Gs. [Precio]`), **cero subtítulos, cero párrafos y cero descripciones alrededor**.
   - Al tocarlo, despliega el formulario de pedido justo ahí mismo preconfigurado en ruta `entry_only`.
3. **Imágenes 2, 3 y 4 (Las 3 Secciones E-Commerce del Producto Principal)** apiladas de borde a borde (`space-y-0`):
   - La **Imagen 2** abre inmediatamente debajo del Botón #1 con la ruptura visual **`"¡ESPERÁ UN SEGUNDO!"`**.
   - Le siguen sin interrupción la **Imagen 3** (Demostración y Anatomía) y la **Imagen 4** (Cierre + Regalo Gratis + Envío Gratuito).
4. **Botón #2 VIP (`#E11D48` → `#F59E0B`) con Revelación Tardía al Fondo (`evaluateBottomReveal`)**:
   - **Prohibido pre-holdear o fijar (`sticky`) el segundo botón mientras el visitante está arriba.**
   - El componente observa con `IntersectionObserver` + listener de `scroll` el centinela `bottomSentinelRef` ubicado al pie de la **4ª imagen**.
   - Recién cuando el usuario bajó hasta el final de la Carta de Venta Visual (`rect.top <= window.innerHeight + 80`), `isBottomCtaRevealed` pasa a `true` y el **Botón #2 VIP** emerge con una transición suave (`opacity-100 translate-y-0 scale-100`).
5. **Formulario de Pedido Completo Abierto al Pie (`OrderForm.tsx`)**:
   - Conserva el 100% de sus validaciones paraguayas, selector de packs `1x / 2x / 3x`, Casa/Edificio y Mapa GPS interactivo.
