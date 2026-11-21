// The CBCF layer of the rubric. It is a placeholder on purpose.
//
// No CBCF material exists in this repository or in the files given for this project, so what CBCF
// stands for, what its categories are and how it is scored are not known here, and nothing in this
// module guesses them. The report carries only a status that says the mapping is not applied. When
// authorised CBCF source material is available, a confirmed mapping can be loaded through
// `loadCbcfMapping`, which refuses anything that is not confirmed and does not name its source.
//
// Until then nothing is mapped, no CBCF wording reaches a trainee, and the report never says
// anything is aligned with, compliant with or scored against CBCF.

import { z } from 'zod';
import type { CbcfStatus } from '#shared/domain/report.ts';
import { sentences } from '#shared/domain/text.ts';

export const CBCF_MAPPING_VERSION = '0.1.0-pending';
export const CBCF_PENDING_NOTE =
  'CBCF mapping is not applied: awaiting authoritative source confirmation.';

// ---------------------------------------------------------------------------------------
// The interface a confirmed mapping would fill in: call stages, behaviours and the evidence that
// shows each behaviour. The shapes are generic; their content can only come from the source.

/** Where a confirmed mapping came from. A mapping without a named source is not accepted. */
export interface CbcfSource {
  name: string;
  reference: string;
  confirmedBy: string;
  confirmedOn: string;
}

export interface CbcfStage {
  id: string;
  label: string;
}

/** How the source says a behaviour shows in a call, expressed through the CARE behaviours that carry it. */
export interface CbcfEvidenceRule {
  careBehaviours: string[];
  description: string;
}

export interface CbcfBehaviour {
  id: string;
  label: string;
  stage: string;
  evidence: CbcfEvidenceRule;
}

/** The mapping while it is waiting for its source. It maps nothing. */
export interface PendingCbcfMapping {
  version: string;
  status: 'awaiting-authoritative-source';
  source: null;
  callStages: [];
  behaviours: [];
}

export interface ConfirmedCbcfMapping {
  version: string;
  status: 'confirmed';
  source: CbcfSource;
  callStages: CbcfStage[];
  behaviours: CbcfBehaviour[];
}

export type CbcfMapping = PendingCbcfMapping | ConfirmedCbcfMapping;

/** The versioned configuration the evaluator uses today: pending, and empty. */
export const CBCF_MAPPING: PendingCbcfMapping = {
  version: CBCF_MAPPING_VERSION,
  status: 'awaiting-authoritative-source',
  source: null,
  callStages: [],
  behaviours: [],
};

// ---------------------------------------------------------------------------------------
// What the report says

/**
 * The report's `cbcf` object. It always says the mapping is not applied: it takes only the pending
 * mapping, so a confirmed one cannot be reported as a status by mistake. (When a confirmed mapping
 * is in use, the report schema has to be extended to carry it; that is a deliberate change.)
 */
export function cbcfStatus(mapping: PendingCbcfMapping = CBCF_MAPPING): CbcfStatus {
  return {
    status: 'awaiting-authoritative-source',
    mappingVersion: mapping.version,
    note: CBCF_PENDING_NOTE,
  };
}

/** The behaviours the mapping contributes. While it is pending there are none. */
export function cbcfBehaviours(mapping: CbcfMapping = CBCF_MAPPING): CbcfBehaviour[] {
  return mapping.status === 'confirmed' ? [...mapping.behaviours] : [];
}

/**
 * Model-written coaching text without any sentence that names CBCF. A model that was never given
 * the mapping can only be guessing, and the report's one word on CBCF is the status object.
 */
export function withoutCbcfMentions(text: string): string {
  return sentences(text)
    .filter((sentence) => !/\bCBCF\b/i.test(sentence))
    .join(' ');
}

// ---------------------------------------------------------------------------------------
// Loading a confirmed mapping later

export type CbcfMappingErrorCode = 'cbcf_not_confirmed' | 'cbcf_source_missing' | 'cbcf_invalid';

/** A mapping that cannot be used. The message is plain and safe to log; it never holds mapping content. */
export class CbcfMappingError extends Error {
  readonly code: CbcfMappingErrorCode;
  readonly problems: string[];

  constructor(code: CbcfMappingErrorCode, message: string, problems: string[] = []) {
    super(message);
    this.name = 'CbcfMappingError';
    this.code = code;
    this.problems = problems;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const text = z.string().trim().min(1).max(300);
const ConfirmedSchema = z.object({
  version: z.string().trim().min(1).max(40),
  status: z.literal('confirmed'),
  source: z.object({
    name: text,
    reference: text,
    confirmedBy: text,
    confirmedOn: text,
  }),
  callStages: z.array(z.object({ id: text, label: text })).min(1),
  behaviours: z
    .array(
      z.object({
        id: text,
        label: text,
        stage: text,
        evidence: z.object({
          careBehaviours: z.array(text).min(1),
          description: text,
        }),
      }),
    )
    .min(1),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Accepts a mapping only when it says it is confirmed and names the authorised source it came
 * from. Anything else is refused with a typed error, so a half-finished or guessed mapping can
 * never be applied. Nothing calls this today.
 */
export function loadCbcfMapping(candidate: unknown): ConfirmedCbcfMapping {
  if (!isRecord(candidate)) {
    throw new CbcfMappingError('cbcf_invalid', 'A CBCF mapping has to be an object.');
  }
  if (candidate.status !== 'confirmed') {
    throw new CbcfMappingError(
      'cbcf_not_confirmed',
      'The CBCF mapping is not confirmed, so it was not loaded.',
    );
  }
  const source = candidate.source;
  const named = isRecord(source) && typeof source.name === 'string' && source.name.trim() !== '';
  if (!named) {
    throw new CbcfMappingError(
      'cbcf_source_missing',
      'A confirmed CBCF mapping has to name its authorised source, so it was not loaded.',
    );
  }
  const parsed = ConfirmedSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new CbcfMappingError(
      'cbcf_invalid',
      'The CBCF mapping is incomplete, so it was not loaded.',
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return parsed.data;
}
