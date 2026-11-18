import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import {
  CALL_STAGE_LABELS,
  IMPACT_LABELS,
  PROFICIENCY_LABELS,
  START_TEMPERATURE_LABELS,
  STYLE_LABELS,
} from '#shared/domain/vocab.ts';
import { TemperatureOrb } from '../TemperatureOrb.tsx';
import { temperatureBandFor } from './setup-model.ts';

/** The scenario's starting settings as plain-language chips. The temperature is always written out. */
export function ScenarioChips({
  scenario,
  withProficiency = false,
  label = 'Scenario settings',
  className = '',
}: {
  scenario: PublicScenarioDTO;
  withProficiency?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <ul role="list" className={`cluster scn-chips ${className}`} aria-label={label}>
      <li className="chip scn-chip">{IMPACT_LABELS[scenario.impact].label} impact</li>
      <li className="chip scn-chip">
        <TemperatureOrb band={temperatureBandFor(scenario.startingTemperature)} />
        Starts {START_TEMPERATURE_LABELS[scenario.startingTemperature].label.toLowerCase()}
      </li>
      <li className="chip scn-chip">{STYLE_LABELS[scenario.style].label}</li>
      {withProficiency ? (
        <li className="chip scn-chip">
          Technical: {PROFICIENCY_LABELS[scenario.proficiency].label.toLowerCase()}
        </li>
      ) : null}
      <li className="chip scn-chip">{CALL_STAGE_LABELS[scenario.callStage].label}</li>
    </ul>
  );
}
