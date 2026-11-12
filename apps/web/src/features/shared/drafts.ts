import type { EntryDraft } from '@/api/accounting';
import { today } from '@/lib/format';

/** Borrador vacío para asientos manuales y de saldos iniciales (dos líneas para empezar). */
export const emptyDraft = (sourceType: 'MANUAL' | 'OPENING', entryDate = today()): EntryDraft => ({
  source_type: sourceType,
  entry_date: entryDate,
  activity: 'SHARED',
  reference: '',
  concept: '',
  lines: [
    { account_code: '', description: null, debit_cents: 0, credit_cents: 0 },
    { account_code: '', description: null, debit_cents: 0, credit_cents: 0 },
  ],
});

export function draftTotals(draft: EntryDraft) {
  const debit = draft.lines.reduce((sum, line) => sum + line.debit_cents, 0);
  const credit = draft.lines.reduce((sum, line) => sum + line.credit_cents, 0);
  return { debit, credit, difference: debit - credit };
}

/** Problemas que impiden contabilizar (clave i18n), o null. La API vuelve a validarlo todo. */
export function draftError(draft: EntryDraft): string | null {
  if (!draft.reference.trim() || !draft.concept.trim() || !draft.entry_date)
    return 'entry.errors.header';
  if (draft.lines.length < 2) return 'entry.errors.lines';
  for (const line of draft.lines) {
    if (!/^\d{3,10}$/.test(line.account_code)) return 'entry.errors.account';
    if (line.debit_cents > 0 === line.credit_cents > 0) return 'entry.errors.oneSide';
  }
  const { difference, debit } = draftTotals(draft);
  if (difference !== 0 || debit === 0) return 'entry.errors.unbalanced';
  return null;
}
