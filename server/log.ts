// Structured logging. Lines are single JSON objects on stdout. Callers pass identifiers, counts and
// timings only: never transcript text, secrets or request bodies.

export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

const FORBIDDEN_KEYS =
  /^(text|body|transcript|apiKey|api_key|authorization|password|secret|token|prompt)$/i;

function scrub(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    out[key] =
      typeof value === 'string' && value.length > 200 ? `${value.slice(0, 200)}...` : value;
  }
  return out;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'silent';
const LEVEL_ORDER: Record<LogLevel, number> = { info: 0, warn: 1, error: 2, silent: 3 };

export function parseLogLevel(value: string | undefined): LogLevel {
  const level = value?.trim().toLowerCase();
  return level === 'warn' || level === 'error' || level === 'silent' ? level : 'info';
}

export function createLogger(
  sink: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  minimum: LogLevel = 'info',
): Logger {
  const write = (
    level: Exclude<LogLevel, 'silent'>,
    event: string,
    fields?: Record<string, unknown>,
  ) => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minimum]) return;
    sink(JSON.stringify({ time: new Date().toISOString(), level, event, ...scrub(fields) }));
  };
  return {
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };

/** A short, non-reversible-enough label for log lines (the first segment of an id). */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
