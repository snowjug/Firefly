import { temperatureBand, type StartTemperature } from '#shared/domain/vocab.ts';

// How heated the customer sounds right now, from their current temperature. The same situation
// sounds different when the customer is calm, worried, firm or heated. Customers are never rude or
// abusive: heated means blunt and upset.

export type Tone = 'calm' | 'worried' | 'firm' | 'hot';

export function toneOf(temperature: number, starting: StartTemperature): Tone {
  const band = temperatureBand(temperature).id;
  if (band === 'calm') return 'calm';
  if (band === 'concerned') return starting === 'anxious' ? 'worried' : 'calm';
  if (band === 'frustrated') return 'firm';
  return 'hot';
}
