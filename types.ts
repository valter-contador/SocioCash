
export enum TransactionType {
  CREDIT = 'CREDIT', // Aporte a crédito (entrada)
  DEBIT = 'DEBIT'    // Aporte a débito (saída/devolução)
}

export enum AccountType {
  CHECKING = 'Corrente',
  SAVINGS = 'Poupança',
  INVESTMENT = 'Investimento',
  OTHER = 'Outra'
}

export interface BankAccount {
  id: string;
  ownerId: string; // ID of Company or Partner
  ownerType: 'COMPANY' | 'PARTNER';
  bankName: string;
  agency: string;
  accountNumber: string;
  type: AccountType;
}

export interface Company {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  tipo: string; // LTDA, SLU, etc.
}

export interface Partner {
  id: string;
  name: string;
  cpf: string;
  participation: number; // Percentage
  companyIds: string[];
}

export interface Transaction {
  id: string;
  date: string;
  companyId: string;
  partnerId?: string;
  originAccountId: string;
  destinationAccountId: string;
  value: number;
  type: TransactionType;
  description: string;
}

export interface User {
  email: string;
  name: string;
}

export interface AppData {
  companies: Company[];
  partners: Partner[];
  bankAccounts: BankAccount[];
  transactions: Transaction[];
}
