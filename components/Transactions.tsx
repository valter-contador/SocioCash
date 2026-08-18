
import React, { useState, useMemo } from 'react';
import { Plus, Filter, Search, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, Calendar, X, CreditCard, ChevronRight, UserPlus } from 'lucide-react';
import { AppData, Transaction, TransactionType, TransactionNature, NATURE_META, NATURE_ORDER, BankAccount, AccountType } from '../types';
import { formatCurrency, formatDateBR } from '../dataService';
import CurrencyInput from './CurrencyInput';

interface TransactionsProps {
  data: AppData;
  onUpdate: (data: AppData) => void;
}

const Transactions: React.FC<TransactionsProps> = ({ data, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    companyId: '',
    partnerId: '',
    nature: ''
  });

  const emptyForm = {
    date: new Date().toISOString().split('T')[0],
    partnerId: '',
    companyAccountId: '',   // conta corrente da empresa (deriva a empresa)
    partnerAccountId: '',   // conta corrente do sócio (opcional — não é crítica para a contabilidade)
    value: 0,
    type: TransactionType.CREDIT,
    nature: TransactionNature.APORTE_CAPITAL,
    description: ''
  };
  const [formData, setFormData] = useState(emptyForm);

  // Popup de cadastro rápido de conta do sócio, aberto a partir do próprio lançamento.
  const [isAddingSocioAccount, setIsAddingSocioAccount] = useState(false);
  const [socioAccForm, setSocioAccForm] = useState({ bankName: '', agency: '', accountNumber: '', type: AccountType.CHECKING });

  const filteredTransactions = useMemo(() => {
    return data.transactions
      .filter(t => !filters.companyId || t.companyId === filters.companyId)
      .filter(t => !filters.partnerId || t.partnerId === filters.partnerId)
      .filter(t => !filters.nature || t.nature === filters.nature)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.transactions, filters]);

  const closeModal = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const companyAccount = data.bankAccounts.find(a => a.id === formData.companyAccountId);
    // A conta do sócio NÃO é obrigatória: não é informação crítica para a
    // contabilidade e não deve travar a confirmação do lançamento.
    if (!formData.partnerId || !companyAccount || !formData.value || formData.value <= 0) {
      alert('Selecione o sócio, a conta corrente da empresa e um valor válido.');
      return;
    }

    // A empresa é derivada da conta corrente da empresa selecionada.
    const companyId = companyAccount.ownerId;
    // Direção contábil define quem é origem/destino:
    // Entrada (CREDIT): sócio -> empresa | Saída (DEBIT): empresa -> sócio
    const isCredit = formData.type === TransactionType.CREDIT;
    const originAccountId = isCredit ? formData.partnerAccountId : formData.companyAccountId;
    const destinationAccountId = isCredit ? formData.companyAccountId : formData.partnerAccountId;

    const txData = {
      date: formData.date,
      companyId,
      partnerId: formData.partnerId,
      originAccountId,
      destinationAccountId,
      value: formData.value,
      type: formData.type,
      nature: formData.nature,
      description: formData.description || ''
    };

    if (editingId) {
      onUpdate({
        ...data,
        transactions: data.transactions.map(t => t.id === editingId ? { ...t, ...txData } : t)
      });
    } else {
      const newTx: Transaction = { id: crypto.randomUUID(), ...txData };
      onUpdate({ ...data, transactions: [...data.transactions, newTx] });
    }
    closeModal();
  };

  const handleEditClick = (tx: Transaction) => {
    const isCredit = tx.type === TransactionType.CREDIT;
    setFormData({
      date: tx.date,
      partnerId: tx.partnerId || '',
      companyAccountId: isCredit ? tx.destinationAccountId : tx.originAccountId,
      partnerAccountId: isCredit ? tx.originAccountId : tx.destinationAccountId,
      value: tx.value,
      type: tx.type,
      nature: tx.nature || TransactionNature.APORTE_CAPITAL,
      description: tx.description || ''
    });
    setEditingId(tx.id);
    setIsAdding(true);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Excluir esta movimentação?')) {
      onUpdate({
        ...data,
        transactions: data.transactions.filter(t => t.id !== id)
      });
    }
  };

  const handleAddSocioAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partnerId) return;
    const newAcc: BankAccount = {
      id: crypto.randomUUID(),
      ownerId: formData.partnerId,
      ownerType: 'PARTNER',
      ...socioAccForm
    };
    onUpdate({ ...data, bankAccounts: [...data.bankAccounts, newAcc] });
    setFormData(prev => ({ ...prev, partnerAccountId: newAcc.id }));
    setSocioAccForm({ bankName: '', agency: '', accountNumber: '', type: AccountType.CHECKING });
    setIsAddingSocioAccount(false);
  };

  // Contas correntes das empresas (todas) — a empresa é derivada da conta escolhida.
  const empresaAccounts = useMemo(
    () => data.bankAccounts.filter(acc => acc.ownerType === 'COMPANY'),
    [data.bankAccounts]
  );

  // Contas correntes do sócio selecionado.
  const socioAccounts = useMemo(
    () => data.bankAccounts.filter(acc => acc.ownerType === 'PARTNER' && acc.ownerId === formData.partnerId),
    [data.bankAccounts, formData.partnerId]
  );

  const companyNameOf = (companyId: string) =>
    data.companies.find(c => c.id === companyId)?.nomeFantasia || 'Empresa';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Movimentações</h2>
          <p className="text-sm text-slate-500 font-medium">Histórico auditável de fluxos societários</p>
        </div>
        <button
          onClick={() => { closeModal(); setIsAdding(true); }}
          className="w-full sm:w-auto bg-[#2B589A] hover:bg-[#1E3F6D] text-white px-8 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#2B589A]/20 transition-all font-black tracking-tight"
        >
          <Plus size={20} />
          Novo Lançamento
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtro Empresa</label>
          <select 
            className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold"
            value={filters.companyId}
            onChange={e => setFilters({...filters, companyId: e.target.value})}
          >
            <option value="">Todas as Entidades</option>
            {data.companies.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtro Sócio</label>
          <select 
            className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold"
            value={filters.partnerId}
            onChange={e => setFilters({...filters, partnerId: e.target.value})}
          >
            <option value="">Todos os Sócios</option>
            {data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="min-w-[140px] space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Natureza</label>
          <select
            className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold"
            value={filters.nature}
            onChange={e => setFilters({...filters, nature: e.target.value})}
          >
            <option value="">Todas</option>
            {NATURE_ORDER.map(n => (
              <option key={n} value={n}>{NATURE_META[n].label}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => setFilters({ companyId: '', partnerId: '', nature: '' })}
          className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-200 rounded-2xl transition-all"
          title="Resetar Filtros"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-8 py-5">Data Execução</th>
                <th className="px-8 py-5">Natureza</th>
                <th className="px-8 py-5">Entidade / Sócio</th>
                <th className="px-8 py-5">Histórico</th>
                <th className="px-8 py-5 text-right">Valor Final</th>
                <th className="px-8 py-5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTransactions.map(tx => {
                const comp = data.companies.find(c => c.id === tx.companyId);
                const part = data.partners.find(p => p.id === tx.partnerId);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6 text-xs font-bold text-slate-500 whitespace-nowrap">
                      {formatDateBR(tx.date)}
                    </td>
                    <td className="px-8 py-6">
                      <div className={`flex items-center gap-2 text-[10px] font-black px-3 py-1.5 rounded-full w-fit uppercase tracking-widest ${
                        tx.type === TransactionType.CREDIT ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                      }`}>
                        {tx.type === TransactionType.CREDIT ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                        {tx.nature ? NATURE_META[tx.nature].label : (tx.type === TransactionType.CREDIT ? 'Aporte' : 'Débito')}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-800">{comp?.nomeFantasia}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{part?.name || 'Vínculo Externo'}</div>
                    </td>
                    <td className="px-8 py-6 text-sm text-slate-500 max-w-[250px] truncate italic font-medium">
                      {tx.description || '--'}
                    </td>
                    <td className={`px-8 py-6 text-lg font-black text-right whitespace-nowrap tracking-tight ${
                       tx.type === TransactionType.CREDIT ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                      {tx.type === TransactionType.CREDIT ? '+' : '-'} {formatCurrency(tx.value)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => handleEditClick(tx)}
                          className="p-2 text-slate-300 hover:text-[#2B589A] hover:bg-[#2B589A]/5 rounded-xl transition-all"
                          title="Reabrir para edição"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                        <CreditCard size={32} className="text-slate-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-800 font-black tracking-tight text-lg">Sem movimentações</p>
                        <p className="text-slate-400 text-sm font-medium">Os registros aparecerão aqui após o primeiro lançamento.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lançamento */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-lg flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{editingId ? 'Editar Lançamento' : 'Registo de Fluxo'}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse"></div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Protocolo de Capital JC Buarque</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-3 text-slate-300 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={28} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Competência *</label>
                    <input 
                      required 
                      type="date" 
                      className="w-full p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold" 
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Natureza Operacional *</label>
                    <select
                      className="w-full p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold"
                      value={formData.nature}
                      onChange={e => {
                        const nature = e.target.value as TransactionNature;
                        setFormData({
                          ...formData,
                          nature,
                          type: NATURE_META[nature].type
                        });
                      }}
                    >
                      {NATURE_ORDER.map(n => (
                        <option key={n} value={n}>{NATURE_META[n].label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sócio(a) *</label>
                    <select
                      required
                      className="w-full p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold"
                      value={formData.partnerId}
                      onChange={e => { setFormData({...formData, partnerId: e.target.value, partnerAccountId: ''}); setIsAddingSocioAccount(false); }}
                    >
                      <option value="">Selecionar sócio(a)...</option>
                      {data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conta Corrente (Empresa) *</label>
                    <select
                      required
                      className="w-full p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold"
                      value={formData.companyAccountId}
                      onChange={e => setFormData({...formData, companyAccountId: e.target.value})}
                    >
                      <option value="">Vincular conta da empresa...</option>
                      {empresaAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{companyNameOf(acc.ownerId)} · {acc.bankName} ({acc.accountNumber})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conta Corrente (Sócio)</label>
                    <div className="flex gap-2">
                      <select
                        disabled={!formData.partnerId}
                        className="flex-1 min-w-0 p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-[#2B589A] transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        value={formData.partnerAccountId}
                        onChange={e => setFormData({...formData, partnerAccountId: e.target.value})}
                      >
                        <option value="">{formData.partnerId ? 'Não informar / vincular conta...' : 'Selecione o sócio primeiro'}</option>
                        {socioAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.bankName} ({acc.accountNumber})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!formData.partnerId}
                        onClick={() => setIsAddingSocioAccount(true)}
                        title="Cadastrar nova conta do sócio"
                        className="shrink-0 w-14 flex items-center justify-center bg-[#2B589A]/5 text-[#2B589A] border border-[#2B589A]/15 rounded-[1.25rem] hover:bg-[#2B589A]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <UserPlus size={20} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium ml-1">Opcional — não bloqueia o lançamento se o sócio ainda não tiver conta cadastrada.</p>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <label className="block text-[10px] font-black text-[#2B589A] uppercase tracking-[0.2em] ml-1">Valor da Operação (BRL) *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                        <span className="text-2xl font-black text-slate-300 group-focus-within:text-[#2B589A] transition-colors">R$</span>
                      </div>
                      <CurrencyInput
                        required
                        className="w-full pl-20 p-6 bg-[#2B589A]/5 text-[#2B589A] border-2 border-[#2B589A]/10 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-[#2B589A]/10 focus:border-[#2B589A] font-black text-3xl transition-all placeholder:text-slate-300"
                        value={formData.value}
                        onChange={v => setFormData({...formData, value: v})}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações Contábeis</label>
                    <textarea 
                      rows={4} 
                      placeholder="Descreva a finalidade desta movimentação para fins de conciliação..."
                      className="w-full p-6 bg-slate-50 text-slate-900 border border-slate-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-[#2B589A] transition-all resize-none font-medium placeholder:text-slate-300" 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:flex-1 py-5 text-slate-400 font-bold hover:bg-slate-50 hover:text-slate-600 rounded-2xl transition-all order-2 sm:order-1"
                >
                  Desistir
                </button>
                <button
                  type="submit"
                  className="w-full sm:flex-1 py-5 bg-[#2B589A] text-white font-black rounded-2xl hover:bg-[#1E3F6D] shadow-2xl shadow-[#2B589A]/30 active:scale-95 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
                >
                  {editingId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                  <ChevronRight size={20} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup: Nova Conta do Sócio (cadastro rápido a partir do lançamento) */}
      {isAddingSocioAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Nova Conta do Sócio</h3>
              <button onClick={() => setIsAddingSocioAccount(false)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSocioAccount} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Banco *</label>
                <input required type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={socioAccForm.bankName} onChange={e => setSocioAccForm({...socioAccForm, bankName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Agência</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={socioAccForm.agency} onChange={e => setSocioAccForm({...socioAccForm, agency: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Conta *</label>
                  <input required type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={socioAccForm.accountNumber} onChange={e => setSocioAccForm({...socioAccForm, accountNumber: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Modalidade</label>
                <select className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none" value={socioAccForm.type} onChange={e => setSocioAccForm({...socioAccForm, type: e.target.value as AccountType})}>
                  <option value={AccountType.CHECKING}>Corrente</option>
                  <option value={AccountType.SAVINGS}>Poupança</option>
                  <option value={AccountType.INVESTMENT}>Investimento</option>
                  <option value={AccountType.OTHER}>Outra</option>
                </select>
              </div>
              <div className="flex flex-col gap-3 pt-6">
                <button type="submit" className="w-full py-4 bg-[#2B589A] text-white rounded-2xl hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 font-black tracking-tight">Vincular Conta</button>
                <button type="button" onClick={() => setIsAddingSocioAccount(false)} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
