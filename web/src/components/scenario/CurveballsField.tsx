import { useEffect, useId, useRef } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { ToggleRow } from './Fields.tsx';
import {
  availableCurveballs,
  curveballCount,
  curveballSummary,
  curveballsOn,
  maxCurveballs,
  withCurveballPick,
  withCurveballsOn,
  type SetupChoices,
} from './setup-model.ts';

interface CurveballsFieldProps {
  scenario: PublicScenarioDTO;
  choices: SetupChoices;
  /** Said when a difficulty change removed choices that no longer fit. */
  notice: string;
  onChange(next: SetupChoices): void;
  disabled?: boolean;
}

/**
 * Curveballs are optional. The switch turns them off, or on at what the difficulty recommends. While
 * it is on, the trainee may tick which ones can happen, up to what the difficulty allows. Nothing
 * here says when or how one will happen.
 */
export function CurveballsField({
  scenario,
  choices,
  notice,
  onChange,
  disabled = false,
}: CurveballsFieldProps) {
  const baseId = useId();
  const capId = `${baseId}-cap`;
  const switchRef = useRef<HTMLInputElement>(null);
  const on = curveballsOn(choices);
  const wasOn = useRef(on);

  // Unticking the last curveball can switch the field off and remove the list that had focus.
  useEffect(() => {
    if (wasOn.current && !on && document.activeElement === document.body) {
      switchRef.current?.focus();
    }
    wasOn.current = on;
  }, [on]);

  const label = DIFFICULTY_PROFILES[choices.difficulty].label;
  const available = availableCurveballs(scenario);
  const max = maxCurveballs(choices.difficulty);
  const picks = choices.curveballMode === 'choose' ? choices.curveballs : [];
  const atLimit = picks.length >= max;

  return (
    <ToggleRow
      title="Curveballs"
      checked={on}
      onChange={(next) => onChange(withCurveballsOn(scenario, choices, next))}
      description={curveballSummary(choices)}
      disabled={disabled}
      switchRef={switchRef}
    >
      {notice ? (
        <p role="status" className="callout callout-caution stp-cv-notice">
          <Icon name="info" size={18} />
          <span>{notice}</span>
        </p>
      ) : null}

      {on && available.length > 0 ? (
        <fieldset className="stp-cv" disabled={disabled} aria-describedby={capId}>
          <legend className="label">Choose which curveballs can happen</legend>
          <p id={capId} role="status" className="hint stp-cv-cap" data-full={atLimit || undefined}>
            {picks.length === 0
              ? `Optional. Tick up to ${curveballCount(max)}, or leave them all unticked to use what ${label} recommends.`
              : `${picks.length} of ${max} chosen.${
                  atLimit
                    ? ` ${label} allows up to ${curveballCount(max)}. Untick one to choose another.`
                    : ''
                }`}
          </p>
          <div className="stp-cv-grid">
            {available.map((type) => {
              const chosen = picks.includes(type);
              const blocked = !chosen && atLimit;
              const id = `${baseId}-${type}`;
              return (
                <label
                  key={type}
                  className="option stp-cv-option"
                  data-blocked={blocked || undefined}
                >
                  <input
                    type="checkbox"
                    checked={chosen}
                    aria-disabled={blocked || undefined}
                    aria-labelledby={`${id}-title`}
                    aria-describedby={blocked ? `${id}-desc ${capId}` : `${id}-desc`}
                    onChange={() => {
                      if (!blocked) onChange(withCurveballPick(scenario, choices, type, !chosen));
                    }}
                  />
                  <span className="option-check" aria-hidden="true">
                    {chosen ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="stp-cv-body">
                    <span id={`${id}-title`} className="option-title">
                      {CURVEBALL_LABELS[type].label}
                    </span>
                    <span id={`${id}-desc`} className="stp-cv-desc">
                      {CURVEBALL_LABELS[type].description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </ToggleRow>
  );
}
