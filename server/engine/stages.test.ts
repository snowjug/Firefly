import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import { expectationsOf } from './expectation.ts';
import { planReply } from './plan.ts';
import { simulate, type Simulation } from './simulate.ts';
import { captureContexts, FIXTURE_INPUT, makeDefinition, makeScenario } from './testing.ts';

const GREET = 'Good morning, this is Sam from Microsoft support. How can I help?';

type Overrides = Parameters<typeof makeScenario>[0];
const talk = (overrides: Overrides, lines: string[], seed = 7): Promise<Simulation> =>
  simulate(makeScenario(overrides, seed), lines);
const reply = (sim: Simulation, turn: number) => sim.turns[turn]?.customer ?? '';
const reasons = (sim: Simulation, turn: number) =>
  sim.turns[turn]?.events.map((e) => e.reason) ?? [];
const allReasons = (sim: Simulation) => sim.events.map((e) => e.reason);

// ---------------------------------------------------------------------------------------

describe('a call back about an earlier contact', () => {
  it('answers "have you contacted us before?" with what the case says, as something already said', async () => {
    const sim = await talk({ callStage: 'follow-up', startingTemperature: 'frustrated' }, [
      GREET,
      'Have you contacted us before?',
    ]);
    expect(reply(sim, 1)).toMatch(/as (?:i|it)\b.*(?:told|said|mentioned|says)|as i've/i);
    expect(reply(sim, 1)).toMatch(
      /following up on the Outlook sign-in problem I reported yesterday/,
    );
    expect(reasons(sim, 1)).toContain('Asked about earlier contact that was already on the case');
  });

  it('answers it plainly, and charges nothing, when this is the first contact', async () => {
    const sim = await talk({ callStage: 'first-contact', startingTemperature: 'calm' }, [
      GREET,
      'Have you contacted us before?',
    ]);
    expect(reply(sim, 1)).toMatch(/first time I'm calling about it/);
    expect(reply(sim, 1)).not.toMatch(/as I told you/i);
    expect(allReasons(sim)).not.toContain(
      'Asked about earlier contact that was already on the case',
    );
  });

  it('says what was tried as "as I told you before", and charges a little for asking', async () => {
    // Nothing else in the scenario answers "what have you tried", so the case is all there is.
    const definition = makeDefinition({
      knownFacts: FIXTURE_INPUT.knownFacts.map((f) => ({
        ...f,
        intents: f.intents.filter((i) => i !== 'already_tried'),
      })),
    });
    const scenario = applyConfig(
      definition,
      { callStage: 'follow-up', difficulty: 'starter', startingTemperature: 'frustrated' },
      { seed: 7, timeOfDay: 'morning' },
    );
    const sim = await simulate(scenario, [GREET, 'What have you already tried?']);
    expect(reply(sim, 1)).toMatch(/as i/i);
    expect(reply(sim, 1)).toMatch(/I typed the new password again several times/);
    expect(reasons(sim, 1)).toContain('Asked what had been tried, which was already on the case');
  });

  it('does not charge for it when asking brought out something that was not on the case', async () => {
    const sim = await talk({ callStage: 'follow-up', startingTemperature: 'frustrated' }, [
      GREET,
      'What have you already tried?',
    ]);
    expect(reply(sim, 1)).toMatch(/six times/);
    expect(allReasons(sim)).not.toContain(
      'Asked what had been tried, which was already on the case',
    );
  });

  describe('when the scenario says what was tried both as an answer and on the case', () => {
    const definition = makeDefinition({
      knownFacts: [
        ...FIXTURE_INPUT.knownFacts.map((f) => ({
          ...f,
          intents: f.intents.filter((i) => i !== 'already_tried'),
        })),
        {
          id: 'kf-tabs',
          text: "I closed a few tabs and programs, but it didn't help much.",
          intents: ['already_tried'],
        },
      ],
      previousTroubleshooting: [
        'Closed some browser tabs and programs, which made no real difference',
      ],
    });
    const ask = (callStage: 'first-contact' | 'follow-up') =>
      simulate(
        applyConfig(
          definition,
          { callStage, difficulty: 'starter', startingTemperature: 'frustrated' },
          { seed: 7, timeOfDay: 'morning' },
        ),
        [GREET, 'What have you already tried?'],
      );

    it('says it from the case on a call back, once', async () => {
      const text = reply(await ask('follow-up'), 1);
      expect(text).toMatch(/as i/i);
      expect(text).toMatch(/some browser tabs and programs/);
      expect(text).not.toMatch(/a few tabs/);
    });

    it('says it as the customer would on a first contact, once', async () => {
      const text = reply(await ask('first-contact'), 1);
      expect(text).toMatch(/a few tabs and programs/);
      expect(text).not.toMatch(/some browser tabs/);
    });
  });

  it('is relieved when the engineer shows they know the case, and is not when they ask again', async () => {
    const informed = await talk({ callStage: 'follow-up', startingTemperature: 'frustrated' }, [
      GREET,
      'I can see your case from yesterday, and I am sorry nobody has updated you.',
    ]);
    expect(reasons(informed, 1)).toContain('Showed they knew about the earlier case');
    expect(reply(informed, 1)).toMatch(
      /know what's been going on|seen the case|have the case|a start/i,
    );

    const unaware = await talk({ callStage: 'follow-up', startingTemperature: 'frustrated' }, [
      GREET,
      'Can you tell me the whole story again from the beginning?',
    ]);
    expect(reasons(unaware, 1)).toContain('Asked the customer to tell the whole story again');
    expect(reply(unaware, 1)).toMatch(/already been through this|on the case|already told you/i);
  });

  it('rewards a progress update once, and asks for one when none has come', async () => {
    const update =
      'Here is an update on the case: the team has found the cause and we are working on it.';
    const sim = await talk({ callStage: 'follow-up', startingTemperature: 'frustrated' }, [
      GREET,
      update,
      update,
    ]);
    expect(reasons(sim, 1)).toContain('Gave a progress update on the case');
    expect(reply(sim, 1)).toMatch(/update/i);
    expect(reasons(sim, 2)).not.toContain('Gave a progress update on the case');

    const contexts = await captureContexts(
      makeScenario({ callStage: 'follow-up', startingTemperature: 'frustrated' }),
      [GREET, 'What laptop are you using?', 'What does it say?', 'When did it start?'],
    );
    expect(contexts.map((c) => planReply(c).push)).toContain('update');
  });
});

describe('an escalated call', () => {
  const escalated = {
    callStage: 'escalated',
    startingTemperature: 'angry',
    style: 'demanding',
  } as const;

  it('looks for the earlier experience to be acknowledged, the escalation explained and a rhythm of updates', async () => {
    const sim = await talk(escalated, [
      GREET,
      'I can see you have contacted us twice already, and I am sorry about that.',
      'Escalated means a senior engineer now owns this case and will look at it today.',
      'I will take ownership and update you every hour.',
    ]);
    expect(reasons(sim, 1)).toContain('Acknowledged what the customer had already been through');
    expect(reasons(sim, 2)).toContain('Explained what the escalation means');
    expect(reasons(sim, 3)).toContain('Gave a specific update cadence');
    expect(reply(sim, 3)).toMatch(/every hour/i);
  });

  it('asks whether the engineer has seen what it has been through, if they have not said so', async () => {
    const contexts = await captureContexts(makeScenario(escalated), [
      GREET,
      'What laptop are you using?',
      'What does it say?',
    ]);
    expect(contexts.map((c) => planReply(c).push)).toContain('history');
  });
});

describe('a call to close a case', () => {
  const closure = {
    callStage: 'closure',
    startingTemperature: 'calm',
    style: 'talkative',
  } as const;

  it('never goes back to the problem as if it was new', async () => {
    for (let seed = 1; seed <= 6; seed++) {
      const sim = await talk(
        closure,
        [
          GREET,
          'Is it working now?',
          'What caused it was an old password saved on your phone, which kept signing in and locked the account.',
          'Are you happy for us to close the case?',
        ],
        seed,
      );
      for (const t of sim.turns)
        expect(t.customer, `seed ${seed}`).not.toMatch(/can't sign in to Outlook\. It stopped/);
      expect(sim.opening).not.toMatch(/can't sign in/);
    }
  });

  it('wants to know the fix works, what changed, and to agree to close', async () => {
    const sim = await talk(closure, [
      GREET,
      'Is it working now?',
      'What caused it was an old password saved on your phone, which kept signing in and locked the account.',
      'Are you happy for us to close the case?',
    ]);
    expect(reasons(sim, 1)).toContain('Confirmed that the issue was resolved');
    expect(reply(sim, 1)).toMatch(/working/i);
    expect(reasons(sim, 2)).toContain('Explained what changed');
    expect(reasons(sim, 3)).toContain('Checked that the customer agreed to close the case');
    expect(reply(sim, 3)).toMatch(/happy to close|fine to close|can close/i);
  });

  it('is not ready to close until it has heard what changed, and asks for it', async () => {
    const early = await talk(closure, [GREET, 'Is there anything else I can help with?']);
    expect(reasons(early, 1)).toContain(
      'Tried to close before confirming it works or explaining what changed',
    );
    const contexts = await captureContexts(makeScenario(closure), [
      GREET,
      'Is there anything else I can help with?',
    ]);
    expect(planReply(contexts[1] as (typeof contexts)[number]).push).toBe('cause');
  });
});

describe('what the customer hopes for from the engineer', () => {
  const withExpectation = (
    customerExpectation: string,
    desiredOutcome = 'The customer is satisfied.',
  ) =>
    applyConfig(
      makeDefinition({ customerExpectation, desiredOutcome }),
      { difficulty: 'standard', startingTemperature: 'calm' },
      { seed: 7, timeOfDay: 'morning' },
    );

  it('is read from what the scenario says they expect', () => {
    expect([...expectationsOf(makeScenario())]).toEqual(['explanation']);
    expect(
      [
        ...expectationsOf(
          withExpectation(
            'Someone who takes charge straight away, says when she will hear back, and gives her a way to keep working in the meantime.',
          ),
        ),
      ].sort(),
    ).toEqual(['interim', 'next-update', 'ownership']);
    expect([...expectationsOf(withExpectation('Someone friendly.'))]).toEqual([]);
  });

  it('rewards an explanation or a way to carry on once, and the same words twice earn nothing more', async () => {
    const scenario = withExpectation(
      'An explanation in plain words and a way to keep working in the meantime.',
    );
    const sim = await simulate(scenario, [
      GREET,
      'This looks like the account got locked because an old password kept being tried, which is what that means in plain words.',
      'In the meantime you can keep working from the web version of Outlook.',
      'In the meantime you can keep working from the web version of Outlook.',
    ]);
    expect(reasons(sim, 1)).toContain(
      'Explained in plain words what was going on, as the customer hoped',
    );
    expect(reasons(sim, 2)).toContain(
      'Offered a way to carry on in the meantime, as the customer hoped',
    );
    expect(reasons(sim, 3)).not.toContain(
      'Offered a way to carry on in the meantime, as the customer hoped',
    );
  });

  it('costs a little, once, when an owner and a time still have not come after eight replies', async () => {
    const scenario = withExpectation('Someone who takes charge and says when she will hear back.');
    const questions = [
      'What laptop are you using?',
      'When did it start?',
      'What does the sign-in screen say?',
      'Is anyone else affected?',
      'Which version of Outlook is it?',
      'What have you already tried?',
      'Is your work email signed in on a phone?',
      'How is this affecting your morning?',
      'Is there anything else you noticed?',
    ];
    const sim = await simulate(scenario, [GREET, ...questions]);
    const missed = allReasons(sim).filter((r) => /which was what the customer expected/.test(r));
    expect(missed).toEqual([
      'Still no one had taken the case on, which was what the customer expected',
      'Still no time had been given for the next update, which was what the customer expected',
    ]);

    const owned = await simulate(scenario, [
      GREET,
      "I'll take ownership of this and call you back by 3pm with an update.",
      ...questions,
    ]);
    expect(allReasons(owned).filter((r) => /which was what the customer expected/.test(r))).toEqual(
      [],
    );
  });

  it('is asked for by the customer late in the call, when it has not come, though they are calm', async () => {
    const scenario = applyConfig(
      makeDefinition({
        customerExpectation: 'Someone who takes charge and says when she will hear back.',
      }),
      { difficulty: 'standard', startingTemperature: 'calm', curveballs: [] },
      { seed: 7, timeOfDay: 'morning' },
    );
    const questions = [
      'What laptop are you using?',
      'When did it start?',
      'What does the sign-in screen say?',
      'Is anyone else affected?',
      'Which version of Outlook is it?',
      'What have you already tried?',
      'Is your work email signed in on a phone?',
      'How is this affecting your morning?',
    ];
    const contexts = await captureContexts(scenario, [GREET, ...questions]);
    const asked = contexts.filter((c) => {
      const push = planReply(c).push;
      return push === 'owner' || push === 'timeline';
    });
    expect(asked.length).toBeGreaterThan(0);
    // A calm customer waits: nothing is asked for in the first half of the call.
    expect(Math.min(...asked.map((c) => c.effectiveTurn))).toBeGreaterThanOrEqual(7);
    // An engineer who has already taken the case on and given a time is asked for neither.
    const given = await captureContexts(scenario, [
      GREET,
      "I'll take ownership and call you back by 3pm.",
      ...questions,
    ]);
    const pushes = given.map((c) => planReply(c).push);
    expect(pushes).not.toContain('timeline');
    expect(pushes).not.toContain('owner');
  });
});
