import type { Activity } from '@alcaravan/shared';
import type { Expense } from './billing';
import { apiFetch } from './client';
import type { Invoice } from './billing';

// ── Tesorería (extractos y conciliación) ──

export interface BankMovement {
  id: string;
  account_label: string;
  booked_on: string;
  description: string;
  amount_cents: number;
  journal_entry_id: string | null;
  journal_entry_number: string | null;
  reconciled_at: string | null;
}
export interface Candidate {
  journal_entry_id: string;
  entry_number: string;
  entry_date: string;
  reference: string;
  concept: string;
  amount_cents: number;
  days_apart: number;
}
export interface TreasurySummary {
  movements: number;
  pending: number;
  bank_ledger_cents: number;
  cash_ledger_cents: number;
  bank_lines_in_year: number;
  bank_lines_reconciled: number;
}

export const treasuryKeys = {
  all: ['treasury'] as const,
  summary: (year: number) => ['treasury', 'summary', year] as const,
  movements: (year: number, status: string) => ['treasury', 'movements', year, status] as const,
  candidates: (id: string) => ['treasury', 'candidates', id] as const,
};
export const treasurySummary = (year: number, signal?: AbortSignal) =>
  apiFetch<TreasurySummary>('/treasury/summary', { query: { year }, signal });
export const listBankMovements = (year: number, status: string, signal?: AbortSignal) =>
  apiFetch<BankMovement[]>('/treasury/bank-movements', {
    query: { year, status: status || undefined },
    signal,
  });
export const importBankMovements = (body: {
  account_label: string;
  rows: { booked_on: string; description: string; amount_cents: number }[];
}) =>
  apiFetch<{ imported: number; duplicates: number }>('/treasury/bank-movements/import', {
    method: 'POST',
    body,
  });
export const bankCandidates = (id: string, signal?: AbortSignal) =>
  apiFetch<Candidate[]>(`/treasury/bank-movements/${id}/candidates`, { signal });
export const reconcileMovement = (id: string, journalEntryId: string) =>
  apiFetch<BankMovement>(`/treasury/bank-movements/${id}/reconcile`, {
    method: 'POST',
    body: { journal_entry_id: journalEntryId },
  });
export const unreconcileMovement = (id: string) =>
  apiFetch<BankMovement>(`/treasury/bank-movements/${id}/unreconcile`, { method: 'POST' });
export const deleteBankMovement = (id: string) =>
  apiFetch<void>(`/treasury/bank-movements/${id}`, { method: 'DELETE' });

// ── Presupuestos ──

export interface BudgetLine {
  id: string;
  year: number;
  activity: Activity;
  kind: 'INCOME' | 'EXPENSE';
  account_prefix: string;
  label: string;
  amount_cents: number;
  actual_cents: number;
  deviation_cents: number;
}
export interface BudgetReport {
  lines: BudgetLine[];
  income_budget_cents: number;
  income_actual_cents: number;
  expense_budget_cents: number;
  expense_actual_cents: number;
}
export type BudgetInput = Pick<
  BudgetLine,
  'year' | 'activity' | 'kind' | 'account_prefix' | 'label' | 'amount_cents'
>;
export const budgetKeys = {
  all: ['budgets'] as const,
  report: (year: number, activity: string) => ['budgets', year, activity] as const,
};
export const getBudget = (year: number, activity: string, signal?: AbortSignal) =>
  apiFetch<BudgetReport>('/budgets', { query: { year, activity: activity || undefined }, signal });
export const createBudgetLine = (body: BudgetInput) =>
  apiFetch<BudgetLine>('/budgets', { method: 'POST', body });
export const updateBudgetLine = (id: string, body: Partial<BudgetInput>) =>
  apiFetch<BudgetLine>(`/budgets/${id}`, { method: 'PATCH', body });
export const deleteBudgetLine = (id: string) =>
  apiFetch<void>(`/budgets/${id}`, { method: 'DELETE' });
export const copyBudgetYear = (year: number) =>
  apiFetch<{ copied: number }>('/budgets/copy-year', { method: 'POST', query: { year } });

// ── Fiscalidad ──

export interface IgicRow {
  date: string;
  number: string;
  party_name: string;
  party_tax_id: string | null;
  activity: string;
  base_cents: number;
  tax_rate: number;
  tax_cents: number;
}
export interface IgicReport {
  from: string;
  to: string;
  issued: IgicRow[];
  received: IgicRow[];
  issued_by_rate: { tax_rate: number; base_cents: number; tax_cents: number }[];
  received_by_rate: { tax_rate: number; base_cents: number; tax_cents: number }[];
  output_tax_cents: number;
  input_tax_cents: number;
  difference_cents: number;
}
export interface WithholdingRow {
  paid_on: string;
  party_name: string;
  party_tax_id: string | null;
  reference: string;
  base_cents: number;
  withholding_rate: number | null;
  withholding_cents: number;
}
export interface WithholdingsReport {
  professionals: WithholdingRow[];
  employees: WithholdingRow[];
  professionals_total_cents: number;
  employees_total_cents: number;
  total_cents: number;
}
export const taxKeys = {
  igic: (year: number, quarter: number) => ['tax', 'igic', year, quarter] as const,
  withholdings: (year: number, quarter: number) => ['tax', 'withholdings', year, quarter] as const,
};
export const getIgic = (year: number, quarter: number, signal?: AbortSignal) =>
  apiFetch<IgicReport>('/tax/igic', { query: { year, quarter }, signal });
export const getWithholdings = (year: number, quarter: number, signal?: AbortSignal) =>
  apiFetch<WithholdingsReport>('/tax/withholdings', { query: { year, quarter }, signal });

// ── Subvenciones ──

export const GRANT_STATUSES = [
  'PENDING',
  'IN_PREPARATION',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];
export interface Grant {
  id: string;
  issuer: string;
  title: string;
  year: number;
  activity: Activity;
  awarded_cents: number;
  received_cents: number;
  justification_deadline: string | null;
  status: GrantStatus;
  reference: string | null;
  notes: string | null;
  justified_cents: number;
  expenses: Expense[];
}
export type GrantInput = Omit<Grant, 'id' | 'justified_cents' | 'expenses'>;
export const grantKeys = {
  all: ['grants'] as const,
  list: (year: number) => ['grants', year] as const,
};
export const listGrants = (year: number, signal?: AbortSignal) =>
  apiFetch<Grant[]>('/grants', { query: { year }, signal });
export const createGrant = (body: GrantInput) =>
  apiFetch<Grant>('/grants', { method: 'POST', body });
export const updateGrant = (id: string, body: Partial<GrantInput>) =>
  apiFetch<Grant>(`/grants/${id}`, { method: 'PATCH', body });
export const deleteGrant = (id: string) => apiFetch<void>(`/grants/${id}`, { method: 'DELETE' });
export const linkGrantExpense = (id: string, expenseId: string) =>
  apiFetch<Grant>(`/grants/${id}/expenses`, { method: 'POST', body: { expense_id: expenseId } });
export const unlinkGrantExpense = (id: string, expenseId: string) =>
  apiFetch<Grant>(`/grants/${id}/expenses/${expenseId}`, { method: 'DELETE' });

// ── Tesorería interna ──

export const CASH_CATEGORIES = ['RAFFLE', 'MUSIC_REINFORCEMENT', 'EVENT', 'CASH', 'OTHER'] as const;
export type CashCategory = (typeof CASH_CATEGORIES)[number];
export interface CashMovement {
  id: string;
  occurred_on: string;
  direction: 'IN' | 'OUT';
  amount_cents: number;
  activity: Activity;
  category: CashCategory;
  concept: string;
  notes: string | null;
  review: 'PENDING' | 'REVIEWED';
}
export type CashInput = Omit<CashMovement, 'id'>;
export interface CashReport {
  movements: CashMovement[];
  in_cents: number;
  out_cents: number;
  balance_cents: number;
  pending_review: number;
}
export const cashKeys = {
  all: ['internal-cash'] as const,
  report: (params: object) => ['internal-cash', params] as const,
};
export const getCashReport = (
  params: { from?: string; to?: string; activity?: string },
  signal?: AbortSignal,
) => apiFetch<CashReport>('/internal-cash', { query: params, signal });
export const createCashMovement = (body: CashInput) =>
  apiFetch<CashMovement>('/internal-cash', { method: 'POST', body });
export const updateCashMovement = (id: string, body: Partial<CashInput>) =>
  apiFetch<CashMovement>(`/internal-cash/${id}`, { method: 'PATCH', body });
export const deleteCashMovement = (id: string) =>
  apiFetch<void>(`/internal-cash/${id}`, { method: 'DELETE' });

// ── Panel de inicio ──

export interface Dashboard {
  year: number;
  invoices: {
    count: number;
    total_cents: number;
    pending_count: number;
    pending_cents: number;
  } | null;
  expenses: {
    count: number;
    total_cents: number;
    pending_count: number;
    pending_cents: number;
  } | null;
  school: {
    active_students: number;
    fees_total_cents: number;
    fees_pending_cents: number;
    fees_pending_count: number;
  } | null;
  recent_invoices: Invoice[];
  alerts: { kind: string; count: number; detail: string | null }[];
}
export const dashboardKey = (year: number) => ['dashboard', year] as const;
export const getDashboard = (year: number, signal?: AbortSignal) =>
  apiFetch<Dashboard>('/dashboard', { query: { year }, signal });

// ── Documentos (PDF de gastos) ──

export interface StoredDocument {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}
export const documentKeys = {
  forEntity: (type: string, id: string) => ['documents', type, id] as const,
};
export const listEntityDocuments = (entityType: string, entityId: string, signal?: AbortSignal) =>
  apiFetch<{ data: StoredDocument[] }>('/documents', {
    query: { entity_type: entityType, entity_id: entityId },
    signal,
  });
export function uploadEntityDocument(entityType: string, entityId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  form.append('category', 'INVOICE');
  form.append('entity_type', entityType);
  form.append('entity_id', entityId);
  return apiFetch<StoredDocument>('/documents', { method: 'POST', body: form });
}
export const documentDownloadUrl = (id: string) =>
  apiFetch<{ url: string }>(`/documents/${id}/download-url`, { method: 'POST' });
