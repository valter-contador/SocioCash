
import React, { useState } from 'react';
import { Plus, Trash2, Building2, Landmark, X, KeyRound, Eye, EyeOff, ShieldAlert, UserCog } from 'lucide-react';
import { AppData, Company, BankAccount, AccountType, Role, AccessUser } from '../types';

interface CompaniesProps {
  data: AppData;
  onUpdate: (data: AppData) => void;
  role?: Role;
}

const Companies: React.FC<CompaniesProps> = ({ data, onUpdate, role }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const [formData, setFormData] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    tipo: 'LTDA',
    clientPassword: '',
    endereco: '',
    foroComarca: ''
  });

  const access = data.access || {};
  const accessUsers = access.users || [];
  const updateCompany = (id: string, patch: Partial<Company>) => {
    onUpdate({ ...data, companies: data.companies.map(c => c.id === id ? { ...c, ...patch } : c) });
  };

  // Campos de senha (empresa existente / usuário existente) não refletem valor salvo — o Supabase
  // Auth nunca devolve a senha. Por isso ficam com estado próprio ("nova senha") e só disparam a
  // troca de fato no blur, evitando salvar senha parcial a cada tecla digitada.
  const [pendingCompanyPwd, setPendingCompanyPwd] = useState<Record<string, string>>({});
  const [pendingUserPwd, setPendingUserPwd] = useState<Record<string, string>>({});
  const commitCompanyPwd = (id: string) => {
    const pwd = pendingCompanyPwd[id];
    if (pwd) updateCompany(id, { clientPassword: pwd });
    setPendingCompanyPwd(p => ({ ...p, [id]: '' }));
  };
  const commitUserPwd = (id: string) => {
    const pwd = pendingUserPwd[id];
    if (pwd) updateUser(id, { password: pwd });
    setPendingUserPwd(p => ({ ...p, [id]: '' }));
  };

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    cpf: '',
    email: '',
    phone: '',
    role: 'analyst' as 'admin' | 'analyst',
    password: ''
  });

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

  const [accFormData, setAccFormData] = useState({
    bankName: '',
    agency: '',
    accountNumber: '',
    type: AccountType.CHECKING
  });

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const newCompany: Company = {
      id: crypto.randomUUID(),
      ...formData
    };
    onUpdate({
      ...data,
      companies: [...data.companies, newCompany]
    });
    setFormData({ razaoSocial: '', nomeFantasia: '', cnpj: '', tipo: 'LTDA', clientPassword: '', endereco: '', foroComarca: '' });
    setIsAdding(false);
  };

  const handleDeleteCompany = (id: string) => {
    if (confirm('Deseja excluir esta empresa?')) {
      onUpdate({
        ...data,
        companies: data.companies.filter(c => c.id !== id)
      });
    }
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingAccount) return;
    
    const newAcc: BankAccount = {
      id: crypto.randomUUID(),
      ownerId: isAddingAccount,
      ownerType: 'COMPANY',
      ...accFormData
    };
    onUpdate({
      ...data,
      bankAccounts: [...data.bankAccounts, newAcc]
    });
    setAccFormData({ bankName: '', agency: '', accountNumber: '', type: AccountType.CHECKING });
    setIsAddingAccount(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Cadastre suas Empresas</h2>
          <p className="text-slate-500 font-medium">Gestão de empresas no ecossistema JC Buarque</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto bg-[#2B589A] hover:bg-[#1E3F6D] text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#2B589A]/20 font-bold"
        >
          <Plus size={20} />
          Registrar Empresa
        </button>
      </div>

      {/* Controle de Acesso — cadastro de Administradores e Analistas (login por CPF) — só administrador */}
      {role === 'admin' && (
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
      )}

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-[#2B589A]/10 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">Nova Empresa</h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
          </div>
          <form onSubmit={handleAddCompany} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Razão Social *</label>
              <input 
                required
                type="text" 
                className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] focus:border-transparent outline-none transition-all"
                value={formData.razaoSocial}
                onChange={e => setFormData({...formData, razaoSocial: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Fantasia *</label>
              <input 
                required
                type="text" 
                className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] focus:border-transparent outline-none transition-all"
                value={formData.nomeFantasia}
                onChange={e => setFormData({...formData, nomeFantasia: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">CNPJ *</label>
              <input 
                required
                type="text" 
                placeholder="00.000.000/0000-00"
                className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] focus:border-transparent outline-none transition-all font-mono"
                value={formData.cnpj}
                onChange={e => setFormData({...formData, cnpj: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo Jurídico</label>
              <select 
                className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] focus:border-transparent outline-none transition-all"
                value={formData.tipo}
                onChange={e => setFormData({...formData, tipo: e.target.value})}
              >
                <option value="LTDA">LTDA</option>
                <option value="SLU">SLU</option>
                <option value="MEI">MEI</option>
                <option value="S/A">S/A</option>
                <option value="OUTRA">Outra</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Endereço (para o contrato de mútuo)</label>
              <input
                type="text"
                placeholder="Rua, nº, bairro, cidade/UF, CEP"
                className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] focus:border-transparent outline-none transition-all"
                value={formData.endereco}
                onChange={e => setFormData({...formData, endereco: e.target.value})}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Comarca do Foro</label>
              <input
                type="text"
                placeholder="Ex.: Recife/PE"
                className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] focus:border-transparent outline-none transition-all"
                value={formData.foroComarca}
                onChange={e => setFormData({...formData, foroComarca: e.target.value})}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><KeyRound size={12} className="text-[#2B589A]" /> Senha de Acesso do Cliente</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Senha que o cliente usará para acessar"
                className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] focus:border-transparent outline-none transition-all"
                value={formData.clientPassword}
                onChange={e => setFormData({...formData, clientPassword: e.target.value})}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-10 py-3 bg-[#2B589A] text-white rounded-2xl hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 font-bold"
              >
                Salvar Empresa
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {data.companies.map(company => (
          <div key={company.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-shadow border-t-4 border-t-[#2B589A]">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[#2B589A] shadow-inner">
                  <Building2 size={24} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleDeleteCompany(company.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">{company.nomeFantasia}</h3>
              <p className="text-sm font-medium text-slate-400 mb-6">{company.razaoSocial}</p>
              
              <div className="flex gap-3 mb-6">
                <span className="text-[10px] font-bold px-3 py-1 bg-slate-100 text-slate-500 rounded-full tracking-wider font-mono">{company.cnpj}</span>
                <span className="text-[10px] font-bold px-3 py-1 bg-[#2B589A]/10 text-[#2B589A] rounded-full uppercase tracking-widest">{company.tipo}</span>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                    <Landmark size={14} className="text-[#2B589A]" />
                    Contas de Movimentação
                  </h4>
                  <button 
                    onClick={() => setIsAddingAccount(company.id)}
                    className="text-[10px] font-black text-[#2B589A] bg-[#2B589A]/5 px-3 py-1.5 rounded-full hover:bg-[#2B589A]/10 transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>

                <div className="space-y-3">
                  {data.bankAccounts.filter(acc => acc.ownerId === company.id).map(acc => (
                    <div key={acc.id} className="flex justify-between items-center p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
                      <div>
                        <span className="font-black text-slate-700 text-xs block">{acc.bankName}</span>
                        <span className="text-[10px] font-mono text-slate-400">Ag: {acc.agency} | CC: {acc.accountNumber}</span>
                      </div>
                      <span className="text-[10px] font-black text-[#2B589A] uppercase tracking-widest bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-sm">{acc.type}</span>
                    </div>
                  ))}
                  {data.bankAccounts.filter(acc => acc.ownerId === company.id).length === 0 && (
                    <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aguardando dados bancários</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dados para o contrato de mútuo */}
              <div className="border-t border-slate-100 pt-6 mt-6 space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em]">Dados para Contrato</h4>
                <input
                  type="text"
                  placeholder="Endereço (rua, nº, cidade/UF, CEP)"
                  className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none text-sm"
                  value={company.endereco || ''}
                  onChange={e => updateCompany(company.id, { endereco: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Comarca do foro (ex.: Recife/PE)"
                  className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none text-sm"
                  value={company.foroComarca || ''}
                  onChange={e => updateCompany(company.id, { foroComarca: e.target.value })}
                />
              </div>

              {/* Senha de acesso do cliente (por empresa) */}
              <div className="border-t border-slate-100 pt-6 mt-6">
                <label className="text-xs font-black text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                  <KeyRound size={14} className="text-[#2B589A]" />
                  Senha de Acesso do Cliente
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Nova senha (deixe em branco para manter a atual)"
                  className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none transition-all"
                  value={pendingCompanyPwd[company.id] ?? ''}
                  onChange={e => setPendingCompanyPwd(p => ({ ...p, [company.id]: e.target.value }))}
                  onBlur={() => commitCompanyPwd(company.id)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {isAddingAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Nova Conta Bancária</h3>
                <button onClick={() => setIsAddingAccount(null)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Instituição Financeira *</label>
                <input required type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={accFormData.bankName} onChange={e => setAccFormData({...accFormData, bankName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Agência</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={accFormData.agency} onChange={e => setAccFormData({...accFormData, agency: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Conta *</label>
                  <input required type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={accFormData.accountNumber} onChange={e => setAccFormData({...accFormData, accountNumber: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Modalidade</label>
                <select className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={accFormData.type} onChange={e => setAccFormData({...accFormData, type: e.target.value as AccountType})}>
                  <option value={AccountType.CHECKING}>Corrente</option>
                  <option value={AccountType.SAVINGS}>Poupança</option>
                  <option value={AccountType.INVESTMENT}>Investimento</option>
                  <option value={AccountType.OTHER}>Outra</option>
                </select>
              </div>
              <div className="flex flex-col gap-3 pt-6">
                <button type="submit" className="w-full py-4 bg-[#2B589A] text-white rounded-2xl hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 font-black tracking-tight">Vincular Conta</button>
                <button type="button" onClick={() => setIsAddingAccount(null)} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">Desistir</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
