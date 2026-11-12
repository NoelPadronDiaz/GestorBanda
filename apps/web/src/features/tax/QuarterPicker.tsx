import { useTranslation } from 'react-i18next';
import { FilterBar, FilterField } from '@/components/page';
import { Select } from '@/components/ui/form-controls';
import { YearSelect } from '@/features/shared/controls';

export function QuarterPicker({
  year,
  quarter,
  onYear,
  onQuarter,
}: {
  year: number;
  quarter: number;
  onYear: (year: number) => void;
  onQuarter: (quarter: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <FilterBar>
      <FilterField label={t('common.year')}>
        <YearSelect value={year} onChange={onYear} />
      </FilterField>
      <FilterField label={t('tax.quarter')}>
        <Select
          value={quarter}
          onChange={(e) => onQuarter(Number(e.target.value))}
          className="w-40"
        >
          {[1, 2, 3, 4].map((q) => (
            <option key={q} value={q}>
              {t('tax.quarterN', { q })}
            </option>
          ))}
        </Select>
      </FilterField>
    </FilterBar>
  );
}
