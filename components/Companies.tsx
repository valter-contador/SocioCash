
import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Building2, Landmark, X } from 'lucide-react';
import { AppData, Company, BankAccount, AccountType } from '../types';

interface CompaniesProps {
  data: AppData;
  onUpdate: (data: AppData) => void;
}

const Companies: React.FC<CompaniesProps> = ({ data, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    tipo: 'LTDA'
  });

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
    setFormData({ razaoSocial: '', nomeFantasia: '', cnpj: '', tipo: 'LTDA' });
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
