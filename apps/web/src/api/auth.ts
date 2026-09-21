import { apiFetch } from './client';
import type { Session } from './types';

export function loginRequest(email: string, password: string): Promise<Session> {
  return apiFetch<Session>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
}

export function logoutRequest(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST', auth: false });
}
