
import { AppData, Company, Partner, BankAccount, Transaction, TransactionType, Session, Mutuo } from './types';

const STORAGE_KEY = 'sociocash_data';
const SESSION_KEY = 'sociocash_session';

export const initialData: AppData = {
  companies: [],
  partners: [],
  bankAccounts: [],
  transactions: [],
  access: { adminPassword: '', analystPassword: '' },
  mutuos: [],
};

export const loadData = (): AppData => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load data', e);
    }
  }
  return initialData;
};

export const saveData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// ---------- Autenticação (trava simples baseada em senhas do localStorage) ----------
export const loadSession = (): Session | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const saveSession = (s: Session | null) => {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
};

export const hasAnyPassword = (data: AppData): boolean => {
  const access = data.access || {};
  return !!(access.adminPassword || access.analystPassword) || data.companies.some(c => !!c.clientPassword);
};

export const authenticate = (data: AppData, password: string): Session | null => {
  // Configuração inicial: sem nenhuma senha cadastrada, libera como Administrador
  // para que seja possível definir as senhas dentro do app.
  if (!hasAnyPassword(data)) return { role: 'admin', label: 'Administrador' };
  const pwd = (password || '').trim();
  if (!pwd) return null;
  const access = data.access || {};
  if (access.adminPassword && pwd === access.adminPassword) return { role: 'admin', label: 'Administrador' };
  if (access.analystPassword && pwd === access.analystPassword) return { role: 'analyst', label: 'Analista Contábil' };
  const comp = data.companies.find(c => c.clientPassword && c.clientPassword === pwd);
  if (comp) return { role: 'client', companyId: comp.id, label: comp.nomeFantasia };
  return null;
};

// Cliente enxerga apenas a própria empresa (dados filtrados para leitura).
export const scopeDataForSession = (data: AppData, session: Session | null): AppData => {
  if (!session || session.role !== 'client' || !session.companyId) return data;
  const cid = session.companyId;
  const partners = data.partners.filter(p => (p.companyIds || []).includes(cid));
  const partnerIds = new Set(partners.map(p => p.id));
  return {
    ...data,
    companies: data.companies.filter(c => c.id === cid),
    partners,
    bankAccounts: data.bankAccounts.filter(a =>
      (a.ownerType === 'COMPANY' && a.ownerId === cid) ||
      (a.ownerType === 'PARTNER' && partnerIds.has(a.ownerId))
    ),
    transactions: data.transactions.filter(t => t.companyId === cid),
    mutuos: (data.mutuos || []).filter(m => m.companyId === cid),
  };
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

export interface MutuoCalculo {
  dias: number;
  juros: number;
  iofFixo: number;
  iofDiario: number;
  iof: number;
  iofAplicavel: boolean;
  irrfAliquota: number;
  irrfJuros: number;
  totalComJuros: number;   // principal + juros
  alertaSemJuros: boolean; // empresa -> sócio sem juros (risco de distribuição disfarçada)
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
    alertaSemJuros: iofAplicavel && m.annualInterestPct <= 0,
  };
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};
