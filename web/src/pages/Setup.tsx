import { useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { ProgressDTO, PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { recommendMission } from '#shared/domain/recommend.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  DIFFICULTIES,
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
  type Difficulty,
  type IssueType,
  type PracticeMode,
} from '#shared/domain/vocab.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { EmptyState, ErrorState, Page, PageHeader, SkeletonBlock } from '../components/Page.tsx';
import { ChoiceGroup, type ChoiceOption } from '../components/scenario/ChoiceGroup.tsx';
import { CurveballsField } from '../components/scenario/CurveballsField.tsx';
import {
  ChoiceRow,
  SelectField,
  ToggleRow,
  type FieldOption,
} from '../components/scenario/Fields.tsx';
import { LaunchSequence } from '../components/scenario/LaunchSequence.tsx';
import { libraryPath } from '../components/scenario/paths.ts';
import { ScenarioNotFound } from '../components/scenario/ScenarioNotFound.tsx';
import { ScenarioPreview } from '../components/scenario/ScenarioPreview.tsx';
import {
  DIFFICULTY_TAGLINES,
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
  temperatureBandFor,
  type SetupChoices,
} from '../components/scenario/setup-model.ts';
import { StartBar } from '../components/scenario/StartBar.tsx';
import { useBeginCall } from '../components/scenario/useBeginCall.ts';
import { useStickyAside } from '../components/scenario/useStickyAside.ts';
import type { Tone } from '../components/ui/StatCard.tsx';
import { api } from '../lib/api.ts';
import { loadDraft, saveDraft } from '../lib/draft.ts';
import { useApi } from '../lib/hooks.ts';
import { usePreferences, type ProfilePreferences } from '../lib/profile.ts';
import '../styles/launch.css';
import '../styles/setup.css';

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

function labelled<T extends string>(
  order: readonly T[],
  labels: Record<T, { label: string; description: string }>,
): FieldOption<T>[] {
  return order.map((value) => ({
    value,
    label: labels[value].label,
    description: labels[value].description,
  }));
}

const IMPACT_OPTIONS = labelled(IMPACTS, IMPACT_LABELS);
const TEMPERATURE_OPTIONS = labelled(START_TEMPERATURES, START_TEMPERATURE_LABELS);
const PROFICIENCY_OPTIONS = labelled(PROFICIENCIES, PROFICIENCY_LABELS);
const STYLE_OPTIONS = labelled(STYLES, STYLE_LABELS);
const STAGE_OPTIONS = labelled(CALL_STAGES, CALL_STAGE_LABELS);
const MODES: readonly PracticeMode[] = ['guided', 'immersive'];

const QUICK_START: Record<Difficulty, { icon: IconName; tone: Tone }> = {
  starter: { icon: 'star', tone: 'green' },
  standard: { icon: 'user', tone: 'blue' },
  challenge: { icon: 'shield', tone: 'violet' },
};

const SETUP_LEAD = 'Set the customer parameters to create your practice call.';

function SetupFrame({ children }: { children: ReactNode }) {
  return (
    <Page title="Practice setup" className="stp">
      <PageHeader title="Configure your scenario" lead={SETUP_LEAD} />
      {children}
    </Page>
  );
}

function SetupSkeleton() {
  return (
    <div className="stp-layout" role="status" aria-label="Loading the setup">
      <div className="stp-main">
        {[110, 430, 120].map((height) => (
          <div key={height} className="glass card">
            <SkeletonBlock height={height} />
          </div>
        ))}
      </div>
      <div className="stp-aside">
        <div className="glass card stack">
          <SkeletonBlock height={14} width="30%" />
          <SkeletonBlock height={26} width="80%" />
          <SkeletonBlock height={72} />
          <SkeletonBlock height={140} />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Practice setup, the one place a call is configured and started. It opens at /practice, on the
 * scenario that suits the trainee best, and at /scenarios/:id/setup on the scenario that was chosen.
 */
export default function Setup() {
  const { id } = useParams<{ id: string }>();
  const preferences = usePreferences();
  const scenarios = useApi((signal) => api.scenarios(signal), []);
  const history = useApi<History | null>(
    (signal) => (id ? Promise.resolve(null) : loadHistory(signal)),
    [id],
  );

  if (scenarios.loading || (!id && history.loading)) {
    return (
      <SetupFrame>
        <SetupSkeleton />
      </SetupFrame>
    );
  }
  if (scenarios.error) {
    return (
      <SetupFrame>
        <ErrorState
          error={scenarios.error}
          onRetry={scenarios.reload}
          title="Could not load the scenarios"
        />
      </SetupFrame>
    );
  }
  const [first, ...rest] = scenarios.data ?? [];
  if (!first) {
    return (
      <SetupFrame>
        <EmptyState icon="book" title="No scenarios are available yet">
          Scenarios will appear here once they have been added.
        </EmptyState>
      </SetupFrame>
    );
  }
  const library: NonEmpty<PublicScenarioDTO> = [first, ...rest];
  if (id && !library.some((scenario) => scenario.id === id)) return <ScenarioNotFound />;

  return (
    <SetupFrame>
      <SetupForm
        key={id ?? 'practice'}
        scenarios={library}
        entryId={id}
        history={history.data}
        preferences={preferences}
      />
    </SetupFrame>
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
  const asideRef = useRef<HTMLDivElement>(null);
  useStickyAside(asideRef);

  const { scenario, choices } = state;
  const profile = DIFFICULTY_PROFILES[choices.difficulty];
  const automaticMode = defaultMode(choices.difficulty, preferences.hints);
  const mode = state.mode ?? automaticMode;
  const overrides = overridesFromChoices(scenario, choices);
  const changed = changedSettings(scenario, choices);
  const family = scenariosOfIssue(scenarios, scenario.issueType);

  const call = useBeginCall({ scenarioId: scenario.id, overrides, mode });
  const locked = call.pending;

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

  const issueOptions: FieldOption<IssueType>[] = issueTypesOf(scenarios).map((type) => ({
    value: type,
    label: ISSUE_TYPE_LABELS[type],
  }));
  const scenarioOptions: FieldOption<string>[] = family.map((candidate) => ({
    value: candidate.id,
    label: candidate.title,
  }));
  const quickStart: ChoiceOption<Difficulty>[] = DIFFICULTIES.map((difficulty) => {
    const { icon, tone } = QUICK_START[difficulty];
    return {
      value: difficulty,
      label: DIFFICULTY_PROFILES[difficulty].label,
      description: DIFFICULTY_TAGLINES[difficulty],
      tone,
      // Said only once another difficulty is chosen: it is where the scenario was written to start.
      tag:
        difficulty === scenario.difficulty && choices.difficulty !== scenario.difficulty
          ? 'Scenario default'
          : undefined,
      lead: (
        <span className="tone-icon" data-tone={tone}>
          <Icon name={icon} size={20} />
        </span>
      ),
    };
  });
  const modeOptions: ChoiceOption<PracticeMode>[] = MODES.map((option) => ({
    value: option,
    label: PRACTICE_MODE_LABELS[option].label,
    description: PRACTICE_MODE_LABELS[option].description,
    tag:
      option === automaticMode
        ? preferences.hints === 'auto'
          ? `Default for ${profile.label}`
          : 'From your settings'
        : undefined,
  }));

  return (
    <>
      <div className="stp-layout">
        <div className="stp-main">
          <div className="glass card stp-card">
            <ChoiceGroup
              name="stp-difficulty"
              legend="Quick start"
              heading="h2"
              columns={3}
              value={choices.difficulty}
              options={quickStart}
              onChange={(difficulty) => update({ difficulty })}
              disabled={locked}
              hint={
                <>
                  <strong>{profile.label}.</strong> {profile.summary}
                </>
              }
            />
          </div>

          <div className="glass card stp-card">
            <div className="stp-card-head">
              <div className="stp-card-title">
                <h2 className="t-section">Custom configuration</h2>
                {changed.length > 0 ? <span className="chip chip-accent">Customised</span> : null}
              </div>
              {changed.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary stp-reset"
                  onClick={reset}
                  disabled={locked}
                >
                  Reset to scenario defaults
                </button>
              ) : null}
              <p className="hint stp-card-note">
                {changed.length === 0
                  ? 'Everything starts from the scenario as written.'
                  : `Changed from the scenario: ${changed.map((key) => SETTING_NAMES[key].toLowerCase()).join(', ')}.`}
              </p>
            </div>

            <div className="stp-fields">
              <div className="stp-col">
                <SelectField
                  label="Issue type"
                  value={scenario.issueType}
                  options={issueOptions}
                  onChange={chooseIssue}
                  hint={family.length > 1 ? undefined : scenario.summary}
                  disabled={locked}
                />
                {family.length > 1 ? (
                  <SelectField
                    label="Scenario"
                    value={scenario.id}
                    options={scenarioOptions}
                    onChange={chooseScenario}
                    hint={scenario.summary}
                    disabled={locked}
                  />
                ) : null}
                {state.reason && choices.difficulty === scenario.difficulty ? (
                  <p className="stp-reason">
                    <Icon name="spark" size={16} />
                    <span>
                      <strong>Suggested for you.</strong> {state.reason}
                    </span>
                  </p>
                ) : null}
                <p className="stp-browse">
                  <Link to={libraryPath} className="link-more" viewTransition>
                    Browse all scenarios <Icon name="arrow-right" size={16} />
                  </Link>
                </p>
                <SelectField
                  label="Call stage"
                  value={choices.callStage}
                  defaultValue={scenario.callStage}
                  options={STAGE_OPTIONS}
                  onChange={(callStage) => update({ callStage })}
                  disabled={locked}
                />
              </div>
              <div className="stp-col">
                <ChoiceRow
                  legend="Business impact"
                  value={choices.impact}
                  defaultValue={scenario.impact}
                  options={IMPACT_OPTIONS}
                  onChange={(impact) => update({ impact })}
                  disabled={locked}
                />
                <ChoiceRow
                  legend="Customer temperature"
                  value={choices.startingTemperature}
                  defaultValue={scenario.startingTemperature}
                  options={TEMPERATURE_OPTIONS}
                  onChange={(startingTemperature) => update({ startingTemperature })}
                  disabled={locked}
                />
                <ChoiceRow
                  legend="Technical proficiency"
                  value={choices.proficiency}
                  defaultValue={scenario.proficiency}
                  options={PROFICIENCY_OPTIONS}
                  onChange={(proficiency) => update({ proficiency })}
                  disabled={locked}
                />
                <ChoiceRow
                  legend="Communication style"
                  value={choices.style}
                  defaultValue={scenario.style}
                  options={STYLE_OPTIONS}
                  onChange={(style) => update({ style })}
                  disabled={locked}
                />
              </div>
            </div>

            <div className="stp-toggles">
              <ToggleRow
                title="Hidden facts"
                checked
                locked
                description="Always on. Every scenario has details the customer only shares when you ask about them."
              />
              <CurveballsField
                scenario={scenario}
                choices={choices}
                notice={notice}
                onChange={(next) => {
                  setNotice('');
                  commit({ ...state, choices: next });
                }}
                disabled={locked}
              />
            </div>
          </div>

          <div className="glass card stp-card">
            <ChoiceGroup
              name="stp-mode"
              legend="Practice mode"
              heading="h2"
              columns={2}
              value={mode}
              options={modeOptions}
              onChange={(next) => commit({ ...state, mode: next })}
              disabled={locked}
              hint="Guided practice adds light cues on screen during the call. The customer behaves the same either way."
            />
          </div>
        </div>

        <div className="stp-aside" ref={asideRef}>
          <ScenarioPreview scenario={scenario} choices={choices} customised={changed.length > 0} />
        </div>
      </div>

      <StartBar
        title={scenario.title}
        summary={[
          profile.label,
          PRACTICE_MODE_LABELS[mode].label,
          `About ${scenario.estimatedMinutes} minutes`,
        ].join(' \u00b7 ')}
        pending={call.pending}
        failure={call.failure}
        onStart={() => void call.begin()}
      />
      <p className="sr-only" role="status">
        {status}
      </p>

      {call.launching ? (
        <LaunchSequence
          title={scenario.title}
          persona={scenario.persona}
          mood={temperatureBandFor(choices.startingTemperature)}
          ready={call.startedId !== null}
          onDone={() => {
            if (call.startedId) call.openCall(call.startedId);
          }}
        />
      ) : null}
    </>
  );
}
