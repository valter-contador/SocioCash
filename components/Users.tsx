
import React, { useState } from 'react';
import { Plus, Trash2, KeyRound, Eye, EyeOff, ShieldAlert, UserCog } from 'lucide-react';
import { AppData, AccessUser } from '../types';

interface UsersProps {
  data: AppData;
  onUpdate: (data: AppData) => void;
}

const Users: React.FC<UsersProps> = ({ data, onUpdate }) => {
  const [showPasswords, setShowPasswords] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    cpf: '',
    email: '',
    phone: '',
    role: 'analyst' as 'admin' | 'analyst',
    password: ''
  });

  const access = data.access || {};
  const accessUsers = access.users || [];

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: AccessUser = { id: crypto.randomUUID(), ...userFormData };
    onUpdate({ ...data, access: { ...access, users: [...accessUsers, newUser] } });
    setUserFormData({ name: '', cpf: '', email: '', phone: '', role: 'analyst', password: '' });
    setIsAddingUser(false);
  };

  const updateUser = (id: string, patch: Partial<AccessUser>) => {
    onUpdate({ ...data, access: { ...access, users: accessUsers.map(u => u.id === id ? { ...u, ...patch } : u) } });
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('Deseja excluir este usuário?')) {
      onUpdate({ ...data, access: { ...access, users: accessUsers.filter(u => u.id !== id) } });
    }
  };

  // Campo de senha não reflete valor salvo — o Supabase Auth nunca devolve a senha. Por isso
  // fica com estado próprio ("nova senha") e só dispara a troca de fato no blur, evitando
  // salvar senha parcial a cada tecla digitada.
  const [pendingUserPwd, setPendingUserPwd] = useState<Record<string, string>>({});
  const commitUserPwd = (id: string) => {
    const pwd = pendingUserPwd[id];
    if (pwd) updateUser(id, { password: pwd });
    setPendingUserPwd(p => ({ ...p, [id]: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Usuários</h2>
          <p className="text-slate-500 font-medium">Administradores e Analistas com acesso ao sistema (login por CPF)</p>
        </div>
      </div>

      <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#2B589A] flex items-center justify-center text-white shadow-md shadow-[#2B589A]/20">
              <UserCog size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Controle de Acesso</h3>
              <p className="text-[11px] text-slate-400 font-medium">Administradores e Analistas (login por CPF) · a senha do cliente é definida em cada empresa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPasswords(v => !v)}
              className="flex items-center gap-2 text-[11px] font-black text-[#2B589A] bg-[#2B589A]/5 px-3 py-2 rounded-xl hover:bg-[#2B589A]/10 transition-colors"
            >
              {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
            </button>
            <button
              type="button"
              onClick={() => setIsAddingUser(true)}
              className="flex items-center gap-2 text-[11px] font-black text-white bg-[#2B589A] px-3 py-2 rounded-xl hover:bg-[#1E3F6D] transition-colors"
            >
              <Plus size={14} /> Novo Usuário
            </button>
          </div>
        </div>

        {isAddingUser && (
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 mb-5 bg-slate-50/70 border border-slate-100 rounded-2xl">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nome *</label>
              <input required type="text" className="w-full p-3.5 bg-white text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={userFormData.name} onChange={e => setUserFormData({ ...userFormData, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">CPF (login) *</label>
              <input required type="text" placeholder="000.000.000-00" className="w-full p-3.5 bg-white text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-mono" value={userFormData.cpf} onChange={e => setUserFormData({ ...userFormData, cpf: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
              <input type="email" className="w-full p-3.5 bg-white text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={userFormData.email} onChange={e => setUserFormData({ ...userFormData, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Fone</label>
              <input type="text" placeholder="(00) 00000-0000" className="w-full p-3.5 bg-white text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={userFormData.phone} onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Perfil *</label>
              <select className="w-full p-3.5 bg-white text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={userFormData.role} onChange={e => setUserFormData({ ...userFormData, role: e.target.value as 'admin' | 'analyst' })}>
                <option value="admin">Administrador</option>
                <option value="analyst">Analista Contábil</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><KeyRound size={12} className="text-[#2B589A]" /> Senha *</label>
              <input required type={showPasswords ? 'text' : 'password'} autoComplete="new-password" className="w-full p-3.5 bg-white text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={userFormData.password} onChange={e => setUserFormData({ ...userFormData, password: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsAddingUser(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-white rounded-2xl">Cancelar</button>
              <button type="submit" className="px-8 py-3 bg-[#2B589A] text-white rounded-2xl hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 font-bold">Salvar Usuário</button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {accessUsers.map(u => (
            <div key={u.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#2B589A]/10 text-[#2B589A]">
                    {u.role === 'admin' ? 'Administrador' : 'Analista'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 flex-1">
                  <input className="p-2.5 bg-white text-slate-900 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2B589A]" placeholder="Nome" value={u.name} onChange={e => updateUser(u.id, { name: e.target.value })} />
                  <input className="p-2.5 bg-white text-slate-900 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2B589A] font-mono" placeholder="CPF" value={u.cpf} onChange={e => updateUser(u.id, { cpf: e.target.value })} />
                  <input className="p-2.5 bg-white text-slate-900 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2B589A]" placeholder="E-mail" value={u.email} onChange={e => updateUser(u.id, { email: e.target.value })} />
                  <input className="p-2.5 bg-white text-slate-900 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2B589A]" placeholder="Fone" value={u.phone} onChange={e => updateUser(u.id, { phone: e.target.value })} />
                  <input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" className="p-2.5 bg-white text-slate-900 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2B589A]" placeholder="Nova senha (opcional)" value={pendingUserPwd[u.id] ?? ''} onChange={e => setPendingUserPwd(p => ({ ...p, [u.id]: e.target.value }))} onBlur={() => commitUserPwd(u.id)} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select className="p-2.5 bg-white text-slate-900 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2B589A]" value={u.role} onChange={e => updateUser(u.id, { role: e.target.value as 'admin' | 'analyst' })}>
                    <option value="admin">Administrador</option>
                    <option value="analyst">Analista</option>
                  </select>
                  <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
          {accessUsers.length === 0 && (
            <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nenhum usuário cadastrado</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50/70 border border-amber-100 rounded-xl p-3">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>Os campos de senha nunca mostram o valor salvo (o Supabase Auth não devolve senhas) — deixe em branco para manter a atual, ou digite uma nova para substituí-la.</span>
        </div>
      </div>
    </div>
  );
};

export default Users;
