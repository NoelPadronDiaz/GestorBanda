import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Piezas de maquetación compartidas por todas las pantallas de gestión. */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        {eyebrow && (
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-gold-strong uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight md:text-[1.7rem]">{title}</h1>
        {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto grid w-full max-w-7xl gap-6', className)}>{children}</div>;
}

export function Panel({
  title,
  actions,
  children,
  className,
  flush,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sin padding interior (tablas a sangre). */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-[0_2px_9px_rgb(35_57_88_/0.04)]',
        !flush && 'p-5',
        className,
      )}
    >
      {(title || actions) && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3',
            flush ? 'px-5 pt-5 pb-3' : 'mb-4',
          )}
        >
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'gold' | 'warning' | 'success';
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-4 shadow-[0_3px_15px_rgb(24_38_57_/0.025)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && (
          <span
            className={cn(
              'grid size-7 place-items-center rounded-lg',
              tone === 'gold' && 'bg-accent text-gold-strong',
              tone === 'warning' && 'bg-warning-soft text-warning',
              tone === 'success' && 'bg-success-soft text-success',
              tone === 'default' && 'bg-secondary text-primary',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <strong className="tabular text-xl font-bold tracking-tight break-words md:text-2xl">
        {value}
      </strong>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** Aviso con el estilo dorado de la app original (avisos legales, advertencias contables). */
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}) {
  const Icon = tone === 'info' ? Info : tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cn(
        'flex gap-3 rounded-xl border p-3.5 text-xs leading-relaxed',
        tone === 'info' &&
          'border-[#efddb4] bg-[#fbf5e6] text-[#705822] dark:border-gold/30 dark:bg-accent dark:text-accent-foreground',
        tone === 'warning' &&
          'border-l-4 border-l-gold-strong bg-[#fff9eb] text-[#5d4720] dark:bg-accent dark:text-accent-foreground',
        tone === 'danger' && 'border-destructive/30 bg-destructive/10 text-destructive',
        tone === 'success' && 'border-success/30 bg-success-soft text-success',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

export function ErrorNotice({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <Notice tone="danger">{message}</Notice>;
}

/** Pestañas simples dentro de una pantalla (sin enrutado). */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-xl border bg-card p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            item.value === value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="ml-1.5 text-xs opacity-70">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Barra de filtros: fila de controles con etiqueta corta. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
