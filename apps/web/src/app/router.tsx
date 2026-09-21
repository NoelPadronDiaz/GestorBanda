import { createBrowserRouter } from 'react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequirePermission } from '@/features/auth/RequirePermission';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AppLayout } from '@/layouts/AppLayout';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Cada módulo de negocio se carga bajo demanda para que el bundle inicial no crezca con la app.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            element: <RequirePermission permission="members.read" />,
            children: [
              {
                path: 'members',
                lazy: async () => ({
                  Component: (await import('@/features/members/MembersPage')).MembersPage,
                }),
              },
            ],
          },
          {
            element: <RequirePermission permission="band_profile.read" />,
            children: [
              {
                path: 'band-profile',
                lazy: async () => ({
                  Component: (await import('@/features/band-profile/BandProfilePage'))
                    .BandProfilePage,
                }),
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
