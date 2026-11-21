import type { CareExpectations } from '#shared/domain/scenario.ts';
import type { CareBehaviour } from '#shared/domain/vocab.ts';
import type { BehaviourId, Finding } from './types.ts';

// Linking what a scenario says a good call looks like (`careExpectations`, written per principal as
// observable behaviour) to the behaviours the evaluator reads from the call. The link only says which
// behaviours an expectation is about. Whether the call met it is decided by what the call showed, so
// the wording of an expectation can never earn or lose credit by itself.

export interface ExpectationLink {
  principle: CareBehaviour;
  text: string;
  /** The behaviours this expectation is about; never empty. */
  behaviours: BehaviourId[];
  status: 'met' | 'partly' | 'not-met';
}

type Topic = [RegExp, BehaviourId[]];

const TOPICS: Record<CareBehaviour, Topic[]> = {
  communicate: [
    [/\b(?:introduc\w*|name and team|greet\w*)\b/i, ['communicate.introduction']],
    [
      /\b(?:confirm\w* (?:who|the case|case|identity|name|customer|why)|case number|which case|verif\w*)\b/i,
      ['communicate.context-confirmed'],
    ],
    [
      /\b(?:plain|everyday|jargon|simple words|simple terms|without (?:technical|unexplained))\b/i,
      ['communicate.plain-language'],
    ],
    [
      /\b(?:what is known|what happens next)\b/i,
      ['communicate.plain-language', 'communicate.summary'],
    ],
    [
      /\b(?:summar\w*|recap\w*|plays? back|reads? back|repeats? back|sums? up|plan back|(?:confirms?|repeats?|goes over) the plan)\b/i,
      ['communicate.summary'],
    ],
    [
      /\b(?:follow(?:ed)? the explanation|understand\w*|understood|agree\w*|happy to close|confirm\w* (?:the fix|resolution|agreement))\b/i,
      ['communicate.confirms-understanding'],
    ],
    [/\b(?:listen\w*|reflect\w*)\b/i, ['communicate.active-listening']],
    [
      /\b(?:one (?:\w+ )?(?:question|thing|step)s? at a time|at a time|short steps|pac(?:e|ing))\b/i,
      ['communicate.pacing'],
    ],
    [
      /\b(?:clos\w* (?:the call|politely)|thank\w*|goodbye|professional close)\b/i,
      ['communicate.professional-close'],
    ],
    [
      /\b(?:(?:clear|focused|open|short|simple|specific) questions?|short and specific|questions? short|lecture)\b/i,
      ['communicate.clear-questions'],
    ],
  ],
  accountable: [
    [
      /\b(?:own\w*|takes? (?:the )?(?:case|problem|issue|responsibility)|point of contact)\b/i,
      ['accountable.ownership'],
    ],
    [
      /\b(?:route to|hand\w* (?:her |him |them )?off|without handing)\b/i,
      ['accountable.ownership', 'accountable.named-owner'],
    ],
    [/\b(?:named owner|by name|who owns)\b/i, ['accountable.named-owner']],
    [
      /\b(?:updates?|calls? back|next contact|follow[- ]?up|cadence|hear next|when .{0,20}hear)\b/i,
      ['accountable.update-time'],
    ],
    [
      /\b(?:promis\w*|guarantee\w*)\b/i,
      ['accountable.no-unsupported-promise', 'accountable.expectations'],
    ],
    [
      /\b(?:refuses? to (?:confirm|promise|guess)|not been checked)\b/i,
      ['accountable.no-unsupported-promise', 'accountable.expectations'],
    ],
    [/\b(?:expect\w*|realistic\w*|honest\w*)\b/i, ['accountable.expectations']],
    [/\b(?:progress|status|what has (?:happened|been done))\b/i, ['accountable.progress-update']],
    [/\b(?:track\w*|agreed|commitments?|who does what)\b/i, ['accountable.tracks-commitments']],
    [
      /\b(?:next (?:step|action)s?|what will be (?:recorded|done)|who (?:she|he|they|to) (?:should )?contact|should do (?:if|when))\b/i,
      ['accountable.next-action'],
    ],
    [/\bblam\w*\b/i, ['accountable.no-blame']],
  ],
  resourceful: [
    [
      /\b(?:scop\w*|affected|how many|who else|anyone else|anybody else|which (?:users|people|devices|sites)|have in common|asks? for (?:\w+ ){0,3}(?:examples?|evidence|logs?|screenshots?)|example (?:messages|emails|errors?)|recipients)\b/i,
      ['resourceful.scoping'],
    ],
    [
      /\b(?:impact|business|deadline|urgen\w*|priority|cost\w*|at stake|stakes|before then|payment run|presentation)\b/i,
      ['resourceful.impact'],
    ],
    [
      /\b(?:environment|devices?|browsers?|clients?|versions?|tenant|licen[cs]\w*|network|apps?|accounts?)\b/i,
      ['resourceful.environment'],
    ],
    [/\b(?:chang\w*|deploy\w*|recent\w*|rolled out)\b/i, ['resourceful.recent-changes']],
    [
      /\b(?:tried|attempt\w*|troubleshoot\w*|already (?:tried|done|attempted|checked)|workarounds?)\b/i,
      ['resourceful.prior-troubleshooting'],
    ],
    [
      /\b(?:escalat\w*|specialists?|engineers?|senior|collaborat\w*|bring\w* in|loop\w* in|who (?:looks after|owns|built|manages|handles|is responsible)|right (?:person|team|place)|who could help|points? (?:her|him|them) to)\b/i,
      ['resourceful.escalation'],
    ],
    [
      /\b(?:history|case notes|previous\w*|earlier|prior|already (?:know|told|said)|uses? what (?:she|he|they) (?:says?|said|told)|builds? on what|what the case (?:already )?says)\b/i,
      ['resourceful.known-evidence'],
    ],
    [/\b(?:repeat\w*|again)\b/i, ['resourceful.no-repeat-questions']],
    [
      /\b(?:logical|sequence|before (?:suggesting|offering|trying)|verif\w*|in common|another (?:way|route)|keep (?:it|the \w+) moving|checking when|suggests? (?:a )?(?:concrete|simple) way)\b/i,
      ['resourceful.logical-investigation'],
    ],
  ],
  empathetic: [
    [
      /\b(?:acknowledg\w*|recogni[sz]\w*)\b[^.]*\b(?:impact|deadline|business|waiting|blocked|stakes|urgen\w*|priority|launch|event|patients|customers|appointments)\b/i,
      ['empathetic.business-impact'],
    ],
    [
      /\b(?:names? the (?:pressure|stakes|worry|impact|payment|deadline|urgency)|what is at stake|pressure of)\b/i,
      ['empathetic.business-impact'],
    ],
    [
      /\b(?:acknowledg\w*|empath\w*|sorry|apolog\w*|concern\w*|frustrat\w*|feel\w*|worr\w*|earlier experience|wait|history|chas\w*)\b/i,
      ['empathetic.concern'],
    ],
    [/\b(?:calm\w*|de-?escalat\w*|reassur\w*|settl\w*)\b/i, ['empathetic.de-escalation']],
    [
      /\b(?:patien\w*|lets? (?:her|him|them) finish|slows? down|goes? quiet|notices? when)\b/i,
      ['empathetic.adapts'],
    ],
    [/\b(?:dismiss\w*|play\w* down)\b/i, ['empathetic.no-dismissive']],
    [
      /\b(?:anything else|remaining concerns?|still worr\w*|no worries left)\b/i,
      ['empathetic.remaining-concerns'],
    ],
    [/\b(?:tone|respect\w*|polite\w*)\b/i, ['empathetic.respectful-tone']],
  ],
};

/** One group of behaviours per topic the expectation mentions: a topic is covered by any of its behaviours. */
export function behaviourGroups(principle: CareBehaviour, text: string): BehaviourId[][] {
  const groups: BehaviourId[][] = [];
  for (const [pattern, behaviours] of TOPICS[principle]) {
    if (pattern.test(text)) groups.push([...behaviours]);
  }
  return groups;
}

export const behavioursForExpectation = (principle: CareBehaviour, text: string): BehaviourId[] => [
  ...new Set(behaviourGroups(principle, text).flat()),
];

/**
 * Whether the call met each expectation the scenario wrote down. An expectation is met when every
 * topic it mentions was shown, partly met when some were, and not met when none were. One that no
 * behaviour can be read for is left out rather than guessed at, and so is a topic whose behaviours
 * the call gave nothing to judge.
 */
export function linkExpectations(
  expectations: CareExpectations,
  findings: ReadonlyMap<BehaviourId, Finding>,
): ExpectationLink[] {
  const out: ExpectationLink[] = [];
  for (const principle of ['communicate', 'accountable', 'resourceful', 'empathetic'] as const) {
    for (const text of expectations[principle] ?? []) {
      const groups = behaviourGroups(principle, text)
        .map((group) => group.filter((id) => findings.has(id)))
        .filter((group) => group.length > 0);
      if (groups.length === 0) continue;
      const covered = groups.filter((group) =>
        group.some((id) => (findings.get(id) as Finding).status === 'shown'),
      ).length;
      const partlyCovered = groups.some((group) =>
        group.some((id) => (findings.get(id) as Finding).status === 'partly'),
      );
      out.push({
        principle,
        text,
        behaviours: [...new Set(groups.flat())],
        status:
          covered === groups.length ? 'met' : covered > 0 || partlyCovered ? 'partly' : 'not-met',
      });
    }
  }
  return out;
}
