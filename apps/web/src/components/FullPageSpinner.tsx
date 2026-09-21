import { useTranslation } from 'react-i18next';

export function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex min-h-svh items-center justify-center text-sm text-muted-foreground"
    >
      {t('common.loading')}
    </div>
  );
}
