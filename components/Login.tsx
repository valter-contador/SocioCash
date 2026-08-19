
import React, { useState } from 'react';
import { Lock, LogIn, AlertCircle, Eye, EyeOff, UserSquare2 } from 'lucide-react';
import { Session } from '../types';
import { authenticate } from '../dataService';

interface LoginProps {
  onLogin: (session: Session) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await authenticate(loginId, password);
      if (session) {
        setError('');
        onLogin(session);
      } else {
        setError('CPF/CNPJ ou senha inválidos. Verifique com o administrador.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fundo decorativo */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#2B589A]/5 rounded-full" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#00E676]/5 rounded-full" />

      <div className="relative w-full max-w-md">
        {/* Marca */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#2B589A] flex items-center justify-center relative overflow-hidden shadow-lg shadow-[#2B589A]/30 mb-4">
            <span className="text-white font-black text-lg">JC</span>
            <div className="absolute top-0 right-0 w-4 h-4 bg-[#00E676] translate-x-2 -translate-y-2 rounded-full" />
          </div>
          <h1 className="text-2xl font-black text-[#2B589A] tracking-tighter">JCBUARQUE</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.25em] font-bold">SócioCash · Gestão de Caixa Societário</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Acesso Restrito</h2>
            <p className="text-sm text-slate-400 font-medium mt-1">Informe seu CPF/CNPJ e senha de acesso</p>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
              <UserSquare2 size={12} className="text-[#2B589A]" /> CPF (equipe) ou CNPJ (empresa)
            </label>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              className="w-full p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold font-mono"
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              value={loginId}
              onChange={e => { setLoginId(e.target.value); setError(''); }}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
              <Lock size={12} className="text-[#2B589A]" /> Senha
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                className="w-full p-4 pr-12 bg-slate-50 text-slate-900 border border-slate-200 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-300 hover:text-[#2B589A]"
                tabIndex={-1}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 font-semibold">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#2B589A] text-white font-black rounded-[1.25rem] hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn size={18} /> {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Equipe (Administrador/Analista): login com CPF + senha. Empresa cliente: login com CNPJ + senha.
          </p>
        </form>

        <p className="text-center text-[10px] text-slate-300 mt-6">© JC Buarque · Soluções Contábeis</p>
      </div>
    </div>
  );
};

export default Login;
