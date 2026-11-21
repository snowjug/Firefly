import type { z } from 'zod';
import {
  EVIDENCE_BEHAVIOURS,
  TurnClassificationSchema,
  type TurnClassification,
} from '#shared/domain/classification.ts';
import { EvaluationDraftSchema, type EvaluationDraft } from '#shared/domain/report.ts';
import { quoteInText, sanitizeModelText, truncate } from '#shared/domain/text.ts';
import {
  DIMENSION_IDS,
  DIMENSIONS,
  DISCOVERY_INTENTS,
  type DimensionId,
} from '#shared/domain/vocab.ts';
import type { ClassifierPrompt, ClassifierTarget } from '../prompts/classifier.ts';
import { endListItems } from '../engine/conform.ts';

// Turning model output into trusted values. Models are lenient about format, so this reads leniently
// (code fences, stray prose, wrong case, numbers as strings) and then validates strictly with the
// shared schemas. Nothing here is ever echoed to a user: problems are reported as field names only.

/** The reply could not be used. The message names fields and never contains the reply itself. */
export class OutputProblem extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputProblem';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// ---------------------------------------------------------------------------------------
// Finding the JSON

// Some local reasoning models print their thinking first. It is never part of the answer.
export function stripReasoning(text: string): string {
  return text.replace(/<think(?:ing)?>[\s\S]*?(?:<\/think(?:ing)?>|$)/gi, '');
}

function balancedEnd(source: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseObject(candidate: string): Record<string, unknown> | null {
  for (const text of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
    try {
      const value: unknown = JSON.parse(text);
      return isRecord(value) ? value : null;
    } catch {
      // try the next form
    }
  }
  return null;
}

/** The first balanced JSON object in the reply, wherever it sits (fenced, quoted or after prose). */
export function extractJsonObject(text: string): Record<string, unknown> {
  const source = stripReasoning(text);
  for (let from = source.indexOf('{'); from !== -1; from = source.indexOf('{', from + 1)) {
    const end = balancedEnd(source, from);
    const found = end === -1 ? null : parseObject(source.slice(from, end + 1));
    if (found) return found;
  }
  throw new OutputProblem('The reply was not a single valid JSON object.');
}

export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join('.') || 'reply'}: ${issue.message}`)
    .join('; ')
    .slice(0, 500);
}

// ---------------------------------------------------------------------------------------
// Small coercions

function toBoolean(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const word = value.trim().toLowerCase();
  if (word === 'true' || word === 'yes') return true;
  if (word === 'false' || word === 'no') return false;
  return value;
}

const toKeyword = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------------------
// Turn classification

const BOOLEAN_FIELDS = [
  'askedQuestion',
  'introduces',
  'acknowledgesImpact',
  'blame',
  'dismissive',
  'summarises',
  'troubleshooting',
  'wrapsUp',
  'confirmsNextContact',
  'asksAnythingElse',
  'correctsAssumption',
  'injectionAttempt',
  'lowEffort',
] as const;
const ENUM_FIELDS = ['empathy', 'ownership', 'nextSteps', 'promise', 'jargon', 'clarity'] as const;

function normaliseIntents(value: unknown): string[] {
  const allowed = new Set<string>(DISCOVERY_INTENTS);
  const names = asArray(value)
    .filter((item): item is string => typeof item === 'string')
    .map((item) =>
      item
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_'),
    )
    .filter((name) => allowed.has(name));
  return [...new Set(names)].slice(0, 8);
}

function normaliseTargets(value: unknown): { id: string; strength: unknown }[] {
  return asArray(value)
    .flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== 'string') return [];
      const strength = toKeyword(item.strength);
      return strength === 'full' || strength === 'partial'
        ? [{ id: item.id.trim().toLowerCase(), strength }]
        : [];
    })
    .slice(0, 8);
}

function normaliseEvidence(value: unknown, message: string) {
  const allowed = new Set<string>(EVIDENCE_BEHAVIOURS);
  return asArray(value)
    .flatMap((item) => {
      if (!isRecord(item) || typeof item.behaviour !== 'string' || typeof item.quote !== 'string') {
        return [];
      }
      const behaviour = item.behaviour
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-');
      // A cut-off quote is still verbatim, so it is cut rather than dropped.
      const quote = item.quote.trim().slice(0, 240);
      return allowed.has(behaviour) && quoteInText(message, quote) ? [{ behaviour, quote }] : [];
    })
    .slice(0, 12);
}

/** Maps the model's throwaway target names back to fact ids and drops anything not allowed. */
function resolveTargets(
  targets: TurnClassification['factTargets'],
  known: ClassifierTarget[],
): TurnClassification['factTargets'] {
  const byAlias = new Map(known.map((target) => [target.alias, target]));
  const chosen = new Map<string, 'full' | 'partial'>();
  for (const { id, strength } of targets) {
    const target = byAlias.get(id);
    if (!target || (strength === 'partial' && !target.hasPartial)) continue;
    if (chosen.get(target.id) !== 'full') chosen.set(target.id, strength);
  }
  return [...chosen].map(([id, strength]) => ({ id, strength }));
}

export function parseClassification(content: string, prompt: ClassifierPrompt): TurnClassification {
  const raw = extractJsonObject(content);
  const candidate: Record<string, unknown> = {};
  for (const key of BOOLEAN_FIELDS) candidate[key] = toBoolean(raw[key]);
  for (const key of ENUM_FIELDS) candidate[key] = toKeyword(raw[key]);
  candidate.discoveryIntents = normaliseIntents(raw.discoveryIntents);
  candidate.factTargets = normaliseTargets(raw.factTargets);
  candidate.confidence = Math.min(1, Math.max(0, toNumber(raw.confidence) ?? 0.5));
  candidate.evidence = normaliseEvidence(raw.evidence, prompt.engineerMessage);
  const parsed = TurnClassificationSchema.safeParse(candidate);
  if (!parsed.success) throw new OutputProblem(describeIssues(parsed.error));
  return { ...parsed.data, factTargets: resolveTargets(parsed.data.factTargets, prompt.targets) };
}

// ---------------------------------------------------------------------------------------
// Evaluation draft

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Accepts the id, the label ("Opening & Rapport") or the short name of a dimension.
const DIMENSION_LOOKUP = new Map<string, DimensionId>(
  DIMENSION_IDS.flatMap((id) =>
    [id, DIMENSIONS[id].label, DIMENSIONS[id].short].map((name) => [slug(name), id] as const),
  ),
);

const dimensionId = (value: unknown): DimensionId | null =>
  typeof value === 'string' ? (DIMENSION_LOOKUP.get(slug(value)) ?? null) : null;

const prose = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() !== '' ? truncate(value, max) : null;

// Quotes are cut, never reworded, so they stay verbatim.
const quote = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : null;

function turnNumber(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && n >= 1 ? Math.round(n) : null;
}

function evidenceItems(value: unknown) {
  return asArray(value)
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const turnIndex = turnNumber(item.turnIndex);
      const text = quote(item.quote, 260);
      return turnIndex !== null && text !== null ? [{ turnIndex, quote: text }] : [];
    })
    .slice(0, 4);
}

function normaliseDimension(raw: unknown) {
  if (!isRecord(raw)) return null;
  const id = dimensionId(raw.id);
  if (!id) return null;
  const score = toNumber(raw.score);
  return {
    id,
    score: score === null ? raw.score : Math.min(5, Math.max(1, Math.round(score))),
    rationale: prose(raw.rationale, 500) ?? raw.rationale,
    evidence: evidenceItems(raw.evidence),
    sufficiency: toKeyword(raw.sufficiency),
    guidance: prose(raw.guidance, 400) ?? raw.guidance,
  };
}

function normaliseDimensions(value: unknown) {
  const byId = new Map<DimensionId, NonNullable<ReturnType<typeof normaliseDimension>>>();
  for (const item of asArray(value)) {
    const dimension = normaliseDimension(item);
    if (dimension && !byId.has(dimension.id)) byId.set(dimension.id, dimension);
  }
  const missing = DIMENSION_IDS.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new OutputProblem(
      `dimensions: include exactly one entry for each of the six dimension ids. Missing: ${missing.join(', ')}.`,
    );
  }
  return DIMENSION_IDS.flatMap((id) => {
    const dimension = byId.get(id);
    return dimension ? [dimension] : [];
  });
}

function normaliseStrengths(value: unknown) {
  return asArray(value)
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const dimension = dimensionId(item.dimension);
      const turnIndex = turnNumber(item.turnIndex);
      const text = quote(item.quote, 260);
      const why = prose(item.whyItHelped, 300);
      return dimension && turnIndex !== null && text && why
        ? [{ dimension, turnIndex, quote: text, whyItHelped: why }]
        : [];
    })
    .slice(0, 3);
}

function normaliseImprovements(value: unknown) {
  return asArray(value)
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const dimension = dimensionId(item.dimension);
      const risk = prose(item.risk, 300);
      const betterPhrasing = prose(item.betterPhrasing, 400);
      const whyItWorks = prose(item.whyItWorks, 300);
      if (!dimension || !risk || !betterPhrasing || !whyItWorks) return [];
      // A quote without a turn cannot be checked, so the pair is kept together or not at all.
      const turnIndex = turnNumber(item.turnIndex);
      const text = quote(item.quote, 260);
      const cited = turnIndex !== null && text !== null;
      return [
        {
          dimension,
          turnIndex: cited ? turnIndex : null,
          quote: cited ? text : null,
          risk,
          betterPhrasing,
          whyItWorks,
        },
      ];
    })
    .slice(0, 3);
}

export function parseEvaluationDraft(content: string): EvaluationDraft {
  const raw = extractJsonObject(content);
  const next = isRecord(raw.nextPractice) ? raw.nextPractice : {};
  const candidate = {
    summary: prose(raw.summary, 800) ?? raw.summary,
    dimensions: normaliseDimensions(raw.dimensions),
    strengths: normaliseStrengths(raw.strengths),
    improvements: normaliseImprovements(raw.improvements),
    nextPractice: {
      dimension: dimensionId(next.dimension) ?? next.dimension,
      recommendation: prose(next.recommendation, 400) ?? next.recommendation,
    },
  };
  const parsed = EvaluationDraftSchema.safeParse(candidate);
  if (!parsed.success) throw new OutputProblem(describeIssues(parsed.error));
  return parsed.data;
}

// ---------------------------------------------------------------------------------------
// Customer replies

export const MAX_REPLY_CHARS = 900;

// A model told to write plain speech sometimes still opens or closes with an action such as
// "*sighs*" or "(pauses)". Emphasis inside a sentence ("I *can't* sign in") is kept.
const DIRECTION = String.raw`(?:\*(?!\*)[^*\n]{1,80}\*(?!\*)|\([A-Za-z][A-Za-z' -]{0,30}\))`;
const LEADING_DIRECTION = new RegExp(String.raw`^\s*${DIRECTION}\s*`);
const TRAILING_DIRECTION = new RegExp(String.raw`\s*${DIRECTION}\s*$`);
const WRAPPED_IN_QUOTES = /^["\u201c]([^"\u201c\u201d]*)["\u201d]$/;

const ROLE_BREAK = new RegExp(
  [
    String.raw`\bas an? (?:ai|artificial intelligence|language model|llm|chatbot|virtual assistant)\b`,
    String.raw`\bi(?:'m| am) (?:just )?(?:an? )?(?:ai|artificial intelligence|language model|llm|chatbot|virtual assistant|simulated|fictional)\b`,
    String.raw`\b(?:language model|llm|chatgpt|openai)\b`,
    String.raw`\b(?:system|developer) prompt\b`,
    String.raw`\bmy (?:instructions|programming|prompt|guidelines)\b`,
    String.raw`\b(?:scoring )?rubric\b`,
    String.raw`\bthis (?:simulation|role-?play)\b`,
    String.raw`\bthis (?:practice|training) (?:call|session|scenario|exercise)\b`,
    String.raw`\bsimulated (?:customer|call)\b`,
    String.raw`\b(?:break|stay in) character\b`,
    String.raw`\bi can(?:'|no)t (?:assist|comply) with\b`,
  ].join('|'),
  'i',
);

// When the model hit its length limit, the last sentence is probably cut off.
function dropCutOffSentence(text: string): string {
  if (/[.!?]["')\u201d]?$/.test(text)) return text;
  const end = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
  return end > 0 ? text.slice(0, end + 1) : text;
}

/** Plain customer speech: no reasoning, stage directions, speaker label, markdown or wrapping quotes. */
export function cleanCustomerText(
  raw: string,
  options: { finishReason: string | null; speakerNames: string[] },
): string {
  let text = stripReasoning(raw).trim();
  for (const name of options.speakerNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^\\s*${escaped}\\s*:\\s*`, 'i'), '');
  }
  const wrapped = WRAPPED_IN_QUOTES.exec(text.trim());
  if (wrapped) text = wrapped[1] ?? '';
  // Only directions at the very start or end go: *emphasis* inside a sentence is part of the speech.
  for (let i = 0; i < 3; i++)
    text = text.replace(LEADING_DIRECTION, '').replace(TRAILING_DIRECTION, '');
  text = endListItems(text);
  text = sanitizeModelText(text, 5000).replace(/\s+([.,!?;:])/g, '$1');
  return options.finishReason === 'length' ? dropCutOffSentence(text) : text;
}

export type ReplyProblem = 'empty' | 'too-long' | 'role-break';

export function replyProblem(text: string): ReplyProblem | null {
  if (text.trim().length === 0) return 'empty';
  if (text.length > MAX_REPLY_CHARS) return 'too-long';
  return ROLE_BREAK.test(text.replace(/[\u2018\u2019]/g, "'")) ? 'role-break' : null;
}
