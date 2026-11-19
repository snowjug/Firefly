import type { EffectiveScenario } from '#shared/domain/config.ts';
import { difficultyProfile } from '#shared/domain/state.ts';
import { START_TEMPERATURE_LABELS } from '#shared/domain/vocab.ts';
import { OPENERS, OPENERS_SIMPLE, TANGENTS, toneOf } from './mock/phrasebank.ts';
import { pick, type Rng } from './rng.ts';
import { dropRedundantSentences, expandContractions, joinSentences } from './textutil.ts';

// The customer's first message. It is composed deterministically (from the scenario's neutral
// problem statement plus the configured temperature, style, call stage and impact) in both demo and
// live mode, so a call can always start, and the opening can never leak a hidden fact.

const VAGUE_LEADS = [
  "It's a bit hard to explain.",
  "I'm not sure how to put this.",
  "It's all a bit confusing, really.",
];
const DEMANDING_TAILS = [
  'I need this sorted.',
  'What can you do about it?',
  'I need someone to take this on.',
];

export function composeOpening(scenario: EffectiveScenario, rng: Rng): string {
  const cfg = scenario.config;
  const profile = difficultyProfile(cfg.difficulty);
  const tone = toneOf(
    START_TEMPERATURE_LABELS[cfg.startingTemperature].startValue,
    cfg.startingTemperature,
  );
  const simple = cfg.style === 'non-native';
  const parts: string[] = [];

  if (cfg.style !== 'terse') parts.push(pick(rng, (simple ? OPENERS_SIMPLE : OPENERS)[tone]));
  else if (tone === 'hot' || tone === 'firm') parts.push('Right.');

  if (scenario.stageFrame.opening) parts.push(scenario.stageFrame.opening);
  if (cfg.style === 'vague') parts.push(pick(rng, VAGUE_LEADS));

  parts.push(scenario.openingCore);
  parts.push(scenario.impactVariant.summary);

  const assumption = scenario.incorrectAssumptions[0];
  if (assumption && cfg.proficiency === 'expert') parts.push(assumption.statement);

  if (profile.hintsEnabled) {
    const hinted = scenario.hiddenFacts.find((f) => f.hint);
    if (hinted?.hint) parts.push(hinted.hint);
  }

  if (cfg.style === 'demanding') parts.push(pick(rng, DEMANDING_TAILS));
  if (cfg.style === 'talkative') parts.push(pick(rng, TANGENTS[tone]));

  const text = joinSentences(dropRedundantSentences(parts));
  return simple ? expandContractions(text) : text;
}
