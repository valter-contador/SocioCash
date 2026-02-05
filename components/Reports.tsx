
import React, { useState, useMemo } from 'react';
import { FileText, Download, Filter, Building2, Calendar, ChevronDown, ChevronUp, CheckCircle2, Info } from 'lucide-react';
import { AppData, TransactionType } from '../types';
import { formatCurrency } from '../dataService';

interface ReportsProps {
  data: AppData;
}

const Reports: React.FC<ReportsProps> = ({ data }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const reportData = useMemo(() => {
    if (!selectedCompanyId) return null;

    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);

    const initialTransactions = data.transactions.filter(t => {
      const d = new Date(t.date);
      return t.companyId === selectedCompanyId && d.getTime() < startDate.getTime();
    });

    const initialBalance = initialTransactions.reduce((acc, t) => {
      return t.type === TransactionType.CREDIT ? acc + t.value : acc - t.value;
    }, 0);

    const monthTransactions = data.transactions.filter(t => {
      const d = new Date(t.date);
      return t.companyId === selectedCompanyId && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const totalCredits = monthTransactions
      .filter(t => t.type === TransactionType.CREDIT)
      .reduce((sum, t) => sum + t.value, 0);

    const totalDebits = monthTransactions
      .filter(t => t.type === TransactionType.DEBIT)
      .reduce((sum, t) => sum + t.value, 0);

    return {
      initialBalance,
      totalCredits,
      totalDebits,
      finalBalance: initialBalance + totalCredits - totalDebits,
      transactions: monthTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    };
  }, [data, selectedCompanyId, selectedMonth, selectedYear]);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Fechamento Mensal</h2>
            <p className="text-slate-500 font-medium tracking-tight">Relatório Consolidado para escrituração na JCBuarque Contabilidade</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 shrink-0">
             <CheckCircle2 size={14} />
             Sistema em Conformidade
          </div>
        </div>

        {/* Observação de Escrituração */}
        <div className="bg-indigo-50/50 border-l-4 border-[#2B589A] p-5 rounded-r-2xl shadow-sm">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-[#2B589A] mt-0.5 shrink-0" />
            <p className="text-sm text-[#2B589A] font-semibold leading-relaxed">
              <span className="uppercase tracking-[0.2em] text-[10px] block mb-1 opacity-70">Nota de Escrituração</span>
              Será gerado um relatório para escrituração na contabilidade contendo a movimentação detalhada e os saldos inicial e final consolidados.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[280px] space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Entidade Selecionada</label>
          <select 
            className="w-full p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2B589A] font-bold transition-all"
            value={selectedCompanyId}
            onChange={e => setSelectedCompanyId(e.target.value)}
          >
            <option value="">Buscar empresa...</option>
            {data.companies.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
          </select>
        </div>
        <div className="w-full sm:w-auto space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Período Fiscal</label>
          <div className="flex gap-3">
              <select 
                className="p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2B589A] font-bold min-w-[150px] transition-all"
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
              >
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select 
                className="p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2B589A] font-bold min-w-[100px] transition-all"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
          </div>
        </div>
        <button 
          onClick={() => window.print()}
          className="w-full lg:w-auto bg-[#2B589A] hover:bg-[#1E3F6D] text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#2B589A]/20 disabled:opacity-30 transition-all font-black tracking-tight"
          disabled={!selectedCompanyId}
        >
          <Download size={20} />
          Exportar PDF
        </button>
      </div>

      {reportData ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-[1.25rem] bg-[#2B589A] flex items-center justify-center text-white shadow-xl shadow-[#2B589A]/20">
                <FileText size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Demonstrativo de Capital</h3>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
                  Competência: {months[selectedMonth]} {selectedYear} • {data.companies.find(c => c.id === selectedCompanyId)?.razaoSocial}
                </p>
              </div>
            </div>
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm text-center min-w-[220px] border-b-8 border-b-[#2B589A]">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Saldo em Fechamento</div>
              <div className={`text-2xl font-black tracking-tight ${reportData.finalBalance >= 0 ? 'text-[#2B589A]' : 'text-rose-500'}`}>
                {formatCurrency(reportData.finalBalance)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100">
            <div className="p-10 text-center md:text-left">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Transporte Mês Anterior</div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">{formatCurrency(reportData.initialBalance)}</div>
            </div>
            <div className="p-10 text-center md:text-left">
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Fluxo de Entrada (+)</div>
              <div className="text-2xl font-black text-emerald-600 tracking-tight">+{formatCurrency(reportData.totalCredits)}</div>
            </div>
            <div className="p-10 text-center md:text-left">
              <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Fluxo de Saída (-)</div>
              <div className="text-2xl font-black text-rose-500 tracking-tight">-{formatCurrency(reportData.totalDebits)}</div>
            </div>
          </div>

          <div className="p-10">
            <div className="flex items-center justify-between mb-8">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-3">
                    <Calendar size={14} className="text-[#2B589A]" />
                    Cronologia de Lançamentos
                </h4>
                <div className="h-px bg-slate-100 flex-1 ml-6 hidden sm:block"></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="pb-5 px-4">Data Operação</th>
                    <th className="pb-5 px-4">Originário</th>
                    <th className="pb-5 px-4">Histórico / Documento</th>
                    <th className="pb-5 px-4 text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reportData.transactions.map(tx => (
                    <tr key={tx.id} className="text-sm group">
                      <td className="py-6 px-4 text-slate-500 font-bold">{new Date(tx.date).toLocaleDateString('pt-BR')}</td>
                      <td className="py-6 px-4 font-black text-slate-800">{data.partners.find(p => p.id === tx.partnerId)?.name || 'CAIXA DIRETO'}</td>
                      <td className="py-6 px-4 text-slate-500 font-medium italic group-hover:text-slate-800 transition-colors">"{tx.description || 'Sem observações'}"</td>
                      <td className={`py-6 px-4 text-right font-black tracking-tight ${tx.type === TransactionType.CREDIT ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {tx.type === TransactionType.CREDIT ? '+' : '-'} {formatCurrency(tx.value)}
                      </td>
                    </tr>
                  ))}
                  {reportData.transactions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3 grayscale opacity-30">
                            <FileText size={48} className="text-slate-200" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inexistência de registros no período</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
             <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Gerado por Sistema JC Buarque em {new Date().toLocaleString('pt-BR')}
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2B589A] uppercase tracking-widest">Autenticidade Garantida</span>
                <CheckCircle2 size={16} className="text-[#2B589A]" />
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] py-32 text-center flex flex-col items-center max-w-4xl mx-auto shadow-sm">
          <div className="w-24 h-24 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-6 text-slate-200 border border-slate-100">
            <Filter size={48} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Relatório Pronto para Emissão</h3>
          <p className="text-slate-400 font-medium max-w-md mt-2">Defina os parâmetros acima para processar os dados e gerar o demonstrativo contábil para escrituração.</p>
        </div>
      )}
    </div>
  );
};

export default Reports;
