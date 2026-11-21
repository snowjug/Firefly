import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { composeCustomerReply } from './mock/customer.ts';
import { PUSH_SHORT } from './mock/phrasebank.ts';
import { mockClassifier } from './mock/index.ts';
import { processTraineeTurn, type CustomerGeneration } from './pipeline.ts';
import { planReply } from './plan.ts';
import { isAsking, pressingOf } from './pressing.ts';
import { createInitialRuntime, openingMessage } from './session.ts';
import { simulate, type Simulation } from './simulate.ts';
import { captureContexts, makeDefinition } from './testing.ts';

// How much the customer asks for in the course of a call: who owns the case, when they will hear
// back, an update. They ask when they have a reason, not in every reply (see pressing.ts).

const GREET = 'Good morning, this is Sam from Microsoft support. How can I help?';
const COMMIT = "I'll take ownership of this and call you back by 3pm with an update.";
const QUESTIONS = [
  'What laptop are you using?',
  'When did it start?',
  'What does the sign-in screen say?',
  'Is anyone else affected?',
  'Which version of Outlook is it?',
  'What have you already tried?',
  'Is your work email signed in on a phone?',
  'How is this affecting your morning?',
  'Has anything changed recently?',
  'Is there anything else you noticed?',
  'Can you try signing in on the web version?',
  'Does it happen on your other devices?',
];

// A customer who hopes for an owner and a time, as authors write them: this is what once had even
// a calm customer asking for both in the first half of the call.
const scenarioFor = (overrides: ScenarioOverrides, seed = 7) =>
  applyConfig(
    makeDefinition({
      customerExpectation: 'Someone who takes charge and says when she will hear back.',
    }),
    { difficulty: 'standard', curveballs: [], ...overrides },
    { seed, timeOfDay: 'morning' },
  );

/** Where in the call the plan has the customer ask for something, and what for. */
async function asksIn(overrides: ScenarioOverrides, lines: string[], seed = 7) {
  const contexts = await captureContexts(scenarioFor(overrides, seed), lines);
  return contexts.flatMap((ctx) => {
    const plan = planReply(ctx);
    const ask = plan.push ?? (isAsking(plan.flavour) ? plan.flavour : null);
    return ask ? [{ turn: ctx.effectiveTurn, trainee: ctx.traineeTurnNumber, ask }] : [];
  });
}

/** The trainee turns at which the customer asked, as the engine remembers them. */
const askedAt = (sim: Simulation) =>
  sim.turns.flatMap((t, i) =>
    Math.max(0, ...Object.values(t.runtime.pushes)) === i + 1 ? [i + 1] : [],
  );

describe('a calm customer', () => {
  it('waits, and asks only once or twice in a long call, though they hope for an owner and a time', async () => {
    let asked = 0;
    for (const style of ['talkative', 'terse'] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        const asks = await asksIn(
          { startingTemperature: 'calm', style, callStage: 'first-contact' },
          [GREET, ...QUESTIONS],
          seed,
        );
        asked += asks.length;
        expect(asks.length, `${style}/${seed}`).toBeLessThanOrEqual(2);
        for (const ask of asks) expect(ask.turn, `${style}/${seed}`).toBeGreaterThanOrEqual(7);
      }
    }
    // Rarely is not never: the customer does ask in the end.
    expect(asked).toBeGreaterThan(0);
  });

  it('does not ask in the first five turns of a starter call, whatever they hope for', async () => {
    const lines = [GREET, ...QUESTIONS.slice(0, 5)];
    for (let seed = 1; seed <= 8; seed++) {
      const asks = await asksIn(
        {
          startingTemperature: 'calm',
          style: 'terse',
          proficiency: 'novice',
          difficulty: 'starter',
          callStage: 'first-contact',
        },
        lines,
        seed,
      );
      expect(asks, `seed ${seed}`).toEqual([]);
    }
  });

  it('may ask earlier on a call back, whose purpose is to hear how the case stands', async () => {
    const asks = await asksIn({ startingTemperature: 'calm', callStage: 'follow-up' }, [
      GREET,
      ...QUESTIONS.slice(0, 4),
    ]);
    expect(asks.map((a) => a.ask)).toContain('update');
    expect(Math.min(...asks.map((a) => a.turn))).toBeLessThan(7);
  });
});

describe('how often the customer asks', () => {
  it('is never in two replies running, whatever their mood or style', async () => {
    let asked = 0;
    for (const startingTemperature of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
      for (const style of ['talkative', 'demanding'] as const) {
        for (const callStage of ['first-contact', 'follow-up', 'escalated'] as const) {
          for (let seed = 1; seed <= 3; seed++) {
            const sim = await simulate(
              scenarioFor({ startingTemperature, style, callStage }, seed),
              [GREET, ...QUESTIONS],
            );
            const turns = askedAt(sim);
            asked += turns.length;
            turns.slice(1).forEach((turn, i) => {
              const where = `${startingTemperature}/${style}/${callStage}/${seed}: ${turns.join(',')}`;
              expect(turn - (turns[i] as number), where).toBeGreaterThanOrEqual(2);
            });
          }
        }
      }
    }
    // The customers do ask: it is the spacing that is tested.
    expect(asked).toBeGreaterThan(30);
  });

  it('waits longer the calmer the customer, and counts a concern they raised as something asked', async () => {
    const [ctx] = (await captureContexts(scenarioFor({ callStage: 'follow-up' }), [GREET])).slice(
      -1,
    );
    if (!ctx) throw new Error('no context');
    const open = (tone: 'calm' | 'worried' | 'firm' | 'hot', since: number, lastCurveball = 0) =>
      pressingOf(
        {
          ...ctx,
          traineeTurnNumber: 10,
          runtime: {
            ...ctx.runtime,
            pushes: { owner: 10 - since },
            lastCurveballTurn: lastCurveball,
          },
        },
        tone,
      ).open;
    // Trainee turns since the last ask that are enough, for each mood.
    expect([open('calm', 5), open('calm', 6)]).toEqual([false, true]);
    expect([open('worried', 2), open('worried', 3)]).toEqual([false, true]);
    expect([open('firm', 2), open('firm', 3)]).toEqual([false, true]);
    expect([open('hot', 1), open('hot', 2)]).toEqual([false, true]);
    // A manager asked for, or a concern raised, a turn ago is an ask like any other.
    expect(open('hot', 9, 9)).toBe(false);
    expect(open('hot', 9, 8)).toBe(true);
  });

  it('is remembered by the engine for every kind of ask, so that none can follow at once', async () => {
    const scenario = scenarioFor({ callStage: 'follow-up', startingTemperature: 'angry' });
    const pushesAfter = async (bookkeeping: NonNullable<CustomerGeneration['bookkeeping']>) => {
      const result = await processTraineeTurn({
        scenario,
        runtime: createInitialRuntime(scenario),
        traineeText: 'What laptop are you using?',
        turnIndex: 2,
        history: [{ index: 1, role: 'customer', text: openingMessage(scenario) }],
        classify: mockClassifier(scenario),
        generate: () => Promise.resolve({ text: 'A Dell.', source: 'live', bookkeeping }),
      });
      return result.runtime.pushes;
    };
    expect(await pushesAfter({ flavoured: 'plan' })).toEqual({ plan: 1 });
    expect(await pushesAfter({ followUpGiven: true })).toEqual({ 'follow-up': 1 });
    // Worry is not an ask.
    expect(await pushesAfter({ flavoured: 'impact-worry' })).toEqual({});
  });
});

describe('what the customer does once an owner and a time have been given', () => {
  const upset = [
    ['anxious', 'demanding'],
    ['frustrated', 'talkative'],
    ['angry', 'talkative'],
  ] as const;

  it('stops asking for them, or for an update, or for anything about who is on the case', async () => {
    for (const callStage of ['first-contact', 'follow-up', 'escalated'] as const) {
      for (const [startingTemperature, style] of upset) {
        for (let seed = 1; seed <= 3; seed++) {
          const overrides = { callStage, startingTemperature, style } as const;
          const where = `${callStage}/${startingTemperature}/${style}/${seed}`;
          const lines = [GREET, 'What laptop are you using?', COMMIT, ...QUESTIONS.slice(0, 9)];
          const contexts = await captureContexts(scenarioFor(overrides, seed), lines);
          // The engineer's words count as an owner and a time.
          expect(contexts[2]?.runtime.customer, where).toMatchObject({
            ownershipStated: true,
            nextStepsStated: true,
          });
          const after = (await asksIn(overrides, lines, seed)).filter((a) => a.trainee >= 3);
          expect(after, where).toEqual([]);
        }
      }
    }
  });

  it('is asking again until then, so that it is the commitment that stopped them', async () => {
    let asked = 0;
    for (const [startingTemperature, style] of upset) {
      for (let seed = 1; seed <= 3; seed++) {
        const lines = [GREET, 'What laptop are you using?', 'Let me check that.', ...QUESTIONS];
        const asks = await asksIn(
          { callStage: 'follow-up', startingTemperature, style },
          lines,
          seed,
        );
        asked += asks.filter((a) => a.trainee >= 3).length;
      }
    }
    expect(asked).toBeGreaterThan(6);
  });

  it('does not stop a closing call asking what changed, which is why they called', async () => {
    const contexts = await captureContexts(scenarioFor({ callStage: 'closure' }), [
      GREET,
      COMMIT,
      'Is there anything else I can help with?',
    ]);
    expect(planReply(contexts[2] as (typeof contexts)[number]).push).toBe('cause');
  });
});

describe('a reply that already asks the engineer for something', () => {
  it('does not ask for something else as well', async () => {
    const overrides = {
      callStage: 'follow-up',
      startingTemperature: 'frustrated',
      style: 'talkative',
    } as const;
    const first = [GREET, 'What laptop are you using?'];
    // It is time to ask where the case stands...
    const plain = await captureContexts(scenarioFor(overrides), [
      ...first,
      'Which version of Outlook is it?',
    ]);
    expect(planReply(plain[2] as (typeof plain)[number]).push).toBe('update');
    // ...but not in a reply that is already challenging a vague promise.
    const vague = await captureContexts(scenarioFor(overrides), [...first, 'Let me check that.']);
    const plan = planReply(vague[2] as (typeof vague)[number]);
    expect(plan.reactions).toContain('vague-commitment');
    expect(plan.push).toBeNull();
    expect(plan.flavour).toBeNull();
  });
});

describe('a first call', () => {
  it('does not start asking for things before the engineer has asked about the problem', async () => {
    const chat = [
      'Thanks for holding.',
      'Let me just get your details up.',
      'Right, one moment.',
      'Okay, bear with me.',
      'Sorry, still loading.',
      'Nearly there.',
    ];
    const impatient = {
      startingTemperature: 'angry',
      style: 'demanding',
      callStage: 'first-contact',
    } as const;
    for (let seed = 1; seed <= 4; seed++) {
      expect(await asksIn(impatient, [GREET, ...chat], seed), `seed ${seed}`).toEqual([]);
      // The same customer, asked about the problem, does ask.
      const scoped = await asksIn(impatient, [GREET, ...QUESTIONS.slice(0, 6)], seed);
      expect(scoped.length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });
});

describe('a terse customer', () => {
  it('asks in a few words', async () => {
    let asked = 0;
    for (const startingTemperature of ['anxious', 'frustrated', 'angry'] as const) {
      for (let seed = 1; seed <= 4; seed++) {
        const contexts = await captureContexts(
          scenarioFor({ startingTemperature, style: 'terse', callStage: 'follow-up' }, seed),
          [GREET, 'What laptop are you using?', 'Let me check that.', 'One moment please.'],
        );
        for (const ctx of contexts) {
          const { push } = planReply(ctx);
          const said = composeCustomerReply(ctx);
          if (!push || said.pushed !== push) continue;
          asked += 1;
          const line = PUSH_SHORT[push].find((candidate) => said.text.includes(candidate));
          expect(line, said.text).toBeDefined();
        }
      }
    }
    expect(asked).toBeGreaterThan(0);
  });

  it('adds no lines of personality to what was asked', async () => {
    for (const startingTemperature of ['anxious', 'frustrated', 'angry'] as const) {
      for (let seed = 1; seed <= 4; seed++) {
        const contexts = await captureContexts(
          scenarioFor({ startingTemperature, style: 'terse' }, seed),
          [GREET, ...QUESTIONS.slice(0, 6)],
        );
        for (const ctx of contexts) expect(planReply(ctx).flavour).toBeNull();
      }
    }
  });
});
