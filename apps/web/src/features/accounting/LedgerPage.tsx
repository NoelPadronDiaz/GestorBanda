import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Activity } from '@alcaravan/shared';
import { accountingKeys, getLedger, getTrialBalance, listAccounts } from '@/api/accounting';
import {
  FilterBar,
  FilterField,
  Page,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  Tabs,
} from '@/components/page';
import { Select } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { ActivitySelect, YearSelect } from '@/features/shared/controls';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { currentYear, date, money } from '@/lib/format';
import { cn } from '@/lib/utils';

export function LedgerPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'ledger' | 'trial'>('ledger');
  const [year, setYear] = useState(currentYear());
  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.accounting')}
        title={t('ledger.title')}
        description={t('ledger.subtitle')}
        actions={<YearSelect value={year} onChange={setYear} />}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'ledger', label: t('ledger.tabs.ledger') },
          { value: 'trial', label: t('ledger.tabs.trial') },
        ]}
      />
      {tab === 'ledger' ? <LedgerTab year={year} /> : <TrialTab year={year} />}
    </Page>
  );
}

function LedgerTab({ year }: { year: number }) {
  const { t } = useTranslation();
  const [account, setAccount] = useState('572');
  const { data: accounts } = useQuery({
    queryKey: accountingKeys.accounts,
    queryFn: ({ signal }) => listAccounts(signal),
    staleTime: 300_000,
  });
  const { data, isPending } = useQuery({
    queryKey: accountingKeys.ledger(year, account),
    queryFn: ({ signal }) => getLedger(year, account, signal),
    enabled: Boolean(account),
  });

  const exportCsv = () =>
    data &&
    downloadCsv(`Alcaravan_Mayor_${account}_${year}.csv`, [
      ['Fecha', 'Asiento', 'Referencia', 'Concepto', 'Descripción', 'Debe', 'Haber', 'Saldo'],
      ['', '', '', 'Saldo anterior', '', '', '', csvEuros(data.opening_balance_cents)],
      ...data.movements.map((m) => [
        m.entry_date,
        m.entry_number,
        m.reference,
        m.concept,
        m.description,
        csvEuros(m.debit_cents),
        csvEuros(m.credit_cents),
        csvEuros(m.balance_cents),
      ]),
    ]);

  return (
    <>
      <StatGrid>
        <StatCard label={t('ledger.opening')} value={money(data?.opening_balance_cents)} />
        <StatCard
          label={t('ledger.debit')}
          value={money(data?.movements.reduce((s, m) => s + m.debit_cents, 0))}
        />
        <StatCard
          label={t('ledger.credit')}
          value={money(data?.movements.reduce((s, m) => s + m.credit_cents, 0))}
        />
        <StatCard
          label={t('ledger.closing')}
          value={money(data?.closing_balance_cents)}
          tone="gold"
          hint={t('ledger.balanceHint')}
        />
      </StatGrid>
      <Panel
        flush
        title={data ? `${data.account_code} · ${data.account_name}` : t('ledger.title')}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.movements.length}
            onClick={exportCsv}
          >
            <Download /> CSV
          </Button>
        }
      >
        <div className="px-5 pb-3">
          <FilterBar>
            <FilterField label={t('journal.account')}>
              <Select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="sm:w-96"
              >
                {accounts?.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </Select>
            </FilterField>
          </FilterBar>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{t('common.date')}</Th>
              <Th>{t('journal.number')}</Th>
              <Th>{t('journal.concept')}</Th>
              <Th numeric>{t('entry.debit')}</Th>
              <Th numeric>{t('entry.credit')}</Th>
              <Th numeric>{t('ledger.balance')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={6}>{t('common.loading')}</EmptyRow>}
            {data && (
              <tr className="bg-secondary/40">
                <Td colSpan={5} className="font-semibold">
                  {t('ledger.openingRow')}
                </Td>
                <Td numeric className="font-semibold">
                  {money(data.opening_balance_cents)}
                </Td>
              </tr>
            )}
            {data?.movements.length === 0 && <EmptyRow colSpan={6}>{t('ledger.empty')}</EmptyRow>}
            {data?.movements.map((m, i) => (
              <tr key={`${m.entry_id}-${i}`}>
                <Td>{date(m.entry_date)}</Td>
                <Td className="tabular">{m.entry_number}</Td>
                <Td className="max-w-80">
                  <p className="truncate">{m.concept}</p>
                  {(m.description || m.reference) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {m.description ?? m.reference}
                    </p>
                  )}
                </Td>
                <Td numeric>{m.debit_cents ? money(m.debit_cents) : ''}</Td>
                <Td numeric>{m.credit_cents ? money(m.credit_cents) : ''}</Td>
                <Td
                  numeric
                  className={cn('font-semibold', m.balance_cents < 0 && 'text-destructive')}
                >
                  {money(m.balance_cents)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}

function TrialTab({ year }: { year: number }) {
  const { t } = useTranslation();
  const [activity, setActivity] = useState<Activity | ''>('');
  const { data, isPending } = useQuery({
    queryKey: accountingKeys.trial(year, activity || undefined),
    queryFn: ({ signal }) => getTrialBalance(year, activity || undefined, signal),
  });
  const debit = data?.reduce((s, r) => s + r.debit_cents, 0) ?? 0;
  const credit = data?.reduce((s, r) => s + r.credit_cents, 0) ?? 0;

  const exportCsv = () =>
    data &&
    downloadCsv(`Alcaravan_SumasSaldos_${year}.csv`, [
      ['Cuenta', 'Nombre', 'Debe', 'Haber', 'Saldo'],
      ...data.map((r) => [
        r.account_code,
        r.account_name,
        csvEuros(r.debit_cents),
        csvEuros(r.credit_cents),
        csvEuros(r.balance_cents),
      ]),
    ]);

  return (
    <Panel
      flush
      title={t('ledger.trialTitle', { year })}
      actions={
        <Button variant="outline" size="sm" disabled={!data?.length} onClick={exportCsv}>
          <Download /> CSV
        </Button>
      }
    >
      <div className="px-5 pb-3">
        <FilterBar>
          <FilterField label={t('common.activity')}>
            <ActivitySelect allowAll value={activity} onChange={setActivity} />
          </FilterField>
        </FilterBar>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>{t('journal.account')}</Th>
            <Th numeric>{t('entry.debit')}</Th>
            <Th numeric>{t('entry.credit')}</Th>
            <Th numeric>{t('ledger.balance')}</Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={4}>{t('common.loading')}</EmptyRow>}
          {data?.length === 0 && <EmptyRow colSpan={4}>{t('ledger.empty')}</EmptyRow>}
          {data?.map((r) => (
            <tr key={r.account_code}>
              <Td>
                <strong className="tabular">{r.account_code}</strong>{' '}
                <span className="text-muted-foreground">{r.account_name}</span>
              </Td>
              <Td numeric>{money(r.debit_cents)}</Td>
              <Td numeric>{money(r.credit_cents)}</Td>
              <Td
                numeric
                className={cn('font-semibold', r.balance_cents < 0 && 'text-destructive')}
              >
                {money(r.balance_cents)}
              </Td>
            </tr>
          ))}
          {data && data.length > 0 && (
            <tr className="border-t-2 border-gold bg-accent/50 font-bold">
              <Td>{t('common.total')}</Td>
              <Td numeric>{money(debit)}</Td>
              <Td numeric>{money(credit)}</Td>
              <Td numeric className={debit !== credit ? 'text-destructive' : undefined}>
                {money(debit - credit)}
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </Panel>
  );
}
