import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import type { Permission } from '@alcaravan/shared';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequirePermission } from '@/features/auth/RequirePermission';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AppLayout } from '@/layouts/AppLayout';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Ruta perezosa protegida por permiso: cada pantalla es su propio chunk. */
function guarded(
  permission: Permission,
  path: string,
  load: () => Promise<ComponentType>,
): RouteObject {
  return {
    element: <RequirePermission permission={permission} />,
    children: [{ path, lazy: async () => ({ Component: await load() }) }],
  };
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },

          // Facturación y gastos
          guarded(
            'billing.read',
            'billing/invoices',
            async () => (await import('@/features/billing/InvoicesPage')).InvoicesPage,
          ),
          guarded(
            'billing.manage',
            'billing/invoices/new',
            async () => (await import('@/features/billing/InvoiceEditorPage')).InvoiceEditorPage,
          ),
          guarded(
            'billing.read',
            'billing/invoices/:id',
            async () => (await import('@/features/billing/InvoiceEditorPage')).InvoiceEditorPage,
          ),
          guarded(
            'billing.read',
            'billing/invoices/:id/print',
            async () => (await import('@/features/billing/InvoicePrintPage')).InvoicePrintPage,
          ),
          guarded(
            'billing.read',
            'billing/clients',
            async () => (await import('@/features/billing/ClientsPage')).ClientsPage,
          ),
          guarded(
            'billing.read',
            'billing/expenses',
            async () => (await import('@/features/billing/ExpensesPage')).ExpensesPage,
          ),
          guarded(
            'billing.read',
            'billing/recurring',
            async () => (await import('@/features/billing/RecurringPage')).RecurringPage,
          ),

          // Escuela y personal
          guarded(
            'school.read',
            'school',
            async () => (await import('@/features/school/SchoolPage')).SchoolPage,
          ),
          guarded(
            'payroll.read',
            'payroll',
            async () => (await import('@/features/payroll/PayrollPage')).PayrollPage,
          ),

          // Contabilidad
          guarded(
            'accounting.read',
            'accounting/journal',
            async () => (await import('@/features/accounting/JournalPage')).JournalPage,
          ),
          guarded(
            'accounting.read',
            'accounting/ledger',
            async () => (await import('@/features/accounting/LedgerPage')).LedgerPage,
          ),
          guarded(
            'accounting.read',
            'accounting/reports',
            async () => (await import('@/features/accounting/ReportsPage')).ReportsPage,
          ),
          guarded(
            'accounting.read',
            'accounting/fiscal-years',
            async () => (await import('@/features/accounting/FiscalYearsPage')).FiscalYearsPage,
          ),
          guarded(
            'treasury.read',
            'accounting/treasury',
            async () => (await import('@/features/accounting/TreasuryPage')).TreasuryPage,
          ),
          guarded(
            'budgets.read',
            'accounting/budgets',
            async () => (await import('@/features/accounting/BudgetsPage')).BudgetsPage,
          ),

          // Fiscalidad y ayudas
          guarded(
            'tax_reports.read',
            'tax/igic',
            async () => (await import('@/features/tax/IgicPage')).IgicPage,
          ),
          guarded(
            'tax_reports.read',
            'tax/withholdings',
            async () => (await import('@/features/tax/WithholdingsPage')).WithholdingsPage,
          ),
          guarded(
            'grants.read',
            'tax/grants',
            async () => (await import('@/features/tax/GrantsPage')).GrantsPage,
          ),

          // Gestión interna
          guarded(
            'internal_cash.read',
            'internal/cash',
            async () =>
              (await import('@/features/internal-cash/InternalCashPage')).InternalCashPage,
          ),

          // Asociación
          guarded(
            'members.read',
            'members',
            async () => (await import('@/features/members/MembersPage')).MembersPage,
          ),
          guarded(
            'band_profile.read',
            'band-profile',
            async () => (await import('@/features/band-profile/BandProfilePage')).BandProfilePage,
          ),

          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
