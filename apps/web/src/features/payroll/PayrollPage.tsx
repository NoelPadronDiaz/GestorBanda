import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { BookPlus, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ACTIVITIES } from '@alcaravan/shared';
import type { PaymentMethod } from '@/api/billing';
import {
  createPayroll,
  createWorker,
  deletePayroll,
  deleteWorker,
  listPayrolls,
  listWorkers,
  markPayrollPaid,
  markPayrollPending,
  payrollKeys,
  updatePayroll,
  updateWorker,
  type Payroll,
  type PayrollInput,
  type Worker,
  type WorkerInput,
} from '@/api/school';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import {
  FilterBar,
  FilterField,
  Notice,
  Page,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  Tabs,
} from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import {
  AccountingBadge,
  ActivityBadge,
  PaymentBadge,
  YearSelect,
} from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { PaymentDialog } from '@/features/shared/PaymentDialog';
import { PostEntryDialog, type PostTarget } from '@/features/shared/PostEntryDialog';
import { csvEuros, downloadCsv } from '@/lib/csv';
import {
  centsToInput,
  currentPeriod,
  currentYear,
  money,
  period as formatPeriod,
} from '@/lib/format';
import { cents, nullable, zEuros } from '@/lib/forms';
import { lastDayOfPeriod } from './period';

export function PayrollPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'payrolls' | 'workers'>('payrolls');
  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.school')}
        title={t('payroll.title')}
        description={t('payroll.subtitle')}
      />
      <Notice>{t('payroll.legalNotice')}</Notice>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'payrolls', label: t('payroll.tabs.payrolls') },
          { value: 'workers', label: t('payroll.tabs.workers') },
        ]}
      />
      {tab === 'payrolls' ? <PayrollsTab /> : <WorkersTab />}
    </Page>
  );
}

// ───────────── Nóminas ─────────────

function PayrollsTab() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [year, setYear] = useState(currentYear());
  const [editing, setEditing] = useState<Payroll | 'new' | null>(null);
  const [paying, setPaying] = useState<Payroll | null>(null);
  const [posting, setPosting] = useState<PostTarget | null>(null);
  const { data, isPending } = useQuery({
    queryKey: payrollKeys.payrolls(year),
    queryFn: ({ signal }) => listPayrolls(year, signal),
  });

  const invalidate = [payrollKeys.all, ['dashboard']];
  const pay = useAction(
    (input: { id: string; paid_on: string; payment_method: PaymentMethod }) =>
      markPayrollPaid(input.id, { paid_on: input.paid_on, payment_method: input.payment_method }),
    { invalidate, success: 'payroll.markedPaid', onSuccess: () => setPaying(null) },
  );
  const unpay = useAction(markPayrollPending, { invalidate, success: 'payroll.markedPending' });
  const remove = useAction(deletePayroll, { invalidate, success: 'payroll.deleted' });

  const sum = (key: 'gross_cents' | 'net_cents' | 'cost_cents' | 'irpf_cents') =>
    data?.reduce((s, p) => s + p[key], 0) ?? 0;

  const exportCsv = () =>
    data &&
    downloadCsv(`Alcaravan_Nominas_${year}.csv`, [
      [
        'Periodo',
        'Trabajador/a',
        'Actividad',
        'Bruto',
        'SS trabajador',
        'IRPF',
        'Otras retenciones',
        'Neto',
        'SS empresa',
        'Coste total',
        'Estado',
        'Fecha pago',
      ],
      ...data.map((p) => [
        p.period,
        p.worker_name,
        t(`activity.${p.activity}`),
        csvEuros(p.gross_cents),
        csvEuros(p.employee_ss_cents),
        csvEuros(p.irpf_cents),
        csvEuros(p.other_deductions_cents),
        csvEuros(p.net_cents),
        csvEuros(p.employer_ss_cents),
        csvEuros(p.cost_cents),
        t(`status.${p.status}`),
        p.paid_on,
      ]),
    ]);

  return (
    <>
      <StatGrid>
        <StatCard label={t('payroll.gross')} value={money(sum('gross_cents'))} />
        <StatCard label={t('payroll.net')} value={money(sum('net_cents'))} />
        <StatCard
          label={t('payroll.irpf')}
          value={money(sum('irpf_cents'))}
          hint={t('payroll.irpfHint')}
        />
        <StatCard label={t('payroll.cost')} value={money(sum('cost_cents'))} tone="gold" />
      </StatGrid>
      <Panel
        flush
        title={t('payroll.listTitle')}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={!data?.length} onClick={exportCsv}>
              <Download /> CSV
            </Button>
            {can('payroll.manage') && (
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus /> {t('payroll.new')}
              </Button>
            )}
          </>
        }
      >
        <div className="px-5 pb-3">
          <FilterBar>
            <FilterField label={t('common.year')}>
              <YearSelect value={year} onChange={setYear} />
            </FilterField>
          </FilterBar>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{t('school.period')}</Th>
              <Th>{t('payroll.worker')}</Th>
              <Th>{t('common.activity')}</Th>
              <Th numeric>{t('payroll.gross')}</Th>
              <Th numeric>{t('payroll.irpf')}</Th>
              <Th numeric>{t('payroll.net')}</Th>
              <Th numeric>{t('payroll.cost')}</Th>
              <Th>{t('common.status')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={9}>{t('common.loading')}</EmptyRow>}
            {data?.length === 0 && <EmptyRow colSpan={9}>{t('payroll.empty')}</EmptyRow>}
            {data?.map((p) => (
              <tr key={p.id}>
                <Td>{formatPeriod(p.period)}</Td>
                <Td className="font-semibold">{p.worker_name}</Td>
                <Td>
                  <ActivityBadge activity={p.activity} />
                </Td>
                <Td numeric>{money(p.gross_cents)}</Td>
                <Td numeric>{money(p.irpf_cents)}</Td>
                <Td numeric className="font-semibold">
                  {money(p.net_cents)}
                </Td>
                <Td numeric>{money(p.cost_cents)}</Td>
                <Td>
                  <div className="grid justify-items-start gap-1">
                    <PaymentBadge status={p.status} />
                    <AccountingBadge accrual={p.journal_entry_id} payment={p.payment_entry_id} />
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button variant="outline" size="xs" onClick={() => setEditing(p)}>
                      <Pencil />{' '}
                      {can('payroll.manage') && !p.journal_entry_id
                        ? t('common.edit')
                        : t('common.view')}
                    </Button>
                    {can('payroll.manage') && p.status === 'PENDING' && (
                      <Button variant="outline" size="xs" onClick={() => setPaying(p)}>
                        {t('payroll.markPaid')}
                      </Button>
                    )}
                    {can('payroll.manage') && p.status === 'PAID' && !p.payment_entry_id && (
                      <Button variant="outline" size="xs" onClick={() => unpay.mutate(p.id)}>
                        {t('invoices.markPending')}
                      </Button>
                    )}
                    {can('accounting.post') && !p.journal_entry_id && (
                      <Button
                        variant="gold"
                        size="xs"
                        onClick={() =>
                          setPosting({
                            type: 'PAYROLL',
                            id: p.id,
                            label: `${p.worker_name} · ${formatPeriod(p.period)}`,
                          })
                        }
                      >
                        <BookPlus /> {t('entry.postAction')}
                      </Button>
                    )}
                    {can('accounting.post') && p.journal_entry_id && !p.payment_entry_id && (
                      <Button
                        variant="gold"
                        size="xs"
                        onClick={() =>
                          setPosting({
                            type: 'PAYROLL_PAYMENT',
                            id: p.id,
                            label: `${p.worker_name} · ${formatPeriod(p.period)}`,
                          })
                        }
                      >
                        <BookPlus /> {t('entry.payment')}
                      </Button>
                    )}
                    {can('payroll.manage') && !p.journal_entry_id && !p.payment_entry_id && (
                      <Button
                        variant="destructive-outline"
                        size="xs"
                        aria-label={t('common.delete')}
                        onClick={() =>
                          confirmAction(
                            t('payroll.confirmDelete', {
                              name: p.worker_name,
                              period: formatPeriod(p.period),
                            }),
                          ) && remove.mutate(p.id)
                        }
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      {editing && (
        <PayrollDialog
          payroll={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <PaymentDialog
        key={paying?.id ?? 'none'}
        open={Boolean(paying)}
        title={t('payroll.markPaidTitle', { name: paying?.worker_name })}
        pending={pay.isPending}
        onClose={() => setPaying(null)}
        onConfirm={(input) => paying && pay.mutate({ id: paying.id, ...input })}
      />
      <PostEntryDialog
        key={posting ? `${posting.type}-${posting.id}` : 'none'}
        target={posting}
        onClose={() => setPosting(null)}
      />
    </>
  );
}

const payrollSchema = z
  .object({
    worker_id: z.string().min(1, 'validation.required'),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'validation.required'),
    accrual_date: z.string().min(1, 'validation.required'),
    activity: z.enum(ACTIVITIES),
    gross: zEuros({ positive: true }),
    employee_ss: zEuros({ optional: true }),
    irpf: zEuros({ optional: true }),
    other_deductions: zEuros({ optional: true }),
    employer_ss: zEuros({ optional: true }),
    notes: z.string().max(2000),
  })
  .refine((v) => v.accrual_date.startsWith(v.period), {
    path: ['accrual_date'],
    message: 'payroll.accrualInPeriod',
  });
type PayrollValues = z.infer<typeof payrollSchema>;

function PayrollDialog({ payroll, onClose }: { payroll: Payroll | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const readOnly = !can('payroll.manage') || Boolean(payroll?.journal_entry_id);
  const { data: workers } = useQuery({
    queryKey: payrollKeys.workers,
    queryFn: ({ signal }) => listWorkers(signal),
  });
  const initialPeriod = payroll?.period ?? currentPeriod();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<PayrollValues>({
    resolver: zodResolver(payrollSchema),
    defaultValues: {
      worker_id: payroll?.worker_id ?? '',
      period: initialPeriod,
      accrual_date: payroll?.accrual_date ?? lastDayOfPeriod(initialPeriod),
      activity: payroll?.activity ?? 'SCHOOL',
      gross: centsToInput(payroll?.gross_cents),
      employee_ss: centsToInput(payroll?.employee_ss_cents ?? 0),
      irpf: centsToInput(payroll?.irpf_cents ?? 0),
      other_deductions: centsToInput(payroll?.other_deductions_cents ?? 0),
      employer_ss: centsToInput(payroll?.employer_ss_cents ?? 0),
      notes: payroll?.notes ?? '',
    },
  });
  const v = useWatch({ control }) as PayrollValues;
  const net =
    cents(v.gross ?? '') -
    cents(v.employee_ss ?? '') -
    cents(v.irpf ?? '') -
    cents(v.other_deductions ?? '');
  const cost = cents(v.gross ?? '') + cents(v.employer_ss ?? '');

  const save = useAction(
    (body: PayrollInput) => (payroll ? updatePayroll(payroll.id, body) : createPayroll(body)),
    {
      invalidate: [payrollKeys.all, ['dashboard']],
      success: 'payroll.saved',
      onSuccess: onClose,
    },
  );
  const onSubmit = handleSubmit((values) =>
    save.mutate({
      worker_id: values.worker_id,
      period: values.period,
      accrual_date: values.accrual_date,
      activity: values.activity,
      gross_cents: cents(values.gross),
      employee_ss_cents: cents(values.employee_ss),
      irpf_cents: cents(values.irpf),
      other_deductions_cents: cents(values.other_deductions),
      employer_ss_cents: cents(values.employer_ss),
      notes: nullable(values.notes),
    }),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={
        payroll ? `${payroll.worker_name} · ${formatPeriod(payroll.period)}` : t('payroll.new')
      }
      description={t('payroll.dialogHint')}
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {payroll?.journal_entry_id && (
          <Notice tone="warning">{t('payroll.lockedAccounted')}</Notice>
        )}
        <fieldset disabled={readOnly} className="grid gap-5">
          <FormGrid>
            <FormField id="p_worker" label={t('payroll.worker')} error={errors.worker_id?.message}>
              <Select
                id="p_worker"
                {...register('worker_id', {
                  onChange: (e) => {
                    const worker = workers?.find((w) => w.id === e.target.value);
                    if (worker) setValue('activity', worker.activity);
                  },
                })}
              >
                <option value="">{t('common.choose')}</option>
                {workers
                  ?.filter((w) => w.active || w.id === payroll?.worker_id)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.full_name}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField id="p_activity" label={t('common.activity')}>
              <Select id="p_activity" {...register('activity')}>
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {t(`activity.${a}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="p_period" label={t('school.period')} error={errors.period?.message}>
              <Input
                id="p_period"
                type="month"
                {...register('period', {
                  onChange: (e) =>
                    e.target.value && setValue('accrual_date', lastDayOfPeriod(e.target.value)),
                })}
              />
            </FormField>
            <FormField
              id="p_accrual"
              label={t('payroll.accrualDate')}
              error={errors.accrual_date?.message}
            >
              <Input id="p_accrual" type="date" {...register('accrual_date')} />
            </FormField>
          </FormGrid>
          <div className="grid gap-4 rounded-xl border bg-secondary/40 p-4">
            <FormGrid cols={3}>
              <FormField id="p_gross" label={t('payroll.gross')} error={errors.gross?.message}>
                <Input id="p_gross" inputMode="decimal" {...register('gross')} />
              </FormField>
              <FormField
                id="p_ess"
                label={t('payroll.employeeSs')}
                error={errors.employee_ss?.message}
              >
                <Input id="p_ess" inputMode="decimal" {...register('employee_ss')} />
              </FormField>
              <FormField id="p_irpf" label={t('payroll.irpf')} error={errors.irpf?.message}>
                <Input id="p_irpf" inputMode="decimal" {...register('irpf')} />
              </FormField>
              <FormField
                id="p_other"
                label={t('payroll.otherDeductions')}
                error={errors.other_deductions?.message}
              >
                <Input id="p_other" inputMode="decimal" {...register('other_deductions')} />
              </FormField>
              <FormField
                id="p_emss"
                label={t('payroll.employerSs')}
                error={errors.employer_ss?.message}
              >
                <Input id="p_emss" inputMode="decimal" {...register('employer_ss')} />
              </FormField>
            </FormGrid>
            <div className="flex flex-wrap gap-6 border-t pt-3">
              <div className="grid">
                <span className="text-xs text-muted-foreground">{t('payroll.net')}</span>
                <strong
                  className={net < 0 ? 'tabular text-xl text-destructive' : 'tabular text-xl'}
                >
                  {money(net)}
                </strong>
              </div>
              <div className="grid">
                <span className="text-xs text-muted-foreground">{t('payroll.cost')}</span>
                <strong className="tabular text-xl">{money(cost)}</strong>
              </div>
            </div>
          </div>
          <FormField id="p_notes" label={t('common.notes')}>
            <Textarea id="p_notes" {...register('notes')} />
          </FormField>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {readOnly ? t('common.close') : t('common.cancel')}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={save.isPending || net < 0}>
              {t('common.save')}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

// ───────────── Personal ─────────────

function WorkersTab() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [editing, setEditing] = useState<Worker | 'new' | null>(null);
  const { data, isPending } = useQuery({
    queryKey: payrollKeys.workers,
    queryFn: ({ signal }) => listWorkers(signal),
  });
  const remove = useAction(deleteWorker, {
    invalidate: [payrollKeys.all],
    success: 'payroll.workerDeleted',
  });
  return (
    <Panel
      flush
      title={t('payroll.workersTitle')}
      actions={
        can('payroll.manage') && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus /> {t('payroll.newWorker')}
          </Button>
        )
      }
    >
      <Table>
        <thead>
          <tr>
            <Th>{t('payroll.worker')}</Th>
            <Th>{t('payroll.roleTitle')}</Th>
            <Th>{t('common.activity')}</Th>
            <Th>{t('common.status')}</Th>
            <Th className="text-right">{t('common.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={5}>{t('common.loading')}</EmptyRow>}
          {data?.length === 0 && <EmptyRow colSpan={5}>{t('payroll.emptyWorkers')}</EmptyRow>}
          {data?.map((w) => (
            <tr key={w.id} className={w.active ? undefined : 'opacity-55'}>
              <Td className="font-semibold">{w.full_name}</Td>
              <Td>{w.role_title ?? '—'}</Td>
              <Td>
                <ActivityBadge activity={w.activity} />
              </Td>
              <Td>
                {w.active ? (
                  <Badge tone="success">{t('school.active')}</Badge>
                ) : (
                  <Badge>{t('payroll.inactive')}</Badge>
                )}
              </Td>
              <Td>
                {can('payroll.manage') && (
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="xs" onClick={() => setEditing(w)}>
                      <Pencil /> {t('common.edit')}
                    </Button>
                    <Button
                      variant="destructive-outline"
                      size="xs"
                      aria-label={t('common.delete')}
                      onClick={() =>
                        confirmAction(t('payroll.confirmDeleteWorker', { name: w.full_name })) &&
                        remove.mutate(w.id)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && (
        <WorkerDialog
          worker={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Panel>
  );
}

const workerSchema = z.object({
  full_name: z.string().trim().min(1, 'validation.required').max(160),
  role_title: z.string().max(120),
  activity: z.enum(ACTIVITIES),
  active: z.boolean(),
});
type WorkerValues = z.infer<typeof workerSchema>;

function WorkerDialog({ worker, onClose }: { worker: Worker | null; onClose: () => void }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkerValues>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      full_name: worker?.full_name ?? '',
      role_title: worker?.role_title ?? '',
      activity: worker?.activity ?? 'SCHOOL',
      active: worker?.active ?? true,
    },
  });
  const save = useAction(
    (body: WorkerInput) => (worker ? updateWorker(worker.id, body) : createWorker(body)),
    { invalidate: [payrollKeys.all], success: 'payroll.workerSaved', onSuccess: onClose },
  );
  const onSubmit = handleSubmit((v) =>
    save.mutate({
      full_name: v.full_name.trim(),
      role_title: nullable(v.role_title),
      activity: v.activity,
      active: v.active,
      member_id: worker?.member_id ?? null,
    }),
  );
  return (
    <Dialog open onClose={onClose} title={worker ? worker.full_name : t('payroll.newWorker')}>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormGrid>
          <FormField id="w_name" label={t('payroll.worker')} error={errors.full_name?.message}>
            <Input id="w_name" autoFocus {...register('full_name')} />
          </FormField>
          <FormField id="w_role" label={t('payroll.roleTitle')}>
            <Input
              id="w_role"
              placeholder={t('payroll.rolePlaceholder')}
              {...register('role_title')}
            />
          </FormField>
          <FormField id="w_activity" label={t('common.activity')}>
            <Select id="w_activity" {...register('activity')}>
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {t(`activity.${a}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" {...register('active')} />{' '}
            {t('payroll.activeLabel')}
          </label>
        </FormGrid>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
