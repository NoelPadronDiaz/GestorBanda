import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Building2,
  Calculator,
  CalendarClock,
  FileText,
  GraduationCap,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Lock,
  Music,
  Percent,
  PiggyBank,
  Receipt,
  Scale,
  Target,
  UserRound,
  Users,
  Wallet,
  Briefcase,
  ScrollText,
} from 'lucide-react';
import type { Permission } from '@alcaravan/shared';

export interface AppModule {
  id: string;
  path: string;
  /** Clave i18n de la etiqueta. */
  labelKey: string;
  /** Clave i18n de una línea de descripción (tarjetas de acceso rápido). */
  descriptionKey?: string;
  icon: LucideIcon;
  /** Sin permiso = visible para cualquier usuario autenticado. */
  permission?: Permission;
}

export interface NavGroup {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: AppModule[];
}

export const HOME_MODULE: AppModule = {
  id: 'dashboard',
  path: '/',
  labelKey: 'nav.dashboard',
  icon: LayoutDashboard,
};

/**
 * Menú por áreas, como en Alcaraván Gestión 2.13. Cada módulo nuevo añade aquí su entrada y en
 * router.tsx su ruta con el mismo permiso (la API lo vuelve a comprobar siempre).
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'billing',
    labelKey: 'nav.groups.billing',
    icon: Receipt,
    items: [
      {
        id: 'invoices',
        path: '/billing/invoices',
        labelKey: 'nav.invoices',
        descriptionKey: 'nav.desc.invoices',
        icon: FileText,
        permission: 'billing.read',
      },
      {
        id: 'clients',
        path: '/billing/clients',
        labelKey: 'nav.clients',
        descriptionKey: 'nav.desc.clients',
        icon: Building2,
        permission: 'billing.read',
      },
      {
        id: 'expenses',
        path: '/billing/expenses',
        labelKey: 'nav.expenses',
        descriptionKey: 'nav.desc.expenses',
        icon: Receipt,
        permission: 'billing.read',
      },
      {
        id: 'recurring',
        path: '/billing/recurring',
        labelKey: 'nav.recurring',
        descriptionKey: 'nav.desc.recurring',
        icon: CalendarClock,
        permission: 'billing.read',
      },
    ],
  },
  {
    id: 'school',
    labelKey: 'nav.groups.school',
    icon: GraduationCap,
    items: [
      {
        id: 'students',
        path: '/school',
        labelKey: 'nav.school',
        descriptionKey: 'nav.desc.school',
        icon: Music,
        permission: 'school.read',
      },
      {
        id: 'payroll',
        path: '/payroll',
        labelKey: 'nav.payroll',
        descriptionKey: 'nav.desc.payroll',
        icon: Briefcase,
        permission: 'payroll.read',
      },
    ],
  },
  {
    id: 'accounting',
    labelKey: 'nav.groups.accounting',
    icon: BookOpen,
    items: [
      {
        id: 'journal',
        path: '/accounting/journal',
        labelKey: 'nav.journal',
        descriptionKey: 'nav.desc.journal',
        icon: BookOpen,
        permission: 'accounting.read',
      },
      {
        id: 'ledger',
        path: '/accounting/ledger',
        labelKey: 'nav.ledger',
        descriptionKey: 'nav.desc.ledger',
        icon: ScrollText,
        permission: 'accounting.read',
      },
      {
        id: 'reports',
        path: '/accounting/reports',
        labelKey: 'nav.reports',
        descriptionKey: 'nav.desc.reports',
        icon: Scale,
        permission: 'accounting.read',
      },
      {
        id: 'fiscal-years',
        path: '/accounting/fiscal-years',
        labelKey: 'nav.fiscalYears',
        descriptionKey: 'nav.desc.fiscalYears',
        icon: Lock,
        permission: 'accounting.read',
      },
      {
        id: 'treasury',
        path: '/accounting/treasury',
        labelKey: 'nav.treasury',
        descriptionKey: 'nav.desc.treasury',
        icon: Landmark,
        permission: 'treasury.read',
      },
      {
        id: 'budgets',
        path: '/accounting/budgets',
        labelKey: 'nav.budgets',
        descriptionKey: 'nav.desc.budgets',
        icon: Target,
        permission: 'budgets.read',
      },
    ],
  },
  {
    id: 'tax',
    labelKey: 'nav.groups.tax',
    icon: Percent,
    items: [
      {
        id: 'igic',
        path: '/tax/igic',
        labelKey: 'nav.igic',
        descriptionKey: 'nav.desc.igic',
        icon: Calculator,
        permission: 'tax_reports.read',
      },
      {
        id: 'withholdings',
        path: '/tax/withholdings',
        labelKey: 'nav.withholdings',
        descriptionKey: 'nav.desc.withholdings',
        icon: HandCoins,
        permission: 'tax_reports.read',
      },
      {
        id: 'grants',
        path: '/tax/grants',
        labelKey: 'nav.grants',
        descriptionKey: 'nav.desc.grants',
        icon: PiggyBank,
        permission: 'grants.read',
      },
    ],
  },
  {
    id: 'internal',
    labelKey: 'nav.groups.internal',
    icon: Wallet,
    items: [
      {
        id: 'internal-cash',
        path: '/internal/cash',
        labelKey: 'nav.internalCash',
        descriptionKey: 'nav.desc.internalCash',
        icon: Wallet,
        permission: 'internal_cash.read',
      },
    ],
  },
  {
    id: 'association',
    labelKey: 'nav.groups.association',
    icon: Users,
    items: [
      {
        id: 'members',
        path: '/members',
        labelKey: 'nav.members',
        descriptionKey: 'nav.desc.members',
        icon: Users,
        permission: 'members.read',
      },
      {
        id: 'band-profile',
        path: '/band-profile',
        labelKey: 'nav.bandProfile',
        descriptionKey: 'nav.desc.bandProfile',
        icon: Building2,
        permission: 'band_profile.read',
      },
      {
        id: 'profile',
        path: '/profile',
        labelKey: 'nav.profile',
        descriptionKey: 'nav.desc.profile',
        icon: UserRound,
      },
    ],
  },
];

/** Lista plana (rutas, accesos rápidos, tests). */
export const APP_MODULES: readonly AppModule[] = [
  HOME_MODULE,
  ...NAV_GROUPS.flatMap((group) => group.items),
];
