import { useId } from 'react';
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { formatRelative } from '../../lib/format.ts';
import { Tag } from '../frame/Tag.tsx';
import { callGlyphTraits, type ScenarioFacts } from '../history/trail-model.ts';
import { Icon } from '../Icon.tsx';
import { setupPath } from '../scenario/paths.ts';
import { SignalGlyph } from '../signal/SignalGlyph.tsx';
import { missionFacts, type HeroMission } from './dashboard-model.ts';
import { Hero } from './Hero.tsx';

type Persona = HeroMission['persona'];

/** "Maya Okafor, front-desk coordinator, Fabrikam Dental Group": who is calling, in one line. */
function PersonaLine({ persona }: { persona: Persona }) {
  const role = persona.role.trim();
  const organisation = persona.organisation.trim();
  return (
    <>
      {persona.name}
      {role ? `, ${role}` : ''}
      {organisation ? `, ${organisation}` : ''}
    </>
  );
}

/**
 * The mission to practise next, which the recommendation engine chose, with the reason it gives.
 * Pressing the action carries the mission's instrument into the calibration.
 */
export function NextMission({ mission, reason }: { mission: HeroMission; reason: string }) {
  return (
    <Hero
      kind="next"
      kicker={
        <>
          <span className="type-label">Next mission</span>
          <Tag tone="amber">Recommended</Tag>
        </>
      }
      title={mission.title}
      persona={<PersonaLine persona={mission.persona} />}
      facts={missionFacts(mission)}
      why={{ label: 'Why this one', text: reason }}
      glyph={mission}
      actions={
        <>
          <Link to={setupPath(mission.id)} className="action" viewTransition>
            Calibrate this mission <Icon name="arrow-right" size={18} />
          </Link>
          <Link to="/scenarios" className="text-link" viewTransition>
            See all missions
          </Link>
        </>
      }
    />
  );
}

/**
 * While a call is open, the recommended mission waits here, in a quieter line: it is still one press
 * from calibration, but it is not what the page asks for.
 */
export function AlsoSuggested({ mission, reason }: { mission: HeroMission; reason: string }) {
  const titleId = useId();
  return (
    <section className="home-also" aria-labelledby={titleId}>
      <div className="home-also__glyph" aria-hidden="true">
        <SignalGlyph traits={mission} size={56} />
      </div>
      <div className="home-also__body">
        <h2 id={titleId} className="home-also__label type-label">
          Also suggested
        </h2>
        <p className="home-also__title">
          <Link to={setupPath(mission.id)} className="text-link" viewTransition>
            {mission.title}
          </Link>
        </p>
        <p className="home-also__reason">{reason}</p>
      </div>
    </section>
  );
}

/**
 * A call that is still open comes before anything else. The recommended mission waits in a quieter
 * line under it (see `AlsoSuggested`).
 */
export function OpenCall({
  call,
  scenario,
  persona,
}: {
  call: SessionSummaryDTO;
  scenario: ScenarioFacts | undefined;
  persona: Persona | null;
}) {
  return (
    <Hero
      kind="open"
      kicker={
        <>
          <span className="type-label">You have a call in progress</span>
          <Tag tone="aqua">In progress</Tag>
        </>
      }
      title={call.scenarioTitle}
      persona={persona ? <PersonaLine persona={persona} /> : undefined}
      facts={missionFacts({
        impact: call.impact,
        difficulty: call.difficulty,
        start: call.startingTemperature,
        stage: scenario?.stage,
        minutes: scenario?.minutes,
      })}
      why={{
        label: 'Where you left it',
        text: (
          <>
            Started <span className="nowrap">{formatRelative(call.startedAt)}</span>. Everything you
            have sent is saved.
          </>
        ),
      }}
      glyph={callGlyphTraits(call, scenario)}
      actions={
        <>
          <Link to={`/calls/${encodeURIComponent(call.id)}`} className="action" viewTransition>
            Return to your call <Icon name="arrow-right" size={18} />
          </Link>
          <Link to="/practice" className="text-link" viewTransition>
            Start a new practice
          </Link>
        </>
      }
    />
  );
}
