import { createContext } from 'react';
import type { Permission } from '@alcaravan/shared';
import type { Me } from '@/api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: Me | null;
  /** Solo para mostrar u ocultar UI. La autorización real la impone siempre la API. */
  can: (permission: Permission) => boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Cambia la contraseña y adopta la sesión nueva que devuelve la API. */
  changePassword: (input: { current_password: string; new_password: string }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
