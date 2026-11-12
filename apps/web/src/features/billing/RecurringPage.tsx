import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import { ACTIVITIES } from '@alcaravan/shared';
import {
  advanceRecurring,
  billingKeys,
  createRecurring,
  deleteRecurring,
  listRecurring,
  listSuppliers,
  updateRecurring,
  type RecurringExpense,
  type RecurringInput,
} from '@/api/billing';
import { listWorkers, payrollKeys } from '@/api/school';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import { Notice, Page, PageHeader, Panel } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { ActivityBadge } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { centsToInput, date, money, today } from '@/lib/format';
import { cents, zEuros } from '@/lib/forms';

export function RecurringPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [editing, setEditing] = useState<RecurringExpense | 'new' | null>(null);
  const { data, isPending } = useQuery({
    queryKey: billingKeys.recurring,
    queryFn: ({ signal }) => listRecurring(signal),
  });
  const invalidate = [billingKeys.all, ['dashboard']];
  const advance = useAction(advanceRecurring, { invalidate, success: 'recurring.advanced' });
  const remove = useAction(deleteRecurring, { invalidate, success: 'recurring.deleted' });
  const now = today();
  const due = data?.filter((r) => r.active && r.next_due_on <= now) ?? [];

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.billing')}
        title={t('recurring.title')}
        description={t('recurring.subtitle')}
        actions={
          can('billing.manage') && (
            <Button onClick={() => setEditing('new')}>
              <Plus /> {t('recurring.new')}
            </Button>
          )
        }
      />
      {due.length > 0 && (
        <Notice tone="warning">
          {t('recurring.dueNotice', { count: due.length })}{' '}
          <Link to="/billing/expenses" className="font-semibold underline">
            {t('recurring.goExpenses')}
          </Link>
        </Notice>
      )}
      <Panel flush>
        <Table>
          <thead>
            <tr>
              <Th>{t('recurring.concept')}</Th>
              <Th>{t('recurring.party')}</Th>
              <Th>{t('common.activity')}</Th>
              <Th>{t('recurring.frequency')}</Th>
              <Th numeric>{t('recurring.amount')}</Th>
              <Th>{t('recurring.nextDue')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={7}>{t('common.loading')}</EmptyRow>}
            {data?.length === 0 && <EmptyRow colSpan={7}>{t('recurring.empty')}</EmptyRow>}
            {data?.map((item) => {
              const isDue = item.active && item.next_due_on <= now;
              return (
                <tr key={item.id} className={item.active ? undefined : 'opacity-55'}>
                  <Td className="font-semibold">{item.concept}</Td>
                  <Td>{item.party_name ?? '—'}</Td>
                  <Td>
                    <ActivityBadge activity={item.activity} />
                  </Td>
                  <Td>{t(`frequency.${item.frequency}`)}</Td>
                  <Td numeric>{money(item.amount_cents)}</Td>
                  <Td>
                    <span className="mr-2">{date(item.next_due_on)}</span>
                    {!item.active ? (
                      <Badge>{t('recurring.inactive')}</Badge>
                    ) : isDue ? (
                      <Badge tone="danger">{t('recurring.due')}</Badge>
                    ) : null}
                  </Td>
                  <Td>
                    {can('billing.manage') && (
                      <div className="flex justify-end gap-1.5">
                        {item.active && (
                          <Button
                            variant="gold"
                            size="xs"
                            title={t('recurring.advanceHint')}
                            onClick={() => advance.mutate(item.id)}
                          >
                            <CalendarCheck /> {t('recurring.advance')}
                          </Button>
                        )}
                        <Button variant="outline" size="xs" onClick={() => setEditing(item)}>
                          <Pencil /> {t('common.edit')}
                        </Button>
                        <Button
                          variant="destructive-outline"
                          size="xs"
                          aria-label={t('common.delete')}
                          onClick={() =>
                            confirmAction(
                              t('recurring.confirmDelete', { concept: item.concept }),
                            ) && remove.mutate(item.id)
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
      {editing && (
        <RecurringDialog
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

const schema = z
  .object({
    concept: z.string().trim().min(1, 'validation.required').max(200),
    party_type: z.enum(['SUPPLIER', 'WORKER']),
    supplier_id: z.string(),
    worker_id: z.string(),
    activity: z.enum(ACTIVITIES),
    amount: zEuros({ positive: true }),
    frequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
    next_due_on: z.string().min(1, 'validation.required'),
    active: z.boolean(),
  })
  .refine((v) => (v.party_type === 'SUPPLIER' ? v.supplier_id : v.worker_id), {
    path: ['supplier_id'],
    message: 'validation.required',
  });
type Values = z.infer<typeof schema>;

function RecurringDialog({
  item,
  onClose,
}: {
  item: RecurringExpense | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { data: suppliers } = useQuery({
    queryKey: billingKeys.suppliers,
    queryFn: ({ signal }) => listSuppliers(signal),
  });
  const { data: workers } = useQuery({
    queryKey: payrollKeys.workers,
    queryFn: ({ signal }) => listWorkers(signal),
    enabled: can('payroll.read'),
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      concept: item?.concept ?? '',
      party_type: item?.party_type ?? 'SUPPLIER',
      supplier_id: item?.supplier_id ?? '',
      worker_id: item?.worker_id ?? '',
      activity: item?.activity ?? 'BAND',
      amount: centsToInput(item?.amount_cents),
      frequency: item?.frequency ?? 'MONTHLY',
      next_due_on: item?.next_due_on ?? today(),
      active: item?.active ?? true,
    },
  });
  const partyType = useWatch({ control, name: 'party_type' });
  const save = useAction(
    (body: RecurringInput) => (item ? updateRecurring(item.id, body) : createRecurring(body)),
    {
      invalidate: [billingKeys.all, ['dashboard']],
      success: 'recurring.saved',
      onSuccess: onClose,
    },
  );
  const onSubmit = handleSubmit((v) =>
    save.mutate({
      concept: v.concept.trim(),
      party_type: v.party_type,
      supplier_id: v.party_type === 'SUPPLIER' ? v.supplier_id : null,
      worker_id: v.party_type === 'WORKER' ? v.worker_id : null,
      activity: v.activity,
      amount_cents: cents(v.amount),
      frequency: v.frequency,
      next_due_on: v.next_due_on,
      active: v.active,
    }),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={item ? t('recurring.edit') : t('recurring.new')}
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormGrid>
          <FormField
            id="r_concept"
            label={t('recurring.concept')}
            error={errors.concept?.message}
            className="sm:col-span-2"
          >
            <Input id="r_concept" autoFocus {...register('concept')} />
          </FormField>
          <FormField id="r_party_type" label={t('recurring.partyType')}>
            <Select id="r_party_type" {...register('party_type')}>
              <option value="SUPPLIER">{t('recurring.partySupplier')}</option>
              {can('payroll.read') && <option value="WORKER">{t('recurring.partyWorker')}</option>}
            </Select>
          </FormField>
          {partyType === 'SUPPLIER' ? (
            <FormField
              id="r_supplier"
              label={t('expenses.supplier')}
              error={errors.supplier_id?.message}
            >
              <Select id="r_supplier" {...register('supplier_id')}>
                <option value="">{t('common.choose')}</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField
              id="r_worker"
              label={t('payroll.worker')}
              error={errors.supplier_id?.message}
            >
              <Select id="r_worker" {...register('worker_id')}>
                <option value="">{t('common.choose')}</option>
                {workers?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField id="r_activity" label={t('common.activity')}>
            <Select id="r_activity" {...register('activity')}>
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {t(`activity.${a}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="r_amount" label={t('recurring.amount')} error={errors.amount?.message}>
            <Input id="r_amount" inputMode="decimal" {...register('amount')} />
          </FormField>
          <FormField id="r_frequency" label={t('recurring.frequency')}>
            <Select id="r_frequency" {...register('frequency')}>
              {(['MONTHLY', 'QUARTERLY', 'ANNUAL'] as const).map((f) => (
                <option key={f} value={f}>
                  {t(`frequency.${f}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="r_next" label={t('recurring.nextDue')} error={errors.next_due_on?.message}>
            <Input id="r_next" type="date" {...register('next_due_on')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4 accent-primary" {...register('active')} />{' '}
            {t('recurring.activeLabel')}
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
