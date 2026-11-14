import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  Upload
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';
import type { ProductPage } from '../types';

interface QuickProductCreatorViewProps {
  defaultWaNumber: string;
  showToast: (msg: string) => void;
  onProductCreated: (product: ProductPage, openStorePreview?: boolean) => Promise<void>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

export const QuickProductCreatorView: React.FC<QuickProductCreatorViewProps> = ({
  defaultWaNumber,
  showToast,
  onProductCreated
}) => {
  const { adminToken } = useStore();

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) h['Authorization'] = `Bearer ${adminToken}`;
    return h;
  }, [adminToken]);

  const [pageCreationMode, setPageCreationMode] = useState<'dual_tripwire_winner' | 'principal_only'>(
    'dual_tripwire_winner'
  );

  // BLOQUE 1 (IZQUIERDA): PARA PÁGINA TRIPWIRE (EN MODO DUAL)
  const [entrySourceUrl, setEntrySourceUrl] = useState('');
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const [entryProductName, setEntryProductName] = useState('');
  const [entryProductDescription, setEntryProductDescription] = useState('');
  const [entryPriceGs, setEntryPriceGs] = useState<number>(20000);
  const [entryNormalPriceGs, setEntryNormalPriceGs] = useState<number>(45000);
  const [entryDeliveryFeeGs, setEntryDeliveryFeeGs] = useState<number>(40000);
  const [entryProductImageInput, setEntryProductImageInput] = useState('');
  const [instantDiscountPercent, setInstantDiscountPercent] = useState<number>(12);
  const [eventDurationHours, setEventDurationHours] = useState<number>(6);
  const [slotsTotal, setSlotsTotal] = useState<number>(10);
  const [backgroundMusicPreset, setBackgroundMusicPreset] = useState<
    'warm_ambient' | 'soft_lounge' | 'commercial_pulse' | 'none'
  >('warm_ambient');

  // BLOQUE 2 (DERECHA): PARA PÁGINA PRODUCTO GANADOR (MISMA PÁGINA · ÁNGULO DIFERENTE)
  const [productName, setProductName] = useState('');
  const [winnerAngle, setWinnerAngle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [normalPriceGs, setNormalPriceGs] = useState<number>(249000);
  const [price1Gs, setPrice1Gs] = useState<number>(189000);
  const [price2Gs, setPrice2Gs] = useState<number>(358000);
  const [price3Gs, setPrice3Gs] = useState<number>(507000);
  const [productImageInput, setProductImageInput] = useState('');
  const [waNumber, setWaNumber] = useState(defaultWaNumber || '595973532550');

  // ESTRUCTURA LÁMINAS GPT-2.6
  const [sheetCount, setSheetCount] = useState<2 | 3>(2);
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    product: ProductPage;
    strategySummary: string;
  } | null>(null);

  const handleUploadPrincipalImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await readFileAsDataUrl(f);
      setProductImageInput(dataUrl);
    } catch (err: any) {
      showToast(err?.message || 'Error leyendo foto del Producto Ganador.');
    }
  };

  const handleUploadEntryImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await readFileAsDataUrl(f);
      setEntryProductImageInput(dataUrl);
    } catch (err: any) {
      showToast(err?.message || 'Error leyendo foto del Producto Tripwire.');
    }
  };

  const handleAnalyzeHookUrl = async () => {
    if (!entrySourceUrl.trim()) {
      showToast('Pegá primero la URL del artículo de entrada.');
      return;
    }
    setAnalyzingUrl(true);
    try {
      const res = await fetch('/api/products/analyze-hook-url', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ url: entrySourceUrl.trim() })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'No se pudo extraer info de esa URL.');
        return;
      }
      if (data.title && !entryProductName.trim()) setEntryProductName(data.title);
      if (data.description) setEntryProductDescription(data.description);
      if (data.imageUrl && !entryProductImageInput) setEntryProductImageInput(data.imageUrl);
      showToast('Datos e imagen cargados en el bloque Tripwire.');
    } catch (err: any) {
      showToast(err?.message || 'Error analizando URL.');
    } finally {
      setAnalyzingUrl(false);
    }
  };

  const handleCreateVisualProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pageCreationMode === 'dual_tripwire_winner' && !entryProductName.trim()) {
      showToast('Completá el nombre del producto para tu página Tripwire.');
      return;
    }
    if (!productName.trim() || !productDescription.trim()) {
      showToast('Completá el nombre y descripción de tu Producto Principal / Ganador.');
      return;
    }

    setCreating(true);
    try {
      const payload: Record<string, any> = {
        pageCreationMode,
        productName: productName.trim(),
        winnerAngle: winnerAngle.trim() || undefined,
        productDescription: productDescription.trim(),
        normalPriceGs,
        price1Gs,
        price2Gs,
        price3Gs,
        productImageInput: productImageInput.trim(),
        backgroundMusicPreset,
        sheetCount,
        waNumber: waNumber.trim()
      };
      if (pageCreationMode === 'dual_tripwire_winner') {
        payload.entryProductName = entryProductName.trim();
        payload.entryProductDescription = entryProductDescription.trim() || entryProductName.trim();
        payload.entryPriceGs = entryPriceGs;
        payload.entryNormalPriceGs = entryNormalPriceGs;
        payload.entryDeliveryFeeGs = entryDeliveryFeeGs;
        payload.entryProductImageInput = entryProductImageInput.trim();
        payload.entrySourceUrl = entrySourceUrl.trim() || undefined;
        payload.instantDiscountPercent = instantDiscountPercent;
        payload.eventDurationHours = eventDurationHours;
        payload.slotsTotal = slotsTotal;
      }

      const res = await fetch('/api/products/quick-create-visual', {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.product) {
        showToast(data?.error || 'Error generando el producto visual.');
        return;
      }
      await onProductCreated(data.product, false);
      setCreatedResult({
        product: data.product,
        strategySummary: String(data.strategySummary || '')
      });
      showToast(
        pageCreationMode === 'principal_only'
          ? `Página de Producto Principal creada y conectada: "${data.product.nombre}".`
          : `Página dual (Tripwire + Producto Ganador) creada y conectada: "${data.product.nombre}".`
      );
    } catch (err: any) {
      showToast(err?.message || 'Error creando producto.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div data-testid="quick-product-creator-view" className="max-w-6xl mx-auto space-y-6">
      <header className="rounded-xl bg-[#0c0d12] border border-zinc-800 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight text-balance">
              Creador Rápido Universal de Páginas de Producto (GPT-2.6)
            </h2>
            <p className="text-sm text-zinc-400">
              {pageCreationMode === 'principal_only' ? (
                <>
                  Modo <strong className="text-emerald-300">Exclusivamente Producto Principal</strong>: genera una landing visual limpia 100% enfocada en tu producto principal con Envío Gratis y Packs (sin bloque Tripwire).
                </>
              ) : (
                <>
                  Modo <strong className="text-amber-300">Página Dual (Tripwire + Producto Ganador)</strong>: creá la página completa con dos botones separados — a la izquierda tu <strong className="text-amber-300">Página Tripwire</strong> y a la derecha tu <strong className="text-emerald-300">Página Producto Ganador (con Ángulo Diferente)</strong>.
                </>
              )}
            </p>
          </div>

          <div
            data-testid="quick-creator-mode-switcher"
            className="inline-flex rounded-xl bg-zinc-950 border border-zinc-800 p-1 shrink-0"
          >
            <button
              type="button"
              data-testid="quick-creator-mode-dual"
              onClick={() => setPageCreationMode('dual_tripwire_winner')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                pageCreationMode === 'dual_tripwire_winner'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Página Dual (Tripwire + Ganador)
            </button>
            <button
              type="button"
              data-testid="quick-creator-mode-principal"
              onClick={() => setPageCreationMode('principal_only')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                pageCreationMode === 'principal_only'
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Exclusivamente Producto Principal
            </button>
          </div>
        </div>
      </header>

      <form onSubmit={handleCreateVisualProduct} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* COLUMNA IZQUIERDA: BLOQUE 1 — PARA PÁGINA TRIPWIRE (SOLO EN MODO DUAL) */}
        {pageCreationMode === 'dual_tripwire_winner' && (
        <section
          data-testid="quick-creator-tripwire-block"
          className="lg:col-span-6 rounded-xl bg-[#0c0d12] border-2 border-amber-500/40 p-5 space-y-4"
        >
          <div className="border-b border-zinc-800 pb-3 space-y-1.5">
            <span className="inline-block px-2.5 py-0.5 rounded bg-amber-500 text-zinc-950 text-[11px] font-black uppercase tracking-wider">
              BLOQUE 1 · ESTE ES PARA TU PÁGINA TRIPWIRE
            </span>
            <h3 className="text-base font-bold text-white">
              Producto Tripwire (Oferta de Entrada / Atracción)
            </h3>
            <p className="text-xs text-zinc-400">
              Cargá aquí la imagen, descripción y precios del artículo accesible que atrae clics. En la web pública jamás se muestra la palabra "tripwire", solo su nombre real.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Importar datos desde URL (opcional)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <LinkIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder="https://proveedor.com/producto-entrada"
                  value={entrySourceUrl}
                  onChange={(e) => setEntrySourceUrl(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleAnalyzeHookUrl}
                disabled={analyzingUrl}
                className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-amber-300 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {analyzingUrl ? 'Leyendo...' : 'Analizar URL'}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Nombre del producto Tripwire (visible al cliente)
            </label>
            <input
              type="text"
              data-testid="quick-creator-entry-name"
              required
              placeholder="Ej: Guirnalda Solar LED Navideña 10 Metros"
              value={entryProductName}
              onChange={(e) => setEntryProductName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Descripción completa del producto Tripwire (medidas, material, qué incluye)
            </label>
            <textarea
              data-testid="quick-creator-entry-desc"
              required
              rows={3}
              placeholder="Ej: Tira LED luz cálida de 10 metros para marco de puerta o balcón. Resistente al exterior, enchufe directo."
              value={entryProductDescription}
              onChange={(e) => setEntryProductDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-amber-300 font-semibold block">Precio Tripwire (Gs.)</label>
              <input
                type="number"
                required
                min={5000}
                step={1000}
                value={entryPriceGs}
                onChange={(e) => setEntryPriceGs(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block">Normal Tachado</label>
              <input
                type="number"
                min={10000}
                step={1000}
                value={entryNormalPriceGs}
                onChange={(e) => setEntryNormalPriceGs(Number(e.target.value) || 45000)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block">Delivery Suelto</label>
              <input
                type="number"
                min={10000}
                step={5000}
                value={entryDeliveryFeeGs}
                onChange={(e) => setEntryDeliveryFeeGs(Number(e.target.value) || 40000)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block">Desc. Upgrade (%)</label>
              <input
                type="number"
                min={5}
                max={40}
                value={instantDiscountPercent}
                onChange={(e) => setInstantDiscountPercent(Number(e.target.value) || 12)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">
                Imagen del Producto Tripwire
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="https://... o subí foto"
                  value={entryProductImageInput.startsWith('data:') ? 'Imagen cargada ✓' : entryProductImageInput}
                  onChange={(e) => setEntryProductImageInput(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                />
                <label className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 cursor-pointer shrink-0 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir</span>
                  <input type="file" accept="image/*" onChange={handleUploadEntryImg} className="hidden" />
                </label>
              </div>
              {entryProductImageInput && (
                <div className="flex items-center gap-2 pt-1">
                  <img
                    src={entryProductImageInput}
                    alt="Vista previa Tripwire"
                    className="w-12 h-12 rounded-lg object-cover border border-amber-500/40"
                  />
                  <span className="text-[11px] text-amber-300">Foto Tripwire lista</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">
                Evento WhatsApp (Cupos / Horas)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={5}
                  max={20}
                  value={slotsTotal}
                  onChange={(e) => setSlotsTotal(Number(e.target.value) || 10)}
                  title="Cupos de lista exclusiva"
                  className="w-1/2 px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white font-mono tabular-nums"
                />
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={eventDurationHours}
                  onChange={(e) => setEventDurationHours(Number(e.target.value) || 6)}
                  title="Horas totales del evento"
                  className="w-1/2 px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white font-mono tabular-nums"
                />
              </div>
              <span className="text-[11px] text-zinc-500 block">
                {slotsTotal} cupos · duración {eventDurationHours}h · 2 intentos máx
              </span>
            </div>
          </div>
        </section>
        )}

        {/* COLUMNA DERECHA (O COMPLETA SI ES EXCLUSIVAMENTE PRINCIPAL): BLOQUE PRODUCTO GANADOR / PRINCIPAL */}
        <section
          data-testid="quick-creator-winner-block"
          className={`${
            pageCreationMode === 'principal_only' ? 'lg:col-span-12' : 'lg:col-span-6'
          } rounded-xl bg-[#0c0d12] border-2 border-emerald-500/40 p-5 space-y-4`}
        >
          <div className="border-b border-zinc-800 pb-3 space-y-1.5">
            <span className="inline-block px-2.5 py-0.5 rounded bg-emerald-500 text-zinc-950 text-[11px] font-black uppercase tracking-wider">
              {pageCreationMode === 'principal_only'
                ? 'ESTE ES EXCLUSIVAMENTE PARA TU PÁGINA DE PRODUCTO PRINCIPAL'
                : 'BLOQUE 2 · ESTE VA A SER PARA TU PÁGINA DE PRODUCTO GANADOR'}
            </span>
            <h3 className="text-base font-bold text-white">
              {pageCreationMode === 'principal_only'
                ? 'Producto Principal Exclusivo (Landing Directa · Envío Gratis)'
                : 'Producto Ganador en esta Misma Página (Ángulo Diferente · Envío Gratis)'}
            </h3>
            <p className="text-xs text-zinc-400">
              {pageCreationMode === 'principal_only'
                ? 'Ideal para tus campañas estándar normales: toda la página y láminas GPT-2.6 se enfocan únicamente en este Producto Principal.'
                : 'Aparecerá dentro de esta misma página con un ángulo diferente para convertir al cliente al paquete completo (llevando el producto Tripwire de regalo + Envío Gratis).'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Nombre del Producto Ganador
            </label>
            <input
              type="text"
              data-testid="quick-creator-main-name"
              required
              placeholder="Ej: Proyector Navideño Láser HD 12 Diseños"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-emerald-300 block">
              Ángulo diferente del Producto Ganador en esta misma página
            </label>
            <input
              type="text"
              data-testid="quick-creator-winner-angle"
              placeholder="Ej: Iluminá toda la fachada de 70m² en 90 segundos sin escaleras ni cables sueltos"
              value={winnerAngle}
              onChange={(e) => setWinnerAngle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-emerald-800/60 text-sm text-white placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Descripción completa del Producto Ganador (beneficios y qué trae en caja)
            </label>
            <textarea
              data-testid="quick-creator-main-desc"
              required
              rows={3}
              placeholder="Ilumina hasta 70m², resistente a lluvia IP65, enchufe 220V, estaca para jardín y base para sala. Incluye el complemento gratis."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block">Normal Tachado</label>
              <input
                type="number"
                min={40000}
                step={1000}
                value={normalPriceGs}
                onChange={(e) => setNormalPriceGs(Number(e.target.value) || 249000)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-emerald-300 font-semibold block">Precio 1x (Gs.)</label>
              <input
                type="number"
                required
                min={35000}
                step={1000}
                value={price1Gs}
                onChange={(e) => setPrice1Gs(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block">Pack 2x (Gs.)</label>
              <input
                type="number"
                min={50000}
                step={1000}
                value={price2Gs}
                onChange={(e) => setPrice2Gs(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block">Pack 3x (Gs.)</label>
              <input
                type="number"
                min={70000}
                step={1000}
                value={price3Gs}
                onChange={(e) => setPrice3Gs(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">
                Imagen del Producto Ganador
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="https://... o subí foto"
                  value={productImageInput.startsWith('data:') ? 'Imagen cargada ✓' : productImageInput}
                  onChange={(e) => setProductImageInput(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                />
                <label className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 cursor-pointer shrink-0 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir</span>
                  <input type="file" accept="image/*" onChange={handleUploadPrincipalImg} className="hidden" />
                </label>
              </div>
              {productImageInput && (
                <div className="flex items-center gap-2 pt-1">
                  <img
                    src={productImageInput}
                    alt="Vista previa Producto Ganador"
                    className="w-12 h-12 rounded-lg object-cover border border-emerald-500/40"
                  />
                  <span className="text-[11px] text-emerald-300">Foto Ganador lista</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">WhatsApp del producto</label>
              <input
                type="text"
                value={waNumber}
                onChange={(e) => setWaNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-white"
              />
              <span className="text-[11px] text-zinc-500 block">
                Envío Gratis incluido en Producto Ganador
              </span>
            </div>
          </div>
        </section>

        {/* BARRA INFERIOR: CANTIDAD DE LÁMINAS + BOTÓN CREAR */}
        <section className="lg:col-span-12 rounded-xl bg-[#0c0d12] border border-zinc-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-zinc-300 font-semibold">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              <span>Estructura gráfica vertical:</span>
            </div>
            <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => setSheetCount(2)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                  sheetCount === 2 ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
                }`}
              >
                2 Láminas GPT-2.6 (Ultra rápida)
              </button>
              <button
                type="button"
                onClick={() => setSheetCount(3)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                  sheetCount === 3 ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
                }`}
              >
                3 Láminas GPT-2.6 (+ Garantía visual)
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400 whitespace-nowrap">Música fondo Audio IA:</label>
              <select
                value={backgroundMusicPreset}
                onChange={(e) => setBackgroundMusicPreset(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white cursor-pointer"
              >
                <option value="warm_ambient">Acústica Cálida (Recomendada)</option>
                <option value="soft_lounge">Lounge Suave Elegante</option>
                <option value="commercial_pulse">Pulso Dinámico Sutil</option>
                <option value="none">Solo Voz (Sin música)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            data-testid="quick-creator-submit-btn"
            disabled={creating}
            className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {pageCreationMode === 'principal_only'
                    ? 'Generando Producto Principal con GPT-2.6...'
                    : 'Generando página dual con GPT-2.6...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {pageCreationMode === 'principal_only'
                    ? 'Crear Página Exclusiva Producto Principal'
                    : 'Crear Página Dual (Tripwire + Producto Ganador)'}
                </span>
              </>
            )}
          </button>
        </section>
      </form>

      {/* PREVIEW DEL PRODUCTO CREADO */}
      {createdResult && (
        <section className="rounded-xl bg-[#0c0d12] border border-emerald-700/50 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Página Visual Dual Creada y Conectada al Catálogo</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                {createdResult.product.nombre} ·{' '}
                <span className="font-mono text-sm text-zinc-400">/?p={createdResult.product.slug}</span>
              </h3>
              {createdResult.strategySummary && (
                <p className="text-xs text-zinc-400">{createdResult.strategySummary}</p>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onProductCreated(createdResult.product, false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Ver en Páginas Creadas</span>
              </button>
              <a
                href={`/?p=${createdResult.product.slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5"
              >
                <span>Abrir Página Pública</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {createdResult.product.visualLanding?.sheets.map((sh) => (
              <div key={sh.id} className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                <img src={sh.imageUrl} alt={sh.title} className="w-full aspect-[3/4] object-cover" />
                <div className="p-3 space-y-0.5">
                  <div className="text-xs font-bold text-white">{sh.title}</div>
                  {sh.caption && <div className="text-[11px] text-zinc-400">{sh.caption}</div>}
                </div>
              </div>
            ))}
          </div>

          <div
            className={`grid grid-cols-1 ${
              createdResult.product.tripwireConfig?.enabled ? 'md:grid-cols-2' : ''
            } gap-4 text-xs`}
          >
            {createdResult.product.tripwireConfig?.enabled && (
              <div className="p-3.5 rounded-lg bg-zinc-950 border border-amber-800/50 space-y-2">
                <div className="font-bold text-amber-300">
                  Bloque 1 · Página Tripwire ({createdResult.product.tripwireConfig?.entryProductName} ·{' '}
                  {formatGs(createdResult.product.tripwireConfig?.entryPriceGs || 0)})
                </div>
                <div className="text-zinc-300">{createdResult.product.visualLanding?.entryDisclaimer}</div>
              </div>
            )}
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-emerald-800/50 space-y-2">
              <div className="font-bold text-emerald-300">
                {createdResult.product.tripwireConfig?.enabled
                  ? 'Bloque 2 · Producto Ganador'
                  : 'Página Exclusiva Producto Principal'}{' '}
                ({createdResult.product.nombre} · {formatGs(createdResult.product.precios?.[1] || 0)})
              </div>
              {createdResult.product.visualLanding?.winnerAngleHeadline && (
                <div className="text-emerald-200 font-semibold">
                  Ángulo: {createdResult.product.visualLanding.winnerAngleHeadline}
                </div>
              )}
              <div className="text-zinc-300">{createdResult.product.visualLanding?.bundleDisclaimer}</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
