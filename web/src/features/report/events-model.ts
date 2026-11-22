import type {
  CareBehaviourResult,
  CoachingReport,
  JourneyPoint,
  Milestone,
  MilestoneId,
} from '#shared/domain/report.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { CURVEBALL_STATUS_WORDS, plainUnexpectedTurn } from './copy.ts';
import { isVerifiedQuote, type TurnLookup } from './evidence-model.ts';
import { changeText } from './journey-model.ts';

// The call as a sequence of moments, for the timeline: what the report holds about the greeting, the
// issue, the impact, each fact found, each change in the customer's mood, an unexpected turn, the
// summary, ownership, next steps and the close. Built only from what the report already carries
// (milestones, CARE behaviours with evidence, the discovery results, the temperature points and the
// unexpected turn), and only from evidence the transcript confirms: a moment that was not seen is a
// quiet "Not seen", never a made-up quote.

export const EVENT_KINDS = [
  'greeting',
  'issue',
  'impact',
  'discovery',
  'tension',
  'curveball',
  'summary',
  'ownership',
  'next-steps',
  'closing',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * `seen`: the report points at a real turn (and its quote is in that turn). `not-seen`: the call
 * showed no such moment. `unverified`: the report claims a moment the transcript does not confirm,
 * so it is not shown as evidence.
 */
export type EventState = 'seen' | 'not-seen' | 'unverified';

export interface CallEvent {
  id: string;
  kind: EventKind;
  /** The short name on the marker: "Greeting", "Tension eased". */
  label: string;
  /** One more line for the panel: the fact, or how the mood changed. */
  detail: string | null;
  state: EventState;
  /** The turn that shows it. Null unless the event was seen. */
  turnIndex: number | null;
  /** The trainee's words that show it, confirmed against the turn. Null when the turn alone shows it. */
  quote: string | null;
  /** For a change of mood: which way the customer's tension went. */
  trend: 'up' | 'down' | 'flat' | null;
}

type StandardKind = Exclude<EventKind, 'tension' | 'discovery' | 'curveball'>;

export const EVENT_LABELS: Record<StandardKind | 'curveball', string> = {
  greeting: 'Greeting',
  issue: 'Issue established',
  impact: 'Impact established',
  curveball: 'Unexpected turn',
  summary: 'Summary',
  ownership: 'Ownership',
  'next-steps': 'Next steps',
  closing: 'Closing',
};

interface Claim {
  turnIndex: number | null;
  quote: string | null;
}

interface Placement {
  state: EventState;
  turnIndex: number | null;
  quote: string | null;
}

const NOT_SEEN: Placement = { state: 'not-seen', turnIndex: null, quote: null };
const UNVERIFIED: Placement = { state: 'unverified', turnIndex: null, quote: null };

/** Where a claim lands once the transcript has been asked. */
function place(turns: TurnLookup, claim: Claim): Placement {
  if (claim.turnIndex === null) return NOT_SEEN;
  if (!turns.has(claim.turnIndex)) return UNVERIFIED;
  if (!claim.quote) return { state: 'seen', turnIndex: claim.turnIndex, quote: null };
  return isVerifiedQuote(turns, claim.turnIndex, claim.quote)
    ? { state: 'seen', turnIndex: claim.turnIndex, quote: claim.quote }
    : UNVERIFIED;
}

/** The first claim the transcript confirms. A claim that does not hold up makes the event unverified, not seen. */
function firstConfirmed(turns: TurnLookup, claims: readonly Claim[]): Placement {
  let doubted = false;
  for (const claim of claims) {
    const placed = place(turns, claim);
    if (placed.state === 'seen') return placed;
    if (placed.state === 'unverified') doubted = true;
  }
  return doubted ? UNVERIFIED : NOT_SEEN;
}

const RANK = Object.fromEntries(EVENT_KINDS.map((kind, index) => [kind, index])) as Record<
  EventKind,
  number
>;

/** An event and where it usually comes in a call, which decides where a quiet one is placed. */
interface Draft {
  event: CallEvent;
  usual: number;
}

function tensionLabel(point: JourneyPoint): string {
  if (point.delta < 0) return 'Tension eased';
  if (point.delta > 0) return 'Tension rose';
  return 'Turning point';
}

/**
 * The moments of the call, in call order. A moment the report has no way to know about (an older
 * report with no CARE or milestones) is left out; one it could have seen and did not is a quiet
 * "Not seen", placed where it would usually come.
 */
export function buildCallEvents(report: CoachingReport, turns: TurnLookup): CallEvent[] {
  const milestones = report.journey.milestones ?? null;
  const care = report.care ?? null;
  const known = milestones !== null || care !== null;

  const milestone = (id: MilestoneId): Milestone | null =>
    milestones?.find((m) => m.id === id) ?? null;
  const milestoneClaims = (id: MilestoneId): Claim[] => {
    const found = milestone(id);
    return found && found.status === 'reached'
      ? [{ turnIndex: found.turnIndex, quote: found.quote }]
      : [];
  };
  const behaviour = (id: string): CareBehaviourResult | null =>
    care?.flatMap((principle) => principle.behaviours).find((b) => b.id === id) ?? null;
  const behaviourClaims = (id: string, statuses: CareBehaviourResult['status'][]): Claim[] => {
    const found = behaviour(id);
    return found && statuses.includes(found.status)
      ? found.evidence.map((e) => ({ turnIndex: e.turnIndex, quote: e.quote }))
      : [];
  };
  const shownOrPartly = (id: string): Claim[] => [
    ...behaviourClaims(id, ['shown']),
    ...behaviourClaims(id, ['partly']),
  ];

  const drafts: Draft[] = [];
  const add = (
    id: string,
    kind: EventKind,
    label: string,
    detail: string | null,
    placed: Placement,
    usual: number,
    trend: CallEvent['trend'] = null,
  ) => {
    drafts.push({ event: { id, kind, label, detail, ...placed, trend }, usual });
  };
  // The moments every call is expected to have, in their usual order.
  const standard = (kind: StandardKind, supported: boolean, claims: Claim[], usual: number) => {
    if (supported) add(kind, kind, EVENT_LABELS[kind], null, firstConfirmed(turns, claims), usual);
  };

  standard(
    'greeting',
    known,
    [
      ...milestoneClaims('greeting'),
      ...behaviourClaims('communicate.greeting', ['shown']),
      ...shownOrPartly('communicate.introduction'),
    ],
    0,
  );
  standard('issue', care !== null, shownOrPartly('communicate.context-confirmed'), 1);
  standard(
    'impact',
    known,
    [
      ...milestoneClaims('impact'),
      ...shownOrPartly('empathetic.business-impact'),
      ...behaviourClaims('resourceful.impact', ['shown']),
    ],
    2,
  );

  // One moment for each fact the call found. With none, discovery is one moment, or a quiet one.
  const found = report.discovery.results.filter(
    (result) => result.status !== 'missed' && result.revealedAtTurn !== null,
  );
  found.forEach((result, order) => {
    const claim = { turnIndex: result.revealedAtTurn, quote: result.revealingQuestion };
    add(
      `discovery-${result.factId}`,
      'discovery',
      result.status === 'partial' ? 'Fact partly found' : 'Fact found',
      result.label,
      firstConfirmed(turns, [claim]),
      3 + order / 100,
    );
  });
  if (found.length === 0 && (milestones !== null || report.discovery.total > 0)) {
    const placed = firstConfirmed(turns, milestoneClaims('discovery'));
    add('discovery', 'discovery', 'Discovery', null, placed, 3);
  }

  standard('summary', care !== null, shownOrPartly('communicate.summary'), 6);
  standard(
    'ownership',
    known,
    [
      ...milestoneClaims('ownership'),
      ...shownOrPartly('accountable.ownership'),
      ...shownOrPartly('accountable.named-owner'),
    ],
    7,
  );
  standard(
    'next-steps',
    care !== null,
    [
      ...behaviourClaims('accountable.update-time', ['shown']),
      ...behaviourClaims('accountable.next-action', ['shown']),
      ...behaviourClaims('accountable.update-time', ['partly']),
      ...behaviourClaims('accountable.next-action', ['partly']),
    ],
    8,
  );
  standard(
    'closing',
    known,
    [...milestoneClaims('closure'), ...shownOrPartly('communicate.professional-close')],
    9,
  );

  // What happened to the customer, wherever it happened. These have a turn or are left out.
  const { points } = report.journey;
  points.forEach((point, index) => {
    if (point.kind !== 'turning-point') return;
    const previous = index > 0 ? (points[index - 1] ?? null) : null;
    const detail = [
      changeText(previous, point),
      point.reason ? plainUnexpectedTurn(point.reason) : null,
    ]
      .filter(Boolean)
      .join('. ');
    const placed = firstConfirmed(turns, [{ turnIndex: point.turnIndex, quote: point.quote }]);
    if (placed.state === 'seen') {
      const trend = point.delta > 0 ? 'up' : point.delta < 0 ? 'down' : 'flat';
      add(
        `tension-${point.turnIndex}`,
        'tension',
        tensionLabel(point),
        detail,
        placed,
        point.turnIndex,
        trend,
      );
    }
  });

  const unexpected = report.curveball;
  const unexpectedPoint = points.find((point) => point.kind === 'curveball') ?? null;
  if (unexpected) {
    const what = CURVEBALL_LABELS[unexpected.type]?.label ?? EVENT_LABELS.curveball;
    const placed = firstConfirmed(turns, [{ turnIndex: unexpected.firedAtTurn, quote: null }]);
    if (placed.state === 'seen') {
      const detail = `${what}. ${CURVEBALL_STATUS_WORDS[unexpected.status]}.`;
      add('curveball', 'curveball', EVENT_LABELS.curveball, detail, placed, unexpected.firedAtTurn);
    }
  } else if (unexpectedPoint) {
    const placed = firstConfirmed(turns, [
      { turnIndex: unexpectedPoint.turnIndex, quote: unexpectedPoint.quote },
    ]);
    if (placed.state === 'seen') {
      const detail = unexpectedPoint.reason ? plainUnexpectedTurn(unexpectedPoint.reason) : null;
      add(
        'curveball',
        'curveball',
        EVENT_LABELS.curveball,
        detail,
        placed,
        unexpectedPoint.turnIndex,
      );
    }
  }

  return inCallOrder(drafts);
}

/**
 * Moments that were seen go in the order of the call. A moment that was not seen has no turn, so it
 * goes straight after the last moment before it, in the usual order of a call, that was seen: where
 * the call would normally have shown it.
 */
function inCallOrder(drafts: readonly Draft[]): CallEvent[] {
  const seen = drafts
    .filter(({ event }) => event.state === 'seen')
    .sort(
      (a, b) =>
        (a.event.turnIndex ?? 0) - (b.event.turnIndex ?? 0) ||
        RANK[a.event.kind] - RANK[b.event.kind] ||
        a.usual - b.usual,
    );
  const usualOrder = drafts.filter(
    ({ event }) => event.kind !== 'tension' && event.kind !== 'curveball',
  );
  usualOrder.sort((a, b) => a.usual - b.usual);

  const waitingFor = new Map<string | null, CallEvent[]>();
  let anchor: string | null = null;
  for (const { event } of usualOrder) {
    if (event.state === 'seen') anchor = event.id;
    else waitingFor.set(anchor, [...(waitingFor.get(anchor) ?? []), event]);
  }

  return [
    ...(waitingFor.get(null) ?? []),
    ...seen.flatMap(({ event }) => [event, ...(waitingFor.get(event.id) ?? [])]),
  ];
}

/**
 * The seen moment nearest to a turn: the one on it, or the closest before or after. When two are
 * equally close the earlier wins. Null when no moment was seen.
 */
export function nearestEvent(events: readonly CallEvent[], turnIndex: number): CallEvent | null {
  let best: CallEvent | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const event of events) {
    if (event.state !== 'seen' || event.turnIndex === null) continue;
    const distance = Math.abs(event.turnIndex - turnIndex);
    if (distance < bestDistance) {
      best = event;
      bestDistance = distance;
    }
  }
  return best;
}
