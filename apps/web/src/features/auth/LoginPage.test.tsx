import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiError } from '@/api/client';
import { AuthContext, type AuthContextValue } from './auth-context';
import { LoginPage } from './LoginPage';

function renderLogin(login: AuthContextValue['login']) {
  const auth: AuthContextValue = {
    status: 'unauthenticated',
    user: null,
    can: () => false,
    login,
    logout: async () => undefined,
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>home</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
};

describe('LoginPage', () => {
  it('validates the form before calling the API', async () => {
    const login = vi.fn();
    renderLogin(login);

    fill('not-an-email', '');

    expect(await screen.findByText('Introduce un correo válido')).toBeInTheDocument();
    expect(await screen.findByText('Este campo es obligatorio')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('logs in with the trimmed email and navigates to the app', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(login);

    fill('  admin@banda.test ', 'secret-password');

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: 'admin@banda.test',
        password: 'secret-password',
      }),
    );
    expect(await screen.findByText('home')).toBeInTheDocument();
  });

  it('shows a translated message for the API error code', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password', null, 't-1'),
      );
    renderLogin(login);

    fill('admin@banda.test', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
  });
});
