export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined) return '\u2013';
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return r === 0 ? `${m} min` : `${m} min ${r}s`;
}

/** m:ss for a running timer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// The interface is written in British English, so dates and times are too, whatever the browser's
// own locale (which also keeps the output the same on every machine, including the test runners).
const LOCALE = 'en-GB';
const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.round((now - Date.parse(iso)) / 1000);
  if (diff < 60) return 'just now';
  const minutes = Math.round(diff / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? '\u2013' : score.toFixed(1);
}

/** Describes how strongly a 1-5 score reads, used for meters. Never used to rank people. */
export function scoreTone(score: number): 'very-low' | 'low' | 'ok' {
  return score <= 1 ? 'very-low' : score <= 2 ? 'low' : 'ok';
}

export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
