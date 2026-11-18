import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  IMPACTS,
  ISSUE_TYPES,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
  type DiscoveryIntent,
} from '#shared/domain/vocab.ts';
import { openingMessage } from '../engine/session.ts';
import { simulate } from '../engine/simulate.ts';
import { distinctiveTokens, getScenarioLibrary, loadScenarios } from './index.ts';

const library = getScenarioLibrary();

// A considerate opening that builds trust and acknowledges impact before any fact is asked for.
const LEAD_IN = [
  "Hello, thanks for calling. I'm sorry you're dealing with this, that sounds really frustrating. Can you tell me what is happening?",
  'I can see how this is affecting you and your team, and I want to help get it sorted. How urgent is it for you?',
  "I understand, that must be stressful. I'll stay with you on this until we have a plan.",
];

const CANONICAL_QUESTIONS: Record<DiscoveryIntent, string> = {
  problem_description: 'Can you describe what is happening?',
  error_message: 'What exactly does the error message say?',
  timing_onset: 'When did this start, and when did it last work?',
  recent_changes:
    'Has anything changed recently, like an update, a setting or a new configuration?',
  affected_scope: 'Who is affected, just you or other people as well?',
  business_impact: 'How is this impacting your business or your work?',
  workaround: 'Is there a workaround you are using at the moment?',
  already_tried: 'What have you already tried to fix it?',
  environment: 'Which browser, device and version are you using?',
  reproducibility: 'Does it happen every time, and what are the steps to reproduce it?',
  previous_contact: 'Have you contacted us about this before, and what were you told?',
  urgency_deadline: 'Is there a deadline we need to work to?',
  expected_outcome: 'What outcome are you hoping for?',
  account_details: 'Which account or licence plan are you on?',
};

describe('scenario library', () => {
  it('loads without any validation errors', () => {
    expect(loadScenarios().errors).toEqual([]);
    expect(library.length).toBeGreaterThanOrEqual(12);
  });

  it('covers the range of situations the product promises', () => {
    const used = <T>(pick: (s: (typeof library)[number]) => T) => new Set(library.map(pick));
    expect([...used((s) => s.difficulty)].sort()).toEqual([...DIFFICULTIES].sort());
    expect([...used((s) => s.startingTemperature)].sort()).toEqual([...START_TEMPERATURES].sort());
    expect([...used((s) => s.style)].sort()).toEqual([...STYLES].sort());
    expect([...used((s) => s.callStage)].sort()).toEqual([...CALL_STAGES].sort());
    expect([...used((s) => s.impact)].sort()).toEqual([...IMPACTS].sort());
    expect([...used((s) => s.proficiency)].sort()).toEqual([...PROFICIENCIES].sort());
    expect(used((s) => s.issueType).size).toBeGreaterThanOrEqual(6);
    expect(ISSUE_TYPES.length).toBeGreaterThanOrEqual(used((s) => s.issueType).size);
    expect(library.filter((s) => s.enabled && s.spotlight)).toHaveLength(1);
  });

  it('contains no real-looking contact details or links', () => {
    for (const scenario of library) {
      const text = JSON.stringify(scenario);
      expect(text, scenario.id).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(text, scenario.id).not.toMatch(/https?:\/\/|www\./i);
      expect(text, scenario.id).not.toMatch(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/);
    }
  });

  it('never reveals a hidden fact in the opening, whatever the settings', () => {
    for (const scenario of library) {
      for (const impact of IMPACTS) {
        for (const callStage of CALL_STAGES) {
          for (const style of STYLES) {
            for (const startingTemperature of START_TEMPERATURES) {
              const effective = applyConfig(
                scenario,
                { impact, callStage, style, startingTemperature, difficulty: 'challenge' },
                { seed: 3 },
              );
              const opening = openingMessage(effective).toLowerCase();
              for (const fact of effective.hiddenFacts) {
                const label = `${scenario.id} ${impact}/${callStage}/${style}/${startingTemperature} ${fact.id}`;
                expect(opening, label).not.toContain(fact.statement.toLowerCase());
                for (const token of distinctiveTokens(fact.statement)) {
                  expect(opening, `${label} token ${token}`).not.toContain(token);
                }
              }
            }
          }
        }
      }
    }
  });

  it('lets a good conversation discover every hidden fact in play, at every difficulty', async () => {
    for (const scenario of library) {
      for (const difficulty of DIFFICULTIES) {
        const effective = applyConfig(scenario, { difficulty, curveballs: [] }, { seed: 11 });
        const questions = effective.hiddenFacts
          .filter((f) => (f.cues?.length ?? 0) > 0)
          .map((f) => `Could you tell me more about ${f.cues?.[0]}?`);
        const result = await simulate(effective, [...LEAD_IN, ...questions]);
        for (const fact of effective.hiddenFacts) {
          if ((fact.cues?.length ?? 0) === 0) continue;
          expect(
            result.runtime.discovery[fact.id]?.status,
            `${scenario.id} (${difficulty}): ${fact.id} should be discoverable via "${fact.cues?.[0]}"`,
          ).toBe('discovered');
        }
      }
    }
  });

  it('lets a good conversation discover facts that are found by topic rather than by cue', async () => {
    for (const scenario of library) {
      for (const difficulty of DIFFICULTIES) {
        const effective = applyConfig(scenario, { difficulty, curveballs: [] }, { seed: 13 });
        const byTopic = effective.hiddenFacts.filter((f) => (f.cues?.length ?? 0) === 0);
        const questions = [...new Set(byTopic.flatMap((f) => f.intents))].map(
          (intent) => CANONICAL_QUESTIONS[intent],
        );
        const result = await simulate(effective, [...LEAD_IN, ...questions]);
        for (const fact of byTopic) {
          expect(
            result.runtime.discovery[fact.id]?.status,
            `${scenario.id} (${difficulty}): ${fact.id} should be discoverable by asking about ${fact.intents.join(' or ')}`,
          ).toBe('discovered');
        }
      }
    }
  });

  it('keeps hidden facts hidden when the trainee never asks about them', async () => {
    for (const scenario of library) {
      for (const difficulty of DIFFICULTIES) {
        const effective = applyConfig(scenario, { difficulty, curveballs: [] }, { seed: 5 });
        const result = await simulate(effective, [
          'Okay.',
          'Right, thanks for that.',
          'I will note that down.',
          'Let me think about it.',
        ]);
        const found = Object.values(result.runtime.discovery).filter(
          (d) => d.status === 'discovered',
        );
        expect(found, `${scenario.id} (${difficulty})`).toEqual([]);
      }
    }
  });
});
