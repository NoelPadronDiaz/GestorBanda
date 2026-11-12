import type { Activity } from '@alcaravan/shared';
import { apiFetch } from './client';
import type { Paginated } from './types';

export type SourceType =
  | 'MANUAL'
  | 'OPENING'
  | 'INVOICE'
  | 'INVOICE_PAYMENT'
  | 'EXPENSE'
  | 'EXPENSE_PAYMENT'
  | 'PAYROLL'
  | 'PAYROLL_PAYMENT'
  | 'REVERSAL'
  | 'REGULARIZATION'
  | 'CLOSING';
export type DocumentSource = Exclude<
  SourceType,
  'MANUAL' | 'OPENING' | 'REVERSAL' | 'REGULARIZATION' | 'CLOSING'
>;

export interface Account {
  code: string;
  name: string;
}

export interface DraftLine {
  account_code: string;
  description: string | null;
  debit_cents: number;
  credit_cents: number;
}

export interface EntryDraft {
  source_type: SourceType;
  source_id?: string;
  entry_date: string;
  activity: Activity;
  reference: string;
  concept: string;
  lines: DraftLine[];
  warnings?: string[];
}

export interface Entry {
  id: string;
  year: number;
  sequence: number;
  number: string;
  entry_date: string;
  activity: Activity;
  reference: string;
  concept: string;
  source_type: SourceType;
  source_id: string | null;
  reversal_of_id: string | null;
  reversed_by_id: string | null;
  total_cents: number;
  lines: (DraftLine & { position: number; account_name: string })[];
}

export interface Ledger {
  account_code: string;
  account_name: string;
  opening_balance_cents: number;
  closing_balance_cents: number;
  movements: {
    entry_id: string;
    entry_number: string;
    entry_date: string;
    reference: string;
    concept: string;
    description: string | null;
    debit_cents: number;
    credit_cents: number;
    balance_cents: number;
  }[];
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  debit_cents: number;
  credit_cents: number;
  balance_cents: number;
}

export interface ReportLine {
  account_code: string;
  account_name: string;
  amount_cents: number;
}

export interface IncomeStatement {
  income: ReportLine[];
  expenses: ReportLine[];
  income_total_cents: number;
  expenses_total_cents: number;
  result_cents: number;
}

export interface BalanceSheet {
  assets: ReportLine[];
  liabilities: ReportLine[];
  equity: ReportLine[];
  pending_result_cents: number;
  assets_total_cents: number;
  liabilities_total_cents: number;
  equity_total_cents: number;
  difference_cents: number;
  warnings: string[];
}

export interface FiscalYear {
  year: number;
  status: 'OPEN' | 'CLOSED';
  closed_at: string | null;
  entry_count: number;
}

export interface ClosePreview {
  year: number;
  status: 'OPEN' | 'CLOSED';
  ordinary_entry_count: number;
  surplus_cents: number;
  regularization: DraftLine[];
  closing: DraftLine[];
  blockers: string[];
  warnings: string[];
}

export const accountingKeys = {
  all: ['accounting'] as const,
  accounts: ['accounting', 'accounts'] as const,
  entries: (params: object) => ['accounting', 'entries', params] as const,
  ledger: (year: number, account: string) => ['accounting', 'ledger', year, account] as const,
  trial: (year: number, activity?: string) =>
    ['accounting', 'trial', year, activity ?? ''] as const,
  income: (year: number, activity?: string) =>
    ['accounting', 'income', year, activity ?? ''] as const,
  balance: (year: number) => ['accounting', 'balance', year] as const,
  years: ['accounting', 'years'] as const,
  closePreview: (year: number) => ['accounting', 'close-preview', year] as const,
};

export const listAccounts = (signal?: AbortSignal) =>
  apiFetch<Account[]>('/accounting/accounts', { signal });
export const createAccount = (body: Account) =>
  apiFetch<Account>('/accounting/accounts', { method: 'POST', body });

export interface EntryFilters {
  page: number;
  page_size: number;
  year?: number;
  activity?: Activity;
  source_type?: SourceType;
  account?: string;
}
export const listEntries = (params: EntryFilters, signal?: AbortSignal) =>
  apiFetch<Paginated<Entry>>('/accounting/entries', { query: { ...params }, signal });
export const getProposal = (params: {
  source_type: DocumentSource;
  source_id: string;
  igic_deductible?: boolean;
  via?: 'BANK' | 'CASH';
  date?: string;
}) =>
  apiFetch<EntryDraft>('/accounting/proposals', {
    query: {
      ...params,
      igic_deductible:
        params.igic_deductible === undefined ? undefined : String(params.igic_deductible),
    },
  });
export const postEntry = (body: EntryDraft) =>
  apiFetch<Entry>('/accounting/entries', {
    method: 'POST',
    body: {
      entry_date: body.entry_date,
      activity: body.activity,
      reference: body.reference,
      concept: body.concept,
      source_type: body.source_type,
      source_id: body.source_id,
      lines: body.lines,
    },
  });
export const reverseEntry = (id: string) =>
  apiFetch<Entry>(`/accounting/entries/${id}/reverse`, { method: 'POST' });

export const getLedger = (year: number, account: string, signal?: AbortSignal) =>
  apiFetch<Ledger>('/accounting/ledger', { query: { year, account }, signal });
export const getTrialBalance = (year: number, activity?: string, signal?: AbortSignal) =>
  apiFetch<TrialBalanceRow[]>('/accounting/trial-balance', { query: { year, activity }, signal });
export const getIncomeStatement = (year: number, activity?: string, signal?: AbortSignal) =>
  apiFetch<IncomeStatement>('/accounting/income-statement', { query: { year, activity }, signal });
export const getBalanceSheet = (year: number, signal?: AbortSignal) =>
  apiFetch<BalanceSheet>('/accounting/balance-sheet', { query: { year }, signal });
export const listFiscalYears = (signal?: AbortSignal) =>
  apiFetch<FiscalYear[]>('/accounting/fiscal-years', { signal });
export const getClosePreview = (year: number, signal?: AbortSignal) =>
  apiFetch<ClosePreview>(`/accounting/fiscal-years/${year}/close-preview`, { signal });
export const closeFiscalYear = (year: number) =>
  apiFetch<ClosePreview>(`/accounting/fiscal-years/${year}/close`, { method: 'POST' });

export interface PendingDocument {
  source_type: DocumentSource;
  source_id: string;
  date: string;
  label: string;
  activity: Activity;
  amount_cents: number;
  has_input_tax: boolean;
}
export const pendingKey = (year: number) => ['accounting', 'pending', year] as const;
export const listPending = (year: number, signal?: AbortSignal) =>
  apiFetch<PendingDocument[]>('/accounting/pending', { query: { year }, signal });
