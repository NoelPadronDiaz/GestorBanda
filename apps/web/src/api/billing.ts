import type { Activity, InvoiceSeriesCode } from '@alcaravan/shared';
import { apiFetch } from './client';
import type { Paginated } from './types';

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'DIRECT_DEBIT' | 'CARD' | 'OTHER';
export const PAYMENT_METHODS: PaymentMethod[] = [
  'BANK_TRANSFER',
  'CASH',
  'DIRECT_DEBIT',
  'CARD',
  'OTHER',
];
export type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface Client {
  id: string;
  name: string;
  tax_id: string | null;
  address_line: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}
export type ClientInput = Omit<Client, 'id'>;

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
  amount_cents?: number;
}

export interface Invoice {
  id: string;
  series: InvoiceSeriesCode;
  year: number;
  number: number;
  code: string;
  issue_date: string;
  operation_date: string | null;
  client_id: string | null;
  recipient: {
    name: string;
    tax_id: string | null;
    address_line: string | null;
    city: string | null;
    email: string | null;
  };
  tax_rate: number;
  withholding_rate: number;
  base_cents: number;
  tax_cents: number;
  withholding_cents: number;
  total_cents: number;
  status: InvoiceStatus;
  paid_on: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  journal_entry_id: string | null;
  payment_entry_id: string | null;
  student_fee_id: string | null;
  lines: (InvoiceLine & { position: number; amount_cents: number })[];
}

export interface InvoiceInput {
  series: InvoiceSeriesCode;
  issue_date: string;
  operation_date: string | null;
  client_id: string;
  tax_rate: number;
  withholding_rate: number;
  notes: string | null;
  lines: InvoiceLine[];
}

export type SupplierKind = 'COMPANY' | 'PROFESSIONAL' | 'OTHER';
export interface Supplier {
  id: string;
  name: string;
  tax_id: string | null;
  kind: SupplierKind;
  default_withholding_rate: number;
  address_line: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
}
export type SupplierInput = Omit<Supplier, 'id'>;

export const EXPENSE_CATEGORIES = [
  'PROFESSIONAL_SERVICES',
  'TEACHING_REINFORCEMENT',
  'MATERIALS_INSTRUMENTS',
  'SUPPLIES',
  'RENT',
  'INSURANCE',
  'OTHER',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_tax_id: string | null;
  number: string;
  issue_date: string;
  operation_date: string | null;
  activity: Activity;
  category: ExpenseCategory;
  concept: string;
  base_cents: number;
  tax_rate: number;
  tax_cents: number;
  other_cents: number;
  withholding_rate: number;
  withholding_cents: number;
  total_cents: number;
  status: 'PENDING' | 'PAID';
  paid_on: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  journal_entry_id: string | null;
  payment_entry_id: string | null;
}

export interface ExpenseInput {
  supplier_id: string;
  number: string;
  issue_date: string;
  operation_date: string | null;
  activity: Activity;
  category: ExpenseCategory;
  concept: string;
  base_cents: number;
  tax_rate: number;
  tax_cents: number;
  other_cents: number;
  withholding_rate: number;
  withholding_cents: number;
  notes: string | null;
}

export interface ExpenseTotals {
  count: number;
  total_cents: number;
  pending_count: number;
  pending_cents: number;
}

export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export interface RecurringExpense {
  id: string;
  concept: string;
  party_type: 'SUPPLIER' | 'WORKER';
  supplier_id: string | null;
  worker_id: string | null;
  party_name: string | null;
  activity: Activity;
  amount_cents: number;
  frequency: Frequency;
  next_due_on: string;
  active: boolean;
}
export type RecurringInput = Omit<RecurringExpense, 'id' | 'party_name'>;

export interface PaymentInput {
  paid_on: string;
  payment_method: PaymentMethod;
}

export const billingKeys = {
  all: ['billing'] as const,
  clients: (q?: string) => ['billing', 'clients', q ?? ''] as const,
  invoices: (params: object) => ['billing', 'invoices', params] as const,
  invoice: (id: string) => ['billing', 'invoice', id] as const,
  nextNumber: (series: string, year: number) => ['billing', 'next-number', series, year] as const,
  suppliers: ['billing', 'suppliers'] as const,
  expenses: (params: object) => ['billing', 'expenses', params] as const,
  expenseTotals: (year?: number) => ['billing', 'expense-totals', year ?? 'all'] as const,
  recurring: ['billing', 'recurring'] as const,
};

// Clientes
export const listClients = (q?: string, signal?: AbortSignal) =>
  apiFetch<Paginated<Client>>('/billing/clients', { query: { q, page_size: 100 }, signal });
export const createClient = (body: ClientInput) =>
  apiFetch<Client>('/billing/clients', { method: 'POST', body });
export const updateClient = (id: string, body: Partial<ClientInput>) =>
  apiFetch<Client>(`/billing/clients/${id}`, { method: 'PATCH', body });
export const deleteClient = (id: string) =>
  apiFetch<void>(`/billing/clients/${id}`, { method: 'DELETE' });

// Facturas
export interface InvoiceFilters {
  page: number;
  page_size: number;
  year?: number;
  series?: InvoiceSeriesCode;
  status?: InvoiceStatus;
  q?: string;
}
export const listInvoices = (params: InvoiceFilters, signal?: AbortSignal) =>
  apiFetch<Paginated<Invoice>>('/billing/invoices', { query: { ...params }, signal });
export const getInvoice = (id: string, signal?: AbortSignal) =>
  apiFetch<Invoice>(`/billing/invoices/${id}`, { signal });
export const nextInvoiceNumber = (series: string, year: number, signal?: AbortSignal) =>
  apiFetch<{ code: string }>('/billing/invoices/next-number', { query: { series, year }, signal });
export const createInvoice = (body: InvoiceInput) =>
  apiFetch<Invoice>('/billing/invoices', { method: 'POST', body });
export const updateInvoice = (id: string, body: Partial<Omit<InvoiceInput, 'series'>>) =>
  apiFetch<Invoice>(`/billing/invoices/${id}`, { method: 'PATCH', body });
export const markInvoicePaid = (id: string, body: PaymentInput) =>
  apiFetch<Invoice>(`/billing/invoices/${id}/mark-paid`, { method: 'POST', body });
export const markInvoicePending = (id: string) =>
  apiFetch<Invoice>(`/billing/invoices/${id}/mark-pending`, { method: 'POST' });
export const cancelInvoice = (id: string) =>
  apiFetch<Invoice>(`/billing/invoices/${id}/cancel`, { method: 'POST' });

// Proveedores y gastos
export const listSuppliers = (signal?: AbortSignal) =>
  apiFetch<Supplier[]>('/billing/suppliers', { signal });
export const createSupplier = (body: SupplierInput) =>
  apiFetch<Supplier>('/billing/suppliers', { method: 'POST', body });
export const updateSupplier = (id: string, body: Partial<SupplierInput>) =>
  apiFetch<Supplier>(`/billing/suppliers/${id}`, { method: 'PATCH', body });
export const deleteSupplier = (id: string) =>
  apiFetch<void>(`/billing/suppliers/${id}`, { method: 'DELETE' });

export interface ExpenseFilters {
  page: number;
  page_size: number;
  year?: number;
  activity?: Activity;
  status?: 'PENDING' | 'PAID';
  q?: string;
}
export const listExpenses = (params: ExpenseFilters, signal?: AbortSignal) =>
  apiFetch<Paginated<Expense>>('/billing/expenses', { query: { ...params }, signal });
export const expenseTotals = (year?: number, signal?: AbortSignal) =>
  apiFetch<ExpenseTotals>('/billing/expenses/totals', { query: { year }, signal });
export const createExpense = (body: ExpenseInput) =>
  apiFetch<Expense>('/billing/expenses', { method: 'POST', body });
export const updateExpense = (id: string, body: Partial<ExpenseInput>) =>
  apiFetch<Expense>(`/billing/expenses/${id}`, { method: 'PATCH', body });
export const markExpensePaid = (id: string, body: PaymentInput) =>
  apiFetch<Expense>(`/billing/expenses/${id}/mark-paid`, { method: 'POST', body });
export const markExpensePending = (id: string) =>
  apiFetch<Expense>(`/billing/expenses/${id}/mark-pending`, { method: 'POST' });
export const deleteExpense = (id: string) =>
  apiFetch<void>(`/billing/expenses/${id}`, { method: 'DELETE' });

// Recurrentes
export const listRecurring = (signal?: AbortSignal) =>
  apiFetch<RecurringExpense[]>('/billing/recurring-expenses', { signal });
export const createRecurring = (body: RecurringInput) =>
  apiFetch<RecurringExpense>('/billing/recurring-expenses', { method: 'POST', body });
export const updateRecurring = (id: string, body: Partial<RecurringInput>) =>
  apiFetch<RecurringExpense>(`/billing/recurring-expenses/${id}`, { method: 'PATCH', body });
export const advanceRecurring = (id: string) =>
  apiFetch<RecurringExpense>(`/billing/recurring-expenses/${id}/advance`, { method: 'POST' });
export const deleteRecurring = (id: string) =>
  apiFetch<void>(`/billing/recurring-expenses/${id}`, { method: 'DELETE' });
