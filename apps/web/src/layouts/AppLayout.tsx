import { LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router';
import { APP_MODULES } from '@/app/modules';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { t } = useTranslation();
  const { user, can, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const modules = APP_MODULES.filter((module) => !module.permission || can(module.permission));

  const nav = (
    <nav aria-label={t('nav.title')} className="grid gap-1 p-3">
      {modules.map(({ id, path, labelKey, icon: Icon }) => (
        <NavLink
          key={id}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
              isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-svh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r bg-card md:block">
        <div className="px-6 py-5 text-sm font-semibold tracking-[0.2em]">{t('app.name')}</div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? t('common.closeMenu') : t('common.openMenu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
          <span className="text-sm font-semibold tracking-[0.2em] md:hidden">{t('app.name')}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden truncate text-sm text-muted-foreground sm:block">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut />
              {t('common.logout')}
            </Button>
          </div>
        </header>

        {menuOpen && <div className="border-b bg-card md:hidden">{nav}</div>}

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
