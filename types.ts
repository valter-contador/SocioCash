
export enum TransactionType {
  CREDIT = 'CREDIT', // Aporte a crédito (entrada)
  DEBIT = 'DEBIT'    // Aporte a débito (saída/devolução)
}

// Natureza Operacional do lançamento. Cada natureza carrega a sua direção
// contábil (entrada/CREDIT do sócio para a empresa, ou saída/DEBIT da empresa
// para o sócio), o que mantém a lógica de conta origem/destino automática.
export enum TransactionNature {
  APORTE_CAPITAL = 'APORTE_CAPITAL',
  EMPRESTIMO = 'EMPRESTIMO',
  DEVOLUCAO_APORTE = 'DEVOLUCAO_APORTE',
  RETIRADA_LUCROS = 'RETIRADA_LUCROS',
  PRO_LABORE = 'PRO_LABORE',
  PAGTO_EMPRESTIMO = 'PAGTO_EMPRESTIMO'
}

// Metadados de cada natureza: rótulo exibido e direção contábil associada.
export const NATURE_META: Record<TransactionNature, { label: string; type: TransactionType }> = {
  [TransactionNature.APORTE_CAPITAL]:   { label: 'Aporte de Capital',   type: TransactionType.CREDIT }, // sócio -> empresa
  [TransactionNature.DEVOLUCAO_APORTE]: { label: 'Devolução de Aporte', type: TransactionType.DEBIT },  // empresa -> sócio
  [TransactionNature.RETIRADA_LUCROS]:  { label: 'Retirada de Lucros',  type: TransactionType.DEBIT },  // empresa -> sócio
  [TransactionNature.PRO_LABORE]:       { label: 'Pró-Labore',          type: TransactionType.DEBIT },  // empresa -> sócio
  [TransactionNature.EMPRESTIMO]:       { label: 'Empréstimo',          type: TransactionType.DEBIT },  // empresa empresta ao sócio (saída)
  [TransactionNature.PAGTO_EMPRESTIMO]: { label: 'Pagto Empréstimo',    type: TransactionType.CREDIT }  // sócio devolve o empréstimo (entrada)
};

// Ordem de exibição no seletor.
export const NATURE_ORDER: TransactionNature[] = [
  TransactionNature.APORTE_CAPITAL,
  TransactionNature.DEVOLUCAO_APORTE,
  TransactionNature.RETIRADA_LUCROS,
  TransactionNature.PRO_LABORE,
  TransactionNature.EMPRESTIMO,
  TransactionNature.PAGTO_EMPRESTIMO
];

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
  clientPassword?: string; // Senha de acesso do cliente (por empresa)
}

// Controle de acesso GLOBAL (equipe JC Buarque). Observação: app sem backend —
// senhas ficam no localStorage e NÃO são segurança real, apenas uma trava simples.
export interface AccessConfig {
  adminPassword?: string;   // Administrador
  analystPassword?: string; // Analista Contábil
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
  nature?: TransactionNature; // Natureza operacional (opcional p/ retrocompatibilidade)
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
  access?: AccessConfig; // Senhas globais (admin / analista contábil)
}
