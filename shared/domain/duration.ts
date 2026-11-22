// How long a call is expected to take, shown as a range. A scenario states one number of minutes
// (`estimatedMinutes`); a call never runs to the minute, so people are shown "8–12 min" instead.

/** The range around an estimate: 20% less to 20% more, at least three minutes, and always wider than one. */
export function estimatedRange(minutes: number): { min: number; max: number } {
  const base = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  const min = Math.max(3, Math.round((base * 4) / 5));
  const max = Math.max(min + 1, Math.round((base * 6) / 5));
  return { min, max };
}

/** The range as it is shown: "8–12 min" for ten minutes (an en dash, and a space before "min"). */
export function formatEstimate(minutes: number): string {
  const { min, max } = estimatedRange(minutes);
  return `${min}\u2013${max} min`;
}
