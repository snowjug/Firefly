import type { PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  IMPACTS,
  ISSUE_TYPES,
  START_TEMPERATURES,
} from '#shared/domain/vocab.ts';
import { seeded } from '../../test-rng.ts';
import { makeSummary } from '../report/report.fixtures.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';

// Fixtures for the mission atlas tests. The catalogue below has the shape of the real library (the
// 13 built-in scenarios: their ids, titles, customers and settings), listed easiest first like the
// server's registry. `atlas.fixtures.test.ts` checks it against that registry so it cannot drift.

export const CATALOGUE: readonly PublicScenarioDTO[] = [
  makeScenario({
    id: 'locked-out-after-password-reset',
    title: 'Locked out after a password reset',
    summary:
      'A front-desk coordinator cannot sign in to the staff portal after changing her password this morning.',
    tags: ['sign-in', 'password', 'single user'],
    estimatedMinutes: 8,
    issueType: 'sign-in-access',
    impact: 'low',
    startingTemperature: 'calm',
    proficiency: 'novice',
    style: 'talkative',
    callStage: 'first-contact',
    difficulty: 'starter',
    persona: {
      name: 'Maya Okafor',
      role: 'Front-desk coordinator',
      organisation: 'Fabrikam Dental Group',
    },
    coachingFocus: ['scoping-discovery', 'clarity'],
  }),
  makeScenario({
    id: 'cannot-find-export-feature',
    title: 'A user needs help finding a feature',
    summary:
      'An accounts assistant cannot find the Export option on the invoices page and asks where it is.',
    tags: ['how-to', 'export', 'single user'],
    estimatedMinutes: 7,
    issueType: 'how-to',
    impact: 'low',
    startingTemperature: 'calm',
    proficiency: 'novice',
    style: 'terse',
    callStage: 'first-contact',
    difficulty: 'starter',
    persona: {
      name: 'Carmen Fraser',
      role: 'Accounts assistant',
      organisation: 'Tailspin Print Works',
    },
    coachingFocus: ['scoping-discovery', 'clarity'],
  }),
  makeScenario({
    id: 'slow-dashboard-with-workaround',
    title: 'Dashboard slow on and off, with a workaround',
    summary:
      'An analyst says the reporting dashboard has been slow on and off since last week and is not sure why.',
    tags: ['slow performance', 'dashboard', 'workaround'],
    estimatedMinutes: 8,
    issueType: 'slow-performance',
    impact: 'low',
    startingTemperature: 'anxious',
    proficiency: 'intermediate',
    style: 'vague',
    callStage: 'first-contact',
    difficulty: 'starter',
    persona: {
      name: 'Priya Raman',
      role: 'Operations analyst',
      organisation: 'Northwind Dairy Co-op',
    },
    coachingFocus: ['scoping-discovery', 'ownership-next-steps'],
  }),
  makeScenario({
    id: 'licence-seat-not-assigned',
    title: 'A new hire has no premium seat',
    summary:
      'A design team lead asks why a new team member cannot use a premium feature when the team pays for ten seats.',
    tags: ['licence', 'seats', 'billing contact', 'plain language'],
    estimatedMinutes: 9,
    issueType: 'billing-licence',
    impact: 'low',
    startingTemperature: 'calm',
    proficiency: 'intermediate',
    style: 'non-native',
    callStage: 'first-contact',
    difficulty: 'starter',
    persona: {
      name: 'Tomasz Nowak',
      role: 'Design team lead',
      organisation: 'Contoso Design Studio',
    },
    coachingFocus: ['scoping-discovery', 'clarity'],
  }),
  makeScenario({
    id: 'closure-call-report-fix-unconfirmed',
    title: 'Closing out a case where the fix is not fully confirmed',
    summary:
      'A regional operations manager calls about a case on scheduled report emails. He believes the change made last week fixed them.',
    tags: ['closure', 'ownership', 'scheduled reports', 'expectations'],
    estimatedMinutes: 12,
    issueType: 'feature-not-working',
    impact: 'medium',
    startingTemperature: 'calm',
    proficiency: 'intermediate',
    style: 'talkative',
    callStage: 'closure',
    difficulty: 'standard',
    persona: {
      name: 'Elias Lindqvist',
      role: 'Regional operations manager',
      organisation: 'Adventure Works Retail Group',
    },
    coachingFocus: ['closing', 'ownership-next-steps'],
  }),
  makeScenario({
    id: 'team-cannot-open-shared-workspace',
    title: 'Team cannot open the shared project workspace',
    summary:
      'A project lead says nobody on his six-person team can open their shared project workspace, and a client deliverable is due today.',
    tags: ['access', 'team', 'deadline', 'ownership', 'demo'],
    estimatedMinutes: 10,
    issueType: 'sign-in-access',
    impact: 'medium',
    startingTemperature: 'frustrated',
    proficiency: 'intermediate',
    style: 'demanding',
    callStage: 'first-contact',
    difficulty: 'standard',
    persona: { name: 'Daniel Osei', role: 'Project lead', organisation: 'Proseware Consulting' },
    coachingFocus: ['scoping-discovery', 'empathy-deescalation', 'ownership-next-steps'],
    spotlight: true,
  }),
  makeScenario({
    id: 'missing-orders-after-settings-change',
    title: 'Orders missing from the weekly report',
    summary:
      'An operations manager says about two weeks of customer orders are missing from her weekly report, and thinks it began after someone tidied the settings.',
    tags: ['missing data', 'reports', 'settings change', 'vague customer'],
    estimatedMinutes: 10,
    issueType: 'data-missing',
    impact: 'medium',
    startingTemperature: 'frustrated',
    proficiency: 'intermediate',
    style: 'vague',
    callStage: 'first-contact',
    difficulty: 'standard',
    persona: {
      name: 'Ingrid Solheim',
      role: 'Operations manager',
      organisation: 'Wingtip Wholesale',
    },
    coachingFocus: ['scoping-discovery', 'clarity', 'ownership-next-steps'],
  }),
  makeScenario({
    id: 'recurring-midday-slowdowns',
    title: 'Order entry slows down at certain times',
    summary:
      'An IT coordinator says the order-entry system has been slowing down for his staff, on and off, for a few weeks. He has a lot of background to share.',
    tags: ['slow performance', 'intermittent', 'two offices', 'talkative customer'],
    estimatedMinutes: 12,
    issueType: 'slow-performance',
    impact: 'medium',
    startingTemperature: 'anxious',
    proficiency: 'intermediate',
    style: 'talkative',
    callStage: 'first-contact',
    difficulty: 'standard',
    persona: {
      name: 'Rhys Pritchard',
      role: 'IT coordinator and office manager',
      organisation: 'Woodgrove Building Supplies',
    },
    coachingFocus: ['scoping-discovery', 'clarity'],
  }),
  makeScenario({
    id: 'follow-up-no-recent-update',
    title: 'Reminders still missing and no update for days',
    summary:
      'A clinic administrator calls about her open case: calendar reminders stopped reaching some staff on their phones, and the last update was four days ago.',
    tags: ['follow-up', 'ownership', 'mobile', 'reminders', 'terse customer'],
    estimatedMinutes: 9,
    issueType: 'feature-not-working',
    impact: 'medium',
    startingTemperature: 'frustrated',
    proficiency: 'novice',
    style: 'terse',
    callStage: 'follow-up',
    difficulty: 'standard',
    persona: {
      name: 'Linh Tran',
      role: 'Clinic administrator',
      organisation: 'Lucerne Community Physiotherapy',
    },
    coachingFocus: ['ownership-next-steps', 'empathy-deescalation', 'closing'],
  }),
  makeScenario({
    id: 'checkout-outage-before-investor-event',
    title: 'Checkout is down and the clock is running',
    summary:
      'The head of digital at an online retailer says customers cannot complete orders, a deadline is close, and he believes the vendor is to blame.',
    tags: ['outage', 'executive pressure', 'checkout', 'high stakes'],
    estimatedMinutes: 12,
    issueType: 'service-outage',
    impact: 'high',
    startingTemperature: 'angry',
    proficiency: 'intermediate',
    style: 'demanding',
    callStage: 'first-contact',
    difficulty: 'challenge',
    persona: {
      name: 'Declan Hartley',
      role: 'Head of Digital',
      organisation: 'Wingtip Outdoor Supply',
    },
    coachingFocus: ['empathy-deescalation', 'scoping-discovery', 'ownership-next-steps'],
  }),
  makeScenario({
    id: 'escalated-integration-failures',
    title: 'Fourth contact, same failing uploads',
    summary:
      'A senior integration engineer calls for the fourth time about uploads that keep failing, and wants one person to own the case.',
    tags: ['integration', 'escalated', 'repeat contact', 'expert customer'],
    estimatedMinutes: 15,
    issueType: 'feature-not-working',
    impact: 'high',
    startingTemperature: 'angry',
    proficiency: 'expert',
    style: 'non-native',
    callStage: 'escalated',
    difficulty: 'challenge',
    persona: {
      name: 'Mateus Carvalho',
      role: 'Senior Integration Engineer',
      organisation: 'Litware Freight',
    },
    coachingFocus: ['clarity', 'ownership-next-steps', 'closing'],
  }),
  makeScenario({
    id: 'invoice-shock-and-cancellation-threat',
    title: 'A much bigger invoice than expected',
    summary:
      'An operations director calls about an invoice far above what she expected, and wants to know why it changed.',
    tags: ['billing', 'invoice', 'de-escalation', 'retention risk'],
    estimatedMinutes: 14,
    issueType: 'billing-licence',
    impact: 'high',
    startingTemperature: 'frustrated',
    proficiency: 'intermediate',
    style: 'vague',
    callStage: 'first-contact',
    difficulty: 'challenge',
    persona: {
      name: 'Nomvula Dlamini',
      role: 'Operations Director',
      organisation: 'Proseware Field Services',
    },
    coachingFocus: ['empathy-deescalation', 'ownership-next-steps', 'scoping-discovery'],
  }),
  makeScenario({
    id: 'confident-but-incorrect-diagnosis',
    title: 'A firm diagnosis and a demand to upgrade',
    summary:
      'A senior platform engineer says responses have slowed, that he has already checked everything, and that the service tier must be upgraded now.',
    tags: ['slow performance', 'expert customer', 'pushback', 'evidence'],
    estimatedMinutes: 12,
    issueType: 'slow-performance',
    impact: 'high',
    startingTemperature: 'frustrated',
    proficiency: 'expert',
    style: 'terse',
    callStage: 'first-contact',
    difficulty: 'challenge',
    persona: {
      name: 'Seun Adeyemi',
      role: 'Senior Platform Engineer',
      organisation: 'Lucerne Tickets',
    },
    coachingFocus: ['scoping-discovery', 'empathy-deescalation', 'clarity'],
  }),
];

/**
 * A made-up catalogue of `count` scenarios for property-style tests. Which family, difficulty and
 * impact each one gets is decided by the seed alone, so a failing case can be replayed.
 */
export function syntheticCatalogue(count: number, seed: number): PublicScenarioDTO[] {
  const random = seeded(seed);
  return Array.from({ length: count }, (_, index) =>
    makeScenario({
      id: `mission-${String(index).padStart(3, '0')}`,
      title: `Mission ${index}`,
      issueType: random.pick(ISSUE_TYPES),
      difficulty: random.pick(DIFFICULTIES),
      impact: random.pick(IMPACTS),
      startingTemperature: random.pick(START_TEMPERATURES),
      callStage: random.pick(CALL_STAGES),
      estimatedMinutes: random.int(6, 15),
    }),
  );
}

// ------------------------------------------------------------------------------------------
// History

let counter = 0;

/** A finished, full call for the scenario unless told otherwise. */
export function session(
  scenarioId: string,
  overrides: Partial<SessionSummaryDTO> = {},
): SessionSummaryDTO {
  counter += 1;
  return makeSummary({ id: `${scenarioId}#${counter}`, scenarioId, ...overrides });
}

export const fullCall = (scenarioId: string, overallScore: number | null = 4): SessionSummaryDTO =>
  session(scenarioId, { status: 'completed', completion: 'completed', overallScore });

export const endedEarlyCall = (scenarioId: string): SessionSummaryDTO =>
  session(scenarioId, { status: 'completed', completion: 'ended-early', overallScore: 2.4 });

export const runningCall = (scenarioId: string): SessionSummaryDTO =>
  session(scenarioId, {
    status: 'active',
    completion: null,
    endedAt: null,
    durationSeconds: null,
    overallScore: null,
    dimensionScores: null,
  });

export const sampleCall = (scenarioId: string, overallScore = 5): SessionSummaryDTO =>
  session(scenarioId, { isSample: true, overallScore });
