import { describe, expect, it } from 'vitest';
import { classifyTurnRules } from '../engine/classifier.ts';
import { FIXTURE_ID, makeDefinition } from '../engine/testing.ts';
import { startingState, type StateEvent } from '#shared/domain/state.ts';
import { openDatabase } from '../db/database.ts';
import { createRepository } from '../db/repository.ts';
import { mergeModelDraft } from '../evaluator/merge.ts';
import { EVALUATOR_NAME, EVALUATOR_VERSION, evaluateWithRules } from '../evaluator/rules.ts';
import { AppError } from '../errors.ts';
import { createFailureHooks } from '../hooks.ts';
import { createLogger, silentLogger, type Logger } from '../log.ts';
import { badOutput } from '../providers/http.ts';
import { createMockProvider } from '../providers/mock.ts';
import type { ModelProvider } from '../providers/types.ts';
import { CreateSessionSchema, SessionService } from './sessions.ts';

// The service on a real (in-memory) database, with the real rules evaluator and the built-in
// customer. The library can be swapped between services over the same database, which is what
// happens when a scenario is retired while calls that used it are still stored.

const PROFILE = 'profile-0001';

function harness(
  provider: ModelProvider = createMockProvider({ delayMs: 0 }),
  log: Logger = silentLogger,
) {
  const db = openDatabase(':memory:');
  const repo = createRepository(db);
  const serviceWith = (library = [makeDefinition()]) =>
    new SessionService({
      db,
      repo,
      provider,
      library,
      evaluators: {
        rules: { name: EVALUATOR_NAME, version: EVALUATOR_VERSION, evaluate: evaluateWithRules },
        mergeModelDraft,
      },
      log,
      hooks: createFailureHooks(true),
    });
  return { db, repo, serviceWith, service: serviceWith() };
}

async function failureOf(run: () => unknown): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to fail');
}

describe('starting a call', () => {
  it('returns the call a retried request already started, even if its scenario has been retired', async () => {
    const { service, serviceWith } = harness();
    const first = service.createSession(PROFILE, {
      scenarioId: FIXTURE_ID,
      clientRequestId: 'request-0001',
    });
    const retired = serviceWith([]);

    // The same request again: the call that exists is returned, not "scenario not found".
    expect(
      retired.createSession(PROFILE, { scenarioId: FIXTURE_ID, clientRequestId: 'request-0001' })
        .id,
    ).toBe(first.id);

    // A new request for a scenario that is no longer offered still cannot start a call.
    const missing = await failureOf(() =>
      retired.createSession(PROFILE, { scenarioId: FIXTURE_ID, clientRequestId: 'request-0002' }),
    );
    expect(missing).toBeInstanceOf(AppError);
    expect(missing).toMatchObject({ status: 404, code: 'not_found' });
  });

  it("greets to suit the time of day on the trainee's own clock, and keeps it with the call", () => {
    const { service, repo } = harness();
    for (const [timeOfDay, greeting] of [
      ['morning', /good morning/i],
      ['afternoon', /good afternoon/i],
      ['evening', /good evening/i],
    ] as const) {
      const call = service.createSession(PROFILE, { scenarioId: FIXTURE_ID, timeOfDay });
      const stored = repo.getSession(call.id, PROFILE);
      expect(stored?.scenario.config.timeOfDay).toBe(timeOfDay);
      expect(repo.getTurns(call.id)[0]?.text).toMatch(greeting);
    }
  });

  it('accepts only the times of day there are', () => {
    expect(
      CreateSessionSchema.safeParse({ scenarioId: FIXTURE_ID, timeOfDay: 'evening' }).success,
    ).toBe(true);
    expect(CreateSessionSchema.safeParse({ scenarioId: FIXTURE_ID }).success).toBe(true);
    expect(
      CreateSessionSchema.safeParse({ scenarioId: FIXTURE_ID, timeOfDay: 'midnight' }).success,
    ).toBe(false);
  });
});

describe('a call whose scenario has been retired', () => {
  it('can still be read, carried on and ended with its report', async () => {
    const { service, serviceWith } = harness();
    const call = service.createSession(PROFILE, { scenarioId: FIXTURE_ID });
    const retired = serviceWith([]);
    expect(retired.listScenarios()).toEqual([]);
    expect(await failureOf(() => retired.getScenario(FIXTURE_ID))).toMatchObject({ status: 404 });

    expect(retired.getSession(PROFILE, call.id).id).toBe(call.id);
    expect(retired.getTranscript(PROFILE, call.id).turns).toHaveLength(1);

    const sent = await retired.sendMessage(PROFILE, call.id, {
      text: 'Hello, this is Sam from Microsoft support. How can I help?',
      clientMessageId: 'message-0001',
    });
    expect(sent.customerTurn.text).toMatch(/can't sign in to Outlook/);

    await retired.endSession(PROFILE, call.id);
    await retired.settle(call.id);
    const report = retired.getReport(PROFILE, call.id);
    expect(report.completion.traineeTurns).toBe(1);
  });
});

describe('what the customer says depends on who read the question', () => {
  // A question about the setup that none of the cues of "which version of Outlook" pick out.
  const text = 'Hello, I am Sam. What kind of computer and software are you using?';

  async function toldAfter(provider: ModelProvider): Promise<string[]> {
    const { service, repo } = harness(provider);
    const call = service.createSession(PROFILE, { scenarioId: FIXTURE_ID });
    await service.sendMessage(PROFILE, call.id, { text, clientMessageId: 'message-0001' });
    return Object.keys(repo.getSession(call.id, PROFILE)?.runtime.toldKnownFacts ?? {});
  }

  it('applies the cues of a fact in demo mode, and leaves them to a model that reads the question', async () => {
    const demo = createMockProvider({ delayMs: 0 });
    expect(await toldAfter(demo)).not.toContain('vf-outlook-app');

    const model: ModelProvider = {
      ...demo,
      demo: false,
      classifyTurn: (args) =>
        Promise.resolve(
          classifyTurnRules(args.traineeText, { scenario: args.scenario, traineeTurnNumber: 1 }),
        ),
    };
    expect(await toldAfter(model)).toContain('vf-outlook-app');
  });
});

describe('what the log says when a model reply had to be turned down', () => {
  const TEXT = 'Hello, I am Sam. What does the sign-in message say?';
  const lines: Record<string, unknown>[] = [];
  const log = createLogger(
    (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
    'info',
  );
  const demo = createMockProvider({ delayMs: 0 });
  const model = (generate: ModelProvider['generateCustomer']): ModelProvider => ({
    ...demo,
    demo: false,
    classifyTurn: (args) =>
      Promise.resolve(
        classifyTurnRules(args.traineeText, { scenario: args.scenario, traineeTurnNumber: 1 }),
      ),
    generateCustomer: generate,
  });

  it('gives the codes of the checks that turned the replies down, and never what they said', async () => {
    lines.length = 0;
    const { service } = harness(
      model(() => Promise.reject(badOutput(['1:leaks', '2:invents', 'repair:none']))),
      log,
    );
    const call = service.createSession(PROFILE, { scenarioId: FIXTURE_ID });
    const error = await failureOf(() =>
      service.sendMessage(PROFILE, call.id, { text: TEXT, clientMessageId: 'message-0001' }),
    );
    expect(error).toMatchObject({ status: 502, code: 'provider_bad_output' });

    const failed = lines.find((line) => line.event === 'message.failed');
    expect(failed).toMatchObject({
      level: 'warn',
      code: 'provider_bad_output',
      problems: ['1:leaks', '2:invents', 'repair:none'],
    });
    expect(JSON.stringify(lines)).not.toContain('sign-in message');
  });

  it('says so, with codes only, when a reply was cut down to what could be said safely', async () => {
    lines.length = 0;
    const { service } = harness(
      model(() =>
        Promise.resolve({
          text: 'It says my account is locked.',
          source: 'live',
          repaired: ['leaks'],
        }),
      ),
      log,
    );
    const call = service.createSession(PROFILE, { scenarioId: FIXTURE_ID });
    await service.sendMessage(PROFILE, call.id, { text: TEXT, clientMessageId: 'message-0001' });
    expect(lines.find((line) => line.event === 'message.ok')).toMatchObject({
      repaired: ['leaks'],
    });
  });

  it('leaves the field out when nothing was wrong', async () => {
    lines.length = 0;
    const { service } = harness(
      model(() => Promise.resolve({ text: 'It says my account is locked.', source: 'live' })),
      log,
    );
    const call = service.createSession(PROFILE, { scenarioId: FIXTURE_ID });
    await service.sendMessage(PROFILE, call.id, { text: TEXT, clientMessageId: 'message-0001' });
    expect(lines.find((line) => line.event === 'message.ok')).not.toHaveProperty('repaired');
  });
});

describe('how a customer turn should sound', () => {
  const START_EVENT = (turnIndex: number, previous: number, next: number): StateEvent => ({
    turnIndex,
    key: 'temperature',
    previous,
    next,
    delta: next - previous,
    category: 'empathy',
    reason: 'test',
  });

  function callWithEvents(events: (start: number) => StateEvent[], customerTurns: number[]) {
    const { service, repo } = harness();
    const call = service.createSession(PROFILE, { scenarioId: FIXTURE_ID });
    const stored = repo.getSession(call.id, PROFILE);
    if (!stored) throw new Error('no call');
    const cfg = stored.scenario.config;
    const start = startingState({
      startingTemperature: cfg.startingTemperature,
      difficulty: cfg.difficulty,
      callStage: cfg.callStage,
      impact: cfg.impact,
    }).temperature;
    for (const index of customerTurns) {
      repo.insertTurn(call.id, {
        idx: index - 1,
        role: 'trainee',
        text: 'Hello.',
        source: 'trainee',
        inputMode: 'text',
        clientMessageId: null,
        classification: null,
      });
      repo.insertTurn(call.id, {
        idx: index,
        role: 'customer',
        text: 'Hello.',
        source: 'demo',
        inputMode: 'text',
        clientMessageId: null,
        classification: null,
      });
    }
    repo.insertStateEvents(call.id, events(start));
    return { service, id: call.id };
  }

  it('says who speaks, how hot the customer was, and that they were not cooling down at the start', () => {
    const { service } = harness();
    const call = service.createSession(PROFILE, { scenarioId: FIXTURE_ID, timeOfDay: 'morning' });
    expect(service.getSpeakableTurn(PROFILE, call.id, 1)).toEqual({
      text: expect.stringMatching(/good morning/i),
      speaker: 'female',
      mood: 'calm',
      recovering: false,
    });
  });

  it('says the customer is recovering once their temperature has come down over the last turns', () => {
    const { service, id } = callWithEvents(
      (start) => [
        START_EVENT(2, start, start + 30),
        START_EVENT(4, start + 30, start + 15),
        START_EVENT(6, start + 15, start + 5),
      ],
      [3, 5, 7],
    );
    // Reply to the turn that brought it down further: cooling down.
    expect(service.getSpeakableTurn(PROFILE, id, 7).recovering).toBe(true);
    // Reply to the turn that made it much worse: not.
    expect(service.getSpeakableTurn(PROFILE, id, 3).recovering).toBe(false);
  });

  it('says it is not recovering for a customer who has only been getting hotter', () => {
    const { service, id } = callWithEvents(
      (start) => [START_EVENT(2, start, start + 10), START_EVENT(4, start + 10, start + 25)],
      [3, 5],
    );
    expect(service.getSpeakableTurn(PROFILE, id, 5).recovering).toBe(false);
  });
});
