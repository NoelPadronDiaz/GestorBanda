import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Link2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ACTIVITIES } from '@alcaravan/shared';
import { billingKeys, listExpenses } from '@/api/billing';
import {
  createGrant,
  deleteGrant,
  GRANT_STATUSES,
  grantKeys,
  linkGrantExpense,
  listGrants,
  unlinkGrantExpense,
  updateGrant,
  type Grant,
  type GrantInput,
  type GrantStatus,
} from '@/api/finance';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import { Page, PageHeader, Panel, StatCard, StatGrid } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { ActivityBadge, YearSelect } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { centsToInput, currentYear, date, money, today } from '@/lib/format';
import { cents, nullable, zEuros } from '@/lib/forms';

const STATUS_TONE: Record<GrantStatus, 'neutral' | 'pending' | 'info' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  IN_PREPARATION: 'pending',
  SUBMITTED: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
};

function daysUntil(iso: string) {
  return Math.round((Date.parse(iso) - Date.parse(today())) / 86_400_000);
}

export function GrantsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [year, setYear] = useState(currentYear());
  const [editing, setEditing] = useState<Grant | 'new' | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const { data, isPending } = useQuery({
    queryKey: grantKeys.list(year),
    queryFn: ({ signal }) => listGrants(year, signal),
  });
  const remove = useAction(deleteGrant, {
    invalidate: [grantKeys.all, ['dashboard']],
    success: 'grants.deleted',
  });
  const unlink = useAction(
    (input: { id: string; expenseId: string }) => unlinkGrantExpense(input.id, input.expenseId),
    { invalidate: [grantKeys.all], success: 'grants.unlinked' },
  );

  const linkingGrant = data?.find((g) => g.id === linkingId);
  const awarded = data?.reduce((s, g) => s + g.awarded_cents, 0) ?? 0;
  const received = data?.reduce((s, g) => s + g.received_cents, 0) ?? 0;
  const justified = data?.reduce((s, g) => s + g.justified_cents, 0) ?? 0;

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.tax')}
        title={t('grants.title')}
        description={t('grants.subtitle')}
        actions={
          <>
            <YearSelect value={year} onChange={setYear} />
            {can('grants.manage') && (
              <Button onClick={() => setEditing('new')}>
                <Plus /> {t('grants.new')}
              </Button>
            )}
          </>
        }
      />
      <StatGrid>
        <StatCard label={t('grants.count')} value={String(data?.length ?? '—')} />
        <StatCard label={t('grants.awarded')} value={money(awarded)} tone="gold" />
        <StatCard
          label={t('grants.received')}
          value={money(received)}
          hint={t('grants.toReceive', { amount: money(awarded - received) })}
        />
        <StatCard
          label={t('grants.justified')}
          value={money(justified)}
          hint={t('grants.toJustify', { amount: money(Math.max(0, awarded - justified)) })}
          tone={justified < awarded ? 'warning' : 'success'}
        />
      </StatGrid>

      {isPending && (
        <Panel>
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </Panel>
      )}
      {data?.length === 0 && (
        <Panel>
          <p className="text-sm text-muted-foreground">{t('grants.empty')}</p>
        </Panel>
      )}
      <div className="grid gap-4">
        {data?.map((grant) => {
          const pct = grant.awarded_cents
            ? Math.min(100, (grant.justified_cents / grant.awarded_cents) * 100)
            : 0;
          const days = grant.justification_deadline
            ? daysUntil(grant.justification_deadline)
            : null;
          return (
            <Panel
              key={grant.id}
              title={grant.title}
              actions={
                can('grants.manage') && (
                  <>
                    <Button variant="gold" size="xs" onClick={() => setLinkingId(grant.id)}>
                      <Link2 /> {t('grants.linkExpense')}
                    </Button>
                    <Button variant="outline" size="xs" onClick={() => setEditing(grant)}>
                      <Pencil /> {t('common.edit')}
                    </Button>
                    <Button
                      variant="destructive-outline"
                      size="xs"
                      aria-label={t('common.delete')}
                      onClick={() =>
                        confirmAction(t('grants.confirmDelete', { title: grant.title })) &&
                        remove.mutate(grant.id)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </>
                )
              }
            >
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{grant.issuer}</span>
                  {grant.reference && (
                    <span className="text-muted-foreground">· {grant.reference}</span>
                  )}
                  <Badge tone={STATUS_TONE[grant.status]}>{t(`grantStatus.${grant.status}`)}</Badge>
                  <ActivityBadge activity={grant.activity} />
                  {grant.justification_deadline && (
                    <Badge
                      tone={
                        days !== null && days < 0
                          ? 'danger'
                          : days !== null && days <= 30
                            ? 'pending'
                            : 'neutral'
                      }
                    >
                      <CalendarClock className="size-3" />{' '}
                      {t('grants.deadline', { date: date(grant.justification_deadline) })}
                      {days !== null &&
                        days >= 0 &&
                        days <= 30 &&
                        ` · ${t('grants.daysLeft', { count: days })}`}
                    </Badge>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {t('grants.justifiedOf', {
                        justified: money(grant.justified_cents),
                        awarded: money(grant.awarded_cents),
                      })}
                    </span>
                    <span className="tabular">{Math.round(pct)} %</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {grant.expenses.length > 0 && (
                  <div className="rounded-xl border">
                    <Table>
                      <thead>
                        <tr>
                          <Th>{t('common.date')}</Th>
                          <Th>{t('expenses.supplier')}</Th>
                          <Th>{t('expenses.concept')}</Th>
                          <Th numeric>{t('common.total')}</Th>
                          <Th />
                        </tr>
                      </thead>
                      <tbody>
                        {grant.expenses.map((e) => (
                          <tr key={e.id}>
                            <Td>{date(e.issue_date)}</Td>
                            <Td>
                              {e.supplier_name} · {e.number}
                            </Td>
                            <Td className="max-w-64 truncate text-muted-foreground">{e.concept}</Td>
                            <Td numeric>{money(e.total_cents)}</Td>
                            <Td className="text-right">
                              {can('grants.manage') && (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  aria-label={t('grants.unlink')}
                                  onClick={() => unlink.mutate({ id: grant.id, expenseId: e.id })}
                                >
                                  <X />
                                </Button>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
                {grant.notes && (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{grant.notes}</p>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
      {editing && (
        <GrantDialog
          grant={editing === 'new' ? null : editing}
          year={year}
          onClose={() => setEditing(null)}
        />
      )}
      {linkingGrant && (
        <LinkExpenseDialog grant={linkingGrant} onClose={() => setLinkingId(null)} />
      )}
    </Page>
  );
}

const schema = z.object({
  issuer: z.string().trim().min(1, 'validation.required').max(160),
  title: z.string().trim().min(1, 'validation.required').max(200),
  year: z.string().regex(/^\d{4}$/, 'validation.required'),
  activity: z.enum(ACTIVITIES),
  awarded: zEuros(),
  received: zEuros({ optional: true }),
  justification_deadline: z.string(),
  status: z.enum(GRANT_STATUSES),
  reference: z.string().max(100),
  notes: z.string().max(2000),
});
type Values = z.infer<typeof schema>;

function GrantDialog({
  grant,
  year,
  onClose,
}: {
  grant: Grant | null;
  year: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      issuer: grant?.issuer ?? '',
      title: grant?.title ?? '',
      year: String(grant?.year ?? year),
      activity: grant?.activity ?? 'BAND',
      awarded: centsToInput(grant?.awarded_cents),
      received: centsToInput(grant?.received_cents ?? 0),
      justification_deadline: grant?.justification_deadline ?? '',
      status: grant?.status ?? 'PENDING',
      reference: grant?.reference ?? '',
      notes: grant?.notes ?? '',
    },
  });
  const save = useAction(
    (body: GrantInput) => (grant ? updateGrant(grant.id, body) : createGrant(body)),
    { invalidate: [grantKeys.all, ['dashboard']], success: 'grants.saved', onSuccess: onClose },
  );
  const onSubmit = handleSubmit((v) =>
    save.mutate({
      issuer: v.issuer.trim(),
      title: v.title.trim(),
      year: Number(v.year),
      activity: v.activity,
      awarded_cents: cents(v.awarded),
      received_cents: cents(v.received),
      justification_deadline: v.justification_deadline || null,
      status: v.status,
      reference: nullable(v.reference),
      notes: nullable(v.notes),
    }),
  );
  return (
    <Dialog open onClose={onClose} size="lg" title={grant ? t('grants.edit') : t('grants.new')}>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormGrid>
          <FormField
            id="g_title"
            label={t('grants.titleField')}
            error={errors.title?.message}
            className="sm:col-span-2"
          >
            <Input id="g_title" autoFocus {...register('title')} />
          </FormField>
          <FormField id="g_issuer" label={t('grants.issuer')} error={errors.issuer?.message}>
            <Input
              id="g_issuer"
              placeholder={t('grants.issuerPlaceholder')}
              {...register('issuer')}
            />
          </FormField>
          <FormField id="g_ref" label={t('grants.reference')}>
            <Input id="g_ref" {...register('reference')} />
          </FormField>
          <FormField id="g_year" label={t('common.year')} error={errors.year?.message}>
            <Input id="g_year" inputMode="numeric" {...register('year')} />
          </FormField>
          <FormField id="g_activity" label={t('common.activity')}>
            <Select id="g_activity" {...register('activity')}>
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {t(`activity.${a}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="g_awarded" label={t('grants.awarded')} error={errors.awarded?.message}>
            <Input id="g_awarded" inputMode="decimal" {...register('awarded')} />
          </FormField>
          <FormField id="g_received" label={t('grants.received')} error={errors.received?.message}>
            <Input id="g_received" inputMode="decimal" {...register('received')} />
          </FormField>
          <FormField id="g_status" label={t('common.status')}>
            <Select id="g_status" {...register('status')}>
              {GRANT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`grantStatus.${s}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="g_deadline" label={t('grants.deadlineField')}>
            <Input id="g_deadline" type="date" {...register('justification_deadline')} />
          </FormField>
          <FormField id="g_notes" label={t('common.notes')} className="sm:col-span-2">
            <Textarea id="g_notes" {...register('notes')} />
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

function LinkExpenseDialog({ grant, onClose }: { grant: Grant; onClose: () => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const params = { page: 1, page_size: 50, year: grant.year, q: q || undefined };
  const { data, isPending } = useQuery({
    queryKey: billingKeys.expenses(params),
    queryFn: ({ signal }) => listExpenses(params, signal),
  });
  const linked = new Set(grant.expenses.map((e) => e.id));
  const link = useAction((expenseId: string) => linkGrantExpense(grant.id, expenseId), {
    invalidate: [grantKeys.all],
    success: 'grants.linked',
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('grants.linkTitle', { title: grant.title })}
      description={t('grants.linkHint')}
    >
      <div className="grid gap-4">
        <Input
          type="search"
          value={search}
          placeholder={t('common.search')}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-96 overflow-auto rounded-xl border">
          <Table>
            <tbody>
              {isPending && <EmptyRow colSpan={4}>{t('common.loading')}</EmptyRow>}
              {data?.data.length === 0 && <EmptyRow colSpan={4}>{t('expenses.empty')}</EmptyRow>}
              {data?.data.map((e) => (
                <tr key={e.id}>
                  <Td>{date(e.issue_date)}</Td>
                  <Td className="max-w-64">
                    <p className="truncate font-semibold">
                      {e.supplier_name} · {e.number}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{e.concept}</p>
                  </Td>
                  <Td numeric>{money(e.total_cents)}</Td>
                  <Td className="text-right">
                    {linked.has(e.id) ? (
                      <Badge tone="success">{t('grants.alreadyLinked')}</Badge>
                    ) : (
                      <Button size="xs" disabled={link.isPending} onClick={() => link.mutate(e.id)}>
                        {t('grants.link')}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
