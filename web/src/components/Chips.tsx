import type {
  BusinessImpact,
  CallStage,
  CommunicationStyle,
  Difficulty,
  Proficiency,
  StartTemperature,
} from '#shared/domain/vocab.ts';
import {
  CALL_STAGE_LABELS,
  IMPACT_LABELS,
  PROFICIENCY_LABELS,
  START_TEMPERATURE_LABELS,
  STYLE_LABELS,
} from '#shared/domain/vocab.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';

export const difficultyChipClass: Record<Difficulty, string> = {
  starter: 'chip-positive',
  standard: 'chip-info',
  challenge: 'chip-caution',
};

export function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`chip ${difficultyChipClass[difficulty]}`}>
      {DIFFICULTY_PROFILES[difficulty].label}
    </span>
  );
}

export interface ScenarioSettings {
  difficulty?: Difficulty;
  impact?: BusinessImpact;
  startingTemperature?: StartTemperature;
  proficiency?: Proficiency;
  style?: CommunicationStyle;
  callStage?: CallStage;
}

/** The scenario's settings as a row of plain-language chips. */
export function SettingChips({
  settings,
  only,
}: {
  settings: ScenarioSettings;
  only?: (keyof ScenarioSettings)[];
}) {
  const show = (key: keyof ScenarioSettings) =>
    settings[key] !== undefined && (!only || only.includes(key));
  return (
    <ul role="list" className="cluster" aria-label="Scenario settings">
      {show('difficulty') ? (
        <li>
          <DifficultyChip difficulty={settings.difficulty as Difficulty} />
        </li>
      ) : null}
      {show('impact') ? (
        <li className="chip">{IMPACT_LABELS[settings.impact as BusinessImpact].label} impact</li>
      ) : null}
      {show('startingTemperature') ? (
        <li className="chip">
          {START_TEMPERATURE_LABELS[settings.startingTemperature as StartTemperature].label}
        </li>
      ) : null}
      {show('proficiency') ? (
        <li className="chip">{PROFICIENCY_LABELS[settings.proficiency as Proficiency].label}</li>
      ) : null}
      {show('style') ? (
        <li className="chip">{STYLE_LABELS[settings.style as CommunicationStyle].label}</li>
      ) : null}
      {show('callStage') ? (
        <li className="chip">{CALL_STAGE_LABELS[settings.callStage as CallStage].label}</li>
      ) : null}
    </ul>
  );
}
