import type { CallStage } from './contract.ts';
import type { MachineState } from './machine.ts';

// The turn-taking machine in the product brief's words (section 19): IDLE, MIC_PERMISSION, READY,
// LISTENING, ENDPOINTING, TRANSCRIBING, PROCESSING, CUSTOMER_SPEAKING, PAUSED, MUTED, RETRYING,
// OFFLINE, ENDING, EVALUATING and COMPLETED. The machine itself keeps its phases and a few switches
// (muted, paused, finishing, a problem) because those combine freely, and turning each combination
// into a phase of its own would multiply the states without adding a rule. This is the one place
// that says which of the brief's states a machine state is, and the screen reads it from the
// snapshot instead of working it out again. The table is in `CALL_STAGES` (contract.ts).

/** Exactly one stage for every machine state. Pure, and the order of the checks is the priority. */
export function stageOf(state: MachineState): CallStage {
  const { phase } = state;
  if (phase === 'completed') return 'completed';
  if (phase === 'ending') return state.ending === 'draining' ? 'ending' : 'evaluating';
  if (phase === 'idle') return 'idle';
  if (phase === 'requesting-microphone') return 'mic-permission';
  if (state.paused && state.voice) return 'paused';
  if (state.problem?.code === 'offline') return 'offline';
  if (phase === 'listening') return state.finishing ? 'endpointing' : 'listening';
  if (phase === 'transcribing') return 'transcribing';
  if (phase === 'processing')
    return state.exchange && state.exchange.attempt > 1 ? 'retrying' : 'processing';
  if (phase === 'customer-speaking') return 'customer-speaking';
  // `ready` (the opening line is being prepared) and `ready-for-next-turn`: the trainee's turn.
  if (phase === 'ready-for-next-turn') {
    // The microphone is being asked for again, after a failure or on the way back from typing.
    if (state.voice && !state.micHeld && state.microphone === 'prompt') return 'mic-permission';
    if (state.voice && state.muted) return 'muted';
  }
  return 'ready';
}
