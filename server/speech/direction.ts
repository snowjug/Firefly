import type { EffectiveScenario } from '#shared/domain/config.ts';
import { startingState, type StateEvent } from '#shared/domain/state.ts';
import { temperatureBand, type TemperatureBandId } from '#shared/domain/vocab.ts';
import { netMoves } from '../evaluator/mood.ts';
import type { Speaker } from './voices.ts';

// What a customer's voice depends on, read from the stored call.

/** The part of a scenario a voice depends on: only how the call started. */
export interface DirectedScenario {
  config: Pick<
    EffectiveScenario['config'],
    'startingTemperature' | 'difficulty' | 'callStage' | 'impact'
  >;
}

/**
 * The customer's temperature when this turn was said: the starting temperature, then every change
 * caused by the trainee turns before it. A customer turn replies to the trainee turn before it, and
 * the engine records every temperature change, so this is exact.
 */
export function temperatureAtTurn(
  scenario: DirectedScenario,
  events: StateEvent[],
  turnIndex: number,
): number {
  const cfg = scenario.config;
  const start = startingState({
    startingTemperature: cfg.startingTemperature,
    difficulty: cfg.difficulty,
    callStage: cfg.callStage,
    impact: cfg.impact,
  }).temperature;
  const earlier = events.filter((e) => e.turnIndex < turnIndex);
  return netMoves(earlier).find((move) => move.key === 'temperature')?.to ?? start;
}

/** The temperature band (calm to escalating) of the customer when this turn was said. */
export function moodAtTurn(
  scenario: DirectedScenario,
  events: StateEvent[],
  turnIndex: number,
): TemperatureBandId {
  return temperatureBand(temperatureAtTurn(scenario, events, turnIndex)).id;
}

/** How far the temperature must have fallen, over the last few exchanges, to count as cooling down. */
export const RECOVERY_DROP = 8;
/** How many of the trainee's recent turns that changed the temperature are looked at. */
const RECOVERY_WINDOW = 3;

/**
 * Whether the customer is cooling down when this turn is said: their temperature fell with the
 * latest change, and is at least `RECOVERY_DROP` below where it stood before the last few. A
 * customer who has only been getting hotter, or who has hardly moved, is not recovering. The voice
 * then goes a little slower and calmer, gradually, as the temperature comes down.
 */
export function recoveringAtTurn(
  scenario: DirectedScenario,
  events: StateEvent[],
  turnIndex: number,
): boolean {
  const changedAt = [
    ...new Set(
      events
        .filter((e) => e.key === 'temperature' && e.turnIndex < turnIndex)
        .map((e) => e.turnIndex),
    ),
  ]
    .sort((a, b) => b - a)
    .slice(0, RECOVERY_WINDOW);
  const latest = changedAt[0];
  if (latest === undefined) return false;
  const now = temperatureAtTurn(scenario, events, turnIndex);
  const before = changedAt.map((turn) => temperatureAtTurn(scenario, events, turn));
  const justBefore = before[0] as number;
  return now < justBefore && Math.max(...before) - now >= RECOVERY_DROP;
}

/**
 * Which voice speaks for a customer. A call stored before personas named a speaker gets one derived
 * from the persona's name, so the same customer always keeps the same voice for the whole call.
 */
export function speakerFor(persona: { name: string; speaker?: Speaker | undefined }): Speaker {
  if (persona.speaker) return persona.speaker;
  let hash = 2166136261;
  for (const char of persona.name.trim().toLowerCase()) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
  }
  return (hash >>> 16) % 2 === 0 ? 'female' : 'male';
}
