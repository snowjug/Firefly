import { useId } from 'react';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CURVEBALL_LABELS,
  CURVEBALL_TYPES,
  type CurveballType,
  type Difficulty,
} from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { ChoiceGroup, type ChoiceOption } from './ChoiceGroup.tsx';
import {
  curveballCount,
  maxCurveballs,
  recommendedCurveballText,
  type CurveballMode,
} from './setup-model.ts';

interface CurveballPickerProps {
  difficulty: Difficulty;
  mode: CurveballMode;
  picks: readonly CurveballType[];
  offered: readonly CurveballType[];
  /** Said when a difficulty change removed choices that no longer fit. */
  notice: string;
  onModeChange(mode: CurveballMode): void;
  onToggle(type: CurveballType): void;
}

/**
 * Curveballs are optional. The trainee can leave them to the difficulty, switch them off, or pick
 * a few, up to what the difficulty allows. Nothing here says when or how one will happen.
 */
export function CurveballPicker({
  difficulty,
  mode,
  picks,
  offered,
  notice,
  onModeChange,
  onToggle,
}: CurveballPickerProps) {
  const baseId = useId();
  const profile = DIFFICULTY_PROFILES[difficulty];
  const max = maxCurveballs(difficulty);
  const atLimit = picks.length >= max;
  const capId = `${baseId}-cap`;
  const available = CURVEBALL_TYPES.filter((type) => offered.includes(type));
  const options: ChoiceOption<CurveballMode>[] = [
    {
      value: 'recommended',
      label: `Recommended for ${profile.label}`,
      description: recommendedCurveballText(difficulty),
      tag: 'Default',
    },
    { value: 'none', label: 'None', description: 'No curveballs on this call.' },
  ];
  if (available.length > 0) {
    options.push({
      value: 'choose',
      label: 'Choose',
      description: `Pick up to ${curveballCount(max)} yourself. You will not be told when one may happen.`,
    });
  }

  return (
    <div className="stp-stack">
      {notice ? (
        <p role="status" className="callout callout-caution">
          <Icon name="info" size={18} />
          <span>{notice}</span>
        </p>
      ) : null}

      <ChoiceGroup
        name="stp-curveball-mode"
        legend="Curveballs"
        hideLegend
        value={mode}
        options={options}
        onChange={onModeChange}
      />

      {mode === 'choose' ? (
        <fieldset className="stp-choices">
          <legend className="stp-legend">Choose your curveballs</legend>
          <p id={capId} role="status" className="stp-hint stp-cap" data-full={atLimit || undefined}>
            {picks.length} of {max} chosen.
            {atLimit
              ? ` ${profile.label} allows up to ${curveballCount(max)}. Remove one to choose another.`
              : ''}
          </p>
          <div className="stp-choice-grid" data-columns={2}>
            {available.map((type) => {
              const chosen = picks.includes(type);
              const blocked = !chosen && atLimit;
              const id = `${baseId}-${type}`;
              return (
                <label key={type} className="option stp-choice" data-blocked={blocked || undefined}>
                  <input
                    type="checkbox"
                    checked={chosen}
                    aria-disabled={blocked || undefined}
                    aria-labelledby={`${id}-title`}
                    aria-describedby={blocked ? `${id}-desc ${capId}` : `${id}-desc`}
                    onChange={() => {
                      if (!blocked) onToggle(type);
                    }}
                  />
                  <span className="option-check" aria-hidden="true">
                    {chosen ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="stp-choice-body">
                    <span className="stp-choice-head">
                      <span id={`${id}-title`} className="option-title">
                        {CURVEBALL_LABELS[type].label}
                      </span>
                    </span>
                    <span id={`${id}-desc`} className="stp-choice-desc">
                      {CURVEBALL_LABELS[type].description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
