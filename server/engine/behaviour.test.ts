import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import type { ScenarioDefinition, ScenarioOverrides } from '#shared/domain/scenario.ts';
import { factPolicy } from '../prompts/facts.ts';
import { getScenarioLibrary } from '../scenarios/index.ts';
import { processTraineeTurn } from './pipeline.ts';
import { recordCommitment } from './memory.ts';
import { mockClassifier, mockGenerate } from './mock/index.ts';
import { composeCustomerReply } from './mock/customer.ts';
import { planReply, type Flavour } from './plan.ts';
import { createInitialRuntime, openingMessage } from './session.ts';
import { simulate, type Simulation } from './simulate.ts';
import {
  captureContexts,
  FIXTURE_INPUT,
  makeDefinition,
  makeScenario,
  type ScriptedLine,
} from './testing.ts';
import type { EngineRuntime, TranscriptTurn } from './types.ts';
import { sentenceCount } from './conform.ts';

const GREET = 'Good morning, this is Sam from Microsoft support. How can I help?';

type Overrides = Parameters<typeof makeScenario>[0];
const talk = (overrides: Overrides, lines: string[], seed = 7): Promise<Simulation> =>
  simulate(makeScenario(overrides, seed), lines);

const reasons = (sim: Simulation, turn: number) =>
  sim.turns[turn]?.events.map((e) => e.reason) ?? [];
const categories = (sim: Simulation, turn: number) =>
  sim.turns[turn]?.events.map((e) => e.category) ?? [];
/** How much the customer's temperature moved in one turn. */
const warmth = (sim: Simulation, turn: number) =>
  (sim.turns[turn]?.events ?? [])
    .filter((e) => e.key === 'temperature')
    .reduce((sum, e) => sum + e.delta, 0);
const reply = (sim: Simulation, turn: number) => sim.turns[turn]?.customer ?? '';

// ---------------------------------------------------------------------------------------

describe('the first exchange', () => {
  it('answers a bare greeting with the reason for the call and does not count it as a wasted turn', async () => {
    const sim = await talk({ startingTemperature: 'frustrated' }, [GREET]);
    expect(reply(sim, 0)).toMatch(/can't sign in to Outlook/);
    expect(Object.keys(sim.runtime.discovery)).toEqual([]);
    expect(sim.runtime.greetingTurns).toBe(1);
    expect(sim.runtime.opening).toBe('reason-given');
    expect(categories(sim, 0)).not.toContain('delay');
    expect(reasons(sim, 0)).toContain('Opened with a greeting and an offer to help');
  });

  it('notices an engineer who starts without a greeting or an introduction', async () => {
    const bare = await talk({ startingTemperature: 'calm' }, ['What does the sign-in screen say?']);
    expect(reply(bare, 0)).toMatch(
      /is this (?:microsoft support|the right number)|am i through to/i,
    );

    const polite = await talk({ startingTemperature: 'calm' }, [
      'Hello, this is Sam from Microsoft support. What does the sign-in screen say?',
    ]);
    expect(reply(polite, 0)).not.toMatch(/is this (?:microsoft support|the right number)/i);
    expect(reasons(polite, 0)).not.toContain('Started without a greeting or introduction');

    // Starting with an instruction, without a word of greeting, also costs a little.
    const bossy = await talk({ startingTemperature: 'calm' }, [
      'Restart your laptop and clear the browser cache.',
    ]);
    expect(reasons(bossy, 0)).toContain('Started without a greeting or introduction');
  });

  it("keeps the reason for the call to an opening's length, however much the first question could be answered with", async () => {
    const open = "Hi, I'm Sam from Microsoft support. What's been happening?";
    for (const style of ['talkative', 'demanding', 'vague', 'non-native'] as const) {
      for (const seed of [7, 1, 2]) {
        const sim = await talk({ style, startingTemperature: 'frustrated' }, [open], seed);
        expect(
          sentenceCount(reply(sim, 0)),
          `${style}/${seed}: ${reply(sim, 0)}`,
        ).toBeLessThanOrEqual(3);
      }
    }
    const terse = await talk({ style: 'terse', startingTemperature: 'frustrated' }, [open]);
    expect(sentenceCount(reply(terse, 0)), reply(terse, 0)).toBeLessThanOrEqual(2);
  });

  it('gives a name, an organisation or a case reference only when asked for it', async () => {
    const asked = await talk({ startingTemperature: 'calm' }, [
      GREET,
      'What name should I put on the case?',
      'And which organisation are you with?',
      'Do you have a case number?',
    ]);
    expect(reply(asked, 0)).not.toMatch(/Maya|Fabrikam|SIM-990001/);
    expect(reply(asked, 1)).toContain('Maya Okafor');
    expect(reply(asked, 2)).toContain('Fabrikam Dental Group');
    expect(reply(asked, 3)).toContain('SIM-990001');
  });
});

describe('asking again, narrowing down, checking and correcting', () => {
  it('charges for a real repeat but not for a clarification, a confirmation or a correction', async () => {
    const repeat = await talk({ startingTemperature: 'calm' }, [
      GREET,
      'Which version of Outlook are you using?',
      'Which version of Outlook are you using?',
    ]);
    expect(categories(repeat, 2)).toContain('repetition');
    expect(reply(repeat, 2)).toMatch(/already|mentioned|said|asked/i);

    const narrowed = await talk({ startingTemperature: 'calm' }, [
      GREET,
      'Which version of Outlook are you using?',
      'What do you mean by newer?',
    ]);
    expect(categories(narrowed, 2)).not.toContain('repetition');
    expect(reply(narrowed, 2)).toMatch(/newer Outlook/);

    const confirmed = await talk({ startingTemperature: 'calm' }, [
      GREET,
      'Which version of Outlook are you using?',
      'Can you confirm that it is the new Outlook?',
    ]);
    expect(categories(confirmed, 2)).not.toContain('repetition');
    expect(reply(confirmed, 2)).toMatch(/just had another look and it's the newer Outlook/);

    const corrected = await talk({ startingTemperature: 'calm' }, [
      GREET,
      'So to confirm, you changed your password this morning and three of you are affected. Is that right?',
      'Sorry, I meant just you, not three people.',
    ]);
    expect(categories(corrected, 2)).not.toContain('repetition');
    expect(reasons(corrected, 2)).toContain('Put right something they had said');
  });

  it('answers a clarification with what it said before, not with something new', async () => {
    const sim = await talk({ startingTemperature: 'calm', style: 'talkative' }, [
      GREET,
      'What laptop are you using?',
      'What do you mean by usual?',
    ]);
    expect(reply(sim, 1)).toMatch(/work laptop/);
    expect(reply(sim, 2)).toMatch(/work laptop|same laptop/);
    expect(sim.turns[2]?.runtime.discovery).toEqual(sim.turns[1]?.runtime.discovery);
  });

  it('judges a summary by what the customer said: right is rewarded, wrong is put right', async () => {
    const right = await talk({ startingTemperature: 'frustrated', impact: 'low' }, [
      GREET,
      'So to make sure I have this right, you changed your password this morning and now Outlook will not let you in. Is that right?',
    ]);
    expect(reasons(right, 1)).toContain('Summarised their understanding');
    expect(reply(right, 1)).toMatch(/that's right|you have it right|exactly|yes/i);

    const wrongCount = await talk({ startingTemperature: 'frustrated', impact: 'low' }, [
      GREET,
      'So to confirm, you changed your password this morning and three of you are affected. Is that right?',
    ]);
    expect(reasons(wrongCount, 1)).toContain(
      'The summary did not match what the customer had said',
    );
    expect(warmth(wrongCount, 1)).toBeGreaterThan(warmth(right, 1));
    expect(reply(wrongCount, 1)).toMatch(
      /not quite|not what I (?:said|told)|not right|don't think that's right/i,
    );
    expect(reply(wrongCount, 1)).toMatch(/just my account/i);

    const wrongDetail = await talk({ startingTemperature: 'frustrated' }, [
      GREET,
      'So the firewall update crashed your server and the database is corrupted. Is that right?',
    ]);
    expect(reasons(wrongDetail, 1)).toContain(
      'The summary did not match what the customer had said',
    );
  });

  it('judges a recap in one sentence that ends in a tag the same as the recap in two', async () => {
    const start = { startingTemperature: 'frustrated', impact: 'low' } as const;
    const wrongClaims = [
      'So to confirm, you changed your password this morning and twelve of you are affected',
      'So you have 12 users affected',
    ];
    const tags = [
      ', is that right?',
      ', is that correct?',
      ' - is that right?',
      ' is that right?',
      ', right?',
      ', correct?',
      ', have I got that right?',
      ", isn't it?",
    ];
    for (const claim of wrongClaims) {
      for (const tag of tags) {
        const sim = await talk(start, [GREET, `${claim}${tag}`]);
        const where = `${claim}${tag}`;
        expect(reasons(sim, 1), where).toContain(
          'The summary did not match what the customer had said',
        );
        expect(reasons(sim, 1), where).not.toContain('Summarised their understanding');
        expect(reply(sim, 1), where).toMatch(
          /not quite|not what I (?:said|told)|not right|don't think that's right/i,
        );
      }
    }
    // A right recap in one sentence is still rewarded...
    const right = await talk(start, [
      GREET,
      'So to make sure I have this right, you changed your password this morning and now Outlook will not let you in, is that right?',
    ]);
    expect(reasons(right, 1)).toContain('Summarised their understanding');
    expect(reasons(right, 1)).not.toContain('The summary did not match what the customer had said');
    // ...and so is one about what the engineer will do, which is no claim about the customer.
    const plan = await talk(start, [
      GREET,
      'To recap, I will call you back by 3pm with an update, is that right?',
    ]);
    expect(reasons(plan, 1)).not.toContain('The summary did not match what the customer had said');
  });

  it("does not judge the engineer's own explanation as if it were the customer's account", async () => {
    const explanation =
      'To summarise: the cause was a setting, we fixed it, and it should not come back. Does that match what you saw?';
    const sim = await talk({ callStage: 'closure', startingTemperature: 'calm' }, [
      GREET,
      explanation,
    ]);
    expect(reasons(sim, 1)).not.toContain('The summary did not match what the customer had said');
    expect(reply(sim, 1)).toMatch(/that's right|yes|exactly|correct|that works|matches/i);
    expect(reply(sim, 1)).not.toMatch(/not quite|not right/i);
  });

  it('never reuses the words of a repeated question as a new answer', async () => {
    const sim = await talk({ startingTemperature: 'calm', style: 'talkative' }, [
      GREET,
      'Is your work email also signed in on your phone or tablet?',
      'Is your work email also signed in on your phone or tablet?',
    ]);
    expect(reply(sim, 1)).toMatch(/personal phone/);
    // The second answer is a short reminder of the first, and no other fact comes with it.
    expect(reply(sim, 2)).toMatch(/already|mentioned|asked|said/i);
    expect(reply(sim, 2)).toMatch(/personal phone/);
    expect(reply(sim, 2)).not.toMatch(/temporarily locked|ten past eight/);
  });
});

describe('promises and times', () => {
  it('echoes a clear commitment back as a question, and takes a short yes as the answer', async () => {
    const sim = await talk({ startingTemperature: 'frustrated', style: 'demanding' }, [
      GREET,
      "I'll take ownership of this and call you back by 3pm with an update.",
      'Yes, that is right.',
    ]);
    expect(reply(sim, 1)).toMatch(/so you'll .*3pm.*\?/i);
    expect(sim.turns[1]?.runtime.awaitingConfirmation).toBe(true);
    expect(categories(sim, 2)).not.toContain('low-effort');
    expect(sim.turns[2]?.runtime.awaitingConfirmation).toBe(false);
  });

  it('notices when a time changes and when a time is missing', async () => {
    const changed = await talk({ startingTemperature: 'calm' }, [
      GREET,
      "I'll call you back by 3pm with an update.",
      "I'll call you back by 4pm with an update.",
    ]);
    expect(reply(changed, 2)).toMatch(/3pm/);
    expect(reply(changed, 2)).toMatch(/4pm/);
    expect(reasons(changed, 2)).toContain('The time given changed from what was promised earlier');

    const same = await talk({ startingTemperature: 'calm' }, [
      GREET,
      "I'll call you back by 3pm with an update.",
      'I will ring you at 3pm as I said.',
    ]);
    expect(reasons(same, 2)).not.toContain('The time given changed from what was promised earlier');
  });

  it('keeps what a commitment says about its time when it is said again without one', () => {
    const owns = {
      kind: 'ownership',
      action: 'own the case and call me back',
      supported: true,
    } as const;
    const clear = recordCommitment([], { ...owns, due: 'by 3pm', clarity: 'clear' }, 2);
    const again = recordCommitment(clear.commitments, { ...owns, due: null, clarity: 'vague' }, 4);
    expect(again.commitments).toHaveLength(1);
    expect(again.commitments[0]).toMatchObject({ due: 'by 3pm', clarity: 'clear' });
    // A new time replaces it, and has to be said back again.
    const moved = recordCommitment(
      again.commitments,
      { ...owns, due: 'by 4pm', clarity: 'clear' },
      6,
    );
    expect(moved.commitments[0]).toMatchObject({
      due: 'by 4pm',
      clarity: 'clear',
      reflected: false,
    });
    // Said vaguely and then vaguely again, it is still vague.
    const first = recordCommitment([], { ...owns, due: null, clarity: 'vague' }, 2);
    const second = recordCommitment(first.commitments, { ...owns, due: null, clarity: 'vague' }, 4);
    expect(second.commitments[0]).toMatchObject({ due: null, clarity: 'vague' });
  });

  it('does not ask when, and still says what was committed to, when a commitment with a time is said again', async () => {
    const lines = [
      GREET,
      "I'll take ownership and call you back by 3pm with an update.",
      'So I will own this and call you back. Is there anything else I can help with?',
    ];
    for (const startingTemperature of ['calm', 'frustrated'] as const) {
      const scenario = makeScenario({ startingTemperature, style: 'talkative' });
      const contexts = await captureContexts(scenario, lines);
      const last = contexts[2] as (typeof contexts)[number];
      // The one commitment is still a clear one, and still for 3pm...
      expect(last.runtime.commitments, startingTemperature).toHaveLength(1);
      expect(last.runtime.commitments[0]).toMatchObject({ due: 'by 3pm', clarity: 'clear' });
      const plan = planReply(last);
      expect(plan.reactions, startingTemperature).not.toContain('vague-commitment');
      expect(plan.closingCommitment).toMatchObject({ due: 'by 3pm' });
      // ...so the customer does not ask for a time.
      const said = reply(await simulate(scenario, lines), 2);
      expect(said, startingTemperature).not.toMatch(/when exactly|roughly when|give me a time/i);
    }
  });

  it('does not challenge a commitment it has a time for, however blunt it is, and still challenges a vague one', async () => {
    const blunt = makeScenario({ startingTemperature: 'angry', style: 'demanding' });
    const COMMIT = "I'll take ownership and call you back by 3pm with an update.";
    // The classifier heard "so I'll own this and call you back" as a promise with nothing behind it.
    const again: ScriptedLine = {
      text: 'So I will own this and call you back.',
      classification: { ownership: 'none', nextSteps: 'vague' },
    };
    const planAfter = async (lines: (string | ScriptedLine)[]) => {
      const contexts = await captureContexts(blunt, lines);
      return planReply(contexts.at(-1) as (typeof contexts)[number]);
    };
    const restated = await planAfter([GREET, COMMIT, again]);
    expect(restated.reactions).not.toContain('vague-commitment');
    expect(restated.flavour).not.toBe('challenge');
    // The same words, with no time given before, are a vague promise.
    const vague = await planAfter([GREET, again]);
    expect(vague.reactions).toContain('vague-commitment');
    expect(vague.flavour).toBe('challenge');
    // So is a vague promise about something else, after a time was given for the call back.
    const other = await planAfter([GREET, COMMIT, "I'll get back to you soon."]);
    expect(other.reactions).toContain('vague-commitment');
    // And a vague promise said twice is challenged both times.
    const twice = await captureContexts(blunt, [
      GREET,
      "I'll get back to you soon.",
      "I'll get back to you soon.",
    ]);
    for (const ctx of twice.slice(1)) {
      expect(planReply(ctx).reactions).toContain('vague-commitment');
    }
  });

  it('does not take another promise, or how often it will hear, for a change of time', async () => {
    const call = "I'll call you back by 3pm.";
    const scenario = makeScenario({ startingTemperature: 'calm' });
    for (const second of [
      "I'll email you the summary by 5pm.",
      "I'll update you every hour after that.",
    ]) {
      const contexts = await captureContexts(scenario, [GREET, call, second]);
      expect(contexts[2]?.analysis.commitment, second).not.toBeNull();
      expect(contexts[2]?.analysis.conflict, second).toBeNull();
      const sim = await simulate(scenario, [GREET, call, second]);
      expect(reasons(sim, 2), second).not.toContain(
        'The time given changed from what was promised earlier',
      );
      expect(reply(sim, 2), second).not.toMatch(/thought you said|was it/i);
    }
    // The same call back for another time is still a change of time...
    const moved = await captureContexts(scenario, [GREET, call, "I'll call you back by 5pm."]);
    expect(moved[2]?.analysis.conflict).toMatchObject({ due: 'by 3pm' });
    // ...but saying how often the same call back will be is not.
    const often = await captureContexts(scenario, [GREET, call, "I'll call you back every hour."]);
    expect(often[2]?.analysis.commitment?.due).toBe('every hour');
    expect(often[2]?.analysis.conflict).toBeNull();
  });

  it('is calmed more by a clear time than by a vague one, and asks for a time when there is none', async () => {
    const clear = await talk({ startingTemperature: 'frustrated' }, [
      GREET,
      "I'll take this on and call you back by 3pm with an update.",
    ]);
    const vague = await talk({ startingTemperature: 'frustrated' }, [
      GREET,
      "I'll get back to you soon.",
    ]);
    expect(warmth(clear, 1)).toBeLessThan(0);
    expect(warmth(vague, 1)).toBeGreaterThanOrEqual(0);
    expect(reply(vague, 1)).toMatch(/when|specific|who exactly|by when|time/i);
  });

  it('does not calm for a promise nobody can keep, and does for honesty about what can be committed', async () => {
    const promise = await talk({ startingTemperature: 'frustrated' }, [
      GREET,
      'It will definitely be fixed by 3pm, I guarantee it.',
    ]);
    expect(categories(promise, 1)).toContain('promise');
    expect(categories(promise, 1)).not.toContain('next-steps');
    expect(warmth(promise, 1)).toBeGreaterThan(0);

    const honest = await talk({ startingTemperature: 'frustrated' }, [
      GREET,
      "I can't promise a fix time yet, but I'll update you at 3pm.",
    ]);
    expect(reasons(honest, 1)).toContain('Was honest about what could be committed to');
    expect(warmth(honest, 1)).toBeLessThan(warmth(promise, 1));
  });

  it('reminds the engineer of what they committed to when the call closes', async () => {
    const sim = await talk({ startingTemperature: 'calm', style: 'talkative' }, [
      GREET,
      "I'll take ownership and call you back by 3pm with an update.",
      'To recap, I will call you back by 3pm. Is there anything else I can help with?',
    ]);
    expect(reply(sim, 2)).toMatch(/3pm/);
  });
});

describe('what is said kindly in the words of blame', () => {
  it('does not make the customer feel blamed or brushed off, where the same words against them do', async () => {
    const scenario = makeScenario({ startingTemperature: 'frustrated' });
    const reactionTo = async (text: string) => {
      const contexts = await captureContexts(scenario, [GREET, text]);
      return planReply(contexts[1] as (typeof contexts)[number]).reactions;
    };
    for (const text of [
      "I'm sorry, you shouldn't have to chase us for an update.",
      'You must have been waiting a long time.',
      "I'll ring at 3 as I said.",
    ]) {
      const sim = await talk({ startingTemperature: 'frustrated' }, [GREET, text]);
      expect(categories(sim, 1), text).not.toContain('blame');
      expect(categories(sim, 1), text).not.toContain('dismissal');
      const reactions = await reactionTo(text);
      expect(reactions, text).not.toContain('blamed');
      expect(reactions, text).not.toContain('dismissed');
    }
    // The same words against the customer are blame, and are a brush-off.
    for (const [text, category, reaction] of [
      ['You should have restarted it.', 'blame', 'blamed'],
      ['As I already told you.', 'dismissal', 'dismissed'],
      ['Just answer the question.', 'dismissal', 'dismissed'],
    ] as const) {
      const sim = await talk({ startingTemperature: 'frustrated' }, [GREET, text]);
      expect(categories(sim, 1), text).toContain(category);
      expect(await reactionTo(text), text).toContain(reaction);
    }
  });
});

describe('the end of the call', () => {
  const UPDATE =
    "Here's where we are: the team has confirmed what's behind it and we're working on a fix.";
  const CLOSING = /that's (?:everything|all)|nothing (?:else|more)|no, (?:that's|i think)/i;

  it('does not say it is finished when the engineer gives a progress update', async () => {
    for (const startingTemperature of ['calm', 'frustrated'] as const) {
      const sim = await talk({ callStage: 'follow-up', startingTemperature }, [GREET, UPDATE]);
      expect(reply(sim, 1), startingTemperature).not.toMatch(CLOSING);
      expect(reply(sim, 1), startingTemperature).toMatch(/update|thank|okay|good/i);
    }
  });

  it('confirms a recap it is asked about, and only closes when the engineer closes', async () => {
    const sim = await talk(
      { startingTemperature: 'frustrated', style: 'demanding', curveballs: [] },
      [
        GREET,
        "I'll take ownership of this and call you back by 3pm with an update.",
        'Yes, that is right.',
        "To recap, I'll call you by 3pm with an update. Is that right?",
        'Is there anything else I can help you with?',
      ],
    );
    // Asked to confirm, the customer confirms: no goodbye, and no question handed back.
    expect(reply(sim, 3)).toMatch(/yes|that's right|exactly|correct|that works|sounds right/i);
    expect(reply(sim, 3)).not.toMatch(CLOSING);
    expect(reply(sim, 3)).not.toMatch(/\?/);
    expect(reply(sim, 4)).toMatch(CLOSING);
  });
});

describe('how the customer takes what the engineer does', () => {
  it('is softened by empathy alone and by action alone, and most by both', async () => {
    const empathy = "I'm really sorry about this, it sounds frustrating with patients waiting.";
    const action = "I'll take ownership of this and call you back by 3pm with an update.";
    const start = { startingTemperature: 'frustrated' as const };
    const onlyEmpathy = await talk(start, [GREET, empathy]);
    const onlyAction = await talk(start, [GREET, action]);
    const both = await talk(start, [GREET, `${empathy} ${action}`]);
    expect(warmth(onlyEmpathy, 1)).toBeLessThan(0);
    expect(warmth(onlyAction, 1)).toBeLessThan(0);
    expect(categories(onlyEmpathy, 1)).not.toContain('ownership');
    expect(categories(onlyAction, 1)).not.toContain('empathy');
    expect(warmth(both, 1)).toBeLessThanOrEqual(
      Math.min(warmth(onlyEmpathy, 1), warmth(onlyAction, 1)),
    );
  });

  it('answers blame defensively, whatever the temperament', async () => {
    for (const temperament of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
      const sim = await talk({ startingTemperature: temperament }, [
        GREET,
        'You should have read the instructions before you changed your password.',
      ]);
      expect(reply(sim, 1), temperament).toMatch(
        /fair|blam|my fault|put this on me|thought I did the right thing|not helpful|did what I thought/i,
      );
      expect(warmth(sim, 1), temperament).toBeGreaterThan(0);
    }
  });

  it('asks a novice what a term means but lets an expert hear it', async () => {
    const line = [GREET, 'Your cached credentials are probably stale after DNS propagation.'];
    const novice = await talk({ proficiency: 'novice', startingTemperature: 'calm' }, line);
    const expert = await talk({ proficiency: 'expert', startingTemperature: 'calm' }, line);
    expect(reply(novice, 1)).toMatch(/DNS/);
    expect(reply(novice, 1)).toMatch(/simpler|plainly|plain english|what does|familiar|put it/i);
    expect(reply(expert, 1)).not.toMatch(/simpler|plain english|what does .* mean/i);
  });

  it('lets an expert hear that the basics are done, and does not ask that of a novice', async () => {
    const line = [
      GREET,
      'What does the sign-in screen say?',
      'When did it start?',
      'Please restart your laptop and then clear the browser cache.',
    ];
    const expert = await talk({ proficiency: 'expert', startingTemperature: 'calm' }, line);
    const novice = await talk({ proficiency: 'novice', startingTemperature: 'calm' }, line);
    expect(reply(expert, 3)).toMatch(/basics/i);
    expect(reply(novice, 3)).not.toMatch(/basics/i);
    expect(reasons(expert, 3)).toContain(
      'Suggested basic steps the customer would already have tried',
    );
  });

  it('does not let the customer speaking a second language change how the engineer is judged', async () => {
    const lines = [
      GREET,
      'What does the sign-in screen say?',
      "I'm sorry about that. I'll take ownership and call you back by 3pm with an update.",
    ];
    const talkative = await talk({ style: 'talkative', startingTemperature: 'frustrated' }, lines);
    const nonNative = await talk({ style: 'non-native', startingTemperature: 'frustrated' }, lines);
    const effects = (sim: Simulation) =>
      sim.events.map((e) => `${e.turnIndex}:${e.category}:${e.key}:${e.delta}`);
    expect(effects(nonNative)).toEqual(effects(talkative));
    expect(nonNative.turns.map((t) => t.temperature)).toEqual(
      talkative.turns.map((t) => t.temperature),
    );
  });
});

describe('temperament, style and proficiency', () => {
  const FLAVOURS: Record<string, Flavour[]> = {
    calm: [],
    anxious: ['timeline-worry', 'impact-worry', 'urgency'],
    frustrated: ['no-progress', 'wants-owner', 'challenge'],
    angry: ['challenge', 'escalate'],
  };

  it('does not carry the worries of a first call into a closing call', async () => {
    const seen = new Set<string>();
    for (const style of ['talkative', 'demanding'] as const) {
      for (const startingTemperature of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
        for (let seed = 1; seed <= 16; seed++) {
          const contexts = await captureContexts(
            makeScenario(
              { callStage: 'closure', style, startingTemperature, impact: 'high' },
              seed,
            ),
            [
              GREET,
              'What does the sign-in screen say?',
              'Which laptop are you using?',
              'I will look into it.',
              'Let me check that for you.',
            ],
          );
          for (const ctx of contexts) {
            const flavour = planReply(ctx).flavour;
            if (flavour) seen.add(flavour);
          }
        }
      }
    }
    // The problem is said to be fixed: what is left to ask is whether it will come back.
    for (const flavour of seen) expect(['challenge', 'assurance']).toContain(flavour);
    expect(seen.has('assurance')).toBe(true);
  });

  it('does not ask an escalated call to be escalated, though an angry customer on another call may', async () => {
    const wanted = async (callStage: 'follow-up' | 'escalated') => {
      const asked = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) {
        const ctx = (
          await captureContexts(
            makeScenario({ callStage, style: 'talkative', startingTemperature: 'angry' }, seed),
            [GREET, 'What does the sign-in screen say?', 'Which laptop are you using?'],
          )
        ).at(-1) as Awaited<ReturnType<typeof captureContexts>>[number];
        // Nothing has gone well: the customer is as hot as they get and trusts nobody, and has
        // been pressed on everything the stage looks for just now (two turns ago, so that none of
        // it is due again, though the customer is free to ask for something else).
        const hot = { ...ctx.runtime.customer, temperature: 92, trust: 10 };
        const pushes = Object.fromEntries(
          ['timeline', 'update', 'owner', 'history', 'escalation', 'cadence', 'cause'].map((id) => [
            id,
            ctx.traineeTurnNumber - 2,
          ]),
        );
        const runtime = { ...ctx.runtime, customer: hot, pushes };
        const flavour = planReply({ ...ctx, runtime }).flavour;
        if (flavour) asked.add(flavour);
      }
      return asked;
    };
    expect((await wanted('follow-up')).has('escalate')).toBe(true);
    expect((await wanted('escalated')).has('escalate')).toBe(false);
  });

  it('keeps to its own temperament when it adds something of its own', async () => {
    const seen: Record<string, Set<string>> = {};
    for (const temperament of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
      seen[temperament] = new Set();
      for (let seed = 1; seed <= 24; seed++) {
        const contexts = await captureContexts(
          makeScenario(
            { startingTemperature: temperament, style: 'talkative', impact: 'medium' },
            seed,
          ),
          [
            GREET,
            'What does the sign-in screen say?',
            'Which laptop are you using?',
            'I will look into it.',
          ],
        );
        for (const ctx of contexts) {
          const flavour = planReply(ctx).flavour;
          if (flavour) seen[temperament]?.add(flavour);
        }
      }
    }
    for (const [temperament, flavours] of Object.entries(seen)) {
      for (const flavour of flavours) expect(FLAVOURS[temperament], temperament).toContain(flavour);
    }
    expect(seen.calm?.size).toBe(0);
    expect(seen.anxious?.size).toBeGreaterThan(0);
    expect(seen.angry?.size).toBeGreaterThan(0);
  });

  it('is blunter the hotter it is, for the same words from the engineer', async () => {
    const line = [GREET, "I'll get back to you soon."];
    const calm = await talk({ startingTemperature: 'calm' }, line);
    const angry = await talk({ startingTemperature: 'angry' }, line);
    expect(reply(angry, 1)).toMatch(/not good enough|who exactly|by when|not specific/i);
    expect(reply(calm, 1)).not.toMatch(/not good enough/i);
  });

  it('keeps a terse customer to a sentence or two and a talkative one longer', async () => {
    const lines = [
      GREET,
      'What laptop are you using?',
      'Is your work email signed in on your phone?',
      'What does the sign-in screen say?',
      'When did it start?',
    ];
    let terseWords = 0;
    let talkativeWords = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const terse = await talk({ style: 'terse', startingTemperature: 'calm' }, lines, seed);
      const talkative = await talk(
        { style: 'talkative', startingTemperature: 'calm' },
        lines,
        seed,
      );
      for (const t of terse.turns) {
        expect(sentenceCount(t.customer), t.customer).toBeLessThanOrEqual(3);
        terseWords += t.customer.split(/\s+/).length;
      }
      for (const t of talkative.turns) talkativeWords += t.customer.split(/\s+/).length;
    }
    expect(terseWords).toBeLessThan(talkativeWords);
  });

  it('is vague about a broad question and specific once the question is specific', async () => {
    const lines = [
      GREET,
      'Tell me more about what is going on.',
      'Can you read me exactly what the sign-in screen says?',
    ];
    const sim = await talk({ style: 'vague', startingTemperature: 'calm' }, lines);
    expect(reply(sim, 1)).toMatch(
      /hard to say|not really sure|sort of|a bit|can't quite|not sure/i,
    );
    expect(reply(sim, 2)).toMatch(/temporarily locked/);
  });

  it('pushes for a plan when it is demanding, and for an owner when it is frustrated', async () => {
    const pushes = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const contexts = await captureContexts(
        makeScenario({ style: 'demanding', startingTemperature: 'frustrated' }, seed),
        [
          GREET,
          'What laptop are you using?',
          'What does it say?',
          'When did it start?',
          'What have you tried?',
        ],
      );
      for (const ctx of contexts) {
        const plan = planReply(ctx);
        if (plan.push) pushes.add(plan.push);
        if (plan.flavour === 'plan') pushes.add('plan');
      }
    }
    expect([...pushes].some((p) => p === 'timeline' || p === 'owner' || p === 'plan')).toBe(true);
  });
});

describe('what the customer says is always short, natural speech', () => {
  const COACHING =
    /great question|good question|excellent|well done|nicely done|spot on|you should (?:have )?(?:ask|say|try)|a better question|as an ai|this is a simulation|hidden fact/i;

  it('is never a list, a heading, praise or coaching, and never a monologue', async () => {
    const lines = [
      GREET,
      'What laptop are you using?',
      'Is your work email signed in on your phone?',
      "I'm sorry about that. I'll take ownership and call you back by 3pm with an update.",
      'What does the sign-in screen say?',
      'So to confirm, you changed your password this morning. Is that right?',
      'Is there anything else I can help with?',
    ];
    for (const style of ['talkative', 'terse', 'demanding', 'vague', 'non-native'] as const) {
      for (const startingTemperature of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
        for (const seed of [1, 2, 3]) {
          const sim = await talk({ style, startingTemperature }, lines, seed);
          for (const t of sim.turns) {
            const where = `${style}/${startingTemperature}/${seed}: ${t.customer}`;
            expect(t.customer, where).not.toMatch(/\n/);
            expect(t.customer, where).not.toMatch(/^\s*(?:[-*\u2022]|\d+[.)])\s/m);
            expect(t.customer, where).not.toMatch(COACHING);
            expect(sentenceCount(t.customer), where).toBeLessThanOrEqual(6);
            expect(t.customer.length, where).toBeLessThan(520);
          }
        }
      }
    }
  });

  it('answers what was asked before it brings up a worry of its own', async () => {
    const definition = makeDefinition({
      knownFacts: FIXTURE_INPUT.knownFacts.map((f) =>
        f.id === 'kf-laptop'
          ? { ...f, text: 'It is my work laptop. It is the same one I always use.' }
          : f,
      ),
      curveballs: FIXTURE_INPUT.curveballs.map((c) => ({
        ...c,
        statement: 'Sorry to rush you. The first patients arrive at nine.',
        trigger: { earliestTurn: 2, latestTurn: 4, whenImpactUnacknowledged: true },
      })),
    });
    const scenario = applyConfig(
      definition,
      { difficulty: 'standard', startingTemperature: 'frustrated', style: 'talkative' },
      { seed: 7, timeOfDay: 'morning' },
    );
    const sim = await simulate(scenario, [
      GREET,
      'What does the sign-in screen say?',
      'What laptop are you using?',
    ]);
    // Two sentences of answer and two of worry do not fit in a reply this short: the answer is
    // shortened to a sentence, not dropped.
    expect(reply(sim, 2)).toMatch(/first patients arrive at nine/);
    expect(reply(sim, 2)).toMatch(/my work laptop/);
    expect(sentenceCount(reply(sim, 2))).toBeLessThanOrEqual(3);
  });

  it('does not say the same thing twice running when it has to react to the same kind of thing', async () => {
    const sim = await talk({ startingTemperature: 'frustrated', style: 'demanding' }, [
      GREET,
      "I'll get back to you soon.",
      "I'll look into it.",
      'I will check and let you know.',
      'I will get back to you shortly.',
    ]);
    const lines = sim.turns.map((t) => t.customer);
    for (let i = 1; i < lines.length; i++) expect(lines[i], `turn ${i}`).not.toBe(lines[i - 1]);
  });
});

// ---------------------------------------------------------------------------------------
// What counts as said: conform first, then record

/** Runs one line through the real pipeline with a reply the test supplies. */
async function oneReply(
  overrides: Overrides,
  setup: string[],
  line: string,
  say: string,
): Promise<{ runtime: EngineRuntime; text: string; recorded: string[] }> {
  const scenario = makeScenario(overrides);
  let runtime = createInitialRuntime(scenario);
  const history: TranscriptTurn[] = [
    { index: 1, role: 'customer', text: openingMessage(scenario) },
  ];
  const classify = mockClassifier(scenario);
  for (const text of setup) {
    const turnIndex = history.length + 1;
    const result = await processTraineeTurn({
      scenario,
      runtime,
      traineeText: text,
      turnIndex,
      history,
      classify,
      generate: mockGenerate,
    });
    runtime = result.runtime;
    history.push(
      { index: turnIndex, role: 'trainee', text },
      { index: turnIndex + 1, role: 'customer', text: result.customerText },
    );
  }
  const result = await processTraineeTurn({
    scenario,
    runtime,
    traineeText: line,
    turnIndex: history.length + 1,
    history,
    classify,
    generate: () => Promise.resolve({ text: say, source: 'live' }),
  });
  return {
    runtime: result.runtime,
    text: result.customerText,
    recorded: result.discoveryRecords.map((r) => r.factId),
  };
}

describe('a fact counts as discovered only if its words are in the reply', () => {
  const PHONE =
    'My work email is on my personal phone too, and it keeps asking me to re-enter my password.';
  const ask = 'Is your work email also signed in on your phone or tablet?';

  it('records a fact that is said, and answers the topic', async () => {
    const said = await oneReply({ style: 'talkative' }, [GREET], ask, PHONE);
    expect(said.text).toContain('personal phone');
    expect(said.recorded).toEqual(['hf-phone-old-password']);
    expect(said.runtime.discovery['hf-phone-old-password']?.status).toBe('discovered');
  });

  it('does not record a fact that a terse customer never got to say', async () => {
    // The style allows two short sentences. The words that give the fact away are the third.
    const long = `Hmm, let me think. It has been a strange morning for me. ${PHONE} I have ignored it so far.`;
    const cut = await oneReply({ style: 'terse' }, [GREET], ask, long);
    expect(sentenceCount(cut.text)).toBeLessThanOrEqual(2);
    expect(cut.text).not.toContain('personal phone');
    expect(cut.recorded).toEqual([]);
    expect(cut.runtime.discovery['hf-phone-old-password']).toBeUndefined();
    expect(cut.runtime.answeredIntents).not.toContain('environment');
    // Asked again, the customer is still free to say it.
    const again = await oneReply({ style: 'terse' }, [GREET], ask, PHONE);
    expect(again.runtime.discovery['hf-phone-old-password']?.status).toBe('discovered');
  });

  it('does not record a fact that coaching or praise took the place of', async () => {
    const praise = `That is a great question, well done. You should ask about other devices next.`;
    const empty = await oneReply({ style: 'talkative' }, [GREET], ask, praise);
    expect(empty.recorded).toEqual([]);
    expect(empty.runtime.discovery['hf-phone-old-password']).toBeUndefined();
    expect(empty.text).not.toMatch(/great question|well done|you should/i);
  });

  it('reveals at most two hidden facts at once, and one for a terse customer', async () => {
    const everything =
      'Tell me everything: what the sign-in screen says exactly, when it started, whether your email is on a phone, and what you have already tried.';
    for (const [style, most] of [
      ['talkative', 2],
      ['terse', 1],
    ] as const) {
      const sim = await talk({ style, startingTemperature: 'calm' }, [GREET, everything]);
      const found = Object.values(sim.runtime.discovery).filter((d) => d.status === 'discovered');
      expect(found.length, style).toBeGreaterThan(0);
      expect(found.length, style).toBeLessThanOrEqual(most);
    }
  });

  it('says no more new things at once than the customer would, however many topics are named', async () => {
    for (const [style, most] of [
      ['talkative', 3],
      ['terse', 2],
    ] as const) {
      const contexts = await captureContexts(
        makeScenario({ style, startingTemperature: 'calm' }),
        [
          GREET,
          {
            text: 'Tell me about the laptop, the browser, what you tried and what you want from this call.',
            classification: {
              askedQuestion: true,
              discoveryIntents: [
                'problem_description',
                'environment',
                'already_tried',
                'expected_outcome',
              ],
              factTargets: [],
            },
          },
        ],
        { matching: 'model' },
      );
      const { discovery } = contexts.at(-1) as (typeof contexts)[number];
      const fresh = discovery.tell.filter((item) => !item.repeat).length + discovery.reveal.length;
      expect(fresh, style).toBe(most);
    }
  });
});

// ---------------------------------------------------------------------------------------
// Ownership, a vague commitment, and the end of the call, on the real scenarios

const library = getScenarioLibrary();
const onTheLibrary = (id: string, overrides: ScenarioOverrides = {}, seed = 7) =>
  applyConfig(
    library.find((s) => s.id === id) as ScenarioDefinition,
    { difficulty: 'standard', curveballs: [], callStage: 'first-contact', ...overrides },
    { seed, timeOfDay: 'morning' },
  );

const SCOPING = 'What exactly is happening, and when did it start?';
const OWN = "I'll take ownership of this and update you by 3pm today.";
const THREE = /3 ?pm/i;
const NO_MORE =
  /that(?:'s| is) (?:everything|all)|nothing (?:else|more)|no, (?:that(?:'s| is)|i think)|(?:we're|we are) covered/i;

describe('a clear owner and time', () => {
  // How the customer takes it depends on who they are: one who wants to be sure says it back in
  // their own words, one who has it says so.
  const SAYS_IT_BACK: [string, ScenarioOverrides][] = [
    ['teams-cannot-join-external-meetings', { style: 'demanding', startingTemperature: 'anxious' }],
    ['windows-11-slow-after-update', { style: 'talkative', startingTemperature: 'calm' }],
    ['sharepoint-site-access-escalated', { style: 'demanding', startingTemperature: 'angry' }],
    ['m365-apps-excel-crashes-after-update', { style: 'non-native', startingTemperature: 'calm' }],
    [
      'power-automate-approvals-stopped',
      { style: 'vague', startingTemperature: 'calm', proficiency: 'novice' },
    ],
  ];
  const TAKES_IT_IN: [string, ScenarioOverrides][] = [
    ['outlook-shared-mailbox-missing', { style: 'terse', startingTemperature: 'calm' }],
    [
      'azure-deployment-fails-permissions',
      { style: 'terse', startingTemperature: 'calm', proficiency: 'expert' },
    ],
    [
      'intune-devices-not-compliant-closure',
      {
        style: 'vague',
        startingTemperature: 'calm',
        proficiency: 'intermediate',
        callStage: 'follow-up',
      },
    ],
    ['entra-new-hires-blocked-sign-in', { style: 'terse', startingTemperature: 'frustrated' }],
  ];

  it('is said back as a question, in the customer’s own words, by one who wants to be sure', async () => {
    for (const [id, overrides] of SAYS_IT_BACK) {
      for (const seed of [1, 2, 3]) {
        const sim = await simulate(onTheLibrary(id, overrides, seed), [GREET, SCOPING, OWN]);
        const where = `${id}/${seed}: ${reply(sim, 2)}`;
        expect(reply(sim, 2), where).toMatch(/so you(?:'ll| will)\b.*3 ?pm/i);
        expect(reply(sim, 2), where).toContain('?');
        expect(sim.turns[2]?.runtime.awaitingConfirmation, where).toBe(true);
      }
    }
  });

  it('is taken in briefly, naming the time and not as a bare "Okay.", by one who has it', async () => {
    const said = new Set<string>();
    for (const [id, overrides] of TAKES_IT_IN) {
      for (const seed of [1, 2, 3, 4]) {
        const sim = await simulate(onTheLibrary(id, overrides, seed), [GREET, SCOPING, OWN]);
        const where = `${id}/${seed}: ${reply(sim, 2)}`;
        expect(reply(sim, 2), where).toMatch(THREE);
        // Taken in, not said back: the sentence that names the time is not a question. (A customer
        // who is being cooperative may then ask what the engineer needs from them.)
        const named = reply(sim, 2)
          .split(/(?<=[.!?])\s+/)
          .find((s) => THREE.test(s));
        expect(named, where).toBeDefined();
        expect(named, where).not.toContain('?');
        expect(reply(sim, 2), where).not.toMatch(/so you(?:'ll| will)/i);
        if (overrides.style === 'terse') expect(reply(sim, 2), where).not.toContain('?');
        expect(reply(sim, 2), where).not.toMatch(/^(?:okay|ok|sure|right|good)\W*$/i);
        expect(sentenceCount(reply(sim, 2)), where).toBeLessThanOrEqual(3);
        // Taken in, it is not then said back as a question.
        expect(sim.turns[2]?.runtime.awaitingConfirmation, where).toBe(false);
        said.add(reply(sim, 2));
      }
    }
    // And it is not the same line every time.
    expect(said.size).toBeGreaterThanOrEqual(6);
  });

  it('is taken in with the time when the engineer recaps it and asks if that works', async () => {
    for (const [id, overrides] of [...SAYS_IT_BACK, ...TAKES_IT_IN]) {
      const sim = await simulate(onTheLibrary(id, overrides), [
        GREET,
        SCOPING,
        `So, to summarise, ${OWN.toLowerCase()} Does that work?`,
      ]);
      expect(reply(sim, 2), id).toMatch(THREE);
      expect(reply(sim, 2), id).not.toMatch(/\?/);
    }
  });

  it('is accepted when the engineer confirms what the customer said back, and asked about once', async () => {
    let asked = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = await simulate(
        onTheLibrary(
          'windows-11-slow-after-update',
          { style: 'talkative', startingTemperature: 'calm' },
          seed,
        ),
        [
          GREET,
          SCOPING,
          OWN,
          'Yes, that is right.',
          "I'll also email you the summary by 5pm.",
          'Yes, that is right.',
        ],
      );
      expect(reply(sim, 3), `seed ${seed}`).toMatch(/works|fine/i);
      expect(sim.turns[3]?.runtime.awaitingConfirmation, `seed ${seed}`).toBe(false);
      // A cooperative customer may ask what the engineer needs from their side, but only once.
      const questions = sim.turns.filter((t) =>
        /anything you need from (?:our side|us)|need anything from (?:us|our side)/i.test(
          t.customer,
        ),
      ).length;
      expect(questions, `seed ${seed}`).toBeLessThanOrEqual(1);
      asked += questions;
    }
    expect(asked).toBeGreaterThan(0);
  });

  it('is never followed by that question from a terse, demanding or upset customer', async () => {
    for (const overrides of [
      { style: 'terse', startingTemperature: 'calm' },
      { style: 'demanding', startingTemperature: 'calm' },
      { style: 'talkative', startingTemperature: 'angry' },
    ] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        const sim = await simulate(
          onTheLibrary('teams-cannot-join-external-meetings', overrides, seed),
          [GREET, SCOPING, OWN, 'Yes, that is right.', 'What else can I tell you?'],
        );
        for (const t of sim.turns) {
          expect(t.customer, `${overrides.style}/${seed}`).not.toMatch(/anything you need from/i);
        }
      }
    }
  });

  it('calms the customer, and calms them no further each time it is said again', async () => {
    const sim = await talk({ startingTemperature: 'frustrated' }, [
      GREET,
      OWN,
      'I will ring you at 3pm with an update, as I said.',
      OWN,
    ]);
    expect(warmth(sim, 1)).toBeLessThanOrEqual(-8);
    expect(sim.turns[1]?.runtime.customer.trust).toBeGreaterThan(
      sim.turns[0]?.runtime.customer.trust ?? 100,
    );
    // The time was given once. Saying it again is no new reason to calm down.
    for (const turn of [2, 3]) {
      expect(warmth(sim, turn), `turn ${turn}`).toBeGreaterThanOrEqual(-3);
      expect(reasons(sim, turn).join(' '), `turn ${turn}`).not.toMatch(
        /Took clear ownership|Gave specific next steps/,
      );
    }
  });

  it('is not a reason to calm down when the time given contradicts the one before', async () => {
    const sim = await talk({ startingTemperature: 'frustrated' }, [
      GREET,
      "I'll call you back by 3pm with an update.",
      "I'll call you back by 5pm with an update.",
    ]);
    expect(reasons(sim, 2)).toContain('The time given changed from what was promised earlier');
    expect(reasons(sim, 2)).not.toContain('Gave specific next steps with a time');
    expect(warmth(sim, 2)).toBeGreaterThan(0);
  });

  it('does not make a goodbye, or a yes to the customer’s question, a wasted turn', async () => {
    const sim = await talk({ startingTemperature: 'calm', style: 'demanding' }, [
      GREET,
      OWN,
      'Yes, that is right.',
      'Thank you. Goodbye.',
    ]);
    expect(categories(sim, 2)).not.toContain('delay');
    expect(categories(sim, 3)).not.toContain('delay');
  });
});

describe('a vague commitment', () => {
  const calm = { startingTemperature: 'calm', style: 'terse' } as const;
  const presses = async (overrides: Overrides, lines: string[], seed = 7) => {
    const contexts = await captureContexts(makeScenario(overrides, seed), lines);
    return contexts.map((ctx) => planReply(ctx).presses);
  };

  it('is pressed for a time once, in a few words by a terse customer, and not in the next reply', async () => {
    const lines = [GREET, SCOPING, "I'll look into it.", "We'll get back to you soon."];
    const sim = await simulate(
      onTheLibrary('outlook-shared-mailbox-missing', {
        style: 'terse',
        startingTemperature: 'calm',
      }),
      lines,
    );
    expect(reply(sim, 2)).toMatch(/\b(?:when|hear)\b/i);
    expect(reply(sim, 2)).toMatch(/\?$/);
    expect(reply(sim, 2).split(/\s+/).length).toBeLessThanOrEqual(8);
    // Remembered as an ask, so that nothing else is asked for soon after...
    expect(sim.turns[2]?.runtime.pushes.timeline).toBe(3);
    // ...and a second vague promise straight after is not pressed again.
    expect(reply(sim, 3)).not.toContain('?');
    expect(await presses(calm, lines)).toEqual([false, false, true, false]);
  });

  it('is not pressed once a time has been given, whatever vague thing is said after', async () => {
    for (const overrides of [
      { startingTemperature: 'calm', style: 'talkative' },
      { startingTemperature: 'anxious', style: 'talkative' },
      { startingTemperature: 'frustrated', style: 'vague' },
    ] as const) {
      const flags = await presses(overrides, [
        GREET,
        'What laptop are you using?',
        "I'll look into it.",
        "I'll update you by 3pm.",
        "We'll be in touch soon.",
        'I will let you know shortly.',
      ]);
      expect(flags.slice(2), JSON.stringify(overrides)).toEqual([true, false, false, false]);
    }
  });

  it('is pressed by a customer who will not take a vague answer every time, as before', async () => {
    for (const overrides of [
      { startingTemperature: 'angry', style: 'talkative' },
      { startingTemperature: 'calm', style: 'demanding' },
    ] as const) {
      const flags = await presses(overrides, [
        GREET,
        "I'll look into it.",
        "We'll get back to you soon.",
        "I'll update you by 3pm.",
        "We'll be in touch soon.",
      ]);
      // Said again without the time, a promise that has one is not a vague one: the time stands.
      expect(flags, JSON.stringify(overrides)).toEqual([false, true, true, false, false]);
    }
    // A vague promise about something else, after a time was given for the call back, is.
    const other = await presses({ startingTemperature: 'angry', style: 'demanding' }, [
      GREET,
      "I'll take ownership and call you back by 3pm with an update.",
      "I'll get back to you soon.",
    ]);
    expect(other).toEqual([false, false, true]);
  });

  it('is pressed on an owner with no time only by a customer who would ask', async () => {
    const lines = [GREET, 'What laptop are you using?', 'I will take ownership of this.'];
    expect((await presses(calm, lines)).at(-1)).toBe(false);
    expect((await presses({ startingTemperature: 'calm', style: 'talkative' }, lines)).at(-1)).toBe(
      false,
    );
    expect(
      (await presses({ startingTemperature: 'anxious', style: 'talkative' }, lines)).at(-1),
    ).toBe(true);
    // Taking the case on is good news to a calm customer: they say so rather than ask.
    const sim = await talk({ startingTemperature: 'calm', style: 'talkative' }, lines.slice(0, 3));
    expect(reply(sim, 2)).not.toContain('?');
    expect(reply(sim, 2)).toMatch(/thank|good|reassur|glad|relief/i);
  });

  it('is pressed on "I will call you back", which names no time', async () => {
    const flags = await presses({ startingTemperature: 'anxious', style: 'talkative' }, [
      GREET,
      'What laptop are you using?',
      'I will call you back.',
    ]);
    expect(flags.at(-1)).toBe(true);
  });

  it('is not asked about on top of another ask: the press stands in for the challenge', async () => {
    const sim = await talk({ startingTemperature: 'angry', style: 'demanding' }, [
      GREET,
      "I'll look into it.",
    ]);
    // One request for a time, not "when?" and then "that is not specific, who and by when?".
    expect(reply(sim, 1).match(/\?/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

describe('"is there anything you need from your side?"', () => {
  const ASK = 'Is there anything you need to do from your side before then?';

  it('is a closing question: it is answered, and asks nothing about the problem', async () => {
    for (const id of [
      'outlook-shared-mailbox-missing',
      'teams-cannot-join-external-meetings',
      'windows-11-slow-after-update',
      'azure-vm-unreachable-production',
      'dynamics-records-not-visible-after-role-change',
    ]) {
      for (const style of ['terse', 'talkative', 'demanding', 'vague', 'non-native'] as const) {
        const sim = await simulate(onTheLibrary(id, { style }), [GREET, ASK]);
        const where = `${id}/${style}: ${reply(sim, 1)}`;
        // Nothing was earned: the question was not about the problem.
        expect(Object.keys(sim.runtime.discovery), where).toEqual([]);
        expect(reply(sim, 1), where).toMatch(NO_MORE);
        expect(sentenceCount(reply(sim, 1)), where).toBeLessThanOrEqual(3);
        expect(reply(sim, 1), where).not.toContain('?');
      }
    }
  });

  it('is not about the problem even when a model reads it as being about what changed', async () => {
    const [ctx] = await captureContexts(
      onTheLibrary('outlook-shared-mailbox-missing'),
      [
        {
          text: ASK,
          classification: {
            askedQuestion: true,
            discoveryIntents: ['recent_changes', 'timing_onset'],
            factTargets: [{ id: 'hf-access-tidy', strength: 'full' }],
          },
        },
      ],
      { matching: 'model' },
    );
    expect(ctx?.classification.discoveryIntents).toEqual([]);
    expect(ctx?.classification.factTargets).toEqual([]);
    expect(ctx?.discovery.reveal).toEqual([]);
  });

  it('is still a question about the problem when it asks about the customer’s side as a cause', async () => {
    const c = await captureContexts(onTheLibrary('outlook-shared-mailbox-missing'), [
      GREET,
      'Is there anything on your side that could explain it, like a change to who has access?',
    ]);
    expect(c.at(-1)?.classification.discoveryIntents.length).toBeGreaterThan(0);
  });

  it('is answered, if there is someone the customer said would know, with an offer to ask them', async () => {
    const lines = [
      GREET,
      'Has the administrator changed any sign-in policy?',
      "I'll take ownership and call you back by 3pm.",
      ASK,
    ];
    const talkative = await talk({ style: 'talkative', startingTemperature: 'calm' }, lines);
    expect(reply(talkative, 3)).toMatch(/our administrator/i);
    expect(reply(talkative, 3)).toMatch(NO_MORE);
    // A terse customer says only that there is nothing.
    const terse = await talk({ style: 'terse', startingTemperature: 'calm' }, lines);
    expect(reply(terse, 3)).not.toMatch(/administrator/i);
    expect(reply(terse, 3)).toMatch(NO_MORE);
    // And with nobody to offer, no one is offered: nothing is made up.
    const none = await talk({ style: 'talkative', startingTemperature: 'calm' }, [GREET, ASK]);
    expect(reply(none, 1)).not.toMatch(/administrator|ask them/i);
  });
});

describe('the end of the call', () => {
  const CLOSE = [GREET, SCOPING, OWN, 'Yes, that is right.'];
  const PERSONALITIES: [string, ScenarioOverrides][] = [
    ['outlook-shared-mailbox-missing', { style: 'terse', startingTemperature: 'calm' }],
    ['windows-11-slow-after-update', { style: 'talkative', startingTemperature: 'calm' }],
    ['teams-cannot-join-external-meetings', { style: 'demanding', startingTemperature: 'anxious' }],
    ['sharepoint-site-access-escalated', { style: 'demanding', startingTemperature: 'angry' }],
    ['m365-apps-excel-crashes-after-update', { style: 'non-native', startingTemperature: 'calm' }],
    ['power-automate-approvals-stopped', { style: 'vague', startingTemperature: 'calm' }],
  ];

  it('is closed by the customer when the engineer says goodbye: short, no questions, nothing new', async () => {
    for (const [id, overrides] of PERSONALITIES) {
      const sim = await simulate(onTheLibrary(id, overrides), [
        ...CLOSE,
        'Is there anything else I can help with?',
        "Thank you. I'll speak to you at 3pm. Have a good day.",
      ]);
      const asked = reply(sim, 4);
      const closed = reply(sim, 5);
      const where = `${id}: ${asked} | ${closed}`;
      // "Is there anything else?" is answered...
      expect(asked, where).toMatch(NO_MORE);
      // ...and the goodbye is not: it is a goodbye, in a line or two.
      expect(closed, where).toMatch(/bye|thank|wait|speak|expect|look out/i);
      expect(closed, where).not.toContain('?');
      expect(closed, where).not.toMatch(/so you(?:'ll| will)/i);
      expect(sentenceCount(closed), where).toBeLessThanOrEqual(overrides.style === 'terse' ? 2 : 3);
      // Nothing about the problem comes up again.
      expect(Object.keys(sim.turns[5]?.runtime.discovery ?? {}).length, where).toBe(
        Object.keys(sim.turns[4]?.runtime.discovery ?? {}).length,
      );
    }
  });

  it('does not close with the same line for every customer, or every call', async () => {
    for (const [id, overrides] of PERSONALITIES.slice(0, 4)) {
      const closings = new Map<number, string>();
      for (let seed = 1; seed <= 8; seed++) {
        const sim = await simulate(onTheLibrary(id, overrides, seed), [
          ...CLOSE,
          'Thanks very much. Goodbye.',
        ]);
        closings.set(seed, reply(sim, 4));
      }
      // The same customer, with another seed, closes in other words.
      expect(new Set(closings.values()).size, id).toBeGreaterThanOrEqual(3);
      expect(closings.get(1), id).not.toBe(closings.get(2));
    }
  });

  it('is not said as a farewell when the engineer only wraps up, or asks if that is all', async () => {
    const sim = await simulate(
      onTheLibrary('windows-11-slow-after-update', {
        style: 'talkative',
        startingTemperature: 'calm',
      }),
      [
        GREET,
        SCOPING,
        OWN,
        'Yes, that is right.',
        "To recap, I'll call you by 3pm. Is there anything else I can help with?",
      ],
    );
    expect(reply(sim, 4)).toMatch(NO_MORE);
    expect(reply(sim, 4)).not.toMatch(/\bbye\b|goodbye/i);
  });

  it('does not take "anything else" about the problem for the end of the call, and does take it when it asks if that is all', async () => {
    const about = [
      'Is there anything else you noticed about the error?',
      'Did you change anything else on the machine?',
      'Is there anything else that changed before it started?',
      'Have you tried anything else?',
      'Is there anything else I should know?',
      'Is there anything else you can tell me about it?',
    ];
    const ends = [
      'Is there anything else I can help with today?',
      'Anything else?',
      'Do you have any other questions?',
      "Is there anything else you'd like to add?",
      "Is there anything else you'd like to tell me?",
    ];
    const scenario = makeScenario({ startingTemperature: 'calm', style: 'talkative' });
    for (const [lines, closing] of [
      [about, false],
      [ends, true],
    ] as const) {
      for (const text of lines) {
        const ctx = (await captureContexts(scenario, [GREET, text])).at(-1);
        expect(ctx?.analysis.closingQuestionOnly, text).toBe(closing);
        expect(ctx?.analysis.anythingElseAboutCase, text).toBe(!closing);
        expect(ctx && planReply(ctx).close, text).toBe(closing ? 'asks-more' : null);
      }
    }
    // A question about the problem still reaches discovery: the customer is asked what changed.
    const ctx = (
      await captureContexts(scenario, [GREET, 'Did anything else change before it started?'])
    ).at(-1);
    expect(ctx?.classification.discoveryIntents).toContain('recent_changes');
  });

  it('is only ever a goodbye when the words are one: thanks, and "thanks for calling", are not', async () => {
    for (const text of [
      'Thanks for calling Microsoft support, how can I help?',
      'Thank you, that helps.',
      'Until then, please restart your laptop.',
      'Thanks for holding.',
      "I'll speak to you at 3pm with an update.",
    ]) {
      const [ctx] = await captureContexts(makeScenario({ startingTemperature: 'calm' }), [text]);
      expect(ctx?.analysis.farewell, text).toBe(false);
    }
    for (const text of [
      'Goodbye.',
      'Bye for now.',
      'Have a good day.',
      'Take care.',
      'Speak to you then.',
      'Thank you for your time, bye.',
    ]) {
      const [ctx] = await captureContexts(makeScenario({ startingTemperature: 'calm' }), [text]);
      expect(ctx?.analysis.farewell, text).toBe(true);
    }
  });
});

describe('a recap from the engineer', () => {
  it('is confirmed when it is right, and put right when it is wrong, by every kind of customer', async () => {
    for (const definition of library) {
      for (const style of ['terse', 'talkative', 'demanding', 'vague', 'non-native'] as const) {
        const scenario = onTheLibrary(definition.id, { style, startingTemperature: 'frustrated' });
        const right = await simulate(scenario, [
          GREET,
          SCOPING,
          `So just to confirm, ${scenario.openingCore.charAt(0).toLowerCase()}${scenario.openingCore.slice(1)} Is that right?`,
        ]);
        expect(reply(right, 2), `${definition.id}/${style}`).toMatch(
          /yes|right|exactly|that's it/i,
        );
        expect(reply(right, 2), `${definition.id}/${style}`).not.toMatch(/not quite|not right/i);

        const wrong = await simulate(scenario, [
          GREET,
          'So to confirm, a developer deleted the production database and 400 people are affected. Is that right?',
        ]);
        expect(reply(wrong, 1), `${definition.id}/${style}`).toMatch(
          /not quite|not what i|not right|that's not|don't think that's right|no, /i,
        );
      }
    }
  });

  it('never gives away a hidden fact in putting the engineer right, however the recap is wrong', async () => {
    for (const definition of library) {
      for (const style of ['terse', 'talkative', 'demanding', 'vague', 'non-native'] as const) {
        const scenario = onTheLibrary(definition.id, { style, startingTemperature: 'calm' });
        for (const recap of [
          'So to confirm, a developer deleted the production database and 400 people are affected. Is that right?',
          'So to confirm, there are 400 users affected and they are all in one office. Is that right?',
          'So the firewall update crashed your server and the database is corrupted. Is that right?',
        ]) {
          const [, ctx] = await captureContexts(scenario, [GREET, recap]);
          if (!ctx) throw new Error('no context');
          const said = composeCustomerReply(ctx).text;
          expect(factPolicy(ctx).leaks(said), `${definition.id}/${style}: ${said}`).toBe(false);
          for (const fact of scenario.hiddenFacts) {
            expect(said, `${definition.id}/${style}`).not.toContain(fact.statement.split('. ')[0]);
          }
        }
      }
    }
  });

  it('is corrected with who is affected, as the customer gave it, when the recap gets the number wrong', async () => {
    const sim = await talk({ startingTemperature: 'calm', impact: 'low', style: 'talkative' }, [
      GREET,
      'So to confirm, three of you are affected. Is that right?',
    ]);
    expect(reply(sim, 1)).toMatch(/not quite|not what i|not right/i);
    expect(reply(sim, 1)).toMatch(/just my account/i);
  });

  it('is confirmed, and what it left out is added, when it is right but leaves out who is affected', async () => {
    let added = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const sim = await talk(
        { startingTemperature: 'calm', impact: 'low', style: 'talkative' },
        [
          GREET,
          'Is it just you, or are other people affected too?',
          'So just to confirm, you changed your password this morning and now Outlook will not let you in. Is that right?',
        ],
        seed,
      );
      expect(reply(sim, 2), `seed ${seed}`).toMatch(/yes|right|exactly|that's it/i);
      expect(reply(sim, 2), `seed ${seed}`).not.toMatch(/not quite/i);
      if (/just my account/i.test(reply(sim, 2))) added += 1;
    }
    expect(added).toBeGreaterThan(0);
    // A recap that already says who is affected is not added to.
    const full = await talk({ startingTemperature: 'calm', impact: 'low', style: 'talkative' }, [
      GREET,
      'Is it just you, or are other people affected too?',
      'So just to confirm, you changed your password this morning and now Outlook will not let you in, and it is just you. Is that right?',
    ]);
    expect(reply(full, 2)).not.toMatch(/just my account/i);
  });
});

describe('the customer’s name, role and organisation', () => {
  it('are given one at a time, as asked, and together only when asked together', async () => {
    for (const id of [
      'outlook-shared-mailbox-missing',
      'azure-vm-unreachable-production',
      'sharepoint-site-access-escalated',
      'm365-apps-excel-crashes-after-update',
    ]) {
      for (const style of ['terse', 'talkative', 'demanding', 'non-native'] as const) {
        const scenario = onTheLibrary(id, { style });
        const { name, role, organisation } = scenario.persona;
        const first = name.split(' ')[0] as string;
        const sim = await simulate(scenario, [
          GREET,
          'Thank you. And what is your name?',
          'And what is your role there?',
          'Which organisation are you with?',
          'Could I have your name and your role?',
        ]);
        const where = (n: number) => `${id}/${style}: ${reply(sim, n)}`;
        expect(reply(sim, 1), where(1)).toContain(first);
        expect(reply(sim, 1), where(1)).not.toContain(organisation);
        expect(reply(sim, 1), where(1)).not.toMatch(new RegExp(role, 'i'));
        expect(reply(sim, 2), where(2)).toMatch(new RegExp(role, 'i'));
        expect(reply(sim, 2), where(2)).not.toContain(first);
        // Nothing the customer did not have is added: no "I'm not sure" to a plain question.
        expect(reply(sim, 2), where(2)).not.toMatch(/not sure|don't know|do not know/i);
        expect(reply(sim, 3), where(3)).toContain(organisation);
        expect(reply(sim, 4), where(4)).toContain(first);
        expect(reply(sim, 4), where(4)).toMatch(new RegExp(role, 'i'));
      }
    }
  });

  it('says a role the way a person does: "I\'m the head of programme delivery", "an operations manager"', async () => {
    const said = async (id: string, style: 'talkative' | 'non-native') =>
      reply(
        await simulate(onTheLibrary(id, { style }), [GREET, 'And what is your role there?']),
        1,
      );
    expect(await said('sharepoint-site-access-escalated', 'talkative')).toMatch(
      /I'm the head of programme delivery/,
    );
    expect(await said('teams-cannot-join-external-meetings', 'talkative')).toMatch(
      /I'm an operations manager/,
    );
    expect(await said('windows-11-slow-after-update', 'non-native')).toMatch(
      /I am a travel consultant/,
    );
  });

  it('does not take "do you have a case number?" for asking if they have called before', async () => {
    const sim = await simulate(
      onTheLibrary('outlook-shared-mailbox-missing', { style: 'talkative' }),
      [GREET, 'And do you have a case number?'],
    );
    expect(reply(sim, 1)).toContain('SIM-');
    expect(reply(sim, 1)).not.toMatch(/first time|called before/i);
  });
});
