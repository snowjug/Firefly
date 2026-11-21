// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PublicBriefSchema, wordCount } from '#shared/domain/scenario.ts';
import { PRODUCT_INFO } from '#shared/domain/vocab.ts';
import { publicScenarios } from './testing/fixtures.ts';

// The screens are tested against these scenarios, so the scenarios have to keep to the budgets the
// screens promise: a list line of at most 18 words, a summary of at most 60, and a public brief that
// passes the real schema. If a test about copy length fails, check here first.

const all = publicScenarios();

describe('the fixture scenarios', () => {
  it.each(all.map((scenario) => [scenario.id, scenario] as const))(
    '%s keeps to the budgets',
    (_id, s) => {
      expect(wordCount(s.listSummary)).toBeLessThanOrEqual(18);
      expect(wordCount(s.listSummary)).toBeGreaterThanOrEqual(8);
      expect(wordCount(s.summary)).toBeLessThanOrEqual(60);
      expect(wordCount(s.summary)).toBeGreaterThanOrEqual(30);
      expect(PublicBriefSchema.safeParse(s.publicBrief).success).toBe(true);
      expect(s.caseReference).toMatch(/^SIM-\d{6}$/);
      expect(s.synthetic).toBe(true);
      expect(s.product.name).toBe(PRODUCT_INFO[s.product.id].name);
      expect(s.product.family).toBe(PRODUCT_INFO[s.product.id].family);
    },
  );

  it('have distinct ids and case references', () => {
    expect(new Set(all.map((scenario) => scenario.id)).size).toBe(all.length);
    expect(new Set(all.map((scenario) => scenario.caseReference)).size).toBe(all.length);
  });

  it('cover every issue type, all four call stages and all three difficulties', () => {
    expect(new Set(all.map((scenario) => scenario.issueType)).size).toBe(10);
    expect(new Set(all.map((scenario) => scenario.callStage)).size).toBe(4);
    expect(new Set(all.map((scenario) => scenario.difficulty)).size).toBe(3);
  });

  it('say nothing that gives away what a customer keeps back', () => {
    const text = JSON.stringify(all).toLowerCase();
    expect(text).not.toMatch(/hidden|revealwhen|better question|evaluator|rubric|score/);
  });
});
