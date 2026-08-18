
import React, { useState, useMemo } from 'react';
import { CalendarClock, Users, AlertTriangle, ShieldCheck, ArrowUpCircle, ArrowDownCircle, Landmark, Info } from 'lucide-react';
import { AppData, TransactionType, TransactionNature, NATURE_ORDER, NATURE_META } from '../types';
import { formatCurrency, IRRF_LUCROS_THRESHOLD, IRRF_LUCROS_RATE } from '../dataService';

interface FechamentoProps {
  data: AppData;
}

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const Fechamento: React.FC<FechamentoProps> = ({ data }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const closing = useMemo(() => {
    // Lançamentos do período (mês/ano de competência).
    const periodTx = data.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const rows = data.partners.map(partner => {
      const txs = periodTx.filter(t => t.partnerId === partner.id);

      // Total por natureza.
      const byNature: Record<string, number> = {};
      NATURE_ORDER.forEach(n => { byNature[n] = 0; });
      txs.forEach(t => {
        if (t.nature && byNature[t.nature] !== undefined) byNature[t.nature] += t.value;
      });

      const totalEntradas = NATURE_ORDER
        .filter(n => NATURE_META[n].type === TransactionType.CREDIT)
        .reduce((s, n) => s + byNature[n], 0);
      const totalSaidas = NATURE_ORDER
        .filter(n => NATURE_META[n].type === TransactionType.DEBIT)
        .reduce((s, n) => s + byNature[n], 0);

      const lucros = byNature[TransactionNature.RETIRADA_LUCROS] || 0;
      const irrf = lucros > IRRF_LUCROS_THRESHOLD ? lucros * IRRF_LUCROS_RATE : 0;

      return { partner, byNature, totalEntradas, totalSaidas, lucros, irrf, hasMovement: txs.length > 0 };
    }).filter(r => r.hasMovement);

    const totalLucros = rows.reduce((s, r) => s + r.lucros, 0);
    const totalIrrf = rows.reduce((s, r) => s + r.irrf, 0);

    return { rows, totalLucros, totalIrrf };
  }, [data, selectedMonth, selectedYear]);

  return (
    <div className="space-y-8 pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Fechamento Mensal por Sócio</h2>
          <p className="text-slate-500 font-medium tracking-tight">Saldos por natureza e previsão de IRRF sobre distribuição de lucros</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-[#2B589A] rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 shrink-0">
          <CalendarClock size={14} />
          Competência {months[selectedMonth]}/{selectedYear}
        </div>
      </div>

      {/* Nota IRRF */}
      <div className="bg-amber-50/60 border-l-4 border-amber-400 p-5 rounded-r-2xl shadow-sm">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 font-semibold leading-relaxed">
            <span className="uppercase tracking-[0.2em] text-[10px] block mb-1 opacity-70">Previsão de IRRF sobre Lucros</span>
            Quando o total de <strong>Retirada de Lucros</strong> de um sócio no mês ultrapassa {formatCurrency(IRRF_LUCROS_THRESHOLD)},
            aplica-se a alíquota de <strong>{(IRRF_LUCROS_RATE * 100).toFixed(0)}%</strong> sobre o total retirado a título de lucros.
            Valor meramente indicativo para conferência contábil.
          </p>
        </div>
      </div>

      {/* Seletor de período + resumo IRRF */}
      <div className="bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-6 items-end">
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Período de Competência</label>
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
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 min-w-[200px] p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center sm:text-left">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lucros Distribuídos no Mês</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatCurrency(closing.totalLucros)}</div>
        </div>
        <div className={`flex-1 min-w-[200px] p-5 rounded-2xl text-center sm:text-left border ${closing.totalIrrf > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${closing.totalIrrf > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>IRRF Previsto Total</div>
          <div className={`text-2xl font-black tracking-tight ${closing.totalIrrf > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(closing.totalIrrf)}</div>
        </div>
      </div>

      {/* Cards por sócio */}
      {closing.rows.length > 0 ? (
        <div className="space-y-6">
          {closing.rows.map(({ partner, byNature, totalEntradas, totalSaidas, lucros, irrf }) => (
            <div key={partner.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              {/* Cabeçalho do sócio */}
              <div className="p-6 lg:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#2B589A] flex items-center justify-center text-white font-black shadow-md shadow-[#2B589A]/20">
                    {partner.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">{partner.name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">CPF {partner.cpf || '—'}</p>
                  </div>
                </div>
                {irrf > 0 ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100">
                    <AlertTriangle size={14} /> IRRF {formatCurrency(irrf)}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    <ShieldCheck size={14} /> Sem IRRF
                  </div>
                )}
              </div>

              {/* Saldos por natureza */}
              <div className="p-6 lg:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {NATURE_ORDER.filter(n => byNature[n] > 0).map(n => {
                  const isCredit = NATURE_META[n].type === TransactionType.CREDIT;
                  return (
                    <div key={n} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2 min-w-0">
                        {isCredit
                          ? <ArrowUpCircle size={16} className="text-emerald-500 shrink-0" />
                          : <ArrowDownCircle size={16} className="text-rose-500 shrink-0" />}
                        <span className="text-[11px] font-bold text-slate-500 truncate">{NATURE_META[n].label}</span>
                      </div>
                      <span className={`text-sm font-black tracking-tight whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {isCredit ? '+' : '-'} {formatCurrency(byNature[n])}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Rodapé: totais e IRRF */}
              <div className="px-6 lg:px-8 pb-6 lg:pb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Entradas</div>
                  <div className="text-xl font-black text-emerald-600 tracking-tight">+ {formatCurrency(totalEntradas)}</div>
                </div>
                <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-100">
                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Saídas</div>
                  <div className="text-xl font-black text-rose-500 tracking-tight">- {formatCurrency(totalSaidas)}</div>
                </div>
                <div className={`p-5 rounded-2xl border ${irrf > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-1 text-[#2B589A]">
                    <Landmark size={12} /> Retirada de Lucros
                  </div>
                  <div className="text-xl font-black text-slate-800 tracking-tight">{formatCurrency(lucros)}</div>
                  {irrf > 0 ? (
                    <div className="mt-1 text-[11px] font-bold text-rose-600">
                      IRRF ({(IRRF_LUCROS_RATE * 100).toFixed(0)}%): {formatCurrency(irrf)}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] font-semibold text-slate-400">
                      Isento — abaixo de {formatCurrency(IRRF_LUCROS_THRESHOLD)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] py-32 text-center flex flex-col items-center max-w-4xl mx-auto shadow-sm">
          <div className="w-24 h-24 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-6 text-slate-200 border border-slate-100">
            <Users size={48} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Sem movimentações no período</h3>
          <p className="text-slate-400 font-medium max-w-md mt-2">Nenhum sócio teve lançamentos em {months[selectedMonth]}/{selectedYear}. Ajuste o período ou registre movimentações.</p>
        </div>
      )}
    </div>
  );
};

export default Fechamento;
