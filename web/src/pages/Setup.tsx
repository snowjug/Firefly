import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useViewTransitionState } from 'react-router';
import type { ProgressDTO, PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { recommendMission } from '#shared/domain/recommend.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  IMPACTS,
  IMPACT_LABELS,
  ISSUE_TYPE_LABELS,
  PRACTICE_MODE_LABELS,
  PROFICIENCIES,
  PROFICIENCY_LABELS,
  START_TEMPERATURES,
  START_TEMPERATURE_LABELS,
  STYLES,
  STYLE_LABELS,
  type CurveballType,
  type IssueType,
  type PracticeMode,
} from '#shared/domain/vocab.ts';
import {
  OPTION_EXPLANATIONS,
  PRESETS,
  coreParams,
  explainChange,
} from '../components/atlas/core-params.ts';
import { worldPoseFor } from '../components/atlas/world-pose.ts';
import { ConnectingView } from '../components/call/ConnectingView.tsx';
import {
  ChoiceRow,
  EmptyNotice,
  ErrorNotice,
  Field,
  LoadingNotice,
  PageFrame,
  SelectInput,
  Tag,
  Toggle,
  type ChoiceOption,
} from '../components/frame/index.ts';
import { Icon } from '../components/Icon.tsx';
import { Brief, Reminders } from '../components/scenario/Brief.tsx';
import { CoreStage } from '../components/scenario/CoreStage.tsx';
import { CurveballsField } from '../components/scenario/CurveballsField.tsx';
import { EnterBar } from '../components/scenario/EnterBar.tsx';
import { isOneOf } from '../components/scenario/guards.ts';
import { backToMissions, setupPath } from '../components/scenario/paths.ts';
import { ScenarioNotFound } from '../components/scenario/ScenarioNotFound.tsx';
import {
  SETTING_NAMES,
  carryChoices,
  changedSettings,
  chooseStartScenario,
  choicesFromOverrides,
  curveballCount,
  defaultChoices,
  defaultMode,
  draftFor,
  fitCurveballs,
  issueTypesOf,
  maxCurveballs,
  modeFromDraft,
  overridesFromChoices,
  scenariosOfIssue,
  switchIssue,
  type SetupChoices,
  type SettingKey,
} from '../components/scenario/setup-model.ts';
import { useAfter } from '../components/scenario/useAfter.ts';
import { useBeginCall } from '../components/scenario/useBeginCall.ts';
import { useScenarioLibrary } from '../components/scenario/useScenarioLibrary.ts';
import type { GlyphStatus } from '../components/signal/types.ts';
import { useWorldPose } from '../components/world/useWorldPose.ts';
import { api } from '../lib/api.ts';
import { loadDraft, saveDraft } from '../lib/draft.ts';
import { useApi } from '../lib/hooks.ts';
import { usePreferences, type ProfilePreferences } from '../lib/profile.ts';
import { useReducedMotion } from '../lib/theme.tsx';
import '../styles/calibrate.css';

type NonEmpty<T> = readonly [T, ...T[]];

interface History {
  sessions: SessionSummaryDTO[];
  progress: ProgressDTO | null;
}

/** Only the open practice page uses this, to suggest where to start. Without it, it starts on the first scenario. */
async function loadHistory(signal: AbortSignal): Promise<History> {
  const [sessions, progress] = await Promise.all([
    api.listSessions({ limit: 100, includeSamples: false }, signal).catch(() => null),
    api.progress(false, signal).catch(() => null),
  ]);
  return { sessions: sessions?.sessions ?? [], progress };
}

/** How long a call may take to open before the page says it is opening, so a quick answer shows nothing extra. */
const SHOW_OPENING_AFTER_MS = 350;
/** And before it says that it is taking longer than usual. */
const SLOW_AFTER_MS = 6000;

/**
 * Calibration, the one place a call is configured and started. It opens at /practice, on the
 * scenario that suits the trainee best, and at /scenarios/:id/setup on the scenario that was chosen.
 */
export default function Setup() {
  const { id } = useParams<{ id: string }>();
  const preferences = usePreferences();
  const scenarios = useScenarioLibrary();
  const history = useApi<History | null>(
    (signal) => (id ? Promise.resolve(null) : loadHistory(signal)),
    [id],
  );

  if (scenarios.loading || (!id && history.loading)) {
    return (
      <PageFrame title="Calibration" width="wide">
        <LoadingNotice label="Loading the setup" lines={5} />
      </PageFrame>
    );
  }
  if (scenarios.error) {
    return (
      <PageFrame title="Calibration" width="wide">
        <ErrorNotice
          level={1}
          error={scenarios.error}
          onRetry={scenarios.reload}
          title="Could not load the scenarios"
        />
      </PageFrame>
    );
  }
  const [first, ...rest] = scenarios.data ?? [];
  if (!first) {
    return (
      <PageFrame title="Calibration" width="wide">
        <EmptyNotice level={1} title="No scenarios are available yet">
          Scenarios will appear here once they have been added.
        </EmptyNotice>
      </PageFrame>
    );
  }
  const library: NonEmpty<PublicScenarioDTO> = [first, ...rest];
  if (id && !library.some((scenario) => scenario.id === id)) return <ScenarioNotFound />;

  return (
    <SetupForm
      key={id ?? 'practice'}
      scenarios={library}
      entryId={id}
      history={history.data}
      preferences={preferences}
    />
  );
}

interface FormState {
  scenario: PublicScenarioDTO;
  choices: SetupChoices;
  /** The practice mode the trainee picked. While it is null the mode follows the difficulty and the hints setting. */
  mode: PracticeMode | null;
  /** Why the page suggested this scenario, until the trainee chooses another. */
  reason: string | null;
}

/**
 * Where the page opens. A scenario in the address wins, with its saved draft if there is one. The
 * open practice page restores a saved draft, and otherwise starts from the trainee's usual
 * difficulty and the scenario the history suggests.
 */
function initialFormState(
  scenarios: NonEmpty<PublicScenarioDTO>,
  entryId: string | undefined,
  history: History | null,
  preferences: ProfilePreferences,
): FormState {
  const saved = loadDraft();
  const target = scenarios.find((scenario) => scenario.id === (entryId ?? saved?.scenarioId));
  if (target) {
    const draft = draftFor(saved, target.id);
    return {
      scenario: target,
      choices: draft ? choicesFromOverrides(target, draft.overrides) : defaultChoices(target),
      mode: modeFromDraft(draft),
      reason: null,
    };
  }
  const { defaultDifficulty } = preferences;
  const pick = chooseStartScenario(scenarios, defaultDifficulty, (pool) =>
    recommendMission({
      scenarios: pool,
      sessions: history?.sessions ?? [],
      progress: history?.progress ?? null,
    }),
  );
  const scenario = pick?.scenario ?? scenarios[0];
  return {
    scenario,
    choices: { ...defaultChoices(scenario), difficulty: defaultDifficulty },
    mode: null,
    reason: pick?.reason ?? null,
  };
}

// ------------------------------------------------------------------------------------------
// The rows: each setting is one decision in serif words on a hairline, with a sentence under it
// that says what the chosen word does to the call.

type RowOptions = ChoiceOption[];

/**
 * The options of one setting. The sentence under the row is the consequence of the chosen option
 * (`OPTION_EXPLANATIONS`), and it names the scenario's own choice once the choice differs from it.
 */
function rowOptions<K extends SettingKey>(
  setting: K,
  values: readonly SetupChoices[K][],
  nameOf: (value: SetupChoices[K]) => string,
  own: SetupChoices[K],
): RowOptions {
  const table: Record<string, string> = OPTION_EXPLANATIONS[setting];
  return values.map((value) => ({
    value,
    label: nameOf(value),
    hint: `${table[value] ?? ''}${value === own ? '' : ` Scenario default: ${nameOf(own)}.`}`.trim(),
  }));
}

const MODES: readonly PracticeMode[] = ['guided', 'immersive'];
const MODE_SENTENCE: Record<PracticeMode, string> = {
  guided:
    'Guided practice adds light cues on screen during the call. The customer behaves the same either way.',
  immersive:
    'Immersive practice feels like a real call, with no cues on screen. The customer behaves the same either way.',
};

function validStatus(state: unknown): GlyphStatus {
  const status =
    typeof state === 'object' && state !== null ? (state as { status?: unknown }).status : null;
  return status === 'attempted' || status === 'completed' ? status : 'new';
}

function SetupForm({
  scenarios,
  entryId,
  history,
  preferences,
}: {
  scenarios: NonEmpty<PublicScenarioDTO>;
  entryId: string | undefined;
  history: History | null;
  preferences: ProfilePreferences;
}) {
  const [state, setState] = useState(() =>
    initialFormState(scenarios, entryId, history, preferences),
  );
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('');
  const location = useLocation();
  const reduced = useReducedMotion();
  const openingRef = useRef<HTMLDivElement>(null);

  const { scenario, choices } = state;
  const profile = DIFFICULTY_PROFILES[choices.difficulty];
  const automaticMode = defaultMode(choices.difficulty, preferences.hints);
  const mode = state.mode ?? automaticMode;
  const overrides = overridesFromChoices(scenario, choices);
  const changed = changedSettings(scenario, choices);
  const family = scenariosOfIssue(scenarios, scenario.issueType);
  const { persona } = scenario;

  // The field behind the page answers the settings, the way the core does.
  useWorldPose(worldPoseFor(coreParams(choices)));

  const call = useBeginCall(
    { scenarioId: scenario.id, overrides, mode },
    { name: persona.name, role: `${persona.role}, ${persona.organisation}` },
  );
  const locked = call.pending;
  // The opening screen only shows if the wait is real; a quick answer goes straight to the call.
  const opening = useAfter(call.pending, SHOW_OPENING_AFTER_MS);
  const slow = useAfter(call.pending, SLOW_AFTER_MS);

  // The opening screen replaces the form, so focus goes to it rather than to nothing.
  useEffect(() => {
    if (opening) openingRef.current?.focus();
  }, [opening]);

  // While the page changes to or from the plate, the core carries the name its star carries there.
  const moving = useViewTransitionState(setupPath(scenario.id));
  const transitionName = moving && entryId === scenario.id ? 'signal-mission' : undefined;

  // Every change is kept as the draft straight away, so a refresh or a visit elsewhere loses nothing.
  const commit = (next: FormState) => {
    setState(next);
    saveDraft({
      scenarioId: next.scenario.id,
      overrides: overridesFromChoices(next.scenario, next.choices),
      ...(next.mode ? { mode: next.mode } : {}),
    });
  };

  const update = (patch: Partial<SetupChoices>) => {
    const next = { ...choices, ...patch };
    let message = '';
    if (patch.difficulty !== undefined && next.curveballMode === 'choose') {
      const fit = fitCurveballs(next.curveballs, next.difficulty, scenario.curveballOptions);
      if (fit.removed.length > 0) {
        next.curveballs = fit.picks;
        const removed = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(
          fit.removed.map((type: CurveballType) => `"${CURVEBALL_LABELS[type].label}"`),
        );
        message = `${DIFFICULTY_PROFILES[next.difficulty].label} allows up to ${curveballCount(maxCurveballs(next.difficulty))}, so ${removed} ${fit.removed.length === 1 ? 'was' : 'were'} removed from your choices.`;
      }
    }
    setNotice(message);
    setStatus(explainChange(choices, next));
    commit({ ...state, choices: next });
  };

  const moveTo = (next: PublicScenarioDTO, carried: SetupChoices) => {
    setNotice('');
    commit({ ...state, scenario: next, choices: carried, reason: null });
    setStatus(
      `Scenario changed to ${next.title}.${changed.length > 0 ? ' Your changes were kept.' : ''}`,
    );
  };
  const chooseIssue = (issueType: IssueType) => {
    const next = switchIssue(scenarios, issueType, scenario, choices);
    if (next) moveTo(next.scenario, next.choices);
  };
  const chooseScenario = (id: string) => {
    const next = scenarios.find((candidate) => candidate.id === id);
    if (next) moveTo(next, carryChoices(scenario, next, choices));
  };

  const reset = () => {
    setNotice('');
    commit({ ...state, choices: defaultChoices(scenario) });
    setStatus('Reset to the scenario defaults.');
  };

  const issues = issueTypesOf(scenarios);
  const modeOptions: RowOptions = MODES.map((option) => ({
    value: option,
    label: PRACTICE_MODE_LABELS[option].label,
    hint: `${MODE_SENTENCE[option]}${
      option === automaticMode
        ? preferences.hints === 'auto'
          ? ` Default for ${profile.label}.`
          : ' From your settings.'
        : ''
    }`,
  }));

  const difficultyOptions: RowOptions = rowOptions(
    'difficulty',
    PRESETS.map((preset) => preset.id),
    (value) => DIFFICULTY_PROFILES[value].label,
    scenario.difficulty,
  );
  const disclaimer = (
    <>
      <Brief scenario={scenario} customised={changed.length > 0} />
      <Reminders />
    </>
  );

  const rows = (
    <form
      className="cal-form"
      aria-label="Calibrate the scenario"
      onSubmit={(e) => e.preventDefault()}
    >
      <fieldset className="cal-form__set" disabled={locked}>
        <section className="cal-group" aria-labelledby="cal-call">
          <div className="cal-group__head">
            <h2 id="cal-call" className="cal-group__title type-label">
              Calibrate the call
            </h2>
            <div className="cal-state">
              {changed.length > 0 ? <Tag tone="amber">Customised</Tag> : null}
              <p className="cal-state__text">
                {changed.length === 0
                  ? 'Everything starts from the scenario as written.'
                  : `Changed from the scenario: ${changed.map((key) => SETTING_NAMES[key].toLowerCase()).join(', ')}.`}
              </p>
              {changed.length > 0 ? (
                <button type="button" className="text-link" onClick={reset}>
                  Reset to scenario defaults
                </button>
              ) : null}
            </div>
          </div>
          <ChoiceRow
            legend="Difficulty"
            name="cal-difficulty"
            value={choices.difficulty}
            options={difficultyOptions}
            onChange={(value) => {
              if (
                isOneOf(
                  PRESETS.map((p) => p.id),
                  value,
                )
              )
                update({ difficulty: value });
            }}
          />
          <ChoiceRow
            legend="Business impact"
            name="cal-impact"
            value={choices.impact}
            options={rowOptions('impact', IMPACTS, (v) => IMPACT_LABELS[v].label, scenario.impact)}
            onChange={(value) => {
              if (isOneOf(IMPACTS, value)) update({ impact: value });
            }}
          />
          <ChoiceRow
            legend="Customer temperature"
            name="cal-temperature"
            value={choices.startingTemperature}
            options={rowOptions(
              'startingTemperature',
              START_TEMPERATURES,
              (v) => START_TEMPERATURE_LABELS[v].label,
              scenario.startingTemperature,
            )}
            onChange={(value) => {
              if (isOneOf(START_TEMPERATURES, value)) update({ startingTemperature: value });
            }}
          />
        </section>

        <section className="cal-group" aria-labelledby="cal-customer">
          <h2 id="cal-customer" className="cal-group__title type-label">
            About the customer
          </h2>
          <ChoiceRow
            legend="Technical proficiency"
            name="cal-proficiency"
            size="text"
            value={choices.proficiency}
            options={rowOptions(
              'proficiency',
              PROFICIENCIES,
              (v) => PROFICIENCY_LABELS[v].label,
              scenario.proficiency,
            )}
            onChange={(value) => {
              if (isOneOf(PROFICIENCIES, value)) update({ proficiency: value });
            }}
          />
          <ChoiceRow
            legend="Communication style"
            name="cal-style"
            size="text"
            value={choices.style}
            options={rowOptions('style', STYLES, (v) => STYLE_LABELS[v].label, scenario.style)}
            onChange={(value) => {
              if (isOneOf(STYLES, value)) update({ style: value });
            }}
          />
          <ChoiceRow
            legend="Call stage"
            name="cal-stage"
            size="text"
            value={choices.callStage}
            options={rowOptions(
              'callStage',
              CALL_STAGES,
              (v) => CALL_STAGE_LABELS[v].label,
              scenario.callStage,
            )}
            onChange={(value) => {
              if (isOneOf(CALL_STAGES, value)) update({ callStage: value });
            }}
          />
        </section>

        <section className="cal-group" aria-labelledby="cal-during">
          <h2 id="cal-during" className="cal-group__title type-label">
            During the call
          </h2>
          <Toggle
            label="Hidden facts"
            checked
            disabled
            onChange={() => undefined}
            hint="Always on. Every scenario has details the customer only shares when you ask about them."
          />
          <CurveballsField
            scenario={scenario}
            choices={choices}
            notice={notice}
            onChange={(next) => {
              setNotice('');
              setStatus(explainChange(choices, next));
              commit({ ...state, choices: next });
            }}
            disabled={locked}
          />
          <ChoiceRow
            legend="Practice mode"
            name="cal-mode"
            size="text"
            value={mode}
            options={modeOptions}
            onChange={(value) => {
              if (isOneOf(MODES, value)) commit({ ...state, mode: value });
            }}
          />
        </section>
      </fieldset>
    </form>
  );

  const scenarioChoice = (
    <div className="cal-scenario">
      <Field label="Issue type">
        <SelectInput
          value={scenario.issueType}
          disabled={locked}
          aria-describedby="cal-summary"
          options={issues.map((type) => ({ value: type, label: ISSUE_TYPE_LABELS[type] }))}
          onChange={(event) => {
            if (isOneOf(issues, event.target.value)) chooseIssue(event.target.value);
          }}
        />
      </Field>
      {family.length > 1 ? (
        <Field label="Scenario">
          <SelectInput
            value={scenario.id}
            disabled={locked}
            aria-describedby="cal-summary"
            options={family.map((candidate) => ({ value: candidate.id, label: candidate.title }))}
            onChange={(event) => chooseScenario(event.target.value)}
          />
        </Field>
      ) : null}
    </div>
  );

  return (
    <PageFrame title="Calibration" width="wide" className="cal-page">
      <div className="cal" data-state={opening ? 'opening' : 'calibrating'}>
        {opening ? null : (
          <header className="cal-head">
            <p className="cal-head__eyebrow type-label">
              <Link
                to={backToMissions(location.state)}
                className="text-link"
                viewTransition={!reduced}
              >
                <Icon name="arrow-left" size={14} /> Back to the missions
              </Link>
              <span aria-hidden="true">/</span>
              <span>Calibration</span>
              <span aria-hidden="true">/</span>
              <span>{ISSUE_TYPE_LABELS[scenario.issueType]}</span>
            </p>
            <h1 className="cal-head__title type-title">{scenario.title}</h1>
            <p className="cal-head__who">
              <strong>{persona.name}</strong>, {persona.role}, {persona.organisation}
              <span className="cal-head__fiction type-label">A fictional customer</span>
            </p>
            <p id="cal-summary" className="cal-head__summary">
              {scenario.summary}
            </p>
            {state.reason && choices.difficulty === scenario.difficulty ? (
              <p className="cal-head__why">
                <strong>Suggested for you.</strong> {state.reason}
              </p>
            ) : null}
          </header>
        )}

        <CoreStage
          scenario={scenario}
          choices={choices}
          status={validStatus(location.state)}
          quiet={call.pending}
          transitionName={transitionName}
        />

        {opening ? (
          <div className="cal-opening" ref={openingRef} tabIndex={-1}>
            <ConnectingView
              name={persona.name}
              // The persona's job title, not an ARIA role.
              // eslint-disable-next-line jsx-a11y/aria-role
              role={`${persona.role}, ${persona.organisation}`}
              phase={slow ? 'slow' : 'opening'}
            />
          </div>
        ) : (
          <>
            <div className="cal-main">
              {scenarioChoice}
              {rows}
              {disclaimer}
            </div>
            <EnterBar
              summary={[
                profile.label,
                PRACTICE_MODE_LABELS[mode].label,
                `About ${scenario.estimatedMinutes} minutes`,
              ].join(' \u00b7 ')}
              pending={call.pending}
              failure={call.failure}
              onStart={() => void call.begin()}
            />
          </>
        )}
      </div>
      <p className="sr-only" role="status">
        {status}
      </p>
    </PageFrame>
  );
}
