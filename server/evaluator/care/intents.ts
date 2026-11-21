import { detectIntents } from '#server/engine/classifier.ts';
import { isHousekeepingQuestion, prep } from '#server/engine/lexicon.ts';
import { withoutContactTalk } from '#server/engine/textutil.ts';
import type { DiscoveryIntent } from '#shared/domain/vocab.ts';

// The one place the rubric asks the engine's classifier lexicon what a question is about, so a
// change there is a one-line fix here.

const PAST: Record<string, string> = {
  start: 'started',
  stop: 'stopped',
  break: 'broke',
  fail: 'failed',
  begin: 'began',
  happen: 'happened',
};

/**
 * A question with its grammar slips put right, when they do not change what is asked: a missing
 * third-person "s" ("what happen when you sign in") or tense ("before it start"). The topic is the
 * same, so it is looked for in both wordings and nobody loses credit for how they phrased it.
 */
function regularised(lower: string): string {
  return lower
    .replace(/\bwhat (?:is|are) (happen|start|work|fail|stop)\b(?!ing)/g, 'what is $1ing')
    .replace(
      /\b(what|how|when) (happen|start|work|fail|stop|appear|occur|show|look)\b(?!s)/g,
      '$1 $2s',
    )
    .replace(
      /\b(before|after|when|since) (it|this|that) (start|stop|break|fail|begin|happen)\b(?!s|ed)/g,
      (_m, lead: string, subject: string, verb: string) =>
        `${lead} ${subject} ${PAST[verb] ?? verb}`,
    );
}

/** The topics a question sentence asks about, found the way the rules classifier finds them. */
export function sentenceIntents(sentence: string, isQuestion: boolean): DiscoveryIntent[] {
  if (!isQuestion) return [];
  const lower = prep(sentence);
  if (isHousekeepingQuestion(lower)) return [];
  const asked = detectIntents(withoutContactTalk(lower));
  const fixed = regularised(lower);
  if (fixed === lower) return asked;
  return [...new Set([...asked, ...detectIntents(withoutContactTalk(fixed))])];
}

/** A question that keeps the call running (repeat that, hold on, the closing "anything else?"). */
export const isHousekeeping = (sentence: string): boolean => isHousekeepingQuestion(prep(sentence));
