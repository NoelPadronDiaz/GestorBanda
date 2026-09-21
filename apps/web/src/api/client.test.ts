import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, setSessionLostHandler, tokenStore } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const session = {
  access_token: 'new-token',
  token_type: 'Bearer',
  expires_in: 900,
  user: {
    id: 'u1',
    email: 'a@b.c',
    member_id: null,
    roles: [],
    permissions: [],
    last_login_at: null,
  },
};

describe('apiFetch', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('old-token');
  });

  afterEach(() => {
    fetchMock.mockReset();
    tokenStore.clear();
    setSessionLostHandler(null);
    vi.unstubAllGlobals();
  });

  it('sends the bearer token and returns parsed JSON', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiFetch('/members')).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/members');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer old-token');
  });

  it('maps API errors to ApiError with code and trace_id', async () => {
    fetchMock.mockResolvedValueOnce(
      json(403, { code: 'FORBIDDEN', message: 'nope', details: null, trace_id: 'trace-1' }),
    );

    await expect(apiFetch('/members')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN',
      traceId: 'trace-1',
    });
  });

  it('refreshes once and retries when the access token expired', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(401, { code: 'UNAUTHORIZED', message: 'x', details: null, trace_id: 't' }),
      )
      .mockResolvedValueOnce(json(200, session))
      .mockResolvedValueOnce(json(200, { data: [] }));

    await expect(apiFetch('/members')).resolves.toEqual({ data: [] });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/members',
      '/api/v1/auth/refresh',
      '/api/v1/members',
    ]);
    expect(tokenStore.get()).toBe('new-token');
  });

  it('shares a single refresh between concurrent 401s (refresh tokens are one-time use)', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return json(200, session);
      const authorized = tokenStore.get() === 'new-token';
      return authorized
        ? json(200, { ok: true })
        : json(401, { code: 'UNAUTHORIZED', message: 'x', details: null, trace_id: 't' });
    });

    await Promise.all([apiFetch('/a'), apiFetch('/b'), apiFetch('/c')]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('notifies the app and clears the token when the session cannot be refreshed', async () => {
    const onLost = vi.fn();
    setSessionLostHandler(onLost);
    fetchMock
      .mockResolvedValueOnce(
        json(401, { code: 'UNAUTHORIZED', message: 'x', details: null, trace_id: 't' }),
      )
      .mockResolvedValueOnce(
        json(401, { code: 'INVALID_REFRESH_TOKEN', message: 'x', details: null, trace_id: 't' }),
      );

    await expect(apiFetch('/members')).rejects.toBeInstanceOf(ApiError);

    expect(onLost).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBeNull();
  });

  it('does not try to refresh when auth is disabled (login)', async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, { code: 'INVALID_CREDENTIALS', message: 'x', details: null, trace_id: 't' }),
    );

    await expect(
      apiFetch('/auth/login', { method: 'POST', body: {}, auth: false }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
