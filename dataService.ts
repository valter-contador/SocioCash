
import { AppData, Company, Partner, BankAccount, Transaction, TransactionType } from './types';

const STORAGE_KEY = 'sociocash_data';

export const initialData: AppData = {
  companies: [],
  partners: [],
  bankAccounts: [],
  transactions: [],
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

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};
