import { useQuery } from '@tanstack/react-query';
import { Link2, Link2Off, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bankCandidates,
  deleteBankMovement,
  importBankMovements,
  listBankMovements,
  reconcileMovement,
  treasuryKeys,
  treasurySummary,
  unreconcileMovement,
  type BankMovement,
} from '@/api/finance';
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
} from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/features/auth/use-auth';
import { YearSelect } from '@/features/shared/controls';
import { confirmAction } from '@/features/shared/confirm';
import { parseBankDate, parseCsv } from '@/lib/csv';
import { currentYear, date, eurosToCents, money } from '@/lib/format';
import { cn } from '@/lib/utils';

const accountingInvalidate = [treasuryKeys.all, ['dashboard']];

export function TreasuryPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [year, setYear] = useState(currentYear());
  const [status, setStatus] = useState<'' | 'pending' | 'reconciled'>('pending');
  const [importing, setImporting] = useState(false);
  const [reconciling, setReconciling] = useState<BankMovement | null>(null);
  const { data: summary } = useQuery({
    queryKey: treasuryKeys.summary(year),
    queryFn: ({ signal }) => treasurySummary(year, signal),
  });
  const { data, isPending } = useQuery({
    queryKey: treasuryKeys.movements(year, status),
    queryFn: ({ signal }) => listBankMovements(year, status, signal),
  });
  const unreconcile = useAction(unreconcileMovement, {
    invalidate: accountingInvalidate,
    success: 'treasury.unreconciled',
  });
  const remove = useAction(deleteBankMovement, {
    invalidate: accountingInvalidate,
    success: 'treasury.deleted',
  });

  return (
    <Page>
      <PageHeader
        eyebrow={t('nav.groups.accounting')}
        title={t('treasury.title')}
        description={t('treasury.subtitle')}
        actions={
          can('treasury.manage') && (
            <Button onClick={() => setImporting(true)}>
              <Upload /> {t('treasury.import')}
            </Button>
          )
        }
      />
      <StatGrid>
        <StatCard
          label={t('treasury.bankLedger')}
          value={money(summary?.bank_ledger_cents)}
          hint={t('treasury.bankLedgerHint')}
          tone="gold"
        />
        <StatCard
          label={t('treasury.cashLedger')}
          value={money(summary?.cash_ledger_cents)}
          hint={t('treasury.cashLedgerHint')}
        />
        <StatCard
          label={t('treasury.movements')}
          value={String(summary?.movements ?? '—')}
          hint={t('treasury.pendingCount', { count: summary?.pending ?? 0 })}
          tone={summary?.pending ? 'warning' : undefined}
        />
        <StatCard
          label={t('treasury.ledgerLines')}
          value={`${summary?.bank_lines_reconciled ?? 0} / ${summary?.bank_lines_in_year ?? 0}`}
          hint={t('treasury.ledgerLinesHint')}
        />
      </StatGrid>

      <Panel flush title={t('treasury.listTitle')}>
        <div className="px-5 pb-3">
          <FilterBar>
            <FilterField label={t('common.year')}>
              <YearSelect value={year} onChange={setYear} />
            </FilterField>
            <FilterField label={t('common.status')}>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-44"
              >
                <option value="pending">{t('treasury.statusPending')}</option>
                <option value="reconciled">{t('treasury.statusReconciled')}</option>
                <option value="">{t('common.all')}</option>
              </Select>
            </FilterField>
          </FilterBar>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{t('common.date')}</Th>
              <Th>{t('treasury.description')}</Th>
              <Th>{t('treasury.accountLabel')}</Th>
              <Th numeric>{t('common.amount')}</Th>
              <Th>{t('treasury.entry')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {isPending && <EmptyRow colSpan={6}>{t('common.loading')}</EmptyRow>}
            {data?.length === 0 && <EmptyRow colSpan={6}>{t('treasury.empty')}</EmptyRow>}
            {data?.map((m) => (
              <tr key={m.id}>
                <Td>{date(m.booked_on)}</Td>
                <Td className="max-w-96 truncate">{m.description}</Td>
                <Td className="text-xs text-muted-foreground">{m.account_label}</Td>
                <Td
                  numeric
                  className={cn(
                    'font-semibold',
                    m.amount_cents < 0 ? 'text-destructive' : 'text-success',
                  )}
                >
                  {money(m.amount_cents)}
                </Td>
                <Td>
                  {m.journal_entry_number ? (
                    <Badge tone="success">{m.journal_entry_number}</Badge>
                  ) : (
                    <Badge tone="pending">{t('treasury.statusPending')}</Badge>
                  )}
                </Td>
                <Td>
                  {can('treasury.manage') && (
                    <div className="flex justify-end gap-1.5">
                      {m.journal_entry_id ? (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => unreconcile.mutate(m.id)}
                        >
                          <Link2Off /> {t('treasury.unreconcile')}
                        </Button>
                      ) : (
                        <>
                          <Button variant="gold" size="xs" onClick={() => setReconciling(m)}>
                            <Link2 /> {t('treasury.reconcile')}
                          </Button>
                          <Button
                            variant="destructive-outline"
                            size="xs"
                            aria-label={t('common.delete')}
                            onClick={() =>
                              confirmAction(t('treasury.confirmDelete')) && remove.mutate(m.id)
                            }
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {reconciling && (
        <ReconcileDialog movement={reconciling} onClose={() => setReconciling(null)} />
      )}
    </Page>
  );
}

type Mapping = { date: number; description: number; amount: number; debit: number; credit: number };

/** Detecta columnas por su cabecera (nombres habituales en extractos de bancos españoles). */
function guessMapping(header: string[]): Mapping {
  const find = (...patterns: RegExp[]) =>
    header.findIndex((h) => patterns.some((p) => p.test(h.toLowerCase())));
  return {
    date: Math.max(0, find(/f\.? ?valor/, /fecha/, /date/)),
    description: find(/concepto/, /descrip/, /movimiento/, /detalle/),
    amount: find(/^importe/, /amount/, /cantidad/),
    debit: find(/cargo/, /debe/, /debit/),
    credit: find(/abono/, /haber/, /credit/),
  };
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [table, setTable] = useState<string[][] | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping>({
    date: 0,
    description: 1,
    amount: 2,
    debit: -1,
    credit: -1,
  });
  const [accountLabel, setAccountLabel] = useState(t('treasury.defaultAccount'));
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const save = useAction(importBankMovements, {
    invalidate: accountingInvalidate,
    onSuccess: setResult,
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    // Los bancos exportan en UTF-8 o en Windows-1252; si el UTF-8 no es válido se reintenta.
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder('windows-1252').decode(buffer);
    }
    const rows = parseCsv(text);
    setTable(rows);
    if (rows[0]) setMapping(guessMapping(rows[0]));
    setResult(null);
  };

  const body = useMemo(() => (table ? table.slice(hasHeader ? 1 : 0) : []), [table, hasHeader]);
  const parsed = useMemo(
    () =>
      body.map((row) => {
        const booked = parseBankDate(row[mapping.date] ?? '');
        let cents: number | null;
        if (mapping.amount >= 0) cents = eurosToCents(row[mapping.amount] ?? '');
        else {
          const debit = eurosToCents(row[mapping.debit] || '0');
          const credit = eurosToCents(row[mapping.credit] || '0');
          cents = debit === null || credit === null ? null : credit - Math.abs(debit);
        }
        const description =
          (mapping.description >= 0 ? row[mapping.description] : '')?.trim() || '—';
        return { booked_on: booked, description: description.slice(0, 500), amount_cents: cents };
      }),
    [body, mapping],
  );
  const valid = parsed.filter(
    (r): r is { booked_on: string; description: string; amount_cents: number } =>
      Boolean(r.booked_on) && r.amount_cents !== null && r.amount_cents !== 0,
  );
  const columns = (table?.[0] ?? []).map((h, i) => ({
    value: i,
    label: hasHeader ? h || `#${i + 1}` : `${t('treasury.column')} ${i + 1}`,
  }));

  const ColumnSelect = ({ field, optional }: { field: keyof Mapping; optional?: boolean }) => (
    <Select
      value={mapping[field]}
      onChange={(e) => setMapping((m) => ({ ...m, [field]: Number(e.target.value) }))}
    >
      {optional && <option value={-1}>—</option>}
      {columns.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </Select>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={t('treasury.importTitle')}
      description={t('treasury.importHint')}
    >
      <div className="grid gap-5">
        <Notice>{t('treasury.privacy')}</Notice>
        <FormGrid>
          <FormField id="csv" label={t('treasury.file')}>
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </FormField>
          <FormField
            id="label"
            label={t('treasury.accountLabel')}
            hint={t('treasury.accountLabelHint')}
          >
            <Input
              id="label"
              value={accountLabel}
              maxLength={80}
              onChange={(e) => setAccountLabel(e.target.value)}
            />
          </FormField>
        </FormGrid>
        {table && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
              />{' '}
              {t('treasury.hasHeader')}
            </label>
            <FormGrid cols={4}>
              <FormField id="m_date" label={t('common.date')}>
                <ColumnSelect field="date" />
              </FormField>
              <FormField id="m_desc" label={t('treasury.description')}>
                <ColumnSelect field="description" optional />
              </FormField>
              <FormField
                id="m_amount"
                label={t('treasury.amountColumn')}
                hint={t('treasury.amountColumnHint')}
              >
                <ColumnSelect field="amount" optional />
              </FormField>
              {mapping.amount < 0 && (
                <>
                  <FormField id="m_debit" label={t('treasury.debitColumn')}>
                    <ColumnSelect field="debit" optional />
                  </FormField>
                  <FormField id="m_credit" label={t('treasury.creditColumn')}>
                    <ColumnSelect field="credit" optional />
                  </FormField>
                </>
              )}
            </FormGrid>
            <div className="max-h-64 overflow-auto rounded-xl border">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('common.date')}</Th>
                    <Th>{t('treasury.description')}</Th>
                    <Th numeric>{t('common.amount')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((r, i) => (
                    <tr
                      key={i}
                      className={
                        !r.booked_on || r.amount_cents === null ? 'bg-destructive/5' : undefined
                      }
                    >
                      <Td>
                        {r.booked_on ? (
                          date(r.booked_on)
                        ) : (
                          <span className="text-destructive">{t('treasury.invalid')}</span>
                        )}
                      </Td>
                      <Td className="max-w-96 truncate">{r.description}</Td>
                      <Td numeric>
                        {r.amount_cents === null ? (
                          <span className="text-destructive">{t('treasury.invalid')}</span>
                        ) : (
                          money(r.amount_cents)
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('treasury.validRows', { valid: valid.length, total: parsed.length })}
            </p>
          </>
        )}
        {result && <Notice tone="success">{t('treasury.importResult', result)}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {result ? t('common.close') : t('common.cancel')}
          </Button>
          {!result && (
            <Button
              disabled={!valid.length || !accountLabel.trim() || save.isPending}
              onClick={() => save.mutate({ account_label: accountLabel.trim(), rows: valid })}
            >
              <Upload /> {t('treasury.importN', { count: valid.length })}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function ReconcileDialog({ movement, onClose }: { movement: BankMovement; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isPending } = useQuery({
    queryKey: treasuryKeys.candidates(movement.id),
    queryFn: ({ signal }) => bankCandidates(movement.id, signal),
  });
  const reconcile = useAction((entryId: string) => reconcileMovement(movement.id, entryId), {
    invalidate: accountingInvalidate,
    success: 'treasury.reconciled',
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('treasury.reconcileTitle')}
      description={`${date(movement.booked_on)} · ${movement.description} · ${money(movement.amount_cents)}`}
    >
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">{t('treasury.candidatesHint')}</p>
        <div className="rounded-xl border">
          <Table>
            <thead>
              <tr>
                <Th>{t('journal.number')}</Th>
                <Th>{t('common.date')}</Th>
                <Th>{t('journal.concept')}</Th>
                <Th numeric>{t('common.amount')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {isPending && <EmptyRow colSpan={5}>{t('common.loading')}</EmptyRow>}
              {data?.length === 0 && <EmptyRow colSpan={5}>{t('treasury.noCandidates')}</EmptyRow>}
              {data?.map((c) => (
                <tr key={c.journal_entry_id}>
                  <Td className="tabular font-semibold">{c.entry_number}</Td>
                  <Td>
                    {date(c.entry_date)}
                    {c.days_apart > 0 && (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({t('treasury.daysApart', { count: c.days_apart })})
                      </span>
                    )}
                  </Td>
                  <Td className="max-w-64">
                    <p className="truncate">{c.concept}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.reference}</p>
                  </Td>
                  <Td numeric>{money(c.amount_cents)}</Td>
                  <Td className="text-right">
                    <Button
                      size="xs"
                      disabled={reconcile.isPending}
                      onClick={() => reconcile.mutate(c.journal_entry_id)}
                    >
                      {t('treasury.link')}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
