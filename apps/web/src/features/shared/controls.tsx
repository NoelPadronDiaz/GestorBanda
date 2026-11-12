import { ACTIVITIES, type Activity } from '@alcaravan/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/form-controls';
import { currentYear } from '@/lib/format';

/** Controles y etiquetas que se repiten en todas las pantallas económicas. */

export function YearSelect({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (year: number) => void;
  id?: string;
}) {
  const now = currentYear();
  const years = Array.from(new Set([now + 1, now, now - 1, now - 2, now - 3, now - 4, value])).sort(
    (a, b) => b - a,
  );
  return (
    <Select
      id={id}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-28"
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </Select>
  );
}

export function ActivitySelect({
  value,
  onChange,
  allowAll,
  id,
}: {
  value: Activity | '';
  onChange: (activity: Activity | '') => void;
  allowAll?: boolean;
  id?: string;
}) {
  const { t } = useTranslation();
  return (
    <Select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as Activity | '')}
      className="sm:w-56"
    >
      {allowAll && <option value="">{t('activity.ALL')}</option>}
      {ACTIVITIES.map((activity) => (
        <option key={activity} value={activity}>
          {t(`activity.${activity}`)}
        </option>
      ))}
    </Select>
  );
}

export function ActivityBadge({ activity }: { activity: Activity }) {
  const { t } = useTranslation();
  return (
    <Badge tone={activity === 'SCHOOL' ? 'info' : activity === 'BAND' ? 'neutral' : 'pending'}>
      {t(`activity.short.${activity}`)}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: 'PENDING' | 'PAID' | 'CANCELLED' }) {
  const { t } = useTranslation();
  const tone = status === 'PAID' ? 'success' : status === 'CANCELLED' ? 'danger' : 'pending';
  return <Badge tone={tone}>{t(`status.${status}`)}</Badge>;
}

/** Estado contable de un documento: sin asiento, devengado, cobrado/pagado contabilizado. */
export function AccountingBadge({
  accrual,
  payment,
}: {
  accrual: string | null;
  payment: string | null;
}) {
  const { t } = useTranslation();
  if (payment) return <Badge tone="success">{t('accountingStatus.settled')}</Badge>;
  if (accrual) return <Badge tone="info">{t('accountingStatus.accrued')}</Badge>;
  return <Badge>{t('accountingStatus.none')}</Badge>;
}
