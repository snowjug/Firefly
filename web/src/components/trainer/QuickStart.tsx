import { useId, useState } from 'react';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DIFFICULTIES, type Difficulty } from '#shared/domain/vocab.ts';
import type { AsyncState } from '../../lib/hooks.ts';
import {
  ChoiceRow,
  Field,
  Icon,
  LoadingNotice,
  SelectInput,
  SignalGlyph,
  type ChoiceOption,
} from './bridge.tsx';
import { StudioError, StudioNote, StudioSection } from './StudioFrame.tsx';
import { scenarioTraits } from './trainer-model.ts';
import { useStartCall } from './useStartCall.ts';

/** Start any scenario at a chosen difficulty: pick, choose, then open its setup page. */
export function QuickStart({
  scenarios,
  defaultScenarioId,
}: {
  scenarios: AsyncState<PublicScenarioDTO[]>;
  defaultScenarioId: string | null;
}) {
  const previewId = useId();
  const choiceName = useId();
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

  let body;
  if (scenarios.error && !scenarios.data) {
    body = (
      <StudioError
        error={scenarios.error}
        onRetry={scenarios.reload}
        title="Could not load the scenarios"
      />
    );
  } else if (!selected) {
    body = scenarios.loading ? (
      <LoadingNotice label="Loading scenarios" lines={3} />
    ) : (
      <StudioNote title="No scenarios are available." />
    );
  } else {
    const options: ChoiceOption[] = DIFFICULTIES.map((value) => ({
      value,
      label: DIFFICULTY_PROFILES[value].label,
      hint: `${DIFFICULTY_PROFILES[value].summary} This scenario\u2019s default is ${DIFFICULTY_PROFILES[selected.difficulty].label}.`,
    }));
    body = (
      <div className="tr-quick">
        <Field label="Scenario">
          <SelectInput
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
          </SelectInput>
        </Field>

        <ChoiceRow
          legend="Difficulty"
          name={choiceName}
          value={difficulty}
          options={options}
          size="display"
          onChange={(next) => setChosenDifficulty(next as Difficulty)}
        />

        <div id={previewId} className="tr-preview">
          <div className="tr-preview__figure" aria-hidden="true">
            <SignalGlyph traits={scenarioTraits(selected, difficulty)} size={72} />
          </div>
          <div className="tr-preview__text">
            <p className="tr-preview__title">{selected.title}</p>
            <p className="tr-preview__who">
              {selected.persona.name}, {selected.persona.role} at {selected.persona.organisation}
            </p>
            <p className="tr-preview__summary">{selected.summary}</p>
            <p className="tr-preview__meta type-label">About {selected.estimatedMinutes} minutes</p>
          </div>
        </div>

        <div className="action-row">
          <button
            type="button"
            className="action action--quiet"
            onClick={() => start(selected.id, { difficulty })}
          >
            Start at {profile.label} difficulty <Icon name="arrow-right" size={18} />
          </button>
        </div>
        {error ? (
          <p role="alert" className="tr-problem">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <StudioSection
      title="Quick start"
      about="Pick a scenario and a difficulty, then open its setup page, where you can change anything before the call starts."
    >
      {body}
    </StudioSection>
  );
}
