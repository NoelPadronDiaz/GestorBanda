import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { APP_MODULES } from '@/app/modules';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/use-auth';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();

  const modules = APP_MODULES.filter(
    (module) => module.id !== 'dashboard' && (!module.permission || can(module.permission)),
  );

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{t('dashboard.welcome', { email: user?.email })}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.intro')}</p>
      </div>

      {modules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ id, path, labelKey, icon: Icon }) => (
            <Link
              key={id}
              to={path}
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                  <CardTitle>{t(labelKey)}</CardTitle>
                  <CardDescription>{path}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
