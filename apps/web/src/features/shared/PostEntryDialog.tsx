import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  accountingKeys,
  getProposal,
  postEntry,
  type DocumentSource,
  type EntryDraft,
} from '@/api/accounting';
import { errorMessage } from '@/api/error-message';
import { useAction } from '@/api/use-action';
import { FormField, FormGrid } from '@/components/form-field';
import { Notice } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { today } from '@/lib/format';
import { draftError } from './drafts';
import { EntryEditor } from './EntryEditor';

export interface PostTarget {
  type: DocumentSource;
  id: string;
  /** Gastos con IGIC: hay que decidir si es deducible antes de proponer el asiento. */
  hasInputTax?: boolean;
  label: string;
}

const isPayment = (type: DocumentSource) => type.endsWith('_PAYMENT');

/**
 * Contabilizar un documento en dos pasos: (1) opciones (IGIC deducible, caja/banco y fecha del
 * cobro o pago), (2) propuesta editable del asiento. Con `initialDraft` abre directamente el editor
 * (asientos manuales y saldos iniciales).
 */
export function PostEntryDialog({
  target,
  initialDraft,
  onClose,
}: {
  target?: PostTarget | null;
  initialDraft?: EntryDraft | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const open = Boolean(target || initialDraft);
  const [draft, setDraft] = useState<EntryDraft | null>(initialDraft ?? null);
  const [igic, setIgic] = useState<'' | 'true' | 'false'>('');
  const [via, setVia] = useState<'BANK' | 'CASH'>('BANK');
  const [date, setDate] = useState(today());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const post = useAction(postEntry, {
    invalidate: [
      accountingKeys.all,
      ['billing'],
      ['payroll'],
      ['school'],
      ['dashboard'],
      ['treasury'],
      ['budgets'],
    ],
    success: (entry) => t('entry.posted', { number: entry.number }),
    onSuccess: () => close(),
  });

  function close() {
    setDraft(null);
    setIgic('');
    setLoadError(null);
    onClose();
  }

  async function loadProposal() {
    if (!target) return;
    setLoading(true);
    setLoadError(null);
    try {
      setDraft(
        await getProposal({
          source_type: target.type,
          source_id: target.id,
          igic_deductible: target.hasInputTax ? igic === 'true' : undefined,
          via: isPayment(target.type) ? via : undefined,
          date: isPayment(target.type) ? date : undefined,
        }),
      );
    } catch (error) {
      setLoadError(errorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }

  const current = draft ?? initialDraft ?? null;
  const problem = current ? draftError(current) : null;

  return (
    <Dialog
      open={open}
      onClose={close}
      size="xl"
      title={target ? t('entry.postTitle', { label: target.label }) : t('entry.newTitle')}
      description={t('entry.reviewHint')}
    >
      {!current && target && (
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void loadProposal();
          }}
        >
          <FormGrid cols={3}>
            {target.hasInputTax && (
              <FormField id="igic" label={t('entry.igicTreatment')} hint={t('entry.igicHint')}>
                <Select
                  id="igic"
                  required
                  value={igic}
                  onChange={(event) => setIgic(event.target.value as typeof igic)}
                >
                  <option value="">{t('common.choose')}</option>
                  <option value="true">{t('entry.igicDeductible')}</option>
                  <option value="false">{t('entry.igicNotDeductible')}</option>
                </Select>
              </FormField>
            )}
            {isPayment(target.type) && (
              <>
                <FormField id="via" label={t('entry.via')}>
                  <Select
                    id="via"
                    value={via}
                    onChange={(event) => setVia(event.target.value as 'BANK' | 'CASH')}
                  >
                    <option value="BANK">{t('entry.viaBank')}</option>
                    <option value="CASH">{t('entry.viaCash')}</option>
                  </Select>
                </FormField>
                <FormField id="settle_date" label={t('entry.settlementDate')}>
                  <Input
                    id="settle_date"
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </FormField>
              </>
            )}
          </FormGrid>
          {!target.hasInputTax && !isPayment(target.type) && (
            <p className="text-sm text-muted-foreground">{t('entry.readyToPropose')}</p>
          )}
          {loadError && <Notice tone="danger">{loadError}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {t('entry.prepare')}
            </Button>
          </div>
        </form>
      )}

      {current && (
        <div className="grid gap-4">
          {current.warnings?.map((warning) => (
            <Notice key={warning} tone="warning">
              {t(`entry.warnings.${warning}`)}
            </Notice>
          ))}
          <EntryEditor draft={current} onChange={setDraft} lockHeader={Boolean(target)} />
          {problem && <p className="text-right text-xs text-destructive">{t(problem)}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={Boolean(problem) || post.isPending}
              onClick={() => post.mutate(current)}
            >
              {t('entry.post')}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
