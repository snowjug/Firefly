import { describe, expect, it } from 'vitest';
import { FIXTURE_ID, makeDefinition } from '../engine/testing.ts';
import { mergeModelDraft } from '../evaluator/merge.ts';
import { EVALUATOR_NAME, EVALUATOR_VERSION, evaluateWithRules } from '../evaluator/rules.ts';
import { createFailureHooks } from '../hooks.ts';
import { silentLogger } from '../log.ts';
import { createMockProvider } from '../providers/mock.ts';
import { SessionService } from '../services/sessions.ts';
import { openDatabase } from './database.ts';
import { createRepository } from './repository.ts';

describe('reading a call stored before the customer had a memory', () => {
  it('fills in what the engine needs, and leaves what was stored as it was', () => {
    const db = openDatabase(':memory:');
    const repo = createRepository(db);
    const service = new SessionService({
      db,
      repo,
      provider: createMockProvider({ delayMs: 0 }),
      library: [makeDefinition()],
      evaluators: {
        rules: { name: EVALUATOR_NAME, version: EVALUATOR_VERSION, evaluate: evaluateWithRules },
        mergeModelDraft,
      },
      log: silentLogger,
      hooks: createFailureHooks(true),
    });
    const call = service.createSession('profile-0001', { scenarioId: FIXTURE_ID });
    const stored = repo.getSession(call.id, 'profile-0001');
    if (!stored) throw new Error('no call');

    // What an older release saved: the same runtime without the fields added since.
    const {
      opening: _opening,
      greetingTurns: _greetingTurns,
      asked: _asked,
      commitments: _commitments,
      awaitingConfirmation: _awaitingConfirmation,
      stageMet: _stageMet,
      pushes: _pushes,
      assumptionsCorrected: _assumptionsCorrected,
      misunderstandings: _misunderstandings,
      lastToldIds: _lastToldIds,
      ...old
    } = stored.runtime;
    db.prepare('UPDATE sessions SET runtime = ? WHERE id = ?').run(JSON.stringify(old), call.id);

    const read = repo.getSession(call.id, 'profile-0001');
    expect(read?.runtime.opening).toBe('reason-given');
    expect(read?.runtime.commitments).toEqual([]);
    expect(read?.runtime.asked).toEqual([]);
    expect(read?.runtime.stageMet).toEqual([]);
    expect(read?.runtime.customer).toEqual(stored.runtime.customer);
    expect(read?.runtime.traineeTurns).toBe(stored.runtime.traineeTurns);
  });
});
