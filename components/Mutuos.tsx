
import React, { useState } from 'react';
import { Handshake, Plus, Trash2, X, AlertTriangle, Info, ArrowRight, Landmark, Percent, ShieldAlert, FileText } from 'lucide-react';
import { AppData, Mutuo, MutuoDirection, SocioTipo } from '../types';
import { formatCurrency, computeMutuo } from '../dataService';
import { exportMutuoContratoPdf } from '../exportService';

interface MutuosProps {
  data: AppData;
  onUpdate: (data: AppData) => void;
}

const today = () => new Date().toISOString().split('T')[0];

const emptyForm = () => ({
  direction: 'EMPRESA_PARA_SOCIO' as MutuoDirection,
  companyId: '',
  partnerId: '',
  socioTipo: 'PF' as SocioTipo,
  value: 0,
  releaseDate: today(),
  dueDate: '',
  parcelas: 1,
  annualInterestPct: 0,
  observacao: '',
});

const fmtDate = (s: string) => {
  const [y, m, d] = (s || '').split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : '—';
};

const Mutuos: React.FC<MutuosProps> = ({ data, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const mutuos = data.mutuos || [];

  // Simulação ao vivo a partir do formulário atual.
  const preview = computeMutuo({ id: 'preview', ...form });
  const canSave = !!form.companyId && !!form.partnerId && form.value > 0 && !!form.dueDate;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) { alert('Preencha empresa, sócio, valor e data de vencimento.'); return; }
    const novo: Mutuo = { id: crypto.randomUUID(), ...form };
    onUpdate({ ...data, mutuos: [...mutuos, novo] });
    setForm(emptyForm());
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir este contrato de mútuo?')) {
      onUpdate({ ...data, mutuos: mutuos.filter(m => m.id !== id) });
    }
  };

  const companyName = (id: string) => data.companies.find(c => c.id === id)?.nomeFantasia || '—';
  const partnerName = (id: string) => data.partners.find(p => p.id === id)?.name || '—';

  const gerarContrato = (m: Mutuo) => {
    const company = data.companies.find(c => c.id === m.companyId);
    const partner = data.partners.find(p => p.id === m.partnerId);
    if (!company || !partner) { alert('Empresa ou sócio não encontrado.'); return; }
    const calc = computeMutuo(m);
    exportMutuoContratoPdf({
      direction: m.direction,
      socioTipo: m.socioTipo,
      empresaRazao: company.razaoSocial,
      empresaFantasia: company.nomeFantasia,
      empresaCnpj: company.cnpj,
      socioNome: partner.name,
      socioCpf: partner.cpf,
      valor: m.value,
      releaseDate: m.releaseDate,
      dueDate: m.dueDate,
      parcelas: m.parcelas,
      annualInterestPct: m.annualInterestPct,
      dias: calc.dias,
      juros: calc.juros,
      iof: calc.iof,
      iofAplicavel: calc.iofAplicavel,
      irrfJuros: calc.irrfJuros,
      irrfAliquota: calc.irrfAliquota,
      totalComJuros: calc.totalComJuros,
      observacao: m.observacao,
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Contratos de Mútuo</h2>
          <p className="text-sm text-slate-500 font-medium">Empréstimos formalizados entre sócio e empresa — com IOF e IRRF sobre juros</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setIsAdding(true); }}
          className="w-full sm:w-auto bg-[#2B589A] hover:bg-[#1E3F6D] text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#2B589A]/20 font-bold"
        >
          <Plus size={20} /> Novo Mútuo
        </button>
      </div>

      {/* Nota legal */}
      <div className="bg-amber-50/60 border-l-4 border-amber-400 p-5 rounded-r-2xl shadow-sm">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 font-semibold leading-relaxed">
            <span className="uppercase tracking-[0.2em] text-[10px] block mb-1 opacity-70">Valores indicativos</span>
            Os tributos aqui calculados (IOF e IRRF sobre juros) são uma <strong>previsão para conferência</strong> pela contabilidade — confirme as alíquotas na legislação vigente antes de recolher. O mútuo deve ser <strong>formalizado por contrato</strong> com prazo, parcelas e (quando cabível) juros de mercado, para não ser desconfigurado como distribuição de lucros/pró-labore.
          </p>
        </div>
      </div>

      {/* Formulário */}
      {isAdding && (
        <div className="bg-white p-6 lg:p-8 rounded-3xl border-2 border-[#2B589A]/10 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">Novo Contrato de Mútuo</h3>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Campos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sentido do Empréstimo *</label>
                <select className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value as MutuoDirection })}>
                  <option value="EMPRESA_PARA_SOCIO">Empresa → Sócio (empresa empresta)</option>
                  <option value="SOCIO_PARA_EMPRESA">Sócio → Empresa (sócio empresta)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa *</label>
                <select required className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {data.companies.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sócio(a) *</label>
                <select required className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.partnerId} onChange={e => setForm({ ...form, partnerId: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo do Sócio</label>
                <select className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.socioTipo} onChange={e => setForm({ ...form, socioTipo: e.target.value as SocioTipo })}>
                  <option value="PF">Pessoa Física (CPF)</option>
                  <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$) *</label>
                <input required type="number" step="0.01" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.value || ''} onChange={e => setForm({ ...form, value: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Liberação *</label>
                <input required type="date" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Vencimento *</label>
                <input required type="date" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcelas</label>
                <input type="number" min={1} className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.parcelas} onChange={e => setForm({ ...form, parcelas: Math.max(1, Number(e.target.value)) })} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Juros (% ao ano)</label>
                <input type="number" step="0.01" min={0} placeholder="0 = sem juros" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.annualInterestPct || ''} onChange={e => setForm({ ...form, annualInterestPct: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observação</label>
                <input type="text" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-medium" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
              </div>
            </div>

            {/* Simulação ao vivo */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col">
              <h4 className="text-xs font-black text-[#2B589A] uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Percent size={14} /> Simulação Fiscal</h4>
              <div className="space-y-3 flex-1">
                <SimRow label="Prazo" value={`${preview.dias} dias`} />
                <SimRow label={`Juros (${form.annualInterestPct || 0}% a.a.)`} value={formatCurrency(preview.juros)} />
                <div className="pt-2 border-t border-slate-200" />
                <SimRow label="IOF fixo (0,38%)" value={preview.iofAplicavel ? formatCurrency(preview.iofFixo) : 'Não incide'} muted={!preview.iofAplicavel} />
                <SimRow label={`IOF diário (${form.socioTipo === 'PF' ? '0,0082%/dia' : '0,0041%/dia'})`} value={preview.iofAplicavel ? formatCurrency(preview.iofDiario) : 'Não incide'} muted={!preview.iofAplicavel} />
                <SimRow label="IOF total" value={preview.iofAplicavel ? formatCurrency(preview.iof) : '—'} strong />
                <div className="pt-2 border-t border-slate-200" />
                <SimRow label={`IRRF s/ juros (${(preview.irrfAliquota * 100).toFixed(1)}%)`} value={formatCurrency(preview.irrfJuros)} strong />
                <div className="pt-2 border-t border-slate-200" />
                <SimRow label="Total a devolver (principal + juros)" value={formatCurrency(preview.totalComJuros)} strong />
              </div>
              {preview.iofAplicavel && (
                <p className="mt-3 text-[10px] text-slate-400 font-medium">IOF recolhido pela empresa via DARF até o dia 20 do mês seguinte.</p>
              )}
              {!preview.iofAplicavel && (
                <p className="mt-3 text-[10px] text-slate-400 font-medium">Sócio emprestando à empresa: não há IOF corporativo.</p>
              )}
              {preview.alertaSemJuros && (
                <div className="mt-3 flex items-start gap-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-2.5 font-semibold">
                  <ShieldAlert size={14} className="mt-0.5 shrink-0" /> Empresa emprestando ao sócio <strong>sem juros</strong> é visto pela Receita como vantagem indevida (risco de distribuição disfarçada de lucros).
                </div>
              )}
            </div>

            <div className="lg:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">Cancelar</button>
              <button type="submit" disabled={!canSave} className="px-10 py-3 bg-[#2B589A] text-white rounded-2xl hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 font-bold disabled:opacity-30 disabled:cursor-not-allowed">Salvar Mútuo</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de mútuos */}
      {mutuos.length > 0 ? (
        <div className="space-y-5">
          {mutuos.map(m => {
            const c = computeMutuo(m);
            const empresaToSocio = m.direction === 'EMPRESA_PARA_SOCIO';
            return (
              <div key={m.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 lg:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#2B589A] flex items-center justify-center text-white shadow-md shadow-[#2B589A]/20">
                      <Handshake size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                        {empresaToSocio ? companyName(m.companyId) : partnerName(m.partnerId)}
                        <ArrowRight size={14} className="text-[#2B589A]" />
                        {empresaToSocio ? partnerName(m.partnerId) : companyName(m.companyId)}
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {formatCurrency(m.value)} · {c.dias} dias · {m.parcelas} parcela(s) · {m.socioTipo} · {fmtDate(m.releaseDate)} → {fmtDate(m.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => gerarContrato(m)} className="flex items-center gap-2 px-4 py-2.5 bg-[#2B589A] text-white rounded-xl text-xs font-black tracking-tight hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 transition-all">
                      <FileText size={16} /> Gerar Contrato (PDF)
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>

                <div className="p-6 lg:p-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Metric label={`Juros (${m.annualInterestPct}% a.a.)`} value={formatCurrency(c.juros)} />
                  <Metric label="IOF total" value={c.iofAplicavel ? formatCurrency(c.iof) : 'Não incide'} tone={c.iofAplicavel ? 'blue' : 'muted'} />
                  <Metric label={`IRRF s/ juros (${(c.irrfAliquota * 100).toFixed(1)}%)`} value={formatCurrency(c.irrfJuros)} tone="rose" />
                  <Metric label="Total a devolver" value={formatCurrency(c.totalComJuros)} tone="blue" />
                </div>

                {(c.iofAplicavel || c.alertaSemJuros || m.observacao) && (
                  <div className="px-6 lg:px-8 pb-6 lg:pb-8 space-y-2">
                    {c.iofAplicavel && (
                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                        <Landmark size={12} className="text-[#2B589A]" /> IOF = fixo {formatCurrency(c.iofFixo)} + diário {formatCurrency(c.iofDiario)} · recolher via DARF até o dia 20 do mês seguinte.
                      </p>
                    )}
                    {c.alertaSemJuros && (
                      <div className="flex items-start gap-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-2.5 font-semibold">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Empréstimo da empresa ao sócio <strong>sem juros</strong>: risco de ser reclassificado como distribuição disfarçada de lucros.
                      </div>
                    )}
                    {m.observacao && <p className="text-[11px] text-slate-400 italic">"{m.observacao}"</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (!isAdding && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] py-28 text-center flex flex-col items-center shadow-sm">
          <div className="w-24 h-24 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-6 text-slate-200 border border-slate-100">
            <Handshake size={48} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Nenhum contrato de mútuo</h3>
          <p className="text-slate-400 font-medium max-w-md mt-2">Cadastre um empréstimo formalizado entre sócio e empresa para calcular IOF e IRRF sobre os juros.</p>
        </div>
      ))}
    </div>
  );
};

const SimRow: React.FC<{ label: string; value: string; strong?: boolean; muted?: boolean }> = ({ label, value, strong, muted }) => (
  <div className="flex justify-between items-baseline gap-3">
    <span className="text-[11px] font-semibold text-slate-500">{label}</span>
    <span className={`text-sm tracking-tight ${strong ? 'font-black text-slate-800' : 'font-bold text-slate-700'} ${muted ? 'text-slate-300' : ''}`}>{value}</span>
  </div>
);

const Metric: React.FC<{ label: string; value: string; tone?: 'blue' | 'rose' | 'muted' }> = ({ label, value, tone }) => {
  const cls = tone === 'blue' ? 'bg-[#2B589A]/5 border-[#2B589A]/10 text-[#2B589A]'
    : tone === 'rose' ? 'bg-rose-50 border-rose-100 text-rose-600'
    : 'bg-slate-50 border-slate-100 text-slate-700';
  return (
    <div className={`p-4 rounded-2xl border ${cls}`}>
      <div className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</div>
      <div className="text-base font-black tracking-tight">{value}</div>
    </div>
  );
};

export default Mutuos;
