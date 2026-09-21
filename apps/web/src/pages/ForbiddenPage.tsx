import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">{t('forbidden.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('forbidden.message')}</p>
      <Button asChild variant="outline">
        <Link to="/">{t('common.backToHome')}</Link>
      </Button>
    </div>
  );
}
