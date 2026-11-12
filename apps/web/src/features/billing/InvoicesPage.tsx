import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookPlus, Download, Plus, Printer } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { InvoiceSeriesCode } from '@alcaravan/shared';
import {
  billingKeys,
  cancelInvoice,
  listInvoices,
  markInvoicePaid,
  markInvoicePending,
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod,
} from '@/api/billing';
import { useAction } from '@/api/use-action';
import { FilterBar, FilterField, Page, PageHeader, Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { Can } from '@/features/auth/Can';
import { useAuth } from '@/features/auth/use-auth';
import { AccountingBadge, PaymentBadge, YearSelect } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { PaymentDialog } from '@/features/shared/PaymentDialog';
import { PostEntryDialog, type PostTarget } from '@/features/shared/PostEntryDialog';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { currentYear, date, money } from '@/lib/format';

const PAGE_SIZE = 25;

export function InvoicesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [year, setYear] = useState(currentYear());
  const [series, setSeries] = useState<InvoiceSeriesCode | ''>('');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDeferredValue(search.trim());
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [posting, setPosting] = useState<PostTarget | null>(null);

  const params = {
    page,
    page_size: PAGE_SIZE,
    year,
    series: series || undefined,
    status: status || undefined,
    q: q || undefined,
  };
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: billingKeys.invoices(params),
    queryFn: ({ signal }) => listInvoices(params, signal),
    placeholderData: keepPreviousData,
  });

  const invalidate = [billingKeys.all, ['dashboard'], ['school']];
  const pay = useAction(
    (input: { id: string; paid_on: string; payment_method: PaymentMethod }) =>
      markInvoicePaid(input.id, { paid_on: input.paid_on, payment_method: input.payment_method }),
    {
      invalidate,
      success: 'invoices.markedPaid',
      onSuccess: () => setPaying(null),
    },
  );
  const unpay = useAction(markInvoicePending, { invalidate, success: 'invoices.markedPending' });
  const cancel = useAction(cancelInvoice, { invalidate, success: 'invoices.cancelled' });

  const total = data?.meta.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = async () => {
    const all = await listInvoices({ ...params, page: 1, page_size: 100 });
    downloadCsv(`Alcaravan_Facturas_${year}.csv`, [
      [
        'Número',
        'Fecha',
        'Destinatario',
        'NIF',
        'Base',
        'IGIC %',
        'IGIC',
        'Retención',
        'Total',
        'Estado',
        'Fecha cobro',
      ],
      ...all.data.map((i) => [
        i.code,
        i.issue_date,
        i.recipient.name,
        i.recipient.tax_id,
        csvEuros(i.base_cents),
        i.tax_rate,
        csvEuros(i.tax_cents),
        csvEuros(i.withholding_cents),
        csvEuros(i.total_cents),
        t(`status.${i.status}`),
        i.paid_on,
      ]),
    ]);
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.billing')}
        title={t('invoices.title')}
        description={t('invoices.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => void exportCsv()}>
              <Download /> CSV
            </Button>
            <Can permission="billing.manage">
              <Button asChild>
                <Link to="/billing/invoices/new">
                  <Plus /> {t('invoices.new')}
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      <Panel flush>
        <div className="px-5 pt-5 pb-3">
          <FilterBar>
            <FilterField label={t('common.year')}>
              <YearSelect
                value={year}
                onChange={(value) => {
                  setYear(value);
                  setPage(1);
                }}
              />
            </FilterField>
            <FilterField label={t('invoices.series')}>
              <Select
                value={series}
                onChange={(event) => {
                  setSeries(event.target.value as InvoiceSeriesCode | '');
                  setPage(1);
                }}
                className="w-44"
              >
                <option value="">{t('common.all')}</option>
                <option value="ALC">{t('series.ALC')}</option>
                <option value="ESC">{t('series.ESC')}</option>
              </Select>
            </FilterField>
            <FilterField label={t('common.status')}>
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as InvoiceStatus | '');
                  setPage(1);
                }}
                className="w-36"
              >
                <option value="">{t('common.all')}</option>
                <option value="PENDING">{t('status.PENDING')}</option>
                <option value="PAID">{t('status.PAID')}</option>
                <option value="CANCELLED">{t('status.CANCELLED')}</option>
              </Select>
            </FilterField>
            <FilterField label={t('common.search')}>
              <Input
                type="search"
                value={search}
                placeholder={t('invoices.searchPlaceholder')}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="sm:w-64"
              />
            </FilterField>
          </FilterBar>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{t('invoices.number')}</Th>
              <Th>{t('common.date')}</Th>
              <Th>{t('invoices.recipient')}</Th>
              <Th numeric>{t('common.total')}</Th>
              <Th>{t('common.status')}</Th>
              <Th>{t('accountingStatus.label')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody className={isPlaceholderData ? 'opacity-60' : undefined}>
            {isPending && <EmptyRow colSpan={7}>{t('common.loading')}</EmptyRow>}
            {data?.data.length === 0 && <EmptyRow colSpan={7}>{t('invoices.empty')}</EmptyRow>}
            {data?.data.map((invoice) => (
              <tr
                key={invoice.id}
                className={
                  invoice.status === 'CANCELLED'
                    ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                    : undefined
                }
              >
                <Td>
                  <Link
                    to={`/billing/invoices/${invoice.id}`}
                    className="font-semibold hover:underline"
                  >
                    {invoice.code}
                  </Link>
                  {invoice.student_fee_id && (
                    <p className="text-[11px] text-muted-foreground no-underline">
                      {t('invoices.fromFee')}
                    </p>
                  )}
                </Td>
                <Td>{date(invoice.issue_date)}</Td>
                <Td className="max-w-64 truncate">{invoice.recipient.name}</Td>
                <Td numeric className="font-semibold">
                  {money(invoice.total_cents)}
                </Td>
                <Td>
                  <PaymentBadge status={invoice.status} />
                </Td>
                <Td>
                  <AccountingBadge
                    accrual={invoice.journal_entry_id}
                    payment={invoice.payment_entry_id}
                  />
                </Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <Button asChild variant="outline" size="xs" title={t('invoices.print')}>
                      <Link to={`/billing/invoices/${invoice.id}/print`}>
                        <Printer /> PDF
                      </Link>
                    </Button>
                    {can('billing.manage') && invoice.status === 'PENDING' && (
                      <Button variant="outline" size="xs" onClick={() => setPaying(invoice)}>
                        {t('invoices.markPaid')}
                      </Button>
                    )}
                    {can('billing.manage') &&
                      invoice.status === 'PAID' &&
                      !invoice.payment_entry_id && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => unpay.mutate(invoice.id)}
                        >
                          {t('invoices.markPending')}
                        </Button>
                      )}
                    {can('accounting.post') &&
                      invoice.status !== 'CANCELLED' &&
                      !invoice.journal_entry_id && (
                        <Button
                          variant="gold"
                          size="xs"
                          onClick={() =>
                            setPosting({ type: 'INVOICE', id: invoice.id, label: invoice.code })
                          }
                        >
                          <BookPlus /> {t('entry.postAction')}
                        </Button>
                      )}
                    {can('accounting.post') &&
                      invoice.journal_entry_id &&
                      !invoice.payment_entry_id && (
                        <Button
                          variant="gold"
                          size="xs"
                          onClick={() =>
                            setPosting({
                              type: 'INVOICE_PAYMENT',
                              id: invoice.id,
                              label: invoice.code,
                            })
                          }
                        >
                          <BookPlus /> {t('entry.receipt')}
                        </Button>
                      )}
                    {can('billing.manage') &&
                      invoice.status === 'PENDING' &&
                      !invoice.journal_entry_id &&
                      !invoice.student_fee_id && (
                        <Button
                          variant="destructive-outline"
                          size="xs"
                          onClick={() =>
                            confirmAction(t('invoices.confirmCancel', { code: invoice.code })) &&
                            cancel.mutate(invoice.id)
                          }
                        >
                          {t('invoices.cancel')}
                        </Button>
                      )}
                  </div>
                </Td>
              </tr>
            ))}
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
            {t('common.pageOf', { page, total: lastPage })} ·{' '}
            {t('invoices.total', { count: total })}
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

      <PaymentDialog
        key={paying?.id ?? 'none'}
        open={Boolean(paying)}
        title={t('invoices.markPaidTitle', { code: paying?.code })}
        pending={pay.isPending}
        onClose={() => setPaying(null)}
        onConfirm={(input) => paying && pay.mutate({ id: paying.id, ...input })}
      />
      <PostEntryDialog
        key={posting ? `${posting.type}-${posting.id}` : 'none'}
        target={posting}
        onClose={() => setPosting(null)}
      />
    </Page>
  );
}
