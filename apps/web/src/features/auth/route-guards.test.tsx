import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Permission } from '@alcaravan/shared';
import type { Me } from '@/api/types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';
import { RequireAuth } from './RequireAuth';
import { RequirePermission } from './RequirePermission';

function makeAuth(status: AuthStatus, permissions: Permission[] = []): AuthContextValue {
  const user: Me | null =
    status === 'authenticated'
      ? { id: 'u1', email: 'a@b.c', member_id: null, roles: [], permissions, last_login_at: null }
      : null;
  return {
    status,
    user,
    can: (permission) => permissions.includes(permission),
    login: async () => undefined,
    logout: async () => undefined,
    changePassword: async () => undefined,
  };
}

function renderRoutes(auth: AuthContextValue, initialPath: string) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<p>login screen</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>dashboard</p>} />
            <Route element={<RequirePermission permission="members.read" />}>
              <Route path="/members" element={<p>members screen</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('route guards', () => {
  it('shows a spinner while the session is being restored', () => {
    renderRoutes(makeAuth('loading'), '/members');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('members screen')).not.toBeInTheDocument();
  });

  it('redirects anonymous users to the login screen', () => {
    renderRoutes(makeAuth('unauthenticated'), '/members');
    expect(screen.getByText('login screen')).toBeInTheDocument();
  });

  it('renders the route when the user holds the permission', () => {
    renderRoutes(makeAuth('authenticated', ['members.read']), '/members');
    expect(screen.getByText('members screen')).toBeInTheDocument();
  });

  it('shows the forbidden page when the permission is missing', () => {
    renderRoutes(makeAuth('authenticated', ['band_profile.read']), '/members');
    expect(screen.queryByText('members screen')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('lets any authenticated user reach routes without a permission requirement', () => {
    renderRoutes(makeAuth('authenticated'), '/');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
});
