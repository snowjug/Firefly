import type { SessionDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { CALL_STAGE_LABELS, IMPACT_LABELS, PRACTICE_MODE_LABELS } from '#shared/domain/vocab.ts';
import { ProviderNote } from './ProviderNote.tsx';

/**
 * Everything the trainee is allowed to know about the call, set out as a short page: who is
 * calling, the situation and the goal, what the call was set up with, and a place for private
 * notes. Hidden facts are never in this data. Guided practice adds the areas worth exploring;
 * immersive practice says there are no cues.
 */
export function CallDetails({
  session,
  notes,
  onNotes,
}: {
  session: SessionDTO;
  notes: string;
  onNotes(value: string): void;
}) {
  const { persona, brief, config } = session.scenario;
  const guided = config.mode === 'guided';
  return (
    <div className="ch-details">
      <section className="ch-details__section">
        <h3 className="ch-eyebrow">Scenario</h3>
        <p className="ch-details__scenario">{session.scenario.title}</p>
        <h3 className="ch-eyebrow">Customer</h3>
        <p className="ch-details__name">{persona.name}</p>
        <p className="ch-details__role">
          {persona.role}, {persona.organisation}. Simulated and fictional.
        </p>
        <dl className="ch-facts">
          <div>
            <dt>Call stage</dt>
            <dd>{CALL_STAGE_LABELS[config.callStage].label}</dd>
          </div>
          <div>
            <dt>Impact</dt>
            <dd>{IMPACT_LABELS[config.impact].label} impact</dd>
          </div>
          <div>
            <dt>Difficulty</dt>
            <dd>{DIFFICULTY_PROFILES[config.difficulty].label}</dd>
          </div>
          <div>
            <dt>Practice</dt>
            <dd>{PRACTICE_MODE_LABELS[config.mode].label}</dd>
          </div>
        </dl>
      </section>

      <section className="ch-details__section">
        <h3 className="ch-eyebrow">The situation</h3>
        <p className="ch-details__read">{brief.situation}</p>
        <h3 className="ch-eyebrow">Your goal</h3>
        <p className="ch-details__read">{brief.goal}</p>
        {brief.groundRules.length > 0 ? (
          <details className="ch-disclosure">
            <summary>Ground rules</summary>
            <ul role="list" className="ch-details__list">
              {brief.groundRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {guided ? (
        session.scenario.expectedDiscoveryAreas.length > 0 ? (
          <section className="ch-details__section">
            <h3 className="ch-eyebrow">Areas worth exploring</h3>
            <ul role="list" className="ch-details__list">
              {session.scenario.expectedDiscoveryAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </section>
        ) : null
      ) : (
        <section className="ch-details__section">
          <h3 className="ch-eyebrow">Immersive</h3>
          <p className="ch-details__read">
            No on-screen cues. Read the customer through what they say, as you would on a real call.
          </p>
        </section>
      )}

      <section className="ch-details__section">
        <label htmlFor="notes" className="ch-eyebrow">
          Private notes
        </label>
        <textarea
          id="notes"
          className="ch-notes"
          rows={4}
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
          placeholder="Jot down questions to ask or things to follow up on."
          aria-describedby="notes-hint"
          maxLength={2000}
        />
        <p id="notes-hint" className="ch-details__small">
          Kept in this browser tab only. Not sent anywhere and not part of your report. Do not write
          real customer details here either.
        </p>
      </section>

      <section className="ch-details__section">
        <h3 className="ch-eyebrow">How the customer is produced</h3>
        <p className="ch-details__small">
          <ProviderNote long />
        </p>
      </section>
    </div>
  );
}
