import { sentences } from '#shared/domain/text.ts';
import { conformCustomerReply } from '../engine/conform.ts';
import { engineerNameOf } from '../engine/memory.ts';
import type { CustomerGenerationContext } from '../engine/pipeline.ts';
import { planReply } from '../engine/plan.ts';
import { overlap, questionWords, wordCount } from '../engine/textutil.ts';
import { factPolicy, type FactPolicy } from '../prompts/facts.ts';
import { replyProblem } from './output.ts';

// What a model's customer reply is checked against, and what can be done when it falls short. The
// checks decide only whether a reply is safe to use: that it keeps to what the customer has earned
// the right to say, does not make up what they do not know, stays a customer and is not the last
// reply said again. They never decide what the customer ought to say: that is the plan's job.
//
// A reply that is turned down is asked for once more. If that one is turned down too, what can be
// said safely is kept, sentence by sentence, rather than failing the call over it.
//
// How a customer sounds is checked too: a customer does not praise the engineer, speak like an
// assistant ("Certainly!", "I understand your concern"), use the engineer's name in every reply,
// recap the whole case again or agree with "Understood." twice running. These are asked for once
// more and then let through, because the pipeline's conformer takes the praise, the stock phrases
// and the name out of whatever is used (see engine/conform.ts).

export type GuardProblem =
  | 'empty'
  | 'too-long'
  | 'role-break'
  | 'leaks'
  | 'invents'
  | 'coaching'
  | 'announces-facts'
  | 'praise'
  | 'assistant-speak'
  | 'repeats-name'
  | 'recaps'
  | 'robotic-ack'
  | 'repeats-previous';

export interface Guards {
  policy: FactPolicy;
  /** Most sentences the plan allows in this reply. */
  maxSentences: number;
  /** What the customer said last, so that a reply which only says it again can be caught. */
  previous: string | null;
  /** The engineer's name, if they gave one, and what the customer said in their last few replies. */
  engineerName: { name: string; recent: string[] } | null;
  /** Everything the customer has said in earlier replies except the greeting that opened the call. */
  earlier: string[];
}

export interface Verdict {
  /** Everything found, so that a failure can be diagnosed. */
  problems: GuardProblem[];
}

export function guardsFor(ctx: CustomerGenerationContext): Guards {
  const said = ctx.history.filter((turn) => turn.role === 'customer').map((turn) => turn.text);
  const name = engineerNameOf(ctx.history, ctx.traineeText);
  return {
    policy: factPolicy(ctx),
    maxSentences: planReply(ctx).maxSentences,
    previous: said.at(-1) ?? null,
    engineerName: name ? { name, recent: said } : null,
    earlier: said.slice(1),
  };
}

const wordsOf = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .match(/[a-z0-9']+/g) ?? [],
  );

/** Whether two replies share more than `threshold` of their words: one is the other said again. */
export function nearlyTheSame(a: string, b: string, threshold = 0.8): boolean {
  const x = wordsOf(a);
  const y = wordsOf(b);
  // A short "Okay." or "Yes, exactly." is naturally said twice.
  if (x.size < 5 || y.size < 5) return false;
  const shared = [...x].filter((word) => y.has(word)).length;
  return shared / (x.size + y.size - shared) > threshold;
}

// Agreement with nothing in it: how a machine says yes. Said twice running, it is robotic.
const BARE_AGREEMENT =
  /^(?:understood|got it|noted|acknowledged|very well|i understand|i see|okay|ok|sure|right|alright|fine)[\s.!]*$/i;

/** Whether the reply is only "Understood." or "Okay.", and nothing else. */
export function isBareAgreement(text: string): boolean {
  return BARE_AGREEMENT.test(text.trim());
}

/**
 * Whether the reply tells the case again: two or more of its sentences say, nearly word for word,
 * something the customer has already said. Putting one thing right is not a recap; going through
 * the whole case again is.
 */
export function recapsTheCase(text: string, earlier: readonly string[]): boolean {
  const said = earlier.flatMap((reply) => sentences(reply)).filter((s) => wordCount(s) >= 5);
  if (said.length === 0) return false;
  const known = said.map((s) => questionWords(s));
  const again = sentences(text)
    .filter((s) => wordCount(s) >= 5)
    .filter((s) => {
      const words = questionWords(s);
      return known.some((before) => overlap(words, before) >= 0.7);
    });
  return again.length >= 2;
}

export function judgeReply(text: string, guards: Guards): Verdict {
  const problems = new Set<GuardProblem>();
  const issue = replyProblem(text);
  if (issue) problems.add(issue);
  const conformed = conformCustomerReply(text, {
    maxSentences: guards.maxSentences,
    ...(guards.engineerName ? { engineerName: guards.engineerName } : {}),
  });
  for (const problem of conformed.problems) {
    if (problem === 'coaching' || problem === 'announces-facts' || problem === 'praise') {
      problems.add(problem);
    } else if (problem === 'ai-politeness') {
      problems.add('assistant-speak');
    } else if (problem === 'repeats-name') {
      problems.add('repeats-name');
    }
  }
  if (conformed.text === '') problems.add('empty');
  if (guards.policy.leaks(text)) problems.add('leaks');
  else if (guards.policy.invents(conformed.text)) problems.add('invents');
  if (guards.previous !== null && nearlyTheSame(conformed.text, guards.previous)) {
    problems.add('repeats-previous');
  }
  if (guards.previous !== null && isBareAgreement(text) && isBareAgreement(guards.previous)) {
    problems.add('robotic-ack');
  }
  if (recapsTheCase(conformed.text, guards.earlier)) problems.add('recaps');
  return { problems: [...problems] };
}

const ALWAYS = new Set<GuardProblem>(['empty', 'too-long', 'role-break', 'leaks', 'invents']);
// Asked for once more, these are let through: the pipeline cuts the advice, the praise, the stock
// phrases, the announcing and the name out of whatever is used, and a customer who is asked the same
// thing again may well say the same thing (or "Okay." twice).
const FIRST_ATTEMPT_ONLY = new Set<GuardProblem>([
  'coaching',
  'announces-facts',
  'praise',
  'assistant-speak',
  'repeats-name',
  'recaps',
  'robotic-ack',
  'repeats-previous',
]);

/** The problems that stop this reply being used. `attempt` is 0 for the first reply, 1 for the retry. */
export function blockingProblems(verdict: Verdict, attempt: 0 | 1): GuardProblem[] {
  return verdict.problems.filter(
    (p) => ALWAYS.has(p) || (attempt === 0 && FIRST_ATTEMPT_ONLY.has(p)),
  );
}

/**
 * Keeps what can be said safely from a reply that was turned down, or null when nothing can. A
 * sentence that gives away an unearned fact, makes up what the customer does not know or breaks
 * character is dropped. When the customer has nothing to answer with but "I don't know" and the
 * reply did not say so, the scenario's own line for it is added.
 */
export function repairReply(text: string, guards: Guards): string | null {
  const { policy, maxSentences } = guards;
  const safe = sentences(text.replace(/\s+/g, ' ').trim()).filter(
    (sentence) =>
      replyProblem(sentence) !== 'role-break' &&
      !policy.leaks(sentence) &&
      !policy.unsupported(sentence),
  );
  let candidate = conformCustomerReply(safe.join(' '), { maxSentences }).text;
  if (policy.mustAdmit() && !policy.admits(candidate)) {
    const admission = policy.admission();
    if (admission === null) return null;
    const kept = sentences(candidate).slice(0, Math.max(0, maxSentences - 1));
    candidate = [...kept, admission].join(' ');
  }
  if (candidate === '') return null;
  return blockingProblems(judgeReply(candidate, guards), 1).length === 0 ? candidate : null;
}
