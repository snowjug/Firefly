import type { CareBehaviourResult, CarePrincipleResult } from '#shared/domain/report.ts';
import type { CareExpectations } from '#shared/domain/scenario.ts';
import { truncate } from '#shared/domain/text.ts';
import { CARE_BEHAVIOURS, CARE_LABELS } from '#shared/domain/vocab.ts';
import type { CallView } from '../parts.ts';
import { ACCOUNTABLE } from './accountable.ts';
import { COMMUNICATE } from './communicate.ts';
import { buildCareContext, type CareContext } from './context.ts';
import { EMPATHETIC } from './empathetic.ts';
import { linkExpectations, type ExpectationLink } from './expectations.ts';
import { settle } from './helpers.ts';
import { fitToCase, levelOf, summarise, type ListedRow } from './levels.ts';
import { RESOURCEFUL } from './resourceful.ts';
import { isCore } from './stages.ts';
import type { BehaviourId, BehaviourSpec, Finding } from './types.ts';

export { BEHAVIOUR_IDS } from './types.ts';
export type { BehaviourId, Finding } from './types.ts';
export type { ExpectationLink } from './expectations.ts';

const CATALOGUE: BehaviourSpec[] = [...COMMUNICATE, ...ACCOUNTABLE, ...RESOURCEFUL, ...EMPATHETIC];

const NO_EXPECTATIONS: CareExpectations = {
  communicate: [],
  accountable: [],
  resourceful: [],
  empathetic: [],
};

/** Everything the evaluator worked out about CARE for one call, for the report and for coaching. */
export interface CareAssessment {
  context: CareContext;
  /** Every behaviour that was judged, including ones the stage does not call for and so are not listed. */
  findings: ReadonlyMap<BehaviourId, Finding>;
  /** What the scenario expected, and whether the call met it. */
  expectations: ExpectationLink[];
  /** The four principals as the report carries them. */
  principals: CarePrincipleResult[];
}

function toResult(ctx: CareContext, row: ListedRow, links: ExpectationLink[]): CareBehaviourResult {
  const { spec, finding } = row;
  let note = finding.note ?? null;
  // A missing behaviour that the scenario said this case needed says so.
  if (note === null && finding.status !== 'shown') {
    const link = links.find((l) => l.behaviours.includes(spec.id) && l.status !== 'met');
    if (link) note = truncate(`This case needed: ${link.text}`, 200);
  }
  return {
    id: spec.id,
    principle: spec.principle,
    label: truncate(spec.label(ctx), 80),
    status: finding.status,
    evidence: finding.evidence.slice(0, 2),
    note,
  };
}

/**
 * Reads CARE (communicate, be accountable, be resourceful, be empathetic) from the transcript.
 * Each behaviour is judged from what the trainee said and where, using the turn classifications
 * where they already detect it. A behaviour is listed when the call stage calls for it, or when it
 * was shown, or when something harmful was said; it is never listed as missing just because this
 * stage did not ask for it.
 */
export function assessCare(call: CallView): CareAssessment {
  const ctx = buildCareContext(call);
  const findings = new Map<BehaviourId, Finding>();
  // Nothing was said, so nothing can be judged: every principal says so and lists no behaviours.
  if (call.turns.length === 0) {
    const principals = CARE_BEHAVIOURS.map((principle): CarePrincipleResult => ({
      id: principle,
      label: CARE_LABELS[principle],
      level: 'limited-evidence',
      summary: 'No trainee turns were recorded, so there is nothing to judge here.',
      behaviours: [],
    }));
    return { context: ctx, findings, expectations: [], principals };
  }
  for (const spec of CATALOGUE) {
    const raw = spec.judge(ctx);
    if (raw) findings.set(spec.id, settle(raw));
  }
  const expectations = linkExpectations(
    call.scenario.careExpectations ?? NO_EXPECTATIONS,
    findings,
  );

  const principals = CARE_BEHAVIOURS.map((principle): CarePrincipleResult => {
    const rows: ListedRow[] = [];
    for (const spec of CATALOGUE) {
      if (spec.principle !== principle) continue;
      const finding = findings.get(spec.id);
      if (!finding) continue;
      const core = isCore(ctx.stage, spec.id) || finding.core === true;
      if (core || finding.status !== 'not-shown' || finding.harm)
        rows.push({ spec, finding, core });
    }
    const links = expectations.filter((l) => l.principle === principle);
    const level = fitToCase(levelOf(ctx, rows), links);
    return {
      id: principle,
      label: CARE_LABELS[principle],
      level,
      summary: summarise(ctx, level, rows, links),
      behaviours: rows.map((row) => toResult(ctx, row, links)),
    };
  });

  return { context: ctx, findings, expectations, principals };
}
