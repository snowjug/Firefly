import type { CoachingReport } from '#shared/domain/report.ts';
import type { CoachedImprovement } from './improvements.ts';
import { discoverySentence, plural, type CallView } from './parts.ts';
import { isStretch, quoted } from './phrasing.ts';
import type { CoachedStrength } from './strengths.ts';
import { BUDGETS, fitWords, wordCount } from './words.ts';

// The overall summary: at most three natural sentences, at most 45 words. What stood out (with a
// short quote), the single biggest opportunity as advice about behaviour, and the discovery result
// in plain words. No generic praise: with nothing to praise, the summary says so. Each sentence has
// a full form and shorter ones; the fullest combination that fits the budget is used, giving up the
// customer's reaction and the quotes before the opportunity, and the opportunity before the count of
// facts found.

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function standout(strength: CoachedStrength | undefined): string[] {
  if (!strength) {
    return [
      'No single moment stood out as a clear strength this time.',
      'No clear strength stood out this time.',
    ];
  }
  const reaction = strength.help ? `, and ${strength.help}` : '';
  return [
    capitalise(`${strength.said}${reaction}.`),
    capitalise(`${strength.said}.`),
    capitalise(`${strength.saidPlain}${reaction}.`),
    capitalise(`${strength.saidPlain}.`),
  ];
}

function opportunity(gap: CoachedImprovement | undefined): string[] {
  if (!gap) return ['No single gap stood out.'];
  if (isStretch(gap.kind)) return [`To stretch further, ${gap.advice}.`];
  const lead = `The biggest opportunity is to ${gap.advice}`;
  const moment = gap.turn !== null && gap.quote ? ` (turn ${gap.turn}, ${quoted(gap.quote)})` : '';
  const turnOnly = gap.turn !== null ? ` (turn ${gap.turn})` : '';
  const effect = gap.harm
    ? `${gap.turn !== null ? ', after which' : '; meanwhile,'} ${gap.harm}`
    : '';
  // Advice often reads "do this: how". Before the opportunity itself is dropped, it is cut to its
  // first part.
  const main = gap.advice.split(':')[0] as string;
  return [
    `${lead}${moment}${effect}.`,
    `${lead}${moment}.`,
    `${lead}${turnOnly}.`,
    `${lead}.`,
    `The biggest opportunity is to ${main}.`,
  ];
}

/** The fullest combination of one variant per sentence that fits, giving up the early sentences' extras first. */
function pick(sentences: string[][], budget: number): string {
  let best: { text: string; loss: number } | null = null;
  const walk = (i: number, parts: string[], loss: number): void => {
    if (i === sentences.length) {
      const text = parts.join(' ');
      if (wordCount(text) <= budget && (best === null || loss < best.loss)) best = { text, loss };
      return;
    }
    (sentences[i] as string[]).forEach((variant, v) =>
      walk(i + 1, [...parts, variant], loss + v * (i + 1)),
    );
  };
  walk(0, [], 0);
  const found = best as { text: string; loss: number } | null;
  return found
    ? found.text
    : fitWords(sentences.map((s) => s[s.length - 1] as string).join(' '), budget);
}

export function buildSummary(args: {
  call: CallView;
  completion: CoachingReport['completion'];
  discovery: CoachingReport['discovery'];
  strengths: CoachedStrength[];
  improvements: CoachedImprovement[];
}): string {
  const { call, completion, discovery, strengths, improvements } = args;
  const n = completion.traineeTurns;
  if (n === 0) return 'No trainee turns were recorded, so there is nothing to evaluate.';

  const strength = strengths[0];
  const gap = improvements[0];
  const budget = BUDGETS.summaryWords;

  if (completion.evidence === 'insufficient') {
    // Too short to name a gap in what was found: only report how far the call got.
    const intro = [
      `The call ended after ${plural(n, 'trainee turn')}, which is too few to score with confidence, so there is no overall score.`,
      `The call ended after ${plural(n, 'trainee turn')}, too few to score with confidence, so there is no overall score.`,
    ];
    const middle = strength ? standout(strength) : gap ? opportunity(gap) : [];
    const found = `${discoverySentence(discovery, call.scenario, { gap: false })} so far.`;
    return pick([intro, ...(middle.length > 0 ? [middle] : []), [found]], budget);
  }
  const limit =
    completion.evidence === 'limited'
      ? `, and with only ${plural(n, 'trainee turn')} this rests on limited evidence`
      : '';
  const found = [
    `${discoverySentence(discovery, call.scenario)}${limit}.`,
    `${discoverySentence(discovery, call.scenario, { gap: false })}${limit}.`,
  ];
  return pick([standout(strength), opportunity(gap), found], budget);
}
