import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getWithholdings, taxKeys, type WithholdingRow } from '@/api/finance';
import { Notice, Page, PageHeader, Panel, StatCard, StatGrid } from '@/components/page';
import { Button } from '@/components/ui/button';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { currentQuarter, currentYear, date, money } from '@/lib/format';
import { QuarterPicker } from './QuarterPicker';

function RowsTable({ rows }: { rows: WithholdingRow[] }) {
  const { t } = useTranslation();
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('tax.paidOn')}</Th>
          <Th>{t('tax.perceiver')}</Th>
          <Th>{t('common.taxId')}</Th>
          <Th>{t('tax.reference')}</Th>
          <Th numeric>{t('tax.base')}</Th>
          <Th numeric>%</Th>
          <Th numeric>{t('tax.withheld')}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={7}>{t('tax.noRows')}</EmptyRow>}
        {rows.map((r, i) => (
          <tr key={`${r.reference}-${i}`}>
            <Td>{date(r.paid_on)}</Td>
            <Td className="max-w-56 truncate">{r.party_name}</Td>
            <Td>
              {r.party_tax_id ?? <span className="text-destructive">{t('tax.missingTaxId')}</span>}
            </Td>
            <Td className="tabular">{r.reference}</Td>
            <Td numeric>{money(r.base_cents)}</Td>
            <Td numeric>
              {r.withholding_rate === null ? '—' : r.withholding_rate.toLocaleString('es-ES')}
            </Td>
            <Td numeric className="font-semibold">
              {money(r.withholding_cents)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function WithholdingsPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(currentYear());
  const [quarter, setQuarter] = useState(currentQuarter());
  const { data } = useQuery({
    queryKey: taxKeys.withholdings(year, quarter),
    queryFn: ({ signal }) => getWithholdings(year, quarter, signal),
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = (kind: string, list: WithholdingRow[]) =>
      list.map((r) => [
        kind,
        r.paid_on,
        r.party_name,
        r.party_tax_id,
        r.reference,
        csvEuros(r.base_cents),
        r.withholding_rate,
        csvEuros(r.withholding_cents),
      ]);
    downloadCsv(`Alcaravan_Retenciones_${year}_T${quarter}.csv`, [
      ['Tipo', 'Fecha pago', 'Perceptor', 'NIF', 'Referencia', 'Base', 'Tipo %', 'Retención'],
      ...rows('Profesionales', data.professionals),
      ...rows('Trabajo', data.employees),
    ]);
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.tax')}
        title={t('tax.whTitle')}
        description={t('tax.whSubtitle')}
        actions={
          <Button variant="outline" disabled={!data} onClick={exportCsv}>
            <Download /> CSV
          </Button>
        }
      />
      <QuarterPicker year={year} quarter={quarter} onYear={setYear} onQuarter={setQuarter} />
      <Notice>{t('tax.whNotice')}</Notice>
      <StatGrid>
        <StatCard
          label={t('tax.whProfessionals')}
          value={money(data?.professionals_total_cents)}
          hint={t('tax.perceivers', {
            count: new Set(data?.professionals.map((r) => r.party_name)).size,
          })}
        />
        <StatCard
          label={t('tax.whEmployees')}
          value={money(data?.employees_total_cents)}
          hint={t('tax.perceivers', {
            count: new Set(data?.employees.map((r) => r.party_name)).size,
          })}
        />
        <StatCard
          label={t('tax.whTotal')}
          value={money(data?.total_cents)}
          tone="gold"
          hint={t('tax.whTotalHint')}
        />
      </StatGrid>
      <Panel flush title={t('tax.whProfessionals')}>
        {data && <RowsTable rows={data.professionals} />}
      </Panel>
      <Panel flush title={t('tax.whEmployees')}>
        {data && <RowsTable rows={data.employees} />}
      </Panel>
    </Page>
  );
}
