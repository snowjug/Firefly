import { describe, expect, it } from 'vitest';
import { createInitialRuntime } from './session.ts';
import { normaliseRuntime } from './runtime.ts';
import { makeScenario } from './testing.ts';
import type { EngineRuntime } from './types.ts';

describe('a call saved before the customer had a memory', () => {
  const fresh = createInitialRuntime(makeScenario({ startingTemperature: 'calm' }));
  // What an older release stored: none of the fields that were added afterwards.
  const old = {
    ...fresh,
    opening: undefined,
    greetingTurns: undefined,
    asked: undefined,
    commitments: undefined,
    awaitingConfirmation: undefined,
    stageMet: undefined,
    pushes: undefined,
    assumptionsCorrected: undefined,
    misunderstandings: undefined,
    lastToldIds: undefined,
  } as unknown as EngineRuntime;

  it('continues as a call that is under way, with nothing remembered that was never kept', () => {
    const runtime = normaliseRuntime(old);
    expect(runtime.opening).toBe('reason-given');
    expect(runtime.greetingTurns).toBe(0);
    expect(runtime.asked).toEqual([]);
    expect(runtime.commitments).toEqual([]);
    expect(runtime.awaitingConfirmation).toBe(false);
    expect(runtime.stageMet).toEqual([]);
    expect(runtime.pushes).toEqual({});
    expect(runtime.assumptionsCorrected).toEqual([]);
    expect(runtime.misunderstandings).toEqual([]);
    expect(runtime.lastToldIds).toEqual([]);
    // What the old call did record is untouched.
    expect(runtime.customer).toEqual(fresh.customer);
    expect(runtime.toldKnownFacts).toEqual(fresh.toldKnownFacts);
  });

  it('returns a runtime that already has the fields as it is', () => {
    const current = { ...fresh, opening: 'awaiting-engineer' as const, greetingTurns: 1 };
    expect(normaliseRuntime(current)).toEqual(current);
  });
});
