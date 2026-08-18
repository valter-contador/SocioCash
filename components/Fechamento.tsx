
import React, { useState, useMemo } from 'react';
import { CalendarClock, Users, AlertTriangle, ShieldCheck, ArrowUpCircle, ArrowDownCircle, Landmark, Info, Building2, Filter } from 'lucide-react';
import { AppData, Transaction, TransactionType, TransactionNature, NATURE_ORDER, NATURE_META } from '../types';
import { formatCurrency, IRRF_LUCROS_THRESHOLD, IRRF_LUCROS_RATE } from '../dataService';

interface FechamentoProps {
  data: AppData;
}

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Datas são 'YYYY-MM-DD'. Interpretar via new Date(str) usa UTC e desloca o dia
// no fuso local; portanto parseamos a partir do texto para evitar erro de mês/dia.
const dateParts = (s: string) => {
  const [y, m, d] = (s || '').split('-').map(Number);
  return { y, m, d };
};
const fmtDate = (s: string) => {
  const { y, m, d } = dateParts(s);
  if (!y || !m || !d) return s;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

interface NatureGroup {
  nature: TransactionNature;
  txs: Transaction[];
  subtotal: number;
}

interface PartnerExtract {
  partnerId: string;
  partnerName: string;
  partnerCpf: string;
  groups: NatureGroup[];
  totalEntradas: number;
  totalSaidas: number;
  lucros: number;
  irrf: number;
}

const Fechamento: React.FC<FechamentoProps> = ({ data }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const closing = useMemo(() => {
    if (!selectedCompanyId) return null;

    // Lançamentos da empresa no período (mês/ano de competência) com sócio.
    const periodTx = data.transactions.filter(t => {
      const { y, m } = dateParts(t.date);
      return t.companyId === selectedCompanyId
        && !!t.partnerId
        && (m - 1) === selectedMonth
        && y === selectedYear;
    });

    // Agrupa por sócio.
    const byPartner = new Map<string, Transaction[]>();
    periodTx.forEach(t => {
      const list = byPartner.get(t.partnerId!) || [];
      list.push(t);
      byPartner.set(t.partnerId!, list);
    });

    const extracts: PartnerExtract[] = [...byPartner.entries()].map(([partnerId, txs]) => {
      const partner = data.partners.find(p => p.id === partnerId);

      // Lançamentos agrupados por natureza (com subtotal), na ordem canônica.
      const groups: NatureGroup[] = NATURE_ORDER.map(nature => {
        const natTxs = txs
          .filter(t => t.nature === nature)
          .sort((a, b) => a.date.localeCompare(b.date));
        const subtotal = natTxs.reduce((s, t) => s + t.value, 0);
        return { nature, txs: natTxs, subtotal };
      }).filter(g => g.txs.length > 0);

      const totalEntradas = groups
        .filter(g => NATURE_META[g.nature].type === TransactionType.CREDIT)
        .reduce((s, g) => s + g.subtotal, 0);
      const totalSaidas = groups
        .filter(g => NATURE_META[g.nature].type === TransactionType.DEBIT)
        .reduce((s, g) => s + g.subtotal, 0);

      // IRRF: total de Retirada de Lucros deste sócio NESTA empresa no mês.
      const lucrosGroup = groups.find(g => g.nature === TransactionNature.RETIRADA_LUCROS);
      const lucros = lucrosGroup ? lucrosGroup.subtotal : 0;
      const irrf = lucros > IRRF_LUCROS_THRESHOLD ? lucros * IRRF_LUCROS_RATE : 0;

      return {
        partnerId,
        partnerName: partner?.name || 'Sócio',
        partnerCpf: partner?.cpf || '',
        groups,
        totalEntradas,
        totalSaidas,
        lucros,
        irrf
      };
    }).sort((a, b) => a.partnerName.localeCompare(b.partnerName));

    const totalLucros = extracts.reduce((s, e) => s + e.lucros, 0);
    const totalIrrf = extracts.reduce((s, e) => s + e.irrf, 0);
    const totalEntradas = extracts.reduce((s, e) => s + e.totalEntradas, 0);
    const totalSaidas = extracts.reduce((s, e) => s + e.totalSaidas, 0);

    return { extracts, totalLucros, totalIrrf, totalEntradas, totalSaidas };
  }, [data, selectedCompanyId, selectedMonth, selectedYear]);

  const company = data.companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="space-y-8 pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Fechamento por Empresa</h2>
          <p className="text-slate-500 font-medium tracking-tight">Extrato individualizado por sócio, com lançamentos por natureza e revisão do IRRF</p>
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
            A apuração é por empresa e por sócio: somam-se as <strong>Retiradas de Lucros</strong> desta empresa para o mesmo sócio no mês.
            Se o total ultrapassar {formatCurrency(IRRF_LUCROS_THRESHOLD)}, a alíquota de <strong>{(IRRF_LUCROS_RATE * 100).toFixed(0)}%</strong> incide
            sobre <strong>todo</strong> o montante de lucros do período (não apenas o excedente). Valor indicativo para conferência contábil.
          </p>
        </div>
      </div>

      {/* Seletores */}
      <div className="bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[260px] space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Empresa</label>
          <select
            className="w-full p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2B589A] font-bold transition-all"
            value={selectedCompanyId}
            onChange={e => setSelectedCompanyId(e.target.value)}
          >
            <option value="">Selecionar empresa...</option>
            {data.companies.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
          </select>
        </div>
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
      </div>

      {!closing ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] py-32 text-center flex flex-col items-center max-w-4xl mx-auto shadow-sm">
          <div className="w-24 h-24 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-6 text-slate-200 border border-slate-100">
            <Filter size={48} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Selecione uma empresa</h3>
          <p className="text-slate-400 font-medium max-w-md mt-2">Escolha a empresa e o período para gerar o fechamento com o extrato de cada sócio.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumo da empresa */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#2B589A] flex items-center justify-center text-white shadow-md shadow-[#2B589A]/20">
                  <Building2 size={26} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">{company?.nomeFantasia}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">{company?.razaoSocial} · {months[selectedMonth]}/{selectedYear}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                  <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Entradas</div>
                  <div className="text-base font-black text-emerald-600 tracking-tight">{formatCurrency(closing.totalEntradas)}</div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                  <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Saídas</div>
                  <div className="text-base font-black text-rose-500 tracking-tight">{formatCurrency(closing.totalSaidas)}</div>
                </div>
                <div className={`p-4 rounded-2xl text-center border col-span-2 sm:col-span-1 ${closing.totalIrrf > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${closing.totalIrrf > 0 ? 'text-rose-400' : 'text-slate-400'}`}>IRRF Previsto</div>
                  <div className={`text-base font-black tracking-tight ${closing.totalIrrf > 0 ? 'text-rose-600' : 'text-slate-700'}`}>{formatCurrency(closing.totalIrrf)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Extratos por sócio */}
          {closing.extracts.length > 0 ? closing.extracts.map(ext => (
            <div key={ext.partnerId} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              {/* Cabeçalho do sócio */}
              <div className="p-6 lg:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#2B589A] flex items-center justify-center text-white font-black shadow-md shadow-[#2B589A]/20">
                    {ext.partnerName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">{ext.partnerName}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">CPF {ext.partnerCpf || '—'}</p>
                  </div>
                </div>
                {ext.irrf > 0 ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100">
                    <AlertTriangle size={14} /> IRRF {formatCurrency(ext.irrf)}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    <ShieldCheck size={14} /> Sem IRRF
                  </div>
                )}
              </div>

              {/* Extrato: lançamentos agrupados por natureza */}
              <div className="p-6 lg:p-8 space-y-6">
                {ext.groups.map(g => {
                  const isCredit = NATURE_META[g.nature].type === TransactionType.CREDIT;
                  return (
                    <div key={g.nature} className="border border-slate-100 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70">
                        <div className="flex items-center gap-2">
                          {isCredit
                            ? <ArrowUpCircle size={16} className="text-emerald-500" />
                            : <ArrowDownCircle size={16} className="text-rose-500" />}
                          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{NATURE_META[g.nature].label}</span>
                        </div>
                        <span className={`text-sm font-black tracking-tight ${isCredit ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {isCredit ? '+' : '-'} {formatCurrency(g.subtotal)}
                        </span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-50">
                          {g.txs.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 text-slate-500 font-bold whitespace-nowrap w-28">{fmtDate(t.date)}</td>
                              <td className="px-4 py-2.5 text-slate-500 italic font-medium">{t.description || 'Sem observações'}</td>
                              <td className={`px-4 py-2.5 text-right font-black whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {isCredit ? '+' : '-'} {formatCurrency(t.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              {/* Totais + Revisão do IRRF */}
              <div className="px-6 lg:px-8 pb-6 lg:pb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Entradas</div>
                  <div className="text-xl font-black text-emerald-600 tracking-tight">+ {formatCurrency(ext.totalEntradas)}</div>
                </div>
                <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-100">
                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Saídas</div>
                  <div className="text-xl font-black text-rose-500 tracking-tight">- {formatCurrency(ext.totalSaidas)}</div>
                </div>
                <div className={`p-5 rounded-2xl border ${ext.irrf > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-1 text-[#2B589A]">
                    <Landmark size={12} /> Revisão IRRF — Lucros
                  </div>
                  <div className="text-xl font-black text-slate-800 tracking-tight">{formatCurrency(ext.lucros)}</div>
                  {ext.irrf > 0 ? (
                    <div className="mt-1 text-[11px] font-bold text-rose-600">
                      Base &gt; {formatCurrency(IRRF_LUCROS_THRESHOLD)} · IRRF ({(IRRF_LUCROS_RATE * 100).toFixed(0)}%): {formatCurrency(ext.irrf)}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] font-semibold text-slate-400">
                      Isento — abaixo de {formatCurrency(IRRF_LUCROS_THRESHOLD)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] py-24 text-center flex flex-col items-center shadow-sm">
              <div className="w-20 h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-5 text-slate-200 border border-slate-100">
                <Users size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Sem movimentações de sócios no período</h3>
              <p className="text-slate-400 font-medium max-w-md mt-2">{company?.nomeFantasia} não teve lançamentos vinculados a sócios em {months[selectedMonth]}/{selectedYear}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Fechamento;
