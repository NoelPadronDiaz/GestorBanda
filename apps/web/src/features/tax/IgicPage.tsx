import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getIgic, taxKeys, type IgicReport, type IgicRow } from '@/api/finance';
import { Notice, Page, PageHeader, Panel, StatCard, StatGrid } from '@/components/page';
import { Button } from '@/components/ui/button';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { currentQuarter, currentYear, date, money } from '@/lib/format';
import { QuarterPicker } from './QuarterPicker';

function RateSummary({ rows }: { rows: IgicReport['issued_by_rate'] }) {
  const { t } = useTranslation();
  if (!rows.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-5 pb-3">
      {rows.map((r) => (
        <span
          key={r.tax_rate}
          className="tabular rounded-lg border bg-secondary/40 px-3 py-1.5 text-xs"
        >
          <strong>{r.tax_rate.toLocaleString('es-ES')} %</strong> · {t('invoices.base')}{' '}
          {money(r.base_cents)} · IGIC {money(r.tax_cents)}
        </span>
      ))}
    </div>
  );
}

function BookTable({ rows, partyLabel }: { rows: IgicRow[]; partyLabel: string }) {
  const { t } = useTranslation();
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('common.date')}</Th>
          <Th>{t('tax.number')}</Th>
          <Th>{partyLabel}</Th>
          <Th>{t('common.taxId')}</Th>
          <Th numeric>{t('invoices.base')}</Th>
          <Th numeric>%</Th>
          <Th numeric>IGIC</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={7}>{t('tax.noRows')}</EmptyRow>}
        {rows.map((r, i) => (
          <tr key={`${r.number}-${i}`}>
            <Td>{date(r.date)}</Td>
            <Td className="tabular">{r.number}</Td>
            <Td className="max-w-56 truncate">{r.party_name}</Td>
            <Td>
              {r.party_tax_id ?? <span className="text-destructive">{t('tax.missingTaxId')}</span>}
            </Td>
            <Td numeric>{money(r.base_cents)}</Td>
            <Td numeric>{r.tax_rate.toLocaleString('es-ES')}</Td>
            <Td numeric>{money(r.tax_cents)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function IgicPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(currentYear());
  const [quarter, setQuarter] = useState(currentQuarter());
  const { data } = useQuery({
    queryKey: taxKeys.igic(year, quarter),
    queryFn: ({ signal }) => getIgic(year, quarter, signal),
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = (book: string, list: IgicRow[]) =>
      list.map((r) => [
        book,
        r.date,
        r.number,
        r.party_name,
        r.party_tax_id,
        t(`activity.${r.activity}`, { defaultValue: r.activity }),
        csvEuros(r.base_cents),
        r.tax_rate,
        csvEuros(r.tax_cents),
      ]);
    downloadCsv(`Alcaravan_IGIC_${year}_T${quarter}.csv`, [
      ['Libro', 'Fecha', 'Número', 'Tercero', 'NIF', 'Actividad', 'Base', 'Tipo %', 'Cuota'],
      ...rows('Emitidas', data.issued),
      ...rows('Recibidas', data.received),
    ]);
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.tax')}
        title={t('tax.igicTitle')}
        description={t('tax.igicSubtitle')}
        actions={
          <Button variant="outline" disabled={!data} onClick={exportCsv}>
            <Download /> CSV
          </Button>
        }
      />
      <QuarterPicker year={year} quarter={quarter} onYear={setYear} onQuarter={setQuarter} />
      <Notice>{t('tax.igicNotice')}</Notice>
      <StatGrid>
        <StatCard
          label={t('tax.outputTax')}
          value={money(data?.output_tax_cents)}
          hint={t('tax.outputTaxHint')}
        />
        <StatCard
          label={t('tax.inputTax')}
          value={money(data?.input_tax_cents)}
          hint={t('tax.inputTaxHint')}
        />
        <StatCard
          label={(data?.difference_cents ?? 0) >= 0 ? t('tax.toPay') : t('tax.toCompensate')}
          value={money(data?.difference_cents)}
          tone="gold"
          hint={data ? `${date(data.from)} – ${date(data.to)}` : undefined}
        />
      </StatGrid>
      <Panel flush title={t('tax.issuedBook', { count: data?.issued.length ?? 0 })}>
        {data && <RateSummary rows={data.issued_by_rate} />}
        {data && <BookTable rows={data.issued} partyLabel={t('invoices.recipient')} />}
      </Panel>
      <Panel flush title={t('tax.receivedBook', { count: data?.received.length ?? 0 })}>
        {data && <RateSummary rows={data.received_by_rate} />}
        {data && <BookTable rows={data.received} partyLabel={t('expenses.supplier')} />}
      </Panel>
    </Page>
  );
}
