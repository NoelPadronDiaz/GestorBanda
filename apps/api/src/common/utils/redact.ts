const SENSITIVE_KEY = /pass(word)?|token|secret|hash|storage_?key|authorization|cookie/i;
const REDACTED = '[REDACTED]';

/** Copia profunda de `value` con los campos sensibles sustituidos. Se aplica a todo lo que entra en el audit log. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 8) return REDACTED;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1),
    ]),
  );
}
