import { EVALUATION_PHASES, type EvaluationPhase } from '#shared/domain/vocab.ts';

// How the page follows the server while it builds the report, and how it says what it found.

/** How often the page asks the server how far the evaluation has got. */
export const POLL_MS = 800;
/** The same, while the tab is in the background and nobody is watching. */
export const POLL_HIDDEN_MS = 3000;
/** After this long the page says the wait is longer than usual. */
export const SLOW_AFTER_MS = 40_000;

export interface PhaseStep {
  phase: EvaluationPhase;
  title: string;
}

/** The five steps the server really reports, in order, in the words the page uses for them. */
export const PHASE_STEPS: readonly PhaseStep[] = [
  { phase: 'transcript_locked', title: 'Transcript saved' },
  { phase: 'discovery_review', title: 'Checking what you found out from the customer' },
  { phase: 'scoring', title: 'Scoring the six coaching skills' },
  { phase: 'building_report', title: 'Writing your coaching report' },
  { phase: 'saved', title: 'Report saved' },
];

export type StepStatus = 'done' | 'current' | 'waiting';

/**
 * Where each step stands for the phase the server last reported. The transcript is saved as soon as
 * the call has ended, so the first step is always done; a step is in progress only once the server
 * has said it reached it.
 */
export function stepStatuses(phase: EvaluationPhase | null): StepStatus[] {
  const reached = phase === null ? 0 : EVALUATION_PHASES.indexOf(phase);
  return PHASE_STEPS.map((_, index): StepStatus => {
    if (index === 0 || index < reached || reached === PHASE_STEPS.length - 1) return 'done';
    return index === reached ? 'current' : 'waiting';
  });
}

/** What a screen reader hears when the step in progress changes. */
export function phaseAnnouncement(phase: EvaluationPhase | null): string | null {
  const reached = phase === null ? 0 : EVALUATION_PHASES.indexOf(phase);
  const step = PHASE_STEPS[reached];
  if (!step || reached === 0) return null;
  return `${step.title}.`;
}

const PROSE = /^[\p{L}\p{N}\s.,;:'\u2019"\u201c\u201d()\-\u2013\u2014/?!]+$/u;
const TECHNICAL =
  /https?:|www\.|\b\w*(?:Error|Exception)\b|\bE[A-Z]{3,}\b|\d+\.\d+\.\d+\.\d+|\bat\s+\S+:\d+|\.\w+:\d+|(?:\/[\w.-]+){2,}/;

/**
 * The sentence the server wrote about why the evaluation failed, or null. The server's messages are
 * meant to be safe to show, but this page only shows one that reads as a plain short sentence: never
 * markup, a URL, a stack trace, an address or anything that looks like a provider's own output.
 */
export function safeEvaluationMessage(message: string | null | undefined): string | null {
  const text = message?.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 240) return null;
  if (!PROSE.test(text) || TECHNICAL.test(text)) return null;
  return text;
}
