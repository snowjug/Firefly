import { useEffect, useId, useRef } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import { Toggle } from '../frame/index.ts';
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
  const switchId = `${baseId}-switch`;
  const capId = `${baseId}-cap`;
  const on = curveballsOn(choices);
  const wasOn = useRef(on);

  // Unticking the last curveball can switch the field off and remove the list that had focus.
  useEffect(() => {
    if (wasOn.current && !on && document.activeElement === document.body) {
      document.getElementById(switchId)?.focus();
    }
    wasOn.current = on;
  }, [on, switchId]);

  const label = DIFFICULTY_PROFILES[choices.difficulty].label;
  const available = availableCurveballs(scenario);
  const max = maxCurveballs(choices.difficulty);
  const picks = choices.curveballMode === 'choose' ? choices.curveballs : [];
  const atLimit = picks.length >= max;

  return (
    <div className="cal-curve">
      <Toggle
        id={switchId}
        label="Curveballs"
        hint={curveballSummary(choices)}
        checked={on}
        onChange={(next) => onChange(withCurveballsOn(scenario, choices, next))}
        disabled={disabled}
      />
      {notice ? (
        <p role="status" className="cal-aside">
          {notice}
        </p>
      ) : null}

      {on && available.length > 0 ? (
        <fieldset className="cal-curve__set" disabled={disabled} aria-describedby={capId}>
          <legend className="type-label">Choose which curveballs can happen</legend>
          <p id={capId} role="status" className="cal-curve__cap" data-full={atLimit || undefined}>
            {picks.length === 0
              ? `Optional. Tick up to ${curveballCount(max)}, or leave them all unticked to use what ${label} recommends.`
              : `${picks.length} of ${max} chosen.${
                  atLimit
                    ? ` ${label} allows up to ${curveballCount(max)}. Untick one to choose another.`
                    : ''
                }`}
          </p>
          <ul className="cal-curve__list" role="list">
            {available.map((type) => {
              const chosen = picks.includes(type);
              const blocked = !chosen && atLimit;
              const id = `${baseId}-${type}`;
              return (
                <li key={type}>
                  <label className="cal-check" data-blocked={blocked || undefined}>
                    <input
                      type="checkbox"
                      className="cal-check__input"
                      checked={chosen}
                      aria-disabled={blocked || undefined}
                      aria-labelledby={`${id}-title`}
                      aria-describedby={blocked ? `${id}-desc ${capId}` : `${id}-desc`}
                      onChange={() => {
                        if (!blocked) onChange(withCurveballPick(scenario, choices, type, !chosen));
                      }}
                    />
                    <span className="cal-check__mark" aria-hidden="true" />
                    <span className="cal-check__text">
                      <span id={`${id}-title`} className="cal-check__title">
                        {CURVEBALL_LABELS[type].label}
                      </span>
                      <span id={`${id}-desc`} className="cal-check__desc">
                        {CURVEBALL_LABELS[type].description}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}
    </div>
  );
}
