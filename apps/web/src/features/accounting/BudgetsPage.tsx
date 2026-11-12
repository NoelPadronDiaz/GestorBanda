import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Copy, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ACTIVITIES, type Activity } from '@alcaravan/shared';
import { accountingKeys, listAccounts } from '@/api/accounting';
import {
  budgetKeys,
  copyBudgetYear,
  createBudgetLine,
  deleteBudgetLine,
  getBudget,
  updateBudgetLine,
  type BudgetInput,
  type BudgetLine,
} from '@/api/finance';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import {
  FilterBar,
  FilterField,
  Page,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
} from '@/components/page';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { ActivityBadge, ActivitySelect, YearSelect } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { centsToInput, currentYear, money } from '@/lib/format';
import { cents, zEuros } from '@/lib/forms';
import { cn } from '@/lib/utils';

/** Barra de ejecución: proporción real/presupuesto, en dorado si se pasa en gastos o no llega en ingresos. */
function Execution({ line }: { line: BudgetLine }) {
  const ratio = line.amount_cents ? line.actual_cents / line.amount_cents : 0;
  const bad = line.kind === 'EXPENSE' ? ratio > 1 : false;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full', bad ? 'bg-destructive' : 'bg-gold')}
          style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
        />
      </div>
      <span className="tabular text-xs text-muted-foreground">{Math.round(ratio * 100)} %</span>
    </div>
  );
}

export function BudgetsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [year, setYear] = useState(currentYear());
  const [activity, setActivity] = useState<Activity | ''>('');
  const [editing, setEditing] = useState<BudgetLine | 'new' | null>(null);
  const { data, isPending } = useQuery({
    queryKey: budgetKeys.report(year, activity),
    queryFn: ({ signal }) => getBudget(year, activity, signal),
  });
  const remove = useAction(deleteBudgetLine, {
    invalidate: [budgetKeys.all, ['dashboard']],
    success: 'budgets.deleted',
  });
  const copy = useAction(() => copyBudgetYear(year), {
    invalidate: [budgetKeys.all],
    success: (r) => t('budgets.copied', { count: r.copied, next: year + 1 }),
    onSuccess: () => setYear(year + 1),
  });

  const exportCsv = () =>
    data &&
    downloadCsv(`Alcaravan_Presupuesto_${year}.csv`, [
      ['Tipo', 'Actividad', 'Cuenta', 'Partida', 'Presupuesto', 'Real', 'Desviación'],
      ...data.lines.map((l) => [
        l.kind === 'INCOME' ? 'Ingreso' : 'Gasto',
        t(`activity.${l.activity}`),
        l.account_prefix,
        l.label,
        csvEuros(l.amount_cents),
        csvEuros(l.actual_cents),
        csvEuros(l.deviation_cents),
      ]),
    ]);

  const section = (kind: 'INCOME' | 'EXPENSE') => {
    const lines = data?.lines.filter((l) => l.kind === kind) ?? [];
    return (
      <Panel flush title={kind === 'INCOME' ? t('budgets.income') : t('budgets.expenses')}>
        <Table>
          <thead>
            <tr>
              <Th>{t('budgets.label')}</Th>
              <Th>{t('budgets.accountPrefix')}</Th>
              <Th>{t('common.activity')}</Th>
              <Th numeric>{t('budgets.budget')}</Th>
              <Th numeric>{t('budgets.actual')}</Th>
              <Th numeric>{t('budgets.deviation')}</Th>
              <Th>{t('budgets.execution')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={8}>{t('common.loading')}</EmptyRow>}
            {!isPending && lines.length === 0 && (
              <EmptyRow colSpan={8}>{t('budgets.empty')}</EmptyRow>
            )}
            {lines.map((line) => {
              const good =
                kind === 'INCOME' ? line.deviation_cents >= 0 : line.deviation_cents <= 0;
              return (
                <tr key={line.id}>
                  <Td className="font-semibold">{line.label}</Td>
                  <Td className="tabular">{line.account_prefix}</Td>
                  <Td>
                    <ActivityBadge activity={line.activity} />
                  </Td>
                  <Td numeric>{money(line.amount_cents)}</Td>
                  <Td numeric>{money(line.actual_cents)}</Td>
                  <Td numeric className={good ? 'text-success' : 'text-destructive'}>
                    {money(line.deviation_cents)}
                  </Td>
                  <Td>
                    <Execution line={line} />
                  </Td>
                  <Td>
                    {can('budgets.manage') && (
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="xs" onClick={() => setEditing(line)}>
                          <Pencil /> {t('common.edit')}
                        </Button>
                        <Button
                          variant="destructive-outline"
                          size="xs"
                          aria-label={t('common.delete')}
                          onClick={() =>
                            confirmAction(t('budgets.confirmDelete', { label: line.label })) &&
                            remove.mutate(line.id)
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>
    );
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.accounting')}
        title={t('budgets.title')}
        description={t('budgets.subtitle')}
        actions={
          <>
            <Button variant="outline" disabled={!data?.lines.length} onClick={exportCsv}>
              <Download /> CSV
            </Button>
            {can('budgets.manage') && (
              <>
                <Button
                  variant="outline"
                  disabled={!data?.lines.length || copy.isPending}
                  onClick={() =>
                    confirmAction(t('budgets.confirmCopy', { year, next: year + 1 })) &&
                    copy.mutate()
                  }
                >
                  <Copy /> {t('budgets.copy', { next: year + 1 })}
                </Button>
                <Button onClick={() => setEditing('new')}>
                  <Plus /> {t('budgets.new')}
                </Button>
              </>
            )}
          </>
        }
      />
      <FilterBar>
        <FilterField label={t('common.year')}>
          <YearSelect value={year} onChange={setYear} />
        </FilterField>
        <FilterField label={t('common.activity')}>
          <ActivitySelect allowAll value={activity} onChange={setActivity} />
        </FilterField>
      </FilterBar>
      <StatGrid>
        <StatCard
          label={t('budgets.incomeBudget')}
          value={money(data?.income_budget_cents)}
          hint={t('budgets.actualHint', { amount: money(data?.income_actual_cents) })}
        />
        <StatCard
          label={t('budgets.expenseBudget')}
          value={money(data?.expense_budget_cents)}
          hint={t('budgets.actualHint', { amount: money(data?.expense_actual_cents) })}
        />
        <StatCard
          label={t('budgets.plannedResult')}
          value={money((data?.income_budget_cents ?? 0) - (data?.expense_budget_cents ?? 0))}
        />
        <StatCard
          label={t('budgets.actualResult')}
          value={money((data?.income_actual_cents ?? 0) - (data?.expense_actual_cents ?? 0))}
          tone="gold"
        />
      </StatGrid>
      {section('INCOME')}
      {section('EXPENSE')}
      {editing && (
        <BudgetDialog
          line={editing === 'new' ? null : editing}
          year={year}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

const schema = z.object({
  kind: z.enum(['INCOME', 'EXPENSE']),
  activity: z.enum(ACTIVITIES),
  account_prefix: z.string().regex(/^[67]\d{0,9}$/, 'budgets.prefixInvalid'),
  label: z.string().trim().min(1, 'validation.required').max(160),
  amount: zEuros(),
});
type Values = z.infer<typeof schema>;

function BudgetDialog({
  line,
  year,
  onClose,
}: {
  line: BudgetLine | null;
  year: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: accounts } = useQuery({
    queryKey: accountingKeys.accounts,
    queryFn: ({ signal }) => listAccounts(signal),
    staleTime: 300_000,
  });
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: line?.kind ?? 'EXPENSE',
      activity: line?.activity ?? 'BAND',
      account_prefix: line?.account_prefix ?? '',
      label: line?.label ?? '',
      amount: centsToInput(line?.amount_cents),
    },
  });
  const save = useAction(
    (body: BudgetInput) => (line ? updateBudgetLine(line.id, body) : createBudgetLine(body)),
    { invalidate: [budgetKeys.all, ['dashboard']], success: 'budgets.saved', onSuccess: onClose },
  );
  const onSubmit = handleSubmit((v) =>
    save.mutate({
      year: line?.year ?? year,
      kind: v.kind,
      activity: v.activity,
      account_prefix: v.account_prefix,
      label: v.label.trim(),
      amount_cents: cents(v.amount),
    }),
  );
  const listId = 'budget-accounts';

  return (
    <Dialog
      open
      onClose={onClose}
      title={line ? t('budgets.edit') : t('budgets.new')}
      description={t('budgets.dialogHint')}
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormGrid>
          <FormField id="b_kind" label={t('budgets.kind')}>
            <Select id="b_kind" {...register('kind')}>
              <option value="INCOME">{t('budgets.kindIncome')}</option>
              <option value="EXPENSE">{t('budgets.kindExpense')}</option>
            </Select>
          </FormField>
          <FormField id="b_activity" label={t('common.activity')}>
            <Select id="b_activity" {...register('activity')}>
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {t(`activity.${a}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="b_prefix"
            label={t('budgets.accountPrefix')}
            error={errors.account_prefix?.message}
            hint={t('budgets.prefixHint')}
          >
            <Input
              id="b_prefix"
              list={listId}
              inputMode="numeric"
              {...register('account_prefix', {
                onChange: (e) => {
                  const account = accounts?.find((a) => a.code === e.target.value);
                  if (account && !getValues('label')) setValue('label', account.name);
                  if (/^7/.test(e.target.value)) setValue('kind', 'INCOME');
                  if (/^6/.test(e.target.value)) setValue('kind', 'EXPENSE');
                },
              })}
            />
            <datalist id={listId}>
              {accounts
                ?.filter((a) => /^[67]/.test(a.code))
                .map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
            </datalist>
          </FormField>
          <FormField id="b_amount" label={t('budgets.budget')} error={errors.amount?.message}>
            <Input id="b_amount" inputMode="decimal" {...register('amount')} />
          </FormField>
          <FormField
            id="b_label"
            label={t('budgets.label')}
            error={errors.label?.message}
            className="sm:col-span-2"
          >
            <Input id="b_label" {...register('label')} />
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
