import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { TurnAnalysis } from './memory.ts';
import type { Effect } from './state.ts';
import type { EngineRuntime } from './types.ts';

// What the customer expects of the engineer, read from the scenario's own words (`customerExpectation`
// and `desiredOutcome`). The authored text is free-form, so only the expectations that can be seen
// in what an engineer says are read out of it:
//
//   ownership     someone takes the case on
//   next-update   a time for when the customer will hear back
//   explanation   what is going on, in plain words
//   interim       a way to carry on in the meantime
//
// An expectation that is met moves the customer a little (the general rules for ownership and
// next steps already reward those two, so they are not rewarded twice). One that is still ignored
// after eight replies costs a little once, and until then the customer asks for it themselves
// (see plan.ts).

export type ExpectationId = 'ownership' | 'next-update' | 'explanation' | 'interim';

const MARKERS: Record<ExpectationId, RegExp> = {
  ownership:
    /\b(?:takes? (?:charge|the case on|ownership|it on)|(?:a |an |the )?named (?:engineer|owner)|an owner|owns? the case|who (?:owns|will (?:own|arrange|look after))|stays? with (?:the|her|his|their) case|clear ownership)\b/i,
  'next-update':
    /\b(?:next update|when (?:she|he|they|[a-z]+) (?:will|would|can|should) (?:next )?hear|hears? back|hear (?:back|from)|says when|say when|by when|(?:a |the )?(?:specific )?times? (?:for|of|to)|dates? (?:he|she|they) can hold|follow-?up|commits? to (?:specific )?(?:times|actions)|roughly when|and when)\b/i,
  explanation:
    /\b(?:expla[in]\w*|plain words|what is going on|what (?:might be|is) going on|what happened|what (?:the|this) [a-z]+ (?:means|is for)|says plainly|straight (?:answers?|explanation)|understands?)\b/i,
  interim:
    /\b(?:in the meantime|way to (?:protect|keep|get)|something simple (?:he|she|they) can try|plan for anything that cannot wait|keep working|work ?around|tell (?:her|his|their) (?:users|team|managers))\b/i,
};

const cache = new WeakMap<EffectiveScenario, ReadonlySet<ExpectationId>>();

/** What this scenario's customer expects, as far as the authored text says. */
export function expectationsOf(scenario: EffectiveScenario): ReadonlySet<ExpectationId> {
  let found = cache.get(scenario);
  if (!found) {
    const text = `${scenario.customerExpectation} ${scenario.desiredOutcome}`;
    found = new Set(
      (Object.keys(MARKERS) as ExpectationId[]).filter((id) => MARKERS[id].test(text)),
    );
    cache.set(scenario, found);
  }
  return found;
}

/** How many replies the engineer has before an ignored expectation counts against them. */
export const EXPECTATION_PATIENCE = 8;

const done = (list: readonly string[], id: string) => list.includes(id);

function isMet(
  id: ExpectationId,
  runtime: Pick<EngineRuntime, 'customer'>,
  c: TurnClassification,
  analysis: Pick<TurnAnalysis, 'explains' | 'offersInterim' | 'commitment'>,
): boolean {
  switch (id) {
    case 'ownership':
      return runtime.customer.ownershipStated || c.ownership === 'clear';
    case 'next-update':
      return (
        runtime.customer.nextStepsStated ||
        (c.nextSteps === 'specific' && c.promise !== 'unverified') ||
        Boolean(analysis.commitment?.due && analysis.commitment.supported)
      );
    case 'explanation':
      return analysis.explains && c.jargon !== 'unexplained';
    case 'interim':
      return analysis.offersInterim;
  }
}

export interface ExpectationEffects {
  effects: Effect[];
  /** Ids to remember in `runtime.stageMet`: `expect:<id>` once met, `expect-missed:<id>` once charged. */
  met: string[];
}

export function expectationEffects(args: {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  c: TurnClassification;
  analysis: TurnAnalysis;
  /** The engineer's turn number, not counting a first exchange that was only a greeting. */
  effectiveTurn: number;
}): ExpectationEffects {
  const { scenario, runtime, c, analysis, effectiveTurn } = args;
  const effects: Effect[] = [];
  const met: string[] = [];
  for (const id of expectationsOf(scenario)) {
    const key = `expect:${id}`;
    if (done(runtime.stageMet, key)) continue;
    if (isMet(id, runtime, c, analysis)) {
      met.push(key);
      // Ownership and a next update are rewarded by the general rules; these two are not.
      if (id === 'explanation') {
        effects.push({
          category: 'clarity',
          reason: 'Explained in plain words what was going on, as the customer hoped',
          temperature: -3,
          trust: 3,
          clarification: 6,
        });
      } else if (id === 'interim') {
        effects.push({
          category: 'next-steps',
          reason: 'Offered a way to carry on in the meantime, as the customer hoped',
          temperature: -3,
          trust: 3,
          confidence: 4,
        });
      }
    } else if (
      (id === 'ownership' || id === 'next-update') &&
      effectiveTurn >= EXPECTATION_PATIENCE &&
      !done(runtime.stageMet, `expect-missed:${id}`)
    ) {
      met.push(`expect-missed:${id}`);
      effects.push({
        category: id === 'ownership' ? 'ownership' : 'next-steps',
        reason:
          id === 'ownership'
            ? 'Still no one had taken the case on, which was what the customer expected'
            : 'Still no time had been given for the next update, which was what the customer expected',
        temperature: 2,
        patience: -3,
      });
    }
  }
  return { effects, met };
}

/** Does the customer expect this of the engineer? */
export function expects(scenario: EffectiveScenario, id: ExpectationId): boolean {
  return expectationsOf(scenario).has(id);
}
