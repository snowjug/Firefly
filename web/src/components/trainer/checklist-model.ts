import { readStorage, writeStorage } from '../../lib/storage.ts';

export interface ChecklistStep {
  id: string;
  title: string;
  text: string;
  links?: { to: string; label: string }[];
}

/** A suggested order for showing the product end to end, with the places that need a link. */
export function checklistSteps(spotlightId: string | null): ChecklistStep[] {
  return [
    {
      id: 'configure',
      title: 'Configure the scenario',
      text: 'Change the difficulty, business impact, customer mood or communication style before the call.',
      links: spotlightId
        ? [{ to: `/scenarios/${encodeURIComponent(spotlightId)}/setup`, label: 'Open setup' }]
        : [{ to: '/scenarios', label: 'Browse scenarios' }],
    },
    {
      id: 'run',
      title: 'Run an unscripted call',
      text: 'Type whatever you like. The customer reacts to what you actually say; nothing is pre-written for any expected conversation.',
    },
    {
      id: 'discover',
      title: 'Uncover a hidden fact',
      text: 'The customer holds back key details until you ask about them. Try timing, recent changes or who is affected.',
    },
    {
      id: 'curveball',
      title: 'Meet a curveball',
      text: 'Partway through, the customer may raise something unexpected, such as asking for a manager or setting a deadline. Respond as you would on a real call.',
    },
    {
      id: 'end',
      title: 'End the call',
      text: 'End it when it reaches a natural close. Firefly locks the transcript and builds the report from it.',
    },
    {
      id: 'report',
      title: 'Read the report',
      text: 'Look at the evidence-based report: quotes from your own words, what was found and missed, the customer\u2019s temperature timeline and alternative phrasing.',
    },
    {
      id: 'history-progress',
      title: 'Open History and Progress',
      text: 'See the call in your history and how skills trend across completed sessions.',
      links: [
        { to: '/history', label: 'History' },
        { to: '/progress', label: 'Progress' },
      ],
    },
    {
      id: 'calibration',
      title: 'Open Calibration',
      text: 'Show how AI scores are compared with a mentor\u2019s scores on the same call.',
      links: [{ to: '/calibration', label: 'Calibration' }],
    },
  ];
}

/** Ticks are the presenter's own, kept for this tab only (they are not a record of anything). */
export const CHECKLIST_KEY = 'firefly.trainer.checklist';

/** The ticked step ids, in the checklist's order; anything unknown or malformed is dropped. */
export function readTicks(known: readonly string[]): string[] {
  const stored = readStorage<unknown>(CHECKLIST_KEY, [], 'session');
  if (!Array.isArray(stored)) return [];
  return known.filter((id) => stored.includes(id));
}

export function writeTicks(ids: readonly string[]): void {
  writeStorage(CHECKLIST_KEY, ids, 'session');
}
