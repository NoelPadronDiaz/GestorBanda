import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, FileText, GraduationCap, Receipt, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { dashboardKey, getDashboard } from '@/api/finance';
import { NAV_GROUPS } from '@/app/modules';
import { Page, PageHeader, Panel, StatCard, StatGrid } from '@/components/page';
import { Button } from '@/components/ui/button';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { PaymentBadge, YearSelect } from '@/features/shared/controls';
import { currentYear, date, money } from '@/lib/format';

const ALERT_LINKS: Record<string, string> = {
  RECURRING_DUE: '/billing/recurring',
  GRANT_DEADLINE: '/tax/grants',
  BANK_PENDING: '/accounting/treasury',
  YEAR_NOT_CLOSED: '/accounting/fiscal-years',
};

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const [year, setYear] = useState(currentYear());
  const { data } = useQuery({
    queryKey: dashboardKey(year),
    queryFn: ({ signal }) => getDashboard(year, signal),
  });

  const shortcuts = NAV_GROUPS.flatMap((group) => group.items)
    .filter((module) => !module.permission || can(module.permission))
    .slice(0, 8);

  return (
    <Page>
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        description={t('dashboard.intro', { email: user?.email })}
        actions={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t('common.year')}
            <YearSelect value={year} onChange={setYear} />
          </label>
        }
      />

      {(data?.invoices || data?.school || data?.expenses) && (
        <StatGrid>
          {data.invoices && (
            <StatCard
              icon={FileText}
              tone="gold"
              label={t('dashboard.invoiced')}
              value={money(data.invoices.total_cents)}
              hint={t('dashboard.invoiceCount', { count: data.invoices.count })}
            />
          )}
          {data.invoices && (
            <StatCard
              icon={Wallet}
              tone="warning"
              label={t('dashboard.receivable')}
              value={money(data.invoices.pending_cents)}
              hint={t('dashboard.pendingCount', { count: data.invoices.pending_count })}
            />
          )}
          {data.school && (
            <StatCard
              icon={GraduationCap}
              label={t('dashboard.feesPending')}
              value={money(data.school.fees_pending_cents)}
              hint={t('dashboard.feesHint', {
                count: data.school.fees_pending_count,
                students: data.school.active_students,
              })}
            />
          )}
          {data.expenses && (
            <StatCard
              icon={Receipt}
              label={t('dashboard.payable')}
              value={money(data.expenses.pending_cents)}
              hint={t('dashboard.pendingCount', { count: data.expenses.pending_count })}
            />
          )}
        </StatGrid>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Panel title={t('dashboard.shortcuts')}>
          {shortcuts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.empty')}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {shortcuts.map(({ id, path, labelKey, descriptionKey, icon: Icon }) => (
                <Link
                  key={id}
                  to={path}
                  className="group flex items-center gap-3 rounded-xl border bg-secondary/40 p-3 outline-none transition-colors hover:border-gold hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-gold-strong shadow-sm">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{t(labelKey)}</span>
                    {descriptionKey && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {t(descriptionKey)}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('dashboard.followUp')}>
          <div className="grid gap-2">
            {data?.alerts.length ? (
              data.alerts.map((alert) => (
                <Link
                  key={alert.kind}
                  to={ALERT_LINKS[alert.kind] ?? '/'}
                  className="flex items-center gap-3 rounded-xl border bg-secondary/40 px-3 py-2.5 text-[13px] hover:border-gold"
                >
                  <AlertCircle className="size-4 shrink-0 text-gold-strong" aria-hidden />
                  <span className="flex-1">
                    {t(`dashboard.alerts.${alert.kind}`, {
                      count: alert.count,
                      detail: alert.detail ? date(alert.detail) : '',
                      year: alert.detail,
                    })}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
                {t('dashboard.allClear')}
              </p>
            )}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            {t('dashboard.footnote')}
          </p>
        </Panel>
      </div>

      {can('billing.read') && (
        <Panel
          flush
          title={t('dashboard.recentInvoices')}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/billing/invoices">{t('common.viewAll')}</Link>
            </Button>
          }
        >
          <Table>
            <thead>
              <tr>
                <Th>{t('invoices.number')}</Th>
                <Th>{t('common.date')}</Th>
                <Th>{t('invoices.recipient')}</Th>
                <Th numeric>{t('common.total')}</Th>
                <Th>{t('common.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {data?.recent_invoices.length === 0 && (
                <EmptyRow colSpan={5}>{t('invoices.empty')}</EmptyRow>
              )}
              {data?.recent_invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <Td>
                    <Link
                      className="font-semibold hover:underline"
                      to={`/billing/invoices/${invoice.id}`}
                    >
                      {invoice.code}
                    </Link>
                  </Td>
                  <Td>{date(invoice.issue_date)}</Td>
                  <Td>{invoice.recipient.name}</Td>
                  <Td numeric>{money(invoice.total_cents)}</Td>
                  <Td>
                    <PaymentBadge status={invoice.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </Page>
  );
}
