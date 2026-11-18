import type { CoachingReport } from '#shared/domain/report.ts';
import { truncate } from '#shared/domain/text.ts';
import type { CoachedImprovement } from './improvements.ts';
import { discoverySentence, plural, type CallView } from './parts.ts';
import { isStretch, quoted } from './phrasing.ts';
import type { CoachedStrength } from './strengths.ts';

// The overall summary: at most three natural sentences. What stood out (with a short quote), the
// single biggest opportunity as advice about behaviour, and the discovery result in plain words.
// No generic praise: with nothing to praise, the summary says so.

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function standout(strength: CoachedStrength | undefined): string {
  if (!strength) return 'No single moment stood out as a clear strength this time.';
  return capitalise(`${strength.said}${strength.help ? `, and ${strength.help}` : ''}.`);
}

function opportunity(gap: CoachedImprovement | undefined): string {
  if (!gap) return 'No single gap stood out.';
  if (isStretch(gap.kind)) return `To stretch further, ${gap.advice}.`;
  const moment = gap.turn !== null && gap.quote ? ` (turn ${gap.turn}, ${quoted(gap.quote)})` : '';
  const effect = gap.harm
    ? `${gap.turn !== null ? ', after which' : '; meanwhile,'} ${gap.harm}`
    : '';
  return `The biggest opportunity is to ${gap.advice}${moment}${effect}.`;
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

  if (completion.evidence === 'insufficient') {
    // Too short to name a gap in what was found: only report how far the call got.
    const intro = `The call ended after ${plural(n, 'trainee turn')}, which is too few to score with confidence, so there is no overall score.`;
    const middle = strength ? standout(strength) : gap ? opportunity(gap) : '';
    const found = `${discoverySentence(discovery, call.scenario, { gap: false })} so far.`;
    return truncate([intro, middle, found].filter(Boolean).join(' '), 1200);
  }
  const limit =
    completion.evidence === 'limited'
      ? `, and with only ${plural(n, 'trainee turn')} this rests on limited evidence`
      : '';
  const found = `${discoverySentence(discovery, call.scenario)}${limit}.`;
  return truncate([standout(strength), opportunity(gap), found].join(' '), 1200);
}
