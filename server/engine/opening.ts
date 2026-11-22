import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { TimeOfDay } from '#shared/domain/config.ts';
import { pick, rngFor, type Rng } from './rng.ts';
import { expandContractions, joinSentences } from './textutil.ts';

// The customer's first message (turn 1). It never dumps the problem.
//
//   first contact   a short greeting that fits the time of day, the customer's temperature and
//                   style and the product ("Good morning. Is this Microsoft support?"). The
//                   customer then waits; once the engineer has answered, they say why they are
//                   calling (see plan.ts). A customer who is anxious about something urgent may
//                   say in one line what is at stake.
//   other stages    a call back opens with its purpose ("Hi. I'm following up on a case I raised
//                   yesterday..."), taken from the scenario's stage frame, in one to three
//                   sentences. It says only what the frame says, which never includes a hidden fact.
//
// The text is composed deterministically (the same in demo and live mode), so a call can always
// start, and the opening can never leak a hidden fact.

const TIME_GREETING: Record<TimeOfDay, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
};

export interface OpeningPlan {
  text: string;
  /** The opening already said what is at stake, so the reason for the call does not repeat it. */
  voicedImpact: boolean;
  /** The opening already gave the purpose of the call, so there is no separate reason to give. */
  givesPurpose: boolean;
}

/** The support channel a customer names when they check they have the right number. */
function channelOf(scenario: EffectiveScenario): string {
  const product = scenario.product?.id;
  if (product === 'azure') return 'Azure support';
  if (product === 'dynamics-365') return 'Dynamics 365 support';
  return 'Microsoft support';
}

/** What is at stake is serious enough that the customer blurts it out before anything else. */
export function urgentAtOpening(scenario: EffectiveScenario): boolean {
  const { impact, startingTemperature } = scenario.config;
  return impact === 'high' || (startingTemperature === 'anxious' && impact === 'medium');
}

/** The impact line belongs in the reason for the call when the situation is pressing. */
export function urgencyWarrantsImpact(scenario: EffectiveScenario, urgency: number): boolean {
  const { impact, startingTemperature } = scenario.config;
  return (
    impact === 'high' || urgency >= 70 || (impact === 'medium' && startingTemperature !== 'calm')
  );
}

const EXTRA_BY_STYLE: Partial<Record<EffectiveScenario['config']['style'], string[]>> = {
  talkative: [
    "I hope I've got the right number.",
    'Sorry to bother you, I hope this is the right place.',
  ],
  vague: ["I think I've got the right number."],
  demanding: ['I need someone who can deal with this today.'],
};
const EXTRA_BY_TEMPERATURE: Partial<
  Record<EffectiveScenario['config']['startingTemperature'], string[]>
> = {
  anxious: ['I hope you can help me.'],
  frustrated: ["I need some help with something that isn't working."],
  angry: ['I need to speak to someone who can actually help.'],
};

function firstContactGreeting(scenario: EffectiveScenario, rng: Rng): OpeningPlan {
  const cfg = scenario.config;
  const channel = channelOf(scenario);
  const time = `${TIME_GREETING[cfg.timeOfDay]}.`;
  const urgent = urgentAtOpening(scenario);

  const salute =
    cfg.style === 'terse'
      ? 'Hello.'
      : cfg.startingTemperature === 'anxious'
        ? 'Hello,'
        : cfg.startingTemperature === 'frustrated'
          ? 'Hi.'
          : cfg.startingTemperature === 'angry'
            ? 'Hello.'
            : time;
  const ask =
    cfg.startingTemperature === 'anxious' && cfg.style !== 'terse'
      ? `is this the ${channel} team?`
      : `Is this ${channel}?`;
  const parts = [`${salute} ${ask}`];

  let extra: string | null = null;
  if (urgent) extra = scenario.impactVariant.summary;
  else if (cfg.style !== 'terse') {
    const options = EXTRA_BY_STYLE[cfg.style] ?? EXTRA_BY_TEMPERATURE[cfg.startingTemperature];
    if (options) extra = pick(rng, options);
    else if (cfg.proficiency === 'novice' && cfg.startingTemperature === 'calm') {
      extra = "Sorry, I'm not very technical.";
    }
  }
  if (extra) parts.push(extra);

  const text = joinSentences(parts);
  return {
    text: cfg.style === 'non-native' ? expandContractions(text) : text,
    voicedImpact: urgent,
    givesPurpose: false,
  };
}

const STAGE_SALUTE: Record<
  EffectiveScenario['config']['callStage'],
  (time: string, temperature: EffectiveScenario['config']['startingTemperature']) => string
> = {
  'first-contact': (time) => time,
  'follow-up': (_time, temperature) => (temperature === 'frustrated' ? 'Hi.' : 'Hello.'),
  escalated: (time) => time,
  closure: () => 'Hello.',
};

function stageOpening(scenario: EffectiveScenario): OpeningPlan {
  const cfg = scenario.config;
  const salute =
    cfg.style === 'terse'
      ? 'Hello.'
      : STAGE_SALUTE[cfg.callStage](`${TIME_GREETING[cfg.timeOfDay]}.`, cfg.startingTemperature);
  // The purpose of the call, in one to three sentences in all.
  const purpose = scenario.stageFrame.opening
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, cfg.style === 'terse' ? 1 : 2)
    .join(' ');
  const text = joinSentences([salute, purpose]);
  return {
    text: cfg.style === 'non-native' ? expandContractions(text) : text,
    voicedImpact: false,
    givesPurpose: true,
  };
}

/** What the customer says first, and what that already covered. Deterministic for a scenario and seed. */
export function openingPlan(scenario: EffectiveScenario): OpeningPlan {
  const rng = rngFor(scenario.config.seed, 0);
  const stageHasPurpose =
    scenario.config.callStage !== 'first-contact' && scenario.stageFrame.opening;
  return stageHasPurpose ? stageOpening(scenario) : firstContactGreeting(scenario, rng);
}
