import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, Award, Users, QrCode, ExternalLink, ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatGs } from '../config';

export const ViralModal: React.FC = () => {
  const { viralModalOpen, setViralModalOpen, promoterCode, lastOrder, config, setCurrentView } = useStore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(599);

  // Timer countdown
  useEffect(() => {
    if (!viralModalOpen) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [viralModalOpen]);

  if (!viralModalOpen) return null;

  const orderId = lastOrder?.reservaid || 'NX-784210';
  const clientName = lastOrder?.nombre?.split(' ')[0] || 'vecino';
  const clientCity = lastOrder?.ciudad || 'Paraguay';

  const shareUrl = `${window.location.origin}${window.location.pathname}?ref=${promoterCode}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const messageTemplates = [
    {
      title: 'Para tu Estado de WhatsApp',
      key: 'msg-estado',
      text: `Miren qué lindo lo que compré para la casa: Proyector de luces para el frente con 12 dibujos navideños que se mueven (chau cables y escaleras). No se paga nada por adelantado, le pagás al delivery recién cuando te trae a tu casa. Les paso la página por si quieren aprovechar la oferta antes que termine: ${shareUrl}`
    },
    {
      title: 'Para Grupos de Familia o Vecinos',
      key: 'msg-grupo',
      text: `Familia y amigos, les paso este dato por si quieren decorar la casa para Navidad sin gastar en luces caras. Ya encargué este proyector que cubre toda la fachada en 2 minutos. El envío es gratis a todo el país y se paga recién al recibir en la puerta. Acá pueden pedir el suyo: ${shareUrl}`
    },
    {
      title: 'Para Facebook / Redes Sociales',
      key: 'msg-social',
      text: `¡Dato navideño imperdible! Ya pedí el proyector para la fachada de la casa: viene con 12 figuras con movimiento y se enchufa en 1 minuto. Lo mejor es que no pagás nada antes, revisás cuando llega a tu casa y pagás al repartidor. Acá les dejo la página con descuento: ${shareUrl}`
    }
  ];

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={() => setViralModalOpen(false)}
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#062319] via-[#0b3d2e] to-[#062319] text-white p-5 sm:p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#e8b23a] text-[#062319] text-[10px] font-black uppercase px-2 py-0.5 rounded">
                Reserva {orderId}
              </span>
              <span className="text-xs text-[#ffd778] font-bold">
                Tiempo restante: {timeFormatted}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black mt-1 text-white">
              ¡Ganá {formatGs(config.viral.premio)} en efectivo!
            </h3>
          </div>
          <button
            onClick={() => setViralModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Explanation Box */}
          <div className="bg-[#fff9ec] border border-[#f0dcab] rounded-2xl p-4 text-xs sm:text-sm text-[#785808] leading-relaxed">
            <b className="text-stone-900 block text-sm font-black mb-1">
              ¿Cómo funciona el programa de promotores Noelux?
            </b>
            Compartí tu enlace con amigos, familiares o en tus estados. Por cada <b>5 pedidos</b> entregados y cobrados con tu código, te transferimos <b>{formatGs(config.viral.premio)}</b> directo por QR a tu cuenta de ueno o banco. Sin topes ni límites.
          </div>

          {/* Your Unique Code & Link Card */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider block">
                  Tu Código de Promotor
                </span>
                <b className="text-lg font-black text-[#0b3d2e] tracking-wider">{promoterCode}</b>
              </div>
              <button
                onClick={() => {
                  setViralModalOpen(false);
                  setCurrentView('promoter');
                }}
                className="bg-[#0b3d2e] text-white text-xs font-black px-3 py-1.5 rounded-xl hover:bg-[#0f4f3a] transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                Abrir App de Promotor <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider block mb-1">
                Tu Enlace Directo para Compartir
              </span>
              <div className="flex items-center gap-2 bg-white border border-stone-300 rounded-xl p-1.5 pl-3">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full text-xs font-mono text-stone-700 bg-transparent outline-none truncate"
                />
                <button
                  onClick={() => copyToClipboard(shareUrl, 'link')}
                  className="bg-[#1ea856] hover:bg-[#188d44] text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedKey === 'link' ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar Link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Pre-written Copy Templates */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-stone-900 uppercase tracking-wider">
              Textos listos para publicar (tocá copiar y pegá):
            </h4>

            {messageTemplates.map(tmpl => (
              <div
                key={tmpl.key}
                className="bg-white border border-[#dfdad0] rounded-2xl p-4 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#0b3d2e] uppercase tracking-wide">
                    {tmpl.title}
                  </span>
                  <button
                    onClick={() => copyToClipboard(tmpl.text, tmpl.key)}
                    className="text-xs font-bold text-[#0a7a4a] hover:text-[#0b3d2e] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === tmpl.key ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#1ea856]" /> ¡Texto Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Mensaje
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-100 italic leading-relaxed">
                  "{tmpl.text}"
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(tmpl.text)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#25D366] hover:bg-[#1ebd5a] text-white text-xs font-extrabold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Compartir en WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-between items-center text-xs text-stone-500">
          <span>* El punto se acredita cuando el repartidor marca el pedido como pagado.</span>
          <button
            onClick={() => setViralModalOpen(false)}
            className="text-stone-700 font-bold hover:underline cursor-pointer"
          >
            Cerrar ventana
          </button>
        </div>

      </div>
    </div>
  );
};
