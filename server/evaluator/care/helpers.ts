import type { Evidence } from '#shared/domain/report.ts';
import { truncate } from '#shared/domain/text.ts';
import type { Finding } from './types.ts';

// Small constructors for findings, so every detector reads the same way.

const clip = (note: string): string => truncate(note, 200);

/** The behaviour was there; `evidence` quotes it. */
export const shown = (evidence: Evidence[], note?: string): Finding => ({
  status: 'shown',
  evidence,
  ...(note ? { note: clip(note) } : {}),
});

/** Some of it was there; `note` says what held the credit back. */
export const partly = (evidence: Evidence[], note: string): Finding => ({
  status: 'partly',
  evidence,
  note: clip(note),
});

/** It was missing. `evidence` may quote the moment that shows the gap. */
export const absent = (note: string, evidence: Evidence[] = [], clause?: string): Finding => ({
  status: 'not-shown',
  evidence,
  note: clip(note),
  ...(clause ? { clause } : {}),
});

/** Something harmful was said: the quote is the harm, and it caps the principal's level. */
export const harmful = (evidence: Evidence[], note: string, clause?: string): Finding => ({
  status: 'not-shown',
  evidence,
  note: clip(note),
  harm: true,
  ...(clause ? { clause } : {}),
});

export { wordCount } from '../words.ts';

/** The call itself needed this behaviour, so a miss counts even where the stage did not ask for it. */
export const needed = (finding: Finding): Finding => ({ ...finding, core: true });

/** A shown or partly finding must quote the call; without a quote it cannot be claimed. */
export function settle(finding: Finding): Finding {
  if (finding.status === 'not-shown' || finding.evidence.length > 0) return finding;
  return {
    status: 'not-shown',
    evidence: [],
    note: finding.note ?? 'Nothing in the call could be quoted for this.',
    ...(finding.harm ? { harm: true } : {}),
    ...(finding.clause ? { clause: finding.clause } : {}),
    ...(finding.core ? { core: true } : {}),
  };
}
