
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Handshake, Plus, Trash2, Pencil, X, AlertTriangle, Info, ArrowRight, Landmark, Percent, ShieldAlert, FileText, FileType2, CalendarClock, ExternalLink, Table2, Building2, Wallet, Printer } from 'lucide-react';
import { AppData, Mutuo, MutuoDirection, SocioTipo, TransactionNature } from '../types';
import { formatCurrency, computeMutuo, computeMutuoSchedule, addMonthsToDateStr, formatDateBR, formatMutuoNumero } from '../dataService';
import { exportMutuoContratoPdf, exportMutuoContratoDocx, exportMutuoEspelhoPdf, exportMutuoDemonstrativoPdf, MutuoContrato, MutuoResumo, slug } from '../exportService';
import CurrencyInput from './CurrencyInput';

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
  firstInstallmentDate: '',
  dueDate: '',
  parcelas: 1,
  annualInterestPct: 0,
  observacao: '',
});

const fmtDate = (s: string) => (s ? formatDateBR(s) : '—');

// Recalcula a data de vencimento final a partir da 1ª parcela + nº de parcelas.
const computeDueDate = (firstInstallmentDate: string, parcelas: number): string =>
  firstInstallmentDate ? (parcelas > 1 ? addMonthsToDateStr(firstInstallmentDate, parcelas - 1) : firstInstallmentDate) : '';

const Mutuos: React.FC<MutuosProps> = ({ data, onUpdate }) => {
  const location = useLocation();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const mutuos = data.mutuos || [];
  const filteredMutuos = filterCompanyId ? mutuos.filter(m => m.companyId === filterCompanyId) : mutuos;

  // Pré-preenchimento vindo do Fechamento ("Formalizar mútuo deste saldo").
  useEffect(() => {
    const pf = (location.state as any)?.prefill;
    if (pf) {
      setEditingId(null);
      setForm({ ...emptyForm(), companyId: pf.companyId || '', partnerId: pf.partnerId || '', value: pf.value || 0 });
      setIsAdding(true);
      window.history.replaceState({}, ''); // evita reabrir ao voltar
    }
  }, [location.state]);

  // Simulação ao vivo a partir do formulário atual.
  const preview = computeMutuo({ id: 'preview', ...form });
  // Taxa SELIC (juros) é OBRIGATÓRIA.
  const canSave = !!form.companyId && !!form.partnerId && form.value > 0 && !!form.dueDate && form.annualInterestPct > 0;

  // Saldo devedor atual do par (Empréstimo − Pagto Empréstimo), vindo dos lançamentos.
  const saldoDevedorPar = (form.companyId && form.partnerId)
    ? data.transactions
        .filter(t => t.companyId === form.companyId && t.partnerId === form.partnerId)
        .reduce((s, t) => s + (t.nature === TransactionNature.EMPRESTIMO ? t.value : t.nature === TransactionNature.PAGTO_EMPRESTIMO ? -t.value : 0), 0)
    : 0;

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) { alert('Preencha empresa, sócio, valor, data de vencimento e a taxa SELIC (juros).'); return; }
    if (editingId) {
      onUpdate({ ...data, mutuos: mutuos.map(m => m.id === editingId ? { ...m, ...form } : m) });
    } else {
      const proximoNumero = mutuos.reduce((max, m) => Math.max(max, m.numero || 0), 0) + 1;
      const novo: Mutuo = { id: crypto.randomUUID(), numero: proximoNumero, ...form };
      onUpdate({ ...data, mutuos: [...mutuos, novo] });
    }
    closeForm();
  };

  const handleEditClick = (m: Mutuo) => {
    setForm({
      direction: m.direction,
      companyId: m.companyId,
      partnerId: m.partnerId,
      socioTipo: m.socioTipo,
      value: m.value,
      releaseDate: m.releaseDate,
      firstInstallmentDate: m.firstInstallmentDate || '',
      dueDate: m.dueDate,
      parcelas: m.parcelas,
      annualInterestPct: m.annualInterestPct,
      observacao: m.observacao || '',
    });
    setEditingId(m.id);
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir este contrato de mútuo?')) {
      onUpdate({ ...data, mutuos: mutuos.filter(m => m.id !== id) });
    }
  };

  const companyName = (id: string) => data.companies.find(c => c.id === id)?.nomeFantasia || '—';
  const partnerName = (id: string) => data.partners.find(p => p.id === id)?.name || '—';

  const buildPayload = (m: Mutuo): MutuoContrato | null => {
    const company = data.companies.find(c => c.id === m.companyId);
    const partner = data.partners.find(p => p.id === m.partnerId);
    if (!company || !partner) { alert('Empresa ou sócio não encontrado.'); return null; }
    const calc = computeMutuo(m);
    return {
      numero: m.numero,
      direction: m.direction,
      socioTipo: m.socioTipo,
      empresaRazao: company.razaoSocial,
      empresaFantasia: company.nomeFantasia,
      empresaCnpj: company.cnpj,
      empresaEndereco: company.endereco,
      foroComarca: company.foroComarca,
      socioNome: partner.name,
      socioCpf: partner.cpf,
      socioEndereco: partner.endereco,
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
    };
  };
  const gerarContratoPdf = (m: Mutuo) => { const p = buildPayload(m); if (p) exportMutuoContratoPdf(p); };
  const gerarContratoWord = (m: Mutuo) => { const p = buildPayload(m); if (p) exportMutuoContratoDocx(p); };

  const buildResumoPayload = (m: Mutuo): MutuoResumo | null => {
    const company = data.companies.find(c => c.id === m.companyId);
    const partner = data.partners.find(p => p.id === m.partnerId);
    if (!company || !partner) { alert('Empresa ou sócio não encontrado.'); return null; }
    const fileBase = m.direction === 'EMPRESA_PARA_SOCIO'
      ? `${slug(company.nomeFantasia)}-para-${slug(partner.name)}`
      : `${slug(partner.name)}-para-${slug(company.nomeFantasia)}`;
    const calc = computeMutuo(m);
    return {
      numero: m.numero,
      direction: m.direction,
      socioTipo: m.socioTipo,
      empresaFantasia: company.nomeFantasia,
      socioNome: partner.name,
      valor: m.value,
      releaseDate: m.releaseDate,
      firstInstallmentDate: m.firstInstallmentDate,
      dueDate: m.dueDate,
      parcelas: m.parcelas,
      annualInterestPct: m.annualInterestPct,
      dias: calc.dias,
      juros: calc.juros,
      iofFixo: calc.iofFixo,
      iofDiario: calc.iofDiario,
      iof: calc.iof,
      iofAplicavel: calc.iofAplicavel,
      irrfAliquota: calc.irrfAliquota,
      irrfJuros: calc.irrfJuros,
      totalComJuros: calc.totalComJuros,
      installmentValue: calc.installmentValue,
      installmentAmortizacao: calc.installmentAmortizacao,
      installmentJuros: calc.installmentJuros,
      installmentIrrf: calc.installmentIrrf,
      alertaSemJuros: calc.alertaSemJuros,
      observacao: m.observacao,
      fileBase,
    };
  };
  const gerarEspelhoPdf = (m: Mutuo) => { const p = buildResumoPayload(m); if (p) exportMutuoEspelhoPdf(p); };
  const gerarDemonstrativoPdf = (m: Mutuo) => { const p = buildResumoPayload(m); if (p) exportMutuoDemonstrativoPdf({ ...p, schedule: computeMutuoSchedule(m) }); };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Contratos de Mútuo</h2>
          <p className="text-sm text-slate-500 font-medium">Empréstimos formalizados entre sócio e empresa — com IOF e IRRF sobre juros</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <a
            href="https://sicalc.receita.fazenda.gov.br/sicalc/rapido/contribuinte"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-[#2B589A] border border-[#2B589A]/20 rounded-2xl hover:bg-[#2B589A]/5 transition-all font-bold text-sm"
            title={'Emitir DARF do IOF no SICALC (Receita Federal)\n\n' +
              'Código DARF IOF — Mutuário Pessoa Física:\n7893-03 - DC - a partir de 01/01/2006 - IOF - Operações de Crédito - Pessoa Física - IOF - OPERAÇÕES DE CRÉDITO - TOMADOR PESSOA FÍSICA\n\n' +
              'Código DARF IOF — Mutuário Pessoa Jurídica:\n1150-03 - DC - a partir de 01/01/2006 - IOF - Operações de Crédito - Pessoa Jurídica - IOF - OPERAÇÕES DE CRÉDITO - TOMADOR PESSOA JURÍDICA'}
          >
            <Landmark size={18} /> Emitir DARF (SICALC) <ExternalLink size={14} />
          </a>
          <button
            onClick={() => { closeForm(); setIsAdding(true); }}
            className="w-full sm:w-auto bg-[#2B589A] hover:bg-[#1E3F6D] text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#2B589A]/20 font-bold"
          >
            <Plus size={20} /> Novo Mútuo
          </button>
        </div>
      </div>

      {/* Nota legal */}
      <div className="bg-amber-50/60 border-l-4 border-amber-400 p-5 rounded-r-2xl shadow-sm">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 font-semibold leading-relaxed">
            <span className="uppercase tracking-[0.2em] text-[10px] block mb-1 opacity-70">Parametrização validada</span>
            IOF e IRRF sobre juros calculados conforme as alíquotas validadas com a contabilidade. Informe a <strong>taxa SELIC vigente</strong> (obrigatória) e formalize o mútuo por <strong>contrato</strong> com prazo, parcelas e juros de mercado, para não ser desconfigurado como distribuição de lucros/pró-labore.
          </p>
        </div>
      </div>

      {/* Filtro por empresa — individualiza a visão dos contratos, igual a Fechamento/Relatórios */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px] space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5"><Building2 size={12} /> Empresa</label>
          <select
            className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2B589A] font-bold transition-all"
            value={filterCompanyId}
            onChange={e => setFilterCompanyId(e.target.value)}
          >
            <option value="">Todas as empresas</option>
            {data.companies.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
          </select>
        </div>
        <p className="text-[11px] text-slate-400 font-semibold pb-3.5">{filteredMutuos.length} contrato(s)</p>
      </div>

      {/* Formulário */}
      {isAdding && (
        <div className="bg-white p-6 lg:p-8 rounded-3xl border-2 border-[#2B589A]/10 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Contrato de Mútuo' : 'Novo Contrato de Mútuo'}</h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                <CurrencyInput required className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.value} onChange={v => setForm({ ...form, value: v })} />
                {saldoDevedorPar > 0 && (
                  <button type="button" onClick={() => setForm({ ...form, value: saldoDevedorPar })} className="text-[11px] font-bold text-[#2B589A] hover:underline">
                    Saldo devedor atual: {formatCurrency(saldoDevedorPar)} — usar como valor
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Liberação *</label>
                <input required type="date" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimento da 1ª Parcela</label>
                <input
                  type="date"
                  className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold"
                  value={form.firstInstallmentDate}
                  onChange={e => {
                    const firstInstallmentDate = e.target.value;
                    setForm({ ...form, firstInstallmentDate, dueDate: computeDueDate(firstInstallmentDate, form.parcelas) || form.dueDate });
                  }}
                />
                <p className="text-[10px] text-slate-400 font-medium ml-1">Preenchendo esta data, o vencimento final é calculado automaticamente.</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcelas</label>
                <input
                  type="number"
                  min={1}
                  className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold"
                  value={form.parcelas}
                  onChange={e => {
                    const parcelas = Math.max(1, Number(e.target.value));
                    setForm({ ...form, parcelas, dueDate: computeDueDate(form.firstInstallmentDate, parcelas) || form.dueDate });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimento Final (Última Parcela) *</label>
                <input
                  required
                  type="date"
                  readOnly={!!form.firstInstallmentDate}
                  className={`w-full p-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold ${form.firstInstallmentDate ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 text-slate-900'}`}
                  value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 font-medium ml-1">
                  {form.firstInstallmentDate ? 'Calculado: 1ª parcela + nº de parcelas.' : 'Ou informe diretamente, sem usar o cronograma de parcelas.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><CalendarClock size={12} /> Valor da Parcela (calculado)</label>
                <div className="w-full p-3.5 bg-[#2B589A]/5 text-[#2B589A] border border-[#2B589A]/15 rounded-2xl font-black">
                  {preview.installmentValue > 0 ? formatCurrency(preview.installmentValue) : '—'}
                </div>
                <p className="text-[10px] text-slate-400 font-medium ml-1">Amortização + juros, Tabela Price — estimativa operacional (não consta no contrato).</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Taxa SELIC (% ao ano) *</label>
                <input required type="number" step="0.01" min={0.01} placeholder="Ex.: 11,25" className="w-full p-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#2B589A] outline-none font-bold" value={form.annualInterestPct || ''} onChange={e => setForm({ ...form, annualInterestPct: Number(e.target.value) })} />
                <p className="text-[10px] text-slate-400 font-medium ml-1">Obrigatória — informe a SELIC vigente (o app não busca a taxa online).</p>
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
                <SimRow label={`Parcela calculada (${form.parcelas}x)`} value={preview.installmentValue > 0 ? formatCurrency(preview.installmentValue) : '—'} />
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
              <button type="button" onClick={closeForm} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">Cancelar</button>
              <button type="submit" disabled={!canSave} className="px-10 py-3 bg-[#2B589A] text-white rounded-2xl hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 font-bold disabled:opacity-30 disabled:cursor-not-allowed">{editingId ? 'Salvar Alterações' : 'Salvar Mútuo'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de mútuos */}
      {filteredMutuos.length > 0 ? (
        <div className="space-y-5">
          {filteredMutuos.map(m => {
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
                        <span className="px-2 py-0.5 bg-[#2B589A]/5 text-[#2B589A] border border-[#2B589A]/10 rounded-full text-[10px] font-black tracking-tight">
                          Nº {formatMutuoNumero(m.numero, m.releaseDate)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {formatCurrency(m.value)} · {c.dias} dias · {m.parcelas} parcela(s) · {m.socioTipo} · {fmtDate(m.releaseDate)} → {fmtDate(m.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => gerarContratoPdf(m)} className="flex items-center gap-2 px-4 py-2.5 bg-[#2B589A] text-white rounded-xl text-xs font-black tracking-tight hover:bg-[#1E3F6D] shadow-lg shadow-[#2B589A]/20 transition-all">
                      <FileText size={16} /> Contrato PDF
                    </button>
                    <button onClick={() => gerarContratoWord(m)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black tracking-tight hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all">
                      <FileType2 size={16} /> Word (.docx)
                    </button>
                    <button onClick={() => gerarEspelhoPdf(m)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl text-xs font-black tracking-tight hover:bg-slate-800 shadow-lg shadow-slate-700/20 transition-all">
                      <Printer size={16} /> Espelho do Mútuo
                    </button>
                    <button onClick={() => gerarDemonstrativoPdf(m)} className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-black tracking-tight hover:bg-amber-700 shadow-lg shadow-amber-600/20 transition-all">
                      <Table2 size={16} /> Demonstrativo PDF
                    </button>
                    <button onClick={() => handleEditClick(m)} className="p-2 text-slate-300 hover:text-[#2B589A] hover:bg-[#2B589A]/5 rounded-xl transition-colors" title="Reabrir para edição"><Pencil size={18} /></button>
                    <button onClick={() => handleDelete(m.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>

                <div className="px-6 lg:px-8 pt-6 lg:pt-8 space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet size={12} /> Dados do Contrato</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <Metric label="Valor do Mútuo" value={formatCurrency(m.value)} />
                    <Metric label="Data Pago" value={fmtDate(m.releaseDate)} />
                    <Metric label="Nº de Parcelas" value={String(m.parcelas)} />
                    <Metric label="Data 1ª Parcela" value={m.firstInstallmentDate ? fmtDate(m.firstInstallmentDate) : '—'} />
                    <Metric label="Data Última Parcela" value={fmtDate(m.dueDate)} />
                  </div>
                </div>

                <div className="p-6 lg:p-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <Metric label={`Juros (${m.annualInterestPct}% a.a.)`} value={formatCurrency(c.juros)} />
                  <Metric label={`Parcela calculada (${m.parcelas}x)`} value={c.installmentValue > 0 ? formatCurrency(c.installmentValue) : '—'} />
                  <Metric label="IOF total" value={c.iofAplicavel ? formatCurrency(c.iof) : 'Não incide'} tone={c.iofAplicavel ? 'blue' : 'muted'} />
                  <Metric label={`IRRF s/ juros (${(c.irrfAliquota * 100).toFixed(1)}%)`} value={formatCurrency(c.irrfJuros)} tone="rose" />
                  <Metric label="Total a devolver" value={formatCurrency(c.totalComJuros)} tone="blue" />
                </div>

                {(c.iofAplicavel || c.installmentValue > 0 || c.alertaSemJuros || m.observacao) && (
                  <div className="px-6 lg:px-8 pb-6 lg:pb-8 space-y-2">
                    {c.installmentValue > 0 && (
                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                        <CalendarClock size={12} className="text-[#2B589A]" /> Parcela calculada = amortização {formatCurrency(c.installmentAmortizacao)} + juros {formatCurrency(c.installmentJuros)} (1ª parcela) — dos quais {formatCurrency(c.installmentIrrf)} de IRRF retido na fonte sobre os juros.
                      </p>
                    )}
                    {c.iofAplicavel && (
                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                        <Landmark size={12} className="text-[#2B589A]" /> IOF = fixo {formatCurrency(c.iofFixo)} + diário {formatCurrency(c.iofDiario)} · recolher via DARF, código {m.socioTipo === 'PF' ? '7893' : '1150'}, até o 3º dia útil subsequente ao decêndio do fato gerador.
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
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{filterCompanyId ? 'Nenhum contrato para esta empresa' : 'Nenhum contrato de mútuo'}</h3>
          <p className="text-slate-400 font-medium max-w-md mt-2">{filterCompanyId ? 'Selecione outra empresa ou cadastre um novo mútuo para ela.' : 'Cadastre um empréstimo formalizado entre sócio e empresa para calcular IOF e IRRF sobre os juros.'}</p>
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
