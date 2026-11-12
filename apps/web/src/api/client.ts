import type { ApiErrorBody } from '@alcaravan/shared';
import type { Session } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown,
    readonly traceId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * El access token vive solo en memoria (nunca en localStorage: un XSS no podría robarlo de ahí).
 * Al recargar la página se recupera con el refresh token de la cookie httpOnly.
 */
let accessToken: string | null = null;
export const tokenStore = {
  get: () => accessToken,
  set: (token: string) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};

let onSessionLost: (() => void) | null = null;
export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

let refreshInFlight: Promise<Session | null> | null = null;

async function performRefresh(): Promise<Session | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      tokenStore.clear();
      return null;
    }
    const session = (await response.json()) as Session;
    tokenStore.set(session.access_token);
    return session;
  } catch {
    tokenStore.clear();
    return null;
  }
}

/**
 * Un solo refresh a la vez: los refresh tokens son de un solo uso, así que dos peticiones
 * concurrentes con 401 no deben rotar el mismo token dos veces.
 */
export function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as Partial<ApiErrorBody> | null;
  return new ApiError(
    response.status,
    body?.code ?? 'INTERNAL_ERROR',
    body?.message ?? response.statusText,
    body?.details ?? null,
    body?.trace_id ?? response.headers.get('x-trace-id'),
  );
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
  signal?: AbortSignal;
  /** false para login/refresh: un 401 ahí no debe intentar refrescar la sesión. */
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE}${path}${search ? `?${search}` : ''}`;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, auth = true } = options;

  // FormData (subida de ficheros): el navegador pone el Content-Type con su boundary.
  const isForm = body instanceof FormData;
  const send = () =>
    fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      signal,
      headers: {
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}),
      },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await send();

  if (response.status === 401 && auth) {
    const session = await refreshSession();
    if (session) {
      response = await send();
    } else {
      onSessionLost?.();
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
