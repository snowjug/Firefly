import { z } from 'zod';
import { DISCOVERY_INTENTS } from './vocab.ts';

// What the trainee did in one turn. Produced either by the rules classifier (demo mode) or by a
// model that must answer in exactly this shape. The state engine and discovery engine consume
// it; neither ever trusts raw model output.

export const TurnClassificationSchema = z.object({
  askedQuestion: z.boolean(),
  discoveryIntents: z.array(z.enum(DISCOVERY_INTENTS)).max(8),
  // Which hidden facts this question addressed. 'full' means it was specific enough to reveal the
  // fact; 'partial' means it was a broad question that may reveal only part of it.
  factTargets: z
    .array(z.object({ id: z.string().max(64), strength: z.enum(['full', 'partial']) }))
    .max(8),
  introduces: z.boolean(), // greets, introduces themselves or offers help
  empathy: z.enum(['none', 'generic', 'specific']),
  acknowledgesImpact: z.boolean(),
  ownership: z.enum(['none', 'vague', 'clear']),
  nextSteps: z.enum(['none', 'vague', 'specific']),
  promise: z.enum(['none', 'realistic', 'unverified']),
  blame: z.boolean(),
  dismissive: z.boolean(),
  jargon: z.enum(['none', 'explained', 'unexplained']),
  clarity: z.enum(['unclear', 'adequate', 'clear']),
  summarises: z.boolean(),
  troubleshooting: z.boolean(), // gives the customer a fix or an instruction to follow
  wrapsUp: z.boolean(),
  confirmsNextContact: z.boolean(),
  asksAnythingElse: z.boolean(),
  correctsAssumption: z.boolean(), // respectfully corrects or reframes a customer's belief
  injectionAttempt: z.boolean(), // asks the customer to break character or reveal instructions/facts
  lowEffort: z.boolean(), // for example "ok" or "yes" with no content
  confidence: z.number().min(0).max(1),
  evidence: z
    .array(z.object({ behaviour: z.string().max(40), quote: z.string().max(240) }))
    .max(12),
});

export type TurnClassification = z.infer<typeof TurnClassificationSchema>;

export function emptyClassification(): TurnClassification {
  return {
    askedQuestion: false,
    discoveryIntents: [],
    factTargets: [],
    introduces: false,
    empathy: 'none',
    acknowledgesImpact: false,
    ownership: 'none',
    nextSteps: 'none',
    promise: 'none',
    blame: false,
    dismissive: false,
    jargon: 'none',
    clarity: 'adequate',
    summarises: false,
    troubleshooting: false,
    wrapsUp: false,
    confirmsNextContact: false,
    asksAnythingElse: false,
    correctsAssumption: false,
    injectionAttempt: false,
    lowEffort: false,
    confidence: 0.5,
    evidence: [],
  };
}
