import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAYMENT_METHODS, type PaymentMethod } from '@/api/billing';
import { FormField, FormGrid } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { today } from '@/lib/format';

/** Marca un cobro o pago sin contabilizar (seguimiento operativo, como en la app original). */
export function PaymentDialog({
  open,
  title,
  description,
  defaultMethod,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  defaultMethod?: PaymentMethod | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (input: { paid_on: string; payment_method: PaymentMethod }) => void;
}) {
  const { t } = useTranslation();
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod ?? 'BANK_TRANSFER');

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm({ paid_on: paidOn, payment_method: method });
        }}
      >
        <FormGrid>
          <FormField id="paid_on" label={t('payment.date')}>
            <Input
              id="paid_on"
              type="date"
              required
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </FormField>
          <FormField id="method" label={t('payment.method')}>
            <Select
              id="method"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {t(`paymentMethod.${value}`)}
                </option>
              ))}
            </Select>
          </FormField>
        </FormGrid>
        <p className="text-xs text-muted-foreground">{t('payment.hint')}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {t('payment.confirm')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
