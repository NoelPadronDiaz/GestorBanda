import type { Activity } from '@alcaravan/shared';
import type { InvoiceStatus, PaymentMethod } from './billing';
import { apiFetch } from './client';

export const MODALITIES = ['EARLY_MUSIC', 'SOLFEGE', 'SOLFEGE_INSTRUMENT', 'INSTRUMENT'] as const;
export type Modality = (typeof MODALITIES)[number];
export const TARIFF_KINDS = ['ORDINARY', 'BAND_MEMBER', 'SIBLINGS', 'CUSTOM'] as const;
export type TariffKind = (typeof TARIFF_KINDS)[number];
export const TARIFF_KEYS = [
  'EARLY_MUSIC',
  'SOLFEGE',
  'SOLFEGE_INSTRUMENT',
  'INSTRUMENT',
  'BAND_MEMBER',
  'SIBLINGS',
] as const;
export type TariffKey = (typeof TARIFF_KEYS)[number];

export interface Student {
  id: string;
  member_id: string | null;
  full_name: string;
  family_label: string | null;
  modality: Modality;
  tariff_kind: TariffKind;
  custom_fee_cents: number | null;
  monthly_fee_cents: number | null;
  status: 'ACTIVE' | 'WITHDRAWN';
  enrolled_on: string | null;
  payment_method: PaymentMethod | null;
  billing_name: string | null;
  billing_tax_id: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  missing_billing_fields: string[];
  notes: string | null;
}
export type StudentInput = Omit<Student, 'id' | 'monthly_fee_cents' | 'missing_billing_fields'>;

export interface Tariff {
  key: TariffKey;
  amount_cents: number | null;
}

export interface Fee {
  id: string;
  student_id: string;
  student_name: string;
  period: string;
  amount_cents: number;
  invoice_id: string;
  invoice_code: string;
  status: InvoiceStatus;
  paid_on: string | null;
}

export interface GenerateFeesResult {
  created: Fee[];
  skipped: { student_id: string; student_name: string; reason: string; missing_fields: string[] }[];
  already_existing: number;
}

export interface Worker {
  id: string;
  full_name: string;
  role_title: string | null;
  member_id: string | null;
  activity: Activity;
  active: boolean;
}
export type WorkerInput = Omit<Worker, 'id'>;

export interface Payroll {
  id: string;
  worker_id: string;
  worker_name: string;
  period: string;
  accrual_date: string;
  activity: Activity;
  gross_cents: number;
  employee_ss_cents: number;
  irpf_cents: number;
  other_deductions_cents: number;
  employer_ss_cents: number;
  net_cents: number;
  cost_cents: number;
  status: 'PENDING' | 'PAID';
  paid_on: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  journal_entry_id: string | null;
  payment_entry_id: string | null;
}
export interface PayrollInput {
  worker_id: string;
  period: string;
  accrual_date: string;
  activity: Activity;
  gross_cents: number;
  employee_ss_cents: number;
  irpf_cents: number;
  other_deductions_cents: number;
  employer_ss_cents: number;
  notes: string | null;
}

export const schoolKeys = {
  all: ['school'] as const,
  students: ['school', 'students'] as const,
  tariffs: ['school', 'tariffs'] as const,
  fees: (period?: string) => ['school', 'fees', period ?? 'all'] as const,
};
export const payrollKeys = {
  all: ['payroll'] as const,
  workers: ['payroll', 'workers'] as const,
  payrolls: (year: number) => ['payroll', 'payrolls', year] as const,
};

export const listStudents = (signal?: AbortSignal) =>
  apiFetch<Student[]>('/school/students', { signal });
export const createStudent = (body: StudentInput) =>
  apiFetch<Student>('/school/students', { method: 'POST', body });
export const updateStudent = (id: string, body: Partial<StudentInput>) =>
  apiFetch<Student>(`/school/students/${id}`, { method: 'PATCH', body });
export const deleteStudent = (id: string) =>
  apiFetch<void>(`/school/students/${id}`, { method: 'DELETE' });
export const listTariffs = (signal?: AbortSignal) =>
  apiFetch<Tariff[]>('/school/tariffs', { signal });
export const updateTariffs = (tariffs: Tariff[]) =>
  apiFetch<Tariff[]>('/school/tariffs', { method: 'PUT', body: { tariffs } });
export const listFees = (period: string | undefined, signal?: AbortSignal) =>
  apiFetch<Fee[]>('/school/fees', { query: { period }, signal });
export const generateFees = (body: { period: string; issue_date?: string }) =>
  apiFetch<GenerateFeesResult>('/school/fees/generate', { method: 'POST', body });

export const listWorkers = (signal?: AbortSignal) =>
  apiFetch<Worker[]>('/payroll/workers', { signal });
export const createWorker = (body: WorkerInput) =>
  apiFetch<Worker>('/payroll/workers', { method: 'POST', body });
export const updateWorker = (id: string, body: Partial<WorkerInput>) =>
  apiFetch<Worker>(`/payroll/workers/${id}`, { method: 'PATCH', body });
export const deleteWorker = (id: string) =>
  apiFetch<void>(`/payroll/workers/${id}`, { method: 'DELETE' });
export const listPayrolls = (year: number, signal?: AbortSignal) =>
  apiFetch<Payroll[]>('/payroll/payrolls', { query: { year }, signal });
export const createPayroll = (body: PayrollInput) =>
  apiFetch<Payroll>('/payroll/payrolls', { method: 'POST', body });
export const updatePayroll = (id: string, body: Partial<PayrollInput>) =>
  apiFetch<Payroll>(`/payroll/payrolls/${id}`, { method: 'PATCH', body });
export const markPayrollPaid = (
  id: string,
  body: { paid_on: string; payment_method: PaymentMethod },
) => apiFetch<Payroll>(`/payroll/payrolls/${id}/mark-paid`, { method: 'POST', body });
export const markPayrollPending = (id: string) =>
  apiFetch<Payroll>(`/payroll/payrolls/${id}/mark-pending`, { method: 'POST' });
export const deletePayroll = (id: string) =>
  apiFetch<void>(`/payroll/payrolls/${id}`, { method: 'DELETE' });
