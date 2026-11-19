import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RewardsDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import { defaultEvaluators } from '../bootstrap.ts';
import { createTestApp, type TestApp, type TestClient } from '../http/harness.ts';
import { PROFILE_COOKIE } from '../http/security.ts';
import { SAMPLE_SCRIPTS } from './sample-scripts.ts';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});

const SCENARIO = 'locked-out-after-password-reset';
const QUESTIONS = [
  'What is happening?',
  'When did it start?',
  'Who is affected?',
  'What changed recently?',
  'What have you tried so far?',
  'What does the screen say?',
];

/** Starts a call, sends the lines, ends it and waits for the report. */
async function takeCall(client: TestClient, lines: string[] = QUESTIONS): Promise<string> {
  const created = await client.post('/api/sessions', { scenarioId: SCENARIO });
  expect(created.status).toBe(201);
  const id = created.body.session.id as string;
  for (const text of lines) {
    const sent = await client.post(`/api/sessions/${id}/messages`, {
      text,
      clientMessageId: randomUUID(),
    });
    expect(sent.status).toBe(200);
  }
  expect((await client.post(`/api/sessions/${id}/end`, {})).status).toBe(200);
  await app.service.settle(id);
  return id;
}

async function rewardsOf(client: TestClient, query = ''): Promise<RewardsDTO> {
  const res = await client.get(`/api/rewards${query}`);
  expect(res.status).toBe(200);
  return res.body as RewardsDTO;
}

const ofRule = (r: RewardsDTO, ruleId: string) => r.ledger.filter((e) => e.ruleId === ruleId);

describe('GET /api/rewards', () => {
  it('returns a complete, empty set of rewards for a profile that has not practised', async () => {
    const res = await app.client().get('/api/rewards');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const r = res.body as RewardsDTO;
    expect(Object.keys(r).sort()).toEqual([
      'badges',
      'challenges',
      'families',
      'ledger',
      'level',
      'levels',
      'nextLevel',
      'note',
      'points',
      'rules',
      'streak',
    ]);
    expect(r.points).toBe(0);
    expect(r.level).toMatchObject({ id: 'foundation', index: 1 });
    expect(r.nextLevel).toMatchObject({ id: 'builder', pointsToGo: 150, familiesToGo: 2 });
    expect(r.families).toEqual({ practised: [], total: 7 });
    expect(r.streak).toEqual({ current: 0, best: 0, activeDays: 0, practisedToday: false });
    expect(r.ledger).toEqual([]);
    expect(r.rules).toHaveLength(7);
    expect(r.badges.map((b) => b.id)).toEqual([
      'first-practice',
      'scope-detective',
      'de-escalator',
      'ownership-builder',
      'scenario-explorer',
      'consistency-streak',
    ]);
    expect(r.badges.some((b) => b.earned)).toBe(false);
    expect(r.challenges.map((c) => c.id)).toEqual([
      'try-new-family',
      'find-every-fact',
      'practise-again',
    ]);
    expect(r.challenges[0]?.scenarioId).toBe(SCENARIO);
    expect(r.note).toMatch(/private to this browser profile/i);
  });

  it('pays for a full call and says exactly why', async () => {
    const client = app.client();
    const id = await takeCall(client);
    const r = await rewardsOf(client);

    const call = ofRule(r, 'complete-scenario');
    expect(call).toHaveLength(1);
    expect(call[0]).toMatchObject({
      id: `complete-scenario:${id}`,
      points: 50,
      sessionId: id,
      title: 'Completed a full scenario',
    });
    expect(call[0]?.scenarioTitle).toBeTruthy();
    expect(ofRule(r, 'new-scenario-family')).toMatchObject([
      { id: 'new-scenario-family:sign-in-access', points: 20, sessionId: id },
    ]);
    const days = ofRule(r, 'practice-day');
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ points: 5, sessionId: null, scenarioTitle: null });

    expect(r.points).toBeGreaterThanOrEqual(75);
    expect(r.points).toBe(r.ledger.reduce((sum, e) => sum + e.points, 0));
    expect(new Set(r.ledger.map((e) => e.id)).size).toBe(r.ledger.length);
    for (const entry of r.ledger) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(0);
    }
    expect(r.families.practised).toEqual(['sign-in-access']);
    expect(r.badges.find((b) => b.id === 'first-practice')).toMatchObject({
      earned: true,
      earnedInSessionId: id,
      progress: { current: 1, target: 1 },
    });
    expect(r.streak).toMatchObject({ activeDays: 1, best: 1 });
  });

  it('earns nothing for a call that ended early', async () => {
    const client = app.client();
    const id = await takeCall(client, QUESTIONS.slice(0, 2));
    const saved = await client.get(`/api/sessions/${id}`);
    expect(saved.body.session.completion).toBe('ended-early');
    const r = await rewardsOf(client);
    expect(r.points).toBe(0);
    expect(r.ledger).toEqual([]);
    expect(r.families.practised).toEqual([]);
    expect(r.badges.some((b) => b.earned)).toBe(false);
    expect(r.streak.activeDays).toBe(0);
  });

  it('pays once, and never again, however often evaluation is retried or the call is ended', async () => {
    const client = app.client();
    const created = await client.post('/api/sessions', { scenarioId: SCENARIO });
    const id = created.body.session.id as string;
    for (const text of QUESTIONS) {
      await client.post(`/api/sessions/${id}/messages`, { text, clientMessageId: randomUUID() });
    }
    await app.client().post('/api/test/fail-next', { target: 'evaluator', count: 1 });
    await client.post(`/api/sessions/${id}/end`, {});
    await app.service.settle(id);
    expect((await client.get(`/api/sessions/${id}`)).body.session.status).toBe('evaluation_failed');
    // No report yet, so nothing has been earned.
    expect((await rewardsOf(client)).points).toBe(0);

    await client.post(`/api/sessions/${id}/evaluate`, {});
    await app.service.settle(id);
    const earned = await rewardsOf(client);
    expect(earned.points).toBeGreaterThanOrEqual(75);

    for (let i = 0; i < 3; i += 1) {
      await client.post(`/api/sessions/${id}/evaluate`, {});
      await client.post(`/api/sessions/${id}/end`, {});
      await app.service.settle(id);
      expect(await rewardsOf(client)).toEqual(earned);
    }
    expect(ofRule(earned, 'complete-scenario')).toHaveLength(1);
  });

  it('pays less for repeats of the same scenario, and one practice day however many calls', async () => {
    const client = app.client();
    const ids = [await takeCall(client), await takeCall(client), await takeCall(client)];
    const r = await rewardsOf(client);
    const byId = Object.fromEntries(ofRule(r, 'complete-scenario').map((e) => [e.sessionId, e]));
    const ordered = ids.map((id) => byId[id]?.points);
    expect(ordered.sort()).toEqual([10, 50, 50]);

    const sessions = (await client.get('/api/sessions')).body.sessions as { endedAt: string }[];
    const utcDays = new Set(sessions.map((s) => s.endedAt.slice(0, 10)));
    expect(ofRule(r, 'practice-day')).toHaveLength(utcDays.size);
    expect(ofRule(r, 'new-scenario-family')).toHaveLength(1);
  });

  it('keeps each browser profile private', async () => {
    const mine = app.client();
    const theirs = app.client();
    await takeCall(mine);
    const before = await rewardsOf(mine);
    expect(before.points).toBeGreaterThan(0);

    const stranger = await rewardsOf(theirs);
    expect(stranger.points).toBe(0);
    expect(stranger.ledger).toEqual([]);

    await takeCall(theirs);
    expect(await rewardsOf(mine)).toEqual(before);
  });

  it('takes back exactly what a deleted call earned', async () => {
    const client = app.client();
    const id = await takeCall(client);
    expect((await rewardsOf(client)).points).toBeGreaterThan(0);
    expect((await client.del(`/api/sessions/${id}`)).body.deleted).toBe(true);
    const after = await rewardsOf(client);
    expect(after.points).toBe(0);
    expect(after.ledger).toEqual([]);
    expect(after.badges.some((b) => b.earned)).toBe(false);
  });

  it('never counts the labelled sample sessions or their sample reviews', async () => {
    const client = app.client();
    const loaded = await client.post('/api/demo/samples');
    expect(loaded.body.created).toBeGreaterThan(0);
    const sessions = await client.get('/api/sessions');
    expect(sessions.body.sessions.some((s: { isSample: boolean }) => s.isSample)).toBe(true);
    const r = await rewardsOf(client);
    expect(r.points).toBe(0);
    expect(r.ledger).toEqual([]);
    expect(r.families.practised).toEqual([]);
  });

  it('pays for a mentor review that confirms the rubric result, but never for a sample review', async () => {
    const profile = 'c'.repeat(32);
    const session = app.service.createSession(profile, { scenarioId: SCENARIO });
    for (const text of QUESTIONS) {
      await app.service.sendMessage(profile, session.id, { text, clientMessageId: randomUUID() });
    }
    await app.service.endSession(profile, session.id);
    await app.service.settle(session.id);

    const read = async (): Promise<RewardsDTO> => {
      const res = await app.client().raw('/api/rewards', {
        headers: { cookie: `${PROFILE_COOKIE}=${profile}` },
      });
      expect(res.status).toBe(200);
      return (await res.json()) as RewardsDTO;
    };
    const scores = (changes: Partial<Record<DimensionId, number>> = {}) =>
      ({
        ...Object.fromEntries(DIMENSION_IDS.map((d) => [d, 3])),
        ...changes,
      }) as Record<DimensionId, number>;

    const base = (await read()).points;
    expect(base).toBeGreaterThanOrEqual(75);

    app.insights.mentorScore(
      profile,
      session.id,
      { reviewer: 'Sample', scores: scores() },
      'sample',
    );
    expect((await read()).points).toBe(base);

    // Two points apart on one skill is a disagreement, so it confirms nothing.
    app.insights.mentorScore(profile, session.id, {
      reviewer: 'Alex',
      scores: scores({ closing: 5 }),
    });
    expect((await read()).points).toBe(base);

    // The same mentor revises the review to within a point everywhere.
    app.insights.mentorScore(profile, session.id, {
      reviewer: 'Alex',
      scores: scores({ closing: 4, clarity: 2 }),
    });
    const confirmed = await read();
    expect(confirmed.points).toBe(base + 25);
    expect(ofRule(confirmed, 'mentor-confirmed')).toMatchObject([
      { id: `mentor-confirmed:${session.id}`, points: 25, sessionId: session.id },
    ]);
  });

  it('works out the practice day in the learner-local time zone', async () => {
    const client = app.client();
    const id = await takeCall(client);
    const endedAt = (await client.get(`/api/sessions/${id}`)).body.session.endedAt as string;
    const dayId = async (tz: number) =>
      ofRule(await rewardsOf(client, `?tzOffset=${tz}`), 'practice-day').map((e) => e.id);
    expect(await dayId(0)).toEqual([`practice-day:${endedAt.slice(0, 10)}`]);
    // 28 hours apart, so these can never fall on the same calendar day.
    const ahead = await dayId(-840);
    const behind = await dayId(840);
    expect(ahead).toHaveLength(1);
    expect(behind).toHaveLength(1);
    expect(ahead).not.toEqual(behind);
    expect(await dayId(-330)).toHaveLength(1);
  });

  it('accepts a whole number of minutes from -840 to 840, and nothing else', async () => {
    const client = app.client();
    for (const ok of ['0', '-330', '330', '840', '-840', '-0']) {
      expect((await client.get(`/api/rewards?tzOffset=${ok}`)).status).toBe(200);
    }
    for (const bad of ['abc', '1.5', '', '841', '-841', '1e2', '0x10', '5000', '%2B60', '--5']) {
      const res = await client.get(`/api/rewards?tzOffset=${bad}`);
      expect(res.status, `tzOffset=${bad}`).toBe(400);
      expect(res.body.error.code).toBe('validation_failed');
    }
    expect((await client.post('/api/rewards', {})).status).toBe(405);
  });
});

describe('rewards from a real coaching report', () => {
  it('pays for the facts and the ownership the evaluator found, and every quote is in the transcript', async () => {
    const real = await createTestApp({ evaluators: defaultEvaluators });
    try {
      const script = SAMPLE_SCRIPTS.find((s) => s.key === 'sample-strong-lockout');
      expect(script).toBeDefined();
      const client = real.client();
      const created = await client.post('/api/sessions', {
        scenarioId: script?.scenarioId,
        overrides: script?.overrides,
      });
      const id = created.body.session.id as string;
      for (const text of script?.lines ?? []) {
        const sent = await client.post(`/api/sessions/${id}/messages`, {
          text,
          clientMessageId: randomUUID(),
        });
        expect(sent.status).toBe(200);
      }
      await client.post(`/api/sessions/${id}/end`, {});
      await real.service.settle(id);

      const r = (await client.get('/api/rewards')).body as RewardsDTO;
      const facts = ofRule(r, 'hidden-fact');
      expect(facts.length).toBeGreaterThan(0);
      expect(ofRule(r, 'owner-and-update')).toHaveLength(1);
      expect(r.points).toBe(r.ledger.reduce((sum, e) => sum + e.points, 0));

      const turns = (await client.get(`/api/sessions/${id}/transcript`)).body.transcript.turns as {
        index: number;
        role: string;
        text: string;
      }[];
      for (const entry of [...facts, ...ofRule(r, 'owner-and-update')]) {
        expect(entry.evidence?.quote, entry.title).toBeTruthy();
        const turn = turns.find((t) => t.index === entry.evidence?.turnIndex);
        expect(turn?.role, entry.title).toBe('trainee');
        expect(turn?.text, entry.title).toContain(entry.evidence?.quote);
      }
    } finally {
      await real.close();
    }
  });
});
