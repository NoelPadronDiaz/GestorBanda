import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router';
import { HOME_MODULE, NAV_GROUPS, type AppModule } from '@/app/modules';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { cn } from '@/lib/utils';

function NavItem({ module, nested }: { module: AppModule; nested?: boolean }) {
  const { t } = useTranslation();
  const Icon = module.icon;
  return (
    <NavLink
      to={module.path}
      end={module.path === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors',
          nested ? 'py-2' : 'py-2.5 font-semibold',
          isActive
            ? 'bg-sidebar-hover text-white shadow-[inset_3px_0_0_var(--gold)]'
            : 'text-sidebar-foreground hover:bg-white/[0.065] hover:text-white',
        )
      }
    >
      <Icon className={cn('shrink-0', nested ? 'size-3.5 opacity-70' : 'size-4')} aria-hidden />
      <span className="truncate">{t(module.labelKey)}</span>
    </NavLink>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex items-center gap-3', compact ? 'py-1' : 'px-2 pt-1 pb-5')}>
      <img
        src="/brand/alcaravan-logo-256.png"
        alt=""
        className={cn('shrink-0 object-contain', compact ? 'size-9' : 'size-16')}
      />
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-[0.12em] text-sidebar-strong">
          {t('app.name')}
        </p>
        <p className="text-[10px] tracking-[0.14em] text-[#b8c5d4] uppercase">{t('app.tagline')}</p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { user, can, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0);

  const nav = (
    <nav aria-label={t('nav.title')} className="grid gap-1.5">
      <NavItem module={HOME_MODULE} />
      {groups.map((group) => {
        const GroupIcon = group.icon;
        const active = group.items.some((item) => location.pathname.startsWith(item.path));
        return (
          <details
            key={`${group.id}-${active}`}
            open={active || undefined}
            className="group/nav rounded-xl border border-sidebar-border"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold text-[#e6e9ef] hover:bg-white/[0.065] group-open/nav:text-[#f0d29a] [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5">
                <GroupIcon className="size-4 opacity-80" aria-hidden />
                {t(group.labelKey)}
              </span>
              <ChevronDown
                className="size-4 text-[#9fafc2] transition-transform group-open/nav:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="grid gap-0.5 px-1.5 pb-1.5">
              {group.items.map((item) => (
                <NavItem key={item.id} module={item} nested />
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-svh md:grid md:grid-cols-[16.5rem_minmax(0,1fr)] print:block">
      <aside className="no-print sticky top-0 hidden h-svh flex-col gap-2 overflow-y-auto bg-sidebar px-3.5 py-5 md:flex">
        <Brand />
        {nav}
        <p className="mt-auto px-2 pt-4 text-[11px] leading-relaxed text-[#aebdd0]/80">
          {t('app.footer')}
        </p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b bg-card/95 px-4 py-2.5 backdrop-blur md:bg-card">
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
          <span className="text-sm font-bold tracking-[0.14em] md:hidden">{t('app.name')}</span>
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

        {menuOpen && (
          <div className="no-print border-b bg-sidebar px-3 py-4 md:hidden">
            <Brand compact />
            <div className="mt-3">{nav}</div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
