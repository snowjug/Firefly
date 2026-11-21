import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIMITS } from '../services/sessions.ts';
import { createTestApp, type TestApp } from './harness.ts';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});

const newSession = async (client = app.client(), body: Record<string, unknown> = {}) => {
  const res = await client.post('/api/sessions', {
    scenarioId: 'locked-out-after-password-reset',
    ...body,
  });
  expect(res.status).toBe(201);
  return { client, session: res.body.session };
};
const say = (
  client: ReturnType<typeof app.client>,
  id: string,
  text: string,
  clientMessageId = randomUUID(),
) => client.post(`/api/sessions/${id}/messages`, { text, clientMessageId });

describe('basics and security headers', () => {
  it('reports health and configuration, labelling demo mode', async () => {
    const c = app.client();
    const health = await c.get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    const config = await c.get('/api/config');
    expect(config.body.provider).toMatchObject({ kind: 'mock', demo: true });
    expect(config.body.provider.label).toMatch(/demo mode/i);
  });

  it('sets security headers and a strict content security policy', async () => {
    const res = await app.client().get('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('lets the page play spoken replies from blob URLs without loosening anything else', async () => {
    for (const path of ['/api/health', '/']) {
      const res = await app.client().raw(path);
      const policy = res.headers.get('content-security-policy') ?? '';
      expect(policy, path).toContain("media-src 'self' blob:");
      expect(policy, path).toContain("script-src 'self';");
      expect(policy, path).toContain("style-src 'self';");
      expect(policy, path).not.toMatch(/unsafe-inline|unsafe-eval/);
    }
  });

  it('lets its own pages use the microphone (Voice needs it) and nothing else sensitive', async () => {
    const policy = (await app.client().get('/api/health')).headers.get('permissions-policy') ?? '';
    // `microphone=()` makes browser speech recognition fail at once with "not-allowed".
    expect(policy).toContain('microphone=(self)');
    expect(policy).toContain('camera=()');
    expect(policy).toContain('geolocation=()');
  });

  it('issues an HttpOnly, SameSite profile cookie', async () => {
    const res = await app.client().raw('/api/health');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/firefly_profile=[a-f0-9]{32}/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('returns JSON errors for unknown endpoints and wrong methods', async () => {
    const c = app.client();
    const missing = await c.get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('not_found');
    const wrong = await c.post('/api/health', {});
    expect(wrong.status).toBe(405);
  });
});

describe('scenarios', () => {
  it('never exposes hidden facts, evaluator notes or rules through the public scenario', async () => {
    const res = await app.client().get('/api/scenarios');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('hiddenFacts');
    expect(text).not.toContain('evaluatorNotes');
    expect(text).not.toMatch(/old password|temporarily locked/i);
    expect(res.body.scenarios[0].synthetic).toBe(true);
    const one = await app.client().get('/api/scenarios/locked-out-after-password-reset');
    expect(one.body.scenario.persona.name).toBe('Maya Okafor');
    expect((await app.client().get('/api/scenarios/unknown')).status).toBe(404);
  });
});

describe('sessions and messages', () => {
  it('creates a session with the opening turn, idempotently', async () => {
    const c = app.client();
    const clientRequestId = randomUUID();
    const a = await c.post('/api/sessions', {
      scenarioId: 'locked-out-after-password-reset',
      clientRequestId,
    });
    const b = await c.post('/api/sessions', {
      scenarioId: 'locked-out-after-password-reset',
      clientRequestId,
    });
    expect(a.body.session.id).toBe(b.body.session.id);
    expect(a.body.session.turns).toHaveLength(1);
    expect(a.body.session.turns[0]).toMatchObject({
      index: 1,
      role: 'customer',
      source: 'opening',
    });
    expect(a.body.session.status).toBe('active');
    expect(a.body.session.providerLabel).toMatch(/demo mode/i);
    expect((await c.get('/api/sessions')).body.total).toBe(1);
  });

  it('applies configuration overrides and validates them', async () => {
    const { session } = await newSession(app.client(), {
      overrides: { difficulty: 'challenge', startingTemperature: 'angry', style: 'terse' },
    });
    expect(session.scenario.config).toMatchObject({
      difficulty: 'challenge',
      startingTemperature: 'angry',
      style: 'terse',
    });
    const bad = await app.client().post('/api/sessions', {
      scenarioId: 'locked-out-after-password-reset',
      overrides: { difficulty: 'impossible' },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('validation_failed');
  });

  it('answers a message and keeps hidden facts hidden from the trainee payload', async () => {
    const { client, session } = await newSession(app.client(), {
      overrides: { difficulty: 'standard' },
    });
    const res = await say(
      client,
      session.id,
      "Hi, I'm Sam. Is your work email signed in on your phone?",
    );
    expect(res.status).toBe(200);
    expect(res.body.traineeTurn.index).toBe(2);
    expect(res.body.customerTurn).toMatchObject({ index: 3, role: 'customer', source: 'demo' });
    expect(res.body.customerTurn.text).toMatch(/phone/i);
    expect(Object.keys(res.body.state).sort()).toEqual([
      'band',
      'discoveredCount',
      'shifts',
      'silent',
      'trend',
    ]);
    expect(res.body.state.discoveredCount).toBe(1);
    expect(res.body.state.shifts).toBe(0);
    const reload = await client.get(`/api/sessions/${session.id}`);
    expect(JSON.stringify(reload.body)).not.toContain('hiddenFacts');
    expect(reload.body.session.turns.map((t: { markers?: unknown }) => t.markers)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(reload.body.session.report).toBeNull();
  });

  it('never duplicates a message that is sent twice with the same client id', async () => {
    const { client, session } = await newSession();
    const id = randomUUID();
    const first = await say(client, session.id, 'When did this start?', id);
    const again = await say(client, session.id, 'When did this start?', id);
    expect(again.status).toBe(200);
    expect(again.body.customerTurn.text).toBe(first.body.customerTurn.text);
    const reload = await client.get(`/api/sessions/${session.id}`);
    expect(reload.body.session.turns).toHaveLength(3);
  });

  it('redacts sensitive data before storing it', async () => {
    const { client, session } = await newSession();
    const res = await say(client, session.id, 'Can I confirm your email is maya@example.com?');
    expect(res.body.redactions).toContain('email');
    expect(res.body.traineeTurn.text).toContain('[email removed]');
    expect(res.body.traineeTurn.text).not.toContain('maya@example.com');
  });

  it('enforces ownership: another browser profile cannot see or change a session', async () => {
    const { session } = await newSession();
    const stranger = app.client();
    expect((await stranger.get(`/api/sessions/${session.id}`)).status).toBe(404);
    expect((await say(stranger, session.id, 'hello')).status).toBe(404);
    expect((await stranger.post(`/api/sessions/${session.id}/end`, {})).status).toBe(404);
    expect((await stranger.del(`/api/sessions/${session.id}`)).status).toBe(404);
  });
});

describe('how a trainee turn arrived', () => {
  const sendVoice = (
    client: ReturnType<typeof app.client>,
    id: string,
    text: string,
    clientMessageId = randomUUID(),
    inputMode: string | null = 'voice', // null leaves it out of the request
  ) =>
    client.post(`/api/sessions/${id}/messages`, {
      text,
      clientMessageId,
      ...(inputMode === null ? {} : { inputMode }),
    });
  const modes = (turns: { role: string; inputMode: string }[]) =>
    turns.map((t) => `${t.role}:${t.inputMode}`);

  it('stores a spoken turn as voice and returns it as voice wherever turns are returned', async () => {
    const { client, session } = await newSession();
    expect(modes(session.turns)).toEqual(['customer:text']);

    const res = await sendVoice(client, session.id, 'Hello, I am Sam. What is happening?');
    expect(res.status).toBe(200);
    expect(res.body.traineeTurn).toMatchObject({ index: 2, role: 'trainee', inputMode: 'voice' });
    expect(res.body.customerTurn).toMatchObject({ index: 3, role: 'customer', inputMode: 'text' });

    const reload = await client.get(`/api/sessions/${session.id}`);
    expect(modes(reload.body.session.turns)).toEqual([
      'customer:text',
      'trainee:voice',
      'customer:text',
    ]);
    // A typed turn after a spoken one is typed.
    await say(client, session.id, 'When did it start?');
    const again = await client.get(`/api/sessions/${session.id}`);
    expect(modes(again.body.session.turns)).toEqual([
      'customer:text',
      'trainee:voice',
      'customer:text',
      'trainee:text',
      'customer:text',
    ]);
  });

  it('keeps the mode after the call is over', async () => {
    const { client, session } = await newSession();
    await sendVoice(client, session.id, 'Hello, I am Sam. What is happening?');
    await client.post(`/api/sessions/${session.id}/end`, {});
    await app.service.settle(session.id);
    const done = await client.get(`/api/sessions/${session.id}`);
    expect(done.body.session.status).toBe('completed');
    expect(modes(done.body.session.turns)).toEqual([
      'customer:text',
      'trainee:voice',
      'customer:text',
    ]);
  });

  it('treats a message with no input mode as typed, and refuses one it does not know', async () => {
    const { client, session } = await newSession();
    const plain = await sendVoice(client, session.id, 'What is happening?', randomUUID(), null);
    expect(plain.body.traineeTurn.inputMode).toBe('text');
    const typed = await sendVoice(client, session.id, 'When did it start?', randomUUID(), 'text');
    expect(typed.body.traineeTurn.inputMode).toBe('text');

    const bad = await sendVoice(client, session.id, 'Who is affected?', randomUUID(), 'telepathy');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('validation_failed');
    const reload = await client.get(`/api/sessions/${session.id}`);
    expect(reload.body.session.turns).toHaveLength(5);
  });

  it('keeps one turn, still spoken, when the same message is sent again', async () => {
    const { client, session } = await newSession();
    const id = randomUUID();
    const first = await sendVoice(client, session.id, 'When did this start?', id, 'voice');
    // A resend, even one that gets the mode wrong or leaves it out, returns the stored turn.
    const typed = await sendVoice(client, session.id, 'When did this start?', id, 'text');
    const bare = await sendVoice(client, session.id, 'When did this start?', id, null);
    for (const again of [typed, bare]) {
      expect(again.status).toBe(200);
      expect(again.body.traineeTurn).toEqual(first.body.traineeTurn);
      expect(again.body.customerTurn.text).toBe(first.body.customerTurn.text);
    }
    const reload = await client.get(`/api/sessions/${session.id}`);
    expect(modes(reload.body.session.turns)).toEqual([
      'customer:text',
      'trainee:voice',
      'customer:text',
    ]);
  });

  it('keeps the mode of a turn whose reply failed, and when the retry succeeds', async () => {
    const { client, session } = await newSession();
    await app.client().post('/api/test/fail-next', { target: 'customer', count: 1 });
    const id = randomUUID();
    const failed = await sendVoice(client, session.id, 'When did it start?', id, 'voice');
    expect(failed.status).toBe(502);
    expect(failed.body.error.details.traineeTurn).toMatchObject({
      role: 'trainee',
      inputMode: 'voice',
    });

    const mid = await client.get(`/api/sessions/${session.id}`);
    expect(mid.body.session.awaitingReply).toEqual({ clientMessageId: id, turnIndex: 2 });
    expect(modes(mid.body.session.turns)).toEqual(['customer:text', 'trainee:voice']);

    // The retry leaves the mode out, as a client that only remembers the text and the id might.
    const retried = await sendVoice(client, session.id, 'When did it start?', id, null);
    expect(retried.status).toBe(200);
    expect(retried.body.traineeTurn.inputMode).toBe('voice');
    const after = await client.get(`/api/sessions/${session.id}`);
    expect(modes(after.body.session.turns)).toEqual([
      'customer:text',
      'trainee:voice',
      'customer:text',
    ]);
    expect(after.body.session.awaitingReply).toBeNull();
  });

  it('never marks the customer as having spoken into the microphone', async () => {
    const { client, session } = await newSession();
    for (const text of ['What is happening?', 'When did it start?', 'Who is affected?']) {
      await sendVoice(client, session.id, text);
    }
    const reload = await client.get(`/api/sessions/${session.id}`);
    for (const turn of reload.body.session.turns) {
      expect(turn.role === 'customer' ? turn.inputMode : 'text').toBe('text');
    }
  });
});

describe('input validation and abuse limits', () => {
  it('rejects bad payloads with safe validation errors', async () => {
    const { client, session } = await newSession();
    const empty = await client.post(`/api/sessions/${session.id}/messages`, {
      text: '',
      clientMessageId: randomUUID(),
    });
    expect(empty.status).toBe(400);
    const noId = await client.post(`/api/sessions/${session.id}/messages`, { text: 'hi' });
    expect(noId.status).toBe(400);
    expect(noId.body.error.code).toBe('validation_failed');
    const tooLong = await say(client, session.id, 'x'.repeat(1600));
    expect(tooLong.status).toBe(400);
    const wrongType = await client.raw(`/api/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    expect(wrongType.status).toBe(415);
    const huge = await client.raw(`/api/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'a'.repeat(100_000), clientMessageId: randomUUID() }),
    });
    expect(huge.status).toBe(413);
  });

  it('blocks cross-site writes', async () => {
    const c = app.client();
    const res = await c.post(
      '/api/sessions',
      { scenarioId: 'locked-out-after-password-reset' },
      { origin: 'https://evil.example' },
    );
    expect(res.status).toBe(403);
    const same = await c.post(
      '/api/sessions',
      { scenarioId: 'locked-out-after-password-reset' },
      { origin: app.baseUrl },
    );
    expect(same.status).toBe(201);
  });

  it('rate-limits message bursts', async () => {
    const { client, session } = await newSession();
    let limited = 0;
    for (let i = 0; i < 40; i++) {
      const r = await say(client, session.id, `question number ${i}?`);
      if (r.status === 429) {
        limited += 1;
        expect(r.body.error.code).toBe('rate_limited');
        expect(r.body.error.retryable).toBe(true);
      }
    }
    expect(limited).toBeGreaterThan(0);
  });

  it('stops a runaway call at the turn limit', async () => {
    const profile = 'a'.repeat(32);
    const session = app.service.createSession(profile, {
      scenarioId: 'locked-out-after-password-reset',
    });
    for (let i = 0; i < LIMITS.maxTraineeTurns; i++) {
      await app.service.sendMessage(profile, session.id, {
        text: `Question ${i}: when did it start?`,
        clientMessageId: randomUUID(),
      });
    }
    await expect(
      app.service.sendMessage(profile, session.id, {
        text: 'One more?',
        clientMessageId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'turn_limit_reached', status: 409 });
    // The call can still be ended and evaluated.
    const ended = await app.service.endSession(profile, session.id);
    await app.service.settle(session.id);
    expect(['completing', 'completed']).toContain(ended.status);
  });
});

describe('failure recovery', () => {
  it('keeps the trainee turn when the customer cannot reply, and recovers on retry without duplicates', async () => {
    const { client, session } = await newSession();
    await say(client, session.id, 'Hi, I am Sam. What is happening?');
    await app.client().post('/api/test/fail-next', { target: 'customer', count: 1 });
    const id = randomUUID();
    const failed = await say(client, session.id, 'When did it start?', id);
    expect(failed.status).toBe(502);
    expect(failed.body.error).toMatchObject({ code: 'provider_unavailable', retryable: true });
    expect(failed.body.error.details.traineeTurn.text).toBe('When did it start?');

    const mid = await client.get(`/api/sessions/${session.id}`);
    const last = mid.body.session.turns.at(-1);
    expect(last).toMatchObject({ role: 'trainee', text: 'When did it start?' });
    expect(mid.body.session.awaitingReply).toEqual({ clientMessageId: id, turnIndex: last.index });

    const blocked = await say(client, session.id, 'A different message');
    expect(blocked.status).toBe(409);

    const retried = await say(client, session.id, 'When did it start?', id);
    expect(retried.status).toBe(200);
    const after = await client.get(`/api/sessions/${session.id}`);
    expect(after.body.session.awaitingReply).toBeNull();
    expect(
      after.body.session.turns.filter((t: { role: string }) => t.role === 'trainee'),
    ).toHaveLength(2);
    expect(after.body.session.turns).toHaveLength(5);
  });

  it('falls back to the rules classifier when classification fails, and still replies', async () => {
    const { client, session } = await newSession();
    await app.client().post('/api/test/fail-next', { target: 'classifier', count: 1 });
    const res = await say(client, session.id, 'When did this start?');
    expect(res.status).toBe(200);
  });
});

describe('ending a call', () => {
  it('requires a conversation, then completes with exactly one saved report', async () => {
    const { client, session } = await newSession();
    const empty = await client.post(`/api/sessions/${session.id}/end`, {});
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('no_conversation');

    await say(client, session.id, 'Hello, I am Sam. What is happening?');
    await say(client, session.id, 'When did it start?');
    const [a, b] = await Promise.all([
      client.post(`/api/sessions/${session.id}/end`, {}),
      client.post(`/api/sessions/${session.id}/end`, {}),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    await app.service.settle(session.id);
    const done = await client.get(`/api/sessions/${session.id}`);
    expect(done.body.session.status).toBe('completed');
    expect(done.body.session.report).not.toBeNull();
    expect(done.body.session.overallScore).toBe(3);
    expect(done.body.session.durationSeconds).toBeGreaterThanOrEqual(0);

    const again = await client.post(`/api/sessions/${session.id}/end`, {});
    expect(again.body.session.status).toBe('completed');
    const count = app.repo.getEvaluation(session.id);
    expect(count).not.toBeNull();

    const late = await say(client, session.id, 'Hello?');
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('session_not_active');
    const report = await client.get(`/api/sessions/${session.id}/report`);
    expect(report.body.report.version).toBe(1);
  });

  it('calls a short call without a wrap-up "ended early", but not a long one', async () => {
    const finish = async (lines: string[]) => {
      const { client, session } = await newSession();
      for (const line of lines) await say(client, session.id, line);
      await client.post(`/api/sessions/${session.id}/end`, {});
      await app.service.settle(session.id);
      return (await client.get(`/api/sessions/${session.id}`)).body.session;
    };
    const questions = [
      'What is happening?',
      'When did it start?',
      'Who is affected?',
      'What changed recently?',
      'What have you tried so far?',
      'What does the screen say?',
    ];
    const short = await finish(questions.slice(0, 2));
    expect(short.completion).toBe('ended-early');
    expect(short.report.completion.status).toBe('ended-early');
    const long = await finish(questions);
    expect(long.completion).toBe('completed');
    expect(long.report.completion.status).toBe('completed');
  });

  it('serves a transcript-only copy with nothing that reveals the scores', async () => {
    const { client, session } = await newSession();
    await say(client, session.id, 'Hello, I am Sam. What is happening?');
    await client.post(`/api/sessions/${session.id}/end`, {});
    await app.service.settle(session.id);
    const res = await client.get(`/api/sessions/${session.id}/transcript`);
    expect(res.status).toBe(200);
    const { transcript } = res.body;
    expect(Object.keys(transcript).sort()).toEqual([
      'persona',
      'scenarioTitle',
      'sessionId',
      'status',
      'turns',
    ]);
    expect(transcript.turns).toHaveLength(3);
    expect(Object.keys(transcript.turns[0]).sort()).toEqual(['createdAt', 'index', 'role', 'text']);
    expect(JSON.stringify(transcript)).not.toMatch(/markers|dimension|overallScore|report/i);
    // Another browser profile cannot read it.
    expect((await app.client().get(`/api/sessions/${session.id}/transcript`)).status).toBe(404);
  });

  it('adds transcript markers only after the call ends', async () => {
    const { client, session } = await newSession(app.client(), {
      overrides: { difficulty: 'standard' },
    });
    await say(client, session.id, 'Is your work email signed in on your phone?');
    await client.post(`/api/sessions/${session.id}/end`, {});
    await app.service.settle(session.id);
    const done = await client.get(`/api/sessions/${session.id}`);
    const withMarkers = done.body.session.turns.filter(
      (t: { markers?: unknown[] }) => t.markers?.length,
    );
    expect(withMarkers.length).toBeGreaterThan(0);
    expect(JSON.stringify(withMarkers)).toMatch(/Uncovered: Phone still using the old password/);
  });

  it('keeps the transcript when evaluation fails and lets the trainee retry', async () => {
    const { client, session } = await newSession();
    await say(client, session.id, 'Hello, I am Sam. What is happening?');
    await app.client().post('/api/test/fail-next', { target: 'evaluator', count: 1 });
    const ended = await client.post(`/api/sessions/${session.id}/end`, {});
    await app.service.settle(session.id);
    expect(ended.status).toBe(200);
    const failed = await client.get(`/api/sessions/${session.id}`);
    expect(failed.body.session.status).toBe('evaluation_failed');
    expect(failed.body.session.evaluationError.retryable).toBe(true);
    expect(failed.body.session.turns).toHaveLength(3);
    expect(failed.body.session.report).toBeNull();

    const retry = await client.post(`/api/sessions/${session.id}/evaluate`, {});
    await app.service.settle(session.id);
    expect(retry.status).toBe(200);
    const ok = await client.get(`/api/sessions/${session.id}`);
    expect(ok.body.session.status).toBe('completed');
    expect(ok.body.session.report).not.toBeNull();
  });
});

describe('history', () => {
  it('lists, filters and deletes sessions', async () => {
    const c = app.client();
    await newSession(c, { overrides: { difficulty: 'starter' } });
    await newSession(c, { overrides: { difficulty: 'challenge' } });
    const all = await c.get('/api/sessions');
    expect(all.body.total).toBe(2);
    const starter = await c.get('/api/sessions?difficulty=starter');
    expect(starter.body.sessions).toHaveLength(1);
    expect((await c.get('/api/sessions?difficulty=bogus')).status).toBe(400);
    const id = all.body.sessions[0].id;
    expect((await c.del(`/api/sessions/${id}`)).body.deleted).toBe(true);
    expect((await c.get('/api/sessions')).body.total).toBe(1);
  });

  it('summarises a call without any sample-data or mentor-review fields', async () => {
    const c = app.client();
    await newSession(c);
    const summary = (await c.get('/api/sessions')).body.sessions[0];
    expect(summary).toMatchObject({ status: 'active', traineeTurns: 0, overallScore: null });
    expect(summary).not.toHaveProperty('isSample');
    expect(summary).not.toHaveProperty('mentorReviewed');
  });

  it('no longer serves the removed progress, rewards, calibration, mentor and demo endpoints', async () => {
    const { client, session } = await newSession();
    for (const path of ['/api/progress', '/api/rewards', '/api/calibration', '/api/demo']) {
      expect((await client.get(path)).status, path).toBe(404);
    }
    expect((await client.post('/api/demo/samples')).status).toBe(404);
    expect((await client.post(`/api/sessions/${session.id}/mentor-score`, {})).status).toBe(404);
  });
});

describe('diagnostics endpoints', () => {
  it('hides test and diagnostic endpoints unless enabled', async () => {
    const plain = await createTestApp({ testHooks: false, devDiagnostics: false });
    try {
      const c = plain.client();
      expect((await c.post('/api/test/fail-next', { target: 'customer' })).status).toBe(404);
      expect((await c.get('/api/dev/sessions/abc/runtime')).status).toBe(404);
    } finally {
      await plain.close();
    }
  });
});
