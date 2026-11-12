import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Activity } from '@alcaravan/shared';
import {
  accountingKeys,
  getBalanceSheet,
  getIncomeStatement,
  type ReportLine,
} from '@/api/accounting';
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
import { Button } from '@/components/ui/button';
import { ActivitySelect, YearSelect } from '@/features/shared/controls';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { currentYear, money } from '@/lib/format';
import { cn } from '@/lib/utils';

function ReportSection({
  title,
  lines,
  total,
  totalLabel,
}: {
  title: string;
  lines: ReportLine[];
  total: number;
  totalLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-1">
      <h3 className="text-xs font-bold tracking-wider text-gold-strong uppercase">{title}</h3>
      {lines.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">{t('reports.noLines')}</p>
      )}
      <dl className="tabular text-sm">
        {lines.map((line) => (
          <div
            key={line.account_code}
            className="flex justify-between gap-3 border-b border-border/60 py-1.5"
          >
            <dt className="min-w-0 truncate">
              <strong>{line.account_code}</strong>{' '}
              <span className="text-muted-foreground">{line.account_name}</span>
            </dt>
            <dd className={cn(line.amount_cents < 0 && 'text-destructive')}>
              {money(line.amount_cents)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 py-2 font-bold">
          <dt>{totalLabel}</dt>
          <dd>{money(total)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(currentYear());
  const [activity, setActivity] = useState<Activity | ''>('');
  const { data: income } = useQuery({
    queryKey: accountingKeys.income(year, activity || undefined),
    queryFn: ({ signal }) => getIncomeStatement(year, activity || undefined, signal),
  });
  const { data: balance } = useQuery({
    queryKey: accountingKeys.balance(year),
    queryFn: ({ signal }) => getBalanceSheet(year, signal),
  });

  const exportCsv = () => {
    if (!income || !balance) return;
    const lines = (section: string, rows: ReportLine[]) =>
      rows.map((r) => [section, r.account_code, r.account_name, csvEuros(r.amount_cents)]);
    downloadCsv(`Alcaravan_Informes_${year}.csv`, [
      ['Bloque', 'Cuenta', 'Nombre', 'Importe'],
      ...lines('Ingresos', income.income),
      ...lines('Gastos', income.expenses),
      ['Resultado', '', '', csvEuros(income.result_cents)],
      ...lines('Activo', balance.assets),
      ...lines('Pasivo', balance.liabilities),
      ...lines('Patrimonio neto', balance.equity),
      [
        'Patrimonio neto',
        '129',
        'Resultado pendiente de cierre',
        csvEuros(balance.pending_result_cents),
      ],
    ]);
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.accounting')}
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          <div className="no-print flex gap-2">
            <Button variant="outline" disabled={!income || !balance} onClick={exportCsv}>
              <Download /> CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t('reports.print')}
            </Button>
          </div>
        }
      />
      <div className="no-print">
        <FilterBar>
          <FilterField label={t('common.year')}>
            <YearSelect value={year} onChange={setYear} />
          </FilterField>
          <FilterField label={t('reports.activityPl')}>
            <ActivitySelect allowAll value={activity} onChange={setActivity} />
          </FilterField>
        </FilterBar>
      </div>
      <Notice>{t('reports.provisional')}</Notice>

      <StatGrid>
        <StatCard
          label={t('reports.income')}
          value={money(income?.income_total_cents)}
          tone="success"
        />
        <StatCard label={t('reports.expenses')} value={money(income?.expenses_total_cents)} />
        <StatCard
          label={t('reports.result')}
          value={money(income?.result_cents)}
          tone={(income?.result_cents ?? 0) < 0 ? 'warning' : 'gold'}
          hint={activity ? t(`activity.${activity}`) : t('activity.ALL')}
        />
        <StatCard label={t('reports.assets')} value={money(balance?.assets_total_cents)} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={t('reports.plTitle', { year })}>
          {income && (
            <div className="grid gap-6">
              <ReportSection
                title={t('reports.income')}
                lines={income.income}
                total={income.income_total_cents}
                totalLabel={t('reports.totalIncome')}
              />
              <ReportSection
                title={t('reports.expenses')}
                lines={income.expenses}
                total={income.expenses_total_cents}
                totalLabel={t('reports.totalExpenses')}
              />
              <div
                className={cn(
                  'flex justify-between rounded-lg border-t-2 border-gold-strong bg-accent px-3 py-3 text-lg font-bold',
                  income.result_cents < 0 && 'text-destructive',
                )}
              >
                <span>
                  {income.result_cents >= 0 ? t('reports.surplus') : t('reports.deficit')}
                </span>
                <span className="tabular">{money(income.result_cents)}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel title={t('reports.bsTitle', { year })}>
          {balance && (
            <div className="grid gap-6">
              {balance.warnings.map((w) => (
                <Notice key={w} tone="warning">
                  {t(`reports.warnings.${w}`)}
                </Notice>
              ))}
              <ReportSection
                title={t('reports.assets')}
                lines={balance.assets}
                total={balance.assets_total_cents}
                totalLabel={t('reports.totalAssets')}
              />
              <ReportSection
                title={t('reports.liabilities')}
                lines={balance.liabilities}
                total={balance.liabilities_total_cents}
                totalLabel={t('reports.totalLiabilities')}
              />
              <ReportSection
                title={t('reports.equity')}
                lines={[
                  ...balance.equity,
                  ...(balance.pending_result_cents
                    ? [
                        {
                          account_code: '129',
                          account_name: t('reports.pendingResult'),
                          amount_cents: balance.pending_result_cents,
                        },
                      ]
                    : []),
                ]}
                total={balance.equity_total_cents}
                totalLabel={t('reports.totalEquity')}
              />
              <div
                className={cn(
                  'flex justify-between rounded-lg border px-3 py-2 text-sm',
                  balance.difference_cents
                    ? 'border-destructive/40 text-destructive'
                    : 'border-success/30 bg-success-soft text-success',
                )}
              >
                <span>{t('reports.check')}</span>
                <span className="tabular font-bold">
                  {balance.difference_cents
                    ? money(balance.difference_cents)
                    : t('reports.balanced')}
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </Page>
  );
}
