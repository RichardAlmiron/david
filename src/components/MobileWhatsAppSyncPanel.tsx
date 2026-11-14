import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Plus,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  QrCode,
  WifiOff
} from 'lucide-react';

interface WaSessionSummary {
  id: string;
  label: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'syncing' | 'connected';
  connectedPhone?: string | null;
  connectedName?: string | null;
  qrDataUrl?: string | null;
  pairingCode?: string | null;
}

interface MobileWhatsAppSyncPanelProps {
  platform: 'ios' | 'android';
  defaultLabel?: string;
}

export const MobileWhatsAppSyncPanel: React.FC<MobileWhatsAppSyncPanelProps> = ({
  platform,
  defaultLabel = platform === 'ios' ? 'WhatsApp iPhone' : 'WhatsApp Android'
}) => {
  const [sessions, setSessions] = useState<WaSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingLine, setAddingLine] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQrFallback, setShowQrFallback] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isIos = platform === 'ios';

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) return;
      const data = await res.json();
      const list: WaSessionSummary[] = Array.isArray(data.sessions) ? data.sessions : [];
      setSessions(list);
      if (list.length > 0 && (!selectedSessionId || !list.some(s => s.id === selectedSessionId))) {
        const disconnectedSlot = list.find(s => s.status !== 'connected');
        setSelectedSessionId((disconnectedSlot || list[0]).id);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const timer = window.setInterval(fetchStatus, 2500);
    return () => window.clearInterval(timer);
  }, []);

  const activeSession = sessions.find(s => s.id === selectedSessionId) || sessions[0];

  const handleAddLine = async () => {
    setAddingLine(true);
    setFeedback(null);
    try {
      const label = `${defaultLabel} #${sessions.length + 1}`;
      const res = await fetch('/api/whatsapp/sessions/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchStatus();
        if (data.session?.id) {
          setSelectedSessionId(data.session.id);
        }
        setFeedback({ type: 'ok', text: `Línea "${label}" lista. Ahora ingresá tu número para generar el código.` });
      } else {
        setFeedback({ type: 'err', text: data.error || 'No se pudo crear la nueva línea.' });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Sin conexión con el servidor WhatsApp.' });
    } finally {
      setAddingLine(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneInput.trim();
    if (!clean) {
      setFeedback({ type: 'err', text: 'Escribí tu número de WhatsApp (ej: 0981123456).' });
      return;
    }
    const targetId = activeSession?.id || 'wa-1';
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, sessionId: targetId })
      });
      const data = await res.json();
      if (res.ok && data.pairingCode) {
        await fetchStatus();
        setFeedback({
          type: 'ok',
          text: 'Código listo. Copialo y pegalo en tu WhatsApp normal (seguí el Paso 2 de abajo).'
        });
      } else {
        setFeedback({
          type: 'err',
          text: data.error || 'No se pudo generar el código. Intentá nuevamente en unos segundos.'
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Error de red al pedir el código de vinculación.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestQr = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceNewQr: true, sessionId: activeSession.id })
      });
      await fetchStatus();
    } catch {}
    setLoading(false);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code.replace(/-/g, ''));
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const cardClass = isIos
    ? 'bg-white rounded-2xl border border-black/5 shadow-xs p-4 space-y-3'
    : 'bg-[#0b0e16]/85 backdrop-blur-md rounded-2xl border border-white/10 p-4 space-y-3';

  const mutedText = isIos ? 'text-[#8e8e93]' : 'text-zinc-400';
  const primaryText = isIos ? 'text-[#1c1c1e]' : 'text-zinc-100';

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isIos ? 'bg-[#007aff]/10 text-[#007aff]' : 'bg-white/[0.06] border border-white/10 text-[#e5c88b]'
            }`}
          >
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={`text-base font-semibold leading-tight ${primaryText}`}>
              Conectar tu WhatsApp (sin QR)
            </h3>
            <p className={`text-xs mt-1 leading-relaxed ${mutedText}`}>
              Generás un código acá y lo pegás dentro de tu WhatsApp normal.
            </p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>
            Línea de WhatsApp ({sessions.length})
          </span>
          <button
            type="button"
            onClick={handleAddLine}
            disabled={addingLine}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
              isIos
                ? 'bg-[#007aff]/10 text-[#007aff] active:bg-[#007aff]/20'
                : 'bg-white/[0.06] border border-white/10 text-[#e5c88b] hover:bg-white/[0.12]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{addingLine ? 'Creando...' : 'Nueva Línea'}</span>
          </button>
        </div>

        {sessions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sessions.map(sess => {
              const isSelected = sess.id === activeSession?.id;
              const isConnected = sess.status === 'connected';
              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => setSelectedSessionId(sess.id)}
                  className={`shrink-0 px-3 py-2 rounded-xl border text-left cursor-pointer transition-all min-w-[145px] ${
                    isSelected
                      ? isIos
                        ? 'bg-[#007aff] text-white border-[#007aff]'
                        : 'bg-white/[0.08] text-white border-[#e5c88b]'
                      : isIos
                        ? 'bg-[#f2f2f7] text-[#1c1c1e] border-transparent'
                        : 'bg-[#07090f]/80 text-zinc-300 border-white/10'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">{sess.label}</div>
                  <div
                    className={`text-[11px] mt-0.5 truncate ${
                      isSelected && isIos
                        ? 'text-white/85'
                        : isConnected
                          ? isIos
                            ? 'text-[#34c759] font-medium'
                            : 'text-emerald-400 font-medium'
                          : mutedText
                    }`}
                  >
                    {isConnected
                      ? `Conectado · ${sess.connectedPhone || 'Activo'}`
                      : sess.status === 'syncing'
                        ? 'Sincronizando...'
                        : sess.status === 'qr_ready'
                          ? 'Listo para vincular'
                          : 'Sin vincular'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activeSession?.status === 'connected' ? (
        <div
          className={
            isIos
              ? 'bg-white rounded-2xl border border-[#34c759]/30 p-5 text-center space-y-2'
              : 'bg-[#0b0e16]/85 rounded-2xl border border-white/10 p-5 text-center space-y-2'
          }
        >
          <div
            className={`w-12 h-12 rounded-xl mx-auto flex items-center justify-center ${
              isIos ? 'bg-[#34c759]/15 text-[#34c759]' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className={`text-base font-semibold ${primaryText}`}>
            WhatsApp Sincronizado
          </div>
          <p className={`text-sm font-mono tabular-nums font-medium ${isIos ? 'text-[#34c759]' : 'text-[#e5c88b]'}`}>
            {activeSession.connectedPhone || activeSession.connectedName || activeSession.label}
          </p>
          <p className={`text-xs ${mutedText}`}>
            Esta línea está conectada. Para conectar otro celular aparte, tocá "Nueva Línea".
          </p>
        </div>
      ) : (
        <div className={cardClass}>
          <form onSubmit={handleRequestPairingCode} className="space-y-3">
            <div className={`text-[11px] font-mono ${isIos ? 'text-[#007aff]' : 'text-[#e5c88b]'}`}>
              Paso 1 · En esta aplicación
            </div>
            <label className={`block text-xs font-semibold ${primaryText}`}>
              Escribí tu número de celular y pedí el código:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="tel"
                inputMode="tel"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="Ej: 0981 123 456"
                className={`flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-mono tabular-nums outline-none border ${
                  isIos
                    ? 'bg-[#f2f2f7] border-black/10 text-[#1c1c1e] focus:border-[#007aff]'
                    : 'bg-[#07090f]/90 border-white/10 text-zinc-100 focus:border-[#e5c88b]/70'
                }`}
              />
              <button
                type="submit"
                disabled={loading || !phoneInput.trim()}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap ${
                  isIos
                    ? 'bg-[#007aff] text-white active:bg-[#0062cc]'
                    : 'bg-[#e5c88b] text-[#090b10] hover:bg-[#edd49e]'
                }`}
              >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Dame el Código</span>
              </button>
            </div>
          </form>

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                feedback.type === 'ok'
                  ? isIos
                    ? 'bg-[#34c759]/12 text-[#1e7e34]'
                    : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                  : isIos
                    ? 'bg-[#ff3b30]/12 text-[#c62828]'
                    : 'bg-red-950/40 text-red-300 border border-red-500/30'
              }`}
            >
              {feedback.type === 'err' && <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {activeSession?.pairingCode && (
            <div
              className={`p-4 rounded-xl text-center space-y-2.5 ${
                isIos
                  ? 'bg-[#f2f2f7] border border-[#007aff]/25'
                  : 'bg-[#07090f]/90 border border-[#e5c88b]/40'
              }`}
            >
              <div className={`text-xs font-medium ${mutedText}`}>
                Copiá este código para pegar en tu WhatsApp:
              </div>
              <div
                className={`text-2xl sm:text-3xl font-mono tabular-nums font-bold tracking-[0.2em] ${
                  isIos ? 'text-[#007aff]' : 'text-[#e5c88b]'
                }`}
              >
                {activeSession.pairingCode}
              </div>
              <button
                type="button"
                onClick={() => handleCopyCode(activeSession.pairingCode!)}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isIos
                    ? 'bg-[#007aff] text-white'
                    : 'bg-[#e5c88b] text-[#090b10] hover:bg-[#edd49e]'
                }`}
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Código copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copiar código
                  </>
                )}
              </button>
            </div>
          )}

          {/* Crystal-clear step-by-step inside WhatsApp */}
          <div
            className={`pt-3 border-t text-xs space-y-2 ${isIos ? 'border-black/5' : 'border-zinc-800'} ${mutedText}`}
          >
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-sky-500/15 text-sky-500">
              <span>Paso 2 · Abrí tu app de WhatsApp</span>
            </div>
            <p className={primaryText}>
              {isIos ? (
                <>
                  1. Abrí tu <strong>WhatsApp normal</strong> → <strong>Configuración</strong> →{' '}
                  <strong>Dispositivos vinculados</strong>.
                </>
              ) : (
                <>
                  1. Abrí tu <strong>WhatsApp normal</strong> → tocá los <strong>3 puntitos (⋮)</strong> →{' '}
                  <strong>Dispositivos vinculados</strong>.
                </>
              )}
            </p>
            <p className={primaryText}>
              2. Tocá <strong>Vincular dispositivo</strong> → abajo tocá{' '}
              <strong>“Vincular con el número de teléfono”</strong>.
            </p>
            <p className={primaryText}>
              3. Pegá ahí el código de 8 letras/números de arriba. <strong>¡Listo!</strong>
            </p>
          </div>

          {/* Optional QR fallback */}
          <div className={`pt-2 border-t ${isIos ? 'border-black/5' : 'border-zinc-800'}`}>
            <button
              type="button"
              onClick={() => {
                const next = !showQrFallback;
                setShowQrFallback(next);
                if (next && !activeSession?.qrDataUrl) {
                  handleRequestQr();
                }
              }}
              className={`text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                isIos ? 'text-[#007aff]' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQrFallback ? 'Ocultar código QR' : '¿Tenés otro celular cerca? Mostrar QR'}</span>
            </button>

            {showQrFallback && (
              <div className="mt-3 flex flex-col items-center gap-2">
                {activeSession?.qrDataUrl ? (
                  <img
                    src={activeSession.qrDataUrl}
                    alt="QR WhatsApp"
                    referrerPolicy="no-referrer"
                    className="w-44 h-44 rounded-xl bg-white p-2 border border-white/15"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestQr}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      isIos ? 'bg-[#f2f2f7] text-[#1c1c1e]' : 'bg-zinc-900 text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    Generar Código QR
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
