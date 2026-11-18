import { useId, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  DIMENSIONS,
  PRACTICE_MODES,
  PRACTICE_MODE_LABELS,
  type PracticeMode,
} from '#shared/domain/vocab.ts';
import { Icon } from '../components/Icon.tsx';
import { ErrorState, Page, SkeletonBlock } from '../components/Page.tsx';
import { ProviderBadge } from '../components/ProviderBadge.tsx';
import { ChoiceGroup } from '../components/scenario/ChoiceGroup.tsx';
import { isOneOf } from '../components/scenario/guards.ts';
import { setupPath } from '../components/scenario/paths.ts';
import { ScenarioNotFound } from '../components/scenario/ScenarioNotFound.tsx';
import { isNotFoundError } from '../components/scenario/scenario-errors.ts';
import { SettingsSummary } from '../components/scenario/SettingsSummary.tsx';
import {
  STEP_COUNT,
  choicesFromOverrides,
  draftFor,
  overridesFromChoices,
  settingRows,
} from '../components/scenario/setup-model.ts';
import { api, errorMessage, isApiError } from '../lib/api.ts';
import { useAppConfig } from '../lib/config.tsx';
import { clearDraft, loadDraft, saveDraft } from '../lib/draft.ts';
import { useApi } from '../lib/hooks.ts';
import '../styles/setup.css';
import '../styles/brief.css';

/** Stable for one visit to the brief, so a double click or a retry never starts two calls. */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

function BriefFrame({
  title,
  lead,
  children,
}: {
  title?: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <Page title={title ? `Brief: ${title}` : 'Pre-call brief'}>
      <header className="brf-header">
        <p className="t-label">Pre-call brief</p>
        <h1 className="t-title">{title ?? 'Pre-call brief'}</h1>
        {lead ? <p className="t-lead">{lead}</p> : null}
      </header>
      {children}
    </Page>
  );
}

export default function Brief() {
  const { id = '' } = useParams<{ id: string }>();
  const scenario = useApi((signal) => api.scenario(id, signal), [id]);

  if (scenario.loading) {
    return (
      <BriefFrame>
        <div className="glass panel stack" role="status" aria-label="Loading brief">
          <SkeletonBlock height={14} width="24%" />
          <SkeletonBlock height={18} />
          <SkeletonBlock height={18} width="80%" />
          <SkeletonBlock height={96} />
        </div>
      </BriefFrame>
    );
  }
  if (scenario.error) {
    return isNotFoundError(scenario.error) ? (
      <ScenarioNotFound />
    ) : (
      <BriefFrame>
        <ErrorState
          error={scenario.error}
          onRetry={scenario.reload}
          title="Could not load this brief"
        />
      </BriefFrame>
    );
  }
  if (!scenario.data) return <ScenarioNotFound />;
  return (
    <BriefFrame title={scenario.data.title} lead={scenario.data.summary}>
      <BriefView key={scenario.data.id} scenario={scenario.data} />
    </BriefFrame>
  );
}

/** How replies are produced. Demo mode is always stated plainly, and any notice from the server is shown. */
function ProviderNote() {
  const { config, loading, error } = useAppConfig();
  if (loading) return <p className="brf-provider-text">Checking how replies are produced…</p>;
  if (error || !config) {
    return (
      <p className="brf-provider-text">
        Firefly could not confirm how replies are produced right now. Treat replies and coaching as
        imperfect.
      </p>
    );
  }
  const { provider } = config;
  return (
    <>
      <p className="brf-provider-text">
        {provider.demo
          ? "Replies and coaching come from Firefly's built-in rules engine, not an AI model. They can still miss nuance."
          : `Replies and coaching come from ${provider.label}, an AI model. They can be incomplete or wrong.`}
      </p>
      {provider.notice ? <p className="brf-provider-notice">{provider.notice}</p> : null}
    </>
  );
}

function BriefView({ scenario }: { scenario: PublicScenarioDTO }) {
  const navigate = useNavigate();
  const modeId = useId();
  const beforeId = useId();

  // The draft only counts when it is for this scenario. It is read once: the choices are fixed for
  // this visit and the only thing that can change here is the practice mode.
  const [initial] = useState(() => {
    const draft = draftFor(loadDraft(), scenario.id);
    const choices = choicesFromOverrides(scenario, draft?.overrides ?? {});
    const defaultMode = DIFFICULTY_PROFILES[choices.difficulty].defaultMode;
    return {
      choices,
      overrides: overridesFromChoices(scenario, choices),
      defaultMode,
      mode: isOneOf(PRACTICE_MODES, draft?.mode) ? draft.mode : defaultMode,
    };
  });
  const { choices, overrides, defaultMode } = initial;
  const rows = settingRows(scenario, choices);
  const changed = rows.some((row) => row.changed);

  const [mode, setMode] = useState<PracticeMode>(initial.mode);
  const [clientRequestId] = useState(newRequestId);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const inFlight = useRef(false);

  const chooseMode = (next: PracticeMode) => {
    setMode(next);
    saveDraft({ scenarioId: scenario.id, overrides, mode: next });
  };

  const begin = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    try {
      const session = await api.createSession({
        scenarioId: scenario.id,
        overrides,
        mode,
        clientRequestId,
      });
      clearDraft();
      void navigate(`/calls/${session.id}`, { viewTransition: true });
    } catch (error) {
      setFailure(error);
      inFlight.current = false;
      setPending(false);
    }
  };

  const { persona } = scenario;
  const difficultyLabel = DIFFICULTY_PROFILES[choices.difficulty].label;
  const retryable = failure !== null && (!isApiError(failure) || failure.retryable);

  return (
    <>
      <div className="brf-layout">
        <div className="brf-main">
          <section className="brf-section" aria-labelledby={`${beforeId}-situation`}>
            <h2 id={`${beforeId}-situation`} className="brf-h">
              The situation
            </h2>
            <p className="brf-text">{scenario.brief.situation}</p>
            {changed ? (
              <p className="brf-note">
                This describes the scenario as written. The settings you changed, marked on this
                page, apply to how the customer behaves on the call.
              </p>
            ) : null}
          </section>

          <section className="brf-goal" aria-labelledby={`${beforeId}-goal`}>
            <h2 id={`${beforeId}-goal`} className="brf-h">
              Your goal
            </h2>
            <p className="brf-goal-text">{scenario.brief.goal}</p>
          </section>

          {scenario.brief.groundRules.length > 0 ? (
            <section className="brf-section" aria-labelledby={`${beforeId}-rules`}>
              <h2 id={`${beforeId}-rules`} className="brf-h">
                Ground rules
              </h2>
              <ul className="brf-list">
                {scenario.brief.groundRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="brf-section" aria-labelledby={`${beforeId}-coaching`}>
            <h2 id={`${beforeId}-coaching`} className="brf-h">
              What you'll be coached on
            </h2>
            <ul className="brf-list">
              {scenario.coachingFocus.map((dimension) => (
                <li key={dimension}>
                  <strong>{DIMENSIONS[dimension].label}.</strong>{' '}
                  {DIMENSIONS[dimension].description}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="brf-aside">
          <section className="glass card brf-customer" aria-labelledby={`${beforeId}-customer`}>
            <h2 id={`${beforeId}-customer`} className="brf-h">
              Your customer
            </h2>
            <div className="brf-persona">
              <span className="brf-monogram" aria-hidden="true">
                {initialsOf(persona.name)}
              </span>
              <div className="brf-persona-text">
                <p className="brf-persona-name">{persona.name}</p>
                <p className="brf-persona-role">
                  {persona.role}, {persona.organisation}
                </p>
              </div>
            </div>
            <p className="brf-fictional">
              <Icon name="shield" size={16} /> A fictional customer
            </p>
            <p className="brf-duration">
              <Icon name="clock" size={16} /> About {scenario.estimatedMinutes} minutes
            </p>
          </section>

          <section className="glass card brf-settings" aria-labelledby={`${beforeId}-settings`}>
            <div className="row between">
              <h2 id={`${beforeId}-settings`} className="brf-h">
                Settings for this call
              </h2>
              <Link
                to={setupPath(scenario.id, STEP_COUNT)}
                className="btn btn-ghost btn-sm"
                aria-label="Change settings"
              >
                Change
              </Link>
            </div>
            <SettingsSummary rows={rows} showNotes={false} />
          </section>
        </aside>
      </div>

      <section className="glass panel brf-ready" aria-labelledby={`${beforeId}-ready`}>
        <h2 id={`${beforeId}-ready`} className="sr-only">
          Start the call
        </h2>
        <div className="brf-ready-grid">
          <div className="brf-mode">
            <ChoiceGroup
              name={`brf-mode-${modeId}`}
              legend="Practice mode"
              hint="Guided practice adds light cues on screen during the call. The customer behaves the same either way."
              value={mode}
              options={PRACTICE_MODES.map((option) => ({
                value: option,
                label: PRACTICE_MODE_LABELS[option].label,
                description: PRACTICE_MODE_LABELS[option].description,
                tag: option === defaultMode ? `Default for ${difficultyLabel}` : undefined,
              }))}
              onChange={chooseMode}
              disabled={pending}
            />
          </div>

          <div className="callout brf-before" role="group" aria-labelledby={`${beforeId}-before`}>
            <Icon name="shield" size={20} />
            <div className="brf-before-body">
              <h3 id={`${beforeId}-before`} className="brf-before-title">
                Before you begin
              </h3>
              <ul className="brf-before-list">
                <li>
                  The customer is fictional. Don't type real customer names, case details or
                  credentials.
                </li>
                <li>Replies and coaching are generated, so they can be imperfect.</li>
                <li>Coaching after the call is practice feedback, not a performance assessment.</li>
              </ul>
              <div className="brf-provider">
                <ProviderBadge />
                <ProviderNote />
              </div>
            </div>
          </div>
        </div>

        {failure !== null ? (
          <div className="callout callout-negative brf-error" role="alert">
            <Icon name="alert" size={20} />
            <div className="brf-error-body">
              <p>
                <strong>We couldn't start your call.</strong> {errorMessage(failure)}
              </p>
              <p>Your choices are kept.</p>
              {retryable ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={begin}>
                  <Icon name="refresh" size={16} /> Retry
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="brf-actions">
          <Link to={setupPath(scenario.id, STEP_COUNT)} className="btn btn-secondary btn-lg">
            <Icon name="arrow-left" size={18} /> Back to setup
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={begin}
            disabled={pending}
          >
            {pending ? (
              <>
                <span className="spinner" aria-hidden="true" /> Starting call…
              </>
            ) : (
              <>
                Begin call <Icon name="arrow-right" size={18} />
              </>
            )}
          </button>
        </div>
        <p className="sr-only" role="status">
          {pending ? 'Starting your call…' : ''}
        </p>
      </section>
    </>
  );
}
