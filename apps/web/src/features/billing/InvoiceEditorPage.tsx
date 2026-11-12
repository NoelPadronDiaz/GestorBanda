import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { baseFromGross, invoiceTotals, percentToBp } from '@alcaravan/shared';
import {
  billingKeys,
  createInvoice,
  getInvoice,
  listClients,
  nextInvoiceNumber,
  updateInvoice,
  type Invoice,
  type InvoiceInput,
} from '@/api/billing';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import { Notice, Page, PageHeader, Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/use-auth';
import { PaymentBadge } from '@/features/shared/controls';
import { money, parseEuros, today } from '@/lib/format';

const numberText = (message: string, min = 0) =>
  z.string().refine((value) => {
    const parsed = parseEuros(value);
    return parsed !== null && parsed >= min;
  }, message);

const schema = z.object({
  series: z.enum(['ALC', 'ESC']),
  issue_date: z.string().min(1, 'validation.required'),
  operation_date: z.string(),
  client_id: z.string().min(1, 'validation.required'),
  tax_rate: numberText('validation.percent'),
  withholding_rate: numberText('validation.percent'),
  notes: z.string().max(2000),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1, 'validation.required').max(500),
        quantity: numberText('validation.positive', 0.001),
        unit_price: numberText('validation.amount'),
      }),
    )
    .min(1),
});
type Values = z.infer<typeof schema>;

const num = (value: string) => parseEuros(value) ?? 0;

function toValues(invoice?: Invoice): Values {
  if (!invoice) {
    return {
      series: 'ALC',
      issue_date: today(),
      operation_date: '',
      client_id: '',
      tax_rate: '7',
      withholding_rate: '0',
      notes: '',
      lines: [{ description: '', quantity: '1', unit_price: '' }],
    };
  }
  return {
    series: invoice.series,
    issue_date: invoice.issue_date,
    operation_date: invoice.operation_date ?? '',
    client_id: invoice.client_id ?? '',
    tax_rate: String(invoice.tax_rate).replace('.', ','),
    withholding_rate: String(invoice.withholding_rate).replace('.', ','),
    notes: invoice.notes ?? '',
    lines: invoice.lines.map((line) => ({
      description: line.description,
      quantity: String(line.quantity).replace('.', ','),
      unit_price: String(line.unit_price).replace('.', ','),
    })),
  };
}

export function InvoiceEditorPage() {
  const { id } = useParams();
  const { data: invoice, isPending } = useQuery({
    queryKey: billingKeys.invoice(id ?? 'new'),
    queryFn: ({ signal }) => getInvoice(id!, signal),
    enabled: Boolean(id),
  });
  if (id && isPending) return null;
  return <InvoiceForm key={invoice?.id ?? 'new'} invoice={invoice} />;
}

function InvoiceForm({ invoice }: { invoice?: Invoice }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [grossMode, setGrossMode] = useState(false);
  const [gross, setGross] = useState('');

  const lockReason = invoice
    ? invoice.status === 'CANCELLED'
      ? 'invoices.lock.cancelled'
      : invoice.journal_entry_id
        ? 'invoices.lock.accounted'
        : invoice.student_fee_id
          ? 'invoices.lock.fee'
          : null
    : null;
  const readOnly = Boolean(lockReason) || !can('billing.manage');

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(invoice),
  });
  const lines = useFieldArray({ control, name: 'lines' });
  const values = useWatch({ control }) as Values;

  const { data: clients } = useQuery({
    queryKey: billingKeys.clients(),
    queryFn: ({ signal }) => listClients(undefined, signal),
  });
  const year = Number(values.issue_date?.slice(0, 4)) || new Date().getFullYear();
  const { data: next } = useQuery({
    queryKey: billingKeys.nextNumber(values.series, year),
    queryFn: ({ signal }) => nextInvoiceNumber(values.series, year, signal),
    enabled: !invoice,
  });

  const taxBp = percentToBp(num(values.tax_rate));
  const whBp = percentToBp(num(values.withholding_rate));
  const totals = invoiceTotals(
    (values.lines ?? []).map((line) => ({
      quantity: num(line.quantity),
      unit_price: num(line.unit_price),
    })),
    taxBp,
    whBp,
  );

  // Modo «importe final»: calcula el precio unitario de la única línea para cuadrar el total.
  const grossCents = Math.round(num(gross) * 100);
  const reverse = grossMode && grossCents > 0 ? baseFromGross(grossCents, taxBp, whBp) : null;
  const quantity = num(values.lines?.[0]?.quantity ?? '1') || 1;
  const targetBase = reverse?.base_cents ?? null;
  useEffect(() => {
    if (targetBase === null) return;
    setValue('lines.0.unit_price', (targetBase / 100 / quantity).toFixed(4).replace('.', ','));
  }, [targetBase, quantity, setValue]);

  const save = useAction(
    (body: InvoiceInput) =>
      invoice ? updateInvoice(invoice.id, { ...body }) : createInvoice(body),
    {
      invalidate: [billingKeys.all, ['dashboard']],
      success: (result) => t('invoices.saved', { code: result.code }),
      onSuccess: (result) => void navigate(`/billing/invoices/${result.id}`, { replace: true }),
    },
  );

  const onSubmit = handleSubmit((form) => {
    const body: InvoiceInput = {
      series: form.series,
      issue_date: form.issue_date,
      operation_date: form.operation_date || null,
      client_id: form.client_id,
      tax_rate: num(form.tax_rate),
      withholding_rate: num(form.withholding_rate),
      notes: form.notes.trim() || null,
      lines: form.lines.map((line) => ({
        description: line.description.trim(),
        quantity: num(line.quantity),
        unit_price: num(line.unit_price),
      })),
    };
    if (invoice) {
      const patch: Partial<InvoiceInput> = { ...body };
      delete patch.series;
      save.mutate(patch as InvoiceInput);
    } else save.mutate(body);
  });

  return (
    <Page className="max-w-5xl">
      <PageHeader
        eyebrow={t('nav.invoices')}
        title={invoice ? t('invoices.titleCode', { code: invoice.code }) : t('invoices.new')}
        description={
          invoice ? invoice.recipient.name : t('invoices.newHint', { code: next?.code ?? '…' })
        }
        actions={
          <>
            {invoice && <PaymentBadge status={invoice.status} />}
            {invoice && (
              <Button asChild variant="outline">
                <Link to={`/billing/invoices/${invoice.id}/print`}>
                  <Printer /> {t('invoices.print')}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/billing/invoices">{t('common.back')}</Link>
            </Button>
          </>
        }
      />
      {lockReason && <Notice tone="warning">{t(lockReason)}</Notice>}
      {!invoice && <Notice>{t('invoices.issuerNotice')}</Notice>}

      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <fieldset disabled={readOnly} className="grid gap-5">
          <Panel title={t('invoices.general')}>
            <FormGrid cols={3}>
              <FormField id="series" label={t('invoices.series')}>
                <Select id="series" disabled={Boolean(invoice)} {...register('series')}>
                  <option value="ALC">{t('series.ALC')}</option>
                  <option value="ESC">{t('series.ESC')}</option>
                </Select>
              </FormField>
              <FormField
                id="issue_date"
                label={t('invoices.issueDate')}
                error={errors.issue_date?.message}
              >
                <Input id="issue_date" type="date" {...register('issue_date')} />
              </FormField>
              <FormField id="operation_date" label={t('invoices.operationDate')}>
                <Input id="operation_date" type="date" {...register('operation_date')} />
              </FormField>
              <FormField
                id="client_id"
                label={t('invoices.client')}
                error={errors.client_id?.message}
                className="sm:col-span-2 lg:col-span-3"
                hint={
                  <Link to="/billing/clients" className="underline">
                    {t('invoices.manageClients')}
                  </Link>
                }
              >
                <Select id="client_id" {...register('client_id')}>
                  <option value="">{t('common.choose')}</option>
                  {clients?.data.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.tax_id ? `· ${client.tax_id}` : ''}
                    </option>
                  ))}
                  {invoice && !invoice.client_id && (
                    <option value="">{invoice.recipient.name}</option>
                  )}
                </Select>
              </FormField>
            </FormGrid>
          </Panel>

          <Panel
            title={t('invoices.lines')}
            actions={
              !readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={grossMode}
                  onClick={() => lines.append({ description: '', quantity: '1', unit_price: '' })}
                >
                  <Plus /> {t('invoices.addLine')}
                </Button>
              )
            }
          >
            {!readOnly && (
              <div className="mb-4 grid gap-3 rounded-xl border border-[#e5d6b7] bg-[#f7f4ed] p-3.5 sm:grid-cols-2 dark:border-gold/30 dark:bg-accent">
                <FormField id="calc_mode" label={t('invoices.calcMode')}>
                  <Select
                    id="calc_mode"
                    value={grossMode ? 'gross' : 'unit'}
                    onChange={(event) => {
                      const gross = event.target.value === 'gross';
                      if (gross && lines.fields.length > 1) lines.replace([values.lines[0]]);
                      setGrossMode(gross);
                    }}
                  >
                    <option value="unit">{t('invoices.calcUnit')}</option>
                    <option value="gross">{t('invoices.calcGross')}</option>
                  </Select>
                </FormField>
                {grossMode && (
                  <FormField
                    id="gross"
                    label={t('invoices.grossTarget')}
                    hint={
                      reverse
                        ? reverse.exact
                          ? t('invoices.grossExact')
                          : t('invoices.grossNearest', { amount: money(totals.total_cents) })
                        : t('invoices.grossHint')
                    }
                  >
                    <Input
                      id="gross"
                      inputMode="decimal"
                      value={gross}
                      onChange={(event) => setGross(event.target.value)}
                      placeholder="1.500,00"
                    />
                  </FormField>
                )}
              </div>
            )}

            <div className="grid gap-3">
              {lines.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_6rem_9rem_8rem_auto] sm:items-end sm:border-0 sm:p-0"
                >
                  <FormField
                    id={`lines.${index}.description`}
                    label={t('invoices.lineDescription')}
                    error={errors.lines?.[index]?.description?.message}
                  >
                    <Input
                      id={`lines.${index}.description`}
                      placeholder={t('invoices.linePlaceholder')}
                      {...register(`lines.${index}.description`)}
                    />
                  </FormField>
                  <FormField
                    id={`lines.${index}.quantity`}
                    label={t('invoices.quantity')}
                    error={errors.lines?.[index]?.quantity?.message}
                  >
                    <Input
                      id={`lines.${index}.quantity`}
                      inputMode="decimal"
                      className="text-right"
                      {...register(`lines.${index}.quantity`)}
                    />
                  </FormField>
                  <FormField
                    id={`lines.${index}.unit_price`}
                    label={t('invoices.unitPrice')}
                    error={errors.lines?.[index]?.unit_price?.message}
                  >
                    <Input
                      id={`lines.${index}.unit_price`}
                      inputMode="decimal"
                      readOnly={grossMode}
                      className="text-right"
                      {...register(`lines.${index}.unit_price`)}
                    />
                  </FormField>
                  <div className="grid gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t('invoices.amount')}
                    </span>
                    <span className="tabular flex h-9 items-center justify-end text-sm font-semibold">
                      {money(
                        Math.round(
                          num(values.lines?.[index]?.quantity ?? '0') *
                            num(values.lines?.[index]?.unit_price ?? '0') *
                            100,
                        ),
                      )}
                    </span>
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.remove')}
                      disabled={lines.fields.length === 1}
                      onClick={() => lines.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
              <FormGrid>
                <FormField
                  id="tax_rate"
                  label={t('invoices.taxRate')}
                  error={errors.tax_rate?.message}
                >
                  <Input id="tax_rate" inputMode="decimal" {...register('tax_rate')} />
                </FormField>
                <FormField
                  id="withholding_rate"
                  label={t('invoices.withholdingRate')}
                  error={errors.withholding_rate?.message}
                >
                  <Input
                    id="withholding_rate"
                    inputMode="decimal"
                    {...register('withholding_rate')}
                  />
                </FormField>
                <FormField id="notes" label={t('invoices.notes')} className="sm:col-span-2">
                  <Textarea
                    id="notes"
                    placeholder={t('invoices.notesPlaceholder')}
                    {...register('notes')}
                  />
                </FormField>
              </FormGrid>
              <dl className="tabular grid content-start text-sm">
                {[
                  ['invoices.base', totals.base_cents],
                  ['invoices.tax', totals.tax_cents],
                  ['invoices.withholding', -totals.withholding_cents],
                ].map(([key, value]) => (
                  <div key={key} className="flex justify-between border-b py-2">
                    <dt className="text-muted-foreground">{t(String(key))}</dt>
                    <dd>{money(Number(value))}</dd>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t-2 border-gold pt-3 text-xl font-extrabold">
                  <dt>{t('common.total')}</dt>
                  <dd>{money(totals.total_cents)}</dd>
                </div>
              </dl>
            </div>
          </Panel>
        </fieldset>

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link to="/billing/invoices">{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {invoice ? t('common.saveChanges') : t('invoices.issue')}
            </Button>
          </div>
        )}
      </form>
    </Page>
  );
}
