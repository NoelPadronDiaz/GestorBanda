import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { accountingKeys, listAccounts, type EntryDraft } from '@/api/accounting';
import { FormField, FormGrid } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { centsToInput, eurosToCents, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ActivitySelect } from './controls';
import { draftTotals } from './drafts';

/**
 * Editor de asiento de partida doble: cabecera + líneas con cuenta (autocompletada con el plan de
 * cuentas), Debe y Haber. Muestra el descuadre en vivo.
 */
export function EntryEditor({
  draft,
  onChange,
  lockHeader,
}: {
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  /** Fecha y actividad vienen del documento; aun así se pueden revisar. */
  lockHeader?: boolean;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const { data: accounts } = useQuery({
    queryKey: accountingKeys.accounts,
    queryFn: ({ signal }) => listAccounts(signal),
    staleTime: 300_000,
  });
  const names = new Map(accounts?.map((account) => [account.code, account.name]));
  const { debit, credit, difference } = draftTotals(draft);

  const setLine = (index: number, patch: Partial<EntryDraft['lines'][number]>) =>
    onChange({
      ...draft,
      lines: draft.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    });

  return (
    <div className="grid gap-4">
      <FormGrid cols={4}>
        <FormField id="entry_date" label={t('entry.date')}>
          <Input
            id="entry_date"
            type="date"
            value={draft.entry_date}
            onChange={(event) => onChange({ ...draft, entry_date: event.target.value })}
          />
        </FormField>
        <FormField id="entry_activity" label={t('common.activity')}>
          <ActivitySelect
            id="entry_activity"
            value={draft.activity}
            onChange={(activity) => activity && onChange({ ...draft, activity })}
          />
        </FormField>
        <FormField id="entry_reference" label={t('entry.reference')}>
          <Input
            id="entry_reference"
            maxLength={80}
            value={draft.reference}
            readOnly={lockHeader}
            onChange={(event) => onChange({ ...draft, reference: event.target.value })}
          />
        </FormField>
        <FormField id="entry_concept" label={t('entry.concept')}>
          <Input
            id="entry_concept"
            maxLength={300}
            value={draft.concept}
            onChange={(event) => onChange({ ...draft, concept: event.target.value })}
          />
        </FormField>
      </FormGrid>

      <datalist id={listId}>
        {accounts?.map((account) => (
          <option key={account.code} value={account.code}>
            {account.name}
          </option>
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">{t('entry.account')}</th>
              <th className="px-3 py-2 text-left font-semibold">{t('entry.lineDescription')}</th>
              <th className="w-36 px-3 py-2 text-right font-semibold">{t('entry.debit')}</th>
              <th className="w-36 px-3 py-2 text-right font-semibold">{t('entry.credit')}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((line, index) => (
              <tr key={index} className="border-t">
                <td className="px-2 py-1.5 align-top">
                  <Input
                    list={listId}
                    inputMode="numeric"
                    aria-label={t('entry.account')}
                    value={line.account_code}
                    onChange={(event) =>
                      setLine(index, { account_code: event.target.value.trim() })
                    }
                    className="h-8 w-28"
                  />
                  <p className="mt-0.5 max-w-44 truncate text-[11px] text-muted-foreground">
                    {names.get(line.account_code) ??
                      (line.account_code ? t('entry.unknownAccount') : '')}
                  </p>
                </td>
                <td className="px-2 py-1.5 align-top">
                  <Input
                    aria-label={t('entry.lineDescription')}
                    value={line.description ?? ''}
                    onChange={(event) =>
                      setLine(index, { description: event.target.value || null })
                    }
                    className="h-8"
                  />
                </td>
                {(['debit_cents', 'credit_cents'] as const).map((field) => (
                  <td key={field} className="px-2 py-1.5 align-top">
                    <Input
                      key={`${field}-${line[field]}`}
                      inputMode="decimal"
                      aria-label={t(field === 'debit_cents' ? 'entry.debit' : 'entry.credit')}
                      defaultValue={centsToInput(line[field] || null)}
                      onBlur={(event) =>
                        setLine(index, {
                          [field]: Math.max(0, eurosToCents(event.target.value) ?? 0),
                        })
                      }
                      className="tabular h-8 text-right"
                    />
                  </td>
                ))}
                <td className="px-1 py-1.5 align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.remove')}
                    onClick={() =>
                      onChange({ ...draft, lines: draft.lines.filter((_, i) => i !== index) })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-secondary/40 text-sm font-semibold">
            <tr>
              <td className="px-3 py-2" colSpan={2}>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    onChange({
                      ...draft,
                      lines: [
                        ...draft.lines,
                        { account_code: '', description: null, debit_cents: 0, credit_cents: 0 },
                      ],
                    })
                  }
                >
                  <Plus /> {t('entry.addLine')}
                </Button>
              </td>
              <td className="tabular px-3 py-2 text-right">{money(debit)}</td>
              <td className="tabular px-3 py-2 text-right">{money(credit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p
        className={cn(
          'text-right text-xs font-semibold',
          difference === 0 ? 'text-success' : 'text-destructive',
        )}
      >
        {difference === 0
          ? t('entry.balanced')
          : t('entry.difference', { amount: money(difference) })}
      </p>
    </div>
  );
}
