import type { EffectiveScenario } from '#shared/domain/config.ts';
import { startingState, type StateEvent } from '#shared/domain/state.ts';
import { temperatureBand, type TemperatureBandId } from '#shared/domain/vocab.ts';
import { netMoves } from '../evaluator/mood.ts';
import type { Speaker } from './voices.ts';

// What a customer's voice depends on, read from the stored call.

/**
 * The customer's temperature when this turn was said: the starting temperature, then every change
 * caused by the trainee turns before it. A customer turn replies to the trainee turn before it, and
 * the engine records every temperature change, so this is exact.
 */
export function temperatureAtTurn(
  scenario: EffectiveScenario,
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
  scenario: EffectiveScenario,
  events: StateEvent[],
  turnIndex: number,
): TemperatureBandId {
  return temperatureBand(temperatureAtTurn(scenario, events, turnIndex)).id;
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
