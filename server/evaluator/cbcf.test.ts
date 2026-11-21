import { describe, expect, it } from 'vitest';
import { CbcfStatusSchema } from '#shared/domain/report.ts';
import {
  CBCF_MAPPING,
  CBCF_PENDING_NOTE,
  CbcfMappingError,
  cbcfBehaviours,
  cbcfStatus,
  loadCbcfMapping,
  withoutCbcfMentions,
} from './cbcf-mapping.ts';
import {
  evaluate,
  strongCall,
  weakCall,
  buildInput,
  makeScenario,
  STRONG_STEPS,
} from './testing.ts';

// CBCF is not mapped: no authorised source material exists for this project, so nothing here may
// guess what CBCF means. The report says only that the mapping is not applied. The mapping used in
// the loader tests is a clearly marked test double, not CBCF content.

const TEST_DOUBLE = {
  version: 'test-double-1',
  status: 'confirmed',
  source: {
    name: 'TEST DOUBLE, not a real source',
    reference: 'test-only',
    confirmedBy: 'a unit test',
    confirmedOn: '2000-01-01',
  },
  callStages: [{ id: 'TEST-STAGE', label: 'Placeholder stage' }],
  behaviours: [
    {
      id: 'TEST-BEHAVIOUR',
      label: 'Placeholder behaviour',
      stage: 'TEST-STAGE',
      evidence: {
        careBehaviours: ['communicate.greeting'],
        description: 'Placeholder evidence rule.',
      },
    },
  ],
};

describe('the CBCF status in a report', () => {
  const calls = {
    strong: strongCall(),
    weak: weakCall(),
    short: buildInput(makeScenario(), STRONG_STEPS.slice(0, 1), { endedEarly: true }),
    empty: buildInput(makeScenario(), [], { endedEarly: true }),
  };

  it.each(Object.entries(calls))('is always the pending status: %s call', (_name, input) => {
    const report = evaluate(input);
    expect(report.cbcf).toEqual({
      status: 'awaiting-authoritative-source',
      mappingVersion: '0.1.0-pending',
      note: 'CBCF mapping is not applied: awaiting authoritative source confirmation.',
    });
    expect(CbcfStatusSchema.safeParse(report.cbcf).success).toBe(true);
  });

  it.each(Object.entries(calls))('is the only place CBCF appears: %s call', (_name, input) => {
    const { cbcf, ...rest } = evaluate(input);
    expect(cbcf).toBeDefined();
    expect(JSON.stringify(rest)).not.toMatch(/cbcf/i);
  });

  it('never says anything is compliant with, aligned with or scored against CBCF', () => {
    for (const input of Object.values(calls)) {
      expect(JSON.stringify(evaluate(input))).not.toMatch(
        /cbcf (?:compliant|compliance|aligned|alignment|score)/i,
      );
    }
  });
});

describe('the pending mapping', () => {
  it('is versioned, has no source, and maps nothing', () => {
    expect(CBCF_MAPPING).toEqual({
      version: '0.1.0-pending',
      status: 'awaiting-authoritative-source',
      source: null,
      callStages: [],
      behaviours: [],
    });
  });

  it('contributes no behaviours while it is pending', () => {
    expect(cbcfBehaviours()).toEqual([]);
    expect(cbcfBehaviours(CBCF_MAPPING)).toEqual([]);
  });

  it('gives the plain status note that the report carries', () => {
    expect(cbcfStatus().note).toBe(CBCF_PENDING_NOTE);
    expect(CBCF_PENDING_NOTE).toMatch(/not applied/);
  });
});

describe('loading a confirmed mapping later', () => {
  const refusal = (candidate: unknown): CbcfMappingError => {
    try {
      loadCbcfMapping(candidate);
    } catch (error) {
      if (error instanceof CbcfMappingError) return error;
      throw error;
    }
    throw new Error('The mapping was accepted');
  };

  it('refuses the pending mapping', () => {
    const error = refusal(CBCF_MAPPING);
    expect(error.code).toBe('cbcf_not_confirmed');
    expect(error.name).toBe('CbcfMappingError');
    expect(error).toBeInstanceOf(Error);
  });

  it('refuses a mapping that says it is confirmed but names no source', () => {
    expect(refusal({ ...TEST_DOUBLE, source: null }).code).toBe('cbcf_source_missing');
    expect(refusal({ ...TEST_DOUBLE, source: { ...TEST_DOUBLE.source, name: '  ' } }).code).toBe(
      'cbcf_source_missing',
    );
  });

  it('refuses a confirmed mapping that is incomplete, and says which parts', () => {
    const error = refusal({ ...TEST_DOUBLE, behaviours: [] });
    expect(error.code).toBe('cbcf_invalid');
    expect(error.problems.join(' ')).toMatch(/behaviours/);
  });

  it('refuses anything that is not an object', () => {
    for (const candidate of [null, undefined, 'confirmed', 42, ['confirmed']]) {
      expect(refusal(candidate).code).toBe('cbcf_invalid');
    }
  });

  it('keeps the mapping content out of its error messages', () => {
    const error = refusal({ ...TEST_DOUBLE, behaviours: [] });
    expect(error.message).not.toContain('Placeholder');
  });

  it('accepts a confirmed mapping with a named source, and hands its behaviours over', () => {
    const mapping = loadCbcfMapping(TEST_DOUBLE);
    expect(mapping.status).toBe('confirmed');
    expect(cbcfBehaviours(mapping).map((b) => b.id)).toEqual(['TEST-BEHAVIOUR']);
  });

  it('does not change what a report says, because nothing loads a mapping yet', () => {
    loadCbcfMapping(TEST_DOUBLE);
    expect(evaluate(strongCall()).cbcf?.status).toBe('awaiting-authoritative-source');
  });
});

describe('model-written text', () => {
  it('loses any sentence that names CBCF, and keeps the rest', () => {
    expect(
      withoutCbcfMentions(
        'You opened well. This call is CBCF compliant. Ask one question at a time.',
      ),
    ).toBe('You opened well. Ask one question at a time.');
    expect(withoutCbcfMentions('That meets cbcf standards.')).toBe('');
  });

  it('is left alone when it does not mention CBCF', () => {
    const text = 'You opened well. Ask one question at a time.';
    expect(withoutCbcfMentions(text)).toBe(text);
  });
});
