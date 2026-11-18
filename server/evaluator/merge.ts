import type { TurnClassification } from '#shared/domain/classification.ts';
import {
  CoachingReportSchema,
  type CoachingReport,
  type DimensionResult,
  type EvaluationDraft,
  type Evidence,
  type ImprovementItem,
  type StrengthItem,
} from '#shared/domain/report.ts';
import { sanitizeModelText, truncate } from '#shared/domain/text.ts';
import { DIMENSION_IDS, DIMENSIONS, scoreLabel, type DimensionId } from '#shared/domain/vocab.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import {
  addEvidence,
  buildCallView,
  buildCompletion,
  buildCurveball,
  buildDiscovery,
  buildJourney,
  buildNextPractice,
  capScore,
  dimensionSufficiency,
  discoverySentence,
  overallScore,
  phraseContext,
  plural,
  trainingNote,
  verifiedQuote,
  worseOf,
  type CallView,
  type Scores,
  type Sufficiency,
  type TraineeTurn,
} from './parts.ts';
import {
  improvementText,
  modelImprovementTitle,
  modelStrengthTitle,
  strengthText,
  type ImprovementKind,
  type StrengthKind,
} from './phrasing.ts';

// Merges a model-written judgement (EvaluationDraft) with everything that is computed in code.
// The model supplies scores, rationales, evidence and coaching text. This module checks every
// quote against the trainee turn it cites, keeps scores honest (a 4 needs one verified quote, a 5
// needs two), and builds discovery, journey, curveball, completion and the next-practice
// difficulty itself, so a model can never change a number the engine recorded.

/** The draft cannot be repaired. The message is safe to show to a user. */
export class EvaluationDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationDraftError';
  }
}

export interface MergeMeta {
  name: string;
  version: string;
  providerLabel: string;
}

export interface MergeResult {
  report: CoachingReport;
  warnings: string[];
}

type DraftDimension = EvaluationDraft['dimensions'][number];

const MAX_MODEL_QUOTE = 240;
const isDimension = (value: unknown): value is DimensionId =>
  typeof value === 'string' && (DIMENSION_IDS as readonly string[]).includes(value);
const isSufficiency = (value: unknown): value is Sufficiency =>
  value === 'sufficient' || value === 'limited' || value === 'insufficient';

function pickDimensions(draft: EvaluationDraft): Map<DimensionId, DraftDimension> {
  const byId = new Map<DimensionId, DraftDimension>();
  for (const d of draft.dimensions ?? []) {
    if (!d || !isDimension(d.id) || !Number.isFinite(d.score)) continue;
    if (byId.has(d.id)) {
      throw new EvaluationDraftError(
        'The model scored the same skill area more than once, so its evaluation could not be used.',
      );
    }
    byId.set(d.id, d);
  }
  if (byId.size < DIMENSION_IDS.length) {
    throw new EvaluationDraftError(
      'The model did not score all six skill areas, so its evaluation could not be used.',
    );
  }
  return byId;
}

/** A verified citation, or the reason it was rejected. */
function checkCitation(call: CallView, turnIndex: unknown, quote: unknown): Evidence | string {
  if (typeof turnIndex !== 'number' || !Number.isInteger(turnIndex))
    return 'no valid turn was cited';
  if (!call.byIndex.has(turnIndex)) return `turn ${turnIndex} is not a trainee turn`;
  const turn = call.byIndex.get(turnIndex) as TraineeTurn;
  const verified =
    typeof quote === 'string' ? verifiedQuote(turn.text, quote, MAX_MODEL_QUOTE) : null;
  return verified ? { turnIndex, quote: verified } : `the quote is not in turn ${turnIndex}`;
}

/** Model text, cleaned of markup and cut to the report's limit; `fallback` when nothing is left. */
function clean(text: unknown, max: number, fallback = ''): string {
  const cleaned = typeof text === 'string' ? sanitizeModelText(text, max) : '';
  return cleaned.length > 0 ? cleaned : fallback;
}

function strengthKindFor(dimension: DimensionId, c: TurnClassification): StrengthKind | null {
  switch (dimension) {
    case 'opening-rapport':
      return c.introduces ? 'introduction' : null;
    case 'empathy-deescalation':
      return c.empathy === 'specific'
        ? 'empathy-specific'
        : c.acknowledgesImpact
          ? 'impact-acknowledged'
          : null;
    case 'clarity':
      return c.summarises
        ? 'summary'
        : c.jargon === 'explained'
          ? 'jargon-explained'
          : c.correctsAssumption
            ? 'corrects-assumption'
            : null;
    case 'ownership-next-steps':
      return c.ownership === 'clear'
        ? 'ownership-clear'
        : c.nextSteps === 'specific'
          ? 'next-steps-specific'
          : c.promise === 'realistic'
            ? 'promise-realistic'
            : null;
    case 'closing':
      return c.summarises || c.wrapsUp
        ? 'recap'
        : c.confirmsNextContact
          ? 'next-contact'
          : c.asksAnythingElse
            ? 'anything-else'
            : null;
    default:
      return null;
  }
}

function improvementKindFor(dimension: DimensionId, c: TurnClassification): ImprovementKind | null {
  switch (dimension) {
    case 'empathy-deescalation':
      return c.blame ? 'blame' : c.dismissive ? 'dismissive' : null;
    case 'clarity':
      return c.jargon === 'unexplained' ? 'jargon' : null;
    case 'ownership-next-steps':
      return c.promise === 'unverified'
        ? 'unverified-promise'
        : c.ownership === 'vague'
          ? 'vague-ownership'
          : c.nextSteps === 'vague'
            ? 'vague-next-steps'
            : null;
    case 'scoping-discovery':
      return c.troubleshooting ? 'premature-troubleshooting' : null;
    default:
      return null;
  }
}

function strengthTitle(
  call: CallView,
  discovery: CoachingReport['discovery'],
  dimension: DimensionId,
  turn: TraineeTurn,
): string {
  if (dimension === 'scoping-discovery') {
    const found = discovery.results.find(
      (r) =>
        r.status === 'discovered' && r.revealedAtTurn === turn.index && r.importance !== 'helpful',
    );
    if (found) {
      return strengthText('discovery', {
        name: call.name,
        factLabel: found.label,
        importance: found.importance,
      }).title;
    }
  }
  const kind = strengthKindFor(dimension, turn.cls);
  return kind ? strengthText(kind, { name: call.name }).title : modelStrengthTitle(dimension);
}

function improvementTitle(
  call: CallView,
  dimension: DimensionId,
  turn: TraineeTurn | undefined,
  quote: string | null,
): string {
  const kind = turn ? improvementKindFor(dimension, turn.cls) : null;
  if (kind) return improvementText(kind, phraseContext(call, turn?.index), { quote }).title;
  return modelImprovementTitle(dimension, quote !== null);
}

export function mergeModelDraft(
  draft: EvaluationDraft,
  input: EvaluationInput,
  meta: MergeMeta,
  options: { now?: Date } = {},
): MergeResult {
  const call = buildCallView(input);
  const warnings: string[] = [];
  const drafted = pickDimensions(draft);
  const completion = buildCompletion(call);
  const discovery = buildDiscovery(call);

  const dimensions = DIMENSION_IDS.map((id): DimensionResult => {
    const d = drafted.get(id) as DraftDimension;
    const label = DIMENSIONS[id].label;

    const evidence: Evidence[] = [];
    for (const item of d.evidence ?? []) {
      const checked = checkCitation(call, item?.turnIndex, item?.quote);
      if (typeof checked === 'string') warnings.push(`${label}: dropped a quote (${checked}).`);
      else addEvidence(evidence, checked);
    }
    const kept = evidence.slice(0, 4).sort((a, b) => a.turnIndex - b.turnIndex);

    const given = Math.round(d.score);
    const score = Math.min(5, Math.max(1, given));
    if (score !== d.score) warnings.push(`${label}: score ${d.score} was adjusted to ${score}.`);
    const capped = capScore(score, kept.length);
    if (capped < score) {
      warnings.push(
        `${label}: score lowered from ${score} to ${capped} because it had too little verified evidence.`,
      );
    }

    const baseline = dimensionSufficiency(call, id);
    let sufficiency = isSufficiency(d.sufficiency) ? worseOf(d.sufficiency, baseline) : baseline;
    if ((d.evidence?.length ?? 0) > 0 && kept.length === 0 && sufficiency === 'sufficient') {
      sufficiency = 'limited';
    }

    return {
      id,
      score: capped,
      label: scoreLabel(capped),
      rationale: clean(d.rationale, 600, `Scored ${capped} of 5 from the transcript.`),
      evidence: kept,
      sufficiency,
      guidance: clean(d.guidance, 500, DIMENSIONS[id].description),
    };
  });
  const scores = Object.fromEntries(dimensions.map((d) => [d.id, d.score])) as Scores;

  const strengths: StrengthItem[] = [];
  for (const s of draft.strengths ?? []) {
    if (strengths.length >= 3) break;
    if (!isDimension(s?.dimension)) {
      warnings.push('A strength was dropped: it named an unknown skill area.');
      continue;
    }
    const checked = checkCitation(call, s.turnIndex, s.quote);
    if (typeof checked === 'string') {
      warnings.push(`A ${DIMENSIONS[s.dimension].label} strength was dropped (${checked}).`);
      continue;
    }
    if (strengths.some((x) => x.turnIndex === checked.turnIndex && x.quote === checked.quote))
      continue;
    const why = clean(s.whyItHelped, 400);
    if (!why) {
      warnings.push(`A ${DIMENSIONS[s.dimension].label} strength was dropped (no explanation).`);
      continue;
    }
    strengths.push({
      dimension: s.dimension,
      title: strengthTitle(
        call,
        discovery,
        s.dimension,
        call.byIndex.get(checked.turnIndex) as TraineeTurn,
      ),
      turnIndex: checked.turnIndex,
      quote: checked.quote,
      whyItHelped: why,
    });
  }

  const improvements: ImprovementItem[] = [];
  for (const i of draft.improvements ?? []) {
    if (improvements.length >= 3) break;
    if (!isDimension(i?.dimension)) {
      warnings.push('An improvement was dropped: it named an unknown skill area.');
      continue;
    }
    const label = DIMENSIONS[i.dimension].label;
    let cited: Evidence | null = null;
    if (typeof i.quote === 'string' && i.quote.trim() !== '') {
      const checked = checkCitation(call, i.turnIndex, i.quote);
      if (typeof checked === 'string') {
        warnings.push(`A ${label} improvement was dropped (${checked}).`);
        continue;
      }
      cited = checked;
    }
    const risk = clean(i.risk, 400);
    const betterPhrasing = clean(i.betterPhrasing, 500);
    if (!risk || !betterPhrasing) {
      warnings.push(
        `A ${label} improvement was dropped (it had no risk or no suggested phrasing).`,
      );
      continue;
    }
    improvements.push({
      dimension: i.dimension,
      title: improvementTitle(
        call,
        i.dimension,
        cited ? call.byIndex.get(cited.turnIndex) : undefined,
        cited?.quote ?? null,
      ),
      turnIndex: cited?.turnIndex ?? null,
      quote: cited?.quote ?? null,
      risk,
      betterPhrasing,
      whyItWorks: clean(i.whyItWorks, 400, 'It gives the customer a clearer, more useful reply.'),
    });
  }

  const overall = overallScore(scores, completion.evidence);

  // Keep the model's chosen focus only if it is a genuinely weak area.
  const lowest = Math.min(...DIMENSION_IDS.map((id) => scores[id]));
  const wanted = draft.nextPractice?.dimension;
  const recommendation = clean(draft.nextPractice?.recommendation, 500);
  const keep = isDimension(wanted) && scores[wanted] <= lowest + 1 && recommendation !== '';
  if (!keep)
    warnings.push('The suggested practice focus was replaced by one computed from the scores.');

  const n = completion.traineeTurns;
  let summary = clean(draft.summary, 1200, `${discoverySentence(discovery)}.`);
  if (
    completion.evidence !== 'sufficient' &&
    !/\b(limited|too short|too few|ended early)\b/i.test(summary)
  ) {
    const note =
      completion.evidence === 'insufficient'
        ? `Only ${plural(n, 'trainee turn')} were recorded, so treat this as a first look rather than a full evaluation.`
        : `With only ${plural(n, 'trainee turn')}, this rests on limited evidence.`;
    summary = `${truncate(summary, 1200 - note.length - 1)} ${note}`;
  }

  const candidate = {
    version: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    evaluator: {
      kind: 'model',
      name: meta.name,
      version: meta.version,
      providerLabel: meta.providerLabel,
    },
    completion,
    summary: {
      overall: summary,
      overallScore: overall,
      coachingFocus: [...new Set(input.scenario.coachingFocus)],
    },
    dimensions,
    strengths,
    improvements,
    discovery,
    journey: buildJourney(call),
    curveball: buildCurveball(call),
    nextPractice: buildNextPractice(
      call,
      scores,
      overall,
      discovery,
      keep && isDimension(wanted) ? { dimension: wanted, recommendation } : undefined,
    ),
    trainingNote: trainingNote(meta.name),
  };

  const parsed = CoachingReportSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new EvaluationDraftError(
      'The model\u2019s evaluation could not be turned into a valid report, so it was not used.',
    );
  }
  return { report: parsed.data, warnings };
}
