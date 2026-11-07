import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowLeft, AlertCircle, KeyRound } from 'lucide-react';
import { useStore } from '../context/StoreContext';

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
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center items-center p-4 sm:p-6 text-zinc-100">
      {/* Back to public store button */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center">
        <button
          onClick={() => {
            window.location.hash = '';
            setCurrentView('store');
          }}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-800"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Volver a la Tienda de Productos</span>
        </button>

        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5" /> Acceso Protegido
        </span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#0d0d0f] text-zinc-100 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="bg-zinc-900/80 border-b border-zinc-800 p-6 text-center text-white relative">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-emerald-400 shadow-lg mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Panel <span className="text-emerald-400">Administrativo</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            Acceso Exclusivo · Autenticación Oficial
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-5 bg-red-950/60 border border-red-800/80 text-red-200 text-xs sm:text-sm rounded-xl p-3.5 flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="font-semibold leading-tight">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
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
                  className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm font-semibold focus:outline-none focus:border-emerald-500 placeholder-zinc-500 transition-all"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
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
                  className="w-full pl-10 pr-11 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm font-semibold focus:outline-none focus:border-emerald-500 placeholder-zinc-500 transition-all"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-black" />
                  <span>Ingresar al Panel de Control</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="bg-zinc-900/50 px-6 py-3 border-t border-zinc-800 text-center">
          <p className="text-[11px] text-zinc-500 font-medium">
            Acceso Restringido · Solo Personal Autorizado
          </p>
        </div>
      </div>
    </div>
  );
};
