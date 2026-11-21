import { startingState } from '#shared/domain/state.ts';
import type { CallConfig } from './config-params.ts';
import { START_STATE, moodLabel, type StartState } from './labels.ts';

// What the customer is like when the call begins, for the preview next to the scenario. It is read
// off the engine's own starting state (`startingState`, the function the server starts a call
// with), so the preview moves with the difficulty, the starting mood and the call stage exactly as
// the real call does. It shows levels in words, never the numbers behind them, and nothing about
// what the customer keeps back.

export type Level = 'low' | 'medium' | 'high';

export interface CustomerPreview {
  /** The drawn mood, and its word ("Anxious" is drawn as the amber "concerned" state). */
  state: StartState;
  mood: string;
  patience: Level;
  trust: Level;
}

function levelOf(value: number, high: number, medium: number): Level {
  return value >= high ? 'high' : value >= medium ? 'medium' : 'low';
}

export function customerPreview(
  config: Pick<CallConfig, 'difficulty' | 'impact' | 'stage' | 'temperature'>,
): CustomerPreview {
  const start = startingState({
    startingTemperature: config.temperature,
    difficulty: config.difficulty,
    callStage: config.stage,
    impact: config.impact,
  });
  return {
    state: START_STATE[config.temperature],
    mood: moodLabel(config.temperature),
    patience: levelOf(start.patience, 65, 45),
    trust: levelOf(start.trust, 60, 40),
  };
}

export const LEVEL_LABELS: Record<Level, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** 1 to 3 filled segments for a level, for the small meters. */
export const LEVEL_STEPS: Record<Level, number> = { low: 1, medium: 2, high: 3 };
