import { Tag } from '../trainer/bridge.tsx';

export const ENDED_EARLY_NOTE =
  'This call stopped before a wrap-up, so the Closing score rests on limited evidence.';

/** Marks a short call that stopped before any wrap-up. Neutral: it describes the call, not the trainee. */
export function EndedEarlyTag() {
  return <Tag>Ended early</Tag>;
}

/** Marks records and sessions that come from the built-in sample data. */
export function SampleTag() {
  return <Tag tone="amber">Sample</Tag>;
}
