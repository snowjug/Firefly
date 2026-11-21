import type { Difficulty, IssueType, StartTemperature } from '#shared/domain/vocab.ts';

// The landing page shows one real scenario for each kind of issue. The titles, difficulties and
// starting moods are copied here so that the page never loads the scenario library (which holds every
// customer's hidden facts). `scenario-examples.test.ts` compares each entry with the real library and
// fails when one drifts, so a rename or a re-balanced scenario cannot leave the landing page wrong.

export interface ScenarioExample {
  issueType: IssueType;
  /** The scenario's id in the library: how the test finds it. */
  scenarioId: string;
  title: string;
  difficulty: Difficulty;
  startingTemperature: StartTemperature;
}

/** One entry per kind of issue, in the order of `ISSUE_TYPES`. */
export const SCENARIO_EXAMPLES: readonly ScenarioExample[] = [
  {
    issueType: 'sign-in-access',
    scenarioId: 'locked-out-after-password-reset',
    title: 'Locked out after a password reset',
    difficulty: 'starter',
    startingTemperature: 'calm',
  },
  {
    issueType: 'service-outage',
    scenarioId: 'checkout-outage-before-investor-event',
    title: 'Checkout is down and the clock is running',
    difficulty: 'challenge',
    startingTemperature: 'angry',
  },
  {
    issueType: 'slow-performance',
    scenarioId: 'recurring-midday-slowdowns',
    title: 'Order entry slows down at certain times',
    difficulty: 'standard',
    startingTemperature: 'anxious',
  },
  {
    issueType: 'data-missing',
    scenarioId: 'missing-orders-after-settings-change',
    title: 'Orders missing from the weekly report',
    difficulty: 'standard',
    startingTemperature: 'frustrated',
  },
  {
    issueType: 'billing-licence',
    scenarioId: 'invoice-shock-and-cancellation-threat',
    title: 'A much bigger invoice than expected',
    difficulty: 'challenge',
    startingTemperature: 'frustrated',
  },
  {
    issueType: 'how-to',
    scenarioId: 'cannot-find-export-feature',
    title: 'A user needs help finding a feature',
    difficulty: 'starter',
    startingTemperature: 'calm',
  },
  {
    issueType: 'feature-not-working',
    scenarioId: 'escalated-integration-failures',
    title: 'Fourth contact, same failing uploads',
    difficulty: 'challenge',
    startingTemperature: 'angry',
  },
];

/** The shortest and longest estimated call in the library, in minutes. */
export const CALL_MINUTES = { min: 7, max: 15 } as const;
