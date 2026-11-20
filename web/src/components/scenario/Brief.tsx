import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Disclosure } from '../frame/index.ts';
import { ProviderNote } from './ProviderNote.tsx';

/**
 * Everything a trainee may know before the call: what the customer is calling about, the goal, what
 * the call practises and the ground rules. It is built only from the public scenario, so nothing
 * the customer holds back can appear here.
 */
export function Brief({
  scenario,
  customised,
}: {
  scenario: PublicScenarioDTO;
  /** True when any setting differs from the scenario as written. */
  customised: boolean;
}) {
  const { brief } = scenario;
  return (
    <Disclosure summary="The pre-call brief">
      <div className="cal-brief">
        <section className="cal-brief__part">
          <h3 className="type-label">The situation</h3>
          <p>{brief.situation}</p>
          {customised ? (
            <p className="cal-brief__note">
              This describes the scenario as written. The settings you changed apply to how the
              customer behaves on the call.
            </p>
          ) : null}
        </section>
        <section className="cal-brief__part">
          <h3 className="type-label">Your goal</h3>
          <p>{brief.goal}</p>
        </section>
        <section className="cal-brief__part">
          <h3 className="type-label">What you will practise</h3>
          <ul className="cal-brief__list" role="list">
            {scenario.coachingFocus.map((dimension) => (
              <li key={dimension}>{DIMENSIONS[dimension].label}</li>
            ))}
          </ul>
        </section>
        {brief.groundRules.length > 0 ? (
          <section className="cal-brief__part">
            <h3 className="type-label">Ground rules</h3>
            <ul className="cal-brief__list" role="list">
              {brief.groundRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Disclosure>
  );
}

/** The honest reminders that stay on the page, however the settings are set. */
export function Reminders() {
  return (
    <section className="cal-note" aria-labelledby="cal-before">
      <h2 id="cal-before" className="type-label">
        Before you begin
      </h2>
      <ul className="cal-note__list" role="list">
        <li>
          The customer is fictional. Never type real customer names, case details or credentials.
        </li>
        <li>You can end the call at any time.</li>
        <li>Feedback afterwards is coaching for practice, not a performance assessment.</li>
      </ul>
      <ProviderNote />
    </section>
  );
}
