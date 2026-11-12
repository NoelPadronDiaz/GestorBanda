import { useQuery } from '@tanstack/react-query';
import { Lock, Scale } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  accountingKeys,
  closeFiscalYear,
  getClosePreview,
  listFiscalYears,
  type DraftLine,
  type EntryDraft,
} from '@/api/accounting';
import { useAction } from '@/api/use-action';
import { Notice, Page, PageHeader, Panel, StatCard, StatGrid } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { YearSelect } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { emptyDraft } from '@/features/shared/drafts';
import { PostEntryDialog } from '@/features/shared/PostEntryDialog';
import { currentYear, date, money } from '@/lib/format';

function LinesTable({ lines }: { lines: DraftLine[] }) {
  const { t } = useTranslation();
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('journal.account')}</Th>
          <Th numeric>{t('entry.debit')}</Th>
          <Th numeric>{t('entry.credit')}</Th>
        </tr>
      </thead>
      <tbody>
        {lines.length === 0 && <EmptyRow colSpan={3}>{t('fiscalYears.noLines')}</EmptyRow>}
        {lines.map((line, i) => (
          <tr key={`${line.account_code}-${i}`}>
            <Td>
              <strong className="tabular">{line.account_code}</strong>{' '}
              <span className="text-muted-foreground">{line.description}</span>
            </Td>
            <Td numeric>{line.debit_cents ? money(line.debit_cents) : ''}</Td>
            <Td numeric>{line.credit_cents ? money(line.credit_cents) : ''}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function FiscalYearsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [year, setYear] = useState(currentYear() - 1);
  const [opening, setOpening] = useState<EntryDraft | null>(null);
  const { data: years } = useQuery({
    queryKey: accountingKeys.years,
    queryFn: ({ signal }) => listFiscalYears(signal),
  });
  const { data: preview, isPending } = useQuery({
    queryKey: accountingKeys.closePreview(year),
    queryFn: ({ signal }) => getClosePreview(year, signal),
  });
  const close = useAction(() => closeFiscalYear(year), {
    invalidate: [accountingKeys.all, ['dashboard'], ['budgets']],
    success: () => t('fiscalYears.closed', { year, next: year + 1 }),
  });
  const hasEntries = (years ?? []).some((y) => y.entry_count > 0);

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.accounting')}
        title={t('fiscalYears.title')}
        description={t('fiscalYears.subtitle')}
      />

      {can('accounting.post') && (
        <Panel title={t('fiscalYears.openingTitle')}>
          <p className="mb-4 text-sm text-muted-foreground">{t('fiscalYears.openingHint')}</p>
          {!hasEntries && (
            <div className="mb-4">
              <Notice tone="warning">{t('fiscalYears.firstYearNotice')}</Notice>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() =>
              setOpening({
                ...emptyDraft('OPENING', `${currentYear()}-01-01`),
                reference: `APERTURA ${currentYear()}`,
                concept: t('fiscalYears.openingConcept'),
              })
            }
          >
            <Scale /> {t('fiscalYears.openingAction')}
          </Button>
        </Panel>
      )}

      <Panel flush title={t('fiscalYears.listTitle')}>
        <Table>
          <thead>
            <tr>
              <Th>{t('common.year')}</Th>
              <Th>{t('common.status')}</Th>
              <Th numeric>{t('fiscalYears.entries')}</Th>
              <Th>{t('fiscalYears.closedAt')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {years?.length === 0 && <EmptyRow colSpan={5}>{t('fiscalYears.empty')}</EmptyRow>}
            {years?.map((y) => (
              <tr key={y.year} className={y.year === year ? 'bg-accent/40' : undefined}>
                <Td className="font-semibold">{y.year}</Td>
                <Td>
                  {y.status === 'CLOSED' ? (
                    <Badge tone="success">
                      <Lock className="size-3" /> {t('fiscalYears.statusClosed')}
                    </Badge>
                  ) : (
                    <Badge tone="pending">{t('fiscalYears.statusOpen')}</Badge>
                  )}
                </Td>
                <Td numeric>{y.entry_count}</Td>
                <Td>{y.closed_at ? date(y.closed_at.slice(0, 10)) : '—'}</Td>
                <Td className="text-right">
                  <Button variant="outline" size="xs" onClick={() => setYear(y.year)}>
                    {t('fiscalYears.review')}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel
        title={t('fiscalYears.previewTitle', { year })}
        actions={<YearSelect value={year} onChange={setYear} />}
      >
        {isPending && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {preview && (
          <div className="grid gap-5">
            <StatGrid>
              <StatCard
                label={t('fiscalYears.ordinaryEntries')}
                value={String(preview.ordinary_entry_count)}
              />
              <StatCard
                label={preview.surplus_cents >= 0 ? t('reports.surplus') : t('reports.deficit')}
                value={money(preview.surplus_cents)}
                tone={preview.surplus_cents >= 0 ? 'gold' : 'warning'}
              />
              <StatCard
                label={t('common.status')}
                value={
                  preview.status === 'CLOSED'
                    ? t('fiscalYears.statusClosed')
                    : t('fiscalYears.statusOpen')
                }
              />
            </StatGrid>
            {preview.blockers
              .filter((b) => preview.status === 'OPEN' || b === 'YEAR_CLOSED')
              .map((b) => (
                <Notice key={b} tone={b === 'YEAR_CLOSED' ? 'success' : 'danger'}>
                  {t(`fiscalYears.blockers.${b}`, { next: year + 1 })}
                </Notice>
              ))}
            {preview.warnings.map((w) => (
              <Notice key={w} tone="warning">
                {t(`reports.warnings.${w}`)}
              </Notice>
            ))}
            {preview.status === 'OPEN' && (
              <>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <h3 className="text-sm font-semibold">{t('fiscalYears.regularization')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t('fiscalYears.regularizationHint')}
                    </p>
                    <div className="rounded-xl border">
                      <LinesTable lines={preview.regularization} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <h3 className="text-sm font-semibold">{t('fiscalYears.closing')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t('fiscalYears.closingHint', { next: year + 1 })}
                    </p>
                    <div className="rounded-xl border">
                      <LinesTable lines={preview.closing} />
                    </div>
                  </div>
                </div>
                {can('accounting.close') && (
                  <div className="flex justify-end">
                    <Button
                      variant="gold"
                      disabled={preview.blockers.length > 0 || close.isPending}
                      onClick={() =>
                        confirmAction(t('fiscalYears.confirmClose', { year, next: year + 1 })) &&
                        close.mutate()
                      }
                    >
                      <Lock /> {t('fiscalYears.closeAction', { year })}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Panel>

      {opening && <PostEntryDialog initialDraft={opening} onClose={() => setOpening(null)} />}
    </Page>
  );
}
