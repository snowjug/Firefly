import type { CareLevel } from '#shared/domain/report.ts';
import { plural } from '../parts.ts';
import type { CareContext } from './context.ts';
import type { ExpectationLink } from './expectations.ts';
import { wordCount } from './helpers.ts';
import type { BehaviourSpec, BehaviourStatus, Finding } from './types.ts';

// How a principal's behaviours add up to a level, and the one sentence that says so. The level is
// worked out from what was shown, weighted towards what this call stage calls for. It never guesses
// from too little: a very short call says "limited-evidence".

export interface ListedRow {
  spec: BehaviourSpec;
  finding: Finding;
  core: boolean;
}

const CREDIT: Record<BehaviourStatus, number> = { shown: 1, partly: 0.5, 'not-shown': 0 };
const weight = (row: ListedRow): number => (row.core ? 2 : 1);

export function levelOf(ctx: CareContext, rows: ListedRow[]): CareLevel {
  if (ctx.evidence === 'insufficient' || rows.length === 0) return 'limited-evidence';
  // A call of three or four turns that left fewer than two behaviours to quote is too thin to judge.
  const quoted = rows.filter((r) => r.finding.evidence.length > 0).length;
  if (ctx.evidence === 'limited' && quoted < 2) return 'limited-evidence';

  const max = rows.reduce((sum, r) => sum + weight(r), 0);
  const points = rows.reduce((sum, r) => sum + weight(r) * CREDIT[r.finding.status], 0);
  const share = max === 0 ? 0 : points / max;
  const harms = rows.filter((r) => r.finding.harm).length;
  const shown = rows.filter((r) => r.finding.status === 'shown').length;
  // Strong means what this stage calls for was there: a core behaviour that never showed keeps a
  // principal at "developing" however much else it did well.
  const coreMissing = rows.some((r) => r.core && r.finding.status === 'not-shown');

  let level: CareLevel =
    share >= 0.75 && shown >= 2 && !coreMissing
      ? 'strong'
      : share >= 0.4
        ? 'developing'
        : 'not-yet';
  // Something harmful (blame, a dismissal, a promise nobody could back, a repeated apology) means
  // the principal cannot be called strong, and two of them hold it to "not yet" unless it was strong.
  if (harms >= 1 && level === 'strong') level = 'developing';
  if (harms >= 2 && level === 'developing' && share < 0.6) level = 'not-yet';
  return level;
}

function caseClause(links: ExpectationLink[]): string {
  if (links.length === 0) return '';
  const met = links.filter((l) => l.status === 'met').length;
  if (met === links.length) return '; it met what this case needed';
  if (met === 0) return '; it did not yet meet what this case needed';
  return `; it met ${met} of ${links.length} things this case needed`;
}

/**
 * "Strong" says what this case called for was there. When the scenario named things it needed and
 * none were fully met, the principal is "developing", so the level and the sentence beside it agree.
 */
export function fitToCase(level: CareLevel, links: ExpectationLink[]): CareLevel {
  if (level !== 'strong' || links.length === 0) return level;
  return links.some((l) => l.status === 'met') ? level : 'developing';
}

/** One sentence of about 25 words, grounded in this call: what was shown, what was missing. */
export function summarise(
  ctx: CareContext,
  level: CareLevel,
  rows: ListedRow[],
  links: ExpectationLink[],
): string {
  const done = rows
    .filter((r) => r.finding.status === 'shown')
    .sort((a, b) => Number(b.core) - Number(a.core));
  const gaps = rows
    .filter((r) => r.finding.status !== 'shown')
    .sort(
      (a, b) =>
        Number(!!b.finding.harm) - Number(!!a.finding.harm) ||
        Number(b.core) - Number(a.core) ||
        CREDIT[a.finding.status] - CREDIT[b.finding.status],
    );
  const doneText = (r: ListedRow): string => r.spec.done(ctx);
  const gapText = (r: ListedRow): string =>
    r.finding.clause ??
    (r.finding.status === 'partly' ? `only partly ${doneText(r)}` : r.spec.missing(ctx));
  // Two gaps worded the same way (a broken promise shows up under two behaviours) are one gap.
  const gapTexts = [...new Set(gaps.map(gapText))];

  const first = done[0];
  const second = done[1];
  const gap = gapTexts[0];
  const nextGap = gapTexts[1];
  const withCase = (text: string): string => `${text}${caseClause(links)}.`;
  const fit = (variants: string[]): string =>
    variants.find((v) => wordCount(v) <= 30) ?? (variants[variants.length - 1] as string);

  switch (level) {
    case 'limited-evidence': {
      const turns = plural(ctx.call.turns.length, 'trainee turn');
      return fit([
        `Only ${turns} so far, so this is a first look: ${first ? `you ${doneText(first)}` : 'there was little to judge yet'}.`,
      ]);
    }
    case 'strong': {
      const lead = first ? `You ${doneText(first)}` : 'Strong evidence for this';
      return fit([
        withCase(second ? `${lead} and ${doneText(second)}` : lead),
        withCase(lead),
        `${lead}.`,
      ]);
    }
    case 'developing': {
      const lead = first ? `You ${doneText(first)}` : 'Some of this showed';
      const but = gap ? `, but you ${gap}` : '';
      return fit([withCase(`${lead}${but}`), `${lead}${but}.`, `${lead}.`]);
    }
    case 'not-yet': {
      const parts = [gap, nextGap].filter((g): g is string => g !== undefined);
      const text =
        parts.length > 0
          ? `Little of this showed: you ${parts.join(' and ')}`
          : 'Little of this showed';
      return fit([withCase(text), `${text}.`]);
    }
  }
}
