export const ENDED_EARLY_NOTE =
  'This call stopped before a wrap-up, so the Closing score rests on limited evidence.';

/** Marks a short call that stopped before any wrap-up. Neutral: it describes the call, not the trainee. */
export function EndedEarlyChip() {
  return <span className="chip">Ended early</span>;
}
