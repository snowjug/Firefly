import { useId, useState } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DIFFICULTIES, type Difficulty } from '#shared/domain/vocab.ts';
import type { AsyncState } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';
import { ErrorState, SkeletonBlock } from '../Page.tsx';
import { SegmentedChoice } from './SegmentedChoice.tsx';
import { useStartCall } from './useStartCall.ts';

const DIFFICULTY_OPTIONS = DIFFICULTIES.map((value) => ({
  value,
  label: DIFFICULTY_PROFILES[value].label,
}));

/** Start any scenario at a chosen difficulty: pick, choose, go to the pre-call brief. */
export function QuickStart({
  scenarios,
  defaultScenarioId,
}: {
  scenarios: AsyncState<PublicScenarioDTO[]>;
  defaultScenarioId: string | null;
}) {
  const titleId = useId();
  const selectId = useId();
  const previewId = useId();
  const { start, error } = useStartCall();
  const [chosenId, setChosenId] = useState('');
  const [chosenDifficulty, setChosenDifficulty] = useState<Difficulty | null>(null);

  const list = scenarios.data ?? [];
  const selected =
    list.find((s) => s.id === chosenId) ??
    list.find((s) => s.id === defaultScenarioId) ??
    list[0] ??
    null;
  const difficulty = chosenDifficulty ?? selected?.difficulty ?? 'standard';
  const profile = DIFFICULTY_PROFILES[difficulty];

  return (
    <section className="glass card stack tr-quick" aria-labelledby={titleId}>
      <div>
        <h2 id={titleId} className="t-section">
          Quick start
        </h2>
        <p className="t-small t-muted">
          Pick a scenario and a difficulty, then go straight to the pre-call brief.
        </p>
      </div>

      {scenarios.error && !scenarios.data ? (
        <ErrorState
          error={scenarios.error}
          onRetry={scenarios.reload}
          title="Could not load the scenarios"
        />
      ) : !selected ? (
        scenarios.loading ? (
          <div className="stack" role="status" aria-label="Loading scenarios">
            <SkeletonBlock height={44} />
            <SkeletonBlock height={44} width="60%" />
            <SkeletonBlock height={110} />
          </div>
        ) : (
          <p className="t-muted">No scenarios are available.</p>
        )
      ) : (
        <>
          <div className="field">
            <label className="label" htmlFor={selectId}>
              Scenario
            </label>
            <select
              id={selectId}
              className="select"
              value={selected.id}
              aria-describedby={previewId}
              onChange={(event) => setChosenId(event.target.value)}
            >
              {DIFFICULTIES.map((group) => {
                const members = list.filter((s) => s.difficulty === group);
                return members.length > 0 ? (
                  <optgroup key={group} label={`${DIFFICULTY_PROFILES[group].label} scenarios`}>
                    {members.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </div>

          <SegmentedChoice<Difficulty>
            legend="Difficulty"
            value={difficulty}
            options={DIFFICULTY_OPTIONS}
            onChange={(next) => setChosenDifficulty(next)}
            hint={`${profile.summary} This scenario\u2019s default is ${DIFFICULTY_PROFILES[selected.difficulty].label}.`}
          />

          <div id={previewId} className="tr-preview">
            <h3 className="tr-preview-title">{selected.title}</h3>
            <p className="t-small t-muted">
              {selected.persona.name}, {selected.persona.role} at {selected.persona.organisation}
            </p>
            <p className="t-small">{selected.summary}</p>
            <p className="t-meta tr-preview-meta">
              <Icon name="clock" size={14} /> About {selected.estimatedMinutes} minutes
            </p>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => start(selected.id, { difficulty })}
            >
              Start at {profile.label} difficulty <Icon name="arrow-right" size={18} />
            </button>
          </div>
          {error ? (
            <p role="alert" className="field-error">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
