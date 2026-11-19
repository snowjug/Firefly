/** True when `value` is one of the allowed strings. Narrows untrusted input (URLs, storage). */
export function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
