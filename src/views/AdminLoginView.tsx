import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowLeft, AlertCircle, KeyRound } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { LuminousOrbsBackdrop } from '../components/LuminousOrbsBackdrop';

export const AdminLoginView: React.FC = () => {
  const { loginAdmin, setCurrentView } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Por favor complete su correo electrónico y contraseña.');
      return;
    }

    setLoading(true);
    const result = await loginAdmin(username.trim(), password.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Credenciales incorrectas. Acceso denegado.');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#06080d] flex flex-col justify-center items-center p-4 sm:p-6 text-zinc-100 overflow-hidden">
      <LuminousOrbsBackdrop />

      <div className="relative z-10 w-full max-w-md mb-4 flex justify-between items-center gap-3">
        <button
          onClick={() => {
            window.location.hash = '';
            setCurrentView('store');
          }}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer bg-[#0b0e16]/80 hover:bg-white/[0.08] px-3.5 py-2 rounded-xl border border-white/10 whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 text-[#e5c88b]" />
          <span>Volver a la Tienda</span>
        </button>

        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#e5c88b]" />
          <span>Acceso Protegido</span>
        </span>
      </div>

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0b0e16]/85 backdrop-blur-xl text-zinc-100 rounded-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/10 p-6 sm:p-7 text-center text-white">
          <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/10 mx-auto flex items-center justify-center text-[#e5c88b] mb-3.5">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Panel Administrativo
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Acceso Exclusivo · Autenticación Oficial
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-5 bg-red-950/50 border border-red-500/35 text-red-200 text-xs sm:text-sm rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium leading-tight">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Ingrese su correo electrónico"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#07090f]/90 border border-white/10 rounded-xl text-zinc-100 text-sm font-medium focus:outline-none focus:border-[#e5c88b]/70 placeholder-zinc-600 transition-colors"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-2.5 bg-[#07090f]/90 border border-white/10 rounded-xl text-zinc-100 text-sm font-medium focus:outline-none focus:border-[#e5c88b]/70 placeholder-zinc-600 transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#e5c88b] hover:bg-[#edd49e] text-[#090b10] font-bold text-sm py-3.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#090b10]/30 border-t-[#090b10] rounded-full animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-[#090b10]" />
                  <span>Ingresar al Panel de Control</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 border-t border-white/10 text-center">
          <p className="text-[11px] text-zinc-500">
            Acceso Restringido · Solo Personal Autorizado
          </p>
        </div>
      </div>
    </div>
  );
};
