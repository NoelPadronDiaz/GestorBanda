import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { bandProfileKey, getBandProfile } from '@/api/band-profile';
import { billingKeys, getInvoice } from '@/api/billing';
import { Notice } from '@/components/page';
import { Button } from '@/components/ui/button';
import { date, money } from '@/lib/format';

/**
 * Factura en A4 lista para «Imprimir / Guardar como PDF». Reproduce el diseño de Alcaraván
 * Gestión 2.13: banda superior azul noche con el logotipo dorado y filete dorado.
 */
export function InvoicePrintPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: invoice } = useQuery({
    queryKey: billingKeys.invoice(id!),
    queryFn: ({ signal }) => getInvoice(id!, signal),
  });
  const { data: band } = useQuery({
    queryKey: bandProfileKey,
    queryFn: ({ signal }) => getBandProfile(signal),
  });

  if (!invoice || !band) return null;
  const issuerAddress = [
    band.address_line,
    [band.postal_code, band.city].filter(Boolean).join(' '),
  ].filter(Boolean);
  const footer = [band.iban ? `IBAN: ${band.iban}` : null, invoice.notes, band.invoice_footer]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="grid justify-center gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline">
          <Link to={`/billing/invoices/${invoice.id}`}>
            <ArrowLeft /> {t('common.back')}
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> {t('invoices.printPdf')}
        </Button>
      </div>
      {!band.tax_id && (
        <div className="no-print">
          <Notice tone="warning">{t('invoices.missingTaxId')}</Notice>
        </div>
      )}

      <article className="relative min-h-[297mm] w-[210mm] max-w-full bg-white px-[18mm] pb-[20mm] text-[10pt] text-[#1a3047] shadow-xl print:shadow-none">
        <header className="-mx-[18mm] flex min-h-[62mm] items-center justify-between gap-[12mm] border-b-[4mm] border-[#d5b16a] bg-[#142841] px-[18mm] py-[12mm]">
          <img
            src="/brand/alcaravan-logo.png"
            alt={band.name}
            className="h-[40mm] w-[48mm] object-contain"
          />
          <div className="text-right leading-relaxed text-[#f6f2e9]">
            <h1 className="mb-2 text-[25pt] font-bold tracking-[2px] text-[#e0bd78]">
              {t('invoices.printTitle')}
            </h1>
            <p className="font-bold">N.º {invoice.code}</p>
            <p>
              {t('invoices.issueDate')}: {date(invoice.issue_date)}
            </p>
          </div>
        </header>

        <section className="my-[13mm] grid grid-cols-2 gap-[15mm]">
          {[
            {
              label: t('invoices.issuer'),
              name: band.legal_name || band.name,
              tax: band.tax_id,
              lines: [...issuerAddress, band.email, band.phone],
            },
            {
              label: t('invoices.recipient'),
              name: invoice.recipient.name,
              tax: invoice.recipient.tax_id,
              lines: [
                invoice.recipient.address_line,
                invoice.recipient.city,
                invoice.recipient.email,
              ],
            },
          ].map((party) => (
            <div
              key={party.label}
              className="border-l-2 border-[#d5b16a] pl-3 leading-relaxed [overflow-wrap:anywhere]"
            >
              <p className="mb-[3mm] text-[8pt] font-bold tracking-[1.2px] text-[#a17b3b] uppercase">
                {party.label}
              </p>
              <p className="font-bold">{party.name}</p>
              {party.tax && <p>{party.tax}</p>}
              {party.lines.filter(Boolean).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ))}
        </section>

        <table className="mt-[8mm] w-full table-fixed border-collapse text-[9pt]">
          <thead>
            <tr className="bg-[#1d3957] text-white">
              <th className="w-[52%] px-[9px] py-3 text-left">{t('invoices.concept')}</th>
              <th className="w-[15%] px-[9px] py-3 text-right">{t('invoices.quantity')}</th>
              <th className="w-[17%] px-[9px] py-3 text-right">{t('invoices.unitPrice')}</th>
              <th className="w-[16%] px-[9px] py-3 text-right">{t('invoices.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.position} className="border-b border-[#e5e8ed] align-top">
                <td className="px-[9px] py-3 [overflow-wrap:anywhere]">{line.description}</td>
                <td className="tabular px-[9px] py-3 text-right">
                  {line.quantity.toLocaleString('es-ES')}
                </td>
                <td className="tabular px-[9px] py-3 text-right">
                  {line.unit_price.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}{' '}
                  €
                </td>
                <td className="tabular px-[9px] py-3 text-right">{money(line.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="tabular mt-[13mm] ml-auto w-[80mm]">
          <div className="flex justify-between border-b border-[#e4e8ed] px-2 py-2.5">
            <dt>{t('invoices.base')}</dt>
            <dd>{money(invoice.base_cents)}</dd>
          </div>
          <div className="flex justify-between border-b border-[#e4e8ed] px-2 py-2.5">
            <dt>IGIC ({invoice.tax_rate.toLocaleString('es-ES')} %)</dt>
            <dd>{money(invoice.tax_cents)}</dd>
          </div>
          {invoice.withholding_cents > 0 && (
            <div className="flex justify-between border-b border-[#e4e8ed] px-2 py-2.5">
              <dt>
                {t('invoices.withholding')} ({invoice.withholding_rate.toLocaleString('es-ES')} %)
              </dt>
              <dd>− {money(invoice.withholding_cents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-[#c39a51] bg-[#f7f2e6] px-2 py-4 text-[16pt] font-bold text-[#142841]">
            <dt>{t('common.total')}</dt>
            <dd>{money(invoice.total_cents)}</dd>
          </div>
        </dl>

        <footer className="mt-[20mm] border-t border-[#d5b16a] pt-[6mm] leading-loose whitespace-pre-line text-[#657386] [overflow-wrap:anywhere]">
          {invoice.operation_date && (
            <p className="mb-[4mm] text-[9pt] text-[#1a3047]">
              <strong>{t('invoices.operationDate')}:</strong> {date(invoice.operation_date)}
            </p>
          )}
          {footer}
        </footer>
      </article>
    </div>
  );
}
