import { redact } from './redact';

describe('redact', () => {
  it('hides sensitive keys at any depth', () => {
    const result = redact({
      email: 'a@b.c',
      password_hash: 'x',
      nested: { token_hash: 'y', storageKey: 'z', keep: 1 },
      list: [{ refresh_token: 'r' }],
    });
    expect(result).toEqual({
      email: 'a@b.c',
      password_hash: '[REDACTED]',
      nested: { token_hash: '[REDACTED]', storageKey: '[REDACTED]', keep: 1 },
      list: [{ refresh_token: '[REDACTED]' }],
    });
  });

  it('serializes dates and passes primitives through', () => {
    expect(redact(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
    expect(redact(5)).toBe(5);
    expect(redact(null)).toBeNull();
  });
});
