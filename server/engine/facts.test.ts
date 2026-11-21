import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import { sentenceCount } from './conform.ts';
import { composeCustomerReply } from './mock/customer.ts';
import { mockClassifier, mockGenerate } from './mock/index.ts';
import { processTraineeTurn, type CustomerGenerationContext } from './pipeline.ts';
import { planReply } from './plan.ts';
import { createInitialRuntime, openingMessage } from './session.ts';
import { simulate, type Simulation } from './simulate.ts';
import {
  captureContexts,
  makeDefinition,
  makeScenario,
  makeScopeScenario,
  SCOPE_LINES,
  type ScriptedLine,
} from './testing.ts';
import { bestSentenceFor } from './textutil.ts';
import type { TranscriptTurn } from './types.ts';

const GREET = 'Good morning, this is Sam from Microsoft support. How can I help?';

type Overrides = Parameters<typeof makeScenario>[0];
const talk = (overrides: Overrides, lines: string[], seed = 7): Promise<Simulation> =>
  simulate(makeScenario(overrides, seed), lines);
const reply = (sim: Simulation, turn: number) => sim.turns[turn]?.customer ?? '';

// ---------------------------------------------------------------------------------------

describe('vague facts', () => {
  it('are said with a hedge, and firmed up when the engineer narrows it down or asks to confirm', async () => {
    const sim = await talk({ startingTemperature: 'calm' }, [
      GREET,
      'Which version of Outlook are you using?',
      'Can you confirm that it is the new Outlook?',
    ]);
    expect(reply(sim, 1)).toMatch(/couldn't swear to it/);
    expect(reply(sim, 2)).toMatch(/just had another look and it's the newer Outlook/);
    expect(reply(sim, 2)).not.toMatch(/couldn't swear/);
    expect(sim.runtime.toldKnownFacts['vf-outlook-app']).toBeGreaterThan(0);
    expect(sim.runtime.toldKnownFacts['vf-outlook-app#confirmed']).toBeGreaterThan(0);
  });

  it('are not said for a broad question that none of their cues pick out', async () => {
    const sim = await talk({ startingTemperature: 'calm' }, [GREET, 'What laptop are you using?']);
    expect(reply(sim, 1)).not.toMatch(/newer Outlook/);
    expect(sim.runtime.toldKnownFacts['vf-outlook-app']).toBeUndefined();
  });
});

describe('facts the customer has to check', () => {
  it('start with a moment to check, and give the answer in the same reply', async () => {
    const sim = await talk({ startingTemperature: 'calm' }, [
      GREET,
      'How many people are affected?',
    ]);
    const said = reply(sim, 1);
    expect(said).toMatch(/give me a second, i'll ask the others/i);
    expect(said).toMatch(/me and one colleague/);
    expect(said.indexOf('ask the others')).toBeLessThan(said.indexOf('one colleague'));
  });
});

describe('what the customer does not know', () => {
  const ask = 'Has the administrator changed any sign-in policy?';

  it('is an honest "I do not have that", with who would know and an offer to ask them', async () => {
    const sim = await talk({ startingTemperature: 'calm', style: 'talkative' }, [GREET, ask]);
    expect(reply(sim, 1)).toMatch(/don't have that to hand/);
    expect(reply(sim, 1)).toMatch(/administrator/i);
    expect(reply(sim, 1)).toMatch(/can ask them and let you know/);
    expect(
      sim.runtime.commitments.some(
        (c) => c.by === 'customer' && c.action === 'ask our administrator',
      ),
    ).toBe(true);
  });

  it('is never made up: no number, name or date comes into the answer', async () => {
    const styles = ['talkative', 'terse', 'demanding', 'vague', 'non-native'] as const;
    for (const style of styles) {
      const sim = await talk({ startingTemperature: 'calm', style }, [GREET, ask]);
      const said = reply(sim, 1);
      expect(said, style).not.toMatch(/\d/);
      expect(said, style).toMatch(/administrator|don't have|do not have|not sure|don't know/i);
    }
  });

  it('is remembered: asked again, the customer still has to ask; and at the end of the call they say so', async () => {
    const sim = await talk({ startingTemperature: 'calm', style: 'talkative' }, [
      GREET,
      ask,
      'Who manages the sign-in rules then?',
      'To recap, I will call you back by 3pm. Is there anything else I can help with?',
    ]);
    expect(reply(sim, 2)).toMatch(/still need to ask our administrator/i);
    expect(reply(sim, 3)).toMatch(/administrator/i);
  });

  it('gives way to a hidden fact when the question is aimed at it, and not otherwise', async () => {
    // The hidden fact about timing and the unknown fact about sign-in rules both answer questions
    // about what changed. A question that asks when it started is aimed at the hidden fact.
    const aimed = await talk({ startingTemperature: 'calm' }, [
      GREET,
      'When did it start, and did anyone change the sign-in policy?',
    ]);
    expect(reply(aimed, 1)).toMatch(/ten past eight/);
    expect(reply(aimed, 1)).not.toMatch(/don't have that to hand/);
    expect(aimed.runtime.discovery['hf-reset-timing']?.status).toBe('discovered');

    const general = await talk({ startingTemperature: 'calm' }, [GREET, ask]);
    expect(reply(general, 1)).toMatch(/don't have that to hand/);
    expect(general.runtime.discovery['hf-reset-timing']).toBeUndefined();
  });
});

describe('asides that have nothing to do with the problem', () => {
  it('are only ever said by a talkative customer', async () => {
    const lines = [
      GREET,
      'What laptop are you using?',
      'What does the sign-in screen say?',
      'When did it start?',
      'What have you tried?',
      'Is there anyone else affected?',
    ];
    let heard = false;
    for (const style of ['talkative', 'terse', 'demanding', 'vague', 'non-native'] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        const sim = await talk({ style, startingTemperature: 'calm' }, lines, seed);
        const all = sim.turns.map((t) => t.customer).join(' ');
        const aside = /parking|printer/i.test(all);
        if (style === 'talkative') heard ||= aside;
        else expect(aside, `${style}/${seed}`).toBe(false);
      }
    }
    expect(heard).toBe(true);
  });
});

describe('facts that a question has to pick out in demo mode', () => {
  async function toldAfter(question: string, matching: 'rules' | 'model') {
    const scenario = makeScenario({ startingTemperature: 'calm' });
    let runtime = createInitialRuntime(scenario);
    const history: TranscriptTurn[] = [
      { index: 1, role: 'customer', text: openingMessage(scenario) },
    ];
    const result = await processTraineeTurn({
      scenario,
      runtime,
      traineeText: question,
      turnIndex: 2,
      history,
      classify: mockClassifier(scenario),
      generate: mockGenerate,
      matching,
    });
    runtime = result.runtime;
    return Object.keys(runtime.toldKnownFacts);
  }

  it('need one of their cues in the question, while a model that reads the question needs none', async () => {
    // "What kind of computer" is about the setup, but says nothing that points at the Outlook version.
    const question = 'Hello, I am Sam. What kind of computer and software are you using?';
    expect(await toldAfter(question, 'rules')).not.toContain('vf-outlook-app');
    expect(await toldAfter(question, 'model')).toContain('vf-outlook-app');
  });
});

describe('what the case already records', () => {
  it("is said in the customer's own words when they are asked what they have tried or what changed", async () => {
    // A starter call has no hidden fact about what was tried, so the customer answers from the case.
    const sim = await talk({ difficulty: 'starter', startingTemperature: 'calm' }, [
      GREET,
      'What have you already tried?',
      'Has anything changed recently?',
    ]);
    expect(reply(sim, 1)).toMatch(/I typed the new password again several times/);
    expect(reply(sim, 1)).toMatch(/I restarted the laptop once/);
    expect(reply(sim, 2)).toMatch(/I changed the password this morning after the reminder email/);
  });

  it('keeps back a note that gives a hidden fact away until the fact has been earned', async () => {
    const definition = makeDefinition({
      difficulty: 'starter',
      previousTroubleshooting: [
        'Typed the new password again several times',
        'Read that the sign-in message says the account has been temporarily locked after too many sign-in attempts',
      ],
    });
    const scenario = applyConfig(
      definition,
      { difficulty: 'starter' },
      { seed: 7, timeOfDay: 'morning' },
    );
    const sim = await simulate(scenario, [
      GREET,
      'What have you already tried?',
      'Can you read me exactly what the sign-in screen says?',
      'And what else have you already tried?',
    ]);
    expect(reply(sim, 1)).toMatch(/typed the new password again/i);
    expect(reply(sim, 1)).not.toMatch(/temporarily locked/);
    expect(reply(sim, 2)).toMatch(/temporarily locked/);
    expect(sim.runtime.discovery['hf-lockout-message']?.status).toBe('discovered');
  });
});

// The engineer earned how many people are affected, and asks about it again. The customer says the
// count again: not another fact that happens to share the topic ("email and chat work normally").
describe('what the customer says when the same thing is asked again', () => {
  it('is the answer they gave, when a model reads the question and names no fact', async () => {
    const contexts = await captureContexts(makeScopeScenario(), [GREET, ...SCOPE_LINES], {
      matching: 'model',
    });
    const again = contexts.slice(2);
    expect(again.map((ctx) => ctx.discovery.kind)).toEqual(['clarification', 'repeat']);
    for (const ctx of again) {
      const reminder = planReply(ctx).say.find((item) => item.kind === 'reminder');
      expect(reminder?.id).toBe('hf-count');
      expect(reminder?.text).toBe(
        "I make it 27 people across sales and the executive office who can't sign in.",
      );
      const said = composeCustomerReply(ctx).text;
      expect(said).toContain('27 people');
      expect(said).not.toMatch(/email and chat/i);
    }
  });

  it('is not made "specific" by cues that the question did not contain', async () => {
    const [, , asked] = await captureContexts(makeScopeScenario(), [GREET, ...SCOPE_LINES], {
      matching: 'model',
    });
    const item = asked?.discovery.tell.find((t) => t.id === 'kf-rest-works');
    expect(item).toMatchObject({ repeat: true, specific: false });
  });

  // The count is earned by a question the model read as being about the problem, so the general
  // answer about the impact has not been given when the count is asked about.
  const COUNT_EARNED = {
    ...SCOPE_LINES[0],
    classification: {
      ...SCOPE_LINES[0]?.classification,
      discoveryIntents: ['problem_description'],
    },
  } as ScriptedLine;

  it('is the count rather than the general answer about impact, which it was not asked for', async () => {
    const [, , asked] = await captureContexts(
      makeScopeScenario(),
      [GREET, COUNT_EARNED, SCOPE_LINES[1] as ScriptedLine],
      { matching: 'model' },
    );
    expect(asked?.discovery.tell.map((t) => t.id)).not.toContain('impact-detail');
    expect(asked?.discovery.kind).toBe('clarification');
    expect(composeCustomerReply(asked as CustomerGenerationContext).text).toContain('27 people');
  });

  it('still answers a question about the business impact, which the count does not answer', async () => {
    const [, , asked] = await captureContexts(
      makeScopeScenario(),
      [
        GREET,
        COUNT_EARNED,
        {
          text: 'What does this mean for the business?',
          classification: {
            askedQuestion: true,
            discoveryIntents: ['business_impact'],
            factTargets: [],
          },
        },
      ],
      { matching: 'model' },
    );
    expect(asked?.discovery.tell.map((t) => t.id)).toContain('impact-detail');
    expect(asked?.discovery.kind).toBe('new');
  });

  it('is the same in demo mode, where the cues pick the answer out', async () => {
    const sim = await simulate(makeScopeScenario(), [
      GREET,
      'Who else is affected by this?',
      'How many people does this affect?',
      'How many people did you say are affected?',
    ]);
    expect(reply(sim, 1)).toContain('27 people');
    expect(reply(sim, 2)).toContain('27 people');
    expect(reply(sim, 3)).toContain('27 people');
    expect(reply(sim, 3)).toMatch(/as i (?:said|told|mentioned)|already/i);
  });

  it('is the answer again, in a few words, for a terse customer of any mood', async () => {
    for (const startingTemperature of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
      const scenario = makeScopeScenario('terse', startingTemperature);
      // Asked again in other words (a follow-up) and then in the same words (a repeat).
      const contexts = await captureContexts(scenario, [GREET, ...SCOPE_LINES], {
        matching: 'model',
      });
      const again = contexts.slice(2);
      expect(again.map((ctx) => ctx.discovery.kind)).toEqual(['clarification', 'repeat']);
      for (const ctx of again) {
        const said = composeCustomerReply(ctx).text;
        expect(said, `${startingTemperature}: ${said}`).toContain('27 people');
        expect(sentenceCount(said), said).toBeLessThanOrEqual(2);
      }
      // And the same through the rules, which find the topic by its cues.
      const sim = await simulate(scenario, [
        GREET,
        'How many people does this affect?',
        'How many people did you say are affected?',
      ]);
      expect(reply(sim, 1), startingTemperature).toContain('27 people');
      expect(reply(sim, 2), startingTemperature).toContain('27 people');
    }
  });

  it('is the sentence of the answer that answers the question, when the answer has several', () => {
    const answer =
      "It isn't only me. I make it 27 people across sales and the executive office. We are all stuck.";
    expect(bestSentenceFor(answer, 'How many people does this affect?')).toBe(
      'I make it 27 people across sales and the executive office.',
    );
    expect(bestSentenceFor(answer, 'Who is stuck?')).toBe('We are all stuck.');
    expect(bestSentenceFor('Just me.', 'How many people?')).toBe('Just me.');
  });
});
