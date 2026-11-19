import type { PublicStateDTO, SessionDTO } from '#shared/domain/api.ts';
import { CALL_STAGE_LABELS, IMPACT_LABELS, PRACTICE_MODE_LABELS } from '#shared/domain/vocab.ts';
import { DifficultyChip } from '../Chips.tsx';
import { ProviderBadge } from '../ProviderBadge.tsx';
import { MoodMeter } from './MoodMeter.tsx';

/** Everything the trainee is allowed to know during the call. Hidden facts are never in this data. */
export function ContextPanel({
  session,
  state,
  notes,
  onNotes,
}: {
  session: SessionDTO;
  state: PublicStateDTO;
  notes: string;
  onNotes(value: string): void;
}) {
  const { persona, brief, config } = session.scenario;
  const guided = config.mode === 'guided';
  return (
    <div className="ctx stack">
      <section className="ctx-section">
        <h3 className="t-label">Customer</h3>
        <p className="ctx-name">{persona.name}</p>
        <p className="t-small t-muted">
          {persona.role}, {persona.organisation}
        </p>
        <p className="cluster">
          <span className="chip">Simulated and fictional</span>
          <span className="chip">{CALL_STAGE_LABELS[config.callStage].label}</span>
          <span className="chip">{IMPACT_LABELS[config.impact].label} impact</span>
          <DifficultyChip difficulty={config.difficulty} />
          <span className="chip">{PRACTICE_MODE_LABELS[config.mode].label}</span>
        </p>
      </section>

      <section className="ctx-section">
        <h3 className="t-label">The situation</h3>
        <p className="t-small">{brief.situation}</p>
        <h3 className="t-label">Your goal</h3>
        <p className="t-small">{brief.goal}</p>
        {brief.groundRules.length > 0 ? (
          <details className="ctx-details">
            <summary>Ground rules</summary>
            <ul className="ctx-list t-small">
              {brief.groundRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {guided ? (
        <section className="ctx-section">
          <h3 className="t-label">Guided practice</h3>
          <MoodMeter state={state} />
          <p className="t-small">
            <strong>{state.discoveredCount}</strong>{' '}
            {state.discoveredCount === 1 ? 'fact' : 'facts'} uncovered so far
          </p>
          {session.scenario.expectedDiscoveryAreas.length > 0 ? (
            <>
              <h4 className="t-label">Areas worth exploring</h4>
              <ul className="ctx-list t-small">
                {session.scenario.expectedDiscoveryAreas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : (
        <section className="ctx-section">
          <h3 className="t-label">Immersive</h3>
          <p className="t-small t-muted">
            No on-screen cues. Read the customer through what they say, as you would on a real call.
          </p>
        </section>
      )}

      <section className="ctx-section">
        <label htmlFor="notes" className="t-label">
          Private notes
        </label>
        <textarea
          id="notes"
          className="textarea ctx-notes"
          rows={4}
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
          placeholder="Jot down questions to ask or things to follow up on."
          aria-describedby="notes-hint"
          maxLength={2000}
        />
        <p id="notes-hint" className="t-meta">
          Kept in this browser tab only. Not sent anywhere and not part of your report. Do not write
          real customer details here either.
        </p>
      </section>

      <section className="ctx-section">
        <h3 className="t-label">How the customer is produced</h3>
        <p>
          <ProviderBadge />
        </p>
      </section>
    </div>
  );
}
