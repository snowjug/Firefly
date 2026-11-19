import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
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
} from '#shared/domain/vocab.ts';
import { Icon } from '../components/Icon.tsx';
import { ErrorState, Page, SkeletonBlock } from '../components/Page.tsx';
import { TemperatureOrb } from '../components/TemperatureOrb.tsx';
import { ChoiceGroup, type ChoiceOption } from '../components/scenario/ChoiceGroup.tsx';
import { CurveballPicker } from '../components/scenario/CurveballPicker.tsx';
import { briefPath, libraryPath } from '../components/scenario/paths.ts';
import { ScenarioNotFound } from '../components/scenario/ScenarioNotFound.tsx';
import { isNotFoundError } from '../components/scenario/scenario-errors.ts';
import { SettingsSummary } from '../components/scenario/SettingsSummary.tsx';
import {
  STEP_COUNT,
  SETUP_STEPS,
  choicesFromOverrides,
  curveballCount,
  defaultChoices,
  draftFor,
  fitCurveballs,
  issueRow,
  maxCurveballs,
  overridesFromChoices,
  parseStep,
  settingRows,
  temperatureBandFor,
  type CurveballMode,
  type SetupChoices,
} from '../components/scenario/setup-model.ts';
import { SetupPreview } from '../components/scenario/SetupPreview.tsx';
import { StepIndicator } from '../components/scenario/StepIndicator.tsx';
import { api } from '../lib/api.ts';
import { loadDraft, saveDraft } from '../lib/draft.ts';
import { useApi, useMediaQuery } from '../lib/hooks.ts';
import '../styles/setup.css';

const DEFAULT_TAG = 'Scenario default';

// One decision per step. The heading is the question; the lead says what the choice changes.
const STEP_COPY: readonly { question: string; lead: string }[] = [
  {
    question: 'Is this the issue you want to practise?',
    lead: 'This is what the customer is calling about. The next steps change how they behave on the call.',
  },
  {
    question: 'How much is the business affected?',
    lead: 'Impact changes what the customer says about the consequences and how urgent they feel.',
  },
  {
    question: 'How does the customer feel when the call starts?',
    lead: 'Their starting temperature sets how much patience and trust they bring. It can rise or fall as the call goes on.',
  },
  {
    question: 'How do they talk, and how technical are they?',
    lead: 'These are two separate settings. One is how they communicate, the other is how much they know.',
  },
  {
    question: 'Where is this case in its life?',
    lead: 'The stage changes what the customer expects from you and how much trust you start with.',
  },
  {
    question: 'How forgiving should the customer be?',
    lead: 'Pick a preset for how forgiving the customer is. It is not a score multiplier.',
  },
  {
    question: 'Should the customer do something unexpected?',
    lead: 'This step is optional. A curveball is an unexpected moment during the call. You will not be told when one may happen.',
  },
  {
    question: 'Review your call',
    lead: 'Check each choice. Anything you changed from the scenario is marked, and you can edit it before you continue.',
  },
];

function labelled<T extends string>(
  order: readonly T[],
  labels: Record<T, { label: string; description: string }>,
  defaultValue: T,
  lead?: (value: T) => ReactNode,
): ChoiceOption<T>[] {
  return order.map((value) => ({
    value,
    label: labels[value].label,
    description: labels[value].description,
    tag: value === defaultValue ? DEFAULT_TAG : undefined,
    lead: lead?.(value),
  }));
}

const hrefForStep = (step: number) => `?step=${step}`;

function SetupFrame({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Page title={title ? `Set up: ${title}` : 'Set up a call'}>
      <header className="stp-header">
        <p className="t-label">Set up a call</p>
        <h1 className="t-title">{title ?? 'Set up your call'}</h1>
      </header>
      {children}
    </Page>
  );
}

export default function Setup() {
  const { id = '' } = useParams<{ id: string }>();
  const scenario = useApi((signal) => api.scenario(id, signal), [id]);

  if (scenario.loading) {
    return (
      <SetupFrame>
        <div className="glass panel stp-step" role="status" aria-label="Loading scenario">
          <div className="stack">
            <SkeletonBlock height={14} width="22%" />
            <SkeletonBlock height={28} width="70%" />
            <SkeletonBlock height={16} />
            <SkeletonBlock height={96} />
            <SkeletonBlock height={96} />
          </div>
        </div>
      </SetupFrame>
    );
  }
  if (scenario.error) {
    return isNotFoundError(scenario.error) ? (
      <ScenarioNotFound />
    ) : (
      <SetupFrame>
        <ErrorState
          error={scenario.error}
          onRetry={scenario.reload}
          title="Could not load this scenario"
        />
      </SetupFrame>
    );
  }
  if (!scenario.data) return <ScenarioNotFound />;
  return (
    <SetupFrame title={scenario.data.title}>
      <SetupFlow key={scenario.data.id} scenario={scenario.data} />
    </SetupFrame>
  );
}

function StepActions({ step, onBack, onNext }: { step: number; onBack(): void; onNext(): void }) {
  return (
    <div className="stp-actions">
      {step === 1 ? (
        <Link to={libraryPath} className="btn btn-secondary" viewTransition>
          <Icon name="arrow-left" size={18} /> Back
        </Link>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <Icon name="arrow-left" size={18} /> Back
        </button>
      )}
      <button type="button" className="btn btn-primary" onClick={onNext}>
        {step === STEP_COUNT ? 'Continue to brief' : 'Next'} <Icon name="arrow-right" size={18} />
      </button>
    </div>
  );
}

function SetupFlow({ scenario }: { scenario: PublicScenarioDTO }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = parseStep(params.get('step'));
  const compact = useMediaQuery('(max-width: 999px)');
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [choices, setChoices] = useState<SetupChoices>(() => {
    const draft = draftFor(loadDraft(), scenario.id);
    return draft ? choicesFromOverrides(scenario, draft.overrides) : defaultChoices(scenario);
  });
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('');

  // A new step is announced politely and its heading takes focus, whether the person used the
  // buttons, the step links or the browser's Back and Forward.
  const [seenStep, setSeenStep] = useState(step);
  const [stepChanges, setStepChanges] = useState(0);
  if (seenStep !== step) {
    setSeenStep(step);
    setStepChanges((count) => count + 1);
    setStatus(`Step ${step} of ${STEP_COUNT}: ${SETUP_STEPS[step - 1]?.title ?? ''}`);
  }
  useEffect(() => {
    if (stepChanges > 0) headingRef.current?.focus();
  }, [stepChanges]);

  const rows = settingRows(scenario, choices);
  const copy = STEP_COPY[step - 1];

  // Every change is saved to the draft straight away, keeping only what differs from the scenario.
  const persist = (next: SetupChoices) => {
    const overrides = overridesFromChoices(scenario, next);
    const saved = draftFor(loadDraft(), scenario.id);
    const keepMode =
      saved?.mode !== undefined && saved.overrides.difficulty === overrides.difficulty;
    saveDraft({
      scenarioId: scenario.id,
      overrides,
      ...(keepMode ? { mode: saved.mode } : {}),
    });
  };

  const update = (patch: Partial<SetupChoices>) => {
    const next = { ...choices, ...patch };
    if (patch.difficulty !== undefined && patch.difficulty !== choices.difficulty) {
      const fit = fitCurveballs(next.curveballs, next.difficulty, scenario.curveballOptions);
      if (next.curveballMode === 'choose' && fit.removed.length > 0) {
        next.curveballs = fit.picks;
        const removed = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(
          fit.removed.map((type) => `"${CURVEBALL_LABELS[type].label}"`),
        );
        const verb = fit.removed.length === 1 ? 'was' : 'were';
        setNotice(
          `${DIFFICULTY_PROFILES[next.difficulty].label} allows up to ${curveballCount(maxCurveballs(next.difficulty))}, so ${removed} ${verb} removed from your choices.`,
        );
      } else {
        setNotice('');
      }
    }
    setChoices(next);
    persist(next);
  };

  const changeCurveballMode = (mode: CurveballMode) => {
    setNotice('');
    update({ curveballMode: mode });
  };
  const toggleCurveball = (type: CurveballType) => {
    setNotice('');
    const picks = choices.curveballs.includes(type)
      ? choices.curveballs.filter((pick) => pick !== type)
      : [...choices.curveballs, type];
    update({ curveballs: picks });
  };

  const reset = () => {
    const next = defaultChoices(scenario);
    setChoices(next);
    setNotice('');
    saveDraft({ scenarioId: scenario.id, overrides: {} });
    setStatus('Reset to the scenario defaults.');
  };

  const goTo = (target: number) => setParams({ step: String(target) });
  const back = () => goTo(step - 1);
  const next = () => {
    if (step < STEP_COUNT) {
      goTo(step + 1);
      return;
    }
    persist(choices);
    void navigate(briefPath(scenario.id), { viewTransition: true });
  };

  const actions = <StepActions step={step} onBack={back} onNext={next} />;
  const { persona } = scenario;

  return (
    <>
      <StepIndicator current={step} hrefFor={hrefForStep} />

      <div className="stp-layout">
        <div className="stp-main">
          <section key={step} className="glass panel stp-step" aria-labelledby={headingId}>
            <div className="stp-intro">
              <h2 id={headingId} ref={headingRef} tabIndex={-1} className="stp-heading">
                {copy?.question}
              </h2>
              <p className="stp-lead">{copy?.lead}</p>
            </div>

            {step === 1 ? (
              <div className="stp-issue">
                <p className="stp-issue-type">
                  <Icon name="flag" size={16} /> {ISSUE_TYPE_LABELS[scenario.issueType]}
                </p>
                <p className="stp-issue-summary">{scenario.summary}</p>
                {scenario.tags.length > 0 ? (
                  <ul role="list" className="cluster" aria-label="Tags">
                    {scenario.tags.map((tag) => (
                      <li key={tag} className="chip">
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <dl className="stp-facts">
                  <div>
                    <dt>The customer</dt>
                    <dd>
                      <strong>{persona.name}</strong>, {persona.role}, {persona.organisation}. A
                      fictional customer.
                    </dd>
                  </div>
                  <div>
                    <dt>Estimated time</dt>
                    <dd>About {scenario.estimatedMinutes} minutes</dd>
                  </div>
                </dl>
                <p>
                  <Link to={libraryPath} className="stp-switch" viewTransition>
                    Choose a different scenario
                  </Link>
                </p>
              </div>
            ) : null}

            {step === 2 ? (
              <ChoiceGroup
                name="stp-impact"
                legend="Business impact"
                hideLegend
                columns={3}
                value={choices.impact}
                options={labelled(IMPACTS, IMPACT_LABELS, scenario.impact)}
                onChange={(impact) => update({ impact })}
              />
            ) : null}

            {step === 3 ? (
              <ChoiceGroup
                name="stp-temperature"
                legend="Customer temperament"
                hideLegend
                columns={2}
                value={choices.startingTemperature}
                options={labelled(
                  START_TEMPERATURES,
                  START_TEMPERATURE_LABELS,
                  scenario.startingTemperature,
                  (value) => (
                    <TemperatureOrb band={temperatureBandFor(value)} large />
                  ),
                )}
                onChange={(startingTemperature) => update({ startingTemperature })}
              />
            ) : null}

            {step === 4 ? (
              <div className="stp-stack">
                <ChoiceGroup
                  name="stp-style"
                  legend="How they talk"
                  columns={2}
                  value={choices.style}
                  options={labelled(STYLES, STYLE_LABELS, scenario.style)}
                  onChange={(style) => update({ style })}
                />
                <ChoiceGroup
                  name="stp-proficiency"
                  legend="How technical they are"
                  columns={3}
                  value={choices.proficiency}
                  options={labelled(PROFICIENCIES, PROFICIENCY_LABELS, scenario.proficiency)}
                  onChange={(proficiency) => update({ proficiency })}
                />
              </div>
            ) : null}

            {step === 5 ? (
              <ChoiceGroup
                name="stp-stage"
                legend="Call stage"
                hideLegend
                columns={2}
                value={choices.callStage}
                options={labelled(CALL_STAGES, CALL_STAGE_LABELS, scenario.callStage)}
                onChange={(callStage) => update({ callStage })}
              />
            ) : null}

            {step === 6 ? (
              <ChoiceGroup
                name="stp-difficulty"
                legend="Difficulty"
                hideLegend
                value={choices.difficulty}
                options={DIFFICULTIES.map((difficulty) => {
                  const profile = DIFFICULTY_PROFILES[difficulty];
                  return {
                    value: difficulty,
                    label: profile.label,
                    description: profile.summary,
                    detail: `Practice mode starts as ${PRACTICE_MODE_LABELS[profile.defaultMode].label}.`,
                    tag: difficulty === scenario.difficulty ? DEFAULT_TAG : undefined,
                  };
                })}
                onChange={(difficulty) => update({ difficulty })}
              />
            ) : null}

            {step === 7 ? (
              <CurveballPicker
                difficulty={choices.difficulty}
                mode={choices.curveballMode}
                picks={choices.curveballs}
                offered={scenario.curveballOptions}
                notice={notice}
                onModeChange={changeCurveballMode}
                onToggle={toggleCurveball}
              />
            ) : null}

            {step === STEP_COUNT ? (
              <div className="stp-stack">
                <SettingsSummary
                  rows={[issueRow(scenario), ...rows]}
                  editHref={(row) => hrefForStep(row.step)}
                  showNotes={false}
                  label="Your choices"
                />
                {rows.some((row) => row.changed) ? (
                  <div>
                    <button type="button" className="btn btn-ghost" onClick={reset}>
                      Reset to scenario defaults
                    </button>
                  </div>
                ) : (
                  <p className="stp-hint">Every setting matches the scenario as written.</p>
                )}
              </div>
            ) : null}

            {compact ? null : actions}
          </section>

          {compact ? (
            <div className="stp-dock">
              <SetupPreview
                variant="bar"
                scenario={scenario}
                choices={choices}
                rows={rows}
                onReset={reset}
              />
              {actions}
            </div>
          ) : null}
        </div>

        {compact ? null : (
          <aside className="stp-aside">
            <SetupPreview
              variant="panel"
              scenario={scenario}
              choices={choices}
              rows={rows}
              onReset={reset}
            />
          </aside>
        )}
      </div>

      <p className="sr-only" role="status">
        {status}
      </p>
    </>
  );
}
