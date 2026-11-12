import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CheckCheck, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ACTIVITIES, type Activity } from '@alcaravan/shared';
import {
  CASH_CATEGORIES,
  cashKeys,
  createCashMovement,
  deleteCashMovement,
  getCashReport,
  updateCashMovement,
  type CashInput,
  type CashMovement,
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
} from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { ActivityBadge, ActivitySelect } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { centsToInput, currentYear, date, money, today } from '@/lib/format';
import { cents, nullable, zEuros } from '@/lib/forms';
import { cn } from '@/lib/utils';

export function InternalCashPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [from, setFrom] = useState(`${currentYear()}-01-01`);
  const [to, setTo] = useState(`${currentYear()}-12-31`);
  const [activity, setActivity] = useState<Activity | ''>('');
  const [editing, setEditing] = useState<CashMovement | 'new' | null>(null);
  const params = { from: from || undefined, to: to || undefined, activity: activity || undefined };
  const { data, isPending } = useQuery({
    queryKey: cashKeys.report(params),
    queryFn: ({ signal }) => getCashReport(params, signal),
  });
  const invalidate = [cashKeys.all, ['dashboard']];
  const remove = useAction(deleteCashMovement, { invalidate, success: 'cash.deleted' });
  const review = useAction((id: string) => updateCashMovement(id, { review: 'REVIEWED' }), {
    invalidate,
    success: 'cash.reviewed',
  });

  const exportCsv = () =>
    data &&
    downloadCsv(`Alcaravan_CajaInterna_${from}_${to}.csv`, [
      ['Fecha', 'Tipo', 'Categoría', 'Actividad', 'Concepto', 'Importe', 'Revisión', 'Notas'],
      ...data.movements.map((m) => [
        m.occurred_on,
        m.direction === 'IN' ? 'Entrada' : 'Salida',
        t(`cashCategory.${m.category}`),
        t(`activity.${m.activity}`),
        m.concept,
        csvEuros(m.direction === 'IN' ? m.amount_cents : -m.amount_cents),
        t(`review.${m.review}`),
        m.notes,
      ]),
    ]);

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.internal')}
        title={t('cash.title')}
        description={t('cash.subtitle')}
        actions={
          <>
            <Button variant="outline" disabled={!data?.movements.length} onClick={exportCsv}>
              <Download /> CSV
            </Button>
            {can('internal_cash.manage') && (
              <Button onClick={() => setEditing('new')}>
                <Plus /> {t('cash.new')}
              </Button>
            )}
          </>
        }
      />
      <Notice>{t('cash.notice')}</Notice>
      <FilterBar>
        <FilterField label={t('cash.from')}>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </FilterField>
        <FilterField label={t('cash.to')}>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </FilterField>
        <FilterField label={t('common.activity')}>
          <ActivitySelect allowAll value={activity} onChange={setActivity} />
        </FilterField>
      </FilterBar>
      <StatGrid>
        <StatCard label={t('cash.in')} value={money(data?.in_cents)} tone="success" />
        <StatCard label={t('cash.out')} value={money(data?.out_cents)} />
        <StatCard
          label={t('cash.periodNet')}
          value={money((data?.in_cents ?? 0) - (data?.out_cents ?? 0))}
        />
        <StatCard
          label={t('cash.balance')}
          value={money(data?.balance_cents)}
          tone="gold"
          hint={t('cash.balanceHint', { date: date(to || today()) })}
        />
      </StatGrid>
      {data && data.pending_review > 0 && (
        <Notice tone="warning">{t('cash.pendingReview', { count: data.pending_review })}</Notice>
      )}
      <Panel flush>
        <Table>
          <thead>
            <tr>
              <Th>{t('common.date')}</Th>
              <Th>{t('cash.concept')}</Th>
              <Th>{t('cash.category')}</Th>
              <Th>{t('common.activity')}</Th>
              <Th numeric>{t('common.amount')}</Th>
              <Th>{t('cash.review')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={7}>{t('common.loading')}</EmptyRow>}
            {data?.movements.length === 0 && <EmptyRow colSpan={7}>{t('cash.empty')}</EmptyRow>}
            {data?.movements.map((m) => (
              <tr key={m.id}>
                <Td>{date(m.occurred_on)}</Td>
                <Td className="max-w-72">
                  <p className="truncate font-semibold">{m.concept}</p>
                  {m.notes && (
                    <p className="truncate text-[11px] text-muted-foreground">{m.notes}</p>
                  )}
                </Td>
                <Td>{t(`cashCategory.${m.category}`)}</Td>
                <Td>
                  <ActivityBadge activity={m.activity} />
                </Td>
                <Td
                  numeric
                  className={cn(
                    'font-semibold',
                    m.direction === 'IN' ? 'text-success' : 'text-destructive',
                  )}
                >
                  {m.direction === 'IN' ? '+' : '−'} {money(m.amount_cents)}
                </Td>
                <Td>
                  {m.review === 'REVIEWED' ? (
                    <Badge tone="success">{t('review.REVIEWED')}</Badge>
                  ) : (
                    <Badge tone="pending">{t('review.PENDING')}</Badge>
                  )}
                </Td>
                <Td>
                  {can('internal_cash.manage') && (
                    <div className="flex justify-end gap-1.5">
                      {m.review === 'PENDING' && (
                        <Button variant="outline" size="xs" onClick={() => review.mutate(m.id)}>
                          <CheckCheck /> {t('cash.markReviewed')}
                        </Button>
                      )}
                      <Button variant="outline" size="xs" onClick={() => setEditing(m)}>
                        <Pencil /> {t('common.edit')}
                      </Button>
                      <Button
                        variant="destructive-outline"
                        size="xs"
                        aria-label={t('common.delete')}
                        onClick={() =>
                          confirmAction(t('cash.confirmDelete', { concept: m.concept })) &&
                          remove.mutate(m.id)
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
      </Panel>
      {editing && (
        <CashDialog
          movement={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

const schema = z.object({
  occurred_on: z.string().min(1, 'validation.required'),
  direction: z.enum(['IN', 'OUT']),
  amount: zEuros({ positive: true }),
  activity: z.enum(ACTIVITIES),
  category: z.enum(CASH_CATEGORIES),
  concept: z.string().trim().min(1, 'validation.required').max(200),
  notes: z.string().max(2000),
  review: z.enum(['PENDING', 'REVIEWED']),
});
type Values = z.infer<typeof schema>;

function CashDialog({ movement, onClose }: { movement: CashMovement | null; onClose: () => void }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      occurred_on: movement?.occurred_on ?? today(),
      direction: movement?.direction ?? 'IN',
      amount: centsToInput(movement?.amount_cents),
      activity: movement?.activity ?? 'BAND',
      category: movement?.category ?? 'EVENT',
      concept: movement?.concept ?? '',
      notes: movement?.notes ?? '',
      review: movement?.review ?? 'PENDING',
    },
  });
  const save = useAction(
    (body: CashInput) =>
      movement ? updateCashMovement(movement.id, body) : createCashMovement(body),
    { invalidate: [cashKeys.all, ['dashboard']], success: 'cash.saved', onSuccess: onClose },
  );
  const onSubmit = handleSubmit((v) =>
    save.mutate({
      occurred_on: v.occurred_on,
      direction: v.direction,
      amount_cents: cents(v.amount),
      activity: v.activity,
      category: v.category,
      concept: v.concept.trim(),
      notes: nullable(v.notes),
      review: v.review,
    }),
  );
  return (
    <Dialog open onClose={onClose} size="lg" title={movement ? t('cash.edit') : t('cash.new')}>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormGrid>
          <FormField id="c_dir" label={t('cash.direction')}>
            <Select id="c_dir" {...register('direction')}>
              <option value="IN">{t('cash.directionIn')}</option>
              <option value="OUT">{t('cash.directionOut')}</option>
            </Select>
          </FormField>
          <FormField id="c_date" label={t('common.date')} error={errors.occurred_on?.message}>
            <Input id="c_date" type="date" {...register('occurred_on')} />
          </FormField>
          <FormField
            id="c_concept"
            label={t('cash.concept')}
            error={errors.concept?.message}
            className="sm:col-span-2"
          >
            <Input id="c_concept" autoFocus {...register('concept')} />
          </FormField>
          <FormField id="c_amount" label={t('common.amount')} error={errors.amount?.message}>
            <Input id="c_amount" inputMode="decimal" {...register('amount')} />
          </FormField>
          <FormField id="c_category" label={t('cash.category')}>
            <Select id="c_category" {...register('category')}>
              {CASH_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`cashCategory.${c}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="c_activity" label={t('common.activity')}>
            <Select id="c_activity" {...register('activity')}>
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {t(`activity.${a}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="c_review" label={t('cash.review')}>
            <Select id="c_review" {...register('review')}>
              <option value="PENDING">{t('review.PENDING')}</option>
              <option value="REVIEWED">{t('review.REVIEWED')}</option>
            </Select>
          </FormField>
          <FormField id="c_notes" label={t('common.notes')} className="sm:col-span-2">
            <Textarea id="c_notes" {...register('notes')} />
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
