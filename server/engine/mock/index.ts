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
  const reply = composeCustomerReply(ctx);
  return Promise.resolve({
    text: reply.text,
    source: 'demo',
    bookkeeping: {
      used: reply.used,
      toldIds: reply.toldIds,
      hintIds: reply.hintIds,
      revealedIds: reply.revealedIds,
      voicedAssumptions: reply.voicedAssumptions,
      timelineAsked: reply.timelineAsked,
      followUpGiven: reply.followUpGiven,
      pushed: reply.pushed,
      flavoured: reply.flavoured,
      echoed: reply.echoed,
      customerChecks: reply.customerChecks,
      confusedBy: reply.confusedBy,
      limit: reply.limit,
    },
  });
}
