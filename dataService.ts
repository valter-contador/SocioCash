
import { AppData, Company, Partner, BankAccount, Transaction, TransactionType, Session } from './types';

const STORAGE_KEY = 'sociocash_data';
const SESSION_KEY = 'sociocash_session';

export const initialData: AppData = {
  companies: [],
  partners: [],
  bankAccounts: [],
  transactions: [],
  access: { adminPassword: '', analystPassword: '' },
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

export const authenticate = (data: AppData, password: string): Session | null => {
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

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};
