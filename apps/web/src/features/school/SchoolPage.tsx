import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Download, Pencil, Plus, Printer, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import {
  billingKeys,
  markInvoicePaid,
  markInvoicePending,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '@/api/billing';
import { listMembers } from '@/api/members';
import {
  createStudent,
  deleteStudent,
  generateFees,
  listFees,
  listStudents,
  listTariffs,
  MODALITIES,
  schoolKeys,
  TARIFF_KEYS,
  TARIFF_KINDS,
  updateStudent,
  updateTariffs,
  type GenerateFeesResult,
  type Student,
  type StudentInput,
  type Tariff,
} from '@/api/school';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import {
  FilterBar,
  FilterField,
  Notice,
  Page,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  Tabs,
} from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { PaymentBadge } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { PaymentDialog } from '@/features/shared/PaymentDialog';
import { csvEuros, downloadCsv } from '@/lib/csv';
import { centsToInput, currentPeriod, money, period as formatPeriod, today } from '@/lib/format';
import { centsOrNull, nullable, zEuros } from '@/lib/forms';

type Tab = 'students' | 'fees' | 'tariffs';

export function SchoolPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('students');
  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.school')}
        title={t('school.title')}
        description={t('school.subtitle')}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'students', label: t('school.tabs.students') },
          { value: 'fees', label: t('school.tabs.fees') },
          { value: 'tariffs', label: t('school.tabs.tariffs') },
        ]}
      />
      {tab === 'students' && <StudentsTab />}
      {tab === 'fees' && <FeesTab />}
      {tab === 'tariffs' && <TariffsTab />}
    </Page>
  );
}

// ───────────── Alumnado ─────────────

function StudentsTab() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [editing, setEditing] = useState<Student | 'new' | null>(null);
  const { data, isPending } = useQuery({
    queryKey: schoolKeys.students,
    queryFn: ({ signal }) => listStudents(signal),
  });
  const remove = useAction(deleteStudent, {
    invalidate: [schoolKeys.all],
    success: 'school.studentDeleted',
  });

  const active = data?.filter((s) => s.status === 'ACTIVE') ?? [];
  const rows = (showWithdrawn ? data : active) ?? [];
  const monthly = active.reduce((sum, s) => sum + (s.monthly_fee_cents ?? 0), 0);
  const incomplete = active.filter(
    (s) => s.missing_billing_fields.length > 0 || s.monthly_fee_cents === null,
  ).length;

  return (
    <>
      <StatGrid>
        <StatCard label={t('school.activeStudents')} value={String(active.length)} />
        <StatCard
          label={t('school.monthlyIncome')}
          value={money(monthly)}
          hint={t('school.igicIncluded')}
          tone="gold"
        />
        <StatCard
          label={t('school.incomplete')}
          value={String(incomplete)}
          hint={t('school.incompleteHint')}
          tone={incomplete ? 'warning' : undefined}
        />
      </StatGrid>
      <Panel
        flush
        title={t('school.studentsTitle')}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={showWithdrawn}
                onChange={(e) => setShowWithdrawn(e.target.checked)}
              />
              {t('school.showWithdrawn')}
            </label>
            {can('school.manage') && (
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus /> {t('school.newStudent')}
              </Button>
            )}
          </>
        }
      >
        <Table>
          <thead>
            <tr>
              <Th>{t('school.student')}</Th>
              <Th>{t('school.family')}</Th>
              <Th>{t('school.modality')}</Th>
              <Th>{t('school.tariff')}</Th>
              <Th numeric>{t('school.monthlyFee')}</Th>
              <Th>{t('school.billing')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={7}>{t('common.loading')}</EmptyRow>}
            {!isPending && rows.length === 0 && (
              <EmptyRow colSpan={7}>{t('school.emptyStudents')}</EmptyRow>
            )}
            {rows.map((student) => (
              <tr
                key={student.id}
                className={student.status === 'WITHDRAWN' ? 'opacity-55' : undefined}
              >
                <Td className="font-semibold">
                  {student.full_name}
                  {student.status === 'WITHDRAWN' && (
                    <Badge className="ml-2">{t('school.withdrawn')}</Badge>
                  )}
                  {student.member_id && (
                    <Badge tone="info" className="ml-2">
                      {t('school.isMember')}
                    </Badge>
                  )}
                </Td>
                <Td>{student.family_label ?? '—'}</Td>
                <Td>{t(`modality.${student.modality}`)}</Td>
                <Td>{t(`tariffKind.${student.tariff_kind}`)}</Td>
                <Td numeric>
                  {student.monthly_fee_cents === null ? (
                    <Badge tone="danger">{t('school.noFee')}</Badge>
                  ) : (
                    money(student.monthly_fee_cents)
                  )}
                </Td>
                <Td>
                  {student.missing_billing_fields.length ? (
                    <Badge
                      tone="pending"
                      title={student.missing_billing_fields
                        .map((f) => t(`school.fields.${f}`))
                        .join(', ')}
                    >
                      {t('school.billingIncomplete')}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{student.billing_name}</span>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="xs" onClick={() => setEditing(student)}>
                      <Pencil /> {can('school.manage') ? t('common.edit') : t('common.view')}
                    </Button>
                    {can('school.manage') && (
                      <Button
                        variant="destructive-outline"
                        size="xs"
                        aria-label={t('common.delete')}
                        onClick={() =>
                          confirmAction(t('school.confirmDelete', { name: student.full_name })) &&
                          remove.mutate(student.id)
                        }
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      {editing && (
        <StudentDialog
          student={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

const studentSchema = z
  .object({
    full_name: z.string().trim().min(1, 'validation.required').max(160),
    family_label: z.string().max(100),
    member_id: z.string(),
    modality: z.enum(MODALITIES),
    tariff_kind: z.enum(TARIFF_KINDS),
    custom_fee: zEuros({ optional: true }),
    status: z.enum(['ACTIVE', 'WITHDRAWN']),
    enrolled_on: z.string(),
    payment_method: z.union([
      z.literal(''),
      z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]),
    ]),
    billing_name: z.string().max(160),
    billing_tax_id: z.string().max(32),
    billing_address: z.string().max(255),
    billing_city: z.string().max(160),
    billing_email: z.union([z.literal(''), z.email('validation.email')]),
    billing_phone: z.string().max(40),
    notes: z.string().max(2000),
  })
  .refine((v) => v.tariff_kind !== 'CUSTOM' || v.custom_fee.trim() !== '', {
    path: ['custom_fee'],
    message: 'validation.required',
  })
  .refine((v) => v.tariff_kind !== 'SIBLINGS' || v.modality === 'SOLFEGE_INSTRUMENT', {
    path: ['tariff_kind'],
    message: 'school.siblingsOnlyCombined',
  });
type StudentValues = z.infer<typeof studentSchema>;

function StudentDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const readOnly = !can('school.manage');
  const { data: members } = useQuery({
    queryKey: ['members', 'picker'],
    queryFn: ({ signal }) => listMembers({ page: 1, page_size: 100, status: 'ACTIVE' }, signal),
    enabled: can('members.read') && !readOnly,
  });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<StudentValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      full_name: student?.full_name ?? '',
      family_label: student?.family_label ?? '',
      member_id: student?.member_id ?? '',
      modality: student?.modality ?? 'SOLFEGE_INSTRUMENT',
      tariff_kind: student?.tariff_kind ?? 'ORDINARY',
      custom_fee: centsToInput(student?.custom_fee_cents),
      status: student?.status ?? 'ACTIVE',
      enrolled_on: student?.enrolled_on ?? today(),
      payment_method: student?.payment_method ?? 'DIRECT_DEBIT',
      billing_name: student?.billing_name ?? '',
      billing_tax_id: student?.billing_tax_id ?? '',
      billing_address: student?.billing_address ?? '',
      billing_city: student?.billing_city ?? '',
      billing_email: student?.billing_email ?? '',
      billing_phone: student?.billing_phone ?? '',
      notes: student?.notes ?? '',
    },
  });
  const tariffKind = useWatch({ control, name: 'tariff_kind' });
  const save = useAction(
    (body: StudentInput) => (student ? updateStudent(student.id, body) : createStudent(body)),
    {
      invalidate: [schoolKeys.all],
      success: 'school.studentSaved',
      onSuccess: onClose,
    },
  );
  const onSubmit = handleSubmit((v) =>
    save.mutate({
      full_name: v.full_name.trim(),
      family_label: nullable(v.family_label),
      member_id: v.member_id || null,
      modality: v.modality,
      tariff_kind: v.tariff_kind,
      custom_fee_cents: v.tariff_kind === 'CUSTOM' ? centsOrNull(v.custom_fee) : null,
      status: v.status,
      enrolled_on: v.enrolled_on || null,
      payment_method: v.payment_method || null,
      billing_name: nullable(v.billing_name),
      billing_tax_id: nullable(v.billing_tax_id),
      billing_address: nullable(v.billing_address),
      billing_city: nullable(v.billing_city),
      billing_email: nullable(v.billing_email),
      billing_phone: nullable(v.billing_phone),
      notes: nullable(v.notes),
    }),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={student ? student.full_name : t('school.newStudent')}
      description={t('school.studentHint')}
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <fieldset disabled={readOnly} className="grid gap-5">
          <FormGrid cols={3}>
            <FormField id="st_name" label={t('school.student')} error={errors.full_name?.message}>
              <Input id="st_name" autoFocus {...register('full_name')} />
            </FormField>
            <FormField id="st_family" label={t('school.family')} hint={t('school.familyHint')}>
              <Input id="st_family" {...register('family_label')} />
            </FormField>
            <FormField id="st_status" label={t('common.status')}>
              <Select id="st_status" {...register('status')}>
                <option value="ACTIVE">{t('school.active')}</option>
                <option value="WITHDRAWN">{t('school.withdrawn')}</option>
              </Select>
            </FormField>
            <FormField id="st_modality" label={t('school.modality')}>
              <Select id="st_modality" {...register('modality')}>
                {MODALITIES.map((m) => (
                  <option key={m} value={m}>
                    {t(`modality.${m}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="st_tariff"
              label={t('school.tariff')}
              error={errors.tariff_kind?.message}
            >
              <Select id="st_tariff" {...register('tariff_kind')}>
                {TARIFF_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`tariffKind.${k}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            {tariffKind === 'CUSTOM' ? (
              <FormField
                id="st_custom"
                label={t('school.customFee')}
                error={errors.custom_fee?.message}
              >
                <Input id="st_custom" inputMode="decimal" {...register('custom_fee')} />
              </FormField>
            ) : (
              <FormField id="st_enrolled" label={t('school.enrolledOn')}>
                <Input id="st_enrolled" type="date" {...register('enrolled_on')} />
              </FormField>
            )}
            {tariffKind === 'CUSTOM' && (
              <FormField id="st_enrolled" label={t('school.enrolledOn')}>
                <Input id="st_enrolled" type="date" {...register('enrolled_on')} />
              </FormField>
            )}
            <FormField id="st_payment" label={t('school.paymentMethod')}>
              <Select id="st_payment" {...register('payment_method')}>
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`paymentMethod.${m}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            {members && (
              <FormField
                id="st_member"
                label={t('school.linkedMember')}
                hint={t('school.linkedMemberHint')}
              >
                <Select
                  id="st_member"
                  {...register('member_id', {
                    onChange: (e) => {
                      if (e.target.value && tariffKind === 'ORDINARY')
                        setValue('tariff_kind', 'BAND_MEMBER');
                    },
                  })}
                >
                  <option value="">{t('school.noMember')}</option>
                  {members.data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.last_name}, {m.first_name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </FormGrid>

          <div className="grid gap-3 rounded-xl border bg-secondary/40 p-4">
            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {t('school.billingData')}
            </p>
            <FormGrid cols={3}>
              <FormField id="st_bname" label={t('school.fields.billing_name')}>
                <Input id="st_bname" {...register('billing_name')} />
              </FormField>
              <FormField id="st_btax" label={t('school.fields.billing_tax_id')}>
                <Input id="st_btax" {...register('billing_tax_id')} />
              </FormField>
              <FormField
                id="st_bemail"
                label={t('common.email')}
                error={errors.billing_email?.message}
              >
                <Input id="st_bemail" type="email" {...register('billing_email')} />
              </FormField>
              <FormField id="st_baddr" label={t('school.fields.billing_address')}>
                <Input id="st_baddr" {...register('billing_address')} />
              </FormField>
              <FormField id="st_bcity" label={t('school.fields.billing_city')}>
                <Input id="st_bcity" {...register('billing_city')} />
              </FormField>
              <FormField id="st_bphone" label={t('common.phone')}>
                <Input id="st_bphone" {...register('billing_phone')} />
              </FormField>
            </FormGrid>
          </div>
          <FormField id="st_notes" label={t('common.notes')}>
            <Textarea id="st_notes" {...register('notes')} />
          </FormField>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {readOnly ? t('common.close') : t('common.cancel')}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={save.isPending}>
              {t('common.save')}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

// ───────────── Cuotas ─────────────

function FeesTab() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const [issueDate, setIssueDate] = useState(today());
  const [result, setResult] = useState<GenerateFeesResult | null>(null);
  const [paying, setPaying] = useState<{ invoiceId: string; label: string } | null>(null);
  const { data, isPending } = useQuery({
    queryKey: schoolKeys.fees(period),
    queryFn: ({ signal }) => listFees(period || undefined, signal),
  });

  const invalidate = [schoolKeys.all, billingKeys.all, ['dashboard']];
  const generate = useAction(generateFees, {
    invalidate,
    success: 'school.feesGenerated',
    onSuccess: setResult,
  });
  const pay = useAction(
    (input: { id: string; paid_on: string; payment_method: PaymentMethod }) =>
      markInvoicePaid(input.id, { paid_on: input.paid_on, payment_method: input.payment_method }),
    { invalidate, success: 'invoices.markedPaid', onSuccess: () => setPaying(null) },
  );
  const unpay = useAction(markInvoicePending, { invalidate, success: 'invoices.markedPending' });

  const total = data?.reduce((s, f) => s + f.amount_cents, 0) ?? 0;
  const pending =
    data?.filter((f) => f.status === 'PENDING').reduce((s, f) => s + f.amount_cents, 0) ?? 0;

  const exportCsv = () =>
    data &&
    downloadCsv(`Alcaravan_Cuotas_${period}.csv`, [
      ['Periodo', 'Alumno/a', 'Factura', 'Importe', 'Estado', 'Fecha cobro'],
      ...data.map((f) => [
        f.period,
        f.student_name,
        f.invoice_code,
        csvEuros(f.amount_cents),
        t(`status.${f.status}`),
        f.paid_on,
      ]),
    ]);

  return (
    <>
      {can('school.manage') && (
        <Panel title={t('school.generateTitle')}>
          <p className="mb-4 text-sm text-muted-foreground">{t('school.generateHint')}</p>
          <FilterBar>
            <FilterField label={t('school.period')}>
              <Input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-40"
              />
            </FilterField>
            <FilterField label={t('invoices.issueDate')}>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-40"
              />
            </FilterField>
            <Button
              variant="gold"
              disabled={!period || generate.isPending}
              onClick={() =>
                confirmAction(t('school.confirmGenerate', { period: formatPeriod(period) })) &&
                generate.mutate({ period, issue_date: issueDate })
              }
            >
              <Sparkles /> {t('school.generate')}
            </Button>
          </FilterBar>
          {result && (
            <div className="mt-4 grid gap-2">
              <Notice tone="success">
                {t('school.generateResult', {
                  created: result.created.length,
                  existing: result.already_existing,
                })}
              </Notice>
              {result.skipped.length > 0 && (
                <Notice tone="warning">
                  <p className="mb-1 font-semibold">
                    {t('school.skippedTitle', { count: result.skipped.length })}
                  </p>
                  <ul className="list-disc pl-5">
                    {result.skipped.map((s) => (
                      <li key={s.student_id}>
                        {s.student_name}: {t(`school.skipReason.${s.reason}`)}
                        {s.missing_fields.length > 0 &&
                          ` (${s.missing_fields.map((f) => t(`school.fields.${f}`)).join(', ')})`}
                      </li>
                    ))}
                  </ul>
                </Notice>
              )}
            </div>
          )}
        </Panel>
      )}

      <StatGrid>
        <StatCard label={t('school.feesCount')} value={String(data?.length ?? '—')} />
        <StatCard label={t('school.feesTotal')} value={money(total)} tone="gold" />
        <StatCard
          label={t('school.feesPending')}
          value={money(pending)}
          tone={pending ? 'warning' : undefined}
        />
      </StatGrid>

      <Panel
        flush
        title={t('school.feesTitle', { period: period ? formatPeriod(period) : t('common.all') })}
        actions={
          <>
            {!can('school.manage') && (
              <Input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-40"
                aria-label={t('school.period')}
              />
            )}
            <Button variant="outline" size="sm" disabled={!data?.length} onClick={exportCsv}>
              <Download /> CSV
            </Button>
          </>
        }
      >
        <Table>
          <thead>
            <tr>
              <Th>{t('school.student')}</Th>
              <Th>{t('school.period')}</Th>
              <Th>{t('invoices.code')}</Th>
              <Th numeric>{t('common.amount')}</Th>
              <Th>{t('common.status')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={6}>{t('common.loading')}</EmptyRow>}
            {data?.length === 0 && <EmptyRow colSpan={6}>{t('school.emptyFees')}</EmptyRow>}
            {data?.map((fee) => (
              <tr key={fee.id}>
                <Td className="font-semibold">{fee.student_name}</Td>
                <Td>{formatPeriod(fee.period)}</Td>
                <Td className="tabular">{fee.invoice_code}</Td>
                <Td numeric>{money(fee.amount_cents)}</Td>
                <Td>
                  <PaymentBadge status={fee.status} />
                </Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    {can('billing.read') && (
                      <Button asChild variant="outline" size="xs">
                        <Link to={`/billing/invoices/${fee.invoice_id}/print`}>
                          <Printer /> {t('invoices.print')}
                        </Link>
                      </Button>
                    )}
                    {can('billing.manage') && fee.status === 'PENDING' && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          setPaying({
                            invoiceId: fee.invoice_id,
                            label: `${fee.student_name} · ${fee.invoice_code}`,
                          })
                        }
                      >
                        {t('school.markCollected')}
                      </Button>
                    )}
                    {can('billing.manage') && fee.status === 'PAID' && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => unpay.mutate(fee.invoice_id)}
                      >
                        {t('invoices.markPending')}
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <PaymentDialog
        key={paying?.invoiceId ?? 'none'}
        open={Boolean(paying)}
        title={t('school.collectTitle', { label: paying?.label })}
        pending={pay.isPending}
        onClose={() => setPaying(null)}
        onConfirm={(input) => paying && pay.mutate({ id: paying.invoiceId, ...input })}
      />
    </>
  );
}

// ───────────── Tarifas ─────────────

function TariffsTab() {
  const { can } = useAuth();
  const { data } = useQuery({
    queryKey: schoolKeys.tariffs,
    queryFn: ({ signal }) => listTariffs(signal),
  });
  if (!data) return null;
  return <TariffsForm key={JSON.stringify(data)} tariffs={data} editable={can('school.manage')} />;
}

function TariffsForm({ tariffs, editable }: { tariffs: Tariff[]; editable: boolean }) {
  const { t } = useTranslation();
  const initial = Object.fromEntries(
    TARIFF_KEYS.map((key) => [key, centsToInput(tariffs.find((x) => x.key === key)?.amount_cents)]),
  ) as Record<string, string>;
  const [values, setValues] = useState(initial);
  const save = useAction(updateTariffs, {
    invalidate: [schoolKeys.all],
    success: 'school.tariffsSaved',
  });
  const invalid = TARIFF_KEYS.filter(
    (key) => values[key].trim() && centsOrNull(values[key]) === null,
  );

  return (
    <Panel title={t('school.tariffsTitle')}>
      <p className="mb-4 text-sm text-muted-foreground">{t('school.tariffsHint')}</p>
      <FormGrid cols={3}>
        {TARIFF_KEYS.map((key) => (
          <FormField
            key={key}
            id={`tariff_${key}`}
            label={t(`tariffKey.${key}`)}
            hint={t(`tariffKeyHint.${key}`)}
            error={invalid.includes(key) ? 'validation.amount' : undefined}
          >
            <Input
              id={`tariff_${key}`}
              inputMode="decimal"
              disabled={!editable}
              placeholder={t('school.undefinedTariff')}
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </FormField>
        ))}
      </FormGrid>
      {editable && (
        <div className="mt-5 flex justify-end">
          <Button
            disabled={invalid.length > 0 || save.isPending}
            onClick={() =>
              save.mutate(
                TARIFF_KEYS.map((key) => ({ key, amount_cents: centsOrNull(values[key]) })),
              )
            }
          >
            {t('common.save')}
          </Button>
        </div>
      )}
    </Panel>
  );
}
