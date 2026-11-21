import { describe, expect, it } from 'vitest';
import { CALL_STAGES } from '#shared/domain/vocab.ts';
import { makeScenario, strongCall } from '../evaluator/testing.ts';
import { BUDGETS } from '../evaluator/words.ts';
import { buildEvaluatorPrompt, PROMPT_WORD_LIMITS } from './evaluator.ts';

// The model evaluator prompt as it concerns the CARE layer, the call stage and the word budgets.
// The rest of the prompt is covered in prompts.test.ts. The scenario is the evaluator's inline
// fixture, so these tests do not move when the scenario library does.

const system = (input = strongCall()) => buildEvaluatorPrompt(input).messages[0]?.content ?? '';
const payload = (input = strongCall()) =>
  JSON.parse(buildEvaluatorPrompt(input).messages[1]?.content ?? '{}');

describe('the evaluator prompt and the call stage', () => {
  it('says what each stage of a call asks for, and not to mark a call down for the rest', () => {
    const text = system();
    const section = text.slice(
      text.indexOf('THE CALL STAGE'),
      text.indexOf('WHAT THE APPLICATION'),
    );
    for (const stage of CALL_STAGES) expect(section).toContain(`- ${stage}:`);
    expect(section).toMatch(/never mark it down for something its stage does not call for/);
    expect(section).toMatch(/closure: confirming the problem is resolved/);
    expect(section).toMatch(/escalated: acknowledging what the customer has already been through/);
  });

  it('sends the call stage of each call it is given', () => {
    for (const callStage of CALL_STAGES) {
      const input = strongCall(makeScenario({ callStage }));
      expect(payload(input).scenario.settings.callStage).toBe(callStage);
    }
  });

  it("sends the scenario's careExpectations, and says they describe the ideal, not the call", () => {
    const input = strongCall();
    const sent = payload(input).scenario.careExpectations;
    expect(sent).toEqual(input.scenario.careExpectations);
    expect(Object.keys(sent)).toEqual(['communicate', 'accountable', 'resourceful', 'empathetic']);
    expect(system(input)).toMatch(/careExpectations lists, for each CARE principle/);
    expect(system(input)).toMatch(/not evidence of what happened/);
  });
});

describe('the evaluator prompt and what the application decides', () => {
  it('leaves CARE levels, milestones and discovery to the application', () => {
    const text = system();
    expect(text).toMatch(/You do not return them/);
    expect(text).toMatch(/Never state a CARE level or whether a milestone was reached/);
    expect(text).toMatch(/never contradict them/);
  });

  it('tells the model nothing about CBCF beyond not to mention it', () => {
    const input = strongCall();
    const everything = JSON.stringify(buildEvaluatorPrompt(input));
    expect(everything.match(/CBCF/g)).toHaveLength(1);
    expect(system(input)).toMatch(/Never mention CBCF/);
  });

  it('does not ask the model for a CARE result, a milestone or a CBCF status', () => {
    const text = system();
    const shape = text.slice(text.indexOf('OUTPUT'));
    for (const key of ['"care"', '"cbcf"', '"milestones"', '"level"']) {
      expect(shape).not.toContain(key);
    }
  });
});

describe('the evaluator prompt and the word budgets', () => {
  it('asks for less than the server will allow, so a draft that complies is never cut', () => {
    expect(PROMPT_WORD_LIMITS.summary).toBeLessThanOrEqual(BUDGETS.summaryWords);
    // The strength's title is written by the server and shares the budget with `whyItHelped`.
    expect(PROMPT_WORD_LIMITS.whyItHelped + 10).toBeLessThanOrEqual(BUDGETS.strengthWords);
    expect(PROMPT_WORD_LIMITS.risk).toBeLessThanOrEqual(BUDGETS.riskWords);
    expect(PROMPT_WORD_LIMITS.betterPhrasing).toBeLessThanOrEqual(BUDGETS.betterPhrasingWords);
  });

  it('states each limit in the output shape', () => {
    const text = system();
    expect(text).toContain(`at most three sentences and ${PROMPT_WORD_LIMITS.summary} words`);
    expect(text).toContain(
      `"whyItHelped": string, at most ${PROMPT_WORD_LIMITS.whyItHelped} words`,
    );
    expect(text).toContain(`"risk": string, at most ${PROMPT_WORD_LIMITS.risk} words`);
    expect(text).toContain(`at most ${PROMPT_WORD_LIMITS.betterPhrasing} words`);
  });

  it("asks for a short rewrite in the trainee's own voice that states no product fact", () => {
    const text = system();
    expect(text).toMatch(/betterPhrasing is a believable rewrite/);
    expect(text).toMatch(/in the trainee's own voice/);
    expect(text).toMatch(/Never put a technical fact, a cause, a fix or a time into it/);
    expect(text).toMatch(/square brackets/);
  });

  it('asks for two or three strengths and improvements, and never one made up to fill the number', () => {
    expect(system()).toMatch(/Aim for two or three of each when it supports them/);
    expect(system()).toMatch(/Never invent one to reach a number/);
  });
});
