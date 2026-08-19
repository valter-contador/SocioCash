
import React, { useState } from 'react';
import { Plus, Trash2, Users, Building, Landmark, Percent, X } from 'lucide-react';
import { AppData, Partner, BankAccount, AccountType } from '../types';

interface PartnersProps {
  data: AppData;
  onUpdate: (data: AppData) => void;
}

const Partners: React.FC<PartnersProps> = ({ data, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    participation: 0,
    companyIds: [] as string[],
    endereco: ''
  });

  const updatePartner = (id: string, patch: Partial<Partner>) => {
    onUpdate({ ...data, partners: data.partners.map(p => p.id === id ? { ...p, ...patch } : p) });
  };

  const [accFormData, setAccFormData] = useState({
    bankName: '',
    agency: '',
    accountNumber: '',
    type: AccountType.CHECKING
  });

  const handleAddPartner = (e: React.FormEvent) => {
    e.preventDefault();
    const newPartner: Partner = {
      id: crypto.randomUUID(),
      ...formData
    };
    onUpdate({
      ...data,
      partners: [...data.partners, newPartner]
    });
    setFormData({ name: '', cpf: '', participation: 0, companyIds: [], endereco: '' });
    setIsAdding(false);
  };

  const handleToggleCompanyLink = (companyId: string) => {
    const current = [...formData.companyIds];
    const index = current.indexOf(companyId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(companyId);
    }
    setFormData({...formData, companyIds: current});
  };

  // Vínculo de empresa editável também para sócio já cadastrado (antes só dava pra
  // definir na criação — sem isso não tinha como corrigir um sócio esquecido).
  const handleTogglePartnerCompanyLink = (partner: Partner, companyId: string) => {
    const current = partner.companyIds || [];
    const next = current.includes(companyId) ? current.filter(id => id !== companyId) : [...current, companyId];
    updatePartner(partner.id, { companyIds: next });
  };

  const handleDeletePartner = (id: string) => {
    if (confirm('Deseja excluir este sócio?')) {
      onUpdate({
        ...data,
        partners: data.partners.filter(p => p.id !== id)
      });
    }
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingAccount) return;
    
    const newAcc: BankAccount = {
      id: crypto.randomUUID(),
      ownerId: isAddingAccount,
      ownerType: 'PARTNER',
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
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Quadro Societário</h2>
          <p className="text-slate-500 font-medium">Gestão de sócios e participações na empresa</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto bg-[#2B589A] hover:bg-[#1E3F6D] text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#2B589A]/20 font-bold"
        >
          <Plus size={20} />
          Novo Sócio
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-[#2B589A]/10 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">Cadastrar Sócio</h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
          </div>
          <form onSubmit={handleAddPartner} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo *</label>
                <input required type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">CPF *</label>
                <input required type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Participação (%) *</label>
                <div className="relative">
                  <input 
                    required 
                    type="number" 
                    min="0" 
                    max="100" 
                    step="0.1" 
                    className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl pr-10 focus:ring-2 focus:ring-[#2B589A] outline-none" 
                    value={formData.participation} 
                    onChange={e => setFormData({...formData, participation: parseFloat(e.target.value) || 0})} 
                  />
                  <Percent size={14} className="absolute right-4 top-4 text-slate-400" />
                </div>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Endereço (para o contrato de mútuo)</label>
                <input type="text" placeholder="Rua, nº, bairro, cidade/UF, CEP" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={formData.endereco} onChange={e => setFormData({...formData, endereco: e.target.value})} />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Vincular a Empresas</label>
              <div className="flex flex-wrap gap-2">
                {data.companies.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    // Fix: c.id should be used instead of company.id which is not defined in this scope
                    onClick={() => handleToggleCompanyLink(c.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      formData.companyIds.includes(c.id) 
                        ? 'bg-[#2B589A] text-white border-[#2B589A] shadow-md shadow-[#2B589A]/20' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-[#2B589A]'
                    }`}
                  >
                    {c.nomeFantasia}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">Cancelar</button>
              <button type="submit" className="px-10 py-3 bg-[#2B589A] text-white rounded-2xl hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 font-bold">Salvar Sócio</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {data.partners.map(partner => (
          <div key={partner.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-shadow border-t-4 border-t-[#2B589A]">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-amber-600 shadow-inner">
                  <Users size={24} />
                </div>
                <button onClick={() => handleDeletePartner(partner.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">{partner.name}</h3>
              <p className="text-sm font-medium text-slate-400 mb-6">{partner.cpf}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Participação Quota</span>
                    <span className="text-sm font-black text-slate-800">{partner.participation}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-[#2B589A] h-full rounded-full transition-all duration-1000" style={{ width: `${partner.participation}%` }}></div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Vínculos Jurídicos</p>
                <div className="flex flex-wrap gap-2">
                  {data.companies.map(c => {
                    const linked = (partner.companyIds || []).includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleTogglePartnerCompanyLink(partner, c.id)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          linked
                            ? 'bg-[#2B589A] text-white border-[#2B589A]'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-[#2B589A]'
                        }`}
                      >
                        {c.nomeFantasia}
                      </button>
                    );
                  })}
                  {data.companies.length === 0 && <span className="text-[10px] text-slate-300 italic font-medium">Nenhuma empresa cadastrada</span>}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Endereço (contrato)</p>
                <input
                  type="text"
                  placeholder="Rua, nº, cidade/UF, CEP"
                  className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none text-sm"
                  value={partner.endereco || ''}
                  onChange={e => updatePartner(partner.id, { endereco: e.target.value })}
                />
              </div>
            </div>

            <div className="px-8 pb-8 mt-auto">
              <div className="border-t border-slate-100 pt-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                    <Landmark size={14} className="text-[#2B589A]" />
                    Contas Pessoais
                  </h4>
                  <button 
                    onClick={() => setIsAddingAccount(partner.id)}
                    className="text-[10px] font-black text-[#2B589A] bg-[#2B589A]/5 px-3 py-1.5 rounded-full hover:bg-[#2B589A]/10 transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                <div className="space-y-3">
                  {data.bankAccounts.filter(acc => acc.ownerId === partner.id).map(acc => (
                    <div key={acc.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
                      <div className="font-black text-slate-700 text-xs block">{acc.bankName}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">Ag: {acc.agency} | CC: {acc.accountNumber} ({acc.type})</div>
                    </div>
                  ))}
                  {data.bankAccounts.filter(acc => acc.ownerId === partner.id).length === 0 && (
                    <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                      <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Sem contas registradas</p>
                    </div>
                  )}
                </div>
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Banco *</label>
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
                <button type="button" onClick={() => setIsAddingAccount(null)} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Partners;
