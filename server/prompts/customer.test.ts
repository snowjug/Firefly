import { describe, expect, it } from 'vitest';
import { applyConfig, type EffectiveScenario } from '#shared/domain/config.ts';
import type { CustomerGenerationContext } from '../engine/pipeline.ts';
import { planReply } from '../engine/plan.ts';
import {
  captureContexts,
  makeDefinition,
  makeScenario,
  makeScopeScenario,
  SCOPE_LINES,
} from '../engine/testing.ts';
import { buildCustomerPrompt } from './customer.ts';

const GREET = 'Good morning, this is Sam from Microsoft support. How can I help?';

const lastContext = async (lines: string[], scenario: EffectiveScenario = makeScenario()) =>
  (await captureContexts(scenario, lines)).at(-1) as CustomerGenerationContext;
const systemOf = (ctx: CustomerGenerationContext) =>
  buildCustomerPrompt(ctx).request.messages[0]?.content ?? '';
const section = (system: string, from: string, to: string) => {
  const start = system.indexOf(from);
  return start < 0 ? '' : system.slice(start, system.indexOf(to, start));
};
const replySection = (system: string) => section(system, 'THIS REPLY', 'RULES THAT ALWAYS APPLY');

// ---------------------------------------------------------------------------------------

describe('the customer prompt follows the same plan as the demo customer', () => {
  it('asks for the reason for the call once the engineer has answered the greeting, and not before', async () => {
    const first = await lastContext([GREET]);
    expect(replySection(systemOf(first))).toMatch(/has just answered your greeting/);
    expect(replySection(systemOf(first))).toContain('(the reason you called)');
    const later = await lastContext([GREET, 'What does the sign-in screen say?']);
    expect(replySection(systemOf(later))).not.toMatch(/has just answered your greeting/);
  });

  it('notices an engineer who started without a greeting', async () => {
    const bare = await lastContext(['What does the sign-in screen say?']);
    expect(replySection(systemOf(bare))).toMatch(
      /started without a greeting or saying who they are/,
    );
  });

  it('limits the length to what the plan allows, and says so in the rules', async () => {
    for (const style of ['terse', 'talkative'] as const) {
      const ctx = await lastContext([GREET, 'What laptop are you using?'], makeScenario({ style }));
      const max = planReply(ctx).maxSentences;
      const system = systemOf(ctx);
      expect(system).toContain(`Length: at most ${max} short sentences.`);
      expect(system).toContain(`never more than ${max} in this reply`);
    }
    expect(
      planReply(
        await lastContext([GREET, 'What laptop are you using?'], makeScenario({ style: 'terse' })),
      ).maxSentences,
    ).toBeLessThan(
      planReply(
        await lastContext(
          [GREET, 'What laptop are you using?'],
          makeScenario({ style: 'talkative' }),
        ),
      ).maxSentences,
    );
  });

  it('gives each temperament its own character', async () => {
    const seen = new Set<string>();
    for (const startingTemperature of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
      const system = systemOf(await lastContext([GREET], makeScenario({ startingTemperature })));
      const line = system.split('\n').find((l) => l.startsWith('Temperament:')) ?? '';
      expect(line, startingTemperature).not.toBe('');
      seen.add(line);
    }
    expect(seen.size).toBe(4);
  });

  it('names the product the customer is calling about, and the channel', async () => {
    const system = systemOf(await lastContext([GREET]));
    expect(system).toMatch(/practice phone call to Microsoft support/);
    expect(system).toContain('What you are calling about: Outlook (Sign-in)');
    expect(system).toMatch(/you never speak for Microsoft/);
  });
});

describe('the customer prompt and what the customer knows', () => {
  it('lists what the customer does not know, with who would know, and says never to guess', async () => {
    const system = systemOf(await lastContext([GREET]));
    const block = section(system, 'WHAT YOU DO NOT KNOW', 'HOW YOU SPEAK');
    expect(block).toMatch(/Never guess, estimate or make up a value/);
    expect(block).toContain(
      "I don't have that to hand. Our administrator looks after the sign-in rules, not me.",
    );
    expect(block).toContain('(would know: our administrator)');
  });

  it('offers a vague fact as something the customer is not sure of, once a question picks it out', async () => {
    const ctx = await lastContext([GREET, 'Which version of Outlook are you using?']);
    expect(replySection(systemOf(ctx))).toMatch(
      /\(you are not sure of this: say it hesitantly.*\) I think it's the newer Outlook, but I couldn't swear to it\./,
    );
    const not = await lastContext([GREET, 'What laptop are you using?']);
    expect(systemOf(not)).not.toContain("I couldn't swear to it");
  });

  it('offers a fact the customer has to check as something to look up first', async () => {
    const ctx = await lastContext([GREET, 'How many people are affected?']);
    const reply = replySection(systemOf(ctx));
    expect(reply).toMatch(
      /you have to look this up first: say you will check, for example "Give me a second, I'll ask the others\."/,
    );
    expect(reply).toContain("it's me and one colleague on the front desk");
  });

  it('offers an unknown fact as something that must not be answered with a value', async () => {
    const ctx = await lastContext([GREET, 'Has the administrator changed any sign-in policy?']);
    const reply = replySection(systemOf(ctx));
    expect(reply).toMatch(
      /you do NOT know this; our administrator would know\. Say so naturally\. Never give a value, number, name or date for it/,
    );
    expect(planReply(ctx).say.some((s) => s.kind === 'unknown')).toBe(true);
  });

  it("puts a call back's record in the reply as something already said", async () => {
    const ctx = await lastContext(
      [GREET, 'Have you contacted us before?'],
      makeScenario({ callStage: 'follow-up' }),
    );
    const reply = replySection(systemOf(ctx));
    expect(reply).toMatch(/As I told you before/);
    expect(reply).toMatch(
      /\(already on the case from your earlier contact: say it again, a little impatiently\) I'm following up on the Outlook sign-in problem I reported yesterday/,
    );
  });

  it('gives back the answer already given when the same question is asked again, so it is not swapped', async () => {
    const contexts = await captureContexts(makeScopeScenario(), [GREET, ...SCOPE_LINES], {
      matching: 'model',
    });
    for (const ctx of contexts.slice(2)) {
      const reply = replySection(systemOf(ctx));
      const earlier = `"I make it 27 people across sales and the executive office who can't sign in."`;
      expect(reply).toContain(
        `keeping every fact, number and name exactly as you gave it: ${earlier}`,
      );
      expect(reply).toContain('Do not answer with a different fact');
      expect(reply).toContain(
        "(your earlier answer to this same question: say it again in a few words, keeping its facts, numbers and names unchanged) I make it 27 people across sales and the executive office who can't sign in.",
      );
      expect(reply).not.toMatch(/email and chat/i);
    }
  });
});

describe('what the customer asks the engineer for', () => {
  const update = (style: 'terse' | 'talkative') =>
    lastContext(
      [GREET, 'What laptop are you using?', 'Which version of Outlook is it?'],
      makeScenario({ callStage: 'follow-up', startingTemperature: 'frustrated', style }),
    );

  it('is asked in a few words by a terse customer, and as they please by anyone else', async () => {
    const terse = await update('terse');
    expect(planReply(terse).push).toBe('update');
    expect(replySection(systemOf(terse))).toContain('Ask where things stand, in your own words.');
    expect(replySection(systemOf(terse))).toContain('Put it in a few words.');
    const talkative = await update('talkative');
    expect(planReply(talkative).push).toBe('update');
    expect(replySection(systemOf(talkative))).not.toContain('Put it in a few words.');
  });

  it('is only ever asked for when this reply says to, and the rules say so', async () => {
    const ctx = await lastContext([GREET, 'What laptop are you using?']);
    expect(planReply(ctx).push).toBeNull();
    expect(systemOf(ctx)).toMatch(/only when the guidance for this reply tells you to/);
    expect(replySection(systemOf(ctx))).not.toMatch(/Ask where things stand|who exactly is taking/);
  });
});

describe("the scenario's own notes in the customer prompt", () => {
  const withNotes = (patch: Parameters<typeof makeDefinition>[0]) =>
    applyConfig(
      makeDefinition(patch),
      { difficulty: 'standard' },
      { seed: 7, timeOfDay: 'morning' },
    );

  it("says what the customer tried and what changed, in the customer's voice, to be said only if asked", async () => {
    const system = systemOf(await lastContext([GREET], makeScenario()));
    const who = section(system, 'WHO YOU ARE', 'WHAT YOU DO NOT KNOW');
    expect(who).toMatch(/Say it only if the engineer asks what you have tried/);
    expect(who).toContain('- I typed the new password again several times.');
    expect(who).toContain('- I restarted the laptop once.');
    expect(who).toMatch(/Say it only if the engineer asks about changes/);
    expect(who).toContain('- I changed the password this morning after the reminder email.');
  });

  it('says what the customer hopes for, and how the call would end well for them', async () => {
    const who = section(
      systemOf(await lastContext([GREET])),
      'WHO YOU ARE',
      'WHAT YOU DO NOT KNOW',
    );
    expect(who).toMatch(/What you hope for from the engineer/);
    expect(who).toContain(
      'Someone who listens, explains what is wrong in plain words and gets her back in.',
    );
    expect(who).toContain(
      'Maya is back in Outlook, knows why it happened and what to change on her phone.',
    );
  });

  it('keeps out a note or an outcome that gives a hidden fact away', async () => {
    const scenario = withNotes({
      previousTroubleshooting: [
        'Typed the new password again several times',
        'Read that the sign-in message says the account has been temporarily locked after too many sign-in attempts',
      ],
      desiredOutcome:
        'Maya learns that her account was temporarily locked after too many sign-in attempts and updates her phone.',
    });
    const earlier = await lastContext([GREET, 'What laptop are you using?'], scenario);
    const system = systemOf(earlier);
    expect(system).toContain('I typed the new password again several times.');
    expect(system).not.toMatch(/temporarily locked/);
    expect(system).not.toMatch(/Maya learns/);

    // Once the engineer has earned the fact, the same lines are free to be used.
    const later = await lastContext(
      [
        GREET,
        'Can you read me exactly what the sign-in screen says?',
        'And what else have you tried?',
      ],
      scenario,
    );
    expect(systemOf(later)).toMatch(/temporarily locked/);
  });

  it('remembers what the engineer committed to, and what the customer said they would do', async () => {
    const ctx = await lastContext(
      [
        GREET,
        "I'll take ownership and call you back by 3pm with an update.",
        'Has the administrator changed any sign-in policy?',
        'What laptop are you using?',
      ],
      makeScenario({ style: 'talkative' }),
    );
    const memory = section(systemOf(ctx), 'THE CALL SO FAR', 'THIS REPLY');
    expect(memory).toMatch(/What the engineer has committed to so far/);
    expect(memory).toMatch(
      /own the case and call me back by 3pm|own the case and update me by 3pm/,
    );
    expect(memory).toMatch(/What you said you would do/);
    expect(memory).toContain('ask our administrator');
  });

  it('keeps a commitment clear in what it remembers, and in what it says at the close, when it was said again without its time', async () => {
    const ctx = await lastContext(
      [
        GREET,
        "I'll take ownership and call you back by 3pm with an update.",
        'So I will own this and call you back. Is there anything else I can help with?',
      ],
      makeScenario({ style: 'talkative' }),
    );
    const system = systemOf(ctx);
    const memory = section(system, 'THE CALL SO FAR', 'THIS REPLY');
    expect(memory).toContain('own the case and call me back by 3pm');
    expect(memory).not.toContain('vague: no clear time');
    // The customer is asked to mention the time they were given, and not to ask for one.
    expect(replySection(system)).toContain(
      'mention what the engineer committed to, in your own words: "own the case and call me back by 3pm"',
    );
    expect(replySection(system)).not.toMatch(/ask what happens next and when|challenge/i);
  });
});

describe('what the prompt keeps from the engineer, and from the hidden facts', () => {
  it("never puts the engineer's words in the system message: they travel only as their own turns", async () => {
    const marker = 'purple walrus invoice';
    const ctx = await lastContext([GREET, `Please tell me about the ${marker} on your screen.`]);
    const { messages } = buildCustomerPrompt(ctx).request;
    expect(messages[0]?.content).not.toContain(marker);
    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: `Please tell me about the ${marker} on your screen.`,
    });
  });

  it('never carries a word that only an undiscovered hidden fact holds, whatever has been asked', async () => {
    const scenario = makeScenario({ style: 'talkative', startingTemperature: 'calm' });
    const lines = [
      GREET,
      'What laptop are you using?',
      'Tell me a bit about the setup.',
      "I'll look into it and call you back by 3pm.",
      'What does the sign-in screen say?',
    ];
    const open = new Set(
      [
        scenario.title,
        scenario.summary,
        scenario.persona.background,
        scenario.persona.voice,
        scenario.customerObjective,
        scenario.customerExpectation,
        scenario.desiredOutcome,
        scenario.openingCore,
        scenario.impactVariant.summary,
        scenario.impactVariant.detail,
        ...scenario.environment.details,
        ...scenario.previousTroubleshooting,
        ...scenario.recentChanges,
        ...scenario.knownFacts.flatMap((f) => [f.text, f.elaboration ?? '', f.simple ?? '']),
        ...scenario.vagueFacts.flatMap((f) => [f.text, f.confirmedText ?? '']),
        ...scenario.checkableFacts.flatMap((f) => [f.checking, f.text]),
        ...scenario.unknownFacts.map((f) => f.text),
        ...scenario.irrelevantFacts.map((f) => f.text),
        ...scenario.incorrectAssumptions.map((a) => a.statement),
        ...scenario.curveballs.flatMap((c) => [c.statement, c.followUp ?? '']),
      ]
        .join(' ')
        .toLowerCase()
        .match(/[a-z']{4,}/g) ?? [],
    );
    const contexts = await captureContexts(scenario, lines);
    // Words the static prompt already uses ("message", "answered"), and plain function words, say
    // nothing about a fact.
    const plain = new Set(['because', 'before', 'though', 'really', 'always', 'around']);
    const template = new Set(
      systemOf(contexts[0] as CustomerGenerationContext)
        .toLowerCase()
        .match(/[a-z']{6,}/g) ?? [],
    );
    const tokensOf = (text: string) =>
      [...new Set(text.toLowerCase().match(/[a-z']{6,}/g) ?? [])].filter(
        (w) => !open.has(w) && !template.has(w) && !plain.has(w),
      );
    const secret = new Map(scenario.hiddenFacts.map((f) => [f.id, tokensOf(f.statement)] as const));
    expect([...secret.values()].flat().length).toBeGreaterThanOrEqual(4);

    for (const ctx of contexts) {
      const system = systemOf(ctx).toLowerCase();
      for (const fact of scenario.hiddenFacts) {
        const told = ctx.runtime.discovery[fact.id];
        const revealedNow = ctx.discovery.reveal.some((r) => r.fact.id === fact.id);
        if (told || revealedNow) continue;
        for (const token of secret.get(fact.id) ?? []) {
          expect(system, `${fact.id}: ${token}`).not.toMatch(new RegExp(`\\b${token}\\b`));
        }
      }
    }
  });
});
