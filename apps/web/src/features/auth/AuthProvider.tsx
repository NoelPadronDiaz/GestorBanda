import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission } from '@alcaravan/shared';
import { loginRequest, logoutRequest } from '@/api/auth';
import { refreshSession, setSessionLostHandler, tokenStore } from '@/api/client';
import type { Me } from '@/api/types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

const ME_KEY = ['me'] as const;

/**
 * Estado de autenticación = una query cuyo dato es el usuario (o null si no hay sesión).
 * Al arrancar intenta recuperar la sesión con la cookie de refresh, sin pedir login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery<Me | null>({
    queryKey: ME_KEY,
    queryFn: async () => (await refreshSession())?.user ?? null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnReconnect: false,
  });

  const dropSession = useCallback(() => {
    tokenStore.clear();
    // Fuera cualquier dato cacheado del usuario anterior (miembros, perfil, ...).
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
    queryClient.setQueryData(ME_KEY, null);
  }, [queryClient]);

  useEffect(() => {
    setSessionLostHandler(dropSession);
    return () => setSessionLostHandler(null);
  }, [dropSession]);

  const login = useCallback<AuthContextValue['login']>(
    async ({ email, password }) => {
      const session = await loginRequest(email, password);
      tokenStore.set(session.access_token);
      queryClient.setQueryData(ME_KEY, session.user);
    },
    [queryClient],
  );

  const logout = useCallback<AuthContextValue['logout']>(async () => {
    try {
      await logoutRequest();
    } finally {
      dropSession();
    }
  }, [dropSession]);

  const user = meQuery.data ?? null;
  const status: AuthStatus = meQuery.isPending
    ? 'loading'
    : user
      ? 'authenticated'
      : 'unauthenticated';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      can: (permission: Permission) => user?.permissions.includes(permission) ?? false,
      login,
      logout,
    }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
