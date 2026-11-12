import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookPlus, Download, FileUp, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ACTIVITIES, applyRate, percentToBp, type Activity } from '@alcaravan/shared';
import {
  billingKeys,
  createExpense,
  createSupplier,
  deleteExpense,
  deleteSupplier,
  EXPENSE_CATEGORIES,
  expenseTotals,
  listExpenses,
  listSuppliers,
  markExpensePaid,
  markExpensePending,
  updateExpense,
  updateSupplier,
  type Expense,
  type ExpenseInput,
  type PaymentMethod,
  type Supplier,
  type SupplierInput,
} from '@/api/billing';
import {
  documentDownloadUrl,
  documentKeys,
  listEntityDocuments,
  uploadEntityDocument,
} from '@/api/finance';
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
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import {
  AccountingBadge,
  ActivityBadge,
  ActivitySelect,
  PaymentBadge,
  YearSelect,
} from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { PaymentDialog } from '@/features/shared/PaymentDialog';
import { PostEntryDialog, type PostTarget } from '@/features/shared/PostEntryDialog';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { centsToInput, currentYear, date, money, today } from '@/lib/format';
import { cents, nullable, pct, zEuros, zPercent } from '@/lib/forms';

const PAGE_SIZE = 25;

export function ExpensesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'expenses' | 'suppliers'>('expenses');
  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.billing')}
        title={t('expenses.title')}
        description={t('expenses.subtitle')}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'expenses', label: t('expenses.tab') },
          { value: 'suppliers', label: t('suppliers.tab') },
        ]}
      />
      {tab === 'expenses' ? <ExpensesTab /> : <SuppliersTab />}
    </Page>
  );
}

// ───────────── Facturas recibidas ─────────────

function ExpensesTab() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [year, setYear] = useState(currentYear());
  const [activity, setActivity] = useState<Activity | ''>('');
  const [status, setStatus] = useState<'' | 'PENDING' | 'PAID'>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDeferredValue(search.trim());
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [paying, setPaying] = useState<Expense | null>(null);
  const [posting, setPosting] = useState<PostTarget | null>(null);

  const params = {
    page,
    page_size: PAGE_SIZE,
    year,
    activity: activity || undefined,
    status: status || undefined,
    q: q || undefined,
  };
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: billingKeys.expenses(params),
    queryFn: ({ signal }) => listExpenses(params, signal),
    placeholderData: keepPreviousData,
  });
  const { data: totals } = useQuery({
    queryKey: billingKeys.expenseTotals(year),
    queryFn: ({ signal }) => expenseTotals(year, signal),
  });

  const invalidate = [billingKeys.all, ['dashboard']];
  const pay = useAction(
    (input: { id: string; paid_on: string; payment_method: PaymentMethod }) =>
      markExpensePaid(input.id, { paid_on: input.paid_on, payment_method: input.payment_method }),
    { invalidate, success: 'expenses.markedPaid', onSuccess: () => setPaying(null) },
  );
  const unpay = useAction(markExpensePending, { invalidate, success: 'expenses.markedPending' });
  const remove = useAction(deleteExpense, { invalidate, success: 'expenses.deleted' });
  const lastPage = Math.max(1, Math.ceil((data?.meta.total ?? 0) / PAGE_SIZE));

  const exportCsv = async () => {
    const all = await listExpenses({ ...params, page: 1, page_size: 100 });
    downloadCsv(`Alcaravan_Gastos_${year}.csv`, [
      [
        'Fecha',
        'Proveedor',
        'NIF',
        'Número',
        'Actividad',
        'Categoría',
        'Concepto',
        'Base',
        'IGIC %',
        'IGIC',
        'Otros',
        'IRPF %',
        'IRPF',
        'Total',
        'Estado',
        'Fecha pago',
      ],
      ...all.data.map((e) => [
        e.issue_date,
        e.supplier_name,
        e.supplier_tax_id,
        e.number,
        t(`activity.${e.activity}`),
        t(`expenseCategory.${e.category}`),
        e.concept,
        csvEuros(e.base_cents),
        e.tax_rate,
        csvEuros(e.tax_cents),
        csvEuros(e.other_cents),
        e.withholding_rate,
        csvEuros(e.withholding_cents),
        csvEuros(e.total_cents),
        t(`status.${e.status}`),
        e.paid_on,
      ]),
    ]);
  };

  return (
    <>
      <StatGrid>
        <StatCard label={t('expenses.count')} value={String(totals?.count ?? '—')} />
        <StatCard label={t('expenses.totalYear')} value={money(totals?.total_cents)} tone="gold" />
        <StatCard
          label={t('expenses.pending')}
          value={money(totals?.pending_cents)}
          hint={t('dashboard.pendingCount', { count: totals?.pending_count ?? 0 })}
          tone="warning"
        />
      </StatGrid>
      <Panel
        flush
        title={t('expenses.listTitle')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
              <Download /> CSV
            </Button>
            {can('billing.manage') && (
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus /> {t('expenses.new')}
              </Button>
            )}
          </>
        }
      >
        <div className="px-5 pb-3">
          <FilterBar>
            <FilterField label={t('common.year')}>
              <YearSelect
                value={year}
                onChange={(v) => {
                  setYear(v);
                  setPage(1);
                }}
              />
            </FilterField>
            <FilterField label={t('common.activity')}>
              <ActivitySelect
                allowAll
                value={activity}
                onChange={(v) => {
                  setActivity(v);
                  setPage(1);
                }}
              />
            </FilterField>
            <FilterField label={t('common.status')}>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as typeof status);
                  setPage(1);
                }}
                className="w-36"
              >
                <option value="">{t('common.all')}</option>
                <option value="PENDING">{t('status.PENDING')}</option>
                <option value="PAID">{t('status.PAID')}</option>
              </Select>
            </FilterField>
            <FilterField label={t('common.search')}>
              <Input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="sm:w-56"
              />
            </FilterField>
          </FilterBar>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{t('common.date')}</Th>
              <Th>{t('expenses.supplier')}</Th>
              <Th>{t('expenses.number')}</Th>
              <Th>{t('common.activity')}</Th>
              <Th numeric>{t('invoices.base')}</Th>
              <Th numeric>IGIC</Th>
              <Th numeric>IRPF</Th>
              <Th numeric>{t('common.total')}</Th>
              <Th>{t('common.status')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody className={isPlaceholderData ? 'opacity-60' : undefined}>
            {isPending && <EmptyRow colSpan={10}>{t('common.loading')}</EmptyRow>}
            {data?.data.length === 0 && <EmptyRow colSpan={10}>{t('expenses.empty')}</EmptyRow>}
            {data?.data.map((expense) => (
              <tr key={expense.id}>
                <Td>{date(expense.issue_date)}</Td>
                <Td className="max-w-48">
                  <p className="truncate font-semibold">{expense.supplier_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{expense.concept}</p>
                </Td>
                <Td>{expense.number}</Td>
                <Td>
                  <ActivityBadge activity={expense.activity} />
                </Td>
                <Td numeric>{money(expense.base_cents)}</Td>
                <Td numeric>{money(expense.tax_cents)}</Td>
                <Td numeric>
                  {expense.withholding_cents ? money(expense.withholding_cents) : '—'}
                </Td>
                <Td numeric className="font-semibold">
                  {money(expense.total_cents)}
                </Td>
                <Td>
                  <div className="grid justify-items-start gap-1">
                    <PaymentBadge status={expense.status} />
                    <AccountingBadge
                      accrual={expense.journal_entry_id}
                      payment={expense.payment_entry_id}
                    />
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button variant="outline" size="xs" onClick={() => setEditing(expense)}>
                      <Pencil />{' '}
                      {can('billing.manage') && !expense.journal_entry_id
                        ? t('common.edit')
                        : t('common.view')}
                    </Button>
                    {can('billing.manage') && expense.status === 'PENDING' && (
                      <Button variant="outline" size="xs" onClick={() => setPaying(expense)}>
                        {t('expenses.markPaid')}
                      </Button>
                    )}
                    {can('billing.manage') &&
                      expense.status === 'PAID' &&
                      !expense.payment_entry_id && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => unpay.mutate(expense.id)}
                        >
                          {t('invoices.markPending')}
                        </Button>
                      )}
                    {can('accounting.post') && !expense.journal_entry_id && (
                      <Button
                        variant="gold"
                        size="xs"
                        onClick={() =>
                          setPosting({
                            type: 'EXPENSE',
                            id: expense.id,
                            label: `${expense.supplier_name} · ${expense.number}`,
                            hasInputTax: expense.tax_cents > 0,
                          })
                        }
                      >
                        <BookPlus /> {t('entry.postAction')}
                      </Button>
                    )}
                    {can('accounting.post') &&
                      expense.journal_entry_id &&
                      !expense.payment_entry_id && (
                        <Button
                          variant="gold"
                          size="xs"
                          onClick={() =>
                            setPosting({
                              type: 'EXPENSE_PAYMENT',
                              id: expense.id,
                              label: `${expense.supplier_name} · ${expense.number}`,
                            })
                          }
                        >
                          <BookPlus /> {t('entry.payment')}
                        </Button>
                      )}
                    {can('billing.manage') &&
                      !expense.journal_entry_id &&
                      !expense.payment_entry_id && (
                        <Button
                          variant="destructive-outline"
                          size="xs"
                          aria-label={t('common.delete')}
                          onClick={() =>
                            confirmAction(
                              t('expenses.confirmDelete', { number: expense.number }),
                            ) && remove.mutate(expense.id)
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
        <div className="flex items-center justify-between px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('common.pageOf', { page, total: lastPage })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      </Panel>

      {editing && (
        <ExpenseDialog
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <PaymentDialog
        key={paying?.id ?? 'none'}
        open={Boolean(paying)}
        title={t('expenses.markPaidTitle', { number: paying?.number })}
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

const expenseSchema = z.object({
  supplier_id: z.string().min(1, 'validation.required'),
  number: z.string().trim().min(1, 'validation.required').max(60),
  issue_date: z.string().min(1, 'validation.required'),
  operation_date: z.string(),
  activity: z.enum(ACTIVITIES),
  category: z.enum(EXPENSE_CATEGORIES),
  concept: z.string().trim().min(1, 'validation.required').max(500),
  base: zEuros(),
  tax_rate: zPercent(),
  tax: zEuros({ optional: true }),
  other: zEuros({ optional: true, allowNegative: true }),
  withholding_rate: zPercent(),
  withholding: zEuros({ optional: true }),
  notes: z.string().max(2000),
});
type ExpenseValues = z.infer<typeof expenseSchema>;

function ExpenseDialog({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const readOnly = !can('billing.manage') || Boolean(expense?.journal_entry_id);
  const { data: suppliers } = useQuery({
    queryKey: billingKeys.suppliers,
    queryFn: ({ signal }) => listSuppliers(signal),
  });
  const [file, setFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      supplier_id: expense?.supplier_id ?? '',
      number: expense?.number ?? '',
      issue_date: expense?.issue_date ?? today(),
      operation_date: expense?.operation_date ?? '',
      activity: expense?.activity ?? 'BAND',
      category: expense?.category ?? 'OTHER',
      concept: expense?.concept ?? '',
      base: centsToInput(expense?.base_cents),
      tax_rate: String(expense?.tax_rate ?? 7).replace('.', ','),
      tax: centsToInput(expense?.tax_cents),
      other: centsToInput(expense?.other_cents ?? 0),
      withholding_rate: String(expense?.withholding_rate ?? 0).replace('.', ','),
      withholding: centsToInput(expense?.withholding_cents ?? 0),
      notes: expense?.notes ?? '',
    },
  });
  const v = useWatch({ control }) as ExpenseValues;
  const total =
    cents(v.base ?? '') + cents(v.tax ?? '') + cents(v.other ?? '') - cents(v.withholding ?? '');

  // Propone IGIC e IRPF desde la base y los tipos; siguen siendo editables para cuadrar con el PDF.
  const recalc = (next: Partial<ExpenseValues>) => {
    const base = cents(next.base ?? v.base ?? '');
    setValue(
      'tax',
      centsToInput(applyRate(base, percentToBp(pct(next.tax_rate ?? v.tax_rate ?? '0')))),
    );
    setValue(
      'withholding',
      centsToInput(
        applyRate(base, percentToBp(pct(next.withholding_rate ?? v.withholding_rate ?? '0'))),
      ),
    );
  };

  const save = useAction(
    async (body: ExpenseInput) => {
      const saved = expense ? await updateExpense(expense.id, body) : await createExpense(body);
      if (file) await uploadEntityDocument('EXPENSE', saved.id, file);
      return saved;
    },
    {
      invalidate: [billingKeys.all, ['dashboard'], ['documents']],
      success: 'expenses.saved',
      onSuccess: onClose,
    },
  );

  const onSubmit = handleSubmit((values) =>
    save.mutate({
      supplier_id: values.supplier_id,
      number: values.number.trim(),
      issue_date: values.issue_date,
      operation_date: values.operation_date || null,
      activity: values.activity,
      category: values.category,
      concept: values.concept.trim(),
      base_cents: cents(values.base),
      tax_rate: pct(values.tax_rate),
      tax_cents: cents(values.tax),
      other_cents: cents(values.other),
      withholding_rate: pct(values.withholding_rate),
      withholding_cents: cents(values.withholding),
      notes: nullable(values.notes),
    }),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={expense ? t('expenses.editTitle', { number: expense.number }) : t('expenses.new')}
      description={t('expenses.dialogHint')}
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {expense?.journal_entry_id && (
          <Notice tone="warning">{t('expenses.lockedAccounted')}</Notice>
        )}
        <fieldset disabled={readOnly} className="grid gap-5">
          <FormGrid cols={3}>
            <FormField
              id="supplier_id"
              label={t('expenses.supplier')}
              error={errors.supplier_id?.message}
            >
              <Select
                id="supplier_id"
                {...register('supplier_id', {
                  onChange: (event) => {
                    const supplier = suppliers?.find((s) => s.id === event.target.value);
                    if (supplier && !expense) {
                      const rate = String(supplier.default_withholding_rate).replace('.', ',');
                      setValue('withholding_rate', rate);
                      recalc({ withholding_rate: rate });
                    }
                  },
                })}
              >
                <option value="">{t('common.choose')}</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="number" label={t('expenses.number')} error={errors.number?.message}>
              <Input id="number" {...register('number')} />
            </FormField>
            <FormField id="issue_date" label={t('expenses.issueDate')}>
              <Input id="issue_date" type="date" {...register('issue_date')} />
            </FormField>
            <FormField id="operation_date" label={t('invoices.operationDate')}>
              <Input id="operation_date" type="date" {...register('operation_date')} />
            </FormField>
            <FormField id="activity" label={t('common.activity')}>
              <Select id="activity" {...register('activity')}>
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {t(`activity.${a}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="category" label={t('expenses.category')}>
              <Select id="category" {...register('category')}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`expenseCategory.${c}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="concept"
              label={t('expenses.concept')}
              error={errors.concept?.message}
              className="sm:col-span-2 lg:col-span-3"
            >
              <Input id="concept" {...register('concept')} />
            </FormField>
          </FormGrid>

          <div className="grid gap-4 rounded-xl border bg-secondary/40 p-4">
            <FormGrid cols={4}>
              <FormField id="base" label={t('expenses.base')} error={errors.base?.message}>
                <Input
                  id="base"
                  inputMode="decimal"
                  {...register('base', { onChange: (e) => recalc({ base: e.target.value }) })}
                />
              </FormField>
              <FormField
                id="tax_rate"
                label={t('expenses.taxRate')}
                error={errors.tax_rate?.message}
              >
                <Input
                  id="tax_rate"
                  inputMode="decimal"
                  {...register('tax_rate', {
                    onChange: (e) => recalc({ tax_rate: e.target.value }),
                  })}
                />
              </FormField>
              <FormField id="tax" label={t('expenses.tax')} error={errors.tax?.message}>
                <Input id="tax" inputMode="decimal" {...register('tax')} />
              </FormField>
              <FormField id="other" label={t('expenses.other')} error={errors.other?.message}>
                <Input id="other" inputMode="decimal" {...register('other')} />
              </FormField>
              <FormField
                id="withholding_rate"
                label={t('expenses.withholdingRate')}
                error={errors.withholding_rate?.message}
              >
                <Input
                  id="withholding_rate"
                  inputMode="decimal"
                  {...register('withholding_rate', {
                    onChange: (e) => recalc({ withholding_rate: e.target.value }),
                  })}
                />
              </FormField>
              <FormField
                id="withholding"
                label={t('expenses.withholding')}
                error={errors.withholding?.message}
              >
                <Input id="withholding" inputMode="decimal" {...register('withholding')} />
              </FormField>
              <div className="grid content-end gap-1 sm:col-span-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('expenses.computedTotal')}
                </span>
                <strong className="tabular text-2xl">{money(total)}</strong>
              </div>
            </FormGrid>
            <p className="text-[11px] text-muted-foreground">{t('expenses.amountsHint')}</p>
          </div>

          <FormGrid>
            <FormField id="notes" label={t('common.notes')}>
              <Textarea id="notes" {...register('notes')} />
            </FormField>
            <FormField id="pdf" label={t('expenses.pdf')} hint={t('expenses.pdfHint')}>
              {!readOnly && (
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 text-sm text-muted-foreground hover:border-gold">
                  <FileUp className="size-4" aria-hidden />
                  <span className="truncate">{file ? file.name : t('expenses.choosePdf')}</span>
                  <input
                    id="pdf"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              {expense && can('documents.read') && <ExpenseDocuments expenseId={expense.id} />}
            </FormField>
          </FormGrid>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {readOnly ? t('common.close') : t('common.cancel')}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={save.isPending}>
              {t('common.save')}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

function ExpenseDocuments({ expenseId }: { expenseId: string }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: documentKeys.forEntity('EXPENSE', expenseId),
    queryFn: ({ signal }) => listEntityDocuments('EXPENSE', expenseId, signal),
  });
  if (!data?.data.length)
    return <p className="text-[11px] text-muted-foreground">{t('expenses.noPdf')}</p>;
  return (
    <ul className="grid gap-1">
      {data.data.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
            onClick={async () =>
              window.open((await documentDownloadUrl(doc.id)).url, '_blank', 'noopener')
            }
          >
            <Paperclip className="size-3.5" aria-hidden /> {doc.original_filename}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ───────────── Proveedores ─────────────

function SuppliersTab() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const { data, isPending } = useQuery({
    queryKey: billingKeys.suppliers,
    queryFn: ({ signal }) => listSuppliers(signal),
  });
  const remove = useAction(deleteSupplier, {
    invalidate: [billingKeys.all],
    success: 'suppliers.deleted',
  });
  return (
    <Panel
      flush
      title={t('suppliers.title')}
      actions={
        can('billing.manage') && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus /> {t('suppliers.new')}
          </Button>
        )
      }
    >
      <Table>
        <thead>
          <tr>
            <Th>{t('clients.name')}</Th>
            <Th>{t('common.taxId')}</Th>
            <Th>{t('suppliers.kind')}</Th>
            <Th numeric>{t('suppliers.defaultWithholding')}</Th>
            <Th>{t('common.contact')}</Th>
            <Th className="text-right">{t('common.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={6}>{t('common.loading')}</EmptyRow>}
          {data?.length === 0 && <EmptyRow colSpan={6}>{t('suppliers.empty')}</EmptyRow>}
          {data?.map((supplier) => (
            <tr key={supplier.id}>
              <Td className="font-semibold">{supplier.name}</Td>
              <Td>{supplier.tax_id ?? '—'}</Td>
              <Td>{t(`supplierKind.${supplier.kind}`)}</Td>
              <Td numeric>{supplier.default_withholding_rate} %</Td>
              <Td className="text-xs text-muted-foreground">
                {[supplier.email, supplier.phone].filter(Boolean).join(' · ') || '—'}
              </Td>
              <Td>
                {can('billing.manage') && (
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="xs" onClick={() => setEditing(supplier)}>
                      <Pencil /> {t('common.edit')}
                    </Button>
                    <Button
                      variant="destructive-outline"
                      size="xs"
                      aria-label={t('common.delete')}
                      onClick={() =>
                        confirmAction(t('clients.confirmDelete', { name: supplier.name })) &&
                        remove.mutate(supplier.id)
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
        <SupplierDialog
          supplier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Panel>
  );
}

const supplierSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(160),
  tax_id: z.string().max(32),
  kind: z.enum(['COMPANY', 'PROFESSIONAL', 'OTHER']),
  default_withholding_rate: zPercent(),
  address_line: z.string().max(255),
  city: z.string().max(160),
  email: z.union([z.literal(''), z.email('validation.email')]),
  phone: z.string().max(40),
});
type SupplierValues = z.infer<typeof supplierSchema>;

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SupplierValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? '',
      tax_id: supplier?.tax_id ?? '',
      kind: supplier?.kind ?? 'COMPANY',
      default_withholding_rate: String(supplier?.default_withholding_rate ?? 0),
      address_line: supplier?.address_line ?? '',
      city: supplier?.city ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
    },
  });
  const save = useAction(
    (body: SupplierInput) => (supplier ? updateSupplier(supplier.id, body) : createSupplier(body)),
    { invalidate: [billingKeys.all], success: 'suppliers.saved', onSuccess: onClose },
  );
  const onSubmit = handleSubmit((values) =>
    save.mutate({
      name: values.name.trim(),
      tax_id: nullable(values.tax_id),
      kind: values.kind,
      default_withholding_rate: pct(values.default_withholding_rate),
      address_line: nullable(values.address_line),
      city: nullable(values.city),
      email: nullable(values.email),
      phone: nullable(values.phone),
    }),
  );
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={supplier ? t('suppliers.edit') : t('suppliers.new')}
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormGrid>
          <FormField id="s_name" label={t('clients.name')} error={errors.name?.message}>
            <Input id="s_name" autoFocus {...register('name')} />
          </FormField>
          <FormField id="s_tax" label={t('common.taxId')}>
            <Input id="s_tax" {...register('tax_id')} />
          </FormField>
          <FormField id="s_kind" label={t('suppliers.kind')}>
            <Select
              id="s_kind"
              {...register('kind', {
                onChange: (e) =>
                  setValue(
                    'default_withholding_rate',
                    e.target.value === 'PROFESSIONAL' ? '15' : '0',
                  ),
              })}
            >
              {(['COMPANY', 'PROFESSIONAL', 'OTHER'] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`supplierKind.${k}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="s_wh"
            label={t('suppliers.defaultWithholding')}
            error={errors.default_withholding_rate?.message}
            hint={t('suppliers.withholdingHint')}
          >
            <Input id="s_wh" inputMode="decimal" {...register('default_withholding_rate')} />
          </FormField>
          <FormField id="s_address" label={t('common.address')}>
            <Input id="s_address" {...register('address_line')} />
          </FormField>
          <FormField id="s_city" label={t('common.cityFull')}>
            <Input id="s_city" {...register('city')} />
          </FormField>
          <FormField id="s_email" label={t('common.email')} error={errors.email?.message}>
            <Input id="s_email" type="email" {...register('email')} />
          </FormField>
          <FormField id="s_phone" label={t('common.phone')}>
            <Input id="s_phone" {...register('phone')} />
          </FormField>
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
