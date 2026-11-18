import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import { classifyTurnRules } from '../classifier.ts';
import type { CustomerGeneration, CustomerGenerationContext } from '../pipeline.ts';
import { composeCustomerReply } from './customer.ts';

// Demo mode: the rules classifier and the composed customer. No network, no credentials.

export function mockClassifier(scenario: EffectiveScenario) {
  return (text: string, traineeTurnNumber: number): Promise<TurnClassification> =>
    Promise.resolve(classifyTurnRules(text, { scenario, traineeTurnNumber }));
}

export function mockGenerate(ctx: CustomerGenerationContext): Promise<CustomerGeneration> {
  const reply = composeCustomerReply({
    scenario: ctx.scenario,
    runtime: ctx.runtime,
    c: ctx.classification,
    discovery: ctx.discovery,
    curveball: ctx.curveball,
    traineeTurnNumber: ctx.traineeTurnNumber,
    rng: ctx.rng,
  });
  return Promise.resolve({
    text: reply.text,
    source: 'demo',
    bookkeeping: {
      used: reply.used,
      toldIds: reply.toldIds,
      hintIds: reply.hintIds,
      voicedAssumptions: reply.voicedAssumptions,
      timelineAsked: reply.timelineAsked,
      followUpGiven: reply.followUpGiven,
    },
  });
}
