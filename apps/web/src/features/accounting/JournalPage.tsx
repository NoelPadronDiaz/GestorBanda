import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookPlus, ChevronDown, Download, Plus, Undo2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Activity } from '@alcaravan/shared';
import {
  accountingKeys,
  listEntries,
  listPending,
  pendingKey,
  reverseEntry,
  type EntryDraft,
  type SourceType,
} from '@/api/accounting';
import { useAction } from '@/api/use-action';
import { FilterBar, FilterField, Notice, Page, PageHeader, Panel } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { ActivityBadge, ActivitySelect, YearSelect } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { PostEntryDialog, type PostTarget } from '@/features/shared/PostEntryDialog';
import { emptyDraft } from '@/features/shared/drafts';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { currentYear, date, money } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;
const SOURCE_TYPES: SourceType[] = [
  'MANUAL',
  'OPENING',
  'INVOICE',
  'INVOICE_PAYMENT',
  'EXPENSE',
  'EXPENSE_PAYMENT',
  'PAYROLL',
  'PAYROLL_PAYMENT',
  'REVERSAL',
  'REGULARIZATION',
  'CLOSING',
];
/** Asientos que el sistema genera y no se revierten a mano. */
const NOT_REVERSIBLE: SourceType[] = ['REVERSAL', 'REGULARIZATION', 'CLOSING'];

export function JournalPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [year, setYear] = useState(currentYear());
  const [activity, setActivity] = useState<Activity | ''>('');
  const [source, setSource] = useState<SourceType | ''>('');
  const [account, setAccount] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [posting, setPosting] = useState<PostTarget | null>(null);
  const [manual, setManual] = useState<EntryDraft | null>(null);

  const accountFilter = /^\d{1,10}$/.test(account) ? account : undefined;
  const params = {
    page,
    page_size: PAGE_SIZE,
    year,
    activity: activity || undefined,
    source_type: source || undefined,
    account: accountFilter,
  };
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: accountingKeys.entries(params),
    queryFn: ({ signal }) => listEntries(params, signal),
    placeholderData: keepPreviousData,
  });
  const { data: pending } = useQuery({
    queryKey: pendingKey(year),
    queryFn: ({ signal }) => listPending(year, signal),
  });
  const reverse = useAction(reverseEntry, {
    invalidate: [
      accountingKeys.all,
      ['billing'],
      ['payroll'],
      ['school'],
      ['dashboard'],
      ['treasury'],
    ],
    success: (entry) => t('journal.reversed', { number: entry.number }),
  });
  const lastPage = Math.max(1, Math.ceil((data?.meta.total ?? 0) / PAGE_SIZE));
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = async () => {
    const rows: (string | number | null)[][] = [
      [
        'Asiento',
        'Fecha',
        'Referencia',
        'Concepto',
        'Actividad',
        'Origen',
        'Cuenta',
        'Nombre cuenta',
        'Descripción',
        'Debe',
        'Haber',
      ],
    ];
    for (let p = 1; ; p++) {
      const chunk = await listEntries({ ...params, page: p, page_size: 100 });
      for (const e of chunk.data)
        for (const l of e.lines)
          rows.push([
            e.number,
            e.entry_date,
            e.reference,
            e.concept,
            t(`activity.${e.activity}`),
            t(`sourceType.${e.source_type}`),
            l.account_code,
            l.account_name,
            l.description,
            csvEuros(l.debit_cents),
            csvEuros(l.credit_cents),
          ]);
      if (p * 100 >= chunk.meta.total) break;
    }
    downloadCsv(`Alcaravan_Diario_${year}.csv`, rows);
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.accounting')}
        title={t('journal.title')}
        description={t('journal.subtitle')}
        actions={
          can('accounting.post') && (
            <Button onClick={() => setManual(emptyDraft('MANUAL'))}>
              <Plus /> {t('journal.manual')}
            </Button>
          )
        }
      />
      <Notice>{t('journal.notice')}</Notice>

      {pending && pending.length > 0 && (
        <Panel flush title={t('journal.pendingTitle', { count: pending.length })}>
          <p className="-mt-2 px-5 pb-3 text-sm text-muted-foreground">
            {t('journal.pendingHint')}
          </p>
          <Table>
            <thead>
              <tr>
                <Th>{t('common.date')}</Th>
                <Th>{t('journal.document')}</Th>
                <Th>{t('journal.pendingKind')}</Th>
                <Th>{t('common.activity')}</Th>
                <Th numeric>{t('common.amount')}</Th>
                <Th className="text-right">{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {pending.map((doc) => (
                <tr key={`${doc.source_type}-${doc.source_id}`}>
                  <Td>{date(doc.date)}</Td>
                  <Td className="font-semibold">{doc.label}</Td>
                  <Td>
                    <Badge tone={doc.source_type.endsWith('_PAYMENT') ? 'info' : 'pending'}>
                      {t(`sourceType.${doc.source_type}`)}
                    </Badge>
                  </Td>
                  <Td>
                    <ActivityBadge activity={doc.activity} />
                  </Td>
                  <Td numeric>{money(doc.amount_cents)}</Td>
                  <Td className="text-right">
                    {can('accounting.post') && (
                      <Button
                        variant="gold"
                        size="xs"
                        onClick={() =>
                          setPosting({
                            type: doc.source_type,
                            id: doc.source_id,
                            label: doc.label,
                            hasInputTax: doc.has_input_tax,
                          })
                        }
                      >
                        <BookPlus /> {t('entry.postAction')}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      <Panel
        flush
        title={t('journal.entriesTitle')}
        actions={
          <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
            <Download /> CSV
          </Button>
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
            <FilterField label={t('journal.source')}>
              <Select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as SourceType | '');
                  setPage(1);
                }}
                className="sm:w-48"
              >
                <option value="">{t('common.all')}</option>
                {SOURCE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {t(`sourceType.${s}`)}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label={t('journal.account')}>
              <Input
                value={account}
                inputMode="numeric"
                placeholder="p. ej. 572"
                onChange={(e) => {
                  setAccount(e.target.value.trim());
                  setPage(1);
                }}
                className="w-32"
              />
            </FilterField>
          </FilterBar>
        </div>
        <Table>
          <thead>
            <tr>
              <Th className="w-8" />
              <Th>{t('journal.number')}</Th>
              <Th>{t('common.date')}</Th>
              <Th>{t('journal.concept')}</Th>
              <Th>{t('journal.source')}</Th>
              <Th>{t('common.activity')}</Th>
              <Th numeric>{t('common.amount')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody className={isPlaceholderData ? 'opacity-60' : undefined}>
            {isPending && <EmptyRow colSpan={8}>{t('common.loading')}</EmptyRow>}
            {data?.data.length === 0 && <EmptyRow colSpan={8}>{t('journal.empty')}</EmptyRow>}
            {data?.data.map((entry) => {
              const expanded = open.has(entry.id);
              return (
                <Fragment key={entry.id}>
                  <tr
                    className={cn('cursor-pointer', entry.reversed_by_id && 'opacity-60')}
                    onClick={() => toggle(entry.id)}
                  >
                    <Td>
                      <ChevronDown
                        className={cn(
                          'size-4 text-muted-foreground transition-transform',
                          expanded && 'rotate-180',
                        )}
                        aria-hidden
                      />
                    </Td>
                    <Td className="tabular font-semibold">{entry.number}</Td>
                    <Td>{date(entry.entry_date)}</Td>
                    <Td className="max-w-72">
                      <p className="truncate font-medium">{entry.concept}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {entry.reference}
                      </p>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          entry.source_type === 'REVERSAL'
                            ? 'danger'
                            : entry.source_type === 'MANUAL'
                              ? 'neutral'
                              : 'info'
                        }
                      >
                        {t(`sourceType.${entry.source_type}`)}
                      </Badge>
                      {entry.reversed_by_id && (
                        <Badge tone="danger" className="ml-1">
                          {t('journal.reversedBadge')}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <ActivityBadge activity={entry.activity} />
                    </Td>
                    <Td numeric>{money(entry.total_cents)}</Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      {can('accounting.post') &&
                        !entry.reversed_by_id &&
                        !NOT_REVERSIBLE.includes(entry.source_type) && (
                          <Button
                            variant="destructive-outline"
                            size="xs"
                            onClick={() =>
                              confirmAction(
                                t('journal.confirmReverse', { number: entry.number }),
                              ) && reverse.mutate(entry.id)
                            }
                          >
                            <Undo2 /> {t('journal.reverse')}
                          </Button>
                        )}
                    </Td>
                  </tr>
                  {expanded && (
                    <tr className="bg-secondary/40">
                      <td colSpan={8} className="px-5 py-3">
                        <table className="tabular w-full text-sm">
                          <thead>
                            <tr className="text-left text-[11px] text-muted-foreground uppercase">
                              <th className="py-1 pr-3 font-semibold">{t('journal.account')}</th>
                              <th className="py-1 pr-3 font-semibold">
                                {t('journal.lineDescription')}
                              </th>
                              <th className="py-1 pr-3 text-right font-semibold">
                                {t('entry.debit')}
                              </th>
                              <th className="py-1 text-right font-semibold">{t('entry.credit')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.lines.map((line) => (
                              <tr key={line.position} className="border-t border-border/60">
                                <td className={cn('py-1.5 pr-3', line.credit_cents > 0 && 'pl-6')}>
                                  <strong>{line.account_code}</strong>{' '}
                                  <span className="text-muted-foreground">{line.account_name}</span>
                                </td>
                                <td className="py-1.5 pr-3 text-muted-foreground">
                                  {line.description ?? ''}
                                </td>
                                <td className="py-1.5 pr-3 text-right">
                                  {line.debit_cents ? money(line.debit_cents) : ''}
                                </td>
                                <td className="py-1.5 text-right">
                                  {line.credit_cents ? money(line.credit_cents) : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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

      <PostEntryDialog
        key={posting ? `${posting.type}-${posting.id}` : 'none'}
        target={posting}
        onClose={() => setPosting(null)}
      />
      {manual && <PostEntryDialog initialDraft={manual} onClose={() => setManual(null)} />}
    </Page>
  );
}
