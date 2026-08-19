
import { AppData, Company, Partner, BankAccount, Transaction, TransactionType, Session, Mutuo, AccessUser, Role } from './types';
import { supabase, loginIdToEmail } from './supabaseClient';

export const initialData: AppData = {
  companies: [],
  partners: [],
  bankAccounts: [],
  transactions: [],
  access: { users: [] },
  mutuos: [],
};

// Mantém só os dígitos — usado para comparar CPF/CNPJ digitados com ou sem máscara.
export const onlyDigits = (s: string): string => (s || '').replace(/\D/g, '');

// ---------- Autenticação (Supabase Auth — CPF/CNPJ vira e-mail sintético) ----------
const sessionFromSupabaseUser = (user: { app_metadata?: any } | null | undefined): Session | null => {
  const meta = user?.app_metadata || {};
  if (!meta.role) return null;
  return {
    role: meta.role as Role,
    companyId: meta.company_id || undefined,
    userId: meta.user_id || undefined,
    label: meta.label || (meta.role === 'admin' ? 'Administrador' : meta.role === 'analyst' ? 'Analista Contábil' : 'Cliente'),
  };
};

export const getCurrentSession = async (): Promise<Session | null> => {
  const { data } = await supabase.auth.getSession();
  return sessionFromSupabaseUser(data.session?.user);
};

// Login por identificador (CPF do usuário da equipe, ou CNPJ da empresa cliente) + senha.
export const authenticate = async (loginId: string, password: string): Promise<Session | null> => {
  const id = onlyDigits(loginId);
  const pwd = password || '';
  if (!id || !pwd) return null;
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(id), password: pwd });
  if (error || !data.user) return null;
  return sessionFromSupabaseUser(data.user);
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

// ---------- Leitura de dados (RLS já escopa o que cada perfil enxerga) ----------
const rowToCompany = (r: any): Company => ({
  id: r.id, razaoSocial: r.razao_social, nomeFantasia: r.nome_fantasia, cnpj: r.cnpj, tipo: r.tipo,
  endereco: r.endereco || undefined, foroComarca: r.foro_comarca || undefined, clientPassword: '',
});
const rowToPartner = (r: any): Partner => ({
  id: r.id, name: r.name, cpf: r.cpf, participation: Number(r.participation), companyIds: r.company_ids || [],
  endereco: r.endereco || undefined,
});
const rowToBankAccount = (r: any): BankAccount => ({
  id: r.id, ownerId: r.owner_id, ownerType: r.owner_type, bankName: r.bank_name, agency: r.agency || '',
  accountNumber: r.account_number, type: r.type,
});
const rowToTransaction = (r: any): Transaction => ({
  id: r.id, date: r.date, companyId: r.company_id, partnerId: r.partner_id || undefined,
  originAccountId: r.origin_account_id, destinationAccountId: r.destination_account_id,
  value: Number(r.value), type: r.type as TransactionType, nature: r.nature || undefined, description: r.description || '',
});
const rowToMutuo = (r: any): Mutuo => ({
  id: r.id, companyId: r.company_id, partnerId: r.partner_id, direction: r.direction, socioTipo: r.socio_tipo,
  value: Number(r.value), releaseDate: r.release_date, firstInstallmentDate: r.first_installment_date || undefined,
  dueDate: r.due_date, parcelas: r.parcelas, annualInterestPct: Number(r.annual_interest_pct), observacao: r.observacao || undefined,
});
const rowToAccessUser = (r: any): AccessUser => ({
  id: r.id, name: r.name, cpf: r.cpf, email: r.email || '', phone: r.phone || '', role: r.role, password: '',
});

export const fetchAppData = async (): Promise<AppData> => {
  const [companies, partners, bankAccounts, transactions, mutuos, users] = await Promise.all([
    supabase.from('companies').select('*'),
    supabase.from('partners').select('*'),
    supabase.from('bank_accounts').select('*'),
    supabase.from('transactions').select('*'),
    supabase.from('mutuos').select('*'),
    supabase.from('access_users').select('*'),
  ]);
  for (const r of [companies, partners, bankAccounts, transactions, mutuos]) {
    if (r.error) throw r.error;
  }
  // access_users é restrita a admin pela RLS — erro de permissão aqui é esperado p/ analyst/client.
  return {
    companies: (companies.data || []).map(rowToCompany),
    partners: (partners.data || []).map(rowToPartner),
    bankAccounts: (bankAccounts.data || []).map(rowToBankAccount),
    transactions: (transactions.data || []).map(rowToTransaction),
    mutuos: (mutuos.data || []).map(rowToMutuo),
    access: { users: (users.data || []).map(rowToAccessUser) },
  };
};

// ---------- Escrita: diff entre o AppData sincronizado e o novo, aplicado à distância ----------
const diffById = <T extends { id: string }>(prev: T[], next: T[]) => {
  const prevMap = new Map(prev.map(x => [x.id, x]));
  const upserts = next.filter(x => JSON.stringify(prevMap.get(x.id)) !== JSON.stringify(x));
  const nextIds = new Set(next.map(x => x.id));
  const deletedIds = prev.filter(x => !nextIds.has(x.id)).map(x => x.id);
  return { upserts, deletedIds };
};

const invokeAdminFn = async (name: string, body: unknown) => {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
};

// Sincroniza companies/partners/bankAccounts/transactions/mutuos direto nas tabelas (RLS
// já garante que só admin/analyst escrevem) e roteia o que mexe em auth.users (usuários de
// acesso, senha de empresa) para as Edge Functions com service-role.
export const syncAppData = async (prev: AppData, next: AppData): Promise<void> => {
  const companiesDiff = diffById(
    prev.companies.map(c => ({ ...c, clientPassword: '' })),
    next.companies.map(c => ({ ...c, clientPassword: '' })),
  );
  if (companiesDiff.upserts.length) {
    await supabase.from('companies').upsert(companiesDiff.upserts.map(c => ({
      id: c.id, razao_social: c.razaoSocial, nome_fantasia: c.nomeFantasia, cnpj: c.cnpj, tipo: c.tipo,
      endereco: c.endereco || null, foro_comarca: c.foroComarca || null,
    })));
  }
  for (const id of companiesDiff.deletedIds) await supabase.from('companies').delete().eq('id', id);

  for (const c of next.companies) {
    if (c.clientPassword) {
      await invokeAdminFn('admin-set-company-password', { companyId: c.id, cnpj: c.cnpj, password: c.clientPassword });
    }
  }

  const partnersDiff = diffById(prev.partners, next.partners);
  if (partnersDiff.upserts.length) {
    await supabase.from('partners').upsert(partnersDiff.upserts.map(p => ({
      id: p.id, name: p.name, cpf: p.cpf, participation: p.participation, company_ids: p.companyIds, endereco: p.endereco || null,
    })));
  }
  for (const id of partnersDiff.deletedIds) await supabase.from('partners').delete().eq('id', id);

  const accountsDiff = diffById(prev.bankAccounts, next.bankAccounts);
  if (accountsDiff.upserts.length) {
    await supabase.from('bank_accounts').upsert(accountsDiff.upserts.map(a => ({
      id: a.id, owner_id: a.ownerId, owner_type: a.ownerType, bank_name: a.bankName, agency: a.agency || null,
      account_number: a.accountNumber, type: a.type,
    })));
  }
  for (const id of accountsDiff.deletedIds) await supabase.from('bank_accounts').delete().eq('id', id);

  const txDiff = diffById(prev.transactions, next.transactions);
  if (txDiff.upserts.length) {
    await supabase.from('transactions').upsert(txDiff.upserts.map(t => ({
      id: t.id, date: t.date, company_id: t.companyId, partner_id: t.partnerId || null,
      origin_account_id: t.originAccountId, destination_account_id: t.destinationAccountId,
      value: t.value, type: t.type, nature: t.nature || null, description: t.description || null,
    })));
  }
  for (const id of txDiff.deletedIds) await supabase.from('transactions').delete().eq('id', id);

  const mutuosDiff = diffById(prev.mutuos || [], next.mutuos || []);
  if (mutuosDiff.upserts.length) {
    await supabase.from('mutuos').upsert(mutuosDiff.upserts.map(m => ({
      id: m.id, company_id: m.companyId, partner_id: m.partnerId, direction: m.direction, socio_tipo: m.socioTipo,
      value: m.value, release_date: m.releaseDate, first_installment_date: m.firstInstallmentDate || null,
      due_date: m.dueDate, parcelas: m.parcelas, annual_interest_pct: m.annualInterestPct, observacao: m.observacao || null,
    })));
  }
  for (const id of mutuosDiff.deletedIds) await supabase.from('mutuos').delete().eq('id', id);

  // Usuários de acesso: toda escrita passa pela Edge Function (só ela tem service-role p/ auth.users).
  const usersDiff = diffById(
    (prev.access?.users || []).map(u => ({ ...u, password: '' })),
    (next.access?.users || []).map(u => ({ ...u, password: '' })),
  );
  const prevUserIds = new Set((prev.access?.users || []).map(u => u.id));
  for (const u of next.access?.users || []) {
    const changed = usersDiff.upserts.some(x => x.id === u.id);
    if (!changed) continue;
    if (prevUserIds.has(u.id)) {
      await invokeAdminFn('admin-update-user', {
        id: u.id, name: u.name, cpf: u.cpf, email: u.email, phone: u.phone, role: u.role,
        password: u.password || undefined,
      });
    } else {
      await invokeAdminFn('admin-create-user', {
        name: u.name, cpf: u.cpf, email: u.email, phone: u.phone, role: u.role, password: u.password,
      });
    }
  }
  for (const id of usersDiff.deletedIds) await invokeAdminFn('admin-delete-user', { id });
};

export const calculateCompanyBalance = (companyId: string, transactions: Transaction[]): number => {
  return transactions
    .filter(t => t.companyId === companyId)
    .reduce((acc, t) => {
      return t.type === TransactionType.CREDIT ? acc + t.value : acc - t.value;
    }, 0);
};

export const calculatePartnerBalance = (partnerId: string, transactions: Transaction[]): number => {
  return transactions
    .filter(t => t.partnerId === partnerId)
    .reduce((acc, t) => {
      // For the partner, a "CREDIT" to the company is a "DEBIT" for the partner's invested balance record?
      // Usually, we track partner's total aportado. So CREDIT = + Aporte.
      return t.type === TransactionType.CREDIT ? acc + t.value : acc - t.value;
    }, 0);
};

// IRRF sobre distribuição de lucros: retenção de 10% quando o total de
// Retirada de Lucros do sócio no mês ultrapassa R$ 50.000,00 (previsão).
export const IRRF_LUCROS_THRESHOLD = 50000;
export const IRRF_LUCROS_RATE = 0.10;

// O valor de lucro informado é LÍQUIDO. A base de cálculo do IRRF é obtida
// pelo "gross-up": base = líquido / (1 - alíquota)  (ex.: 60.000 / 0,9 = 66.666,67).
// O IRRF de 10% incide sobre essa base.
export const irrfBaseFromNet = (netLucros: number): number =>
  netLucros > 0 ? netLucros / (1 - IRRF_LUCROS_RATE) : 0;

export const irrfLucrosFromNet = (netLucros: number): number =>
  netLucros > IRRF_LUCROS_THRESHOLD ? irrfBaseFromNet(netLucros) * IRRF_LUCROS_RATE : 0;

// ---------- Motor fiscal do Contrato de Mútuo (valores INDICATIVOS) ----------
// IOF (só quando a EMPRESA empresta ao sócio): 0,38% fixo (uma vez) +
// alíquota diária de 0,0082%/dia (sócio PF, teto 365 dias ≈ 3% a.a.) ou
// 0,0041%/dia (sócio PJ). Sócio PF emprestando à empresa: sem IOF.
export const IOF_FIXO_RATE = 0.0038;
export const IOF_DIA_PF = 0.000082;
export const IOF_DIA_PJ = 0.000041;
export const IOF_DIA_CAP = 365;

// IRRF sobre os JUROS (regressivo pelo prazo do contrato).
export const irrfJurosAliquota = (dias: number): number =>
  dias <= 180 ? 0.225 : dias <= 360 ? 0.20 : dias <= 720 ? 0.175 : 0.15;

const dateToUTC = (s: string): number => {
  const [y, m, d] = (s || '').split('-').map(Number);
  return (y && m && d) ? Date.UTC(y, m - 1, d) : NaN;
};

export const diasEntre = (inicio: string, fim: string): number => {
  const a = dateToUTC(inicio), b = dateToUTC(fim);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
};

// ---------- Datas 'YYYY-MM-DD' (evita o bug de fuso de new Date(str)) ----------
// new Date('YYYY-MM-DD') é interpretado como UTC; ao exibir em horário local
// (ex.: Brasil, UTC-3) o dia pode "voltar" um dia. Por isso toda leitura/exibição
// de data de string deve usar estes helpers em vez de `new Date(str)`.
export const parseDateParts = (s: string): { y: number; m: number; d: number } => {
  const [y, m, d] = (s || '').split('-').map(Number);
  return { y, m, d };
};

export const formatDateBR = (s: string): string => {
  const { y, m, d } = parseDateParts(s);
  if (!y || !m || !d) return s || '';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

// Soma meses a uma data 'YYYY-MM-DD', preservando o dia quando possível
// (ajusta para o último dia do mês de destino se o dia não existir —
// ex.: 31/01 + 1 mês -> 28/02 ou 29/02).
export const addMonthsToDateStr = (dateStr: string, months: number): string => {
  const { y, m, d } = parseDateParts(dateStr);
  if (!y || !m || !d) return '';
  const total = (m - 1) + months;
  const targetYear = y + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12; // 0-11
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfTargetMonth);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(day)}`;
};

// Valor da parcela (amortização + juros) pela Tabela Price, usando a taxa
// mensal derivada linearmente da taxa SELIC anual informada (juros/12).
// Estimativa operacional para acompanhamento do mútuo — não é usada nas
// cláusulas do contrato, que seguem juros simples pro rata die sobre o total.
export const computeInstallmentValue = (value: number, annualInterestPct: number, parcelas: number): number => {
  const n = Math.max(1, Math.round(parcelas || 1));
  if (value <= 0) return 0;
  const monthlyRate = (annualInterestPct || 0) / 100 / 12;
  if (monthlyRate <= 0) return value / n;
  return (value * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
};

export interface MutuoCalculo {
  dias: number;
  juros: number;
  iofFixo: number;
  iofDiario: number;
  iof: number;
  iofAplicavel: boolean;
  irrfAliquota: number;
  irrfJuros: number;
  totalComJuros: number;         // principal + juros
  installmentValue: number;      // valor calculado da parcela (amortização + juros), Tabela Price
  installmentAmortizacao: number; // parte de amortização da 1ª parcela
  installmentJuros: number;       // parte de juros da 1ª parcela
  installmentIrrf: number;        // IRRF retido sobre os juros da 1ª parcela
  alertaSemJuros: boolean;  // empresa -> sócio sem juros (risco de distribuição disfarçada)
}

export const computeMutuo = (m: Mutuo): MutuoCalculo => {
  const dias = diasEntre(m.releaseDate, m.dueDate);
  const juros = m.annualInterestPct > 0 ? m.value * (m.annualInterestPct / 100) * (dias / 365) : 0;

  const iofAplicavel = m.direction === 'EMPRESA_PARA_SOCIO';
  const iofFixo = iofAplicavel ? m.value * IOF_FIXO_RATE : 0;
  const rateDia = m.socioTipo === 'PF' ? IOF_DIA_PF : IOF_DIA_PJ;
  const iofDiario = iofAplicavel ? m.value * rateDia * Math.min(dias, IOF_DIA_CAP) : 0;
  const iof = iofFixo + iofDiario;

  const irrfAliquota = irrfJurosAliquota(dias);
  const irrfJuros = juros > 0 ? juros * irrfAliquota : 0;

  // Composição da 1ª parcela (Tabela Price): juros incidem sobre o saldo
  // devedor inicial (valor do mútuo); a amortização é o restante da parcela.
  // O IRRF é retido sobre a parcela de juros, à mesma alíquota do contrato.
  const installmentValue = computeInstallmentValue(m.value, m.annualInterestPct, m.parcelas);
  const monthlyRate = (m.annualInterestPct || 0) / 100 / 12;
  const installmentJuros = monthlyRate > 0 ? m.value * monthlyRate : 0;
  const installmentAmortizacao = installmentValue - installmentJuros;
  const installmentIrrf = installmentJuros * irrfAliquota;

  return {
    dias,
    juros,
    iofFixo,
    iofDiario,
    iof,
    iofAplicavel,
    irrfAliquota,
    irrfJuros,
    totalComJuros: m.value + juros,
    installmentValue,
    installmentAmortizacao,
    installmentJuros,
    installmentIrrf,
    alertaSemJuros: iofAplicavel && m.annualInterestPct <= 0,
  };
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};
